import { Router } from 'express';
import { getSheetsClient } from '../services/sheets.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 출자사업 목록 조회
router.get('/', asyncHandler(async (req, res) => {
  const { year, 소관, 공고유형, search, page = 1, limit = 50 } = req.query;
  const sheets = await getSheetsClient();

  // 출자사업, 경쟁률, 신청현황 동시 조회
  const [allProjects, competitionRates, allApplications] = await Promise.all([
    sheets.getAllRows('출자사업'),
    sheets.getAllRows('경쟁률'),
    sheets.getAllRows('신청현황')
  ]);

  // 출자사업별 경쟁률 집계
  const ratesByProject = new Map();
  for (const rate of competitionRates) {
    const projectId = rate['출자사업ID'];
    if (!ratesByProject.has(projectId)) {
      ratesByProject.set(projectId, { 선정합계: 0, 지원합계: 0 });
    }
    const stats = ratesByProject.get(projectId);
    stats.선정합계 += parseInt(rate['선정펀드수']) || 0;
    stats.지원합계 += parseInt(rate['지원펀드수']) || 0;
  }

  // 출자사업별 출자분야 집계 (신청현황에서)
  const categoriesByProject = new Map();
  for (const app of allApplications) {
    const projectId = app['출자사업ID'];
    if (!categoriesByProject.has(projectId)) {
      categoriesByProject.set(projectId, new Set());
    }
    if (app['출자분야']) {
      categoriesByProject.get(projectId).add(app['출자분야']);
    }
  }

  // 경쟁률 및 출자분야 추가
  let projects = allProjects.map(p => {
    const rates = ratesByProject.get(p['ID']);
    const categories = categoriesByProject.get(p['ID']);
    return {
      ...p,
      경쟁률: rates ? `${rates.선정합계}:${rates.지원합계}` : null,
      출자분야목록: categories ? [...categories].sort() : []
    };
  });

  // 필터링
  if (year) {
    projects = projects.filter(p => p['연도'] === year);
  }
  if (소관) {
    projects = projects.filter(p => p['소관'] === 소관);
  }
  if (공고유형) {
    projects = projects.filter(p => p['공고유형'] === 공고유형);
  }
  if (search) {
    const searchLower = search.toLowerCase();
    projects = projects.filter(p =>
      p['사업명']?.toLowerCase().includes(searchLower) ||
      p['출자분야목록']?.some(cat => cat.toLowerCase().includes(searchLower))
    );
  }

  // 페이지네이션
  const total = projects.length;
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginated = projects.slice(startIndex, endIndex);

  res.json({
    data: paginated,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
}));

// 출자사업 상세 조회 (신청현황 포함)
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const project = await sheets.findById('출자사업', id);
  if (!project) {
    const error = new Error(`출자사업을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 해당 사업의 신청현황 조회
  const allApplications = await sheets.getAllRows('신청현황');
  const applications = allApplications.filter(app => app['출자사업ID'] === id);

  res.json({
    data: project,
    applications
  });
}));

// 출자사업 상세 조회 (운용사명 포함, 파일 정보 포함)
router.get('/:id/detail', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const project = await sheets.findById('출자사업', id);
  if (!project) {
    const error = new Error(`출자사업을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 해당 사업의 신청현황, 운용사, 파일, 경쟁률 조회
  const [allApplications, operators, files, allCompetitionRates] = await Promise.all([
    sheets.getAllRows('신청현황'),
    sheets.getAllOperators(),
    sheets.getAllRows('파일'),
    sheets.getAllRows('경쟁률')
  ]);

  const applications = allApplications.filter(app => app['출자사업ID'] === id);
  const operatorMap = new Map(operators.map(op => [op['ID'], op]));
  const fileMap = new Map(files.map(f => [f['ID'], f]));

  // 운용사명 조인
  const enrichedApplications = applications.map(app => ({
    ...app,
    운용사명: operatorMap.get(app['운용사ID'])?.['운용사명'] || app['운용사ID']
  }));

  // 연결된 파일 정보
  const parseFileIds = (fileIdString) => {
    if (!fileIdString) return [];
    return fileIdString.split(',').map(id => id.trim()).filter(Boolean);
  };

  const supportFileIds = parseFileIds(project['지원파일ID']);
  const resultFileIds = parseFileIds(project['결과파일ID']);

  const linkedFiles = {
    support: supportFileIds.map(fid => fileMap.get(fid)).filter(Boolean),
    result: resultFileIds.map(fid => fileMap.get(fid)).filter(Boolean)
  };

  // 해당 출자사업의 분야별 경쟁률
  const competitionRates = allCompetitionRates.filter(r => r['출자사업ID'] === id);

  res.json({
    data: project,
    applications: enrichedApplications,
    linkedFiles,
    competitionRates
  });
}));

// 출자사업 생성
router.post('/', asyncHandler(async (req, res) => {
  const { 사업명, 소관, 공고유형, 연도, 차수 } = req.body;

  if (!사업명) {
    return res.status(400).json({ error: '사업명은 필수입니다.' });
  }

  const sheets = await getSheetsClient();
  const result = await sheets.getOrCreateProject(사업명, { 소관, 공고유형, 연도, 차수 });

  res.status(result.isNew ? 201 : 200).json({
    data: result.data,
    isNew: result.isNew,
    id: result.id
  });
}));

// 출자사업 수정
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 사업명, 소관, 공고유형, 연도, 차수, 비고 } = req.body;
  const sheets = await getSheetsClient();

  const existing = await sheets.findById('출자사업', id);
  if (!existing) {
    const error = new Error(`출자사업을 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  const rowIndex = existing._rowIndex;

  // 열 순서: A:ID, B:사업명, C:소관, D:공고유형, E:연도, F:차수
  if (사업명 !== undefined) {
    await sheets.setValues(`출자사업!B${rowIndex}`, [[사업명]]);
  }
  if (소관 !== undefined) {
    await sheets.setValues(`출자사업!C${rowIndex}`, [[소관]]);
  }
  if (공고유형 !== undefined) {
    await sheets.setValues(`출자사업!D${rowIndex}`, [[공고유형]]);
  }
  if (연도 !== undefined) {
    await sheets.setValues(`출자사업!E${rowIndex}`, [[연도]]);
  }
  if (차수 !== undefined) {
    await sheets.setValues(`출자사업!F${rowIndex}`, [[차수]]);
  }
  if (비고 !== undefined) {
    await sheets.setValues(`출자사업!J${rowIndex}`, [[비고]]);
  }

  const updated = await sheets.findById('출자사업', id);
  res.json({ data: updated });
}));

// 파일 연결
router.put('/:id/link-file', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fileType, fileId } = req.body;

  if (!fileType || !fileId) {
    return res.status(400).json({ error: 'fileType과 fileId가 필요합니다.' });
  }

  if (!['접수현황', '선정결과'].includes(fileType)) {
    return res.status(400).json({ error: "fileType은 '접수현황' 또는 '선정결과'여야 합니다." });
  }

  const sheets = await getSheetsClient();
  await sheets.updateProjectFileId(id, fileType, fileId);

  const updated = await sheets.findById('출자사업', id);
  res.json({ data: updated });
}));

// 현황 업데이트
router.post('/:id/update-status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const stats = await sheets.updateProjectStatus(id);
  const updated = await sheets.findById('출자사업', id);

  res.json({ data: updated, stats });
}));

export default router;
