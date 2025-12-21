import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api/client';
import DataTable from '../components/Table/DataTable';

export default function Projects() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    year: '',
    소관: '',
    search: ''
  });

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, filters],
    queryFn: () =>
      projectsApi
        .list({
          page,
          limit: 50,
          year: filters.year || undefined,
          소관: filters.소관 || undefined,
          search: filters.search || undefined
        })
        .then((res) => res.data)
  });

  const columns = [
    { key: 'ID', label: 'ID', width: '80px', sortable: true },
    { key: '사업명', label: '사업명', sortable: true },
    { key: '소관', label: '소관', width: '100px', sortable: true },
    { key: '공고유형', label: '공고유형', width: '100px' },
    { key: '연도', label: '연도', width: '80px', sortable: true },
    { key: '차수', label: '차수', width: '80px' },
    { key: '현황', label: '현황', width: '180px' }
  ];

  const years = ['2024', '2023', '2022', '2021'];
  const 소관Options = ['중기부', '문체부', '과기정통부', '특허청', '해수부', '환경부'];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">출자사업 관리</h2>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">전체 연도</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>

          <select
            value={filters.소관}
            onChange={(e) => setFilters({ ...filters, 소관: e.target.value })}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">전체 소관</option>
            {소관Options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="사업명 검색"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 border rounded-md flex-1 min-w-[200px]"
          />

          <button
            onClick={() => setFilters({ year: '', 소관: '', search: '' })}
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
