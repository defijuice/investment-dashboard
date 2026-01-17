# 커맨드 효율화 계획: 서브에이전트 병렬 처리

> **목표**: PDF 중복 읽기 제거 + 접수/선정 병렬 처리 + 모든 예외 규칙 반영

## 새로운 아키텍처

```
/parse {접수파일} {선정파일}
        │
        ├─────────────────────────────────────┐
        ▼                                     ▼
  [접수현황 Agent]                     [선정결과 Agent]
        │                                     │
        ├─ PDF 이중 파싱 (AI+pdfplumber)      ├─ PDF 이중 파싱
        ├─ 운용사명, 분야 추출                ├─ 운용사명, 분야, 금액 추출
        ├─ 공동GP 분리                        ├─ 환율 변환 (USD)
        ├─ 법인 표기 정규화                   ├─ N빵 계산 (공동GP)
        └─ 유사 운용사 분석                   └─ 유사 운용사 분석
        │                                     │
        ▼                                     ▼
   캐시 JSON                             캐시 JSON
        │                                     │
        └────────────┬────────────────────────┘
                     ▼
              [병합 & 검증]
                     │
                     ▼
                /save 실행
```

---

## 커맨드 구조

| 커맨드 | 역할 | PDF 읽기 |
|--------|------|----------|
| `/parse-receipt {파일번호}` | 접수현황 PDF 파싱 (서브에이전트) | 1회 |
| `/parse-selection {파일번호}` | 선정결과 PDF 파싱 (서브에이전트) | 1회 |
| `/parse {파일번호들}` | 오케스트레이터 (병렬 호출) | - |
| `/save {파일번호들}` | 캐시 → Sheets 저장 | 0회 |
| `/update {파일번호들}` | parse + save 자동 연결 | - |

---

## 서브에이전트 상세

### 1. 접수현황 Agent (`/parse-receipt`)

**파일**: `.claude/commands/parse-receipt.md`

```
입력: 파일번호
출력: result/{파일번호}_receipt.json

처리 단계:
1. 파일 정보 조회 (파일유형 확인)
2. PDF 이중 파싱 (병렬)
   ├─ Claude AI 파싱
   └─ pdfplumber 파싱
3. 결과 비교 → AI 우선 (pdfplumber 노이즈 무시)
4. 파일유형 검증 (PDF 내용 우선 원칙)
   └─ 파일명과 다르면 파일유형 수정
5. 공동GP 분리 (/, 쉼표, 줄바꿈)
6. 법인 표기 정규화 ((주), 주식회사 제거)
7. 운용사 유사도 분석
   ├─ 9단계 유사도 알고리즘
   ├─ 영문↔한글 양방향 매칭
   └─ 핵심명 유사도 이중 체크
8. 캐시 저장
```

**반영 규칙**: #4, #7, #10, #11, #12, #1, #2, #3

### 2. 선정결과 Agent (`/parse-selection`)

**파일**: `.claude/commands/parse-selection.md`

```
입력: 파일번호
출력: result/{파일번호}_selection.json

처리 단계:
1. 파일 정보 조회
2. PDF 이중 파싱 (병렬)
3. 결과 비교 → AI 우선
4. 파일유형 검증 (PDF 내용 우선)
5. 금액 추출
   ├─ 최소결성규모, 모태출자액, 결성예정액, 출자요청액
   └─ 억원/M 단위 숫자로 저장
6. USD 감지 시 환율 처리
   ├─ 파일 등록날짜 조회 (J열)
   ├─ WebSearch로 환율 조회
   └─ 원화 환산값 계산
7. 공동GP 분리 + N빵 계산
   └─ 금액 필드를 GP 수로 나눔
8. 법인 표기 정규화
9. 운용사 유사도 분석
10. 캐시 저장
```

**반영 규칙**: #10, #11, #12, #13, #5(환율), #7(N빵), #1, #2, #3, #4

---

## `/save` 커맨드 상세

**파일**: `.claude/commands/save.md`

