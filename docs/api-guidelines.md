# Google Sheets API 가이드라인

Google Sheets API를 안전하고 효율적으로 사용하기 위한 가이드입니다.

## 셀 업데이트

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

## 배치 처리 메서드

대량 데이터 처리 시 개별 API 호출 대신 **배치 메서드** 사용 권장:

### 신청현황 일괄 생성

```javascript
// 신청현황 일괄 생성 (단일 API 호출)
const newIds = await sheets.createApplicationsBatch([
  { 출자사업ID: 'PJ0001', 운용사ID: 'OP0001', 출자분야: '중진 - 루키리그', 상태: '접수' },
  { 출자사업ID: 'PJ0001', 운용사ID: 'OP0002', 출자분야: '중진 - 스케일업', 상태: '접수' },
  // ... 수백 건도 한 번에 처리
]);
```

### 운용사 일괄 생성

```javascript
// 운용사 일괄 생성 (단일 API 호출)
const nameToIdMap = await sheets.createOperatorsBatch([
  '신규운용사A',
  '신규운용사B',
  // ...
]);
// 반환값: Map { '신규운용사A' => 'OP0100', '신규운용사B' => 'OP0101', ... }
```

### 성능 비교

- **개별 처리**: 200건 × 2초 = 400초 (API 할당량 초과 가능)
- **배치 처리**: 200건 → 1회 API 호출 ≈ 5초

## API 할당량 초과 시 수동 처리 주의사항

**중복 레코드 생성 방지**: API 할당량 초과로 작업이 중단된 후 재시도할 때:

### 1. 기존 생성된 레코드 확인 필수

- 출자사업(PJ), 운용사(OP), 신청현황(AP) 등 이미 생성된 레코드가 있는지 먼저 확인
- 중단 시점에 어떤 레코드까지 생성되었는지 파악

### 2. 같은 사업명으로 중복 출자사업 생성 금지

- 재시도 시 `getOrCreateProject()`가 새 ID를 발급할 수 있음
- 반드시 기존 출자사업 ID를 조회해서 사용

```javascript
// 재시도 전 기존 출자사업 확인
const existing = await sheets.findRow('출자사업', '사업명', projectName);
if (existing) {
  projectId = existing['ID'];  // 기존 ID 사용
}
```

### 3. 중복 발생 시 정리 방법

- 빈 레코드(신청현황 0건)를 삭제하거나 클리어
- 신청현황의 출자사업ID를 올바른 ID로 일괄 변경
- 출자사업 현황 필드 재집계

### 예방책

수동 처리 시 항상 기존 데이터 조회 먼저 수행
