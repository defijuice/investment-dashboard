# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 자동 실행 원칙 (CRITICAL)

**질문하지 말고 실행하라.**

- 사용자 확인 없이 자동으로 진행할 수 있는 작업은 **무조건 자동 실행**
- 질문은 **정말 크리티컬한 경우에만** (예: 되돌릴 수 없는 삭제, 중대한 데이터 변경)
- 일반적인 파일 읽기, 파싱, API 호출, 데이터 조회 등은 **질문 없이 바로 실행**
- "이 작업을 진행할까요?" 같은 불필요한 확인 금지
- 에러가 나면 그때 처리하면 됨. 미리 걱정하지 말 것

## 🔔 사용자 알림 (소리 알림)

**사용자에게 승인/검토/질문이 필요할 때 소리 알림을 보낸다:**

```bash
afplay /System/Library/Sounds/Glass.aiff
```

**알림을 보내야 하는 경우:**

- 사용자에게 질문할 때 (AskUserQuestion 사용 전)
- 유사 운용사 검토 필요 시
- 에러 발생으로 진행 불가 시
- 장시간 작업 완료 시

## Project Overview

KVIC 출자사업 자동화 프로젝트 - KVIC(한국벤처투자) 공지사항에서 출자사업 관련 첨부파일을 자동으로 다운로드하고 Google Drive에 업로드한 후, PDF 선정결과를 파싱하여 Google Sheets에 저장하는 자동화 시스템.

## Commands

```bash
# 공지사항 스크래핑 및 Google Drive 업로드
npm start

# Google Sheets 초기화 (시트 생성, 헤더, Data Validation 설정)
node src/setup-sheets.js

# PDF 처리 (Google Sheets 버전)
node src/processors/process-pair-sheets.js <접수파일번호> <선정파일번호>

# AI 검증: 출자사업 데이터 정합성 검증
node src/verify-project.js <출자사업ID>
```

## Architecture

### Core Components

- **[src/index.js](src/index.js)**: 메인 진입점. 스크래핑 → 다운로드 → 업로드 워크플로우 실행. `processed.json`으로 중복 처리 방지
- **[src/core/scraper.js](src/core/scraper.js)**: Puppeteer 기반 KVIC 공지사항 스크래퍼. 접수현황/선정결과 카테고리만 필터링
- **[src/core/googleDrive.js](src/core/googleDrive.js)**: Google Drive OAuth 인증 및 파일 업로드. 토큰은 `credentials/token.json`에 캐시
- **[src/core/googleSheets.js](src/core/googleSheets.js)**: Google Sheets API 클라이언트. OAuth 인증, CRUD, Data Validation 설정
- **[src/setup-sheets.js](src/setup-sheets.js)**: 시트 초기화 (헤더, 드롭다운 설정)
- **[src/processors/process-pair-sheets.js](src/processors/process-pair-sheets.js)**: PDF 파싱 후 Sheets에 저장 (접수현황+선정결과 쌍 처리). 검토/승인 워크플로우 포함
- **[src/workflows/review-workflow.js](src/workflows/review-workflow.js)**: PDF 처리 검토/승인 모듈. 터미널 테이블로 파싱 결과 표시, 수정/승인 인터랙션
- **[src/processors/pdf-parser.py](src/processors/pdf-parser.py)**: pdfplumber 기반 PDF 표 파서. Node.js에서 호출하여 사용
- **[src/workflows/ai-verification.js](src/workflows/ai-verification.js)**: AI 기반 출자사업 데이터 정합성 검증 모듈
- **[src/verify-project.js](src/verify-project.js)**: 출자사업 검증 CLI 진입점

### Data Flow

1. **스크래핑**: KVIC 공지사항 → PDF 다운로드 (`downloads/` 폴더)
2. **업로드**: Google Drive에 파일 업로드
3. **파싱**: PDF에서 선정결과 추출
4. **검토**: 터미널에서 파싱 결과 테이블 확인 → 수정/승인
5. **저장**: 승인 시 Google Sheets에 저장

### PDF 파싱 전략

**이중 파싱 + 비교 방식** - 정확도를 높이기 위해 두 가지 방법으로 파싱 후 비교:

1. **Claude Code 직접 분석**: PDF 파일을 직접 읽고 운용사명, 출자분야, 금액 추출
2. **pdfplumber 파싱**: Python 스크립트로 표 구조 기반 추출

**비교 및 확인 프로세스**:

- 두 결과가 일치하면 자동 진행
- 차이가 있으면 사용자에게 확인 요청 (충돌 항목, 한쪽만 존재하는 항목)

**관련 파일**:

- [src/processors/pdf-compare.js](src/processors/pdf-compare.js): 두 파싱 결과 비교 모듈
- [src/processors/pdf-parser.py](src/processors/pdf-parser.py): pdfplumber 기반 PDF 파서

### 검토/승인 워크플로우

PDF 처리 시 저장 전 검토 단계가 있음:

```text
[6] 데이터 검토 → 테이블 출력 → 명령어 입력 → [7] 저장
```

**검토 화면 구성**:

- 요약: PDF 기재 건수 vs 실제 파싱 건수
- 신규 운용사 목록
- 중복 스킵 항목
- 공동GP 분리 결과
- 전체 신청현황 테이블

**명령어**:

- `y` - 승인 후 저장
- `n` - 취소 (저장 안함)
- `e` - 항목 수정 (운용사명, 출자분야, 상태)
- `r` - 리포트 다시 보기

## Google Sheets 구조

### 스프레드시트 (4시트)

| 시트 | ID 프리픽스 | 컬럼 |
|------|-------------|------|
| 운용사 | OP | ID, 운용사명, 약어, 유형, 국가 |
| 출자사업 | PJ | ID, 사업명, 소관, 공고유형, 연도, 차수, 지원파일ID, 결과파일ID, 현황, 비고, **확인완료** |
| 신청현황 | AP | ID, 출자사업ID, 운용사ID, 출자분야, 최소결성규모, 모태출자액, 결성예정액, 출자요청액, 통화단위, 상태, 비고 |
| 파일 | FH | ID, 파일명, 파일번호, 파일유형, 파일URL, 처리상태, 처리일시, 비고, **현황** |

### 파일처리이력

- `processed.json`에서 로컬 관리

### 파일 시트 현황 필드 형식

파일 처리 완료 시 현황(I열)에 통계 정보 저장:

**접수현황 파일:**

```text
신청조합 N개, 공동GP N개(2개조합 N건, 3개조합 N건), 총 신청현황 N건
```

예: `신청조합 149개, 공동GP 12개(2개조합 10건, 3개조합 2건), 총 신청현황 165건`

**선정결과 파일:**

```text
총 N개 중 선정 N건
```

예: `총 165개 중 선정 43건`

**관련 파일**: [src/workflows/file-summary.js](src/workflows/file-summary.js)

### ⚠️ 파일 현황 동기화 규칙 (CRITICAL)

**파일 현황은 반드시 신청현황 테이블에서 계산해야 한다.**

**절대 금지:**

- 파싱 결과 건수를 직접 현황에 저장하지 말 것
- PDF에 표기된 "N개" 숫자를 그대로 사용하지 말 것

**이유:**

- 중복 스킵, 공동GP 분리 등으로 파싱 결과와 실제 저장 건수가 다를 수 있음
- 예: PDF에 19개 표기 → 1건 중복 스킵 → 실제 18건 저장 시, 현황도 18개여야 함

**올바른 방법:**

```javascript
// 선정결과 파일 처리 완료 후
await sheets.syncFileStatusWithApplications(fileId);
// → 연결된 출자사업의 신청현황에서 총 건수, 선정 건수 계산하여 저장
```

**관련 함수**: `GoogleSheetsClient.syncFileStatusWithApplications()`

## 비즈니스 규칙

### 파일유형 판단 기준

**PDF 내용 우선 원칙**: 파일명과 PDF 내용이 다를 경우, PDF 내용을 기준으로 파일유형을 판단한다.

- PDF 상단에서 "접수현황", "신청현황" → `접수현황`
- PDF 상단에서 "선정결과", "선정 결과", "심사결과" → `선정결과`

