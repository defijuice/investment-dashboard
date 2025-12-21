import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { filesApi } from '../api/client';

const STATUS_COLORS = {
  선정: 'bg-green-100 text-green-700',
  탈락: 'bg-red-100 text-red-700',
  접수: 'bg-gray-100 text-gray-700'
};

export default function FileCompare() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');

  // 파일 정보 및 연결된 신청현황 조회
  const { data, isLoading, error } = useQuery({
    queryKey: ['file-applications', id],
    queryFn: () => filesApi.getApplications(id).then((res) => res.data.data)
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">오류: {error.message}</div>
      </div>
    );
  }

  const { file, linkedProjects, applications, stats } = data;

  // 필터링
  let filteredApps = applications;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredApps = filteredApps.filter(
      (app) =>
        app['운용사명']?.toLowerCase().includes(term) ||
        app['출자분야']?.toLowerCase().includes(term)
    );
  }
  if (statusFilter !== '전체') {
    filteredApps = filteredApps.filter((app) => app['상태'] === statusFilter);
  }
  if (categoryFilter !== '전체') {
    filteredApps = filteredApps.filter((app) => app['출자분야'] === categoryFilter);
  }

  // 출자분야 목록 추출
  const categories = [...new Set(applications.map((app) => app['출자분야']).filter(Boolean))];

  // Google Drive PDF 뷰어 URL 생성
  const fileUrl = file['파일URL'];
  const driveFileId = fileUrl?.match(/\/d\/([^/]+)/)?.[1] || fileUrl?.match(/id=([^&]+)/)?.[1];
  const pdfViewerUrl = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/preview`
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/files')}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 목록으로
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">파일 비교</h1>
              <p className="text-sm text-gray-500">{file['파일명']}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className={`px-3 py-1 rounded ${file['파일유형'] === '선정결과' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {file['파일유형']}
            </span>
            <span className="text-gray-600">
              연결된 사업: {linkedProjects.map((p) => p.name).join(', ') || '없음'}
            </span>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 - 2분할 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: PDF 뷰어 */}
        <div className="w-1/2 border-r bg-gray-100 flex flex-col">
          <div className="bg-white px-4 py-2 border-b flex items-center justify-between">
            <span className="font-medium text-gray-700">원본 PDF</span>
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                새 탭에서 열기 ↗
              </a>
            )}
          </div>
          <div className="flex-1">
            {pdfViewerUrl ? (
              <iframe
                src={pdfViewerUrl}
                className="w-full h-full"
                frameBorder="0"
                allow="autoplay"
                title="PDF Viewer"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="mb-2">PDF URL이 없거나 미리보기를 지원하지 않습니다.</p>
                  {fileUrl && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      파일 링크 열기
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 신청현황 테이블 */}
        <div className="w-1/2 flex flex-col bg-white">
          {/* 통계 */}
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-6 text-sm">
              <span className="font-medium text-gray-700">
                신청현황 ({stats.total}건)
              </span>
              <span className="text-green-600">선정 {stats.선정}</span>
              <span className="text-red-600">탈락 {stats.탈락}</span>
              <span className="text-gray-600">접수 {stats.접수}</span>
            </div>
          </div>

          {/* 필터 */}
          <div className="px-4 py-3 border-b flex gap-3">
            <input
              type="text"
              placeholder="운용사명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-1.5 border rounded text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value="전체">전체 상태</option>
              <option value="접수">접수</option>
              <option value="선정">선정</option>
              <option value="탈락">탈락</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 border rounded text-sm"
            >
              <option value="전체">전체 분야</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* 테이블 */}
          <div className="flex-1 overflow-auto">
            {linkedProjects.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="mb-2">이 파일에 연결된 출자사업이 없습니다.</p>
                  <p className="text-sm">출자사업에서 파일을 연결해주세요.</p>
                </div>
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                검색 결과가 없습니다.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">운용사명</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">출자분야</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">결성예정액</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-600">상태</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredApps.map((app) => (
                    <tr key={app.ID} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{app['운용사명']}</td>
                      <td className="px-4 py-2 text-gray-600">{app['출자분야']}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {app['결성예정액'] ? `${app['결성예정액']}${app['통화단위'] || '억원'}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[app['상태']] || ''}`}>
                          {app['상태']}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{app['비고']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 푸터 */}
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500">
            표시: {filteredApps.length} / 전체: {applications.length}건
          </div>
        </div>
      </div>
    </div>
  );
}