```
입력: 파일번호(들)
처리:

1. 캐시 로드
   └─ 없으면 에러 ("먼저 /parse 실행 필요")

2. 유사 운용사 확인 (필요시만 질문)
   └─ similarity >= 0.85 AND coreScore >= 0.60
   └─ 헷갈리면 WebSearch로 확인 (#5)

3. 출자사업 확인/생성
   ├─ 파일-출자사업 N:N 관계 처리 (#8)
   │   └─ 여러 파일 → 쉼표로 연결
   └─ 중복 연결 검증
       └─ 다른 출자사업에 이미 연결 시 에러

4. 운용사 생성 (배치)
   └─ 중복 운용사 발견 시 병합 안내 (#6)

5. 신청현황 생성/업데이트 (배치)
   ├─ 복합키 중복 체크 (#9)
   │   └─ 출자사업ID + 운용사ID + 출자분야
   ├─ 접수현황: 상태 = "접수"
   └─ 선정결과: 상태 = "선정", 금액 필드 포함

6. 선정/탈락 판정 (#14)
   ├─ 약어 확장 + 정규화 기반 매칭
   └─ 접수현황 없는 선정자 → 신규 생성 (#15)
       └─ 비고: "접수현황 PDF에 미기재, 선정결과에서 확인됨"

7. 현황 업데이트 (#16)
   ├─ 파일 현황: syncFileStatusWithApplications()
   └─ 출자사업 현황: updateProjectStatus()

8. 캐시 삭제 또는 완료 표시
```

**반영 규칙**: #5, #6, #8, #9, #14, #15, #16

---

## 캐시 파일 구조

### 접수현황 캐시 (`result/{fileNo}_receipt.json`)

```json
{
  "version": 1,
  "fileNo": "4524",
  "fileType": "접수현황",
  "fileTypeSource": "pdf_content",
  "parsedAt": "2026-01-15T10:30:00Z",

  "projectInfo": {
    "name": "중기부 2025년 1차 정시",
    "소관": "중기부",
    "연도": "2025",
    "차수": "1차"
  },

  "sources": {
    "ai": { "success": true, "count": 171 },
    "pdfplumber": { "success": true, "count": 168 }
  },

  "stats": {
    "originalCount": 149,
    "jointGPCount": 12,
    "jointGPBreakdown": {
      "2개조합": 10,
      "3개조합": 2
    },
    "totalEntries": 165
  },

  "entries": [
    {
      "name": "KB인베스트먼트",
      "originalName": "(주)KB인베스트먼트",
      "category": "중진 - 루키리그",
      "isJointGP": false,
      "jointGPGroup": null,
      "source": "ai"
    },
    {
      "name": "A벤처스",
      "originalName": "A벤처스 / B파트너스",
      "category": "청년 - 청년창업",
      "isJointGP": true,
      "jointGPGroup": "JG001",
      "source": "ai"
    }
  ],

  "operatorAnalysis": {
    "exact": [
      { "name": "KB인베스트먼트", "id": "OP0001" }
    ],
    "similar": [
      {
        "parsed": "케이비인베스트",
        "existing": "KB인베스트먼트",
        "existingId": "OP0001",
        "score": 0.87,
        "coreScore": 0.72,
        "reasons": ["영문-한글 발음 양방향 일치", "KB ↔ 케이비"],
        "decision": null
      }
    ],
    "new": ["신규운용사A", "신규운용사B"]
  }
}
```

### 선정결과 캐시 (`result/{fileNo}_selection.json`)

```json
{
  "version": 1,
  "fileNo": "4525",
  "fileType": "선정결과",
  "fileTypeSource": "pdf_content",
  "parsedAt": "2026-01-15T10:32:00Z",

  "projectInfo": {
    "name": "중기부 2025년 1차 정시",
    "소관": "중기부",
    "연도": "2025",
    "차수": "1차"
  },

  "sources": {
    "ai": { "success": true, "count": 45 },
    "pdfplumber": { "success": true, "count": 44 }
  },

  "stats": {
    "totalSelected": 45,
    "hasUSD": true,
    "exchangeRate": 1320.5,
    "rateDate": "2025-01-10"
  },

  "entries": [
    {
      "name": "KB인베스트먼트",
      "originalName": "KB인베스트먼트",
      "category": "중진 - 루키리그",
      "minFormation": 300,
      "moTae": 150,
      "fundSize": 500,
      "requestAmount": 200,
      "currency": "억원",
      "isJointGP": false,
      "source": "ai"
    },
    {
      "name": "글로벌VC",
      "originalName": "글로벌VC",
      "category": "글로벌 - 해외VC",
      "minFormation": null,
      "moTae": 25,
      "fundSize": 50,
      "requestAmount": null,
      "currency": "USD(M)",
      "exchangeRate": 1320.5,
      "moTaeKRW": 330,
      "fundSizeKRW": 660,
      "isJointGP": false,
      "source": "ai"
    },
    {
      "name": "A벤처스",
      "originalName": "A벤처스 / B파트너스",
      "category": "청년 - 청년창업",
      "minFormation": 200,
      "moTae": 50,
      "fundSize": 200,
      "requestAmount": null,
      "currency": "억원",
      "isJointGP": true,
      "jointGPGroup": "JG001",
      "jointGPCount": 2,
      "originalMoTae": 100,
      "originalFundSize": 400,
      "source": "ai"
    }
  ],

  "operatorAnalysis": {
    "exact": [],
    "similar": [],
    "new": []
  }
}
```

