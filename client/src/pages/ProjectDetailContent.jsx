import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, FileCheck, Users, TrendingUp, TrendingDown,
  ExternalLink, RefreshCw, Target
} from 'lucide-react';
import { fetchProjectDetail } from '../api/client';
import FileCompareModal from '../components/FileCompareModal';

/**
 * 출자사업 상세 정보 컴포넌트 (Drawer 내부용)
 * URL 라우팅 의존성 없이 props로 id를 받음
 */
export default function ProjectDetailContent({ id, onOperatorClick }) {
  const [selectedFile, setSelectedFile] = useState(null);

  const { data: projectData, isLoading, refetch } = useQuery({
    queryKey: ['projectDetail', id],
    queryFn: () => fetchProjectDetail(id).then(res => res.data),
    enabled: !!id
  });

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  const project = projectData?.data;
  const applications = projectData?.applications || [];
  const linkedFiles = projectData?.linkedFiles || { support: [], result: [] };
  const competitionRates = projectData?.competitionRates || [];

  // 통계 계산
  const stats = {
    total: applications.length,
    선정: applications.filter(app => app['상태'] === '선정').length,
    탈락: applications.filter(app => app['상태'] === '탈락').length,
    접수: applications.filter(app => app['상태'] === '접수').length
  };

  const winRate = stats.선정 + stats.탈락 > 0
    ? ((stats.선정 / (stats.선정 + stats.탈락)) * 100).toFixed(1)
    : 0;

  // 평균 경쟁률 계산
  const avgCompetitionRate = competitionRates.length > 0
    ? (competitionRates.reduce((sum, r) => sum + (parseInt(r['지원펀드수']) || 0), 0) /
       competitionRates.reduce((sum, r) => sum + (parseInt(r['선정펀드수']) || 1), 0)).toFixed(1)
    : null;

  const handleFileClick = (fileId, fileType) => {
    setSelectedFile({ id: fileId, type: fileType });
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
    refetch();
  };

  // 공동GP 판단 함수
  const isJointGP = (app) => {
    const note = app['비고'] || '';
    return note.match(/^AP\d+$/) !== null || app['상태'] === '공동GP';
  };

  // 공동GP 파트너 ID 추출
  const getGPPartner = (app) => {
    const note = app['비고'] || '';
    const match = note.match(/^AP\d+$/);
    return match ? match[0] : null;
  };

  // 실제 표시할 상태 (공동GP → 접수로 변환)
  const getDisplayStatus = (status) => {
    return status === '공동GP' ? '접수' : status;
  };

  return (
    <div className="project-detail-content">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{project?.['사업명']}</h1>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 10px', borderRadius: 4, fontSize: '0.8rem' }}>
            {project?.['소관']}
          </span>
          <span style={{ background: '#f3e5f5', color: '#7b1fa2', padding: '4px 10px', borderRadius: 4, fontSize: '0.8rem' }}>
            {project?.['연도']}년
          </span>
          <span style={{ background: '#fff3e0', color: '#e65100', padding: '4px 10px', borderRadius: 4, fontSize: '0.8rem' }}>
            {project?.['차수']}
          </span>
          <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: 4, fontSize: '0.8rem' }}>
            {project?.['공고유형']}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#e3f2fd', padding: 8, borderRadius: 8 }}>
            <Users size={20} color="#1976d2" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{stats.total}건</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>총 신청</div>
          </div>
        </div>
        <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#e8f5e9', padding: 8, borderRadius: 8 }}>
            <TrendingUp size={20} color="#4caf50" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{stats.선정}건</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>선정</div>
          </div>
        </div>
        <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#ffebee', padding: 8, borderRadius: 8 }}>
            <TrendingDown size={20} color="#f44336" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{stats.탈락}건</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>탈락</div>
          </div>
        </div>
        <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#fff3e0', padding: 8, borderRadius: 8 }}>
            <Target size={20} color="#ff9800" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{winRate}%</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>선정률</div>
          </div>
        </div>
      </div>

      {/* Linked Files */}
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1rem' }}>연결된 파일</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* 접수현황 파일 */}
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', margin: '0 0 8px', color: '#666' }}>
              <FileText size={16} /> 접수현황
            </h3>
            {linkedFiles.support.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {linkedFiles.support.map(file => (
                  <button
                    key={file['ID']}
                    onClick={() => handleFileClick(file['ID'], '접수현황')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', border: '1px solid #e5e5e5', borderRadius: 6,
                      background: '#fafafa', cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>
                      {file['ID']}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file['파일명']}
                    </span>
                    <ExternalLink size={14} color="#999" />
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>파일 없음</p>
            )}
          </div>

          {/* 선정결과 파일 */}
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', margin: '0 0 8px', color: '#666' }}>
              <FileCheck size={16} /> 선정결과
            </h3>
            {linkedFiles.result.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {linkedFiles.result.map(file => (
                  <button
                    key={file['ID']}
                    onClick={() => handleFileClick(file['ID'], '선정결과')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', border: '1px solid #e5e5e5', borderRadius: 6,
                      background: '#fafafa', cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>
                      {file['ID']}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file['파일명']}
                    </span>
                    <ExternalLink size={14} color="#999" />
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ color: '#999', fontSize: '0.85rem', margin: 0 }}>파일 없음</p>
            )}
          </div>
        </div>
      </div>

      {/* Competition Rates */}
      {competitionRates.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '1rem' }}>분야별 경쟁률</h2>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>출자분야</th>
                <th style={{ textAlign: 'center', padding: '8px 4px' }}>선정</th>
                <th style={{ textAlign: 'center', padding: '8px 4px' }}>지원</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>경쟁률</th>
              </tr>
            </thead>
            <tbody>
              {competitionRates.map(rate => (
                <tr key={rate['ID']} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 4px' }}>{rate['출자분야']}</td>
                  <td style={{ textAlign: 'center', padding: '8px 4px' }}>{rate['선정펀드수']}</td>
                  <td style={{ textAlign: 'center', padding: '8px 4px' }}>{rate['지원펀드수']}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <span style={{
                      background: '#fff3e0', color: '#e65100',
                      padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem'
                    }}>
                      {rate['경쟁률']}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Applications Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>신청현황 ({applications.length}건)</h2>
          <button
            onClick={refetch}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', border: '1px solid #e5e5e5', borderRadius: 4,
              background: '#fff', cursor: 'pointer', fontSize: '0.8rem'
            }}
          >
            <RefreshCw size={14} />
            새로고침
          </button>
        </div>

        {applications.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>운용사</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>출자분야</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px' }}>결성규모</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px' }}>모태출자액</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px' }}>상태</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px' }}>공동GP</th>
                </tr>
              </thead>
              <tbody>
                {[...applications]
                  .sort((a, b) => {
                    const getOrder = (status) => {
                      if (status === '공동GP') return 1;
                      const order = { '선정': 0, '접수': 1, '탈락': 2 };
                      return order[status] ?? 3;
                    };
                    return getOrder(a['상태']) - getOrder(b['상태']);
                  })
                  .map(app => {
                    const displayStatus = getDisplayStatus(app['상태']);
                    const jointGP = isJointGP(app);
                    const gpPartner = getGPPartner(app);

                    return (
                      <tr key={app['ID']} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td
                          style={{
                            padding: '8px 4px',
                            cursor: onOperatorClick ? 'pointer' : 'default',
                            color: '#2563eb'
                          }}
                          onClick={() => onOperatorClick?.(app['운용사ID'])}
                        >
                          {app['운용사명'] || app['운용사ID']}
                        </td>
                        <td style={{ padding: '8px 4px' }}>{app['출자분야']}</td>
                        <td style={{ textAlign: 'right', padding: '8px 4px' }}>
                          {app['최소결성규모'] || app['결성예정액'] || '-'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 4px' }}>
                          {app['모태출자액'] || '-'}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            background: displayStatus === '선정' ? '#e8f5e9' : displayStatus === '탈락' ? '#ffebee' : '#fff3e0',
                            color: displayStatus === '선정' ? '#2e7d32' : displayStatus === '탈락' ? '#c62828' : '#e65100'
                          }}>
                            {displayStatus}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                          {jointGP ? (
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.7rem',
                              background: '#e3f2fd',
                              color: '#1565c0'
                            }}>
                              공동GP
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>신청현황이 없습니다.</div>
        )}
      </div>

      {/* 비고 */}
      {project?.['비고'] && (
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, marginTop: 24 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '1rem' }}>비고</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>{project['비고']}</p>
        </div>
      )}

      {/* File Compare Modal */}
      {selectedFile && (
        <FileCompareModal
          fileId={selectedFile.id}
          fileType={selectedFile.type}
          projectId={id}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
