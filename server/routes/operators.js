import { Router } from 'express';
import { getSheetsClient } from '../services/sheets.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// 모든 라우트에 인증 적용
router.use(authMiddleware);

// 운용사 목록 조회 (최근 5년 통계 포함)
router.get('/', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const sheets = await getSheetsClient();
  let operators = await sheets.getAllOperators();

  // 빈 행 필터링
  operators = operators.filter(op => op['ID'] && op['운용사명']);

  // 검색 필터링
  if (search) {
    const searchLower = search.toLowerCase();
    operators = operators.filter(op =>
      op['운용사명']?.toLowerCase().includes(searchLower) ||
      op['약어']?.toLowerCase().includes(searchLower)
    );
  }

  // 페이지네이션
  const total = operators.length;
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginated = operators.slice(startIndex, endIndex);

  // 최근 5년 통계 계산
  const [applications, projects] = await Promise.all([
    sheets.getAllRows('신청현황'),
    sheets.getAllRows('출자사업')
  ]);

  const projectMap = new Map(projects.map(p => [p['ID'], p]));
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;

  // 운용사별 통계 계산
  const operatorStats = new Map();
  for (const app of applications) {
    const project = projectMap.get(app['출자사업ID']);
    const year = parseInt(project?.['연도']) || 0;
    if (year < startYear) continue;

    const opId = app['운용사ID'];
    if (!operatorStats.has(opId)) {
      operatorStats.set(opId, { totalAUM: 0, selected: 0, confirmed: 0 });
    }

    const stats = operatorStats.get(opId);

    // 결과 확정된 것만 승률 계산에 포함
    if (app['상태'] === '선정' || app['상태'] === '탈락') {
      stats.confirmed++;
      if (app['상태'] === '선정') {
        stats.selected++;
        // AUM 계산 (선정된 것만)
        const amount = parseFloat(app['결성예정액']) || parseFloat(app['최소결성규모']) || 0;
        stats.totalAUM += amount;
      }
    }
  }

  // 통계 추가
  const paginatedWithStats = paginated.map(op => {
    const stats = operatorStats.get(op['ID']) || { totalAUM: 0, selected: 0, confirmed: 0 };
    const winRate = stats.confirmed > 0 ? (stats.selected / stats.confirmed * 100) : 0;
    return {
      ...op,
      recentAUM: stats.totalAUM,
      winRate: Math.round(winRate * 10) / 10,
      selected: stats.selected,
      confirmed: stats.confirmed
    };
  });

  res.json({
    data: paginatedWithStats,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
}));

// 운용사 상세 조회
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();
  const operator = await sheets.findById('운용사', id);

  if (!operator) {
    const error = new Error(`운용사를 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  res.json({ data: operator });
}));

// 운용사 생성
router.post('/', asyncHandler(async (req, res) => {
  const { 운용사명, 약어, 유형, 국가 } = req.body;

  if (!운용사명) {
    return res.status(400).json({ error: '운용사명은 필수입니다.' });
  }

  const sheets = await getSheetsClient();
  const result = await sheets.getOrCreateOperator(운용사명, { 약어, 유형, 국가 });

  res.status(result.isNew ? 201 : 200).json({
    data: result.data,
    isNew: result.isNew,
    id: result.id
  });
}));

// 운용사 수정
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 운용사명, 약어, 유형, 국가 } = req.body;
  const sheets = await getSheetsClient();

  const existing = await sheets.findById('운용사', id);
  if (!existing) {
    const error = new Error(`운용사를 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  const rowIndex = existing._rowIndex;

  // 개별 필드 업데이트
  if (운용사명 !== undefined) {
    await sheets.setValues(`운용사!B${rowIndex}`, [[운용사명]]);
  }
  if (약어 !== undefined) {
    await sheets.setValues(`운용사!C${rowIndex}`, [[약어]]);
  }
  if (유형 !== undefined) {
    await sheets.setValues(`운용사!D${rowIndex}`, [[유형]]);
  }
  if (국가 !== undefined) {
    await sheets.setValues(`운용사!E${rowIndex}`, [[국가]]);
  }

  // 업데이트된 데이터 반환
  const updated = await sheets.findById('운용사', id);
  res.json({ data: updated });
}));

