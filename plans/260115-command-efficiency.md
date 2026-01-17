# 커맨드 효율화 계획: PDF 중복 읽기 제거 및 단계 분리

> **결정사항**: `/parse + /save`로 분리, `/amount-update` 삭제

## 현재 문제점 요약

### 1. PDF 중복 읽기 (가장 큰 비효율)
```
현재 흐름:
/update 4524 → 선정결과 PDF 읽기 (운용사명, 분야 추출)
/amount-update → 같은 선정결과 PDF 다시 읽기 (금액 추출)
```
**같은 PDF를 2번 파싱** - AI 비용 + 시간 낭비

### 2. /update 커맨드가 너무 큼
- 450줄 이상의 복잡한 로직
- 접수+선정 모두 처리
- 운용사 유사도 검사까지 포함
- 하나가 실패하면 전체 재실행 필요

### 3. 병렬화 미적용
- 접수PDF, 선정PDF 순차 파싱 (병렬 가능)
- pdfplumber, Claude AI 순차 실행 (병렬 가능)

### 4. pdfplumber 이중 파싱 미사용
- `pdf-compare.js` 모듈이 있지만 import 안됨
- 데이터 검증 기회 손실

---

## 새로운 커맨드 구조

| 커맨드 | 역할 | PDF 읽기 | 저장 |
|--------|------|----------|------|
| `/parse {파일번호}` | PDF 파싱 (운용사+금액 한번에) | 1회 | JSON 캐시 |
| `/save {파일번호}` | 캐시된 파싱 결과를 Sheets에 저장 | 0회 | Sheets |
| `/update {파일번호}` | parse + save 자동 연결 | 1회 | Sheets |

### 핵심 변경: 선정결과 PDF 파싱 시 금액도 동시 추출

```javascript
// 현재: 운용사명, 분야만 추출
{ name: "A벤처", category: "중진 - 루키리그" }

// 개선: 금액까지 한번에 추출
{
  name: "A벤처",
  category: "중진 - 루키리그",
  minFormation: 300,      // 최소결성규모
  moTae: 150,             // 모태출자액
  fundSize: 500,          // 결성예정액
  requestAmount: 200,     // 출자요청액
  currency: "억원"
}
```

---

## 구현 단계

### Step 1: `/parse` 커맨드 생성

**파일**: `.claude/commands/parse.md`

```
/parse {파일번호}
│
├─ 1. 파일 정보 조회 (파일유형 확인)
│
├─ 2. PDF 파싱 (병렬)
│     ├─ Claude AI 파싱
│     └─ pdfplumber 파싱
│
├─ 3. 결과 비교 및 병합
│     ├─ 운용사명, 분야
│     └─ 금액 (선정결과인 경우)
│
├─ 4. 유사 운용사 분석 (저장 안함, 분석만)
│
├─ 5. 캐시 저장
│     └─ result/{파일번호}_result.json
│
└─ 6. 요약 출력
      ├─ 파싱 건수
      ├─ 신규 운용사 후보
      └─ 유사도 확인 필요 운용사
```

**캐시 파일 구조** (`result/4524_result.json`):
```json
{
  "fileNo": "4524",
  "fileType": "선정결과",
  "parsedAt": "2025-01-15T10:00:00Z",
  "projectInfo": {
    "name": "중기부 2025년 1차 정시",
    "소관": "중기부",
    "연도": "2025",
    "차수": "1차"
  },
  "entries": [
    {
      "name": "A벤처",
      "category": "중진 - 루키리그",
      "minFormation": 300,
      "moTae": 150,
      "fundSize": 500,
      "requestAmount": 200,
      "currency": "억원",
      "isJointGP": false
    }
  ],
  "operatorAnalysis": {
    "existing": ["A벤처 → OP0001"],
    "new": ["B인베스트먼트"],
    "similar": [
      {
        "parsed": "C캐피탈",
        "existing": "C캐피탈파트너스",
        "similarity": 0.87,
        "decision": null
      }
    ]
  }
}
```

### Step 2: `/save` 커맨드 생성

**파일**: `.claude/commands/save.md`

```
/save {파일번호}
│
├─ 1. 캐시 로드 (result/{파일번호}_result.json)
│     └─ 없으면 에러 ("먼저 /parse 실행 필요")
│
├─ 2. 유사 운용사 확인 (필요시만 질문)
│     └─ similarity >= 0.85 + coreName >= 0.60
│
├─ 3. 출자사업 확인/생성
│
├─ 4. 운용사 생성 (배치)
│
├─ 5. 신청현황 생성/업데이트 (배치)
│     ├─ 접수현황: 상태 = "접수"
│     └─ 선정결과: 상태 = "선정", 금액 필드 포함
│
├─ 6. 파일/출자사업 현황 업데이트
│
└─ 7. 캐시 삭제 또는 완료 표시
```

