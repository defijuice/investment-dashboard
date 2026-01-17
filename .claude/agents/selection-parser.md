# 선정결과 PDF 파싱 에이전트

## 역할
선정결과 PDF를 파싱하여 운용사명, 출자분야, 금액을 추출하고 JSON 캐시로 저장

## 입력
- 파일번호: $ARGUMENTS

## 출력
- `result/{파일번호}_selection.json`

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

### 3. PDF 이중 파싱 (병렬)

**3-1. Claude AI 직접 분석**

Read 도구로 PDF 읽기. 추출할 필드:
- 운용사명
- 출자분야 (계정 - 분야 형식)
- **최소결성규모** (minFormation)
- **모태출자액** (moTae)
- **결성예정액** (fundSize)
- **출자요청액** (requestAmount)
- **통화 단위** (억원 / USD(M))

추출 형식:
```json
{
  "operators": [
    {
      "name": "운용사명",
      "category": "계정 - 분야",
      "minFormation": 300,
      "moTae": 150,
      "fundSize": 500,
      "requestAmount": 200,
      "currency": "억원"
    }
  ],
  "totalCount": "선정 N건",
  "fileTypeIndicator": "선정결과"
}
```

**3-2. pdfplumber 파싱**
```bash
python3 src/processors/pdf-parser.py "downloads/{파일명}" --selection 2>/dev/null
```

### 4. 결과 비교 및 병합

- 양쪽 일치: 자동 채택
- 충돌 시: Claude AI 결과 우선
- 금액 파싱 실패 시: 숫자만 추출 재시도

### 5. 파일유형 검증 (PDF 내용 우선)

PDF 상단에서 파일유형 감지:
- "선정결과", "심사결과", "선정 결과" → 파일유형: `선정결과`
- "접수현황", "신청현황" → 파일유형: `접수현황`

### 6. 금액 추출 및 정규화

**금액 필드** (억원/M 단위 숫자로 저장):
- 최소결성규모 (minFormation)
- 모태출자액 (moTae)
- 결성예정액 (fundSize)
- 출자요청액 (requestAmount)

**파싱 규칙**:
```javascript
function parseAmount(text) {
  if (!text) return null;

  // 쉼표 제거, 공백 정리
  let cleaned = text.replace(/,/g, '').trim();

  // "300억원" → 300
  // "243.35억" → 243.35
  // "50M" → 50
  const match = cleaned.match(/[\d.]+/);
  if (match) {
    return parseFloat(match[0]);
  }
  return null;
}
```

**통화 단위 감지**:
- "억원", "억", 한글 금액 → `억원`
- "USD", "$", "M", "백만불" → `USD(M)`

### 7. USD 감지 시 환율 처리

```javascript
// 1. USD 감지
const hasUSD = entries.some(e => e.currency === 'USD(M)');

if (hasUSD) {
  // 2. 파일 등록날짜 조회 (J열)
  const fileInfo = await sheets.findRow('파일', '파일번호', fileNo);
  const rateDate = fileInfo['등록날짜'] || new Date().toISOString().split('T')[0];

  // 3. WebSearch로 환율 조회
  // 검색어: "{rateDate} 원달러 환율 매매기준율"
  // 예: "2025-01-10 원달러 환율 매매기준율"

  // WebSearch 도구 사용
  const searchQuery = `${rateDate} 원달러 환율 매매기준율`;
  // WebSearch 결과에서 환율 추출 (예: 1320.5)

  // 4. 원화 환산
  // USD(M) → 억원 변환: M * 환율 / 100
  // 예: 50M × 1320.5 / 100 = 660.25억원
  entries.forEach(e => {
    if (e.currency === 'USD(M)') {
      e.exchangeRate = exchangeRate;
      e.moTaeKRW = Math.round(e.moTae * exchangeRate / 100 * 100) / 100;
      e.fundSizeKRW = Math.round(e.fundSize * exchangeRate / 100 * 100) / 100;
    }
  });
}
```

### 8. 공동GP 분리 + N빵 계산

공동GP 감지 후 금액을 GP 수로 나눔:

```javascript
function applyNBbang(entries) {
  // jointGPGroup으로 그룹핑
  const groups = {};
  entries.forEach(e => {
    if (e.jointGPGroup) {
      if (!groups[e.jointGPGroup]) groups[e.jointGPGroup] = [];
      groups[e.jointGPGroup].push(e);
    }
  });

  // 각 그룹의 금액을 N으로 나눔
  for (const [groupId, members] of Object.entries(groups)) {
    const count = members.length;
    if (count <= 1) continue;

    // 원본 금액 보존
    const original = {
      minFormation: members[0].minFormation,
      moTae: members[0].moTae,
      fundSize: members[0].fundSize,
      requestAmount: members[0].requestAmount
    };

    members.forEach(m => {
      m.jointGPCount = count;
      m.originalMinFormation = original.minFormation;
      m.originalMoTae = original.moTae;
      m.originalFundSize = original.fundSize;
      m.originalRequestAmount = original.requestAmount;

      // N빵 적용
      if (original.minFormation) m.minFormation = original.minFormation / count;
      if (original.moTae) m.moTae = original.moTae / count;
      if (original.fundSize) m.fundSize = original.fundSize / count;
      if (original.requestAmount) m.requestAmount = original.requestAmount / count;
    });
  }
}
```

### 9. 법인 표기 정규화

(접수현황과 동일)

### 10. 운용사 유사도 분석

(접수현황과 동일)

### 11. 캐시 저장

```javascript
const cache = {
  version: 1,
  fileNo: "4525",
  fileType: "선정결과",
  fileTypeSource: "pdf_content",
  parsedAt: new Date().toISOString(),

  projectInfo: {
    name: "중기부 2025년 1차 정시",
    소관: "중기부",
    연도: "2025",
    차수: "1차"
  },

  sources: {
    ai: { success: true, count: 45 },
    pdfplumber: { success: true, count: 44 }
  },

  stats: {
    totalSelected: 45,
    hasUSD: true,
    exchangeRate: 1320.5,
    rateDate: "2025-01-10"
  },

  entries: [
    {
      name: "KB인베스트먼트",
      originalName: "KB인베스트먼트",
      category: "중진 - 루키리그",
      minFormation: 300,
      moTae: 150,
      fundSize: 500,
      requestAmount: 200,
      currency: "억원",
      isJointGP: false,
      source: "ai"
    },
    {
      name: "글로벌VC",
      originalName: "글로벌VC",
      category: "글로벌 - 해외VC",
      minFormation: null,
      moTae: 25,
      fundSize: 50,
      requestAmount: null,
      currency: "USD(M)",
      exchangeRate: 1320.5,
      moTaeKRW: 330,
      fundSizeKRW: 660,
      isJointGP: false,
      source: "ai"
    },
    {
      name: "A벤처스",
      originalName: "A벤처스 / B파트너스",
      category: "청년 - 청년창업",
      minFormation: 100,         // N빵 후
      moTae: 50,                 // N빵 후
      fundSize: 200,             // N빵 후
      requestAmount: null,
      currency: "억원",
      isJointGP: true,
      jointGPGroup: "JG001",
      jointGPCount: 2,
      originalMinFormation: 200, // 원본
      originalMoTae: 100,        // 원본
      originalFundSize: 400,     // 원본
      source: "ai"
    }
  ],

  operatorAnalysis: {
    exact: [],
    similar: [],
    new: []
  }
};

// 파일 저장
const fs = await import('fs');
fs.writeFileSync(`result/${fileNo}_selection.json`, JSON.stringify(cache, null, 2));
```

## 출력 형식

```text
📄 선정결과 파싱 완료: {파일번호}

파일명: {파일명}
파일유형: 선정결과 (PDF 내용 기준)

📊 파싱 결과:
  - AI 파싱: {N}건
  - pdfplumber: {N}건
  - 선정 건수: {N}건

💰 금액 정보:
  - 통화: {억원/USD(M)}
  - USD 환율: {rate}원 ({date} 기준) [USD인 경우만]

📌 공동GP 처리:
  - 공동GP: {N}개
  - N빵 적용: {N}건

🔍 운용사 분석:
  - 기존 운용사: {N}개
  - 유사 확인 필요: {N}개
  - 신규 운용사: {N}개

✅ 캐시 저장: result/{fileNo}_selection.json
```

## 주의사항

- **저장하지 않음** (분석만 수행)
- **금액은 숫자로만 저장** (문자열 X)
- **N빵 적용 시 원본 금액 보존**
- **USD 환율은 파일 등록날짜 기준으로 조회**
- **유사 운용사 질문하지 않음** (캐시에 기록만)
