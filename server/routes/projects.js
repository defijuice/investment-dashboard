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

  // 출자사업, 신청현황 동시 조회 (경쟁률 시트 대신 신청현황에서 직접 계산)
  const [allProjects, allApplications] = await Promise.all([
    sheets.getAllRows('출자사업'),
    sheets.getAllRows('신청현황')
  ]);

  // 신청현황에서 출자사업별 통계 집계 (경쟁률, 출자분야, 모태출자비율)
  const projectStats = new Map();
  for (const app of allApplications) {
    const projectId = app['출자사업ID'];
    if (!projectId) continue;

    if (!projectStats.has(projectId)) {
      projectStats.set(projectId, {
        total: 0,           // 총 지원 건수
        selected: 0,        // 선정 건수
        categories: new Set(),
        totalFundSize: 0,
        totalMotaeAmount: 0
      });
    }

    const stats = projectStats.get(projectId);
    stats.total++;

    // 출자분야 집계
    if (app['출자분야']) {
      stats.categories.add(app['출자분야']);
    }

    // 선정된 것만 모태출자비율 집계
    if (app['상태'] === '선정') {
      stats.selected++;
      stats.totalFundSize += parseFloat(app['결성예정액']) || parseFloat(app['최소결성규모']) || 0;
      stats.totalMotaeAmount += parseFloat(app['모태출자액']) || 0;
    }
  }

  // 빈 행 필터링 후 경쟁률, 출자분야, 모태출자비율 추가
  let projects = allProjects
    .filter(p => p['ID'] && p['사업명'])  // 빈 행 제외
    .map(p => {
    const stats = projectStats.get(p['ID']);

    // 경쟁률 계산 (선정 건수가 있어야 계산 가능)
    let competitionRate = null;
    if (stats && stats.selected > 0) {
      competitionRate = (stats.total / stats.selected).toFixed(2);
    }

    // 모태출자비율 계산
    let motaeRatio = null;
    if (stats && stats.totalFundSize > 0) {
      motaeRatio = Math.round(stats.totalMotaeAmount / stats.totalFundSize * 100);
    }

    return {
      ...p,
      경쟁률: competitionRate,
      지원건수: stats?.total || 0,
      선정건수: stats?.selected || 0,
      출자분야목록: stats ? [...stats.categories].sort() : [],
      motaeRatio,
      모태출자총액: stats?.totalMotaeAmount || 0
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
