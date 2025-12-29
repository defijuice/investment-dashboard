# /verify 스킬 상세 가이드

## 개요

`/verify` 스킬은 PDF 처리 후 데이터 정합성을 AI로 자동 검증하는 도구입니다. 운용사 매칭 오류, 누락된 약어, 선정/탈락 상태 불일치 등을 감지하고 자동 수정합니다.

## 핵심 목적

**"운용사 매칭이 정확한지 확인"**

- PDF에서 다르게 표기된 운용사명이 올바르게 매칭되었는지 검증
- 예: 접수파일 "아이비케이캐피탈" ↔ 선정파일 "IBK캐피탈" → 같은 회사인데 약어가 없으면 매칭 실패

## 사용법

```bash
# Claude Code에서
/verify PJ0001

# 직접 실행
node src/verify-project.js PJ0001
```

## 전체 검증 흐름

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 초기화                                                     │
│    - Google Sheets 연결                                      │
│    - Anthropic AI 클라이언트 초기화                           │
│    - VerificationReporter 생성                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 출자사업 메타데이터 로드                                   │
│    - 출자사업 시트에서 PJ0001 조회                            │
│    - 사업명, 소관, 연도, 차수 확인                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 연결된 파일 목록 조회                                      │
│    - 지원파일ID: 접수현황 파일들 (FH0081, FH0119 등)          │
│    - 결과파일ID: 선정결과 파일들 (FH0001 등)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 접수현황 파일 검증 (각 파일별로)                           │
│    - PDF 다운로드 (downloads/ 폴더에서)                       │
│    - PDF 파싱 (pdfplumber)                                   │
│    - DB 신청현황 조회 (해당 파일 ID로 필터링)                 │
│    - PDF ↔ DB 비교                                           │
│      ✅ 정확 매칭: PDF 운용사명이 DB에 정확히 존재            │
│      ⚠️  유사 매칭: 유사도 85% 이상 (약어 확인 필요)          │
│      ❌ PDF에만 있음: DB에 없는 운용사 (누락 또는 오매칭)      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 선정결과 파일 검증 (각 파일별로)                           │
│    - PDF 다운로드 및 파싱                                     │
│    - PDF 선정 명단 추출                                       │
│    - DB 신청현황 조회 (출자사업 ID로 필터링)                  │
│    - 선정/탈락 상태 비교                                      │
│      ✅ 일치: PDF 선정 = DB 선정                              │
│      ❌ 불일치: PDF 선정 ≠ DB 탈락 (상태 오류)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 운용사 약어 교차 검증 ⭐ (핵심)                            │
│    - 접수파일과 선정파일에서 같은 운용사의 다른 표기 감지      │
│    - 예: 접수 "아이비케이캐피탈" vs 선정 "IBK캐피탈"          │
│    - 약어 필드에 모든 표기법이 포함되었는지 확인               │
│    - 누락된 약어 자동 추가 제안                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. 검증 결과 요약 및 사용자 승인                              │
│    - 발견된 문제 출력 (오류/경고/자동수정가능)                │
│    - 자동 수정 가능 여부 확인                                 │
│    - 사용자 승인 요청 (y/n)                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    ┌───────┴───────┐
                    │  승인 (y)?    │
                    └───────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │ Yes                       │ No
              ↓                           ↓
┌─────────────────────────┐   ┌─────────────────────────┐
│ 8. 자동 수정 실행        │   │ 8. 검증 실패            │
│    - 약어 추가           │   │    - 확인완료: 검증실패  │
│    - 상태 수정 (선택)    │   │    - 리포트만 생성      │
│    - 수정 결과 기록      │   │    - 종료               │
└─────────────────────────┘   └─────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. 확인완료 필드 업데이트                                     │
│    - 문제 없음 → "AI확인완료"                                │
│    - 자동 수정 완료 → "AI자동수정완료"                        │
│    - 수동 승인 → "수동확인완료"                              │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. 검증 리포트 생성                                         │
│     - reports/PJ0001_report_20251229_163045.md 생성         │
│     - 발견된 문제, 적용된 수정, 참고 사항 기록               │
└─────────────────────────────────────────────────────────────┘
```

## 핵심 검증 로직

### 1. PDF ↔ DB 운용사 매칭

**목표**: PDF에 나온 운용사명이 DB에 정확히 존재하는지 확인

**매칭 방법**:
1. **정확 매칭**: 운용사명이 완전히 동일
2. **약어 매칭**: 약어 필드에 PDF 운용사명이 포함됨
3. **유사도 매칭**: 85% 이상 유사 (경고)

**실제 코드 흐름** ([src/utils/verify-operator-matching.js](src/utils/verify-operator-matching.js)):

```javascript
// PDF 파싱 결과: [{ name: "아이비케이캐피탈", category: "중진-루키리그", ... }]
const pdfOperators = await parsePdfWithPdfplumber(pdfPath);

