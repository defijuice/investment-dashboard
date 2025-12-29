# 운용사 매칭 및 중복 관리

운용사 중복 등록을 방지하고 기존 운용사를 올바르게 매칭하기 위한 규칙입니다.

**관련 파일**: [src/operator-matcher.js](../src/operator-matcher.js)

## 운용사 매칭 규칙

신규 운용사 등록 전 기존 운용사와 유사도를 검사하여 중복 등록 방지:

### 매칭 기준 (우선순위순)

1. **정확히 일치**: 운용사명이 동일 → 기존 운용사 사용
2. **약어 일치**: 등록된 약어와 동일 → 기존 운용사 사용
3. **유사도 85% 이상**: 사용자 확인 요청
4. **유사도 60~85%**: 핵심명 유사도 추가 확인 후 판단

### 유사도 검사 항목

- 정규화 후 비교 (공백, 특수문자 제거)
- 접미사 제거 후 비교 (인베스트먼트, 벤처스, 파트너스 등)
- 한글 자모 분해 비교 (케이비 vs KB)
- 초성 비교
- 영문 약어 ↔ 한글 발음 매칭 **양방향** (KB ↔ 케이비, BNK ↔ 비엔케이)
- 부분 문자열 포함 관계

> **상세 유사도 필터링 규칙 및 예시**: [.claude/commands/update.md](../.claude/commands/update.md) Step 5 참조

### 주의사항

- 영문 운용사명은 한글 발음 변환 가능성 검토
- "A인베스트먼트" vs "A" 같은 접미사 차이 주의
- 대학교기술지주 등 긴 이름의 부분 매칭 확인
- **헷갈리면 웹검색**: 유사 운용사가 같은 회사인지 다른 회사인지 판단이 어려우면 WebSearch로 직접 검색하여 확인
  - 예: "아이비케이캐피탈 vs IBK벤처투자" → 검색 결과 IBK 계열사지만 별개 법인임을 확인

## 운용사 중복 병합

**관련 파일**: [src/operator-audit.js](../src/operator-audit.js)

중복 운용사 발견 시 하나로 병합하고 나머지는 삭제:

### 병합 명령어

```bash
# 중복 리포트 (유사도 85% 이상 운용사 쌍 찾기)
node src/operator-audit.js report

# 병합 테스트 (dry-run, 실제 변경 없음)
node src/operator-audit.js merge <유지ID> <삭제ID>

# 병합 실행 (실제 삭제)
node src/operator-audit.js merge <유지ID> <삭제ID> --execute
```

### 병합 시 자동 처리

1. 삭제할 운용사ID로 연결된 신청현황 → 유지할 운용사ID로 변경
2. 유지할 운용사의 약어에 삭제된 운용사명 추가 (검색 편의)
3. 삭제할 운용사 행 삭제

### ⚠️ 주의사항 - 병합 완료 확인 필수

- 병합 실행 후 **반드시 삭제 여부 확인**
- API 할당량 초과 등으로 중간에 중단되면 약어만 업데이트되고 행이 삭제되지 않을 수 있음
- 약어에 "→OPxxxx로 병합" 표시가 있는데 행이 남아있으면 수동 삭제 필요

```javascript
// 병합 후 확인
const operators = await sheets.getAllOperators();
const stillExists = operators.find(op => op['ID'] === '삭제ID');
if (stillExists) {
  console.log('삭제 실패! 수동 삭제 필요:', stillExists);
  await sheets.deleteRow('운용사', stillExists._rowIndex);
}
```
