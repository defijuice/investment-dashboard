import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw } from 'lucide-react';
import { fetchProjects } from '../api/client';

export default function Projects() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [year, setYear] = useState('');
  const [institution, setInstitution] = useState('');
  const [announcementType, setAnnouncementType] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['projects', appliedSearch, year, institution, announcementType, page],
    queryFn: () => fetchProjects({
      search: appliedSearch,
      year,
      소관: institution,
      공고유형: announcementType,
      page,
      limit: 50
    }).then(res => res.data)
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setAppliedSearch(searchInput);
    setPage(1);
  };

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  const projects = data?.data || [];
  const totalPages = data?.totalPages || 1;

  // 연도 옵션 생성 (2020년부터 현재까지)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

  // 소관 기관 옵션
  const institutions = ['중기부', '문체부', '과기정통부', '해수부', '특허청', '부산시', '경기도'];

  // 공고유형 옵션
  const announcementTypes = ['정시', '수시'];

  return (
    <div className="projects-page">
      <div className="page-header">
        <h1>출자사업 목록</h1>
        <button className="btn-icon" onClick={() => refetch()}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filters */}
      <form className="search-bar" onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            placeholder="사업명으로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          value={year}
          onChange={(e) => { setYear(e.target.value); setPage(1); }}
        >
          <option value="">전체 연도</option>
          {years.map(y => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <select
          value={institution}
          onChange={(e) => { setInstitution(e.target.value); setPage(1); }}
        >
          <option value="">전체 소관</option>
          {institutions.map(inst => (
            <option key={inst} value={inst}>{inst}</option>
          ))}
        </select>
        <select
          value={announcementType}
          onChange={(e) => { setAnnouncementType(e.target.value); setPage(1); }}
        >
          <option value="">전체 유형</option>
          {announcementTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
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
              <th>연도</th>
              <th>사업명</th>
              <th>소관</th>
              <th>차수</th>
              <th>공고유형</th>
              <th>현황</th>
              <th>경쟁률</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => (
              <tr
                key={project['ID']}
                onClick={() => navigate(`/projects/${project['ID']}`)}
                style={{ cursor: 'pointer' }}
              >
                <td>{project['연도'] || '-'}</td>
                <td className="link-cell">
                  <div>{project['사업명']}</div>
                  {project['출자분야목록']?.length > 0 && (
                    <div className="category-tags">
                      {project['출자분야목록'].map((cat, idx) => (
                        <span key={idx} className="category-tag">{cat}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td>{project['소관'] || '-'}</td>
                <td>{project['차수'] || '-'}</td>
                <td>{project['공고유형'] || '-'}</td>
                <td>{project['현황'] || '-'}</td>
                <td>
                  {project['경쟁률'] ? (
                    <span className="competition-rate">{project['경쟁률']}</span>
                  ) : '-'}
                </td>
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
