# 캐시 → Google Sheets 저장

캐시된 파싱 결과를 Google Sheets에 저장합니다.

## 입력
- 파일번호: $ARGUMENTS (공백으로 구분된 여러 개 가능)

## 전제조건
- `/parse`로 캐시 파일이 생성되어 있어야 함
- 캐시 위치: `result/{파일번호}_receipt.json` 또는 `result/{파일번호}_selection.json`

## 처리 흐름

### 1. 캐시 로드

```javascript
const fs = await import('fs');
const fileNos = '$ARGUMENTS'.split(/\s+/).filter(Boolean);

const caches = [];
for (const fileNo of fileNos) {
  // 접수현황 캐시 확인
  const receiptPath = `result/${fileNo}_receipt.json`;
  if (fs.existsSync(receiptPath)) {
    caches.push({
      fileNo,
      type: 'receipt',
      data: JSON.parse(fs.readFileSync(receiptPath, 'utf-8'))
    });
  }

  // 선정결과 캐시 확인
  const selectionPath = `result/${fileNo}_selection.json`;
  if (fs.existsSync(selectionPath)) {
    caches.push({
      fileNo,
      type: 'selection',
      data: JSON.parse(fs.readFileSync(selectionPath, 'utf-8'))
    });
  }
}

if (caches.length === 0) {
  throw new Error('캐시 파일이 없습니다. 먼저 /parse를 실행하세요.');
}
```

### 2. 유사 운용사 확인 (필요시만 질문)

유사도 조건:
- `similarity >= 0.85 AND coreScore >= 0.60`
- 이 조건을 만족하는 운용사만 사용자에게 확인

```javascript
// 모든 캐시에서 유사 운용사 수집
const allSimilar = [];
for (const cache of caches) {
  const similar = cache.data.operatorAnalysis.similar;
  for (const item of similar) {
    if (item.score >= 0.85) {
      allSimilar.push({
        ...item,
        fileNo: cache.fileNo
      });
    }
  }
}

if (allSimilar.length > 0) {
  // 사용자에게 확인 요청
  // afplay /System/Library/Sounds/Glass.aiff 로 알림
  console.log('⚠️ 유사 운용사 확인 필요:');
  for (const item of allSimilar) {
    console.log(`  "${item.parsed}" → "${item.existing}" (${Math.round(item.score * 100)}%)`);
    console.log(`    이유: ${item.reasons.join(', ')}`);
  }
  // AskUserQuestion 도구로 y/n 질문
}
```

**헷갈리면 WebSearch로 확인**:
```text
유사 운용사가 같은 회사인지 다른 회사인지 판단이 어려운 경우:
1. WebSearch로 두 회사명 검색
2. 검색 결과에서 동일 회사 여부 확인
3. 결과에 따라 처리 결정
```

### 3. 출자사업 확인/생성

```javascript
const { GoogleSheetsClient } = await import('./src/core/googleSheets.js');
const sheets = new GoogleSheetsClient();
await sheets.init();

// 파일 정보에서 출자사업 추론
const fileInfo = await sheets.findRow('파일', '파일번호', fileNo);
const projectName = extractProjectName(fileInfo['파일명']);

// 기존 출자사업 조회
let project = await sheets.findRow('출자사업', '사업명', projectName);

if (!project) {
  // 신규 출자사업 생성
  const projectId = await sheets.createProject({
    사업명: projectName,
    소관: cache.data.projectInfo.소관,
    연도: cache.data.projectInfo.연도,
    차수: cache.data.projectInfo.차수
  });
  project = { ID: projectId };
}
```

**파일-출자사업 N:N 관계 처리**:
```javascript
// 여러 파일이 같은 출자사업에 연결되는 경우
// 지원파일ID, 결과파일ID를 쉼표로 연결

const existingFileIds = project['지원파일ID'] || '';
const fileIds = existingFileIds ? existingFileIds.split(',').map(s => s.trim()) : [];

if (!fileIds.includes(fileId)) {
  fileIds.push(fileId);
  await sheets.updateProjectFileId(project['ID'], cache.type === 'receipt' ? '접수현황' : '선정결과', fileIds.join(', '));
}
```

