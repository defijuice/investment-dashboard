import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, Users } from 'lucide-react';
import {
  fetchOperatorProfile,
  fetchOperatorTimeline,
  fetchOperatorWinRate
} from '../api/client';

const COLORS = {
  selected: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b'
};

const PIE_COLORS = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#f59e0b'];

export default function OperatorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [winRateYears, setWinRateYears] = useState(3);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['operatorProfile', id],
    queryFn: () => fetchOperatorProfile(id).then(res => res.data)
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['operatorTimeline', id],
    queryFn: () => fetchOperatorTimeline(id, 10).then(res => res.data)
  });

  const { data: winRate, isLoading: winRateLoading } = useQuery({
    queryKey: ['operatorWinRate', id, winRateYears],
    queryFn: () => fetchOperatorWinRate(id, winRateYears).then(res => res.data)
  });

  if (profileLoading || timelineLoading || winRateLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  const operator = profile?.data;
  const stats = profile?.stats;

  // Timeline chart data
  const timelineData = (timeline?.timeline || []).map(t => ({
    year: t.year,
    selected: t.selected,
    rejected: t.rejected,
    pending: t.pending,
    total: t.applications.length
  }));

  // GP Type chart data
  const gpTypeData = [
    { name: '단독 GP', value: winRate?.byGPType?.sole?.total || 0, winRate: winRate?.byGPType?.sole?.winRate || 0 },
    { name: '공동 GP', value: winRate?.byGPType?.coGP?.total || 0, winRate: winRate?.byGPType?.coGP?.winRate || 0 }
  ].filter(d => d.value > 0);

  // Institution chart data
  const institutionData = (winRate?.byInstitution || []).map(inst => ({
    name: inst.institution,
    value: inst.total,
    winRate: inst.winRate
  }));

  return (
    <div className="operator-detail">
      <button className="btn-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        <span>뒤로</span>
      </button>

      {/* Header */}
      <div className="detail-header">
        <h1>{operator?.['운용사명']}</h1>
        {operator?.['약어'] && <span className="alias">({operator['약어']})</span>}
        <div className="operator-meta">
          <span>{operator?.['유형'] || '벤처캐피탈'}</span>
          <span>{operator?.['국가'] || '대한민국'}</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon aum">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.estimatedAUM?.toLocaleString() || 0}억원</span>
            <span className="stat-label">추정 AUM (선정 결성액)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon total">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.totalApplications || 0}건</span>
            <span className="stat-label">총 지원 횟수</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon selected">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.selected || 0}건</span>
            <span className="stat-label">선정</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon rejected">
            <TrendingDown size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats?.rejected || 0}건</span>
            <span className="stat-label">탈락</span>
          </div>
        </div>
      </div>

      {/* Win Rate Analysis */}
      <div className="card">
        <div className="card-header">
          <h2>승률 분석 (Win-Rate)</h2>
          <div className="period-selector">
            {[1, 3, 5].map(y => (
              <button
                key={y}
                className={`period-btn ${winRateYears === y ? 'active' : ''}`}
                onClick={() => setWinRateYears(y)}
              >
                최근 {y}년
              </button>
            ))}
          </div>
        </div>

        <div className="win-rate-summary">
          <div className="win-rate-main">
            <div className="win-rate-circle">
              <span className="rate">{winRate?.overall?.winRate || 0}%</span>
              <span className="label">전체 승률</span>
            </div>
            <div className="win-rate-detail">
              <p>확정 결과: {winRate?.overall?.confirmedResults || 0}건</p>
              <p>선정: {winRate?.overall?.selected || 0}건</p>
              <p>탈락: {winRate?.overall?.rejected || 0}건</p>
            </div>
          </div>
        </div>

        {/* GP Type Comparison */}
        <div className="chart-section">
          <h3>GP 형태별 성과</h3>
          <div className="gp-type-comparison">
            {gpTypeData.map((gp, idx) => (
              <div key={gp.name} className="gp-card">
                <h4>{gp.name}</h4>
                <div className="gp-stats">
                  <span className="gp-count">{gp.value}건</span>
                  <span className="gp-rate">{gp.winRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Institution Comparison */}
        {institutionData.length > 0 && (
          <div className="chart-section">
            <h3>기관별 승률 비교</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={institutionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="value" name="지원 건수" fill="#8884d8" />
                  <Bar yAxisId="right" dataKey="winRate" name="승률(%)" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Category Stats */}
        {winRate?.byCategory?.length > 0 && (
          <div className="chart-section">
            <h3>분야별 실적</h3>
            <table className="category-table">
              <thead>
                <tr>
                  <th>출자분야</th>
                  <th>지원</th>
                  <th>선정</th>
                  <th>탈락</th>
                  <th>승률</th>
                </tr>
              </thead>
              <tbody>
                {winRate.byCategory.map((cat, idx) => (
                  <tr key={idx}>
                    <td>{cat.category}</td>
                    <td>{cat.total}</td>
                    <td>{cat.selected}</td>
                    <td>{cat.rejected}</td>
                    <td>
                      <span className={`rate-badge ${cat.winRate >= 50 ? 'high' : 'low'}`}>
                        {cat.winRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="card">
        <h2>연도별 지원/선정 이력</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="selected" name="선정" stackId="a" fill={COLORS.selected} />
              <Bar dataKey="rejected" name="탈락" stackId="a" fill={COLORS.rejected} />
              <Bar dataKey="pending" name="접수" stackId="a" fill={COLORS.pending} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline Details */}
        <div className="timeline-details">
          {(timeline?.timeline || []).map(year => (
            <div key={year.year} className="timeline-year">
              <div className="year-header">
                <h4>{year.year}년</h4>
                <span className="year-summary">
                  선정 {year.selected} / 탈락 {year.rejected} / 접수 {year.pending}
                </span>
              </div>
              <div className="year-apps">
                {year.applications.map((app, idx) => (
                  <div key={idx} className={`app-item ${app['상태']}`}>
                    <span className="app-project">{app.projectName}</span>
                    <span className="app-category">{app['출자분야']}</span>
                    <span className={`app-status ${app['상태']}`}>{app['상태']}</span>
                    {app['비고']?.includes('공동GP') && (
                      <span className="app-badge">공동GP</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
