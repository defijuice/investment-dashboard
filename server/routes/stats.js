import { Router } from 'express';
import { getSheetsClient } from '../services/sheets.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 대시보드 통계 (LP 중심 개선)
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { years = 5 } = req.query;
  const sheets = await getSheetsClient();

  const [operators, projects, applications, files] = await Promise.all([
    sheets.getAllRows('운용사'),
    sheets.getAllRows('출자사업'),
    sheets.getAllRows('신청현황'),
    sheets.getAllRows('파일')
  ]);

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - parseInt(years);
  const projectYearMap = new Map(projects.map(p => [p['ID'], parseInt(p['연도']) || 0]));

  // 연도별 선정 통계 계산
  const yearlyStats = {};
  const activeGPs = new Set();

  for (const app of applications) {
    const projectYear = projectYearMap.get(app['출자사업ID']);
    if (!projectYear || projectYear < startYear) continue;

    if (!yearlyStats[projectYear]) {
      yearlyStats[projectYear] = { totalAmount: 0, selectedCount: 0, totalApps: 0 };
    }
    yearlyStats[projectYear].totalApps++;

    if (app['상태'] === '선정') {
      yearlyStats[projectYear].selectedCount++;
      // 선정 상태: 결성예정액 우선, 없으면 최소결성규모 사용 (fallback)
      const amount = parseFloat(app['결성예정액']) || parseFloat(app['최소결성규모']) || 0;
      yearlyStats[projectYear].totalAmount += amount;
      activeGPs.add(app['운용사ID']);
    }
  }

  // 현재 연도와 전년도 데이터
  const currentYearStats = yearlyStats[currentYear] || { totalAmount: 0, selectedCount: 0 };
  const prevYearStats = yearlyStats[currentYear - 1] || { totalAmount: 0, selectedCount: 0 };

  // YoY 계산
  const yoyAmount = prevYearStats.totalAmount > 0
    ? ((currentYearStats.totalAmount - prevYearStats.totalAmount) / prevYearStats.totalAmount * 100).toFixed(1)
    : null;

  // 누적 통계 (기간 내)
  const cumulativeAmount = Object.values(yearlyStats).reduce((sum, y) => sum + y.totalAmount, 0);
  const cumulativeSelected = Object.values(yearlyStats).reduce((sum, y) => sum + y.selectedCount, 0);

  // 기존 통계 (하위 호환성)
  const statusCounts = {
    선정: applications.filter(a => a['상태'] === '선정').length,
    탈락: applications.filter(a => a['상태'] === '탈락').length,
    접수: applications.filter(a => a['상태'] === '접수').length
  };

  const fileCounts = {
    대기: files.filter(f => f['처리상태'] === '대기').length,
    완료: files.filter(f => f['처리상태'] === '완료').length,
    제외: files.filter(f => f['처리상태'] === '제외').length
  };

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
    // LP 중심 Hero 데이터
    hero: {
      currentYear,
      currentYearAmount: currentYearStats.totalAmount,
      currentYearSelected: currentYearStats.selectedCount,
      prevYearAmount: prevYearStats.totalAmount,
      yoyPercent: yoyAmount,
      cumulativeAmount,
      cumulativeSelected,
      activeGPCount: activeGPs.size,
      periodYears: parseInt(years)
    },
    yearlyStats,
    // 기존 데이터 (하위 호환)
    summary: {
      totalOperators: operators.length,
      totalProjects: projects.length,
      totalApplications: applications.length
    },
    statusCounts,
    fileCounts,
    recentProjects
  });
}));

