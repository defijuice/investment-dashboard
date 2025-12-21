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

  // 열 순서: A:ID, B:출자사업ID, C:운용사ID, D:출자분야, E:결성예정액, F:출자요청액, G:최소결성규모, H:통화단위, I:상태, J:비고
  if (출자사업ID !== undefined) {
    await sheets.setValues(`신청현황!B${rowIndex}`, [[출자사업ID]]);
  }
  if (운용사ID !== undefined) {
    await sheets.setValues(`신청현황!C${rowIndex}`, [[운용사ID]]);
  }
  if (출자분야 !== undefined) {
    await sheets.setValues(`신청현황!D${rowIndex}`, [[출자분야]]);
  }
  if (결성예정액 !== undefined) {
    await sheets.setValues(`신청현황!E${rowIndex}`, [[결성예정액]]);
  }
  if (출자요청액 !== undefined) {
    await sheets.setValues(`신청현황!F${rowIndex}`, [[출자요청액]]);
  }
  if (최소결성규모 !== undefined) {
    await sheets.setValues(`신청현황!G${rowIndex}`, [[최소결성규모]]);
  }
  if (통화단위 !== undefined) {
    await sheets.setValues(`신청현황!H${rowIndex}`, [[통화단위]]);
  }
  if (상태 !== undefined) {
    await sheets.setValues(`신청현황!I${rowIndex}`, [[상태]]);
  }
  if (비고 !== undefined) {
    await sheets.setValues(`신청현황!J${rowIndex}`, [[비고]]);
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

export default router;
