import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw } from 'lucide-react';
import { fetchProjects } from '../api/client';
import DetailDrawer from '../components/DetailDrawer';
import ProjectDetailContent from './ProjectDetailContent';

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL에서 초기값 읽기
  const initialSearch = searchParams.get('search') || '';
  const initialYear = searchParams.get('year') || '';
  const initialInstitution = searchParams.get('institution') || '';
  const initialAnnouncementType = searchParams.get('type') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [year, setYear] = useState(initialYear);
  const [institution, setInstitution] = useState(initialInstitution);
  const [announcementType, setAnnouncementType] = useState(initialAnnouncementType);
  const [page, setPage] = useState(initialPage);

  // Drawer 상태 (URL 변경 없이 State로 관리)
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // 상태 변경 시 URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams();
    if (appliedSearch) params.set('search', appliedSearch);
    if (year) params.set('year', year);
    if (institution) params.set('institution', institution);
    if (announcementType) params.set('type', announcementType);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [appliedSearch, year, institution, announcementType, page, setSearchParams]);

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

  // 선택된 프로젝트 정보
  const selectedProject = projects.find(p => p['ID'] === selectedProjectId);

  // 검색 결과 평균 통계 계산
  const avgStats = (() => {
    if (!projects.length) return null;

    // 경쟁률 평균 (경쟁률이 있는 것만)
    const competitionRates = projects
      .map(p => parseFloat(p['경쟁률']))
      .filter(r => !isNaN(r) && r > 0);
    const avgCompetitionRate = competitionRates.length > 0
      ? (competitionRates.reduce((a, b) => a + b, 0) / competitionRates.length).toFixed(2)
      : null;

    // 모태출자비율 평균 (비율이 있는 것만)
    const motaeRatios = projects
      .map(p => p.motaeRatio)
      .filter(r => r != null && !isNaN(r));
    const avgMotaeRatio = motaeRatios.length > 0
      ? Math.round(motaeRatios.reduce((a, b) => a + b, 0) / motaeRatios.length)
      : null;

    return {
      avgCompetitionRate,
      avgMotaeRatio,
      competitionRateCount: competitionRates.length,
      motaeRatioCount: motaeRatios.length
    };
  })();

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

      {/* 검색 결과 평균 통계 */}
      {avgStats && (avgStats.avgCompetitionRate || avgStats.avgMotaeRatio) && (
        <div className="search-stats-summary">
          {avgStats.avgCompetitionRate && (
            <div className="stat-item">
              <span className="stat-label">평균 경쟁률</span>
              <span className="stat-value">{avgStats.avgCompetitionRate}:1</span>
              <span className="stat-count">({avgStats.competitionRateCount}개 사업 기준)</span>
            </div>
          )}
          {avgStats.avgMotaeRatio && (
            <div className="stat-item">
              <span className="stat-label">평균 모태출자비율</span>
              <span className="stat-value">{avgStats.avgMotaeRatio}%</span>
              <span className="stat-count">({avgStats.motaeRatioCount}개 사업 기준)</span>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      <div className="card">
        <div className="card-header">
          <h2>총 {data?.total || 0}개</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>순번</th>
              <th>연도</th>
              <th>사업명</th>
              <th>소관</th>
              <th>차수</th>
              <th>공고유형</th>
              <th>현황</th>
              <th>경쟁률</th>
              <th style={{ textAlign: 'right' }}>모태출자비율(%)</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, index) => (
              <tr
                key={project['ID']}
                onClick={() => setSelectedProjectId(project['ID'])}
                style={{ cursor: 'pointer' }}
                className={selectedProjectId === project['ID'] ? 'selected-row' : ''}
              >
                <td style={{ textAlign: 'center', color: 'var(--gray-500)' }}>{(page - 1) * 50 + index + 1}</td>
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
                <td style={{ textAlign: 'right' }}>
                  {project.motaeRatio != null ? project.motaeRatio : '-'}
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

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
        title={selectedProject?.['사업명'] || '출자사업 상세'}
        width="800px"
      >
        {selectedProjectId && (
          <ProjectDetailContent id={selectedProjectId} />
        )}
      </DetailDrawer>
    </div>
  );
}
