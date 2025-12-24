#!/usr/bin/env python3
"""
스킬 초기화 스크립트
새 스킬 디렉토리와 기본 파일들을 생성합니다.

사용법:
    python3 init_skill.py <skill-name> --path <output-directory>
"""

import argparse
import os
import sys


def create_skill_md(skill_name: str) -> str:
    """SKILL.md 템플릿 생성"""
    return f'''---
name: {skill_name}
version: 1.0.0
repo: TODO/username/{skill_name}
description: |
  TODO: 이 스킬이 무엇을 하는지 설명하세요.
  다음과 같은 요청에 이 스킬을 사용하세요:
  - "TODO: 트리거 예시 1"
  - "TODO: 트리거 예시 2"
---

# {skill_name}

TODO: 스킬 설명을 작성하세요.

## 사용법

TODO: 기본 사용법을 작성하세요.

## 주요 기능

- TODO: 기능 1
- TODO: 기능 2
'''


def create_example_script() -> str:
    """예시 스크립트 생성"""
    return '''#!/usr/bin/env python3
"""
예시 스크립트
TODO: 필요에 따라 수정하거나 삭제하세요.
"""

import sys


def main():
    print("Hello from example script!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
'''


def create_example_reference() -> str:
    """예시 참조 문서 생성"""
    return '''# 참조 문서

TODO: 필요에 따라 수정하거나 삭제하세요.

## 섹션 1

상세 내용...

## 섹션 2

상세 내용...
'''


def create_example_asset() -> str:
    """예시 에셋 파일 생성"""
    return '''# 에셋 README

이 디렉토리에는 출력에 사용되는 에셋 파일들이 저장됩니다.
예: 템플릿, 이미지, 폰트 등

TODO: 필요한 에셋을 추가하고 이 파일은 삭제하세요.
'''


def init_skill(skill_name: str, output_path: str) -> None:
    """스킬 디렉토리 구조 초기화"""

    # 스킬 디렉토리 경로
    skill_dir = os.path.join(output_path, skill_name)

    # 디렉토리 생성
    directories = [
        skill_dir,
        os.path.join(skill_dir, 'scripts'),
        os.path.join(skill_dir, 'references'),
        os.path.join(skill_dir, 'assets'),
    ]

    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✓ 디렉토리 생성: {directory}")

    # SKILL.md 생성
    skill_md_path = os.path.join(skill_dir, 'SKILL.md')
    with open(skill_md_path, 'w', encoding='utf-8') as f:
        f.write(create_skill_md(skill_name))
    print(f"✓ 파일 생성: {skill_md_path}")

    # 예시 스크립트 생성
    script_path = os.path.join(skill_dir, 'scripts', 'example.py')
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(create_example_script())
    os.chmod(script_path, 0o755)
    print(f"✓ 파일 생성: {script_path}")

    # 예시 참조 문서 생성
    reference_path = os.path.join(skill_dir, 'references', 'example.md')
    with open(reference_path, 'w', encoding='utf-8') as f:
        f.write(create_example_reference())
    print(f"✓ 파일 생성: {reference_path}")

    # 예시 에셋 README 생성
    asset_readme_path = os.path.join(skill_dir, 'assets', 'README.md')
    with open(asset_readme_path, 'w', encoding='utf-8') as f:
        f.write(create_example_asset())
    print(f"✓ 파일 생성: {asset_readme_path}")

    print(f"\n🎉 스킬 '{skill_name}' 초기화 완료!")
    print(f"   위치: {skill_dir}")
    print("\n다음 단계:")
    print("1. SKILL.md를 편집하여 스킬 설명 작성")
    print("2. 필요한 scripts/, references/, assets/ 파일 추가")
    print("3. 불필요한 예시 파일 삭제")


def main():
    parser = argparse.ArgumentParser(
        description='새 스킬 디렉토리를 초기화합니다.'
    )
    parser.add_argument(
        'skill_name',
        help='스킬 이름 (예: my-skill)'
    )
    parser.add_argument(
        '--path',
        default='.',
        help='스킬을 생성할 디렉토리 (기본값: 현재 디렉토리)'
    )

    args = parser.parse_args()

    # 스킬 이름 검증
    if not args.skill_name.replace('-', '').replace('_', '').isalnum():
        print("에러: 스킬 이름은 영문자, 숫자, 하이픈, 언더스코어만 사용 가능합니다.")
        sys.exit(1)

    # 출력 경로 확인
    output_path = os.path.abspath(args.path)
    if not os.path.exists(output_path):
        print(f"에러: 경로가 존재하지 않습니다: {output_path}")
        sys.exit(1)

    # 이미 존재하는지 확인
    skill_dir = os.path.join(output_path, args.skill_name)
    if os.path.exists(skill_dir):
        print(f"에러: 스킬 디렉토리가 이미 존재합니다: {skill_dir}")
        sys.exit(1)

    init_skill(args.skill_name, output_path)


if __name__ == "__main__":
    main()
