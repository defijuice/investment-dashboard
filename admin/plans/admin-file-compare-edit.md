# 어드민 페이지 원본파일 비교 및 수정 기능 완성 계획

## 목표

Admin 클라이언트의 FileCompare 페이지에 **인라인 수정 기능**을 추가하여, 관리자가 PDF를 보면서 신청현황 데이터를 직접 수정할 수 있도록 개선.

## 배경 분석

### 현재 상태
- **Admin**: FileCompare 페이지 있음 (전체 화면 2분할) - **수정 기능 없음**
- **Client**: FileCompareModal 컴포넌트 있음 (모달 방식) - **인라인 수정 구현됨**

### 작업 범위
Client의 수정 로직을 Admin으로 이식하여 동일한 수정 기능 제공.

---

## 구현 계획

### Phase 1: 사전 준비 (5분)

#### lucide-react 패키지 설치
**현재 상태**: admin/package.json에 lucide-react 없음
**필요 작업**: 아이콘 라이브러리 설치

```bash
cd admin
npm install lucide-react
```

**사용할 아이콘**: `Save`, `Edit3`, `X`

---

### Phase 2: FileCompare.jsx 수정 (메인 작업)

**파일**: [admin/src/pages/FileCompare.jsx](admin/src/pages/FileCompare.jsx)

#### 2-1. Import 추가 (상단)

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi } from '../api/client';
import { Save, Edit3, X } from 'lucide-react';
```

#### 2-2. 컴포넌트 내부 - State 및 Mutation 추가

**위치**: 기존 state 선언 바로 아래

```javascript
const queryClient = useQueryClient();
const [editingId, setEditingId] = useState(null);
const [editData, setEditData] = useState({});

const updateMutation = useMutation({
  mutationFn: ({ id, data }) => applicationsApi.update(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['file-applications', id] });
    setEditingId(null);
    setEditData({});
  },
  onError: (error) => {
    const message = error.response?.data?.error || '수정 중 오류가 발생했습니다.';
    alert(`저장 실패: ${message}`);
  }
});
```

#### 2-3. 핸들러 함수 추가

**위치**: 필터링 로직 아래

```javascript
const handleEdit = (app) => {
  if (editingId && editingId !== app.ID) {
    if (!confirm('현재 수정 중인 내용이 있습니다. 저장하지 않고 다른 행을 수정하시겠습니까?')) {
      return;
    }
  }

  setEditingId(app.ID);
  setEditData({
    출자분야: app['출자분야'] || '',
    결성예정액: app['결성예정액'] || '',
    모태출자액: app['모태출자액'] || '',
    상태: app['상태'] || '',
    비고: app['비고'] || ''
  });
};

const handleSave = (id) => {
  if (!editData.상태) {
    alert('상태는 필수입니다.');
    return;
  }

  const 결성예정액 = editData.결성예정액 ? parseFloat(editData.결성예정액) : null;
  const 모태출자액 = editData.모태출자액 ? parseFloat(editData.모태출자액) : null;

  if (editData.결성예정액 && isNaN(결성예정액)) {
    alert('결성예정액은 숫자여야 합니다.');
    return;
  }

  if (editData.모태출자액 && isNaN(모태출자액)) {
    alert('모태출자액은 숫자여야 합니다.');
    return;
  }

  updateMutation.mutate({
    id,
    data: {
      출자분야: editData.출자분야,
      결성예정액,
      모태출자액,
      상태: editData.상태,
      비고: editData.비고
    }
  });
};

const handleCancel = () => {
  setEditingId(null);
  setEditData({});
};
```

#### 2-4. 테이블 구조 변경

**현재 위치**: 테이블 부분 (line 205-233)

**변경 내용**:
1. `<thead>`에 "수정" 열 추가
2. `<tbody>` 내 각 행을 조건부 렌더링으로 변경
3. 읽기 모드 / 수정 모드 분기 처리

**주요 변경점**:
- 운용사명: 읽기 전용 유지
- 출자분야, 결성예정액, 모태출자액, 상태, 비고: 수정 가능
- 마지막 열에 수정/저장/취소 버튼 추가

**수정 모드 UI**:
- 텍스트 입력: `<input type="text">`
- 숫자 입력: `<input type="number" step="0.1">`
- 상태 선택: `<select>` (접수/선정/탈락)
- 파란색 테두리 강조: `border-blue-500 ring-2 ring-blue-300`

**버튼**:
- 수정 버튼: 파란색 `Edit3` 아이콘
- 저장 버튼: 초록색 `Save` 아이콘
- 취소 버튼: 회색 `X` 아이콘

---

### Phase 3: API 확인

**파일**: [admin/src/api/client.js](admin/src/api/client.js)

**확인 결과**: `applicationsApi.update(id, data)` 메서드 이미 존재 (line 65)
**결론**: 추가 수정 불필요

---

## 주요 파일 및 참고 자료

### 수정 대상
- **[admin/src/pages/FileCompare.jsx](admin/src/pages/FileCompare.jsx)** - 메인 수정
- **[admin/package.json](admin/package.json)** - lucide-react 추가

### 참고용 (읽기 전용)
- **[client/src/components/FileCompareModal.jsx](client/src/components/FileCompareModal.jsx)** - 수정 로직 레퍼런스
- **[admin/src/api/client.js](admin/src/api/client.js)** - API 메서드 확인
- **[server/routes/applications.js](server/routes/applications.js)** - 백엔드 API 확인

---

## 데이터 흐름

```
1. 사용자 "수정" 버튼 클릭
   → handleEdit(app) 호출
   → editingId 설정, editData에 현재 값 복사

