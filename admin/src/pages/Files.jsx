import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { filesApi } from '../api/client';
import DataTable from '../components/Table/DataTable';

const STATUS_COLORS = {
  완료: 'bg-green-100 text-green-700',
  대기: 'bg-yellow-100 text-yellow-700',
  제외: 'bg-gray-100 text-gray-500'
};

export default function Files() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    처리상태: '',
    파일유형: '',
    search: ''
  });

  const { data, isLoading } = useQuery({
    queryKey: ['files', page, filters],
    queryFn: () =>
      filesApi
        .list({
          page,
          limit: 50,
          처리상태: filters.처리상태 || undefined,
          파일유형: filters.파일유형 || undefined,
          search: filters.search || undefined
        })
        .then((res) => res.data)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => filesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    }
  });

  const handleStatusChange = (file, newStatus) => {
    updateMutation.mutate({ id: file.ID, data: { 처리상태: newStatus } });
  };

  const columns = [
    { key: 'ID', label: 'ID', width: '80px', sortable: true },
    { key: '파일명', label: '파일명', sortable: true },
    { key: '파일번호', label: '파일번호', width: '100px' },
    {
      key: '파일유형',
      label: '유형',
      width: '100px',
      render: (value) => (
        <span
          className={`px-2 py-1 text-xs rounded ${
            value === '선정결과'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-purple-100 text-purple-700'
          }`}
        >
          {value}
        </span>
      )
    },
    {
      key: '처리상태',
      label: '처리상태',
      width: '100px',
      render: (value, row) => (
        <select
          value={value}
          onChange={(e) => handleStatusChange(row, e.target.value)}
          className={`px-2 py-1 text-xs rounded border-0 ${STATUS_COLORS[value] || ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="대기">대기</option>
          <option value="완료">완료</option>
          <option value="제외">제외</option>
        </select>
      )
    },
    { key: '처리일시', label: '처리일시', width: '150px' },
    { key: '현황', label: '현황', width: '180px' },
    {
      key: 'actions',
      label: '',
      width: '80px',
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/files/${row.ID}/compare`);
          }}
          className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
        >
          비교
        </button>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">파일 관리</h2>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.처리상태}
            onChange={(e) => setFilters({ ...filters, 처리상태: e.target.value })}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">전체 상태</option>
            <option value="대기">대기</option>
            <option value="완료">완료</option>
            <option value="제외">제외</option>
          </select>

          <select
            value={filters.파일유형}
            onChange={(e) => setFilters({ ...filters, 파일유형: e.target.value })}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">전체 유형</option>
            <option value="접수현황">접수현황</option>
            <option value="선정결과">선정결과</option>
          </select>

          <input
            type="text"
            placeholder="파일명 또는 파일번호 검색"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 border rounded-md flex-1 min-w-[200px]"
          />

          <button
            onClick={() => setFilters({ 처리상태: '', 파일유형: '', search: '' })}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            초기화
          </button>
        </div>
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
    </div>
  );
}
