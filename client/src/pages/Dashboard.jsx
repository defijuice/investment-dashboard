import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { RefreshCw, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { fetchDashboardStats, fetchTopOperators, fetchTopOperatorsByAmount, fetchCategoryBreakdown } from '../api/client';
import ShareButton from '../components/ShareButton';
import DetailDrawer from '../components/DetailDrawer';
import OperatorDetailContent from './OperatorDetailContent';
import ProjectDetailContent from './ProjectDetailContent';

const COLORS = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#f59e0b', '#06b6d4', '#84cc16', '#ec4899'];
const ITEMS_PER_PAGE = 10;
const MAX_PAGES = 20;

export default function Dashboard() {
  const [heroYears, setHeroYears] = useState(5);

  // Drawer 상태
  const [selectedOperatorId, setSelectedOperatorId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [amountYears, setAmountYears] = useState(3);
  const [categoryYears, setCategoryYears] = useState(3);
  const [countYears, setCountYears] = useState(3);
  const [countPage, setCountPage] = useState(1);
  const [amountPage, setAmountPage] = useState(1);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboardStats', heroYears],
    queryFn: () => fetchDashboardStats(heroYears).then(res => res.data)
  });

  const { data: topByAmount, isLoading: amountLoading, refetch: refetchAmount } = useQuery({
    queryKey: ['topOperatorsByAmount', amountYears],
    queryFn: () => fetchTopOperatorsByAmount(amountYears, ITEMS_PER_PAGE * MAX_PAGES).then(res => res.data)
  });

  const { data: topOperators, isLoading: topLoading, refetch: refetchTop } = useQuery({
    queryKey: ['topOperators', countYears],
    queryFn: () => fetchTopOperators(countYears, ITEMS_PER_PAGE * MAX_PAGES).then(res => res.data)
  });

  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ['categoryBreakdown', categoryYears],
    queryFn: () => fetchCategoryBreakdown(categoryYears).then(res => res.data)
  });

  const handleRefresh = () => {
    refetchStats();
    refetchTop();
    refetchAmount();
  };

  // 전역 로딩 제거 - 각 섹션이 독립적으로 로딩 상태 관리

  const hero = stats?.hero || {};

  // 금액 포맷팅 (억원 → 조원 변환)
  const formatAmount = (amount) => {
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(1)}조원`;
    }
    return `${amount.toLocaleString()}억원`;
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>대시보드</h1>
        <div className="header-actions">
          <ShareButton stats={stats} />
          <button className="btn-icon" onClick={handleRefresh}>
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Hero Section - LP 중심 */}
      <div className="hero-section">
        <div className="hero-header">
          <h2>KVIC 출자 시장</h2>
          <div className="period-selector">
            {[1, 3, 5].map(y => (
              <button
                key={y}
                className={`period-btn ${heroYears === y ? 'active' : ''}`}
                onClick={() => setHeroYears(y)}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>

        <div className="hero-main">
          <div className="hero-primary">
            <span className="hero-amount">{formatAmount(hero.rolling12Amount || 0)}</span>
            <span className="hero-label">최근 12개월 선정 결성액 ({hero.rolling12Count || 0}건)</span>
          </div>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <span className="stat-value">{formatAmount(hero.cumulativeAmount || 0)}</span>
            <span className="stat-label">{heroYears}년 누적</span>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <span className="stat-value">{hero.cumulativeSelected?.toLocaleString() || 0}건</span>
            <span className="stat-label">{heroYears}년 선정</span>
          </div>
          <div className="hero-divider" />
          <div className="hero-stat">
            <span className="stat-value">{hero.activeGPCount?.toLocaleString() || 0}개</span>
            <span className="stat-label">활성 GP</span>
          </div>
        </div>

        <div className="hero-footer">
          <Info size={12} />
          <span>KVIC 데이터 기준, 결성예정액 기준 (실제 결성액과 차이 있을 수 있음)</span>
        </div>
      </div>

      {/* 분야별 출자 비중 */}
      <div className="card">
        <div className="card-header">
          <h2>분야별 출자 비중</h2>
          <div className="period-selector">
            {[1, 3, 5].map(y => (
              <button
                key={y}
                className={`period-btn ${categoryYears === y ? 'active' : ''}`}
                onClick={() => setCategoryYears(y)}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>

        <div className="category-breakdown">
          <div className="category-bar">
            {(categoryData?.data || []).map((cat, idx) => (
              <div
                key={cat.category}
                className="category-segment"
                style={{
                  width: `${cat.percent}%`,
                  backgroundColor: COLORS[idx % COLORS.length]
                }}
                title={`${cat.category}: ${cat.percent}%`}
              />
            ))}
          </div>
          <div className="category-legend">
            {(categoryData?.data || []).slice(0, 6).map((cat, idx) => (
              <div key={cat.category} className="legend-item">
                <span
                  className="legend-color"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="legend-label">{cat.category}</span>
                <span className="legend-value">{cat.percent}%</span>
              </div>
            ))}
            {(categoryData?.data || []).length > 6 && (
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: '#9ca3af' }} />
                <span className="legend-label">기타</span>
                <span className="legend-value">
                  {(categoryData?.data || []).slice(6).reduce((sum, c) => sum + c.percent, 0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 출자 결성 규모 랭킹 */}
      <div className="card">
        <div className="card-header">
          <h2>출자 결성 규모 랭킹</h2>
          <div className="period-selector">
            {[1, 3, 5].map(y => (
              <button
                key={y}
                className={`period-btn ${amountYears === y ? "active" : ""}`}
                onClick={() => { setAmountYears(y); setAmountPage(1); }}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={topByAmount?.data || []}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'totalAmount') return [`${value.toLocaleString()}억원`, '결성예정액'];
                  if (name === 'selectedCount') return [`${value}건`, '선정 횟수'];
                  return [value, name];
                }}
              />
              <Bar dataKey="totalAmount" name="결성예정액" radius={[0, 4, 4, 0]}>
                {(topByAmount?.data || []).map((entry, index) => (
                  <Cell key={`cell-amount-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ranking-table">
          <table>
            <thead>
              <tr>
                <th>순위</th>
                <th>운용사명</th>
                <th>결성예정액(억원)</th>
                <th>선정(건)</th>
                <th>선정률</th>
                <th>주력분야</th>
              </tr>
            </thead>
            <tbody>
              {(topByAmount?.data || [])
                .slice((amountPage - 1) * ITEMS_PER_PAGE, amountPage * ITEMS_PER_PAGE)
                .map((op, idx) => (
                <tr
                  key={op.id}
                  onClick={() => setSelectedOperatorId(op.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{(amountPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                  <td>{op.name}</td>
                  <td>{op.totalAmount?.toLocaleString()}</td>
                  <td>{op.selectedCount}</td>
                  <td>
                    <span className={`win-rate ${op.winRate >= 50 ? 'high' : op.winRate >= 30 ? 'medium' : 'low'}`}>
                      {op.winRate}%
                    </span>
                  </td>
                  <td><span className="category-tag">{op.mainCategory}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {(() => {
          const totalItems = topByAmount?.data?.length || 0;
          const totalPages = Math.min(Math.ceil(totalItems / ITEMS_PER_PAGE), MAX_PAGES);
          if (totalPages <= 1) return null;
          return (
            <div className="pagination">
              <button
                onClick={() => setAmountPage(p => Math.max(1, p - 1))}
                disabled={amountPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ margin: '0 1rem' }}>
                {amountPage} / {totalPages}
              </span>
              <button
                onClick={() => setAmountPage(p => Math.min(totalPages, p + 1))}
                disabled={amountPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          );
        })()}
      </div>

      {/* 현재누적 선정 실적 랭킹 */}
      <div className="card">
        <div className="card-header">
          <h2>선정 실적 랭킹</h2>
          <div className="period-selector">
            {[1, 3, 5].map(y => (
              <button
                key={y}
                className={`period-btn ${countYears === y ? 'active' : ''}`}
                onClick={() => { setCountYears(y); setCountPage(1); }}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>

        <div className="ranking-table">
          <table>
            <thead>
              <tr>
                <th>순위</th>
                <th>운용사명</th>
                <th>선정(건)</th>
                <th>결성예정액(억원)</th>
                <th>선정률</th>
                <th>주력분야</th>
              </tr>
            </thead>
            <tbody>
              {(topOperators?.data || [])
                .slice((countPage - 1) * ITEMS_PER_PAGE, countPage * ITEMS_PER_PAGE)
                .map((op, idx) => (
                <tr
                  key={op.id}
                  onClick={() => setSelectedOperatorId(op.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{(countPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                  <td>{op.name}</td>
                  <td>{op.selectedCount}</td>
                  <td>{op.totalAmount?.toLocaleString()}</td>
                  <td>
                    <span className={`win-rate ${op.winRate >= 50 ? 'high' : op.winRate >= 30 ? 'medium' : 'low'}`}>
                      {op.winRate}%
                    </span>
                  </td>
                  <td><span className="category-tag">{op.mainCategory}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {(() => {
          const totalItems = topOperators?.data?.length || 0;
          const totalPages = Math.min(Math.ceil(totalItems / ITEMS_PER_PAGE), MAX_PAGES);
          if (totalPages <= 1) return null;
          return (
            <div className="pagination">
              <button
                onClick={() => setCountPage(p => Math.max(1, p - 1))}
                disabled={countPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ margin: '0 1rem' }}>
                {countPage} / {totalPages}
              </span>
              <button
                onClick={() => setCountPage(p => Math.min(totalPages, p + 1))}
                disabled={countPage === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          );
        })()}
      </div>

      {/* Recent Projects */}
      {stats?.recentProjects?.length > 0 && (
        <div className="card">
          <h2>최근 출자사업</h2>
          <table className="recent-projects">
            <thead>
              <tr>
                <th>사업명</th>
                <th>소관</th>
                <th>연도</th>
                <th>차수</th>
                <th>신청</th>
                <th>선정</th>
                <th>탈락</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentProjects.map(project => (
                <tr
                  key={project['ID']}
                  onClick={() => setSelectedProjectId(project['ID'])}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="link-cell">{project['사업명']}</td>
                  <td>{project['소관']}</td>
                  <td>{project['연도']}</td>
                  <td>{project['차수']}</td>
                  <td>{project.stats?.total || 0}</td>
                  <td>
                    <span className="status-badge 선정">{project.stats?.선정 || 0}</span>
                  </td>
                  <td>
                    <span className="status-badge 탈락">{project.stats?.탈락 || 0}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Operator Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedOperatorId}
        onClose={() => setSelectedOperatorId(null)}
        title="운용사 상세"
        width="700px"
      >
        {selectedOperatorId && (
          <OperatorDetailContent id={selectedOperatorId} />
        )}
      </DetailDrawer>

      {/* Project Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
        title="출자사업 상세"
        width="800px"
      >
        {selectedProjectId && (
          <ProjectDetailContent id={selectedProjectId} />
        )}
      </DetailDrawer>
    </div>
  );
}