### Step 3: `/update` 커맨드 간소화

**파일**: `.claude/commands/update.md` (수정)

```
/update {파일번호}
│
├─ 1. /parse {파일번호} 실행
│
├─ 2. /save {파일번호} 실행
│
├─ 3. 쌍 파일 검색
│     ├─ 접수현황 입력 → 선정결과 찾기
│     └─ 선정결과 입력 → 접수현황 확인
│
├─ 4. 쌍 파일 자동 처리 (있으면)
│     ├─ /parse {쌍파일번호}
│     └─ /save {쌍파일번호}
│
└─ 5. 완료 리포트
```

### Step 4: PDF 파서 개선

**파일**: `src/processors/pdf-parser.py`

선정결과 파싱 시 금액 컬럼 추출 강화:
```python
# 현재: 금액 추출이 불완전
# 개선: 컬럼 구조 자동 감지 + 금액 필드 매핑

def parse_selection_pdf(pdf_path):
    # 1. 표 헤더에서 컬럼 구조 감지
    columns = detect_column_structure(table)
    # 예: ["분야", "운용사", "최소결성규모", "모태출자액"]

    # 2. 각 행에서 해당 컬럼 값 추출
    for row in rows:
        entry = {
            "name": row[columns.index("운용사")],
            "category": row[columns.index("분야")],
            "minFormation": parse_amount(row, "최소결성규모"),
            "moTae": parse_amount(row, "모태출자액"),
            # ...
        }
```

### Step 5: 환율 변환 (USD → 원화)

**방식**: 웹검색으로 파일 날짜 기준 환율 조회 (API 불필요)

USD 금액이 있는 선정결과 파일 처리 시:

```
/parse 흐름:
1. PDF에서 통화 감지 (USD 발견)
2. 파일 날짜 확인 (파일명 또는 PDF 내용에서)
3. WebSearch로 "2025년 1월 10일 원달러 환율" 검색
4. 환율 추출하여 캐시에 저장
```

**캐시 구조 확장:**
```json
{
  "entries": [
    {
      "name": "A벤처",
      "category": "글로벌 - 해외VC",
      "fundSize": 50,
      "currency": "USD",
      "exchangeRate": 1320.5,
      "fundSizeKRW": 660.25,
      "rateDate": "2025-01-10"
    }
  ]
}
```

**신청현황 저장 시:**
- 통화단위: `USD(M)`
- 비고: `환율 1,320.5원(2025-01-10), 약 660억원`

**변환 공식:**
```
원화(억원) = USD(M) × 환율 / 100
예: 50M × 1,320원 / 100 = 660억원
```

### Step 6: `/amount-update` 삭제

**파일**: `.claude/commands/amount-update.md` → 삭제

---

## 수정 대상 파일

| 파일 | 작업 | 설명 |
|------|------|------|
| `.claude/commands/parse.md` | 신규 | 파싱 전용 커맨드 |
| `.claude/commands/save.md` | 신규 | 저장 전용 커맨드 |
| `.claude/commands/update.md` | 수정 | parse+save 호출로 간소화 |
| `.claude/commands/amount-update.md` | 삭제 | 불필요 |
| `src/processors/pdf-parser.py` | 수정 | 금액 컬럼 추출 강화 |
| `src/processors/process-pair-sheets.js` | 수정 | 금액 필드 저장 로직 |
| `src/index.js` | 수정 | 파일 저장 시 등록날짜(J열) 포함 |
| `result/` | 신규 | 파싱 결과 캐시 디렉토리 |
| `CLAUDE.md` | 수정 | 파일 시트 구조에 등록날짜 컬럼 추가 |

### 파일 시트 구조 변경

**기존:**
```
A:ID, B:파일명, C:파일번호, D:파일유형, E:파일URL, F:처리상태, G:처리일시, H:비고, I:현황
```

**변경 후:**
```
A:ID, B:파일명, C:파일번호, D:파일유형, E:파일URL, F:처리상태, G:처리일시, H:비고, I:현황, J:등록날짜
```

### 스크래핑 시 등록날짜 저장

`src/index.js` 또는 파일 저장 로직에서:
```javascript
// 스크래핑 결과의 notice.date를 파일 시트 J열에 저장
await sheets.setValues(`파일!J${rowIndex}`, [[notice.date]]);
```

**환율 조회 시 사용:**
- `/parse`에서 USD 금액 감지 시
- 파일 시트의 등록날짜(J열) 조회
- 해당 날짜 기준 환율로 변환

---

## 예상 효과

| 항목 | 현재 | 개선 후 | 효과 |
|------|------|--------|------|
| PDF 읽기 횟수 | 2회/파일 | 1회/파일 | **50% 감소** |
| 전체 처리 시간 | 120초 | 60초 | **50% 단축** |
| AI 비용 | 2x | 1x | **50% 절감** |
| 에러 복구 | 전체 재실행 | 단계별 재실행 | **유연성 향상** |
| 디버깅 | 어려움 | 캐시 확인 가능 | **가시성 향상** |