---

## 예외 규칙 체크리스트

### 운용사 매칭 (Agent 공통)

- [x] #1 9단계 유사도 알고리즘
- [x] #2 접미사 오탐 방지 (핵심명 유사도 이중 체크)
- [x] #3 영문↔한글 양방향 매칭 (KB↔케이비, BNK↔비엔케이)
- [x] #4 법인 표기 제거 ((주), 주식회사)
- [x] #5 헷갈리면 WebSearch 확인

### 데이터 처리

- [x] #6 중복 운용사 병합 (save에서 안내)
- [x] #7 공동GP 분리 (/, 쉼표, 줄바꿈 우선순위)
- [x] #8 파일-출자사업 N:N (쉼표 연결 + 중복 검증)
- [x] #9 신청현황 복합키 중복 체크

### PDF 파싱

- [x] #10 이중 파싱 + 비교
- [x] #11 pdfplumber 노이즈 → AI 우선
- [x] #12 파일명-내용 불일치 → PDF 내용 우선
- [x] #13 금액 억원/M 단위 저장

### 상태 판정

- [x] #14 선정/탈락 약어 확장 매칭
- [x] #15 접수 누락 선정자 → 신규 생성
- [x] #16 현황 테이블 기반 재계산

### 특수 케이스

- [x] #17 HWP 파일 → Playwright + OCR (별도 처리)
- [x] #18 단계별 처리 (접수→선정 순서)

### 시스템

- [x] #20 API 배치 처리
- [x] #21 자동화 모드 (필요시만 질문)

---

## 서브에이전트 구현 (`.claude/agents/`)

### 폴더 구조

```
.claude/
├── agents/                          # 서브에이전트 정의
│   ├── receipt-parser.md            # 접수현황 파싱 에이전트
│   └── selection-parser.md          # 선정결과 파싱 에이전트
├── commands/                        # 사용자 호출 커맨드
│   ├── parse.md                     # 오케스트레이터 (agents 호출)
│   ├── save.md                      # 저장 커맨드
│   └── update.md                    # 통합 커맨드
└── settings.local.json
```

### 서브에이전트 1: 접수현황 파서

**파일**: `.claude/agents/receipt-parser.md`

```markdown
# 접수현황 PDF 파싱 에이전트

## 역할
접수현황 PDF를 파싱하여 운용사명, 출자분야를 추출하고 JSON 캐시로 저장

## 입력
- 파일번호: $ARGUMENTS

## 출력
- `result/{파일번호}_receipt.json`

## 처리 단계

### 1. 파일 정보 조회
```javascript
// 파일 시트에서 조회
const fileInfo = await sheets.findRow('파일', '파일번호', fileNo);
const { 파일명, 파일유형, 파일URL } = fileInfo;
```

### 2. PDF 다운로드 확인
```bash
# downloads 폴더에 파일 존재 확인
ls downloads/ | grep {파일번호}
```

### 3. PDF 이중 파싱 (병렬)

**3-1. Claude AI 직접 분석**
```text
Read 도구로 PDF 읽기:
- 운용사명 목록 추출
- 출자분야 추출
- 공동GP 표기 확인 (/, 쉼표, 줄바꿈)
- PDF 상단 "신청조합 수 N개" 확인
```

**3-2. pdfplumber 파싱**
```bash
python3 src/processors/pdf-parser.py "downloads/{파일명}.pdf"
```

### 4. 결과 비교 및 병합
```text
- 양쪽 일치: 자동 채택
- 충돌 시: Claude AI 결과 우선
- pdfplumber에만 있는 항목: 무시 (노이즈)
- Claude에만 있는 항목: 포함
```

### 5. 파일유형 검증 (PDF 내용 우선)
```text
PDF 상단에서:
- "접수현황", "신청현황" → 파일유형: 접수현황
- "선정결과", "심사결과" → 파일유형: 선정결과

