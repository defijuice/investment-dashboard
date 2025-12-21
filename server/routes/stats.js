import { Router } from 'express';
import { getSheetsClient } from '../services/sheets.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 대시보드 통계
router.get('/dashboard', asyncHandler(async (req, res) => {
  const sheets = await getSheetsClient();

  const [operators, projects, applications, files] = await Promise.all([
    sheets.getAllRows('운용사'),
    sheets.getAllRows('출자사업'),
    sheets.getAllRows('신청현황'),
    sheets.getAllRows('파일')
  ]);

  // 기본 통계
  const totalOperators = operators.length;
  const totalProjects = projects.length;
  const totalApplications = applications.length;

  // 상태별 통계
  const statusCounts = {
    선정: applications.filter(a => a['상태'] === '선정').length,
    탈락: applications.filter(a => a['상태'] === '탈락').length,
    접수: applications.filter(a => a['상태'] === '접수').length
  };

  // 파일 처리 상태
  const fileCounts = {
    대기: files.filter(f => f['처리상태'] === '대기').length,
    완료: files.filter(f => f['처리상태'] === '완료').length,
    제외: files.filter(f => f['처리상태'] === '제외').length
  };

  // 최근 처리 파일 (최근 5개)
  const recentFiles = files
    .filter(f => f['처리일시'])
    .sort((a, b) => new Date(b['처리일시']) - new Date(a['처리일시']))
    .slice(0, 5);

  // 최근 출자사업 (연도 역순, 최근 10개)
  const recentProjects = projects
    .sort((a, b) => {
      const yearDiff = (parseInt(b['연도']) || 0) - (parseInt(a['연도']) || 0);
      if (yearDiff !== 0) return yearDiff;
      return (b['차수'] || '').localeCompare(a['차수'] || '');
    })
    .slice(0, 10)
    .map(p => {
      const projectApps = applications.filter(a => a['출자사업ID'] === p['ID']);
      return {
        ...p,
        stats: {
          total: projectApps.length,
          선정: projectApps.filter(a => a['상태'] === '선정').length,
          탈락: projectApps.filter(a => a['상태'] === '탈락').length,
          접수: projectApps.filter(a => a['상태'] === '접수').length
        }
      };
    });

  res.json({
    summary: {
      totalOperators,
      totalProjects,
      totalApplications
    },
    statusCounts,
    fileCounts,
    recentFiles,
    recentProjects
  });
}));

// Top 운용사 (선정 횟수 기준)
router.get('/top-operators', asyncHandler(async (req, res) => {
  const { limit = 10, years = 3 } = req.query;
  const sheets = await getSheetsClient();

  const applications = await sheets.getAllRows('신청현황');
  const operators = await sheets.getAllRows('운용사');
  const projects = await sheets.getAllRows('출자사업');

  // 연도 필터링
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - parseInt(years);

  const projectYearMap = new Map(projects.map(p => [p['ID'], parseInt(p['연도']) || 0]));

  // 선정된 신청현황만 필터링
  const selectedApps = applications.filter(app => {
    if (app['상태'] !== '선정') return false;
    const projectYear = projectYearMap.get(app['출자사업ID']);
    return projectYear >= startYear;
  });

  // 운용사별 집계
  const operatorStats = new Map();
  for (const app of selectedApps) {
    const opId = app['운용사ID'];
    if (!operatorStats.has(opId)) {
      operatorStats.set(opId, { count: 0, totalAmount: 0 });
    }
    const stats = operatorStats.get(opId);
    stats.count++;
    stats.totalAmount += parseFloat(app['결성예정액']) || 0;
  }

  // 운용사 정보 조인 및 정렬
  const operatorMap = new Map(operators.map(op => [op['ID'], op]));
  const ranked = Array.from(operatorStats.entries())
    .map(([opId, stats]) => ({
      id: opId,
      name: operatorMap.get(opId)?.['운용사명'] || opId,
      selectedCount: stats.count,
      totalAmount: stats.totalAmount
    }))
    .sort((a, b) => b.selectedCount - a.selectedCount)
    .slice(0, parseInt(limit));

  res.json({
    data: ranked,
    period: { startYear, endYear: currentYear }
  });
}));

export default router;
