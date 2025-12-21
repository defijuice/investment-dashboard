import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorsApi } from '../api/client';
import DataTable from '../components/Table/DataTable';
import Modal from '../components/Modal/Modal';

export default function Operators() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingOperator, setEditingOperator] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['operators', page, search],
    queryFn: () =>
      operatorsApi
        .list({ page, limit: 50, search: search || undefined })
        .then((res) => res.data)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => operatorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      setEditingOperator(null);
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => operatorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      setIsCreateModalOpen(false);
    }
  });

  const columns = [
    { key: 'ID', label: 'ID', width: '80px', sortable: true },
    { key: '운용사명', label: '운용사명', sortable: true },
    { key: '약어', label: '약어', width: '150px' },
    { key: '유형', label: '유형', width: '100px' },
    { key: '국가', label: '국가', width: '80px' },
    {
      key: 'actions',
      label: '',
      width: '60px',
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingOperator(row);
          }}
          className="text-blue-600 hover:text-blue-800"
        >
          편집
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">운용사 관리</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          + 운용사 추가
        </button>
      </div>

      {/* 검색 */}
      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          placeholder="운용사명 또는 약어 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-3 py-2 border rounded-md"
        />
      </div>

      {/* 테이블 */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        pagination={{
          page: data?.page || 1,
          total: data?.total || 0,
          totalPages: data?.totalPages || 1
        }}
        onPageChange={setPage}
      />

      {/* 편집 모달 */}
      {editingOperator && (
        <OperatorModal
          operator={editingOperator}
          onClose={() => setEditingOperator(null)}
          onSave={(data) => updateMutation.mutate({ id: editingOperator.ID, data })}
          loading={updateMutation.isPending}
          title={`운용사 편집 - ${editingOperator.ID}`}
        />
      )}

      {/* 생성 모달 */}
      {isCreateModalOpen && (
        <OperatorModal
          onClose={() => setIsCreateModalOpen(false)}
          onSave={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
          title="운용사 추가"
        />
      )}
    </div>
  );
}

function OperatorModal({ operator, onClose, onSave, loading, title }) {
  const [form, setForm] = useState({
    운용사명: operator?.['운용사명'] || '',
    약어: operator?.['약어'] || '',
    유형: operator?.['유형'] || '국내VC',
    국가: operator?.['국가'] || '한국'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
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
            disabled={loading || !form.운용사명}
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
            운용사명 *
          </label>
          <input
            type="text"
            value={form.운용사명}
            onChange={(e) => setForm({ ...form, 운용사명: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            약어
          </label>
          <input
            type="text"
            value={form.약어}
            onChange={(e) => setForm({ ...form, 약어: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="예: KB, 한투"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              유형
            </label>
            <select
              value={form.유형}
              onChange={(e) => setForm({ ...form, 유형: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="국내VC">국내VC</option>
              <option value="해외VC">해외VC</option>
              <option value="CVC">CVC</option>
              <option value="금융계열">금융계열</option>
              <option value="기술지주">기술지주</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              국가
            </label>
            <select
              value={form.국가}
              onChange={(e) => setForm({ ...form, 국가: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="한국">한국</option>
              <option value="미국">미국</option>
              <option value="중국">중국</option>
              <option value="일본">일본</option>
              <option value="유럽">유럽</option>
              <option value="기타">기타</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