파일명과 다르면 fileTypeSource: "pdf_content"로 기록
```

### 6. 공동GP 분리
```javascript
// 분리 우선순위: 줄바꿈 > 쉼표 > 슬래시
function splitJointGP(name) {
  if (name.includes('\n')) return name.split('\n');
  if (name.includes(',')) return name.split(',');
  if (name.includes('/')) return name.split('/');
  return [name];
}
```

### 7. 법인 표기 정규화
```javascript
function normalize(name) {
  return name
    .replace(/^\(주\)/, '')
    .replace(/^주식회사\s*/, '')
    .replace(/\(주\)$/, '')
    .replace(/\s+/g, '')
    .trim();
}
```

### 8. 운용사 유사도 분석
```javascript
// src/matchers/operator-matcher.js 사용
const analysis = await analyzeOperators(entries, existingOperators);
// 결과: { exact, similar, new }
```

### 9. 캐시 저장
```javascript
const cache = {
  version: 1,
  fileNo,
  fileType: "접수현황",
  fileTypeSource,
  parsedAt: new Date().toISOString(),
  projectInfo,
  sources,
  stats,
  entries,
  operatorAnalysis
};

fs.writeFileSync(`result/${fileNo}_receipt.json`, JSON.stringify(cache, null, 2));
```

## 주의사항
- 저장하지 않음 (분석만)
- 유사 운용사 질문하지 않음
- 캐시 JSON만 생성
```

---

### 서브에이전트 2: 선정결과 파서

**파일**: `.claude/agents/selection-parser.md`

```markdown
# 선정결과 PDF 파싱 에이전트

## 역할
선정결과 PDF를 파싱하여 운용사명, 출자분야, 금액을 추출하고 JSON 캐시로 저장

## 입력
- 파일번호: $ARGUMENTS

## 출력
- `result/{파일번호}_selection.json`

## 처리 단계

### 1-4. (접수현황과 동일)
파일 정보 조회, PDF 다운로드 확인, 이중 파싱, 결과 비교

### 5. 금액 추출
```text
Claude AI 분석 시 추출할 필드:
- 최소결성규모 (minFormation)
- 모태출자액 (moTae)
- 결성예정액 (fundSize)
- 출자요청액 (requestAmount)
- 통화 단위 (억원 / USD(M))
```

### 6. USD 감지 시 환율 처리
```javascript
// 1. USD 감지
const hasUSD = entries.some(e => e.currency === 'USD(M)');

if (hasUSD) {
  // 2. 파일 등록날짜 조회
  const fileInfo = await sheets.findRow('파일', '파일번호', fileNo);
  const rateDate = fileInfo['등록날짜'] || new Date().toISOString().split('T')[0];

  // 3. WebSearch로 환율 조회
  const searchQuery = `${rateDate} 원달러 환율`;
  const exchangeRate = await WebSearch(searchQuery);

  // 4. 원화 환산
  entries.forEach(e => {
    if (e.currency === 'USD(M)') {
      e.exchangeRate = exchangeRate;
      e.moTaeKRW = e.moTae * exchangeRate / 100;
      e.fundSizeKRW = e.fundSize * exchangeRate / 100;
    }
  });
}
```

### 7. 공동GP N빵 계산
```javascript
// 공동GP인 경우 금액을 GP 수로 나눔
function applyNBbang(entries) {
  const groups = groupBy(entries, 'jointGPGroup');

  for (const [groupId, members] of Object.entries(groups)) {
    if (!groupId) continue;

    const count = members.length;
    const originalMoTae = members[0].moTae;
    const originalFundSize = members[0].fundSize;

    members.forEach(m => {
      m.jointGPCount = count;
      m.originalMoTae = originalMoTae;
      m.originalFundSize = originalFundSize;
      m.moTae = originalMoTae / count;
      m.fundSize = originalFundSize / count;
    });
  }
}
```

### 8-9. (접수현황과 동일)
법인 표기 정규화, 운용사 유사도 분석

### 10. 캐시 저장
```javascript
const cache = {
  version: 1,
  fileNo,
  fileType: "선정결과",
  fileTypeSource,
  parsedAt: new Date().toISOString(),
  projectInfo,
  sources,
  stats: {
    totalSelected: entries.length,
    hasUSD,
    exchangeRate,
    rateDate
  },
  entries,
  operatorAnalysis
};

