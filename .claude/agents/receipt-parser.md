# 접수현황 PDF 파싱 에이전트

## 역할
접수현황 PDF를 파싱하여 운용사명, 출자분야를 추출하고 JSON 캐시로 저장

## 입력
- 파일번호: $ARGUMENTS

## 출력
- `result/{파일번호}_receipt.json`

## 처리 단계

### 1. 파일 정보 조회

Google Sheets '파일' 시트에서 파일번호로 조회:
```javascript
const { GoogleSheetsClient } = await import('./src/core/googleSheets.js');
const sheets = new GoogleSheetsClient();
await sheets.init();

const fileInfo = await sheets.findRow('파일', '파일번호', fileNo);
// 필요한 필드: 파일명, 파일유형, 파일URL, 등록날짜(J열)
```

### 2. PDF 다운로드 확인

downloads 폴더에서 파일 찾기:
```bash
ls downloads/ | grep {파일번호}
```

파일명 패턴: `{파일번호}_{원본파일명}.pdf`

### 3. PDF 이중 파싱 (병렬)

**3-1. Claude AI 직접 분석**

Read 도구로 PDF 읽기:
- 운용사명 목록 추출
- 출자분야 추출 (계정 - 분야 형식)
- 공동GP 표기 확인 (/, 쉼표, 줄바꿈)
- PDF 상단 "신청조합 수 N개" 확인

추출 형식:
```json
{
  "operators": [
    { "name": "운용사명", "category": "계정 - 분야", "originalName": "원본표기" }
  ],
  "totalCount": "PDF 상단 표기 건수",
  "fileTypeIndicator": "접수현황|선정결과" // PDF 내용에서 감지
}
```

**3-2. pdfplumber 파싱**
```bash
python3 src/processors/pdf-parser.py "downloads/{파일명}" 2>/dev/null
```

### 4. 결과 비교 및 병합

비교 규칙:
- 양쪽 일치: 자동 채택
- 충돌 시: Claude AI 결과 우선
- pdfplumber에만 있는 항목: 무시 (노이즈 가능성)
- Claude에만 있는 항목: 포함

### 5. 파일유형 검증 (PDF 내용 우선)

PDF 상단에서 파일유형 감지:
- "접수현황", "신청현황", "접수 현황" → 파일유형: `접수현황`
- "선정결과", "심사결과", "선정 결과" → 파일유형: `선정결과`

파일명의 파일유형과 다르면:
```json
{
  "fileType": "접수현황",
  "fileTypeSource": "pdf_content",
  "fileTypeMismatch": true
}
```

### 6. 공동GP 분리

분리 우선순위: 줄바꿈 > 쉼표 > 슬래시

```javascript
function splitJointGP(name) {
  if (name.includes('\n')) return name.split('\n').map(s => s.trim()).filter(Boolean);
  if (name.includes(',')) return name.split(',').map(s => s.trim()).filter(Boolean);
  if (name.includes('/')) return name.split('/').map(s => s.trim()).filter(Boolean);
  return [name];
}
```

공동GP 처리 시:
- `isJointGP: true` 설정
- `jointGPGroup`: 같은 조합끼리 그룹 ID 부여 (예: "JG001")
- 원본 이름 보존: `originalName`

### 7. 법인 표기 정규화

```javascript
function normalize(name) {
  return name
    .replace(/^\(주\)\s*/, '')      // 앞 (주) 제거
    .replace(/^주식회사\s*/, '')    // 앞 주식회사 제거
    .replace(/\s*\(주\)$/, '')      // 뒤 (주) 제거
    .replace(/\s+/g, '')            // 공백 제거
    .trim();
}
```

### 8. 운용사 유사도 분석

기존 운용사 목록 조회:
```javascript
const existingOperators = await sheets.getAllOperators();
```

