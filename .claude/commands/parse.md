# PDF 파싱 (병렬 서브에이전트)

입력받은 파일번호들을 분석하여 캐시 JSON을 생성합니다.

## 입력
- 파일번호: $ARGUMENTS (공백으로 구분된 여러 개 가능)

## 처리 흐름

### 1. 파일번호 파싱

```javascript
const fileNos = '$ARGUMENTS'.split(/\s+/).filter(Boolean);
```

### 2. 파일유형 판별 + 쌍 파일 자동 검색

각 파일의 유형을 Google Sheets에서 조회하고, **반대 유형 파일을 자동으로 검색**:

```javascript
const { GoogleSheetsClient } = await import('./src/core/googleSheets.js');
const sheets = new GoogleSheetsClient();
await sheets.init();

const files = [];
const processedFileNos = new Set();

for (const fileNo of fileNos) {
  if (processedFileNos.has(fileNo)) continue;

  const info = await sheets.findRow('파일', '파일번호', fileNo);
  if (!info) {
    console.error(`파일번호 ${fileNo}를 찾을 수 없습니다.`);
    continue;
  }

  files.push({
    fileNo,
    type: info['파일유형'],
    name: info['파일명']
  });
  processedFileNos.add(fileNo);

  // 쌍 파일 자동 검색
  const pairFile = await findPairFile(sheets, info);
  if (pairFile && !processedFileNos.has(pairFile.fileNo)) {
    files.push(pairFile);
    processedFileNos.add(pairFile.fileNo);
    console.log(`📎 쌍 파일 발견: ${pairFile.fileNo} (${pairFile.type})`);
  }
}
```

### 2-1. 쌍 파일 검색 로직

```javascript
async function findPairFile(sheets, fileInfo) {
  const currentType = fileInfo['파일유형'];
  const targetType = currentType === '접수현황' ? '선정결과' : '접수현황';

  // 파일명에서 사업명 키워드 추출
  const fileName = fileInfo['파일명'];
  const keywords = extractProjectKeywords(fileName);
  // 예: "중기부_2025_1차_정시_접수현황" → ["중기부", "2025", "1차", "정시"]

  // 같은 사업의 반대 유형 파일 검색
  const allFiles = await sheets.getAllFiles();

  for (const file of allFiles) {
    if (file['파일유형'] !== targetType) continue;
    if (file['처리상태'] === '완료') continue;  // 이미 처리된 파일 제외

    const otherKeywords = extractProjectKeywords(file['파일명']);

    // 키워드 매칭 (소관, 연도, 차수가 일치하면 같은 사업)
    if (matchesProject(keywords, otherKeywords)) {
      return {
        fileNo: file['파일번호'],
        type: file['파일유형'],
        name: file['파일명']
      };
    }
  }

  return null;
}

function extractProjectKeywords(fileName) {
  // 소관 키워드
  const 소관List = ['중기부', '문체부', '과기정통부', '특허청', '해수부', '농림부', '산업부', '환경부'];
  const 소관 = 소관List.find(s => fileName.includes(s));

  // 연도 (2024, 2025 등)
  const 연도Match = fileName.match(/20\d{2}/);
  const 연도 = 연도Match ? 연도Match[0] : null;

  // 차수 (1차, 2차, 수시, 정시 등)
  const 차수Match = fileName.match(/(\d+차|수시|정시)/);
  const 차수 = 차수Match ? 차수Match[0] : null;

  // 분야 키워드 (문화, 영화, 해양 등)
  const 분야List = ['문화', '영화', '해양', '특허', '바이오', '소부장', '그린'];
  const 분야 = 분야List.filter(f => fileName.includes(f));

  return { 소관, 연도, 차수, 분야 };
}

function matchesProject(kw1, kw2) {
  // 소관 + 연도 + 차수가 일치하면 같은 사업
  if (kw1.소관 && kw2.소관 && kw1.소관 !== kw2.소관) return false;
  if (kw1.연도 && kw2.연도 && kw1.연도 !== kw2.연도) return false;
  if (kw1.차수 && kw2.차수 && kw1.차수 !== kw2.차수) return false;

  // 분야가 있으면 분야도 일치해야 함
  if (kw1.분야.length > 0 && kw2.분야.length > 0) {
    const common = kw1.분야.filter(f => kw2.분야.includes(f));
    if (common.length === 0) return false;
  }

  // 최소 2개 이상 일치해야 함
  let matchCount = 0;
  if (kw1.소관 && kw1.소관 === kw2.소관) matchCount++;
  if (kw1.연도 && kw1.연도 === kw2.연도) matchCount++;
  if (kw1.차수 && kw1.차수 === kw2.차수) matchCount++;

  return matchCount >= 2;
}
```

### 3. 서브에이전트 병렬 실행

