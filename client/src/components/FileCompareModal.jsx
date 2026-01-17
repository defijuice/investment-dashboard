import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Save, Edit3, Check, AlertTriangle, RefreshCw,
  FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut
} from 'lucide-react';
import {
  fetchFileDetail,
  fetchFileApplications,
  updateApplication,
  syncFileStatus
} from '../api/client';

export default function FileCompareModal({ fileId, fileType, projectId, onClose }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [pdfScale, setPdfScale] = useState(1);

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ['fileDetail', fileId],
    queryFn: () => fetchFileDetail(fileId).then(res => res.data)
  });

  const { data: appData, isLoading: appLoading, refetch } = useQuery({
    queryKey: ['fileApplications', fileId],
    queryFn: () => fetchFileApplications(fileId).then(res => res.data)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateApplication(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['fileApplications', fileId]);
      queryClient.invalidateQueries(['projectDetail', projectId]);
      setEditingId(null);
      setEditData({});
    }
  });

  const syncMutation = useMutation({
    mutationFn: () => syncFileStatus(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries(['fileDetail', fileId]);
      queryClient.invalidateQueries(['fileApplications', fileId]);
    }
  });

  if (fileLoading || appLoading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content file-compare-modal">
          <div className="loading">로딩 중...</div>
        </div>
      </div>
    );
  }

  const file = fileData?.data;
  const allApplications = appData?.data?.applications || [];

  // 선정결과 파일이면 선정된 신청현황만 표시
  const applications = fileType === '선정결과'
    ? allApplications.filter(app => app['상태'] === '선정')
    : allApplications;

  const stats = appData?.data?.stats || { total: 0, 선정: 0, 탈락: 0, 접수: 0 };

  const handleEdit = (app) => {
    setEditingId(app['ID']);
    setEditData({
      운용사명: app['운용사명'],
      출자분야: app['출자분야'],
      최소결성규모: app['최소결성규모'],
      모태출자액: app['모태출자액'],
      상태: app['상태'],
      비고: app['비고']
    });
  };

  const handleSave = (id) => {
    updateMutation.mutate({
      id,
      data: {
        출자분야: editData.출자분야,
        최소결성규모: editData.최소결성규모,
        모태출자액: editData.모태출자액,
        상태: editData.상태,
        비고: editData.비고
      }
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const pdfUrl = file?.['파일URL'];

  // Google Drive URL을 임베드 URL로 변환
  const getEmbedUrl = (url) => {
    if (!url) return null;

    // Google Drive 공유 링크에서 파일 ID 추출
    // 형식: https://drive.google.com/file/d/{fileId}/view?usp=sharing
    // 또는: https://drive.google.com/open?id={fileId}
    let fileId = null;

    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    } else {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        fileId = idMatch[1];
      }
    }

    if (fileId) {
      // Google Drive 임베드 URL 사용
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }

    // Google Drive가 아닌 경우 원본 URL 반환
    return url;
  };

  const embedUrl = getEmbedUrl(pdfUrl);

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content file-compare-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <FileText size={20} />
            <h2>{file?.['파일명'] || fileId}</h2>
            <span className={`file-type-badge ${fileType}`}>{fileType}</span>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="compare-stats">
          <div className="stat-item">
            <span className="stat-label">총 신청</span>
            <span className="stat-value">{stats.total}건</span>
          </div>
          <div className="stat-item selected">
            <span className="stat-label">선정</span>
            <span className="stat-value">{stats.선정}건</span>
          </div>
          <div className="stat-item rejected">
            <span className="stat-label">탈락</span>
            <span className="stat-value">{stats.탈락}건</span>
          </div>
          <div className="stat-item pending">
            <span className="stat-label">접수</span>
            <span className="stat-value">{stats.접수}건</span>
          </div>
          <div className="stat-actions">
            <button
              className="btn-secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw size={14} className={syncMutation.isPending ? 'spinning' : ''} />
              현황 동기화
            </button>
          </div>
        </div>

        {/* Split View */}
        <div className="compare-container">
          {/* Left: PDF Viewer */}
          <div className="pdf-panel">
            <div className="panel-header">
              <h3>PDF 원본</h3>
              <div className="zoom-controls">
                <button onClick={() => setPdfScale(s => Math.max(0.5, s - 0.25))}>
                  <ZoomOut size={16} />
                </button>
                <span>{Math.round(pdfScale * 100)}%</span>
                <button onClick={() => setPdfScale(s => Math.min(2, s + 0.25))}>
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>
            <div className="pdf-viewer">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title="PDF Viewer"
                  style={{ transform: `scale(${pdfScale})`, transformOrigin: 'top left' }}
                  allow="autoplay"
                />
              ) : (
                <div className="no-pdf">
                  <AlertTriangle size={48} />
                  <p>PDF URL이 없습니다</p>
                  <p className="hint">파일 시트에서 파일URL을 확인해주세요</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Applications Table */}
          <div className="table-panel">
            <div className="panel-header">
              <h3>신청현황 ({applications.length}건)</h3>
              <button className="btn-secondary" onClick={refetch}>
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="table-wrapper">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>운용사</th>
                    <th>출자분야</th>
                    <th>최소결성규모(억 원)</th>
                    <th>모태출자액(억 원)</th>
                    <th>상태</th>
                    <th>공동GP</th>
                    <th>수정</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(app => {
                    const displayStatus = getDisplayStatus(app['상태']);
                    const jointGP = isJointGP(app);
                    const gpPartner = getGPPartner(app);

                    return (
                      <tr key={app['ID']} className={`status-row-${displayStatus}`}>
                        {editingId === app['ID'] ? (
                          <>
                            <td>{app['운용사명']}</td>
                            <td>
                              <input
                                type="text"
                                value={editData.출자분야 || ''}
                                onChange={e => setEditData({ ...editData, 출자분야: e.target.value })}
                                className="edit-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={editData.최소결성규모 || ''}
                                onChange={e => setEditData({ ...editData, 최소결성규모: e.target.value })}
                                className="edit-input small"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={editData.모태출자액 || ''}
                                onChange={e => setEditData({ ...editData, 모태출자액: e.target.value })}
                                className="edit-input small"
                              />
                            </td>
                            <td>
                              <select
                                value={editData.상태 || ''}
                                onChange={e => setEditData({ ...editData, 상태: e.target.value })}
                                className="edit-select"
                              >
                                <option value="접수">접수</option>
                                <option value="선정">선정</option>
                                <option value="탈락">탈락</option>
                              </select>
                            </td>
                            <td>-</td>
                            <td className="action-cell">
                              <button
                                className="btn-icon save"
                                onClick={() => handleSave(app['ID'])}
                                disabled={updateMutation.isPending}
                              >
                                <Save size={14} />
                              </button>
                              <button className="btn-icon cancel" onClick={handleCancel}>
                                <X size={14} />
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{app['운용사명']}</td>
                            <td>{app['출자분야']}</td>
                            <td>{app['최소결성규모'] || '-'}</td>
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
                            <td className="action-cell">
                              <button className="btn-icon edit" onClick={() => handleEdit(app)}>
                                <Edit3 size={14} />
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {applications.length === 0 && (
                <div className="no-results">
                  이 파일과 연결된 신청현황이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Info Footer */}
        <div className="modal-footer">
          <div className="file-info">
            <span>파일번호: {file?.['파일번호']}</span>
            <span>처리상태: {file?.['처리상태']}</span>
            <span>처리일시: {file?.['처리일시'] || '-'}</span>
            {file?.['현황'] && <span>현황: {file['현황']}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