// Top 운용사 (선정 횟수 기준) - 선정률, 주력분야 추가
router.get('/top-operators', asyncHandler(async (req, res) => {
  const { limit = 10, years = 3 } = req.query;
  const sheets = await getSheetsClient();

  const applications = await sheets.getAllRows('신청현황');
  const operators = await sheets.getAllRows('운용사');
  const projects = await sheets.getAllRows('출자사업');

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - parseInt(years);
  const projectYearMap = new Map(projects.map(p => [p['ID'], parseInt(p['연도']) || 0]));

  // 기간 내 신청현황 필터링
  const periodApps = applications.filter(app => {
    const projectYear = projectYearMap.get(app['출자사업ID']);
    return projectYear >= startYear;
  });

  // 운용사별 집계 (선정 + 전체 신청)
  const operatorStats = new Map();
  for (const app of periodApps) {
    const opId = app['운용사ID'];
    if (!operatorStats.has(opId)) {
      operatorStats.set(opId, {
        selectedCount: 0,
        totalApps: 0,
        totalAmount: 0,
        categoryCount: {}
      });
    }
    const stats = operatorStats.get(opId);
    stats.totalApps++;

    if (app['상태'] === '선정') {
      stats.selectedCount++;
      // 선정 상태: 결성예정액 우선, 없으면 최소결성규모 사용 (fallback)
      stats.totalAmount += parseFloat(app['결성예정액']) || parseFloat(app['최소결성규모']) || 0;

      // 분야별 집계 (주력분야 계산용)
      const category = (app['출자분야'] || '').split(' - ')[0] || '기타';
      stats.categoryCount[category] = (stats.categoryCount[category] || 0) + 1;
    }
  }

  // 운용사 정보 조인 및 정렬
  const operatorMap = new Map(operators.map(op => [op['ID'], op]));
  const ranked = Array.from(operatorStats.entries())
    .filter(([, stats]) => stats.selectedCount > 0)
    .map(([opId, stats]) => {
      // 주력분야 (가장 많이 선정된 분야)
      const mainCategory = Object.entries(stats.categoryCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      return {
        id: opId,
        name: operatorMap.get(opId)?.['운용사명'] || opId,
        selectedCount: stats.selectedCount,
        totalApps: stats.totalApps,
        totalAmount: stats.totalAmount,
        winRate: stats.totalApps > 0 ? Math.round(stats.selectedCount / stats.totalApps * 100) : 0,
        mainCategory
      };
    })
    .sort((a, b) => b.selectedCount - a.selectedCount)
    .slice(0, parseInt(limit));

  res.json({
    data: ranked,
    period: { startYear, endYear: currentYear }
  });
}));

// Top 운용사 (결성예정액 기준) - 선정률, 주력분야 추가
router.get('/top-operators-by-amount', asyncHandler(async (req, res) => {
  const { limit = 10, years = 3 } = req.query;
  const sheets = await getSheetsClient();

  const applications = await sheets.getAllRows('신청현황');
  const operators = await sheets.getAllRows('운용사');
  const projects = await sheets.getAllRows('출자사업');

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - parseInt(years);
  const projectYearMap = new Map(projects.map(p => [p['ID'], parseInt(p['연도']) || 0]));

  // 기간 내 신청현황 필터링
  const periodApps = applications.filter(app => {
    const projectYear = projectYearMap.get(app['출자사업ID']);
    return projectYear >= startYear;
  });

  const operatorStats = new Map();
  for (const app of periodApps) {
    const opId = app['운용사ID'];
    if (!operatorStats.has(opId)) {
      operatorStats.set(opId, {
        selectedCount: 0,
        totalApps: 0,
        totalAmount: 0,
        categoryCount: {}
      });
    }
    const stats = operatorStats.get(opId);
    stats.totalApps++;

    if (app['상태'] === '선정') {
      stats.selectedCount++;
      // 선정 상태: 결성예정액 우선, 없으면 최소결성규모 사용 (fallback)
      stats.totalAmount += parseFloat(app['결성예정액']) || parseFloat(app['최소결성규모']) || 0;

      const category = (app['출자분야'] || '').split(' - ')[0] || '기타';
      stats.categoryCount[category] = (stats.categoryCount[category] || 0) + 1;
    }
  }

  const operatorMap = new Map(operators.map(op => [op['ID'], op]));
  const ranked = Array.from(operatorStats.entries())
    .filter(([, stats]) => stats.selectedCount > 0)
    .map(([opId, stats]) => {
      const mainCategory = Object.entries(stats.categoryCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      return {
        id: opId,
        name: operatorMap.get(opId)?.['운용사명'] || opId,
        selectedCount: stats.selectedCount,
        totalApps: stats.totalApps,
        totalAmount: stats.totalAmount,
        winRate: stats.totalApps > 0 ? Math.round(stats.selectedCount / stats.totalApps * 100) : 0,
        mainCategory
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, parseInt(limit));

  res.json({
    data: ranked,
    period: { startYear, endYear: currentYear }
  });
}));

// 분야별 출자 비중
router.get('/category-breakdown', asyncHandler(async (req, res) => {
  const { years = 3 } = req.query;
  const sheets = await getSheetsClient();

  const applications = await sheets.getAllRows('신청현황');
  const projects = await sheets.getAllRows('출자사업');

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - parseInt(years);
  const projectYearMap = new Map(projects.map(p => [p['ID'], parseInt(p['연도']) || 0]));

  // 기간 내 선정 신청현황
  const selectedApps = applications.filter(app => {
    if (app['상태'] !== '선정') return false;
    const projectYear = projectYearMap.get(app['출자사업ID']);
    return projectYear >= startYear;
  });

  // 분야별 집계
  const categoryStats = {};
  let totalAmount = 0;

  for (const app of selectedApps) {
    const fullCategory = app['출자분야'] || '기타';
    const mainCategory = fullCategory.split(' - ')[0] || '기타';
    // 선정 상태: 결성예정액 우선, 없으면 최소결성규모 사용 (fallback)
    const amount = parseFloat(app['결성예정액']) || parseFloat(app['최소결성규모']) || 0;

    if (!categoryStats[mainCategory]) {
      categoryStats[mainCategory] = { amount: 0, count: 0 };
    }
    categoryStats[mainCategory].amount += amount;
    categoryStats[mainCategory].count++;
    totalAmount += amount;
  }

  // 비중 계산 및 정렬
  const breakdown = Object.entries(categoryStats)
    .map(([category, stats]) => ({
      category,
      amount: stats.amount,
      count: stats.count,
      percent: totalAmount > 0 ? Math.round(stats.amount / totalAmount * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  res.json({
    data: breakdown,
    totalAmount,
    totalCount: selectedApps.length,
    period: { startYear, endYear: currentYear }
  });
}));

export default router;
