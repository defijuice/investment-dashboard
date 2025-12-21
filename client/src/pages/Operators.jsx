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
              <th>ID</th>
              <th>운용사명</th>
              <th>약어</th>
              <th>유형</th>
              <th>국가</th>
            </tr>
          </thead>
          <tbody>
            {operators.map(op => (
              <tr
                key={op['ID']}
                onClick={() => navigate(`/operators/${op['ID']}`)}
                style={{ cursor: 'pointer' }}
              >
                <td>{op['ID']}</td>
                <td className="link-cell">{op['운용사명']}</td>
                <td>{op['약어'] || '-'}</td>
                <td>{op['유형'] || '-'}</td>
                <td>{op['국가'] || '-'}</td>
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