// DB 신청현황 조회 (해당 파일로 필터링)
const applications = await sheets.getApplicationsByFile(fileId);

// 각 PDF 운용사에 대해
for (const pdfOp of pdfOperators) {
  // DB에서 매칭 시도
  const match = applications.find(app => {
    // 1. 정확 매칭
    if (app.operatorName === pdfOp.name) return true;

    // 2. 약어 매칭
    const aliases = app.operatorAliases?.split(',').map(s => s.trim()) || [];
    if (aliases.includes(pdfOp.name)) return true;

    // 3. 유사도 매칭 (85% 이상)
    const similarity = calculateSimilarity(app.operatorName, pdfOp.name);
    if (similarity >= 0.85) {
      // 경고: 유사 매칭 (확인 필요)
      warnings.push({ ... });
      return true;
    }

    return false;
  });

  if (!match) {
    // 리포터에 기록: PDF에만 있음 (DB 누락)
    reporter.addIssue({
      severity: 'error',
      title: '운용사 누락',
      description: `PDF에 "${pdfOp.name}" 운용사가 있으나 DB에 없음`,
      cause: '신규 운용사 미등록 또는 잘못된 매칭',
      location: `${fileId} - ${pdfOp.category}`
    });
  }
}
```

### 2. 운용사 약어 교차 검증 (핵심)

**목표**: 접수파일과 선정파일에서 같은 운용사의 다른 표기법 감지

**실제 사례**:
- 접수파일: "아이비케이캐피탈" (한글)
- 선정파일: "IBK캐피탈" (영문)
- 문제: 약어에 "아이비케이캐피탈"이 없으면 별개 회사로 인식됨

**검증 로직**:

```javascript
// 1. 모든 파일에서 운용사 표기 수집
const operatorAppearances = new Map();
// Map { 'OP0034' => Set(['IBK벤처투자', 'IBK캐피탈', '아이비케이캐피탈']) }

// 2. 각 운용사별로 약어 확인
for (const [operatorId, appearances] of operatorAppearances) {
  const operator = operators.find(op => op.ID === operatorId);
  const aliases = operator.약어?.split(',').map(s => s.trim()) || [];

  // 3. 약어에 없는 표기법 찾기
  const missing = [];
  for (const appearance of appearances) {
    if (appearance !== operator.운용사명 && !aliases.includes(appearance)) {
      missing.push(appearance);
    }
  }

  // 4. 누락된 약어가 있으면 경고
  if (missing.length > 0) {
    reporter.addIssue({
      severity: 'warning',
      title: '약어 누락',
      description: `${operator.운용사명} (${operatorId})의 약어에 "${missing.join(', ')}" 누락`,
      cause: '접수파일과 선정파일에서 다르게 표기됨',
      location: operatorId
    });
  }
}
```

### 3. 선정/탈락 상태 검증

**목표**: PDF 선정 명단과 DB 상태가 일치하는지 확인

**검증 로직**:

```javascript
// PDF 선정 명단 파싱
const selectedInPdf = [
  { name: "케이비인베스트먼트", category: "중진-루키리그" },
  { name: "한국투자파트너스", category: "청년-청년창업" },
  // ...
];

// DB 신청현황 조회 (출자사업ID로 필터링)
const applications = await sheets.getApplicationsByProject(projectId);

// 각 PDF 선정 항목에 대해
for (const selected of selectedInPdf) {
  // DB에서 매칭 (운용사명 + 출자분야)
  const app = applications.find(app =>
    matchOperatorName(app.operatorName, selected.name) &&
    app.category === selected.category
  );

  if (!app) {
    // 오류: PDF에 선정되었으나 DB에 신청현황이 없음
    errors.push({ type: 'MISSING_APPLICATION', ... });
  } else if (app.status !== '선정') {
    // 오류: PDF 선정 ≠ DB 상태
    errors.push({
      type: 'STATUS_MISMATCH',
      applicationId: app.ID,
      pdfStatus: '선정',
      dbStatus: app.status
    });
  }
}