### 공동GP 처리

**개별 행 원칙**: 공동GP는 각각 개별 행으로 분리하여 등록

**공동GP 구분자** (발견 시 계속 추가):

- 슬래시: `/` (예: "A / B")
- 쉼표: `,` (예: "A, B")
- 하이픈: `-` (예: "MDI-KB인베스트먼트") ※ 해외VC 공동GP에서 주로 사용

**처리 규칙**:

- 예: "A / B" → A 행 1개, B 행 1개로 각각 등록
- 예: "동국대학교기술지주, 숭실대학교기술지주" → 2건으로 분리
- 공동GP인 경우 비고란에 "공동GP" 표시
- 운용사ID: 각 행에 해당 운용사 ID 하나만 입력

**신청현황 개수 계산**: PDF 상단의 "신청조합 수 N개"는 펀드 단위이고, 공동GP 분리 후 개별 운용사 수가 실제 신청현황 행 수

**⚠️ 공동GP 금액 처리 (CRITICAL)**:

공동GP는 **하나의 펀드**를 여러 운용사가 공동으로 운용하므로, 금액 필드는 **분할하지 않고 동일하게 입력**:

- 결성예정액, 모태출자액, 출자요청액, 최소결성규모 등 모든 금액 필드
- **각 운용사 행에 펀드 전체 금액을 동일하게 입력**
- 예: "A / B" 공동GP, 결성예정액 100억 → A: 100억, B: 100억 (각각 동일)
- **금액을 GP 수로 나누지 않음** (N빵 금지)

```python
# ❌ 잘못된 예 (N빵)
'fund_size': s['fund_size'] / gp_count  # GP 수로 나눔

# ✅ 올바른 예 (동일 금액)
'fund_size': s['fund_size']  # 원본 금액 그대로
```

### ⚠️ 다중 펀드 선정 시 금액 배분 (CRITICAL)

**문제 상황**: PDF에 **전체 선정 금액**만 표시되고, 개별 펀드별 금액이 없는 경우

**예시 PDF**:
```
최종 선정조합 2개, 의무 조합결성액 327억 원

선정 운용사:
- A사 / B사 (공동GP)
- C사 (단독)
```

**잘못된 처리** (실제 발생한 오류 - PJ0102):
```
A사: 327억 ❌ (전체 금액을 각 운용사에 할당)
B사: 327억 ❌
C사: 327억 ❌
```

**올바른 처리**:
```
펀드 수 = 2개 (A/B 공동GP 1개 + C 단독 1개)
개별 펀드 금액 = 327 / 2 = 163.5억

A사: 163.5억 ✅ (펀드1의 공동GP)
B사: 163.5억 ✅ (펀드1의 공동GP - 동일 금액)
C사: 163.5억 ✅ (펀드2)
```

**핵심 원칙**:

1. **펀드 단위 인식**: PDF에 "선정 N개" 또는 "선정조합 N개"는 **펀드 수**를 의미
2. **전체 금액 분배**: 개별 금액 미표시 시 → `개별 금액 = 전체 금액 / 펀드 수`
3. **공동GP 금액**: 같은 펀드 내 공동GP는 **동일 금액** 입력 (분할 아님)
4. **개별 금액 우선**: 펀드별 금액이 명시된 경우 해당 금액 직접 사용

**검증 체크리스트** (선정결과 처리 시):
- [ ] PDF에 "선정 N개"가 N > 1인가?
- [ ] 개별 펀드 금액이 명시되어 있는가?
- [ ] 전체 금액만 있다면 펀드 수로 나눈 값을 사용했는가?
- [ ] 공동GP 행들에 동일 금액이 입력되었는가?

### 신청현황 상태 값

- `접수`: 접수현황 PDF에서 추출 시 기본값
- `선정`: 선정결과 PDF에서 선정된 운용사
- `탈락`: 접수했으나 선정결과에 없는 운용사

### 출자분야 형식

"계정 - 분야" 형식으로 입력
- 예: "중진 - 루키리그", "청년 - 청년창업", "혁신모험 - 창업초기"

### 금액 필드 형식

