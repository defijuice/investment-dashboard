/**
 * Google Drive 문서 캡처 유틸리티
 *
 * Playwright MCP를 통해 Google Drive 뷰어에서 여러 페이지 문서를 캡처합니다.
 * HWP, PDF 등 Google Drive에서 미리보기 가능한 파일을 지원합니다.
 *
 * 사용법 (Claude Code에서):
 * 1. mcp__playwright__browser_navigate로 Google Drive URL 열기
 * 2. captureAllPages() 로직을 따라 페이지별 캡처
 * 3. 캡처된 이미지들을 Read 도구로 분석
 */

/**
 * Google Drive 뷰어에서 페이지 정보를 파싱합니다.
 *
 * @param {string} snapshot - Playwright snapshot YAML
 * @returns {{ currentPage: number, totalPages: number } | null}
 *
 * @example
 * // snapshot에서 "1 / 5" 또는 "페이지 1/5" 형태 파싱
 * parsePageInfo(snapshot) // { currentPage: 1, totalPages: 5 }
 */
export function parsePageInfo(snapshot) {
  // 패턴 1: "1 / 5" 형태
  const pattern1 = /(\d+)\s*\/\s*(\d+)/;
  // 패턴 2: "페이지 1/5" 형태
  const pattern2 = /페이지\s*(\d+)\s*\/\s*(\d+)/;
  // 패턴 3: textbox에 현재 페이지, 별도로 총 페이지
  const pattern3 = /textbox[^:]*:\s*"(\d+)"[\s\S]*?generic[^:]*:\s*"\/"\s*[\s\S]*?generic[^:]*:\s*"(\d+)"/;

  for (const pattern of [pattern2, pattern1, pattern3]) {
    const match = snapshot.match(pattern);
    if (match) {
      return {
        currentPage: parseInt(match[1], 10),
        totalPages: parseInt(match[2], 10)
      };
    }
  }

  return null;
}

/**
 * 다음 페이지로 이동하는 방법들
 *
 * Google Drive 뷰어에서 다음 페이지로 이동하는 방법:
 * 1. ArrowDown 또는 PageDown 키 누르기
 * 2. 페이지 입력 필드에 페이지 번호 입력
 * 3. 스크롤 (일부 뷰어)
 */
export const NAVIGATION_METHODS = {
  // 키보드로 다음 페이지
  ARROW_DOWN: 'ArrowDown',
  PAGE_DOWN: 'PageDown',
  ARROW_RIGHT: 'ArrowRight',

  // 키보드로 이전 페이지
  ARROW_UP: 'ArrowUp',
  PAGE_UP: 'PageUp',
  ARROW_LEFT: 'ArrowLeft'
};

/**
 * 캡처 결과 객체
 * @typedef {Object} CaptureResult
 * @property {number} pageNumber - 페이지 번호
 * @property {string} filename - 저장된 파일명
 * @property {string} filepath - 전체 파일 경로
 */

/**
 * 여러 페이지 캡처를 위한 설정
 * @typedef {Object} CaptureConfig
 * @property {string} outputDir - 출력 디렉토리 (기본: .playwright-mcp)
 * @property {string} filenamePrefix - 파일명 접두사
 * @property {number} waitBetweenPages - 페이지 간 대기 시간 (ms)
 * @property {number} maxPages - 최대 캡처 페이지 수 (0 = 무제한)
 */

/**
 * 기본 캡처 설정
 */
export const DEFAULT_CAPTURE_CONFIG = {
  outputDir: '.playwright-mcp',
  filenamePrefix: 'page',
  waitBetweenPages: 1000,
  maxPages: 0
};

/**
 * Claude Code에서 여러 페이지 캡처를 위한 가이드
 *
 * 이 함수는 실제로 실행되지 않고, Claude Code가 참조할 수 있는
 * 단계별 가이드를 제공합니다.
 *
 * @returns {string[]} 캡처 단계 설명
 */
export function getCaptureGuide() {
  return [
    '=== Google Drive 다중 페이지 캡처 가이드 ===',
    '',
    '1. Google Drive URL로 이동:',
    '   mcp__playwright__browser_navigate({ url: "https://drive.google.com/file/d/..." })',
    '',
    '2. 페이지 로딩 대기 (2초):',
    '   mcp__playwright__browser_wait_for({ time: 2 })',
    '',
    '3. 스냅샷으로 페이지 정보 확인:',
    '   mcp__playwright__browser_snapshot({})',
    '   → "1 / N" 형태에서 총 페이지 수 파악',
    '',
    '4. 첫 페이지 캡처:',
    '   mcp__playwright__browser_take_screenshot({ filename: "page_1.png" })',
    '',
    '5. 다음 페이지로 이동 (N-1번 반복):',
    '   mcp__playwright__browser_press_key({ key: "ArrowDown" })',
    '   또는',
    '   mcp__playwright__browser_press_key({ key: "PageDown" })',
    '',
    '6. 페이지 전환 대기 (1초):',
    '   mcp__playwright__browser_wait_for({ time: 1 })',
    '',
    '7. 현재 페이지 캡처:',
    '   mcp__playwright__browser_take_screenshot({ filename: "page_N.png" })',
    '',
    '8. 5-7 반복하여 모든 페이지 캡처',
    '',
    '9. 캡처된 이미지 분석:',
    '   Read 도구로 각 이미지 파일 읽기',
    '',
    '10. 브라우저 닫기:',
    '    mcp__playwright__browser_close({})'
  ];
}

/**
 * 파일명 생성
 * @param {string} prefix - 파일명 접두사
 * @param {number} pageNum - 페이지 번호
 * @param {number} totalPages - 총 페이지 수 (자릿수 계산용)
 * @returns {string} 생성된 파일명
 */
export function generateFilename(prefix, pageNum, totalPages) {
  const digits = String(totalPages).length;
  const paddedNum = String(pageNum).padStart(digits, '0');
  return `${prefix}_page_${paddedNum}.png`;
}

/**
 * Google Drive 뷰어 타입 감지
 * @param {string} snapshot - Playwright snapshot
 * @returns {'docs' | 'pdf' | 'hwp' | 'unknown'}
 */
export function detectViewerType(snapshot) {
  if (snapshot.includes('.pdf')) return 'pdf';
  if (snapshot.includes('.hwp')) return 'hwp';
  if (snapshot.includes('.doc')) return 'docs';
  return 'unknown';
}

/**
 * 뷰어 타입에 따른 네비게이션 키 반환
 * @param {'docs' | 'pdf' | 'hwp' | 'unknown'} viewerType
 * @returns {string} 권장 네비게이션 키
 */
export function getNavigationKey(viewerType) {
  switch (viewerType) {
    case 'pdf':
      return NAVIGATION_METHODS.PAGE_DOWN;
    case 'hwp':
    case 'docs':
      return NAVIGATION_METHODS.ARROW_DOWN;
    default:
      return NAVIGATION_METHODS.ARROW_DOWN;
  }
}

// CLI 실행 시 가이드 출력
if (process.argv[1]?.endsWith('gdrive-capture.js')) {
  console.log(getCaptureGuide().join('\n'));
}
