import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, FileCheck, Users, TrendingUp, TrendingDown,
  ExternalLink, Edit3, Save, X, RefreshCw
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

  const handleFileClick = (fileId, fileType) => {
    setSelectedFile({ id: fileId, type: fileType });
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
    refetch();
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
                  <th>결성예정액</th>
                  <th>모태출자액</th>
                  <th>상태</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app['ID']} className={`status-row-${app['상태']}`}>
                    <td
                      className="link-cell"
                      onClick={() => navigate(`/operators/${app['운용사ID']}`)}
                    >
                      {app['운용사명'] || app['운용사ID']}
                    </td>
                    <td>{app['출자분야']}</td>
                    <td>{app['결성예정액'] ? `${app['결성예정액']}억원` : '-'}</td>
                    <td>{app['모태출자액'] ? `${app['모태출자액']}억원` : '-'}</td>
                    <td>
                      <span className={`status-badge ${app['상태']}`}>
                        {app['상태']}
                      </span>
                    </td>
                    <td>{app['비고'] || '-'}</td>
                  </tr>
                ))}
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
