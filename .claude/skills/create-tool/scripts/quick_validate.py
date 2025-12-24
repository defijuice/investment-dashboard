#!/usr/bin/env python3
"""
스킬 빠른 검증 스크립트
SKILL.md의 기본 구조와 필수 필드를 검증합니다.

사용법:
    python3 quick_validate.py <path/to/skill-folder>
"""

import argparse
import os
import re
import sys
from pathlib import Path


def validate_frontmatter(content: str) -> tuple[bool, list[str], list[str]]:
    """SKILL.md frontmatter 검증"""
    errors = []
    warnings = []

    # YAML frontmatter 존재 확인
    if not content.startswith('---'):
        errors.append("SKILL.md는 YAML frontmatter로 시작해야 합니다 (---)")
        return False, errors, warnings

    # frontmatter 끝 찾기
    end_match = re.search(r'\n---\n', content[3:])
    if not end_match:
        errors.append("YAML frontmatter가 닫히지 않았습니다 (---)")
        return False, errors, warnings

    frontmatter = content[3:end_match.start() + 3]

    # name 필드 확인
    name_match = re.search(r'^name:\s*(.+)$', frontmatter, re.MULTILINE)
    if not name_match:
        errors.append("frontmatter에 'name' 필드가 필요합니다")
    elif not name_match.group(1).strip():
        errors.append("'name' 필드가 비어있습니다")

    # description 필드 확인
    if 'description:' not in frontmatter:
        errors.append("frontmatter에 'description' 필드가 필요합니다")
    else:
        # description 내용 확인
        desc_match = re.search(r'description:\s*\|?\s*\n?([\s\S]*?)(?=\n[a-z]|$)', frontmatter)
        if desc_match:
            desc_content = desc_match.group(1).strip()
            if len(desc_content) < 20:
                warnings.append("description이 너무 짧습니다. 더 상세히 작성하세요.")

    # TODO 플레이스홀더 확인
    if 'TODO' in frontmatter:
        errors.append("frontmatter에 TODO 플레이스홀더가 남아있습니다")

    return len(errors) == 0, errors, warnings


def validate_body(content: str) -> tuple[bool, list[str], list[str]]:
    """SKILL.md 본문 검증"""
    errors = []
    warnings = []

    # frontmatter 이후 본문 추출
    match = re.search(r'\n---\n', content[3:])
    if not match:
        return False, ["본문을 찾을 수 없습니다"], warnings

    body = content[match.end() + 3:]

    # 본문 최소 길이 확인
    if len(body.strip()) < 50:
        warnings.append("본문 내용이 너무 짧습니다")

    # TODO 플레이스홀더 확인
    if 'TODO' in body:
        warnings.append("본문에 TODO 플레이스홀더가 남아있습니다")

    # 헤더 존재 확인
    if not re.search(r'^#\s+', body, re.MULTILINE):
        warnings.append("본문에 헤더(#)가 없습니다")

    return True, errors, warnings


def validate_structure(skill_path: Path) -> tuple[bool, list[str], list[str]]:
    """스킬 디렉토리 구조 검증"""
    errors = []
    warnings = []

    # SKILL.md 존재 확인
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        errors.append("SKILL.md 파일이 필요합니다")
        return False, errors, warnings

    # 불필요한 파일 확인
    unwanted_files = [
        'README.md', 'INSTALLATION_GUIDE.md', 'QUICK_REFERENCE.md',
        'CHANGELOG.md', 'LICENSE.md'
    ]
    for unwanted in unwanted_files:
        if (skill_path / unwanted).exists():
            warnings.append(f"불필요할 수 있는 파일: {unwanted}")

    # 빈 디렉토리 확인
    for subdir in ['scripts', 'references', 'assets']:
        subdir_path = skill_path / subdir
        if subdir_path.exists():
            files = list(subdir_path.iterdir())
            # .DS_Store 등 숨김 파일 제외
            files = [f for f in files if not f.name.startswith('.')]
            if not files:
                warnings.append(f"빈 디렉토리: {subdir}/")

    return len(errors) == 0, errors, warnings


def validate_references(skill_path: Path, skill_content: str) -> list[str]:
    """참조된 파일들이 실제로 존재하는지 확인"""
    warnings = []

    # 마크다운 링크 찾기 [text](path)
    links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', skill_content)

    for text, path in links:
        # 외부 링크는 스킵
        if path.startswith('http://') or path.startswith('https://'):
            continue

        # 상대 경로 해결
        ref_path = skill_path / path
        if not ref_path.exists():
            warnings.append(f"참조된 파일이 없습니다: {path}")

    return warnings


def quick_validate(skill_path: str) -> tuple[bool, list[str], list[str]]:
    """스킬 빠른 검증 실행"""
    skill_path = Path(skill_path).resolve()
    all_errors = []
    all_warnings = []

    # 1. 구조 검증
    valid, errors, warnings = validate_structure(skill_path)
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    if not valid:
        return False, all_errors, all_warnings

    # 2. SKILL.md 읽기
    skill_md = skill_path / 'SKILL.md'
    with open(skill_md, 'r', encoding='utf-8') as f:
        content = f.read()

    # 3. Frontmatter 검증
    valid, errors, warnings = validate_frontmatter(content)
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # 4. 본문 검증
    valid, errors, warnings = validate_body(content)
    all_errors.extend(errors)
    all_warnings.extend(warnings)

    # 5. 참조 파일 검증
    ref_warnings = validate_references(skill_path, content)
    all_warnings.extend(ref_warnings)

    return len(all_errors) == 0, all_errors, all_warnings


def main():
    parser = argparse.ArgumentParser(
        description='스킬을 빠르게 검증합니다.'
    )
    parser.add_argument(
        'skill_path',
        help='스킬 디렉토리 경로'
    )

    args = parser.parse_args()

    skill_path = os.path.abspath(args.skill_path)

    if not os.path.isdir(skill_path):
        print(f"❌ 에러: 디렉토리가 존재하지 않습니다: {skill_path}")
        sys.exit(1)

    print(f"🔍 검증 중: {skill_path}")
    print()

    valid, errors, warnings = quick_validate(skill_path)

    # 결과 출력
    if warnings:
        print("⚠️  경고:")
        for warning in warnings:
            print(f"   - {warning}")
        print()

    if errors:
        print("❌ 에러:")
        for error in errors:
            print(f"   - {error}")
        print()
        sys.exit(1)

    print("✅ 검증 통과!")
    sys.exit(0)


if __name__ == "__main__":
    main()