---

## 검증 방법

1. **파싱 테스트**: `/parse 4524` 실행 후 `result/4524_result.json` 확인
2. **저장 테스트**: `/save 4524` 실행 후 Sheets에 금액 필드 확인
3. **통합 테스트**: `/update 4524` 실행 후 전체 흐름 확인
4. **성능 비교**: 기존 vs 개선 후 처리 시간 측정

---

## 세부 구현 가이드

### 캐시 디렉토리
- **위치**: `result/` (프로젝트 루트)
- 기존 `checkpoints/`와 동일 레벨
- `.gitignore`에 추가 필요

### 캐시 파일 구조 (상세)

```json
{
  "version": 1,
  "fileNo": "4524",
  "fileType": "선정결과",
  "parsedAt": "2026-01-15T10:30:00Z",

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

  "entries": [
    {
      "name": "KB인베스트먼트",
      "category": "중진 - 루키리그",
      "minFormation": 300,
      "moTae": 150,
      "fundSize": null,
      "requestAmount": null,
      "currency": "억원",
      "isJointGP": false,
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
        "reasons": ["영문-한글 발음 일치"],
        "decision": null
      }
    ],
    "new": ["신규운용사A", "신규운용사B"]
  }
}
```

### 분리할 코드 위치

**`process-pair-sheets.js` 분리 지점:**

| 줄 번호 | 현재 Phase | 분리 후 |
|---------|-----------|---------|
| 63-632 | Phase A (데이터 수집) | → `/parse` |
| 668-978 | Phase B (저장) | → `/save` |

### 병렬화 구현

```javascript
// pdf-parse.js 신규 생성
import { execAsync } from 'util';

async function parsePdfParallel(pdfPath, type) {
  const [aiResult, pdfplumberResult] = await Promise.allSettled([
    parseWithAI(pdfPath, type),
    parsePdfWithPdfplumberAsync(pdfPath, type)
  ]);

  const sources = {
    ai: { success: aiResult.status === 'fulfilled', count: 0 },
    pdfplumber: { success: pdfplumberResult.status === 'fulfilled', count: 0 }
  };

  // 둘 다 실패 시 에러
  if (!sources.ai.success && !sources.pdfplumber.success) {
    throw new Error('AI와 pdfplumber 모두 실패');
  }

  // 병합 로직
  const merged = mergeResults(
    sources.ai.success ? aiResult.value : null,
    sources.pdfplumber.success ? pdfplumberResult.value : null
  );

  return { sources, entries: merged };
}
```

### 유사 운용사 처리 흐름

```
/parse:
1. PDF 파싱 (AI + pdfplumber 병렬)
2. 운용사 유사도 분석 (질문 없음)
3. 캐시 저장 (decision: null)
4. 요약 출력 (유사 운용사 목록 표시)

/save:
1. 캐시 로드
2. 유사 운용사 확인 (필요시만 질문)
   - decision이 null인 항목만 질문
3. 캐시 업데이트 (decision 저장)
4. 운용사 생성/매칭
5. 신청현황 저장
```

### pdf-parser.py 금액 추출 개선

```python
# parse_selection_pdf() 개선안

def detect_column_headers(table):
    """첫 행에서 컬럼 헤더 식별"""
    header_row = table[0]
    columns = {}
    for i, cell in enumerate(header_row):
        if '결성예정' in cell or '결성규모' in cell:
            columns['fundSize'] = i
        elif '모태출자' in cell:
            columns['moTae'] = i
        elif '최소결성' in cell:
            columns['minFormation'] = i
        elif '출자요청' in cell:
            columns['requestAmount'] = i
    return columns

def parse_selection_with_amounts(pdf_path):
    tables = pdfplumber.open(pdf_path).pages[0].extract_tables()
    for table in tables:
        columns = detect_column_headers(table)
        for row in table[1:]:
            entry = {
                'company': extract_company(row),
                'category': extract_category(row),
                'fundSize': safe_parse_amount(row, columns.get('fundSize')),
                'moTae': safe_parse_amount(row, columns.get('moTae')),
                'minFormation': safe_parse_amount(row, columns.get('minFormation')),
                'requestAmount': safe_parse_amount(row, columns.get('requestAmount')),
            }
```

### 주의사항

1. **캐시 버전 관리**: 포맷 변경 시 `version` 필드 증가
2. **부분 실패 복구**: AI/pdfplumber 한쪽 실패해도 진행 가능
3. **금액 우선순위**: AI 결과 우선 (통화 정보 포함)
4. **캐시 삭제**: `/save` 완료 후 자동 삭제 (또는 옵션으로 보존)
