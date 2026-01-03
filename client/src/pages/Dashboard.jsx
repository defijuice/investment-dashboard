import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2, FileText, Users, TrendingUp, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchDashboardStats, fetchTopOperators, fetchTopOperatorsByAmount } from '../api/client';

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const ITEMS_PER_PAGE = 10;
const MAX_PAGES = 20;

export default function Dashboard() {
  const navigate = useNavigate();
  const [amountYears, setAmountYears] = useState(3);
  const [countYears, setCountYears] = useState(3);
  const [countPage, setCountPage] = useState(1);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => fetchDashboardStats().then(res => res.data)
  });

  const { data: topByAmount, isLoading: amountLoading, refetch: refetchAmount } = useQuery({
    queryKey: ['topOperatorsByAmount', amountYears],
    queryFn: () => fetchTopOperatorsByAmount(amountYears, 10).then(res => res.data)
  });

  const { data: topOperators, isLoading: topLoading, refetch: refetchTop } = useQuery({
    queryKey: ['topOperators', countYears],
    queryFn: () => fetchTopOperators(countYears, ITEMS_PER_PAGE * MAX_PAGES).then(res => res.data)
  });

  const handleRefresh = () => {
    refetchStats();
    refetchTop();
  };

  if (statsLoading || amountLoading || topLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  const summaryCards = [
    { label: '등록 운용사', value: stats?.summary?.totalOperators || 0, icon: Building2, color: '#2563eb' },
    { label: '출자사업', value: stats?.summary?.totalProjects || 0, icon: FileText, color: '#059669' },
    { label: '전체 신청', value: stats?.summary?.totalApplications || 0, icon: Users, color: '#7c3aed' },
    { label: '선정', value: stats?.statusCounts?.['선정'] || 0, icon: TrendingUp, color: '#dc2626' }
  ];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>대시보드</h1>
        <button className="btn-icon" onClick={handleRefresh}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="summary-card">
            <div className="card-icon" style={{ backgroundColor: `${color}20`, color }}>
              <Icon size={24} />
            </div>
            <div className="card-content">
              <span className="card-value">{value.toLocaleString()}</span>
              <span className="card-label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Status Distribution */}
      <div className="card">
        <h2>신청 현황 분포</h2>
        <div className="status-bars">
          <div className="status-item">
            <span className="status-label">선정</span>
            <div className="status-bar">
              <div
                className="status-fill selected"
                style={{
                  width: `${((stats?.statusCounts?.['선정'] || 0) / (stats?.summary?.totalApplications || 1)) * 100}%`
                }}
              />
            </div>
            <span className="status-count">{stats?.statusCounts?.['선정'] || 0}</span>
          </div>
          <div className="status-item">
            <span className="status-label">탈락</span>
            <div className="status-bar">
              <div
                className="status-fill rejected"
                style={{
                  width: `${((stats?.statusCounts?.['탈락'] || 0) / (stats?.summary?.totalApplications || 1)) * 100}%`
                }}
              />
            </div>
            <span className="status-count">{stats?.statusCounts?.['탈락'] || 0}</span>
          </div>
          <div className="status-item">
            <span className="status-label">접수</span>
            <div className="status-bar">
              <div
                className="status-fill pending"
                style={{
                  width: `${((stats?.statusCounts?.['접수'] || 0) / (stats?.summary?.totalApplications || 1)) * 100}%`
                }}
              />
            </div>
            <span className="status-count">{stats?.statusCounts?.['접수'] || 0}</span>
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
                onClick={() => setAmountYears(y)}
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
                <th>결성예정액</th>
                <th>선정 횟수</th>
              </tr>
            </thead>
            <tbody>
              {(topByAmount?.data || []).map((op, idx) => (
                <tr
                  key={op.id}
                  onClick={() => navigate(`/operators/${op.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{idx + 1}</td>
                  <td>{op.name}</td>
                  <td>{op.totalAmount?.toLocaleString()}억원</td>
                  <td>{op.selectedCount}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 현재누적 선정 실적 랭킹 */}
      <div className="card">
        <div className="card-header">
          <h2>현재누적 선정 실적 랭킹</h2>
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
                <th>선정 횟수</th>
                <th>결성예정액</th>
              </tr>
            </thead>
            <tbody>
              {(topOperators?.data || [])
                .slice((countPage - 1) * ITEMS_PER_PAGE, countPage * ITEMS_PER_PAGE)
                .map((op, idx) => (
                <tr
                  key={op.id}
                  onClick={() => navigate(`/operators/${op.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{(countPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                  <td>{op.name}</td>
                  <td>{op.selectedCount}건</td>
                  <td>{op.totalAmount?.toLocaleString()}억원</td>
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
                {countPage} / {totalPages} 페이지
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
                  onClick={() => navigate(`/projects/${project['ID']}`)}
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

      {/* Recent Files */}
      {stats?.recentFiles?.length > 0 && (
        <div className="card">
          <h2>최근 처리 파일</h2>
          <table className="recent-files">
            <thead>
              <tr>
                <th>파일명</th>
                <th>유형</th>
                <th>처리상태</th>
                <th>처리일시</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentFiles.map(file => (
                <tr key={file['ID']}>
                  <td>{file['파일명']}</td>
                  <td>{file['파일유형']}</td>
                  <td>
                    <span className={`status-badge ${file['처리상태']}`}>
                      {file['처리상태']}
                    </span>
                  </td>
                  <td>{file['처리일시']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
