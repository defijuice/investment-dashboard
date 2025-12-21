import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi, projectsApi, operatorsApi } from '../api/client';
import DataTable from '../components/Table/DataTable';
import Modal from '../components/Modal/Modal';

const STATUS_OPTIONS = ['전체', '접수', '선정', '탈락'];
const STATUS_COLORS = {
  선정: 'bg-green-100 text-green-700',
  탈락: 'bg-red-100 text-red-700',
  접수: 'bg-gray-100 text-gray-700'
};

export default function Applications() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    projectId: '',
    status: '전체',
    search: ''
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingApp, setEditingApp] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 데이터 조회
  const { data: applicationsData, isLoading } = useQuery({
    queryKey: ['applications', page, filters],
    queryFn: () =>
      applicationsApi
        .list({
          page,
          limit: 50,
          projectId: filters.projectId || undefined,
          status: filters.status !== '전체' ? filters.status : undefined,
          search: filters.search || undefined
        })
        .then((res) => res.data)
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectsApi.list({ limit: 1000 }).then((res) => res.data)
  });

  const { data: operatorsData } = useQuery({
    queryKey: ['operators-list'],
    queryFn: () => operatorsApi.list({ limit: 1000 }).then((res) => res.data)
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => applicationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setEditingApp(null);
    }
  });

  const batchStatusMutation = useMutation({
    mutationFn: ({ ids, status }) => applicationsApi.batchUpdateStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedIds([]);
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => applicationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setIsCreateModalOpen(false);
    }
  });

  const columns = [
    { key: 'ID', label: 'ID', width: '80px', sortable: true },
    { key: '운용사명', label: '운용사', sortable: true },
    { key: '사업명', label: '출자사업', sortable: true },
    { key: '출자분야', label: '출자분야', sortable: true },
    {
      key: '상태',
      label: '상태',
      width: '80px',
      render: (value) => (
        <span className={`px-2 py-1 text-xs rounded ${STATUS_COLORS[value] || ''}`}>
          {value}
        </span>
      )
    },
    { key: '결성예정액', label: '결성예정액', width: '100px' },
    { key: '비고', label: '비고' },
    {
      key: 'actions',
      label: '',
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingApp(row);
          }}
          className="text-blue-600 hover:text-blue-800"
        >
          편집
        </button>
      )
    }
  ];

  const handleBatchStatus = (status) => {
    if (selectedIds.length === 0) return;
    if (!confirm(`선택한 ${selectedIds.length}건을 '${status}'로 변경하시겠습니까?`)) return;
    batchStatusMutation.mutate({ ids: selectedIds, status });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">신청현황 관리</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + 수기 등록
        </button>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.projectId}
            onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">전체 사업</option>
            {projectsData?.data?.map((p) => (
              <option key={p.ID} value={p.ID}>
                {p['사업명']}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border rounded-md"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="운용사/사업명 검색"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 border rounded-md flex-1 min-w-[200px]"
          />

          <button
            onClick={() => setFilters({ projectId: '', status: '전체', search: '' })}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 일괄 액션 */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-4">
          <span className="text-blue-800 font-medium">
            {selectedIds.length}건 선택
          </span>
          <button
            onClick={() => handleBatchStatus('선정')}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            일괄 선정
          </button>
          <button
            onClick={() => handleBatchStatus('탈락')}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            일괄 탈락
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="px-3 py-1 border rounded text-sm hover:bg-white"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 테이블 */}
      <DataTable
        columns={columns}
        data={applicationsData?.data || []}
        loading={isLoading}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        pagination={{
          page: applicationsData?.page || 1,
          total: applicationsData?.total || 0,
          totalPages: applicationsData?.totalPages || 1
        }}
        onPageChange={setPage}
      />

      {/* 편집 모달 */}
      {editingApp && (
        <EditModal
          application={editingApp}
          projects={projectsData?.data || []}
          operators={operatorsData?.data || []}
          onClose={() => setEditingApp(null)}
          onSave={(data) => updateMutation.mutate({ id: editingApp.ID, data })}
          loading={updateMutation.isPending}
        />
      )}

      {/* 생성 모달 */}
      {isCreateModalOpen && (
        <CreateModal
          projects={projectsData?.data || []}
          operators={operatorsData?.data || []}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
          error={createMutation.error?.response?.data?.error}
        />
      )}
    </div>
  );
}

