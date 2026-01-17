import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, FileCheck, Users, TrendingUp, TrendingDown,
  ExternalLink, Edit3, Save, X, RefreshCw, Target
} from 'lucide-react';
import {
  fetchProjectDetail,
  fetchFileApplications,
  updateApplication,
  syncFileStatus
} from '../api/client';
import FileCompareModal from '../components/FileCompareModal';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState(null);

  const { data: projectData, isLoading, refetch } = useQuery({
    queryKey: ['projectDetail', id],
    queryFn: () => fetchProjectDetail(id).then(res => res.data)
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
    <div className="project-detail">
      <button className="btn-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        <span>뒤로</span>
      </button>

      {/* Header */}
      <div className="detail-header">
        <h1>{project?.['사업명']}</h1>
        <div className="project-meta">
          <span className="meta-badge">{project?.['소관']}</span>
          <span className="meta-badge">{project?.['연도']}년</span>
          <span className="meta-badge">{project?.['차수']}</span>
          <span className="meta-badge">{project?.['공고유형']}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.total}건</span>
            <span className="stat-label">총 신청</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon selected">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.선정}건</span>
            <span className="stat-label">선정</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon rejected">
            <TrendingDown size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.탈락}건</span>
            <span className="stat-label">탈락</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon aum">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{winRate}%</span>
            <span className="stat-label">선정률</span>
          </div>
        </div>
        {avgCompetitionRate && (
          <div className="stat-card">
            <div className="stat-icon competition">
              <Target size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">1:{avgCompetitionRate}</span>
              <span className="stat-label">평균 경쟁률</span>
            </div>
          </div>
        )}
      </div>

      {/* Linked Files */}
      <div className="card">
        <h2>연결된 파일</h2>
        <div className="files-grid">
          {/* 접수현황 파일 */}
          <div className="file-section">
            <h3><FileText size={18} /> 접수현황 파일</h3>
            {linkedFiles.support.length > 0 ? (
              <div className="file-list">
                {linkedFiles.support.map(file => (
                  <button
                    key={file['ID']}
                    className="file-item"
                    onClick={() => handleFileClick(file['ID'], '접수현황')}
                  >
                    <span className="file-id-tag">{file['ID']}</span>
                    <span className="file-name">{file['파일명']}</span>
                    <ExternalLink size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="no-file">연결된 파일 없음</p>
            )}
          </div>

          {/* 선정결과 파일 */}
          <div className="file-section">
            <h3><FileCheck size={18} /> 선정결과 파일</h3>
            {linkedFiles.result.length > 0 ? (
              <div className="file-list">
                {linkedFiles.result.map(file => (
                  <button
                    key={file['ID']}
                    className="file-item"
                    onClick={() => handleFileClick(file['ID'], '선정결과')}
                  >
                    <span className="file-id-tag">{file['ID']}</span>
                    <span className="file-name">{file['파일명']}</span>
                    <ExternalLink size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="no-file">연결된 파일 없음</p>
            )}
          </div>
        </div>
      </div>

      {/* Competition Rates */}
      {competitionRates.length > 0 && (() => {
        // 전체 경쟁률 계산
        const totalSelected = competitionRates.reduce((sum, r) => sum + (parseInt(r['선정펀드수']) || 0), 0);
        const totalApplied = competitionRates.reduce((sum, r) => sum + (parseInt(r['지원펀드수']) || 0), 0);
        const totalRate = `${totalSelected}:${totalApplied}`;

        return (
          <div className="card">
            {/* 전체 경쟁률 - 미니멀 카드 */}
            <div className="total-rate-card">
              <div className="total-rate-main">
                <span className="total-rate-value">{totalRate}</span>
                <span className="total-rate-label">전체 경쟁률</span>
              </div>
              <div className="total-rate-sub">
                <span>{totalSelected}개 선정</span>
                <span className="divider">/</span>
                <span>{totalApplied}개 지원</span>
              </div>
            </div>

            {/* 분야별 경쟁률 */}
            <h2>분야별 경쟁률</h2>
            <div className="table-container">
              <table className="competition-table">
                <thead>
                  <tr>
                    <th>출자분야</th>
                    <th>선정</th>
                    <th>지원</th>
                    <th>경쟁률</th>
                  </tr>
                </thead>
                <tbody>
                  {competitionRates.map(rate => {
                    const selected = parseInt(rate['선정펀드수']) || 0;
                    const applied = parseInt(rate['지원펀드수']) || 0;
                    const ratio = selected > 0 ? (applied / selected) : applied;
                    const barWidth = Math.min(ratio * 10, 100);

                    return (
                      <tr key={rate['ID']}>
                        <td>{rate['출자분야']}</td>
                        <td className="text-center">{rate['선정펀드수']}</td>
                        <td className="text-center">{rate['지원펀드수']}</td>
                        <td>
                          <div className="rate-cell">
                            <span className="rate-badge">{rate['경쟁률']}</span>
                            <div className="rate-bar-container">
                              <div
                                className="rate-bar"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Applications Table */}
      <div className="card">
        <div className="card-header">
          <h2>신청현황 ({applications.length}건)</h2>
          <div className="header-actions">
            <button className="btn-secondary" onClick={refetch}>
              <RefreshCw size={14} />
              새로고침
            </button>
          </div>
        </div>

        {applications.length > 0 ? (
          <div className="table-container">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>운용사</th>
                  <th>출자분야</th>
                  <th>최소결성규모(억 원)</th>
                  <th>모태출자액(억 원)</th>
                  <th>상태</th>
                  <th>공동GP</th>
                  <th>비고</th>
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
                      <tr key={app['ID']} className={`status-row-${displayStatus}`}>
                        <td
                          className="link-cell"
                          onClick={() => navigate(`/operators/${app['운용사ID']}`)}
                        >
                          {app['운용사명'] || app['운용사ID']}
                        </td>
                        <td>{app['출자분야']}</td>
                        <td>{app['최소결성규모'] || app['결성예정액'] || '-'}</td>
                        <td>{app['모태출자액'] || '-'}</td>
                        <td>
                          <span className={`status-badge ${displayStatus}`}>
                            {displayStatus}
                          </span>
                        </td>
                        <td>
                          {jointGP ? (
                            <span className="gp-badge">
                              공동GP
                              {gpPartner && <small>({gpPartner})</small>}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{jointGP ? '-' : (app['비고'] || '-')}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-results">신청현황이 없습니다.</div>
        )}
      </div>

      {/* 비고 */}
      {project?.['비고'] && (
        <div className="card">
          <h2>비고</h2>
          <p>{project['비고']}</p>
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
