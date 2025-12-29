# PDF/HWP 파일 처리 및 Google Sheets 업데이트

입력받은 파일번호의 파일을 분석하여 Google Sheets에 저장합니다.

> **이 문서가 `/update` 명령어의 메인 레퍼런스입니다.**
> 시트 구조, 공동GP 처리, 금액 형식 등 공통 규칙은 **CLAUDE.md** 참조

## 핵심 원칙: 단계별 처리

**접수현황과 선정결과는 반드시 순차적으로 처리합니다.**

1. **접수현황 파일 처리** → 모든 신청현황을 **"접수"** 상태로 저장
2. **선정결과 파일 처리** → 선정된 운용사는 **"선정"**, 나머지는 **"탈락"**으로 업데이트

> ⚠️ 두 파일을 동시에 보고 바로 선정/탈락을 판단하면 안 됩니다.

## 지원 파일 형식

- **PDF**: Read 도구로 직접 분석 + pdfplumber 파싱
- **HWP**: Playwright MCP로 Google Drive 뷰어에서 캡처 후 OCR 분석

## 실행 모드: 자동 진행 (Auto Mode)

**기본적으로 사용자 확인 없이 자동 진행합니다.** 다음 경우에만 사용자에게 질문:

1. **유사도 85% 이상 + 핵심명 60% 이상 운용사** - 동일 회사 여부 판단 불가 시

### 질문 최소화 원칙

> **핵심**: 자동 진행하고 결과만 보고. 꼭 필요한 것만 질문.

**질문하지 말 것:**

- 파일 쌍 선택 (직접 판단하고 진행)
- 유사도 85% 미만 운용사 (신규 등록)
- 처리 방식 확인 (배치 vs 개별 등)

**질문해야 할 것:**

- 유사도 85% 이상 + 핵심명 60% 이상 운용사만 (동일 회사 여부 불확실 시)
- **⚠️ 공동GP 판단이 다를 때** - pdfplumber와 Claude 분석 결과가 다르면 반드시 질문

### 파일 선택 이슈 기록

동일 사업에 대해 **여러 파일이 존재**하는 경우:

1. **더 상세한 데이터가 있는 파일 선택** (개별 금액 > 분야별 합계)
2. **선택하지 않은 파일의 비고에 이유 기록** (예: "4445와 동일 사업, 분야별 합계만 포함하여 4445 사용")
3. **선택한 파일의 비고에도 기록** (예: "4442(분야별 합계)와 4445(개별 금액) 중 상세 데이터 포함된 4445 사용")

### API 할당량 초과 시 자동 재시도

- 1분 대기 후 자동 재시도
- 최대 3회 재시도
- 사용자에게 질문하지 않음

### 자동 처리 규칙

| 상황 | 자동 처리 방식 |
|------|---------------|
| 운용사 수 일치 | 자동 진행 |
| 운용사 수 불일치 (공동GP 차이) | **⚠️ 반드시 사용자에게 질문** |
| pdfplumber에만 있는 항목 | 무시 (노이즈로 간주) |
| Claude에만 있는 항목 | 포함 (정확도 높음) |
| 유사 운용사 (85% 미만) | 신규 등록으로 처리 |
| 유사 운용사 (85% 이상) | 핵심명 비교 후 자동 판단, 판단 불가 시만 질문 |
| (주), 주식회사 등 법인 표기 | 기존 운용사와 동일로 처리 |
| 동일 사업 파일 여러 개 | 상세 데이터 파일 선택, 비고에 선택 사유 기록 |

## 입력 파라미터

- **파일번호**: $ARGUMENTS (예: 4524)

---

## Step 1: 파일 정보 조회 및 쌍 찾기

1. `파일` 시트에서 해당 파일번호의 정보 조회 (파일유형, 파일명, 처리상태)
2. **이미 처리 완료된 파일이면 스킵** (처리상태가 '완료'인 경우)
3. downloads 폴더에서 해당 파일 읽어서 **사업명 추출**
4. `파일` 시트에서 **같은 사업명을 가진 반대 유형의 파일** 검색:
   - 입력 파일이 접수현황 → 선정결과 파일 찾기
   - 입력 파일이 선정결과 → 접수현황 파일 찾기
