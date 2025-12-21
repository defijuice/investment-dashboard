/**
 * 파일 현황 통계 수집 및 현황 문자열 생성 유틸리티
 */

/**
 * 공동GP 분리 및 통계 수집
 * @param {string} line - 운용사명이 포함된 줄
 * @param {Object} stats - 통계 객체 (참조로 업데이트)
 * @returns {string[]} 분리된 운용사명 배열
 */
export function splitJointGPWithStats(line, stats) {
  const partners = line.split(/\s*[\/,]\s*/).map(s => s.trim()).filter(s => s.length > 0);

  if (partners.length > 1) {
    stats.totalJointGPCount++;
    stats.jointGPGroups[partners.length] = (stats.jointGPGroups[partners.length] || 0) + 1;
  }

  return partners;
}

/**
 * 접수현황 파일 통계 객체 초기화
 * @returns {Object} 초기화된 통계 객체
 */
export function createApplicationStats() {
  return {
    originalCount: 0,       // PDF 원본 조합 수 (분리 전)
    jointGPGroups: {},      // { 2: 10, 3: 2 } - N개조합별 건수
    totalJointGPCount: 0,   // 공동GP 포함 조합 총 수
    finalCount: 0           // 분리 후 최종 신청현황 수
  };
}

/**
 * 선정결과 파일 통계 객체 초기화
 * @returns {Object} 초기화된 통계 객체
 */
export function createSelectionStats() {
  return {
    totalInPdf: 0,          // PDF 기재 총 건수
    selectedCount: 0        // 선정 건수
  };
}

/**
 * 접수현황 파일의 현황 문자열 생성
 * @param {Object} stats - 통계 객체
 * @returns {string} 현황 문자열
 *
 * 형식: "신청조합 N개, 공동GP N개(2개조합 N건, 3개조합 N건), 총 신청현황 N건"
 */
export function formatApplicationFileSummary(stats) {
  let summary = `신청조합 ${stats.originalCount}개`;

  if (stats.totalJointGPCount > 0) {
    const groupDetails = Object.entries(stats.jointGPGroups)
      .filter(([_, count]) => count > 0)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([size, count]) => `${size}개조합 ${count}건`)
      .join(', ');

    summary += `, 공동GP ${stats.totalJointGPCount}개(${groupDetails})`;
  }

  summary += `, 총 신청현황 ${stats.finalCount}건`;

  return summary;
}

/**
 * 선정결과 파일의 현황 문자열 생성
 * @param {Object} stats - 통계 객체
 * @returns {string} 현황 문자열
 *
 * 형식: "총 N개 중 선정 N건"
 */
export function formatSelectionFileSummary(stats) {
  return `총 ${stats.totalInPdf}개 중 선정 ${stats.selectedCount}건`;
}

/**
 * 파일유형에 따른 현황 문자열 생성
 * @param {string} fileType - '접수현황' 또는 '선정결과'
 * @param {Object} stats - 통계 객체
 * @returns {string} 현황 문자열
 */
export function formatFileSummary(fileType, stats) {
  if (fileType === '접수현황') {
    return formatApplicationFileSummary(stats);
  } else if (fileType === '선정결과') {
    return formatSelectionFileSummary(stats);
  }
  return '';
}