최소결성규모, 모태출자액, 결성예정액, 출자요청액은 **억원 단위 숫자로 저장**:

- **모든 금액은 원화(억원)로 환산하여 저장**
- **통화단위 필드는 항상 `억원`으로 설정**
- 예: "300억원" → `300`, 통화단위: `억원`
- 예: "USD 50M" → 환산 후 저장 (예: 50 × 13.8 = `690`), 통화단위: `억원`

### ⚠️ 외화 금액 환산 규칙 (CRITICAL)

**해외 출자사업의 외화 금액은 반드시 원화로 환산하여 저장한다.**

**환산 공식**:
```javascript
// M(백만) 단위 외화 → 억원
억원 = M × 환율 / 100

// 예시 (환율: USD 1,380원, JPY 8.6원)
// USD 80M → 80 × 1380 / 100 = 1,104억원
// JPY 3,200M → 3200 × 8.6 / 100 = 275억원
```

**기본 환율** (process-pair-sheets.js):
```javascript
const DEFAULT_EXCHANGE_RATES = {
  'USD': 1380,   // 원/달러
  'JPY': 8.6,    // 원/엔 (1엔당)
  'GBP': 1750,   // 원/파운드
  'EUR': 1500,   // 원/유로
};
```

**환율 조회 기준**: 파일 등록일 (`등록 날짜` 필드) 기준 매매기준율

**자동 환산**: `process-pair-sheets.js`의 `convertSelectedToKRW()` 함수가 AI 파싱 후 자동 환산

### 출자사업 현황 필드

신청현황 통계를 자동 집계하여 표시:

- 형식: `총 171건 (선정 45, 탈락 126)`
- PDF 처리 완료 시 자동 업데이트
- 수동 업데이트: `sheets.updateProjectStatus('PJ0001')` 또는 `sheets.updateAllProjectStatuses()`

### 출자사업 확인완료 필드

운용사 매칭 검증 상태를 추적:

- **기본값**: 비어있음 (미검증)
- **AI확인완료**: `/verify` 스킬 실행 후 자동으로 설정
- **사람확인완료**: 사용자가 수동으로 검증 완료 후 설정

**업데이트 방법**:

```javascript
await sheets.updateProjectVerification('PJ0001', 'AI확인완료');
await sheets.updateProjectVerification('PJ0001', '사람확인완료');
```

**검증 워크플로우**:

1. PDF 처리 완료 → 확인완료: 비어있음
2. `/verify` 실행 → 이상 없음 → 확인완료: `AI확인완료`
3. 사용자 수동 검토 완료 → 확인완료: `사람확인완료`

### 운용사 매칭 규칙

**관련 파일**: [src/matchers/operator-matcher.js](src/matchers/operator-matcher.js)

신규 운용사 등록 전 기존 운용사와 유사도를 검사하여 중복 등록 방지:

**매칭 기준** (우선순위순):

1. **정확히 일치**: 운용사명이 동일 → 기존 운용사 사용
2. **약어 일치**: 등록된 약어와 동일 → 기존 운용사 사용
3. **유사도 85% 이상**: 사용자 확인 요청
4. **유사도 60~85%**: 핵심명 유사도 추가 확인 후 판단

**유사도 검사 항목**:

- 정규화 후 비교 (공백, 특수문자 제거)
- 접미사 제거 후 비교 (인베스트먼트, 벤처스, 파트너스 등)
- 한글 자모 분해 비교 (케이비 vs KB)
- 초성 비교
- 영문 약어 ↔ 한글 발음 매칭 **양방향** (KB ↔ 케이비, BNK ↔ 비엔케이)
- 부분 문자열 포함 관계

> **상세 유사도 필터링 규칙 및 예시**: [.claude/commands/update.md](.claude/commands/update.md) Step 5 참조

**주의사항**:

- 영문 운용사명은 한글 발음 변환 가능성 검토
- "A인베스트먼트" vs "A" 같은 접미사 차이 주의
- 대학교기술지주 등 긴 이름의 부분 매칭 확인
- **헷갈리면 웹검색**: 유사 운용사가 같은 회사인지 다른 회사인지 판단이 어려우면 WebSearch로 직접 검색하여 확인
  - 예: "아이비케이캐피탈 vs IBK벤처투자" → 검색 결과 IBK 계열사지만 별개 법인임을 확인