**중복 연결 검증**:
```javascript
// 파일이 다른 출자사업에 이미 연결되어 있는지 확인
// updateProjectFileId()가 자동으로 검증하고 에러 throw
try {
  await sheets.updateProjectFileId(projectId, fileType, fileId);
} catch (error) {
  if (error.code === 'DUPLICATE_FILE_LINK') {
    console.error(`❌ ${error.message}`);
    // 처리 중단
  }
}
```

### 4. 운용사 생성 (배치)

```javascript
// 신규 운용사 목록 수집
const newOperators = [];
for (const cache of caches) {
  newOperators.push(...cache.data.operatorAnalysis.new.map(n => n.newName || n));
}

// 중복 제거
const uniqueNewOperators = [...new Set(newOperators)];

// 배치 생성
const nameToIdMap = await sheets.createOperatorsBatch(uniqueNewOperators);
// 반환값: Map { '신규운용사A' => 'OP0100', ... }
```

**중복 운용사 발견 시 병합 안내**:
```javascript
// 저장 과정에서 중복 발견 시
console.log('⚠️ 중복 운용사 발견:');
console.log('  기존: OP0001 (KB인베스트먼트)');
console.log('  신규: OP0150 (케이비인베스트먼트)');
console.log('');
console.log('병합 명령어:');
console.log('  node src/matchers/operator-audit.js merge OP0001 OP0150 --execute');
```

### 5. 신청현황 생성/업데이트 (배치)

**복합키 중복 체크**:
```javascript
// 출자사업ID + 운용사ID + 출자분야로 중복 확인
const existingApps = await sheets.getApplicationsByProject(projectId);
const existingKeys = new Set(
  existingApps.map(a => `${a['운용사ID']}|${a['출자분야']}`)
);
```

**접수현황 저장**:
```javascript
const newApplications = [];

for (const entry of cache.data.entries) {
  const operatorId = nameToIdMap.get(entry.name) || await sheets.findOperatorId(entry.name);
  const key = `${operatorId}|${entry.category}`;

  if (existingKeys.has(key)) {
    console.log(`  스킵: ${entry.name} - ${entry.category} (이미 존재)`);
    continue;
  }

  newApplications.push({
    출자사업ID: projectId,
    운용사ID: operatorId,
    출자분야: entry.category,
    상태: '접수',
    비고: entry.isJointGP ? '공동GP' : ''
  });
}

// 배치 생성
await sheets.createApplicationsBatch(newApplications);
```

**선정결과 저장**:
```javascript
const newApplications = [];
const updateApplications = [];

for (const entry of cache.data.entries) {
  const operatorId = nameToIdMap.get(entry.name) || await sheets.findOperatorId(entry.name);
  const key = `${operatorId}|${entry.category}`;

  if (existingKeys.has(key)) {
    // 기존 신청현황 업데이트 (상태 → 선정)
    updateApplications.push({
      key,
      상태: '선정',
      최소결성규모: entry.minFormation,
      모태출자액: entry.moTae,
      결성예정액: entry.fundSize,
      출자요청액: entry.requestAmount,
      통화단위: entry.currency
    });
  } else {
    // 접수현황 없이 선정된 경우 → 신규 생성
    newApplications.push({
      출자사업ID: projectId,
      운용사ID: operatorId,
      출자분야: entry.category,
      최소결성규모: entry.minFormation,
      모태출자액: entry.moTae,
      결성예정액: entry.fundSize,
      출자요청액: entry.requestAmount,
      통화단위: entry.currency,
      상태: '선정',
      비고: '접수현황 PDF에 미기재, 선정결과에서 확인됨'
    });
  }
}
```

### 6. 선정/탈락 판정