5. **쌍 파일 상태 확인**:
   - 접수현황 입력 시: 선정결과 파일이 있으면 함께 처리 예정
   - 선정결과 입력 시: 접수현황이 미처리면 **접수현황 먼저 처리**

### ⚠️ 쌍 파일 자동 처리 (CRITICAL)

**접수현황 처리 완료 후 선정결과 파일이 존재하면 반드시 연속 처리한다.**

- 접수현황만 처리하고 멈추지 말 것
- 선정결과 파일을 찾았으면 질문 없이 바로 처리
- 하나의 `/update` 명령으로 접수+선정 모두 완료해야 함

```text
/update 4408 실행 시:
  1. 4408 (접수현황) 처리 ✓
  2. 4429 (선정결과) 자동 검색 및 처리 ✓  ← 이 단계 누락 금지!
  3. 완료 리포트 출력
```

### 사업명 매칭 규칙 (AI 판단)

파일명이 균일하지 않으므로 다음을 종합적으로 판단:

- 연도 일치 (예: 2025)
- 키워드 일치 (문화, 영화, 특허, 중기부 등)
- PDF 내용의 사업명 확인
- 차수 일치 (1차, 2차 등)

---

## Step 2: 파일 분석 (PDF / HWP)

### 2-1. PDF 파일인 경우

**Claude Code 직접 분석:**

PDF 파일을 Read 도구로 직접 읽고 다음 정보를 추출:

**접수현황 PDF:**

- 운용사명, 출자분야
- 공동GP 분리 (`/`, `,` 구분자)
- PDF 상단의 "신청조합 수 N개" 확인

**선정결과 PDF:**

- 선정 운용사명, 출자분야
- 공동GP 분리
- PDF 상단의 "최종 선정 조합 N개" 확인

**pdfplumber 파싱:**

```bash
# 접수현황
python3 src/pdf-parser.py "downloads/<파일명>.pdf"

# 선정결과
python3 src/pdf-parser.py "downloads/<파일명>.pdf" --selection
```

### 2-2. HWP 파일인 경우 (Playwright MCP 캡처)

HWP 파일은 Read 도구로 직접 읽을 수 없으므로 Google Drive 뷰어를 통해 캡처 후 분석합니다.

**단일 페이지 캡처:**

```text
1. browser_navigate → Google Drive 파일 URL
2. browser_wait_for → 2초 대기 (렌더링)
3. browser_snapshot → 페이지 정보 확인 (N/M 페이지)
4. browser_take_screenshot → 캡처
5. Read → 캡처 이미지 분석 (OCR)
6. browser_close → 브라우저 닫기
```

**여러 페이지 캡처 (순차 캡처):**

```text
1. browser_navigate → Google Drive 파일 URL
2. browser_wait_for → 3초 대기
3. browser_snapshot → 총 페이지 수 확인 (예: "1 / 5")
4. 줌 축소: 축소 버튼 1회 클릭 → 75% (권장)
5. 각 페이지마다 반복:
   a. browser_take_screenshot → page_N_top.png 캡처
   b. browser_press_key → "ArrowDown" 3~4회 (페이지 내 스크롤)
   c. browser_take_screenshot → page_N_bottom.png 캡처 (하단 짤림 방지)
   d. browser_press_key → "PageDown" (다음 페이지로 이동)
   e. browser_wait_for → 1초 대기
6. Read → 모든 캡처 이미지 분석
7. browser_close → 브라우저 닫기
```

### 2-3. 결과 비교 (이중 파싱) ⚠️ CRITICAL

`src/pdf-compare.js`의 `compareResults()` 함수 로직으로 두 결과를 비교:

- **일치**: 양쪽에서 같은 운용사명+분야 → 자동 진행
- **충돌**: 양쪽에 있지만 분야가 다름 → Claude Code 결과 우선
- **한쪽만 존재**: pdfplumber만 있으면 무시, Claude만 있으면 포함