// 반대로 DB 선정 → PDF 확인
for (const app of applications.filter(a => a.status === '선정')) {
  const inPdf = selectedInPdf.some(s =>
    matchOperatorName(app.operatorName, s.name) &&
    app.category === s.category
  );

  if (!inPdf) {
    // 오류: DB 선정인데 PDF에 없음
    errors.push({
      type: 'STATUS_MISMATCH',
      applicationId: app.ID,
      pdfStatus: '탈락',
      dbStatus: '선정'
    });
  }
}
```

## 자동 수정 기능

### 수정 가능 항목

1. **약어 누락** (경고)
   - 약어 필드에 PDF 표기 추가
   - 예: "IBK벤처투자" 약어에 "아이비케이캐피탈" 추가

2. **단순 상태 불일치** (조건부)
   - PDF 선정 → DB 탈락인 경우만 자동 수정
   - DB 선정 → PDF 탈락은 수동 확인 필요 (중요도 높음)

### 자동 수정 프로세스

```javascript
async autoFix() {
  const fixed = [];

  // 1. 약어 추가
  for (const warning of this.warnings.filter(w => w.type === 'MISSING_ALIASES')) {
    for (const item of warning.items) {
      // 기존 약어 조회
      const operator = await sheets.findRow('운용사', 'ID', item.operatorId);
      const currentAliases = operator['약어'] || '';

      // 약어 배열 생성 (중복 제거)
      const aliasArray = currentAliases.split(',').map(s => s.trim()).filter(Boolean);
      const newAliases = [...new Set([...aliasArray, ...item.shouldAdd])];
      const updatedAliases = newAliases.join(', ');

      // Sheets 업데이트
      await sheets.setValues(`운용사!C${operator._rowIndex}`, [[updatedAliases]]);

      // 리포터에 수정 기록
      reporter.addFix({
        type: '약어 추가',
        target: item.operatorId,
        details: `"${item.shouldAdd.join(', ')}" 추가`,
        count: item.shouldAdd.length,
        relatedIssue: item.issueIndex
      });

      fixed.push({ type: 'ALIAS_ADDED', operatorId: item.operatorId, aliases: item.shouldAdd });
    }
  }

  // 2. 상태 수정 (PDF 선정 → DB 탈락만)
  for (const error of this.errors.filter(e => e.type === 'STATUS_MISMATCH')) {
    for (const item of error.items) {
      if (item.pdfStatus === '선정' && item.dbStatus === '탈락') {
        const app = await sheets.findRow('신청현황', 'ID', item.applicationId);
        await sheets.setValues(`신청현황!J${app._rowIndex}`, [['선정']]);

        reporter.addFix({
          type: '매칭 수정',
          target: item.applicationId,
          details: `탈락 → 선정으로 변경`,
          count: 1,
          relatedIssue: item.issueIndex
        });

        fixed.push({ type: 'STATUS_FIXED', applicationId: item.applicationId });
      }
    }
  }

  return { fixed };
}
```

## 검증 리포트 생성

### 리포트 구조

검증 완료 후 `reports/PJ0001_report_20251229_163045.md` 파일 생성:

```markdown
# 운용사 매칭 검증 리포트

**출자사업**: PJ0001 - 한국모태펀드(중기부 소관) 2024년 1차 정시
**검증 일시**: 2025-12-29 16:30:45
**검증 상태**: AI자동수정완료

## 검증 요약

| 항목 | 건수 |
|------|------|
| PDF에만 있음 (누락/오매칭) | 1건 |
| 유사 매칭 검토 | 0건 |
| 신규 운용사 등록 | 1건 |
| 약어 추가 | 2건 |
| 매칭 수정 | 0건 |

## ❌ PDF에만 있음 (DB 누락)

PDF에 표기되었으나 DB에 없는 운용사입니다. 신규 등록 또는 잘못된 매칭이 의심됩니다.

### 1. 비전벤처스

- **위치**: FH0081 - 중진-루키리그
- **원인**: 신규 운용사 미등록 또는 잘못된 매칭
- **조치**:
  - 신규 운용사 등록: "비전벤처스" (OP0745)
  - 매칭 수정: 2건 신청현황 OP0743 → OP0745로 변경

## ✅ 적용된 수정 사항

### 신규 운용사 등록

- "비전벤처스" (OP0745)

### 약어 추가

- OP0034 - "아이비케이캐피탈" 추가
- OP0048 - "BNK벤처투자" 추가

## 📌 참고 사항