```javascript
// 접수했으나 선정결과에 없는 운용사 → 탈락 처리
const selectedKeys = new Set(
  selectionCache.data.entries.map(e => {
    const opId = nameToIdMap.get(e.name) || findOperatorId(e.name);
    return `${opId}|${e.category}`;
  })
);

for (const app of existingApps) {
  const key = `${app['운용사ID']}|${app['출자분야']}`;
  if (app['상태'] === '접수' && !selectedKeys.has(key)) {
    // 탈락 처리
    await sheets.updateApplicationStatus(app['ID'], '탈락');
  }
}
```

**약어 확장 매칭**:
```javascript
// 선정결과 운용사명이 약어로 되어있는 경우
// 약어 확장 + 정규화 기반 매칭

import { normalizeName } from './src/utils/normalize.js';

function findMatchingOperator(selectionName, existingApps) {
  const normalized = normalizeName(selectionName);

  for (const app of existingApps) {
    const operator = await sheets.findRow('운용사', 'ID', app['운용사ID']);
    const opName = normalizeName(operator['운용사명']);
    const opAlias = operator['약어'] ? normalizeName(operator['약어']) : '';

    if (opName === normalized || opAlias === normalized) {
      return app;
    }
  }
  return null;
}
```

### 7. 현황 업데이트

```javascript
// 파일 현황 업데이트
await sheets.syncFileStatusWithApplications(fileId);
// → 신청현황 테이블에서 계산하여 파일 현황 필드 업데이트

// 출자사업 현황 업데이트
await sheets.updateProjectStatus(projectId);
// → 형식: "총 171건 (선정 45, 탈락 126)"
```

### 8. 캐시 정리

```javascript
// 저장 완료 후 캐시 파일에 완료 표시 또는 삭제
for (const cache of caches) {
  const cachePath = `result/${cache.fileNo}_${cache.type}.json`;
  // 옵션 1: 삭제
  // fs.unlinkSync(cachePath);

  // 옵션 2: 완료 표시
  cache.data.savedAt = new Date().toISOString();
  cache.data.saved = true;
  fs.writeFileSync(cachePath, JSON.stringify(cache.data, null, 2));
}
```

## 출력 형식

```text
💾 저장 시작

┌─────────────────────────────────────────────────────────┐
│ 출자사업: PJ0045 (중기부 2025년 1차 정시)               │
└─────────────────────────────────────────────────────────┘

📁 [FH4524] 접수현황 저장
  ├─ 신규 운용사: 40개 생성
  ├─ 신청현황: 165건 생성 (중복 스킵 0건)
  └─ 파일 현황: "신청조합 149개, 공동GP 12개, 총 165건"

📁 [FH4525] 선정결과 저장
  ├─ 신규 운용사: 5개 생성
  ├─ 선정 처리: 45건
  ├─ 탈락 처리: 120건
  └─ 파일 현황: "총 165개 중 선정 45건"

📊 출자사업 현황: 총 165건 (선정 45, 탈락 120)

✅ 저장 완료
```

## 에러 처리

### 캐시 없음
```text
❌ 에러: 캐시 파일이 없습니다.
   파일번호 4524에 대한 캐시를 찾을 수 없습니다.

   먼저 /parse 4524 를 실행하세요.
```

### 중복 파일 연결
```text
❌ 에러: 파일 중복 연결 오류
   FH0044는 이미 PJ0021(문체부 2024년 1차)에 연결되어 있습니다.

   다른 출자사업에 연결하려면 기존 연결을 먼저 해제하세요.
```

### API 할당량 초과
```text
⚠️ API 할당량 초과
   1분 후 자동 재시도합니다...

   [60초 대기 후 재시도]
```

## 주의사항

- **캐시 파일 필수**: `/parse` 먼저 실행
- **유사 운용사 확인**: score >= 0.85인 경우만 질문
- **복합키 중복 체크**: 출자사업ID + 운용사ID + 출자분야
- **파일 현황은 신청현황 테이블에서 계산**: 파싱 결과 직접 사용 금지
- **배치 처리**: API 호출 최소화