### 운용사 중복 병합

**관련 파일**: [src/matchers/operator-audit.js](src/matchers/operator-audit.js)

중복 운용사 발견 시 하나로 병합하고 나머지는 삭제:

**병합 명령어**:

```bash
# 중복 리포트 (유사도 85% 이상 운용사 쌍 찾기)
node src/matchers/operator-audit.js report

# 병합 테스트 (dry-run, 실제 변경 없음)
node src/matchers/operator-audit.js merge <유지ID> <삭제ID>

# 병합 실행 (실제 삭제)
node src/matchers/operator-audit.js merge <유지ID> <삭제ID> --execute
```

**병합 시 자동 처리**:

1. 삭제할 운용사ID로 연결된 신청현황 → 유지할 운용사ID로 변경
2. 유지할 운용사의 약어에 삭제된 운용사명 추가 (검색 편의)
3. 삭제할 운용사 행 삭제

**⚠️ 주의사항 - 병합 완료 확인 필수**:

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

### 신청현황 중복 방지

**중복 체크 기준**: 출자사업ID + 운용사ID + 출자분야 조합

- 같은 출자사업에 같은 운용사가 같은 분야로 신청한 경우 → 중복으로 간주, 생성하지 않음
- 같은 운용사가 **다른 분야**에 신청한 경우 → 별도 신청현황으로 등록 (정상)
- PDF 처리 전 기존 신청현황 조회하여 중복 여부 확인 필수

**주의**: 하나의 PDF에 여러 출자사업(계정)이 포함된 경우
- 예: `모태펀드_문화__영화__해양__출자사업` → 문화/영화 사업과 해양 사업이 별도
- 각 출자사업별로 신청현황을 분리하여 처리
- 같은 PDF를 다른 출자사업으로 재처리할 때 기존 데이터 중복 생성 주의

**코드 구현 시 주의사항**:
- `getExistingApplications()` 반환값의 키는 `운용사ID|출자분야` 형식
- 중복 체크 시 반드시 `운용사ID`와 `출자분야`를 조합한 키로 확인
- 잘못된 예: `existingApplications.has(operatorId)` (운용사ID만 체크)
- 올바른 예: `existingApplications.has(\`${operatorId}|${category}\`)` (운용사ID + 출자분야)

### 파일-출자사업 통합 관리 (N:1, 1:N 관계)

하나의 출자사업에 여러 파일이 연결되거나, 하나의 파일에 여러 분야가 포함될 수 있음.

#### 케이스 1: 접수파일 여러 개 + 결과파일 1개

**예시**: 중기부 2024년 1차 정시 (일반분야 + 지역분야)

| 파일유형 | 파일ID | 내용 |
|----------|--------|------|
| 접수현황 | FH0081 | 일반분야 (중진, 청년, 혁신모험 등) |
| 접수현황 | FH0119 | 지역분야 (지역창업초기, 라이콘 등) |
| 선정결과 | FH0001 | 일반분야 + 지역분야 통합 |

**처리 방법**:
1. 출자사업 1개로 관리 (PJ0001)
2. 지원파일ID: `FH0081, FH0119` (쉼표로 구분)
3. 결과파일ID: `FH0001`
4. 접수현황 파일 각각 처리 → 신청현황 생성 (상태: 접수)
5. 선정결과 파일 처리 → 모든 분야의 선정/탈락 업데이트
6. 비고: "일반분야 + 지역분야 통합"

#### 케이스 2: 접수파일 1개 + 결과파일 여러 개

**예시**: 문화/영화/해양 2024년 1차 정시

| 파일유형 | 파일ID | 내용 |
|----------|--------|------|
| 접수현황 | FH0082 | 문화 + 영화 + 해양 통합 |
| 선정결과 | FH0002 | 해양 분야만 |
| 선정결과 | FH0003 | 문화 + 영화 분야만 |

