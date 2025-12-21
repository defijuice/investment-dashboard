import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../api/client';

function StatCard({ title, value, icon, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => statsApi.dashboard().then((res) => res.data)
  });

  const { data: topOperators } = useQuery({
    queryKey: ['topOperators'],
    queryFn: () => statsApi.topOperators({ limit: 10, years: 3 }).then((res) => res.data)
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const { summary, statusCounts, fileCounts, recentFiles } = dashboardData || {};

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">대시보드</h2>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="전체 운용사"
          value={summary?.totalOperators || 0}
          icon="🏢"
          color="blue"
        />
        <StatCard
          title="출자사업"
          value={summary?.totalProjects || 0}
          icon="📁"
          color="purple"
        />
        <StatCard
          title="전체 신청현황"
          value={summary?.totalApplications || 0}
          icon="📋"
          color="green"
        />
        <StatCard
          title="처리 대기 파일"
          value={fileCounts?.대기 || 0}
          icon="📄"
          color="yellow"
        />
      </div>

      {/* 상태별 통계 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">신청현황 상태</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {statusCounts?.선정 || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">선정</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {statusCounts?.탈락 || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">탈락</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">
              {statusCounts?.접수 || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">접수</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 운용사 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            Top 운용사 (최근 {topOperators?.period?.startYear}~{topOperators?.period?.endYear})
          </h3>
          <div className="space-y-3">
            {topOperators?.data?.slice(0, 5).map((op, index) => (
              <div
                key={op.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                    {index + 1}
                  </span>
                  <span className="font-medium">{op.name}</span>
                </div>
                <span className="text-sm text-gray-500">
                  선정 {op.selectedCount}건
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 최근 처리 파일 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">최근 처리 파일</h3>
          <div className="space-y-3">
            {recentFiles?.length > 0 ? (
              recentFiles.map((file) => (
                <div
                  key={file.ID}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{file['파일명']}</div>
                    <div className="text-xs text-gray-500">
                      {file['처리일시']}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      file['처리상태'] === '완료'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {file['처리상태']}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-4">
                처리된 파일이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