#### ⚠️ 공동GP 판단 충돌 시 반드시 질문

**pdfplumber가 공동GP로 파싱했는데 Claude가 개별로 판단한 경우:**

```text
pdfplumber 결과:
  - is_joint_gp: true
  - original_company: "이크럭스벤처파트너스\n코어자산운용"

Claude 분석 결과:
  - 이크럭스벤처파트너스 (개별)
  - 코어자산운용 (개별)
```

**이런 차이가 발생하면 자동 판단하지 말고 반드시 사용자에게 질문:**

> "pdfplumber는 '이크럭스벤처파트너스, 코어자산운용'을 공동GP로 파싱했습니다.
> PDF에서 이 두 회사가 같은 셀에 있는지 확인해주세요. 공동GP가 맞나요?"

**판단 기준:**
- 같은 셀 안에 줄바꿈(`\n`)으로 여러 회사 → **공동GP**
- 각각 다른 행(셀)에 있음 → **개별 신청**

**PDF 표에서 셀 구분이 어려울 수 있으므로 pdfplumber의 `is_joint_gp: true` 결과를 존중할 것.**

---

## Step 3: 출자사업 확인/생성

PDF 내용에서 사업명을 추출하고 출자사업 시트에서 확인:

```javascript
const project = await sheets.getOrCreateProject(projectName, {
  소관: '...',
  공고유형: '정시',
  연도: '2025',
  차수: '1차'
});
```

**파일 연결:**
- 접수현황 파일 → `지원파일ID` 필드에 추가
- 선정결과 파일 → `결과파일ID` 필드에 추가

---

## Step 4: 신규 운용사 유사도 자동 처리

신규 운용사 등록 전 기존 운용사와 유사도 검사 후 **자동 판단**:

### 유사도 자동 판단 규칙

- **정확히 일치**: 기존 운용사 ID 사용
- **(주), 주식회사 등 법인 표기 차이만**: 기존 운용사와 동일 처리
- **유사도 85% 미만**: 신규 등록
- **유사도 85% 이상 + 핵심명 유사도 60% 미만**: 신규 등록 (접미사만 유사)
- **유사도 85% 이상 + 핵심명 유사도 60% 이상**: **사용자 확인 필요**

### 법인 표기 정규화

다음 패턴은 제거 후 비교: `(주)`, `주식회사`, `(유)`, `유한회사`

예: `(주)벡터기술투자` = `벡터기술투자`

---

## Step 5: 데이터 저장 (파일유형별 분기)

### 5-1. 접수현황 파일인 경우

**모든 신청현황을 "접수" 상태로 저장 (배치 처리 권장):**

```javascript
// 1. 신규 운용사 일괄 등록
const newOperatorNames = [...newOperatorsSet];
const nameToIdMap = await sheets.createOperatorsBatch(newOperatorNames);

// 2. 신청현황 데이터 준비
const applicationsToCreate = [];
for (const app of applications) {
  const key = `${operatorId}|${category}`;
  if (existingApps.has(key)) continue;  // 중복 스킵

  applicationsToCreate.push({
    출자사업ID: projectId,
    운용사ID: operatorId,
    출자분야: category,
    상태: '접수',
    비고: isJoint ? '공동GP' : ''
  });
}

// 3. 신청현황 일괄 생성 (단일 API 호출)
await sheets.createApplicationsBatch(applicationsToCreate);
```

**파일 현황 업데이트:**
```
신청조합 N개, 공동GP N개(2개조합 N건, 3개조합 N건), 총 신청현황 N건
```

### 5-2. 선정결과 파일인 경우

**기존 "접수" 상태를 "선정" 또는 "탈락"으로 업데이트:**

```javascript
// 1. 해당 출자사업의 모든 신청현황 조회
const existingApps = await sheets.getExistingApplications(projectId);

// 2. 선정된 운용사 목록 (PDF에서 추출)
const selectedOperators = new Set(selectedList.map(s => `${s.operatorId}|${s.category}`));

// 3. 각 신청현황 업데이트
for (const [key, appInfo] of existingApps) {
  if (selectedOperators.has(key)) {
    await sheets.updateApplicationStatus(appInfo.appId, '선정');
  } else {
    await sheets.updateApplicationStatus(appInfo.appId, '탈락');
  }
}
```

