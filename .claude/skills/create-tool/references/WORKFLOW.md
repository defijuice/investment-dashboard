# 워크플로우 가이드

## Phase 1: 대화로 요구사항 파악

선택지나 양식을 바로 보여주지 말고, 친근한 대화로 시작하세요.

### 질문 방식
- 대화 흐름에 맞춰 하나씩 질문 (한 번에 여러 개 X)
- 사용자 답변에 맞춰 유연하게 진행
- 필요한 정보: 주요 기능, 트리거 조건, 필요한 스크립트/참조

### 예시 대화
```
사용자: PDF를 엑셀로 변환하는 스킬 만들고 싶어요
Claude: PDF를 엑셀로 변환하는 스킬이군요!
        어떤 상황에서 이 스킬이 작동하면 좋을까요?
사용자: "PDF를 엑셀로", "표 추출해줘" 같은 요청이요
Claude: 좋아요. 변환 스크립트도 포함할까요?
```

요구사항이 충분히 파악되면 플랜 모드로 진입합니다.

## Phase 2: 저장 위치 확인

스킬을 생성하기 전에 저장 위치를 확인합니다:
```
스킬을 어디에 저장할까요?
현재 위치: /Users/username/Documents

예시:
- .claude/skills 폴더에 저장해줘
- ~/my-skills 에 저장해줘
```

## Phase 3: 스킬 초기화

init_skill.py를 사용하여 기본 구조 생성:

```bash
python3 scripts/init_skill.py [스킬이름] --path [저장위치]
```

생성되는 구조:
```
skill-name/
├── SKILL.md           # 스킬 정의 (필수)
├── scripts/           # 실행 스크립트
│   └── example.py
├── references/        # 참조 문서
│   └── example.md
└── assets/            # 템플릿, 이미지 등
    └── README.md
```

## Phase 4: SKILL.md 작성

### Frontmatter (필수)

```yaml
---
name: skill-name
version: 1.0.0
repo: username/skill-name
description: |
  스킬 설명. 다음과 같은 요청에 이 스킬을 사용하세요:
  - "트리거 예시 1"
  - "트리거 예시 2"
---
```

**버전 필드 설명:**

- `version`: 시맨틱 버전 (예: 1.0.0, 1.0.1)
- `repo`: GitHub 저장소 경로 (예: daht-mad/md2pdf)

이 필드들은 자동 업데이트 기능을 위해 필요합니다.

### 본문 구성

- 스킬 개요
- 사용 방법
- 스크립트/참조 파일 링크

## Phase 5: 리소스 작성

필요에 따라 작성:

| 디렉토리 | 용도 | 예시 |
| -------- | ---- | ---- |
| scripts/ | 실행 스크립트 | convert.py, process.sh |
| references/ | 참조 문서 | api-docs.md, schema.md |
| assets/ | 출력용 파일 | template.html, logo.png |

## Phase 6: 검증

quick_validate.py로 스킬 검증:

```bash
python3 scripts/quick_validate.py [스킬경로]
```

검증 항목:
- SKILL.md 존재 여부
- frontmatter 필수 필드 (name, description)
- TODO 플레이스홀더 제거 여부
- 참조 파일 존재 여부

## Phase 7: 패키징

package_skill.py로 배포 파일 생성:

```bash
python3 scripts/package_skill.py [스킬경로] [출력경로]
```

생성 파일:

- `[스킬이름].skill` - zip 형태
- `[스킬이름].tar.gz` - tar.gz 형태

### 업데이트 배포 시

스킬을 업데이트하여 재배포할 때는 반드시 SKILL.md의 `version`을 올려야 합니다:

```yaml
version: 1.0.0  →  version: 1.0.1
```

버전을 올리지 않으면 기존 사용자에게 업데이트가 전달되지 않습니다.

## Phase 8: Git 및 GitHub 배포

```bash
git init
git add .
git commit -m "feat: [스킬이름] 스킬 추가"
gh repo create [스킬이름] --public --source=. --remote=origin --push
```

GitHub CLI가 없으면 수동 방법 안내:

1. https://github.com/new 접속
2. 저장소 이름 입력
3. git remote add origin 후 push

### 저장소 생성 후 repo 필드 업데이트

GitHub 저장소 생성 후, `gh repo view --json owner,name`으로 정확한 저장소 경로를 확인하고 SKILL.md의 `repo` 필드를 업데이트합니다:

```bash
# 저장소 정보 확인
gh repo view --json owner,name

# SKILL.md의 repo 필드 업데이트
repo: [owner]/[name]
```

그 후 다시 패키징하고 push합니다:

```bash
# 재패키징
python3 scripts/package_skill.py [스킬경로] [출력경로]

# 변경사항 커밋 및 push
git add .
git commit -m "fix: repo 필드 업데이트"
git push
```

## Phase 9: 완료 요약

```
🎉 스킬 생성 완료!

📦 저장소: https://github.com/[사용자명]/[스킬이름]

📥 팀원 설치 명령어 (한 줄):
curl -L https://github.com/[사용자명]/[스킬이름]/raw/master/[스킬이름].tar.gz | tar -xz -C .claude/skills/

🚀 사용: 스킬 트리거 조건에 맞는 요청을 하면 자동 실행됩니다.
```
