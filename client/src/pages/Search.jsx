import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Download, X, Loader2 } from 'lucide-react';
import { searchApplicationsAdvanced, fetchSearchOptions } from '../api/client';

export default function Search() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    gpType: 'all',
    years: 'all',
    category: '',
    institution: '',
    status: '',
    search: ''
  });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');

  const { data: options } = useQuery({
    queryKey: ['searchOptions'],
    queryFn: () => fetchSearchOptions().then(res => res.data)
  });

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['searchResults', filters, page],
    queryFn: () => searchApplicationsAdvanced({ ...filters, page, limit: 50 }).then(res => res.data),
    keepPreviousData: true  // 새 데이터 로딩 중에도 이전 데이터 표시
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchInput }));
    setPage(1);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setFilters({
      gpType: 'all',
      years: 'all',
      category: '',
      institution: '',
      status: '',
      search: ''
    });
    setSearchInput('');
    setPage(1);
  };

  const exportToCSV = () => {
    if (!results?.data) return;

    const headers = ['운용사명', '사업명', '출자분야', '상태', '결성예정액', '소관', '연도'];
    const rows = results.data.map(app => [
      app['운용사명'],
      app['사업명'],
      app['출자분야'],
      app['상태'],
      app['결성예정액'],
      app['소관'],
      app['연도']
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `search_results_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const hasActiveFilters = filters.category || filters.institution || filters.status ||
    filters.gpType !== 'all' || filters.years !== 'all' || filters.search;

  return (
    <div className="search-page">
      <div className="page-header">
        <h1>검색 / 필터링</h1>
        {hasActiveFilters && (
          <button className="btn-clear" onClick={clearFilters}>
            <X size={16} />
            필터 초기화
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <SearchIcon size={18} />
          <input
            type="text"
            placeholder="운용사명, 사업명, 분야 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </div>
        <button className="btn-search" onClick={handleSearch} disabled={isFetching}>
          {isFetching ? <Loader2 size={16} className="spin" /> : null}
          검색
        </button>
      </div>

      {/* Filters */}
      <div className="filters-panel">
        <div className="filter-group">
          <label>GP 형태</label>
          <div className="filter-buttons">
            {options?.gpTypes?.map(gp => (
              <button
                key={gp.value}
                className={`filter-btn ${filters.gpType === gp.value ? 'active' : ''}`}
                onClick={() => handleFilterChange('gpType', gp.value)}
              >
                {gp.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>기간</label>
          <div className="filter-buttons">
            {options?.periodOptions?.map(period => (
              <button
                key={period.value}
                className={`filter-btn ${filters.years === period.value ? 'active' : ''}`}
                onClick={() => handleFilterChange('years', period.value)}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>기관 (소관)</label>
          <select
            value={filters.institution}
            onChange={(e) => handleFilterChange('institution', e.target.value)}
          >
            <option value="">전체</option>
            {options?.institutions?.map(inst => (
              <option key={inst} value={inst}>{inst}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>출자분야</label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">전체</option>
            {options?.categories?.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>상태</label>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filters.status === '' ? 'active' : ''}`}
              onClick={() => handleFilterChange('status', '')}
            >
              전체
            </button>
            {options?.statuses?.map(status => (
              <button
                key={status}
                className={`filter-btn status-${status} ${filters.status === status ? 'active' : ''}`}
                onClick={() => handleFilterChange('status', status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Stats */}
      {results?.stats && (
        <div className="results-stats">
          <div className="stats-summary">
            <span className="total">총 {results.stats.total}건 ({results.totalGroups || 0}개 사업)</span>
            <span className="selected">선정: {results.stats.selected}</span>
            <span className="rejected">탈락: {results.stats.rejected}</span>
            <span className="pending">접수: {results.stats.pending}</span>
            <span className="divider">|</span>
            <span className="sole">단독GP: {results.stats.sole}</span>
            <span className="cogp">공동GP: {results.stats.coGP}</span>
          </div>
          <button className="btn-export" onClick={exportToCSV}>
            <Download size={16} />
            CSV 다운로드
          </button>
        </div>
      )}

      {/* Results - Grouped by Project */}
      {isLoading && !results ? (
        <div className="loading">검색 중...</div>
      ) : (
        <div className={`results-grouped-container ${isFetching ? 'fetching' : ''}`}>
          {isFetching && (
            <div className="fetching-overlay">
              <Loader2 size={24} className="spin" />
              <span>검색 중...</span>
            </div>
          )}
          {results?.grouped?.map((group) => (
            <div key={group.projectId} className="project-group card">
              <div
                className="project-group-header"
                onClick={() => navigate(`/projects/${group.projectId}`)}
              >
                <div className="project-info">
                  <span className="project-year">{group.연도}</span>
                  <h3 className="project-name">{group.projectName}</h3>
                  <span className="project-institution">{group.소관}</span>
                </div>
                <div className="project-stats">
                  <span className="app-count">{group.applications.length}건</span>
                </div>
              </div>
              <table className="results-table">
                <thead>
                  <tr>
                    <th>운용사명</th>
                    <th>출자분야</th>
                    <th>최소결성규모</th>
                    <th>상태</th>
                    <th>GP형태</th>
                  </tr>
                </thead>
                <tbody>
                  {group.applications.map((app, idx) => (
                    <tr key={app['ID'] || idx}>
                      <td
                        className="link-cell"
                        onClick={() => navigate(`/operators/${app['운용사ID']}`)}
                      >
                        {app['운용사명']}
                      </td>
                      <td>{app['출자분야']}</td>
                      <td>{(app['최소결성규모'] || app['결성예정액']) ? `${app['최소결성규모'] || app['결성예정액']}억원` : '-'}</td>
                      <td>
                        <span className={`status-badge ${app['상태']}`}>
                          {app['상태']}
                        </span>
                      </td>
                      <td>
                        <span className={`gp-badge ${app.isCoGP ? 'cogp' : 'sole'}`}>
                          {app.isCoGP ? '공동GP' : '단독'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {(!results?.grouped || results.grouped.length === 0) && (
            <div className="no-results">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {results?.totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            이전
          </button>
          <span>{page} / {results.totalPages}</span>
          <button
            disabled={page === results.totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
