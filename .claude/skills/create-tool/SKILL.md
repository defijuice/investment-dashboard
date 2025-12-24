---
name: create-tool
description: |
  비개발자를 위한 AI 스킬 자동 생성기. 자연어 대화만으로 Claude Code 스킬을 만들고 GitHub에 배포하여 팀원들이 한 줄로 설치할 수 있게 합니다.
  다음과 같은 요청에 이 스킬을 사용하세요:
  - "새 스킬 만들어줘"
  - "도구 만들고 싶어"
  - "자동화 스킬 만들어줘"
  - "팀에서 쓸 스킬 만들어줘"
  - "스킬 생성"
allowed-tools: Bash(git:*), Bash(npm:*), Bash(mkdir:*), Bash(which:*), Bash(gh:*), Bash(python3:*), Bash(ls:*), Bash(tar:*)
---

# create-tool

비개발자도 자연어 대화만으로 스킬을 만들고, GitHub에 배포하여 **팀원들이 한 줄 명령어로 설치**할 수 있게 합니다.

## 핵심 가치

```
1. 대화로 스킬 생성 → 2. GitHub 자동 배포 → 3. 팀원이 한 줄로 설치
```

## 워크플로우 개요

1. **대화** - 스킬 아이디어를 자연어로 설명
2. **생성** - SKILL.md, scripts, references 자동 생성
3. **검증** - quick_validate.py로 검증
4. **패키징** - package_skill.py로 .tar.gz 생성
5. **배포** - GitHub에 자동 푸시
6. **공유** - 한 줄 설치 명령어 제공

자세한 단계별 가이드: [WORKFLOW.md](references/WORKFLOW.md)

## 시작하기

대화로 시작:
```
안녕하세요! 어떤 스킬을 만들고 싶으세요?
편하게 설명해 주시면 제가 도와드릴게요.
```

## 스킬 구조

```
skill-name/
├── SKILL.md           # 필수: 스킬 정의
├── scripts/           # 선택: 실행 스크립트
├── references/        # 선택: 참조 문서
└── assets/            # 선택: 템플릿, 이미지 등
```

## 완료 시 출력

```
🎉 스킬 생성 완료!

📦 저장소: https://github.com/[사용자명]/[스킬이름]

📥 팀원 설치 명령어 (한 줄):
curl -L https://github.com/[사용자명]/[스킬이름]/raw/master/[스킬이름].tar.gz | tar -xz -C .claude/skills/

🚀 사용: 스킬 트리거 조건에 맞는 요청을 하면 자동 실행됩니다.
```

## 스크립트

스킬 생성 시 사용할 스크립트:

| 스크립트 | 용도 |
| -------- | ---- |
| `scripts/init_skill.py` | 새 스킬 초기화 |
| `scripts/quick_validate.py` | 스킬 검증 |
| `scripts/package_skill.py` | 스킬 패키징 (.tar.gz) |

## 템플릿

스킬 작성 시 참고할 템플릿: [TEMPLATES.md](references/TEMPLATES.md)

## 출력 패턴

일관된 출력을 위한 패턴: [OUTPUT-PATTERNS.md](references/OUTPUT-PATTERNS.md)