src/matchers/operator-matcher.js 사용:
```javascript
import { findSimilarOperators, calculateOperatorSimilarity } from './src/matchers/operator-matcher.js';

const uniqueNames = [...new Set(entries.map(e => e.name))];
const analysis = findSimilarOperators(uniqueNames, existingOperators, 0.6);
// 결과: { exact: [], similar: [], new: [] }
```

유사도 분석 규칙:
1. 정확히 일치 (score = 1.0): 기존 운용사ID 사용
2. 약어 일치: 기존 운용사ID 사용
3. 유사도 >= 0.85: 검토 필요 목록에 추가
4. 유사도 0.60 ~ 0.85: 핵심명 유사도 추가 확인
5. 유사도 < 0.60: 신규 운용사

**핵심명 유사도 이중 체크**:
- 접미사(인베스트먼트, 벤처스, 파트너스 등) 제거 후 비교
- 핵심명 유사도 < 0.60이면 다른 운용사로 간주
- 예: "다성파트너스" vs "효성파트너스" → 핵심명 "다성" vs "효성" = 다름

**영문↔한글 양방향 매칭**:
- KB ↔ 케이비, IBK ↔ 아이비케이, BNK ↔ 비엔케이
- 양방향 모두 체크하여 동일 회사 감지

### 9. 캐시 저장

```javascript
const cache = {
  version: 1,
  fileNo: "4524",
  fileType: "접수현황",
  fileTypeSource: "pdf_content", // 또는 "filename"
  parsedAt: new Date().toISOString(),

  projectInfo: {
    name: "중기부 2025년 1차 정시",
    소관: "중기부",
    연도: "2025",
    차수: "1차"
  },

  sources: {
    ai: { success: true, count: 171 },
    pdfplumber: { success: true, count: 168 }
  },

  stats: {
    originalCount: 149,        // PDF 상단 표기 건수
    jointGPCount: 12,          // 공동GP 조합 수
    jointGPBreakdown: {
      "2개조합": 10,
      "3개조합": 2
    },
    totalEntries: 165          // 분리 후 총 건수
  },

  entries: [
    {
      name: "KB인베스트먼트",
      originalName: "(주)KB인베스트먼트",
      category: "중진 - 루키리그",
      isJointGP: false,
      jointGPGroup: null,
      source: "ai"
    },
    {
      name: "A벤처스",
      originalName: "A벤처스 / B파트너스",
      category: "청년 - 청년창업",
      isJointGP: true,
      jointGPGroup: "JG001",
      source: "ai"
    }
  ],

  operatorAnalysis: {
    exact: [
      { name: "KB인베스트먼트", id: "OP0001" }
    ],
    similar: [
      {
        parsed: "케이비인베스트",
        existing: "KB인베스트먼트",
        existingId: "OP0001",
        score: 0.87,
        coreScore: 0.72,
        reasons: ["영문-한글 발음 양방향 일치", "KB ↔ 케이비"],
        decision: null  // 저장 시 사용자 결정 대기
      }
    ],
    new: ["신규운용사A", "신규운용사B"]
  }
};

// 파일 저장
const fs = await import('fs');
fs.writeFileSync(`result/${fileNo}_receipt.json`, JSON.stringify(cache, null, 2));
```

## 출력 형식

```text
📄 접수현황 파싱 완료: {파일번호}

파일명: {파일명}
파일유형: 접수현황 (PDF 내용 기준)

📊 파싱 결과:
  - AI 파싱: {N}건
  - pdfplumber: {N}건
  - PDF 표기: 신청조합 {N}개

📌 공동GP 분리:
  - 공동GP: {N}개 ({detail})
  - 분리 후 총: {N}건

🔍 운용사 분석:
  - 기존 운용사: {N}개
  - 유사 확인 필요: {N}개
  - 신규 운용사: {N}개

✅ 캐시 저장: result/{fileNo}_receipt.json
```

## 주의사항

- **저장하지 않음** (분석만 수행)
- **유사 운용사 질문하지 않음** (캐시에 기록만)
- **캐시 JSON만 생성**
- PDF 내용과 파일명이 다르면 PDF 내용 우선