2. 입력 필드 변경
   → onChange 핸들러
   → setEditData({ ...editData, [필드]: 새값 })

3. "저장" 버튼 클릭
   → handleSave(id) 호출
   → 검증 (필수 필드, 타입 체크)
   → updateMutation.mutate({ id, data })
   → PUT /api/applications/:id 호출

4. API 응답 성공
   → onSuccess: queryClient.invalidateQueries()
   → React Query가 자동 refetch
   → UI 갱신 (최신 데이터 반영)
   → editingId, editData 초기화

5. API 응답 실패
   → onError: alert(에러 메시지)
   → 수정 모드 유지 (데이터 유실 방지)
```

---

## 검증 로직

### 필수 필드
- **상태**: 필수 (접수/선정/탈락 중 하나)

### 타입 검증
- **결성예정액, 모태출자액**: 숫자 또는 빈 값 (null 허용)
- **출자분야, 비고**: 문자열 (제한 없음)

### 에러 처리
- 검증 실패: `alert()` 메시지 표시
- API 실패: `onError` 핸들러에서 에러 메시지 표시

---

## 엣지 케이스 처리

1. **동시 수정 방지**: 한 번에 하나의 행만 수정 가능
2. **네트워크 에러**: 에러 메시지 표시, 수정 모드 유지
3. **빈 값 처리**: 빈 문자열 → `null`로 변환
4. **필터링 중 수정**: 수정 중인 행은 필터 적용 안 함 (선택사항)

---

## 구현 순서 (단계별 체크리스트)

### Step 1: 패키지 설치 (5분)
- [ ] `cd admin && npm install lucide-react`
- [ ] 개발 서버 재시작

### Step 2: Import 및 State 추가 (10분)
- [ ] Import 문 추가 (useMutation, applicationsApi, 아이콘)
- [ ] useState 추가 (editingId, editData)
- [ ] useMutation 정의 (updateMutation)
- [ ] useQueryClient 추가

### Step 3: 핸들러 함수 구현 (15분)
- [ ] handleEdit 구현
- [ ] handleSave 구현 (검증 포함)
- [ ] handleCancel 구현

### Step 4: 테이블 UI 변경 (45분)
- [ ] `<thead>`에 "수정" 열 추가
- [ ] 조건부 렌더링 구조 작성 (`editingId === app.ID`)
- [ ] 읽기 모드 UI (기존 유지)
- [ ] 수정 모드 UI (입력 필드)
- [ ] 버튼 추가 (수정/저장/취소)
- [ ] 스타일링 (TailwindCSS)

### Step 5: 테스트 (30분)
- [ ] 수정 버튼 클릭 → 입력 필드 전환 확인
- [ ] 데이터 입력 → onChange 동작 확인
- [ ] 저장 → API 호출 → DB 반영 확인
- [ ] 취소 → 읽기 모드 복귀 확인
- [ ] 검증 로직 테스트 (빈 상태, 잘못된 숫자)
- [ ] 에러 케이스 테스트

### Step 6: 최종 검토 (15분)
- [ ] UI/UX 미세 조정
- [ ] 브라우저 콘솔 에러 확인
- [ ] 다양한 시나리오 테스트
- [ ] 코드 정리 (주석, 불필요한 코드 제거)

**총 예상 시간**: 약 2시간

---

## 완료 기준

- [x] lucide-react 설치 완료
- [x] 테이블에 "수정" 열 및 버튼 추가
- [x] 인라인 편집 UI 구현 (입력 필드, 드롭다운)
- [x] 저장 시 API 호출 및 DB 반영 확인
- [x] 검증 로직 동작 (필수 필드, 타입 체크)
- [x] 에러 처리 (에러 메시지 표시)
- [x] 필터링/검색 기능 정상 동작 유지
- [x] 반응형 레이아웃 유지

---

## 향후 개선 사항 (선택사항)

- [ ] 일괄 상태 변경 (체크박스 선택 → 일괄 처리)
- [ ] 동기화 버튼 추가 (파일 현황 자동 업데이트)
- [ ] 낙관적 업데이트 (Optimistic Update)
- [ ] 토스트 알림 (성공/실패 메시지)
- [ ] 키보드 단축키 (Enter: 저장, Esc: 취소)