// 유사도 검사
router.post('/check-similar', asyncHandler(async (req, res) => {
  const { names } = req.body;

  if (!names || !Array.isArray(names)) {
    return res.status(400).json({ error: 'names 배열이 필요합니다.' });
  }

  const sheets = await getSheetsClient();
  const result = await sheets.findSimilarOperatorsFromDB(names);

  res.json(result);
}));

// VC별 상세 프로필 및 통계
router.get('/:id/profile', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();

  const operator = await sheets.findById('운용사', id);
  if (!operator) {
    const error = new Error(`운용사를 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 해당 운용사의 모든 신청현황 조회
  const applications = await sheets.getAllRows('신청현황');
  const operatorApps = applications.filter(app => app['운용사ID'] === id);

  // 통계 계산
  const totalApps = operatorApps.length;
  const selectedApps = operatorApps.filter(app => app['상태'] === '선정');
  const rejectedApps = operatorApps.filter(app => app['상태'] === '탈락');

  // AUM 추정 (선정된 결성예정액 합계, 없으면 최소결성규모 사용)
  const estimatedAUM = selectedApps.reduce((sum, app) => {
    const amount = parseFloat(app['결성예정액']) || parseFloat(app['최소결성규모']) || 0;
    return sum + amount;
  }, 0);

  // 공동GP 참여 여부 확인
  const coGPApps = operatorApps.filter(app => app['비고']?.includes('공동GP'));
  const soleApps = operatorApps.filter(app => !app['비고']?.includes('공동GP'));

  res.json({
    data: operator,
    stats: {
      totalApplications: totalApps,
      selected: selectedApps.length,
      rejected: rejectedApps.length,
      pending: operatorApps.filter(app => app['상태'] === '접수').length,
      estimatedAUM,
      coGPCount: coGPApps.length,
      soleCount: soleApps.length
    }
  });
}));

// VC별 선정 이력 타임라인
router.get('/:id/timeline', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { years = 10 } = req.query;
  const sheets = await getSheetsClient();

  const operator = await sheets.findById('운용사', id);
  if (!operator) {
    const error = new Error(`운용사를 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  const [applications, projects] = await Promise.all([
    sheets.getAllRows('신청현황'),
    sheets.getAllRows('출자사업')
  ]);

  const projectMap = new Map(projects.map(p => [p['ID'], p]));
  const operatorApps = applications.filter(app => app['운용사ID'] === id);

  // 연도별 그룹핑
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - parseInt(years);
  const timeline = {};

  for (const app of operatorApps) {
    const project = projectMap.get(app['출자사업ID']);
    const year = parseInt(project?.['연도']) || 0;

    if (year < startYear) continue;

    if (!timeline[year]) {
      timeline[year] = { year, applications: [], selected: 0, rejected: 0, pending: 0 };
    }

    timeline[year].applications.push({
      id: app['ID'],
      projectId: app['출자사업ID'],
      projectName: project?.['사업명'] || '',
      소관: project?.['소관'] || '',
      출자분야: app['출자분야'],
      상태: app['상태'],
      결성예정액: app['결성예정액'],
      최소결성규모: app['최소결성규모'],
      비고: app['비고']
    });

    if (app['상태'] === '선정') timeline[year].selected++;
    else if (app['상태'] === '탈락') timeline[year].rejected++;
    else timeline[year].pending++;
  }

  // 연도순 정렬
  const sortedTimeline = Object.values(timeline).sort((a, b) => b.year - a.year);

  res.json({
    operator: operator['운용사명'],
    timeline: sortedTimeline,
    period: { startYear, endYear: currentYear }
  });
}));

