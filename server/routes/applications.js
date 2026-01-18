import { Router } from 'express';
import { getSheetsClient } from '../services/sheets.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 신청현황 목록 조회
router.get('/', asyncHandler(async (req, res) => {
  const { projectId, operatorId, status, search, page = 1, limit = 100 } = req.query;
  const sheets = await getSheetsClient();

  let applications = await sheets.getAllRows('신청현황');

  // 빈 행 필터링
  applications = applications.filter(app => app['ID'] && app['출자사업ID']);

  // 필터링
  if (projectId) {
    applications = applications.filter(app => app['출자사업ID'] === projectId);
  }
  if (operatorId) {
    applications = applications.filter(app => app['운용사ID'] === operatorId);
  }
  if (status) {
    applications = applications.filter(app => app['상태'] === status);
  }

  // 운용사 정보 조인
  const operators = await sheets.getAllOperators();
  const operatorMap = new Map(operators.map(op => [op['ID'], op]));

  // 출자사업 정보 조인
  const projects = await sheets.getAllRows('출자사업');
  const projectMap = new Map(projects.map(pj => [pj['ID'], pj]));

  // 조인된 데이터
  const enrichedApplications = applications.map(app => ({
    ...app,
    운용사명: operatorMap.get(app['운용사ID'])?.['운용사명'] || '',
    사업명: projectMap.get(app['출자사업ID'])?.['사업명'] || ''
  }));

  // 검색 필터링 (운용사명, 사업명)
  let filtered = enrichedApplications;
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = enrichedApplications.filter(app =>
      app['운용사명']?.toLowerCase().includes(searchLower) ||
      app['사업명']?.toLowerCase().includes(searchLower) ||
      app['출자분야']?.toLowerCase().includes(searchLower)
    );
  }

  // 페이지네이션
  const total = filtered.length;
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginated = filtered.slice(startIndex, endIndex);

  res.json({
    data: paginated,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
}));

// 신청현황 상세 조회
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const application = await sheets.findById('신청현황', id);
  if (!application) {
    const error = new Error(`신청현황을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 관련 정보 조인
  const operator = await sheets.findById('운용사', application['운용사ID']);
  const project = await sheets.findById('출자사업', application['출자사업ID']);

  res.json({
    data: application,
    operator,
    project
  });
}));

// 신청현황 수기 등록
router.post('/', asyncHandler(async (req, res) => {
  const {
    출자사업ID,
    운용사ID,
    출자분야,
    결성예정액,
    출자요청액,
    최소결성규모,
    통화단위,
    상태,
    비고
  } = req.body;

  if (!출자사업ID || !운용사ID) {
    return res.status(400).json({ error: '출자사업ID와 운용사ID는 필수입니다.' });
  }

  const sheets = await getSheetsClient();

  // 중복 체크
  const existingApps = await sheets.getExistingApplications(출자사업ID);
  const key = `${운용사ID}|${출자분야 || ''}`;
  if (existingApps.has(key)) {
    return res.status(409).json({
      error: '이미 동일한 신청현황이 존재합니다.',
      existing: existingApps.get(key)
    });
  }

  const newId = await sheets.createApplication({
    출자사업ID,
    운용사ID,
    출자분야,
    결성예정액,
    출자요청액,
    최소결성규모,
    통화단위,
    상태: 상태 || '접수',
    비고: 비고 ? `수기입력 - ${비고}` : '수기입력'
  });

  const created = await sheets.findById('신청현황', newId);
  res.status(201).json({ data: created, id: newId });
}));

// 신청현황 수정
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    출자사업ID,
    운용사ID,
    출자분야,
    결성예정액,
    모태출자액,
    출자요청액,
    최소결성규모,
    통화단위,
    상태,
    비고
  } = req.body;

  const sheets = await getSheetsClient();

  const existing = await sheets.findById('신청현황', id);
  if (!existing) {
    const error = new Error(`신청현황을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  const rowIndex = existing._rowIndex;

  // 열 순서: A:ID, B:출자사업ID, C:운용사ID, D:출자분야, E:최소결성규모, F:모태출자액, G:결성예정액, H:출자요청액, I:통화단위, J:상태, K:비고
  if (출자사업ID !== undefined) {
    await sheets.setValues(`신청현황!B${rowIndex}`, [[출자사업ID]]);
  }
  if (운용사ID !== undefined) {
    await sheets.setValues(`신청현황!C${rowIndex}`, [[운용사ID]]);
  }
  if (출자분야 !== undefined) {
    await sheets.setValues(`신청현황!D${rowIndex}`, [[출자분야]]);
  }
  if (최소결성규모 !== undefined) {
    await sheets.setValues(`신청현황!E${rowIndex}`, [[최소결성규모]]);
  }
  if (모태출자액 !== undefined) {
    await sheets.setValues(`신청현황!F${rowIndex}`, [[모태출자액]]);
  }
  if (결성예정액 !== undefined) {
    await sheets.setValues(`신청현황!G${rowIndex}`, [[결성예정액]]);
  }
  if (출자요청액 !== undefined) {
    await sheets.setValues(`신청현황!H${rowIndex}`, [[출자요청액]]);
  }
  if (통화단위 !== undefined) {
    await sheets.setValues(`신청현황!I${rowIndex}`, [[통화단위]]);
  }
  if (상태 !== undefined) {
    await sheets.setValues(`신청현황!J${rowIndex}`, [[상태]]);
  }
  if (비고 !== undefined) {
    await sheets.setValues(`신청현황!K${rowIndex}`, [[비고]]);
  }

  const updated = await sheets.findById('신청현황', id);
  res.json({ data: updated });
}));