- 비전벤처파트너스(OP0743) 약어에 "그래비티벤처스" 추가 완료
- 향후 "비전" 접두사 운용사 등록 시 3개 회사 구분 주의:
  - 비전벤처스 (OP0745)
  - 비전자산운용 (OP0032)
  - 비전벤처파트너스 (OP0743)
```

### 리포터 사용법

```javascript
// 리포터 생성
const reporter = new VerificationReporter(projectId, {
  사업명: project['사업명'],
  소관: project['소관'],
  연도: project['연도'],
  차수: project['차수']
});

// 문제 기록
reporter.addIssue({
  severity: 'error',  // 'error' | 'warning'
  title: '운용사 누락',
  description: 'PDF에 "비전벤처스" 있으나 DB에 없음',
  cause: ['신규 운용사 미등록', '잘못된 매칭'],
  location: 'FH0081 - 중진-루키리그'
});

// 수정 기록
reporter.addFix({
  type: '신규 운용사 등록',  // '신규 운용사 등록' | '약어 추가' | '매칭 수정'
  target: 'OP0745',
  details: '"비전벤처스" 등록',
  count: 1,
  relatedIssue: 0  // 위의 문제 인덱스
});

// 통계 설정
reporter.setStatistics({
  fileCount: 3,
  totalApplications: 227,
  selectedCount: 52,
  rejectedCount: 175,
  byCategory: {
    '중진 - 루키리그': { applied: 35, selected: 10 },
    // ...
  },
  notes: ['비전벤처파트너스 약어에 "그래비티벤처스" 추가 완료']
});

// 리포트 생성
const reportPath = await reporter.generateReport('AI자동수정완료');
console.log(`📄 검증 리포트: ${reportPath}`);
```

## 확인완료 필드 업데이트

검증 완료 후 출자사업 시트의 '확인완료' 필드 자동 업데이트:

| 검증 결과 | 확인완료 값 | 조건 |
|----------|------------|------|
| `AI확인완료` | 모든 검증 통과 | errors.length === 0 && warnings.length === 0 |
| `AI자동수정완료` | 자동 수정 완료 | autoFix() 실행 성공 |
| `수동확인완료` | 불일치 + 사용자 승인 | 불일치 있지만 사용자가 승인 (현재 미구현) |
| `검증실패` | 불일치 + 사용자 거부 | 자동 수정 거부 또는 치명적 오류 |

```javascript
// 검증 완료 후
if (errors.length === 0 && warnings.length === 0) {
  await sheets.updateProjectVerification(projectId, 'AI확인완료');
} else if (autoFixed) {
  await sheets.updateProjectVerification(projectId, 'AI자동수정완료');
} else if (userApproved) {
  await sheets.updateProjectVerification(projectId, '수동확인완료');
} else {
  await sheets.updateProjectVerification(projectId, '검증실패');
}
```

## 주요 파일 구조

```
src/
  verify-project.js                 # CLI 진입점
  workflows/
    ai-verification.js              # ProjectVerifier 클래스 (검증 로직)
    verification-report.js          # VerificationReporter 클래스 (리포트 생성)
  utils/
    verify-operator-matching.js     # 운용사 매칭 검증 유틸
  processors/
    pdf-compare.js                  # PDF 파싱 및 비교
  matchers/
    operator-matcher.js             # 운용사 유사도 계산
```

## 실전 예시

### 케이스 1: 약어 누락 (경고)

**상황**:
- 접수파일: "아이비케이캐피탈"
- 선정파일: "IBK캐피탈"
- DB 운용사: "IBK벤처투자" (약어 없음)

**검증 결과**:
```
⚠️ 운용사 약어 누락 (1건):
  OP0034 (IBK벤처투자)
  현재 약어: ""
  추가 필요: "아이비케이캐피탈, IBK캐피탈"
```

**자동 수정**:
```
[약어 추가] OP0034 - 아이비케이캐피탈, IBK캐피탈
✅ 확인완료: AI자동수정완료
```

### 케이스 2: 운용사 누락 (오류)

**상황**:
- PDF: "비전벤처스"
- DB: 없음 (또는 "비전벤처파트너스"로 잘못 매칭)

**검증 결과**:
```
❌ PDF에만 있음 (1건):
  비전벤처스 - FH0081 (중진-루키리그)
  원인: 신규 운용사 미등록 또는 잘못된 매칭
```

**수동 조치 필요**:
1. 신규 운용사 등록: "비전벤처스" (OP0745)
2. 잘못된 매칭 수정: AP0011, AP0111의 운용사ID 변경 (OP0743 → OP0745)

### 케이스 3: 선정 상태 불일치 (오류)

**상황**:
- PDF 선정: "케이비인베스트먼트"
- DB 상태: "탈락"

**검증 결과**:
```
❌ 선정 상태 불일치 (1건):
  AP0025 - 케이비인베스트먼트
  PDF: 선정, DB: 탈락