**처리 방법**:
1. 출자사업 1개로 관리 (PJ0003)
2. 지원파일ID: `FH0082`
3. 결과파일ID: `FH0002, FH0003` (쉼표로 구분)
4. 접수현황 파일 처리 → 모든 분야 신청현황 생성
5. 선정결과 파일 각각 처리 → 해당 분야만 선정/탈락 업데이트
6. 비고: "문화/영화 + 해양 통합"

#### 통합 시 주의사항

1. **분야별 선정결과 처리**: 선정결과 파일이 특정 분야만 포함할 경우, 해당 분야 신청현황만 업데이트
2. **현황 계산**: 모든 파일 처리 완료 후 신청현황 테이블에서 재계산
3. **비고 기록**: 통합 사유를 출자사업 비고란에 기록

#### 기존 분리된 출자사업 통합 절차

이미 여러 출자사업으로 분리되어 있는 경우 통합:

```javascript
// 1. 신청현황의 출자사업ID 일괄 변경 (PJ0065 → PJ0001)
for (const app of apps.filter(a => a['출자사업ID'] === 'PJ0065')) {
  await sheets.setValues(`신청현황!B${app._rowIndex}`, [['PJ0001']]);
}

// 2. 통합 대상 출자사업의 파일ID 합치기
await sheets.setValues('출자사업!G2', [['FH0081, FH0119']]);  // 지원파일ID

// 3. 삭제할 출자사업 행 삭제 (큰 행 번호부터)
await sheets.deleteRow('출자사업', oldProjectRowIndex);

// 4. 현황 재계산
await sheets.updateProjectStatus('PJ0001');
```

### 출자사업-파일 연결 검증 (자동 에러 발생)

**파일 연결 시 자동 검증**: `updateProjectFileId()` 함수가 자동으로 중복 연결을 감지하고 에러를 발생시킴

```javascript
// 이 함수는 파일이 다른 출자사업에 이미 연결된 경우 에러를 throw함
await sheets.updateProjectFileId(projectId, '선정결과', fileId);
// Error: 파일 중복 연결 오류: FH0044는 이미 PJ0021(문체부...)에 연결됨.
```

**에러 코드**: `DUPLICATE_FILE_LINK`

**자동 검증 항목**:

1. 해당 파일이 다른 출자사업에 이미 연결되어 있는지 확인
2. 중복 발견 시 처리 중단 (에러 throw)

**수동 확인 필요 항목** (자동 검증 불가):

1. **파일명-사업명 일치 확인**
   - 파일명에 포함된 소관(중기부, 문체부 등), 연도, 차수가 출자사업과 일치하는지 확인
   - 예: `중기부_10월_수시_선정결과.pdf` → PJ(중기부, 10월 수시)에만 연결

2. **잘못된 연결 예시** (실제 발생한 오류)
   - FH0044(문체부 선정결과)가 PJ0021(문체부)과 PJ0024(과기정통부) 모두에 연결됨
   - 원인: 파일-사업 매칭 오류

**검증 체크리스트** (파일 연결 전):

- [ ] 파일의 소관이 출자사업 소관과 일치하는가?
- [ ] 파일의 연도/차수가 출자사업과 일치하는가?

## Google Sheets API 사용법

### 셀 업데이트

특정 셀 업데이트 시 `setValues()` 사용:

```javascript
// 단일 셀 업데이트
await sheets.setValues('파일!F36', [['제외']]);  // 처리상태
await sheets.setValues('파일!H36', [['비고 내용']]);  // 비고

// 여러 셀 한 번에 (같은 행)
await sheets.setValues('파일!F36:H36', [['제외', '', '비고 내용']]);
```

**주의**: `updateRow(sheetName, rowIndex, values)`는 배열 형식만 지원하므로 사용 비권장. `setValues()`로 직접 범위 지정하는 것이 명확함.

## API 할당량 주의

Google Sheets API는 분당 요청 제한이 있음:

- 배치 단위로 나눠서 처리 (20건씩 권장)
- 배치 간 2초 대기
- 에러 발생 시 1분 대기 후 재시도

### 배치 처리 메서드

대량 데이터 처리 시 개별 API 호출 대신 **배치 메서드** 사용 권장:

```javascript
// 신청현황 일괄 생성 (단일 API 호출)
const newIds = await sheets.createApplicationsBatch([
  { 출자사업ID: 'PJ0001', 운용사ID: 'OP0001', 출자분야: '중진 - 루키리그', 상태: '접수' },
  { 출자사업ID: 'PJ0001', 운용사ID: 'OP0002', 출자분야: '중진 - 스케일업', 상태: '접수' },
  // ... 수백 건도 한 번에 처리
]);

// 운용사 일괄 생성 (단일 API 호출)
const nameToIdMap = await sheets.createOperatorsBatch([
  '신규운용사A',
  '신규운용사B',
  // ...
]);
// 반환값: Map { '신규운용사A' => 'OP0100', '신규운용사B' => 'OP0101', ... }
```

**성능 비교:**

- 개별 처리: 200건 × 2초 = 400초 (API 할당량 초과 가능)
- 배치 처리: 200건 → 1회 API 호출 ≈ 5초

### API 할당량 초과 시 수동 처리 주의사항

**중복 레코드 생성 방지**: API 할당량 초과로 작업이 중단된 후 재시도할 때:

1. **기존 생성된 레코드 확인 필수**
   - 출자사업(PJ), 운용사(OP), 신청현황(AP) 등 이미 생성된 레코드가 있는지 먼저 확인
   - 중단 시점에 어떤 레코드까지 생성되었는지 파악

2. **같은 사업명으로 중복 출자사업 생성 금지**
   - 재시도 시 `getOrCreateProject()`가 새 ID를 발급할 수 있음
   - 반드시 기존 출자사업 ID를 조회해서 사용

3. **중복 발생 시 정리 방법**
   - 빈 레코드(신청현황 0건)를 삭제하거나 클리어
   - 신청현황의 출자사업ID를 올바른 ID로 일괄 변경
   - 출자사업 현황 필드 재집계

**예방책**: 수동 처리 시 항상 기존 데이터 조회 먼저 수행

```javascript
// 재시도 전 기존 출자사업 확인
const existing = await sheets.findRow('출자사업', '사업명', projectName);
if (existing) {
  projectId = existing['ID'];  // 기존 ID 사용
}
```

## AI 검증 (Data Verification)

**목적**: PDF 처리 완료 후, PDF 원본과 DB 최종 상태 간의 정합성을 AI로 자동 검증

### 검증 항목

1. **접수현황 파일 검증**
   - PDF 원본 데이터 vs DB 신청현황 데이터 일치 확인
   - 공동GP 분리, 중복 스킵 등 처리 과정 정합성 검증
   - 운용사명 변형 시 약어 필드 업데이트 확인

2. **선정결과 파일 검증**
   - PDF 선정 명단 vs DB 선정 상태 일치 확인
   - 탈락 처리 정확성 검증
   - 누락 또는 잘못된 선정 상태 감지

3. **운용사 약어 교차 검증** (핵심)
   - 접수파일과 선정파일에서 같은 운용사의 다른 표기법 감지
   - 예: 접수파일 "아이비케이캐피탈" ↔ 선정파일 "IBK캐피탈"
   - 약어 필드에 모든 표기법이 포함되었는지 확인

### 사용법

```bash
# 특정 출자사업 검증
node src/verify-project.js PJ0001

# 리포트 예시
┌────────────────────────────────────────────────┐
│  출자사업 검증 리포트: PJ0001                   │
│  중기부 소관 2024년 1차 정시                    │
└────────────────────────────────────────────────┘

📄 접수현황 파일: FH0081
  ✅ PDF 171건 → DB 171건 일치
  ✅ 공동GP 12건 분리 정상
  ⚠️  운용사 약어 누락 2건

📄 선정결과 파일: FH0001
  ✅ PDF 45건 → DB 선정 45건 일치
  ✅ 탈락 126건 정상

─────────────────────────────────────────────────
종합 결과:
  ✅ 정상: 5개 항목
  ⚠️  경고: 2개 항목 (자동 수정 가능)
  ❌ 오류: 0개 항목 (수동 수정 필요)
```

### 핵심 파일