// VC별 승률 분석 (Win-Rate)
router.get('/:id/win-rate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { years = 3 } = req.query;
  const sheets = await getSheetsClient();

  const operator = await sheets.findById('운용사', id);
  if (!operator) {
    const error = new Error(`운용사를 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  const [applications, projects] = await Promise.all([
    sheets.getAllRows('신청현황'),
    sheets.getAllRows('출자사업')
  ]);

  const projectMap = new Map(projects.map(p => [p['ID'], p]));

  // 기간 필터링
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - parseInt(years);

  const operatorApps = applications.filter(app => {
    if (app['운용사ID'] !== id) return false;
    const project = projectMap.get(app['출자사업ID']);
    const year = parseInt(project?.['연도']) || 0;
    return year >= startYear;
  });

  // 전체 승률
  const totalApps = operatorApps.filter(app => app['상태'] !== '접수'); // 결과 확정된 것만
  const totalSelected = totalApps.filter(app => app['상태'] === '선정').length;
  const overallWinRate = totalApps.length > 0 ? (totalSelected / totalApps.length * 100).toFixed(1) : 0;

  // 기관별 승률 (소관 기준: KVIC=한국벤처투자 관련, K-Growth=한국성장금융 관련)
  const byInstitution = {};
  for (const app of operatorApps) {
    const project = projectMap.get(app['출자사업ID']);
    const 소관 = project?.['소관'] || '기타';

    if (!byInstitution[소관]) {
      byInstitution[소관] = { total: 0, selected: 0, rejected: 0, pending: 0 };
    }

    byInstitution[소관].total++;
    if (app['상태'] === '선정') byInstitution[소관].selected++;
    else if (app['상태'] === '탈락') byInstitution[소관].rejected++;
    else byInstitution[소관].pending++;
  }

  // 기관별 승률 계산
  const institutionStats = Object.entries(byInstitution).map(([institution, stats]) => {
    const confirmed = stats.selected + stats.rejected;
    const winRate = confirmed > 0 ? (stats.selected / confirmed * 100).toFixed(1) : 0;
    return {
      institution,
      ...stats,
      winRate: parseFloat(winRate)
    };
  });

  // GP 형태별 승률 (단독 vs 공동)
  const soleApps = operatorApps.filter(app => !app['비고']?.includes('공동GP') && app['상태'] !== '접수');
  const coGPApps = operatorApps.filter(app => app['비고']?.includes('공동GP') && app['상태'] !== '접수');

  const soleSelected = soleApps.filter(app => app['상태'] === '선정').length;
  const coGPSelected = coGPApps.filter(app => app['상태'] === '선정').length;

  const gpTypeStats = {
    sole: {
      total: soleApps.length,
      selected: soleSelected,
      winRate: soleApps.length > 0 ? parseFloat((soleSelected / soleApps.length * 100).toFixed(1)) : 0
    },
    coGP: {
      total: coGPApps.length,
      selected: coGPSelected,
      winRate: coGPApps.length > 0 ? parseFloat((coGPSelected / coGPApps.length * 100).toFixed(1)) : 0
    }
  };

  // 분야별 승률
  const byCategory = {};
  for (const app of operatorApps) {
    const category = app['출자분야'] || '미분류';
    if (!byCategory[category]) {
      byCategory[category] = { total: 0, selected: 0, rejected: 0 };
    }
    byCategory[category].total++;
    if (app['상태'] === '선정') byCategory[category].selected++;
    else if (app['상태'] === '탈락') byCategory[category].rejected++;
  }

  const categoryStats = Object.entries(byCategory).map(([category, stats]) => {
    const confirmed = stats.selected + stats.rejected;
    const winRate = confirmed > 0 ? (stats.selected / confirmed * 100).toFixed(1) : 0;
    return { category, ...stats, winRate: parseFloat(winRate) };
  }).sort((a, b) => b.selected - a.selected);

  res.json({
    operator: operator['운용사명'],
    period: { startYear, endYear: currentYear, years: parseInt(years) },
    overall: {
      totalApplications: operatorApps.length,
      confirmedResults: totalApps.length,
      selected: totalSelected,
      rejected: totalApps.length - totalSelected,
      winRate: parseFloat(overallWinRate)
    },
    byInstitution: institutionStats,
    byGPType: gpTypeStats,
    byCategory: categoryStats
  });
}));

export default router;