**Task tool을 사용하여 병렬로 호출:**

파일유형에 따라 적절한 에이전트 선택:
- `접수현황` → receipt-parser 에이전트
- `선정결과` → selection-parser 에이전트

```text
각 파일에 대해 Task tool 호출:

Task({
  subagent_type: "general-purpose",
  description: "접수현황 PDF 파싱",
  prompt: `
    .claude/agents/receipt-parser.md 에이전트 지침을 따라
    파일번호 ${fileNo}의 접수현황 PDF를 파싱하세요.

    1. 파일 정보 조회 (Google Sheets)
    2. PDF 이중 파싱 (AI + pdfplumber)
    3. 공동GP 분리
    4. 운용사 유사도 분석
    5. 캐시 저장: result/${fileNo}_receipt.json
  `
})
```

**병렬 실행 예시:**
```text
/parse 4524 4525 처리 시:

[병렬 실행]
├─ Task: receipt-parser (4524) → result/4524_receipt.json
└─ Task: selection-parser (4525) → result/4525_selection.json
```

### 4. 결과 수집 및 요약

각 서브에이전트 완료 후:
1. 캐시 파일 생성 확인
2. 파싱 건수 요약
3. 유사 운용사 목록 집계

```javascript
const fs = await import('fs');
const results = [];

for (const file of files) {
  const cacheType = file.type === '접수현황' ? 'receipt' : 'selection';
  const cachePath = `result/${file.fileNo}_${cacheType}.json`;

  if (fs.existsSync(cachePath)) {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    results.push({
      fileNo: file.fileNo,
      type: file.type,
      entryCount: cache.entries.length,
      similarCount: cache.operatorAnalysis.similar.length,
      newCount: cache.operatorAnalysis.new.length
    });
  }
}
```

## 실행 예시

### 단일 파일 (쌍 파일 자동 검색)
```bash
/parse 4524

# 내부 동작:
# 1. 4524 조회 → 접수현황
# 2. 같은 사업의 선정결과 검색 → 4525 발견
# 3. 4524 + 4525 함께 처리
```

### 접수+선정 쌍 (명시적)
```bash
/parse 4524 4525
```

### 여러 파일 (병렬)
```bash
/parse 4524 4525 4526 4527
```

### 쌍 파일 자동 검색 예시
```text
/parse 4524 실행 시:

📎 파일 조회: 4524 (접수현황)
   파일명: 중기부_2025_1차_정시_접수현황.pdf
📎 쌍 파일 발견: 4525 (선정결과)
   파일명: 중기부_2025_1차_정시_선정결과.pdf

→ 4524 + 4525 병렬 파싱 시작
```

## 출력 형식

```text
📄 파싱 완료

┌─────────────────────────────────────────────────────────┐
│ [FH4524] 접수현황                                        │
├─────────────────────────────────────────────────────────┤
│ 파싱 건수: 171건                                         │
│ 공동GP: 12개 (2개조합 10건, 3개조합 2건)                 │
│ 분리 후 총: 165건                                        │
│                                                         │
│ 운용사 분석:                                             │
│   - 기존 운용사: 120개                                   │
│   - 유사 확인 필요: 5개                                  │
│   - 신규 운용사: 40개                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ [FH4525] 선정결과                                        │
├─────────────────────────────────────────────────────────┤
│ 파싱 건수: 45건                                          │
│ USD 환율: 1,320.5원 (2025-01-10 기준)                   │
│ N빵 적용: 3건                                            │
│                                                         │
│ 운용사 분석:                                             │
│   - 기존 운용사: 35개                                    │
│   - 유사 확인 필요: 2개                                  │
│   - 신규 운용사: 8개                                     │
└─────────────────────────────────────────────────────────┘

📁 캐시 저장:
  ✓ result/4524_receipt.json
  ✓ result/4525_selection.json

⚠️ 유사 운용사 확인 필요: 7건
   → /save 실행 시 확인 요청됨
```

## 에러 처리

### 파일번호 없음
```text
❌ 에러: 파일번호 4999를 찾을 수 없습니다.
```

### PDF 파일 없음
```text
❌ 에러: downloads/ 폴더에 파일번호 4524에 해당하는 PDF가 없습니다.
   → 먼저 npm start로 파일을 다운로드하세요.
```

### 이미 캐시 존재
```text
⚠️ 주의: result/4524_receipt.json이 이미 존재합니다.
   기존 캐시를 덮어씁니다.
```

## 주의사항

- **PDF 읽기는 각 서브에이전트에서 1회만** 수행
- **캐시만 생성**, Google Sheets에 저장하지 않음
- **유사 운용사 질문하지 않음** (캐시에 기록만)
- 저장은 `/save` 커맨드에서 별도 수행