fs.writeFileSync(`result/${fileNo}_selection.json`, JSON.stringify(cache, null, 2));
```

## 주의사항
- 저장하지 않음 (분석만)
- 금액은 숫자로만 저장 (문자열 X)
- N빵 적용 시 원본 금액 보존
```

---

### 오케스트레이터 커맨드

**파일**: `.claude/commands/parse.md`

```markdown
# PDF 파싱 (병렬 서브에이전트)

입력받은 파일번호들을 분석하여 캐시 JSON을 생성합니다.

## 입력
- 파일번호: $ARGUMENTS (공백으로 구분된 여러 개 가능)

## 처리 흐름

### 1. 파일번호 파싱
```javascript
const fileNos = '$ARGUMENTS'.split(/\s+/).filter(Boolean);
```

### 2. 파일유형 판별
```javascript
const files = [];
for (const fileNo of fileNos) {
  const info = await sheets.findRow('파일', '파일번호', fileNo);
  files.push({ fileNo, type: info['파일유형'] });
}
```

### 3. 서브에이전트 병렬 실행
```text
Task tool을 병렬로 호출:

파일유형이 "접수현황"인 경우:
  - subagent: receipt-parser
  - prompt: 파일번호

파일유형이 "선정결과"인 경우:
  - subagent: selection-parser
  - prompt: 파일번호
```

### 4. 결과 수집 및 요약
```text
각 서브에이전트 완료 후:
- 캐시 파일 생성 확인
- 파싱 건수 요약
- 유사 운용사 목록 (질문 필요 여부)
```

## 실행 예시

```bash
# 단일 파일
/parse 4524

# 접수+선정 쌍 (병렬)
/parse 4524 4525

# 여러 파일 (병렬)
/parse 4524 4525 4526 4527
```

## 출력

```text
📄 파싱 완료

[FH4524] 접수현황
  - 파싱 건수: 171건
  - 공동GP: 12개 (분리 후 165건)
  - 신규 운용사: 5개
  - 유사 확인 필요: 2개

[FH4525] 선정결과
  - 파싱 건수: 45건
  - USD 환율: 1,320.5원 (2025-01-10)
  - N빵 적용: 3건

캐시 저장:
  - result/4524_receipt.json ✓
  - result/4525_selection.json ✓
```
```

---

## 수정 대상 파일

| 파일 | 작업 | 설명 |
|------|------|------|
| `.claude/agents/receipt-parser.md` | **신규** | 접수현황 서브에이전트 |
| `.claude/agents/selection-parser.md` | **신규** | 선정결과 서브에이전트 |
| `.claude/commands/parse.md` | **신규** | 오케스트레이터 |
| `.claude/commands/save.md` | **신규** | 저장 커맨드 |
| `.claude/commands/update.md` | 수정 | parse+save 호출로 간소화 |
| `.claude/commands/amount-update.md` | 삭제 | 불필요 |
| `src/processors/pdf-parser.py` | 수정 | 금액 컬럼 추출 강화 |
| `result/` | **신규** | 캐시 디렉토리 |
| `.gitignore` | 수정 | `result/` 추가 |

---

## 실행 예시

### 병렬 파싱

```bash
# 접수+선정 쌍 병렬 처리
/parse 4524 4525

# 내부적으로 병렬 실행:
# - Task(parse-receipt, 4524)
# - Task(parse-selection, 4525)

# 결과:
# - result/4524_receipt.json
# - result/4525_selection.json
```

### 저장

```bash
/save 4524 4525

# 1. 캐시 로드
# 2. 유사 운용사 확인 (필요시 질문)
# 3. Sheets 저장 (배치)
# 4. 현황 업데이트
```

### 통합

```bash
/update 4524 4525
# = /parse 4524 4525 + /save 4524 4525
```

---

## 검증 방법

1. **파싱 테스트**: `/parse 4524 4525` 후 캐시 JSON 확인
2. **공동GP 테스트**: N빵 계산, jointGPGroup 확인
3. **USD 테스트**: 환율 변환, KRW 필드 확인
4. **저장 테스트**: Sheets에 금액, 상태 필드 확인
5. **현황 테스트**: 파일/출자사업 현황 자동 계산 확인
