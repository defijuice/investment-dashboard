#!/usr/bin/env python3
"""
스킬 패키징 스크립트
스킬을 검증하고 .skill 파일 (zip)로 패키징합니다.

사용법:
    python3 package_skill.py <path/to/skill-folder> [output-directory]
"""

import argparse
import os
import re
import sys
import zipfile
from pathlib import Path


def validate_frontmatter(content: str) -> tuple[bool, list[str]]:
    """SKILL.md frontmatter 검증"""
    errors = []

    # YAML frontmatter 존재 확인
    if not content.startswith('---'):
        errors.append("SKILL.md는 YAML frontmatter로 시작해야 합니다 (---)")
        return False, errors

    # frontmatter 끝 찾기
    end_match = re.search(r'\n---\n', content[3:])
    if not end_match:
        errors.append("YAML frontmatter가 닫히지 않았습니다 (---)")
        return False, errors

    frontmatter = content[3:end_match.start() + 3]

    # name 필드 확인
    if 'name:' not in frontmatter:
        errors.append("frontmatter에 'name' 필드가 필요합니다")

    # description 필드 확인
    if 'description:' not in frontmatter:
        errors.append("frontmatter에 'description' 필드가 필요합니다")

    # TODO 플레이스홀더 확인
    if 'TODO' in frontmatter:
        errors.append("frontmatter에 TODO 플레이스홀더가 남아있습니다")

    return len(errors) == 0, errors


def validate_skill_structure(skill_path: str) -> tuple[bool, list[str]]:
    """스킬 디렉토리 구조 검증"""
    errors = []
    skill_path = Path(skill_path)

    # SKILL.md 존재 확인
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        errors.append("SKILL.md 파일이 필요합니다")
        return False, errors

    # SKILL.md 내용 검증
    with open(skill_md, 'r', encoding='utf-8') as f:
        content = f.read()

    valid, fm_errors = validate_frontmatter(content)
    errors.extend(fm_errors)

    # 본문에 TODO 확인 (경고만)
    body_start = content.find('---', 3) + 3
    body = content[body_start:]
    if 'TODO' in body:
        print("⚠️  경고: SKILL.md 본문에 TODO 플레이스홀더가 있습니다")

    # 불필요한 파일 확인
    unwanted_files = [
        'README.md', 'INSTALLATION_GUIDE.md', 'QUICK_REFERENCE.md',
        'CHANGELOG.md', 'LICENSE.md', '.DS_Store'
    ]
    for unwanted in unwanted_files:
        if (skill_path / unwanted).exists():
            print(f"⚠️  경고: 불필요한 파일 발견: {unwanted}")

    return len(errors) == 0, errors


def get_skill_name(skill_path: str) -> str:
    """SKILL.md에서 스킬 이름 추출"""
    skill_md = Path(skill_path) / 'SKILL.md'
    with open(skill_md, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'name:\s*(.+)', content)
    if match:
        return match.group(1).strip()

    # 폴백: 디렉토리 이름 사용
    return Path(skill_path).name


def package_skill(skill_path: str, output_dir: str) -> str:
    """스킬을 .skill 파일로 패키징"""
    skill_path = Path(skill_path).resolve()
    output_dir = Path(output_dir).resolve()

    skill_name = get_skill_name(str(skill_path))
    output_file = output_dir / f"{skill_name}.skill"

    # 기존 파일 삭제
    if output_file.exists():
        output_file.unlink()

    # zip 파일 생성
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(skill_path):
            # 제외할 디렉토리
            dirs[:] = [d for d in dirs if d not in [
                '__pycache__', '.git', 'node_modules', '.DS_Store'
            ]]

            for file in files:
                # 제외할 파일
                if file in ['.DS_Store', '.gitignore']:
                    continue

                file_path = Path(root) / file
                arc_name = file_path.relative_to(skill_path)
                zf.write(file_path, arc_name)
                print(f"  추가: {arc_name}")

    return str(output_file)


def main():
    parser = argparse.ArgumentParser(
        description='스킬을 검증하고 .skill 파일로 패키징합니다.'
    )
    parser.add_argument(
        'skill_path',
        help='스킬 디렉토리 경로'
    )
    parser.add_argument(
        'output_dir',
        nargs='?',
        default='.',
        help='출력 디렉토리 (기본값: 현재 디렉토리)'
    )

    args = parser.parse_args()

    skill_path = os.path.abspath(args.skill_path)
    output_dir = os.path.abspath(args.output_dir)

    # 경로 확인
    if not os.path.isdir(skill_path):
        print(f"에러: 스킬 디렉토리가 존재하지 않습니다: {skill_path}")
        sys.exit(1)

    if not os.path.isdir(output_dir):
        print(f"에러: 출력 디렉토리가 존재하지 않습니다: {output_dir}")
        sys.exit(1)

    print(f"🔍 스킬 검증 중: {skill_path}")
    print()

    # 검증
    valid, errors = validate_skill_structure(skill_path)

    if not valid:
        print("❌ 검증 실패:")
        for error in errors:
            print(f"   - {error}")
        sys.exit(1)

    print("✓ 검증 통과")
    print()

    # 패키징
    print("📦 패키징 중...")
    output_file = package_skill(skill_path, output_dir)

    print()
    print(f"🎉 패키징 완료!")
    print(f"   출력: {output_file}")

    # tar.gz 형태로도 생성
    import shutil
    tar_file = output_file.replace('.skill', '.tar.gz')
    shutil.make_archive(
        output_file.replace('.skill', ''),
        'gztar',
        os.path.dirname(skill_path),
        os.path.basename(skill_path)
    )
    print(f"   출력: {tar_file}")


if __name__ == "__main__":
    main()