function EditModal({ application, projects, operators, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    출자사업ID: application['출자사업ID'] || '',
    운용사ID: application['운용사ID'] || '',
    출자분야: application['출자분야'] || '',
    결성예정액: application['결성예정액'] || '',
    출자요청액: application['출자요청액'] || '',
    상태: application['상태'] || '',
    비고: application['비고'] || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`신청현황 편집 - ${application.ID}`}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </>
      }
    >
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            출자사업
          </label>
          <select
            value={form.출자사업ID}
            onChange={(e) => setForm({ ...form, 출자사업ID: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">선택</option>
            {projects.map((p) => (
              <option key={p.ID} value={p.ID}>
                {p['사업명']}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            운용사
          </label>
          <select
            value={form.운용사ID}
            onChange={(e) => setForm({ ...form, 운용사ID: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="">선택</option>
            {operators.map((op) => (
              <option key={op.ID} value={op.ID}>
                {op['운용사명']}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            출자분야
          </label>
          <input
            type="text"
            value={form.출자분야}
            onChange={(e) => setForm({ ...form, 출자분야: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              결성예정액
            </label>
            <input
              type="text"
              value={form.결성예정액}
              onChange={(e) => setForm({ ...form, 결성예정액: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              출자요청액
            </label>
            <input
              type="text"
              value={form.출자요청액}
              onChange={(e) => setForm({ ...form, 출자요청액: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상태
          </label>
          <div className="flex gap-4">
            {['접수', '선정', '탈락'].map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={form.상태 === s}
                  onChange={(e) => setForm({ ...form, 상태: e.target.value })}
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            비고
          </label>
          <textarea
            value={form.비고}
            onChange={(e) => setForm({ ...form, 비고: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            rows={2}
          />
        </div>
      </form>
    </Modal>
  );
}

function CreateModal({ projects, operators, onClose, onSave, loading, error }) {
  const [form, setForm] = useState({
    출자사업ID: '',
    운용사ID: '',
    출자분야: '',
    결성예정액: '',
    출자요청액: '',
    상태: '접수',
    비고: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="신청현황 수기 등록"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.출자사업ID || !form.운용사ID}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '등록 중...' : '등록'}
          </button>
        </>
      }
    >
      <form className="space-y-4">
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            출자사업 *
          </label>
          <select
            value={form.출자사업ID}
            onChange={(e) => setForm({ ...form, 출자사업ID: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            required
          >
            <option value="">선택</option>
            {projects.map((p) => (
              <option key={p.ID} value={p.ID}>
                {p['사업명']}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            운용사 *
          </label>
          <select
            value={form.운용사ID}
            onChange={(e) => setForm({ ...form, 운용사ID: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            required
          >
            <option value="">선택</option>
            {operators.map((op) => (
              <option key={op.ID} value={op.ID}>
                {op['운용사명']}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            출자분야
          </label>
          <input
            type="text"
            value={form.출자분야}
            onChange={(e) => setForm({ ...form, 출자분야: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="예: 중진 - 루키리그"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              결성예정액 (억원)
            </label>
            <input
              type="number"
              value={form.결성예정액}
              onChange={(e) => setForm({ ...form, 결성예정액: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              출자요청액 (억원)
            </label>
            <input
              type="number"
              value={form.출자요청액}
              onChange={(e) => setForm({ ...form, 출자요청액: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상태
          </label>
          <div className="flex gap-4">
            {['접수', '선정', '탈락'].map((s) => (
              <label key={s} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="createStatus"
                  value={s}
                  checked={form.상태 === s}
                  onChange={(e) => setForm({ ...form, 상태: e.target.value })}
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            비고
          </label>
          <textarea
            value={form.비고}
            onChange={(e) => setForm({ ...form, 비고: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            rows={2}
            placeholder="수기입력 사유"
          />
        </div>
      </form>
    </Modal>
  );
}
