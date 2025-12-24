# 스킬 템플릿

## SKILL.md 템플릿

```markdown
---
name: skill-name
version: 1.0.0
repo: username/skill-name
description: |
  스킬 설명. 다음과 같은 요청에 이 스킬을 사용하세요:
  - "트리거 예시 1"
  - "트리거 예시 2"
  - "트리거 예시 3"
allowed-tools: Bash(python3:*), Bash(git:*)
---

# skill-name

스킬에 대한 간단한 설명.

## 사용법

기본 사용 방법 설명.

## 주요 기능

- 기능 1
- 기능 2

## 스크립트

실행 스크립트: [process.py](scripts/process.py)

## 참조

상세 가이드: [GUIDE.md](references/GUIDE.md)
```

## 스크립트 템플릿

### Python 스크립트

```python
#!/usr/bin/env python3
"""
스크립트 설명
"""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description='스크립트 설명')
    parser.add_argument('input', help='입력 파일')
    parser.add_argument('-o', '--output', help='출력 파일')

    args = parser.parse_args()

    print(f"처리 중: {args.input}")

    # 메인 로직

    print("✓ 완료!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Bash 스크립트

```bash
#!/bin/bash
# 스크립트 설명

set -e

INPUT="$1"

if [ -z "$INPUT" ]; then
    echo "사용법: script.sh <입력>"
    exit 1
fi

echo "처리 중: $INPUT"

# 메인 로직

echo "✓ 완료!"
```

## 참조 문서 템플릿

```markdown
# 참조 문서 제목

## 개요

이 문서의 목적 설명.

## 상세 내용

### 섹션 1

상세 내용...

### 섹션 2

상세 내용...

## 예시

구체적인 예시...
```

## 일반적인 스킬 패턴

### 패턴 1: 파일 변환기

- 트리거: "PDF를 엑셀로", "마크다운을 PDF로"
- 구조: SKILL.md + scripts/convert.py

### 패턴 2: 문서 생성기

- 트리거: "리포트 만들어줘", "문서 생성"
- 구조: SKILL.md + assets/template.md

### 패턴 3: 데이터 처리기

- 트리거: "데이터 분석해줘", "통계 내줘"
- 구조: SKILL.md + scripts/process.py + references/schema.md

### 패턴 4: 워크플로우 가이드

- 트리거: "배포해줘", "PR 만들어줘"
- 구조: SKILL.md + references/workflow.md

## 의존성 추천

| 용도 | 추천 패키지 |
| ---- | ----------- |
| PDF | pypdf, pdf2image |
| Excel | openpyxl, pandas |
| 이미지 | Pillow |
| HTTP | requests |
| CLI | argparse, click |
