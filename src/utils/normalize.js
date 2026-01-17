/**
 * 운용사명 정규화 모듈 (전체 시스템에서 통일)
 *
 * 이 모듈은 운용사명 비교 시 일관된 정규화를 위해 사용됩니다.
 * 모든 파일에서 이 함수를 import하여 사용해야 합니다.
 */

/**
 * 운용사명 정규화 (전체 시스템에서 통일)
 * @param {string} name - 원본 운용사명
 * @returns {string} - 정규화된 이름
 */
export function normalizeName(name) {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/[()（）\[\]【】]/g, '')   // 괄호 제거
    .replace(/[,.\-_&]/g, ' ')          // 특수문자 → 공백
    .replace(/\s+/g, ' ')               // 연속 공백 제거
    .trim();
}

/**
 * 영문 접미사 제거 (비교 시에만 사용)
 * @param {string} name - 정규화된 이름
 * @returns {string} - 접미사 제거된 이름
 */
export function removeEnglishSuffix(name) {
  const suffixes = /\b(llc|inc|ltd|pte|limited|management|company|co|corp|corporation)\b/gi;
  return name.replace(suffixes, '').trim().replace(/\s+/g, ' ');
}

/**
 * 투자사 접미사 제거 (유사도 비교용)
 * @param {string} name - 정규화된 이름
 * @returns {string} - 접미사 제거된 이름
 */
export function removeInvestmentSuffix(name) {
  const suffixes = /(인베스트먼트|벤처스|파트너스|캐피탈|자산운용|투자|에셋)$/;
  return name.replace(suffixes, '').trim();
}

/**
 * 정규화 후 영문 접미사까지 제거 (비교용 헬퍼)
 * @param {string} name - 원본 운용사명
 * @returns {string} - 완전 정규화된 이름
 */
export function normalizeForComparison(name) {
  const normalized = normalizeName(name);
  return removeEnglishSuffix(normalized);
}
