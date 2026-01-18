import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Users } from 'lucide-react';
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

/**
 * 운용사 상세 정보 컴포넌트 (Drawer 내부용)
 * URL 라우팅 의존성 없이 props로 id를 받음
 */
export default function OperatorDetailContent({ id, onProjectClick }) {
  const [winRateYears, setWinRateYears] = useState(3);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['operatorProfile', id],
    queryFn: () => fetchOperatorProfile(id).then(res => res.data),
    enabled: !!id
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['operatorTimeline', id],
    queryFn: () => fetchOperatorTimeline(id, 10).then(res => res.data),
    enabled: !!id
  });

  const { data: winRate, isFetching: winRateFetching } = useQuery({
    queryKey: ['operatorWinRate', id, winRateYears],
    queryFn: () => fetchOperatorWinRate(id, winRateYears).then(res => res.data),
    keepPreviousData: true,
    enabled: !!id
  });

  if (profileLoading || timelineLoading) {
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
    <div className="operator-detail-content">
      {/* Header */}
      <div className="detail-header" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{operator?.['운용사명']}</h1>
        {operator?.['약어'] && <span className="alias" style={{ color: '#666', marginLeft: 8 }}>({operator['약어']})</span>}
        <div className="operator-meta" style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: '0.9rem', color: '#666' }}>
          <span>{operator?.['유형'] || '국내VC'}</span>
          <span>{operator?.['국가'] || '한국'}</span>
          <span className="meta-period">최근 5년 기준</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        <div className="stat-card" style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#e3f2fd', padding: 8, borderRadius: 8 }}>
              <TrendingUp size={20} color="#2196f3" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{stats?.estimatedAUM?.toLocaleString() || 0}억원</div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>추정 AUM</div>
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#f3e5f5', padding: 8, borderRadius: 8 }}>
              <Users size={20} color="#9c27b0" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{stats?.totalApplications || 0}건</div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>총 지원</div>
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#e8f5e9', padding: 8, borderRadius: 8 }}>
              <TrendingUp size={20} color="#4caf50" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{stats?.selected || 0}건</div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>선정</div>
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#ffebee', padding: 8, borderRadius: 8 }}>
              <TrendingDown size={20} color="#f44336" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{stats?.rejected || 0}건</div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>탈락</div>
            </div>
          </div>
        </div>
      </div>

      {/* Win Rate Analysis */}
      <div className="card" style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>승률 분석</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 3, 5].map(y => (
              <button
                key={y}
                onClick={() => setWinRateYears(y)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: winRateYears === y ? '#c9a227' : '#f0f0f0',
                  color: winRateYears === y ? '#fff' : '#333',
                  fontWeight: winRateYears === y ? 600 : 400
                }}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>

        <div className={`win-rate-summary ${winRateFetching ? 'loading' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#c9a227' }}>{winRate?.overall?.winRate || 0}%</div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>전체 승률</div>
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            <p style={{ margin: '4px 0' }}>확정 결과: {winRate?.overall?.confirmedResults || 0}건</p>
            <p style={{ margin: '4px 0' }}>선정: {winRate?.overall?.selected || 0}건 / 탈락: {winRate?.overall?.rejected || 0}건</p>
          </div>
        </div>

        {/* GP Type */}
        {gpTypeData.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>GP 형태별 성과</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              {gpTypeData.map(gp => (
                <div key={gp.name} style={{ flex: 1, background: '#f8f9fa', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontWeight: 600 }}>{gp.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{gp.value}건 지원</div>
                  <div style={{ fontSize: '0.85rem', color: '#c9a227' }}>선정률 {gp.winRate}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Institution Comparison */}
        {institutionData.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>기관별 승률 비교</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={institutionData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" tick={{ fontSize: 11 }} />
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
          <div>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>분야별 실적</h3>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>출자분야</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px' }}>지원</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px' }}>선정</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px' }}>승률</th>
                </tr>
              </thead>
              <tbody>
                {winRate.byCategory.map((cat, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 4px' }}>{cat.category}</td>
                    <td style={{ textAlign: 'right', padding: '8px 4px' }}>{cat.total}</td>
                    <td style={{ textAlign: 'right', padding: '8px 4px' }}>{cat.selected}</td>
                    <td style={{ textAlign: 'right', padding: '8px 4px' }}>
                      <span style={{
                        background: cat.winRate >= 50 ? '#e8f5e9' : '#fff3e0',
                        color: cat.winRate >= 50 ? '#2e7d32' : '#e65100',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.8rem'
                      }}>
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
      <div className="card" style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>연도별 지원/선정 이력</h2>
        <div style={{ height: 200, marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="selected" name="선정" stackId="a" fill={COLORS.selected} />
              <Bar dataKey="rejected" name="탈락" stackId="a" fill={COLORS.rejected} />
              <Bar dataKey="pending" name="접수" stackId="a" fill={COLORS.pending} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline Details */}
        <div className="timeline-details">
          {(timeline?.timeline || []).map(year => (
            <div key={year.year} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{year.year}년</h4>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>
                  선정 {year.selected} / 탈락 {year.rejected} / 접수 {year.pending}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                {year.applications.map((app, idx) => {
                  const fundAmount = app['결성예정액'] || app['최소결성규모'];
                  const isSelected = app['상태'] === '선정';

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        background: idx % 2 === 0 ? '#fafafa' : '#fff',
                        borderRadius: 4
                      }}
                    >
                      <span
                        style={{ flex: 1, cursor: onProjectClick ? 'pointer' : 'default', color: '#2563eb' }}
                        onClick={() => onProjectClick?.(app.projectId)}
                      >
                        {app.projectName}
                      </span>
                      <span style={{ color: '#666', minWidth: 100 }}>{app['출자분야']}</span>
                      {isSelected && fundAmount && (
                        <span style={{ color: '#059669', minWidth: 70, textAlign: 'right' }}>
                          {parseFloat(fundAmount).toLocaleString()}억
                        </span>
                      )}
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        background: app['상태'] === '선정' ? '#e8f5e9' : app['상태'] === '탈락' ? '#ffebee' : '#fff3e0',
                        color: app['상태'] === '선정' ? '#2e7d32' : app['상태'] === '탈락' ? '#c62828' : '#e65100'
                      }}>
                        {app['상태']}
                      </span>
                      {app['비고']?.includes('공동GP') && (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: '0.7rem',
                          background: '#e3f2fd',
                          color: '#1565c0'
                        }}>
                          공동GP
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