// 일괄 상태 변경
router.put('/batch/status', asyncHandler(async (req, res) => {
  const { ids, status } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids 배열이 필요합니다.' });
  }
  if (!status || !['선정', '탈락', '접수'].includes(status)) {
    return res.status(400).json({ error: "status는 '선정', '탈락', '접수' 중 하나여야 합니다." });
  }

  const sheets = await getSheetsClient();
  let updated = 0;

  for (const id of ids) {
    try {
      await sheets.updateApplicationStatus(id, status);
      updated++;
    } catch (err) {
      console.error(`Failed to update ${id}:`, err.message);
    }
  }

  res.json({ updated, total: ids.length });
}));

// 신청현황 삭제
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const existing = await sheets.findById('신청현황', id);
  if (!existing) {
    const error = new Error(`신청현황을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  await sheets.deleteRow('신청현황', existing._rowIndex);
  res.json({ success: true, id });
}));

// 고급 검색 (Advanced Filter)
router.get('/search/advanced', asyncHandler(async (req, res) => {
  const {
    gpType,       // 'sole' | 'coGP' | 'all'
    years,        // 1, 3, 5, 또는 'all'
    category,     // 출자분야 (바이오, ICT 등)
    institution,  // 소관 기관 (중기부, 문체부 등)
    status,       // 선정, 탈락, 접수
    search,       // 운용사명/사업명 검색
    page = 1,
    limit = 100
  } = req.query;

  const sheets = await getSheetsClient();

  const [applications, operators, projects] = await Promise.all([
    sheets.getAllRows('신청현황'),
    sheets.getAllOperators(),
    sheets.getAllRows('출자사업')
  ]);

  const operatorMap = new Map(operators.map(op => [op['ID'], op]));
  const projectMap = new Map(projects.map(p => [p['ID'], p]));

  // 기간 필터 계산
  const currentYear = new Date().getFullYear();
  let startYear = 0;
  if (years && years !== 'all') {
    startYear = currentYear - parseInt(years);
  }

  // 필터링
  let filtered = applications.filter(app => {
    const project = projectMap.get(app['출자사업ID']);
    const projectYear = parseInt(project?.['연도']) || 0;

    // 기간 필터
    if (startYear > 0 && projectYear < startYear) return false;

    // GP 형태 필터
    if (gpType && gpType !== 'all') {
      const isCoGP = app['비고']?.includes('공동GP');
      if (gpType === 'sole' && isCoGP) return false;
      if (gpType === 'coGP' && !isCoGP) return false;
    }

    // 분야 필터
    if (category) {
      if (!app['출자분야']?.includes(category)) return false;
    }

    // 기관(소관) 필터
    if (institution) {
      if (project?.['소관'] !== institution) return false;
    }

    // 상태 필터
    if (status) {
      if (app['상태'] !== status) return false;
    }

    return true;
  });

  // 조인된 데이터
  const enriched = filtered.map(app => {
    const operator = operatorMap.get(app['운용사ID']);
    const project = projectMap.get(app['출자사업ID']);
    return {
      ...app,
      운용사명: operator?.['운용사명'] || '',
      사업명: project?.['사업명'] || '',
      소관: project?.['소관'] || '',
      연도: project?.['연도'] || '',
      isCoGP: app['비고']?.includes('공동GP') || false
    };
  });

  // 텍스트 검색 (운용사 약어도 포함)
  let results = enriched;
  if (search) {
    const searchLower = search.toLowerCase();
    results = enriched.filter(app => {
      const operator = operatorMap.get(app['운용사ID']);
      return (
        app['운용사명']?.toLowerCase().includes(searchLower) ||
        app['사업명']?.toLowerCase().includes(searchLower) ||
        app['출자분야']?.toLowerCase().includes(searchLower) ||
        operator?.['약어']?.toLowerCase().includes(searchLower)
      );
    });
  }

  // 통계 집계
  const stats = {
    total: results.length,
    selected: results.filter(r => r['상태'] === '선정').length,
    rejected: results.filter(r => r['상태'] === '탈락').length,
    pending: results.filter(r => r['상태'] === '접수').length,
    coGP: results.filter(r => r.isCoGP).length,
    sole: results.filter(r => !r.isCoGP).length
  };

  // 최신순 정렬 (연도 내림차순 → ID 내림차순)
  results.sort((a, b) => {
    // 1차: 연도 내림차순
    const yearA = parseInt(a['연도']) || 0;
    const yearB = parseInt(b['연도']) || 0;
    if (yearB !== yearA) return yearB - yearA;

    // 2차: 출자사업ID 내림차순 (PJ0100 > PJ0001)
    const pjA = parseInt(a['출자사업ID']?.replace('PJ', '')) || 0;
    const pjB = parseInt(b['출자사업ID']?.replace('PJ', '')) || 0;
    if (pjB !== pjA) return pjB - pjA;

    // 3차: 신청현황ID 내림차순
    const apA = parseInt(a['ID']?.replace('AP', '')) || 0;
    const apB = parseInt(b['ID']?.replace('AP', '')) || 0;
    return apB - apA;
  });

  // 출자사업별 그룹핑
  const groupedByProject = new Map();
  for (const app of results) {
    const projectId = app['출자사업ID'];
    if (!groupedByProject.has(projectId)) {
      const project = projectMap.get(projectId);
      groupedByProject.set(projectId, {
        projectId,
        projectName: project?.['사업명'] || '',
        소관: project?.['소관'] || '',
        연도: project?.['연도'] || '',
        applications: []
      });
    }
    groupedByProject.get(projectId).applications.push(app);
  }

  // 각 그룹 내 applications 정렬: 선정 우선 → 금액 큰 순
  for (const group of groupedByProject.values()) {
    group.applications.sort((a, b) => {
      // 1차: 상태 (선정 > 접수 > 탈락)
      const statusOrder = { '선정': 0, '접수': 1, '탈락': 2 };
      const statusA = statusOrder[a['상태']] ?? 3;
      const statusB = statusOrder[b['상태']] ?? 3;
      if (statusA !== statusB) return statusA - statusB;

      // 2차: 금액 큰 순 (최소결성규모 또는 결성예정액)
      const amountA = parseFloat(a['최소결성규모']) || parseFloat(a['결성예정액']) || 0;
      const amountB = parseFloat(b['최소결성규모']) || parseFloat(b['결성예정액']) || 0;
      return amountB - amountA;
    });
  }

  // 그룹 배열로 변환 (이미 정렬된 순서 유지)
  const grouped = [...groupedByProject.values()];

  // 페이지네이션 (그룹 단위)
  const totalGroups = grouped.length;
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedGroups = grouped.slice(startIndex, endIndex);

  res.json({
    data: results.slice(0, 500), // flat 데이터도 제공 (하위 호환)
    grouped: paginatedGroups,
    stats,
    total: results.length,
    totalGroups,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(totalGroups / parseInt(limit)),
    filters: { gpType, years, category, institution, status, search }
  });
}));

// 필터 옵션 목록 조회 (분야, 기관 등)
router.get('/search/options', asyncHandler(async (req, res) => {
  const sheets = await getSheetsClient();

  const [applications, projects] = await Promise.all([
    sheets.getAllRows('신청현황'),
    sheets.getAllRows('출자사업')
  ]);

  // 출자분야 목록
  const categories = [...new Set(applications.map(a => a['출자분야']).filter(Boolean))].sort();

  // 소관(기관) 목록
  const institutions = [...new Set(projects.map(p => p['소관']).filter(Boolean))].sort();

  // 연도 목록
  const years = [...new Set(projects.map(p => p['연도']).filter(Boolean))].sort((a, b) => b - a);

  res.json({
    categories,
    institutions,
    years,
    gpTypes: [
      { value: 'all', label: '전체' },
      { value: 'sole', label: '단독 GP' },
      { value: 'coGP', label: '공동 GP' }
    ],
    statuses: ['선정', '탈락', '접수'],
    periodOptions: [
      { value: '1', label: '최근 1년' },
      { value: '3', label: '최근 3년' },
      { value: '5', label: '최근 5년' },
      { value: 'all', label: '전체 기간' }
    ]
  });
}));

// 탈락 정보 수기 등록 (승률 계산 정확도 향상)
router.post('/manual/rejected', asyncHandler(async (req, res) => {
  const { 출자사업ID, 운용사명, 출자분야, 비고 } = req.body;

  if (!출자사업ID || !운용사명) {
    return res.status(400).json({ error: '출자사업ID와 운용사명은 필수입니다.' });
  }

  const sheets = await getSheetsClient();

  // 운용사 조회 또는 생성
  const operatorResult = await sheets.getOrCreateOperator(운용사명);
  const 운용사ID = operatorResult.id;

  // 중복 체크
  const existingApps = await sheets.getExistingApplications(출자사업ID);
  const key = `${운용사ID}|${출자분야 || ''}`;
  if (existingApps.has(key)) {
    return res.status(409).json({
      error: '이미 동일한 신청현황이 존재합니다.',
      existing: existingApps.get(key)
    });
  }

  // 탈락 상태로 등록
  const newId = await sheets.createApplication({
    출자사업ID,
    운용사ID,
    출자분야: 출자분야 || '',
    상태: '탈락',
    비고: `수기입력(탈락) - ${비고 || '업계정보'}`
  });

  const created = await sheets.findById('신청현황', newId);
  res.status(201).json({
    data: created,
    id: newId,
    operator: { id: 운용사ID, name: 운용사명, isNew: operatorResult.isNew }
  });
}));

export default router;
