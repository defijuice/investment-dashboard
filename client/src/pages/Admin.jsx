import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Check, X, AlertCircle } from 'lucide-react';
import {
  fetchProjects,
  fetchOperators,
  createManualRejected,
  updateApplication
} from '../api/client';

export default function Admin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('manual');
  const [manualForm, setManualForm] = useState({
    출자사업ID: '',
    운용사명: '',
    출자분야: '',
    비고: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects({ limit: 100 }).then(res => res.data)
  });

  const { data: operators } = useQuery({
    queryKey: ['operators'],
    queryFn: () => fetchOperators({ limit: 500 }).then(res => res.data)
  });

  const createRejectedMutation = useMutation({
    mutationFn: createManualRejected,
    onSuccess: (data) => {
      setMessage({ type: 'success', text: `탈락 정보가 등록되었습니다. (ID: ${data.data.id})` });
      setManualForm({ 출자사업ID: '', 운용사명: '', 출자분야: '', 비고: '' });
      queryClient.invalidateQueries(['searchResults']);
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || '등록 중 오류가 발생했습니다.'
      });
    }
  });

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualForm.출자사업ID || !manualForm.운용사명) {
      setMessage({ type: 'error', text: '출자사업과 운용사명은 필수입니다.' });
      return;
    }
    createRejectedMutation.mutate(manualForm);
  };

  const tabs = [
    { id: 'manual', label: '수기 등록 (탈락)' },
    { id: 'validation', label: '데이터 검증' }
  ];

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>관리자</h1>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Message */}
      {message.text && (
        <div className={`message ${message.type}`}>
          <AlertCircle size={18} />
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Manual Entry Tab */}
      {activeTab === 'manual' && (
        <div className="card">
          <h2>탈락 정보 수기 등록</h2>
          <p className="card-description">
            공개되지 않은 지원자 정보를 수동으로 입력하여 승률 분석의 정확도를 높입니다.
            (비고에 "수기입력(탈락)" 표시됨)
          </p>

          <form onSubmit={handleManualSubmit} className="manual-form">
            <div className="form-group">
              <label>출자사업 *</label>
              <select
                value={manualForm.출자사업ID}
                onChange={(e) => setManualForm(prev => ({ ...prev, 출자사업ID: e.target.value }))}
                required
              >
                <option value="">선택하세요</option>
                {projects?.data?.map(project => (
                  <option key={project['ID']} value={project['ID']}>
                    {project['사업명']} ({project['연도']})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>운용사명 *</label>
              <input
                type="text"
                value={manualForm.운용사명}
                onChange={(e) => setManualForm(prev => ({ ...prev, 운용사명: e.target.value }))}
                placeholder="운용사명 입력 (기존에 없으면 자동 생성)"
                required
                list="operator-suggestions"
              />
              <datalist id="operator-suggestions">
                {operators?.data?.map(op => (
                  <option key={op['ID']} value={op['운용사명']} />
                ))}
              </datalist>
            </div>

            <div className="form-group">
              <label>출자분야</label>
              <input
                type="text"
                value={manualForm.출자분야}
                onChange={(e) => setManualForm(prev => ({ ...prev, 출자분야: e.target.value }))}
                placeholder="예: 중진 - 루키리그"
              />
            </div>

            <div className="form-group">
              <label>비고</label>
              <input
                type="text"
                value={manualForm.비고}
                onChange={(e) => setManualForm(prev => ({ ...prev, 비고: e.target.value }))}
                placeholder="정보 출처 등"
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={createRejectedMutation.isPending}
            >
              <Plus size={18} />
              {createRejectedMutation.isPending ? '등록 중...' : '탈락 정보 등록'}
            </button>
          </form>
        </div>
      )}

      {/* Data Validation Tab */}
      {activeTab === 'validation' && (
        <div className="card">
          <h2>데이터 검증</h2>
          <p className="card-description">
            크롤링된 데이터의 원본 대조 및 수정 기능 (준비 중)
          </p>

          <div className="validation-tools">
            <div className="tool-card">
              <h3>운용사 중복 검사</h3>
              <p>유사한 이름의 운용사를 찾아 병합합니다.</p>
              <button className="btn-secondary" disabled>
                중복 검사 실행
              </button>
            </div>

            <div className="tool-card">
              <h3>신청현황 일관성 검사</h3>
              <p>출자사업-신청현황 연결 상태를 검증합니다.</p>
              <button className="btn-secondary" disabled>
                일관성 검사 실행
              </button>
            </div>

            <div className="tool-card">
              <h3>파일 처리 현황</h3>
              <p>미처리 파일 목록 및 상태를 확인합니다.</p>
              <button className="btn-secondary" disabled>
                현황 보기
              </button>
            </div>
          </div>

          <div className="coming-soon">
            <p>추가 검증 도구가 곧 추가될 예정입니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}
