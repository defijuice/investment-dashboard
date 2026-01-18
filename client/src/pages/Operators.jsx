import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw } from 'lucide-react';
import { fetchOperators } from '../api/client';

export default function Operators() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['operators', searchQuery, page],
    queryFn: () => fetchOperators({ search: searchQuery, page, limit: 50 }).then(res => res.data)
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  const operators = data?.data || [];
  const totalPages = data?.totalPages || 1;

  // 금액 포맷팅 (억원 단위, 단위 표시 없음)
  const formatAUM = (value) => {
    if (!value || value === 0) return '-';
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}조`;
    }
    return Math.round(value).toLocaleString();
  };

  // 승률 포맷팅 (% 표시 없음)
  const formatWinRate = (rate, selected, confirmed) => {
    if (!confirmed || confirmed === 0) return '-';
    return `${rate} (${selected}/${confirmed})`;
  };

  return (
    <div className="operators-page">
      <div className="page-header">
        <h1>운용사 목록</h1>
        <button className="btn-icon" onClick={() => refetch()}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Search */}
      <form className="search-bar" onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            placeholder="운용사명 또는 약어로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-search">검색</button>
      </form>

      {/* Results */}
      <div className="card">
        <div className="card-header">
          <h2>총 {data?.total || 0}개</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>운용사명</th>
              <th style={{ textAlign: 'right' }}>결성예정액(최근 5년, 억 원)</th>
              <th style={{ textAlign: 'right' }}>승률(최근 5년, %)</th>
            </tr>
          </thead>
          <tbody>
            {operators.map(op => (
              <tr
                key={op['ID']}
                onClick={() => navigate(`/operators/${op['ID']}`)}
                style={{ cursor: 'pointer' }}
              >
                <td className="link-cell">{op['운용사명']}</td>
                <td style={{ textAlign: 'right' }}>{formatAUM(op.recentAUM)}</td>
                <td style={{ textAlign: 'right' }}>{formatWinRate(op.winRate, op.selected, op.confirmed)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              이전
            </button>
            <span>{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