**파일 현황 업데이트:**
```
총 N개 중 선정 M건
```

### 5-3. 약어 자동 업데이트

**운용사 매칭 시 다른 표기 발견하면 약어에 추가:**

유사도 매칭으로 기존 운용사를 사용한 경우, 파싱된 운용사명이 기존 운용사명과 다르면 자동으로 약어 필드에 추가:

```javascript
// 예: 기존 "KB인베스트먼트" (OP0001) + 파싱 결과 "KB투자"
if (matchedOperatorName !== parsedName) {
  await sheets.updateOperatorAlias(operatorId, parsedName);
  // → 약어 필드: "KB투자" 추가
}
```

**처리 시점:**

- 접수현황 처리 시: 매칭된 운용사의 다른 표기 발견
- 선정결과 처리 시: 매칭된 운용사의 다른 표기 발견

**효과:**

- 차후 동일한 표기로 검색 시 자동 매칭됨
- 운용사명 변이 히스토리 자동 누적

**실제 구현 위치:**

- [src/process-pair-sheets.js:534-543](src/process-pair-sheets.js#L534-L543) - 유사도 매칭 후 약어 추가 로직
- [src/process-pair-sheets.js:661-668](src/process-pair-sheets.js#L661-L668) - 새 약어 일괄 저장
- [src/googleSheets.js:412-431](src/googleSheets.js#L412-L431) - `updateOperatorAlias()` 메서드

---

## Step 6: 파일 및 출자사업 현황 업데이트

1. **파일 처리상태 업데이트** (파일 시트)
   - 처리상태: `완료`
   - 처리일시: 현재 시간

2. **⚠️ 파일 현황은 신청현황에서 동기화 (CRITICAL)**

   **절대 파싱 결과로 직접 저장하지 말 것!** 반드시 신청현황 테이블에서 계산:

   ```javascript
   // 선정결과 파일의 경우
   await sheets.syncFileStatusWithApplications(fileId);
   // → 신청현황에서 해당 출자사업의 총 건수, 선정 건수를 계산하여 저장
   ```

   **이유**: 파싱 결과와 실제 저장된 신청현황 건수가 다를 수 있음 (중복 스킵, 공동GP 분리 등)

3. **출자사업 현황 업데이트** (출자사업 시트)
   - 형식: `총 N건 (선정 X, 탈락 Y, 접수 Z)`
   - `sheets.updateProjectStatus(projectId)` 사용

---

## 프로세스 요약

```text
파일번호 입력
    ↓
파일 정보 조회 (파일유형 확인)
    ↓
★ 쌍 파일 검색 (접수↔선정)
    ↓
[접수현황 처리]
    ├─ 파일 분석 (PDF/HWP)
    ├─ 출자사업 확인/생성
    ├─ 운용사 유사도 검사
    ├─ 신청현황 생성 (상태: "접수")
    └─ 파일 현황 업데이트
    ↓
★ 선정결과 파일 존재? → YES → 자동 연속 처리!
    ↓
[선정결과 처리]
    ├─ 파일 분석 (PDF/HWP)
    ├─ 기존 신청현황 조회
    ├─ 선정 → "선정", 미선정 → "탈락"
    └─ 파일 현황 업데이트
    ↓
출자사업 현황 업데이트
    ↓
완료 리포트 (접수+선정 모두 포함)
```

### ⚠️ 중요: 접수현황만 처리하고 멈추면 안 됨

선정결과 파일이 있으면 **무조건 연속 처리**한다.

---

## 결과

처리 완료 후 요약 출력:

**접수현황 파일 처리 시:**
- 신규 신청현황: N건
- 중복 스킵: M건
- 신규 운용사: K개

**선정결과 파일 처리 시:**
- 선정 업데이트: N건
- 탈락 업데이트: M건
- 신규 운용사: K개

**공통:**
- 스프레드시트 링크