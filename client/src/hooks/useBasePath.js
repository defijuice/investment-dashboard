import { useLocation } from 'react-router-dom';

/**
 * 현재 경로가 admin인지 dashboard인지 감지하여
 * 적절한 base path를 반환하는 훅
 *
 * @returns {{ basePath: string, isAdmin: boolean, getPath: (path: string) => string }}
 */
export function useBasePath() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const basePath = isAdmin ? '/admin' : '/dashboard';

  /**
   * 상대 경로를 현재 컨텍스트(admin/dashboard)에 맞는 절대 경로로 변환
   * @param {string} path - 상대 경로 (예: 'operators', 'projects')
   * @returns {string} 절대 경로 (예: '/admin/operators', '/dashboard/operators')
   */
  const getPath = (path) => {
    if (path.startsWith('/')) {
      // 이미 절대 경로인 경우 그대로 반환
      return path;
    }
    return `${basePath}/${path}`;
  };

  return { basePath, isAdmin, getPath };
}

export default useBasePath;
