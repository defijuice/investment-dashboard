# 관리자 페이지 구현 계획

## 요구사항 요약

- **데이터 검증** (우선순위 높음): 크롤링된 데이터 원본 대조 및 수정
- **수기 등록**: 비공개 정보 직접 입력
- **인증**: 간단한 비밀번호 + JWT
- **배포**: 클라우드 (Railway/Vercel)

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| 백엔드 | Express.js |
| 프론트엔드 | React + Vite + Tailwind CSS |
| 상태관리 | React Query |
| 인증 | JWT (jsonwebtoken) |
| 배포 | Railway (백엔드) + Vercel (프론트) |

---

## 폴더 구조

```
investment-dashboard/
├── src/                          # 기존 CLI 모듈 (재사용)
│   ├── googleSheets.js           # 서버에서 import
│   └── operator-matcher.js       # 유사도 검사 재사용
├── server/                       # Express 백엔드 (신규)
│   ├── index.js                  # 서버 진입점
│   ├── config.js                 # 환경변수 로드
│   ├── middleware/
│   │   ├── auth.js               # JWT 인증
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js               # POST /api/auth/login
│   │   ├── operators.js          # CRUD /api/operators
│   │   ├── projects.js           # CRUD /api/projects
│   │   ├── applications.js       # CRUD /api/applications
│   │   └── files.js              # CRUD /api/files
│   └── services/
│       └── sheets.js             # GoogleSheetsClient 래퍼
├── admin/                        # React 프론트엔드 (신규)
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── api/client.js         # axios 인스턴스
│   │   ├── hooks/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── DataTable.jsx
│   │   │   └── EditableCell.jsx
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Applications.jsx  # 데이터 검증 메인
│   │       ├── Operators.jsx
│   │       └── ManualEntry.jsx   # 수기 등록
│   └── package.json
└── .env                          # 환경변수 추가
```

---

## 환경변수 추가

```bash
# .env에 추가
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret-key
PORT=3001
CORS_ORIGIN=http://localhost:5173

# 클라우드 배포용 (서비스 계정)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

---

## API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인 (비밀번호 → JWT 반환)
- `GET /api/auth/verify` - 토큰 검증

### 운용사
- `GET /api/operators` - 목록 (검색, 페이징)
- `GET /api/operators/:id` - 상세
- `POST /api/operators` - 생성
- `PUT /api/operators/:id` - 수정
- `POST /api/operators/check-similar` - 유사도 검사

### 출자사업
- `GET /api/projects` - 목록 (필터: 연도, 소관)
- `GET /api/projects/:id` - 상세 (신청현황 포함)
- `PUT /api/projects/:id` - 수정

### 신청현황
- `GET /api/applications` - 목록 (필터: 프로젝트, 운용사, 상태)
- `POST /api/applications` - 수기 등록
- `PUT /api/applications/:id` - 수정
- `PUT /api/applications/batch-status` - 일괄 상태 변경

### 파일
- `GET /api/files` - 목록
- `PUT /api/files/:id` - 상태 수정

---

## 핵심 UI 화면

### 신청현황 검증 페이지 (Applications.jsx)

```
+------------------------------------------------------------------+
| 필터: [출자사업 v] [운용사 검색] [상태: 전체 v] [검색] [초기화]  |
+------------------------------------------------------------------+
| 액션: [선택 N건] [일괄 선정] [일괄 탈락]        [+ 수기 등록]    |
+------------------------------------------------------------------+
| □ | ID     | 운용사        | 출자사업   | 분야      | 상태 | 편집|
| □ | AP0001 | A인베스트먼트 | 중기부1차  | 중진-루키 | 선정 |  ✎ |
+------------------------------------------------------------------+
| < 1 2 3 ... 10 >                                    총 1,234건   |
+------------------------------------------------------------------+
```

**기능**:
- 인라인 편집 (셀 클릭 → 수정 → Enter로 저장)
- 체크박스 선택 → 일괄 상태 변경
- 운용사명 수정 시 자동완성 + 유사도 경고

### 수기 등록 모달

- 출자사업 드롭다운 (검색 가능)
- 운용사 자동완성 (유사 운용사 경고)
- 출자분야/금액/상태 입력
- 비고에 "수기입력" 자동 표시

---

## 구현 순서

### Step 1: Express 서버 기초
- [ ] `server/index.js` - Express 앱 설정
- [ ] `server/services/sheets.js` - GoogleSheetsClient 래퍼
- [ ] `server/middleware/auth.js` - JWT 인증
- [ ] `server/routes/auth.js` - 로그인 API

### Step 2: CRUD API
- [ ] `server/routes/operators.js` - 운용사 CRUD
- [ ] `server/routes/projects.js` - 출자사업 CRUD
- [ ] `server/routes/applications.js` - 신청현황 CRUD
- [ ] `server/routes/files.js` - 파일 CRUD

### Step 3: React 프로젝트 초기화
- [ ] Vite + React 설정
- [ ] Tailwind CSS 설정
- [ ] React Query 설정
- [ ] 라우팅 (react-router-dom)

### Step 4: 공통 컴포넌트
- [ ] Layout (Header, Sidebar)
- [ ] DataTable (정렬, 페이징, 선택)
- [ ] EditableCell (인라인 편집)

### Step 5: 페이지 구현
- [ ] Login.jsx - 로그인 폼
- [ ] Dashboard.jsx - 통계 요약
- [ ] Applications.jsx - 데이터 검증 (핵심)
- [ ] ManualEntry.jsx - 수기 등록 모달

### Step 6: 배포 설정
- [ ] 서비스 계정 생성 및 권한 부여
- [ ] Railway 배포 설정
- [ ] Vercel 프론트엔드 배포
- [ ] 환경변수 설정

---

## 수정/생성할 파일 목록

### 신규 생성
- `server/index.js`
- `server/config.js`
- `server/middleware/auth.js`
- `server/middleware/errorHandler.js`
- `server/services/sheets.js`
- `server/routes/auth.js`
- `server/routes/operators.js`
- `server/routes/projects.js`
- `server/routes/applications.js`
- `server/routes/files.js`
- `admin/` 전체 (Vite 프로젝트)

### 수정
- `package.json` - scripts, dependencies 추가
- `.env` - 환경변수 추가
- `.gitignore` - admin/node_modules 등 추가

### 참조 (재사용)
- [src/googleSheets.js](src/googleSheets.js) - CRUD 메서드
- [src/operator-matcher.js](src/operator-matcher.js) - 유사도 검사
- [src/setup-sheets.js](src/setup-sheets.js) - 드롭다운 옵션 값