- [src/workflows/ai-verification.js](src/workflows/ai-verification.js): `ProjectVerifier` 클래스 - AI 기반 검증 로직
- [src/verify-project.js](src/verify-project.js): CLI 진입점
- [src/core/googleSheets.js](src/core/googleSheets.js): 역조회 메서드 (`getApplicationsByFile`, `getFilesByProject`)

### 검증 워크플로우

```text
1. 출자사업 메타데이터 로드
2. 연결된 파일 목록 조회 (접수파일, 선정파일)
3. 각 파일에 대해:
   a. PDF 다운로드 및 파싱 (AI)
   b. DB 데이터 조회
   c. AI 교차 검증 (Claude Sonnet 4.5)
   d. 불일치 항목 수집
4. 운용사 약어 교차 검증 (접수 ↔ 선정)
5. 검증 리포트 생성 및 출력
```

### 자동 확인완료 필드 업데이트

검증 완료 후 출자사업의 '확인완료' 필드를 자동으로 업데이트합니다:

| 검증 결과 | 확인완료 값 | 설명 |
|----------|------------|------|
| 모든 검증 통과 | `AI확인완료` | 불일치 항목 없음, 자동 승인 |
| 불일치 발견 + 사용자 승인 | `수동확인완료` | 불일치 있지만 사용자가 승인 |
| 불일치 발견 + 사용자 거부 | `검증실패` | 수동 수정 필요 |

### 사용자 승인 워크플로우

불일치 항목이 발견되면 다음과 같이 표시됩니다:

```
┌─ 불일치 항목 상세 ─────────────────────────────┐

📄 [FH0081] PDF에는 있지만 DB에 없는 항목 (2건):

  ❌ A인베스트먼트
     분야: 중진 - 루키리그

  ❌ B벤처캐피탈
     분야: 청년 - 청년창업

🔤 운용사 약어 누락 (3건):

  ⚠️  OP0034 (IBK벤처투자)
     현재 약어: "IBK캐피탈"
     추가 필요: "아이비케이캐피탈"
     이유: 접수파일 표기가 약어에 없음

└────────────────────────────────────────────────┘

위 불일치 항목에도 불구하고 확인완료로 승인하시겠습니까? (y/n):
```

### 주의사항

- **PDF 다운로드**: 현재는 `downloads/` 폴더의 로컬 파일 사용 (Google Drive API 구현 필요)
- **AI 호출 비용**: 파일당 2-3회 AI 호출 발생 (대략 $0.05~0.10)
- **검증 시점**: PDF 처리 완료 후, 사후 검증용으로 사용
- **불일치 항목**: 경고(약어 누락)는 승인 가능, 오류(누락/불일치)는 수정 권장

## Custom Commands

### `/update {파일번호}`

PDF 파일을 이중 파싱하여 Google Sheets에 선정결과 업데이트.

> **상세 절차 및 프로세스**: [.claude/commands/update.md](.claude/commands/update.md) (메인 레퍼런스)

### `/verify {출자사업ID}`

출자사업 데이터 정합성 AI 검증 실행.

### `/commit`

Git 커밋 및 푸시 (Conventional Commits 형식, 한글)

### `/log`

LOG.md에 작업 이력 기록 (시행착오 흐름 포함)

## Environment Variables

```bash
GOOGLE_DRIVE_FOLDER_ID   # 업로드 대상 폴더
GOOGLE_SPREADSHEET_ID    # Google Sheets 스프레드시트 ID
MAX_PAGES                # 스캔할 최대 페이지 수 (기본: 5)
ANTHROPIC_API_KEY        # Claude AI API 키 (PDF 파싱 폴백용)
```

## OAuth Setup

Google Drive API 사용 시:
1. Google Cloud Console에서 OAuth 클라이언트 ID 생성 (Desktop app)
2. JSON을 `credentials/oauth-credentials.json`으로 저장
3. 첫 실행 시 브라우저에서 인증 → 토큰 자동 저장

## Dependencies

### Python (PDF 파싱용)

```bash
pip3 install pdfplumber  # PDF 표 추출 라이브러리
```

### System

- `pdftotext` (poppler-utils): PDF 텍스트 추출
