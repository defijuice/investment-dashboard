import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Google Tag Manager 페이지 전환 추적 훅
 * PublicLayout에서만 사용 (Admin은 추적하지 않음)
 *
 * GTM 스크립트는 index.html에 직접 삽입됨
 */
export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // GTM dataLayer에 페이지뷰 이벤트 푸시
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'pageview',
        page_path: location.pathname + location.search,
        page_title: document.title
      });
    }
  }, [location]);
}

/**
 * GTM 초기화 함수 (레거시 호환용)
 * GTM은 이제 index.html에서 직접 로드되므로 이 함수는 no-op
 */
export function initializeAnalytics() {
  // GTM은 index.html에서 직접 로드됨
  // 이 함수는 하위 호환성을 위해 유지
}

export default useAnalytics;
