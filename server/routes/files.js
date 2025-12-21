import { Router } from 'express';
import { getSheetsClient } from '../services/sheets.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 파일 목록 조회
router.get('/', asyncHandler(async (req, res) => {
  const { 처리상태, 파일유형, search, page = 1, limit = 50 } = req.query;
  const sheets = await getSheetsClient();

  let files = await sheets.getAllRows('파일');

  // 필터링
  if (처리상태) {
    files = files.filter(f => f['처리상태'] === 처리상태);
  }
  if (파일유형) {
    files = files.filter(f => f['파일유형'] === 파일유형);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    files = files.filter(f =>
      f['파일명']?.toLowerCase().includes(searchLower) ||
      f['파일번호']?.includes(search)
    );
  }

  // 페이지네이션
  const total = files.length;
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginated = files.slice(startIndex, endIndex);

  res.json({
    data: paginated,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
}));

// 파일과 연결된 신청현황 조회 (비교용) - /:id 보다 먼저 정의해야 함
router.get('/:id/applications', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const file = await sheets.findById('파일', id);
  if (!file) {
    const error = new Error(`파일을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 이 파일이 연결된 출자사업 찾기
  const projects = await sheets.getAllRows('출자사업');
  const linkedProjects = [];

  for (const project of projects) {
    const supportFileIds = (project['지원파일ID'] || '').split(',').map(s => s.trim());
    const resultFileIds = (project['결과파일ID'] || '').split(',').map(s => s.trim());

    if (supportFileIds.includes(id) || resultFileIds.includes(id)) {
      linkedProjects.push({
        id: project['ID'],
        name: project['사업명'],
        linkType: supportFileIds.includes(id) ? '접수현황' : '선정결과'
      });
    }
  }

  if (linkedProjects.length === 0) {
    return res.json({
      data: {
        file,
        linkedProjects: [],
        applications: [],
        stats: { total: 0, 선정: 0, 탈락: 0, 접수: 0 }
      }
    });
  }

  // 연결된 출자사업들의 신청현황 조회
  const allApplications = await sheets.getAllRows('신청현황');
  const linkedProjectIds = linkedProjects.map(p => p.id);
  const applications = allApplications.filter(app =>
    linkedProjectIds.includes(app['출자사업ID'])
  );

  // 운용사 정보 조인
  const operators = await sheets.getAllOperators();
  const operatorMap = new Map(operators.map(op => [op['ID'], op]));

  const enrichedApplications = applications.map(app => ({
    ...app,
    운용사명: operatorMap.get(app['운용사ID'])?.['운용사명'] || app['운용사ID'],
    출자사업명: linkedProjects.find(p => p.id === app['출자사업ID'])?.name || ''
  }));

  // 통계 계산
  const stats = {
    total: applications.length,
    선정: applications.filter(app => app['상태'] === '선정').length,
    탈락: applications.filter(app => app['상태'] === '탈락').length,
    접수: applications.filter(app => app['상태'] === '접수').length
  };

  res.json({
    data: {
      file,
      linkedProjects,
      applications: enrichedApplications,
      stats
    }
  });
}));

// 파일 상세 조회
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const file = await sheets.findById('파일', id);
  if (!file) {
    const error = new Error(`파일을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  res.json({ data: file });
}));

// 파일 수정
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 파일유형, 처리상태, 비고, 현황 } = req.body;
  const sheets = await getSheetsClient();

  const existing = await sheets.findById('파일', id);
  if (!existing) {
    const error = new Error(`파일을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  await sheets.updateFileHistory(id, { 파일유형, 처리상태, 비고, 현황 });

  const updated = await sheets.findById('파일', id);
  res.json({ data: updated });
}));

// 파일 현황 동기화
router.post('/:id/sync-status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const result = await sheets.syncFileStatusWithApplications(id);

  if (!result) {
    return res.status(400).json({ error: '동기화 대상이 아닙니다.' });
  }

  res.json({ data: result });
}));

export default router;