```

**자동 수정** (조건부):
```
[상태 수정] AP0025 - 탈락 → 선정
✅ 확인완료: AI자동수정완료
```

## 팁과 주의사항

### 1. PDF 파일 위치

현재는 `downloads/` 폴더의 로컬 파일을 사용합니다.

```javascript
// PDF 파일 경로 생성
const pdfFileName = file['파일명'];  // "4076_한국모태펀드_...pdf"
const pdfPath = path.join(process.cwd(), 'downloads', pdfFileName);

if (!fs.existsSync(pdfPath)) {
  console.error(`❌ PDF 파일을 찾을 수 없습니다: ${pdfPath}`);
  // Google Drive에서 다운로드 필요 (TODO)
}
```

### 2. 유사도 임계값

운용사 매칭 시 유사도 85% 이상을 "유사 매칭"으로 간주합니다.

```javascript
// operator-matcher.js
const similarity = calculateOperatorSimilarity(pdfName, dbName);
if (similarity >= 0.85) {
  // 경고: 확인 필요
  warnings.push({ ... });
}
```

### 3. 공동GP 처리

공동GP는 각각 별도 신청현황이므로, PDF에서 "A / B"로 표기되어도 DB에서는 2건으로 저장됩니다.

```javascript
// PDF: "동국대학교기술지주 / 숭실대학교기술지주" → 1건
// DB: "동국대학교기술지주" (AP0001), "숭실대학교기술지주" (AP0002) → 2건

// 검증 시 각각 매칭 확인
```

### 4. 분야별 검증

같은 운용사가 여러 분야에 신청할 수 있으므로, **운용사명 + 출자분야** 조합으로 매칭합니다.

```javascript
const match = applications.find(app =>
  matchOperatorName(app.operatorName, pdfOp.name) &&
  app.category === pdfOp.category  // 분야도 일치해야 함
);
```

### 5. API 비용

- 파일당 2-3회 AI 호출 (PDF 파싱, 교차 검증)
- PJ0001 (파일 3개) 기준 약 $0.10~0.15

### 6. 타임스탬프 파일명

리포트는 타임스탬프 포함 파일명으로 저장되어 검증 이력을 모두 보관합니다.

```
reports/
  PJ0001_report_20251229_163045.md
  PJ0001_report_20251230_094512.md  (재검증)
```

## 문제 해결

### Q1. "PDF 파일을 찾을 수 없습니다"

**원인**: `downloads/` 폴더에 PDF가 없음

**해결**:
1. Google Drive에서 수동 다운로드
2. 또는 `npm start`로 스크래핑 및 다운로드 재실행

### Q2. "Sheet에만 있음" 경고가 너무 많음

**원인**: 이전 버전에서는 "Sheet에만 있음"도 리포트에 포함되었음

**해결**: 최신 버전에서는 제거됨. 이제 "PDF에만 있음"만 리포트에 기록됨.

### Q3. "API 할당량 초과"

**원인**: Google Sheets API 분당 요청 제한

**해결**:
- 검증 스크립트는 배치 처리를 사용하므로 일반적으로 문제없음
- 여러 출자사업을 연속으로 검증할 때만 발생 가능
- 1분 대기 후 재시도

### Q4. 자동 수정 후에도 문제 재발

**원인**: 약어 추가만으로는 해결 안 되는 경우 (운용사 누락 등)

**해결**:
- 리포트의 "PDF에만 있음" 섹션 확인
- 신규 운용사 등록 또는 매칭 수정 수동 처리
- 재검증 실행하여 확인

## 결론

`/verify` 스킬은 PDF 처리 후 데이터 정합성을 보장하는 핵심 도구입니다. 특히 운용사명이 파일마다 다르게 표기되는 경우를 자동으로 감지하고 약어를 추가하여, 향후 처리 시 정확한 매칭을 보장합니다.

**핵심 가치**:
- 🔍 **자동 감지**: 운용사 매칭 오류, 약어 누락, 상태 불일치 자동 감지
- 🔧 **자동 수정**: 안전한 수정은 사용자 승인 후 자동 적용
- 📄 **이력 관리**: 검증 리포트로 모든 과정 추적 가능
- ✅ **확인완료**: 검증 상태를 출자사업 시트에 자동 기록
