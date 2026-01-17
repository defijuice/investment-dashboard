/**
 * 운용사 유사도 매칭 모듈
 *
 * 신규 운용사 등록 전 기존 운용사와 유사도를 검사하여
 * 중복 등록을 방지하고 사용자 확인을 요청
 */

import { normalizeName } from '../utils/normalize.js';

/**
 * 한글 자모 분해 (초성/중성/종성)
 */
const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNGSUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONGSUNG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

/**
 * 한글 문자열을 자모로 분해
 */
function decomposeHangul(str) {
  let result = '';
  for (const char of str) {
    const code = char.charCodeAt(0);
    // 한글 음절 범위: AC00 ~ D7A3
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const syllable = code - 0xAC00;
      const cho = Math.floor(syllable / (21 * 28));
      const jung = Math.floor((syllable % (21 * 28)) / 28);
      const jong = syllable % 28;
      result += CHOSUNG[cho] + JUNGSUNG[jung] + JONGSUNG[jong];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * 초성만 추출
 */
function extractChosung(str) {
  let result = '';
  for (const char of str) {
    const code = char.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const syllable = code - 0xAC00;
      const cho = Math.floor(syllable / (21 * 28));
      result += CHOSUNG[cho];
    } else if (/[ㄱ-ㅎ]/.test(char)) {
      result += char;
    }
  }
  return result;
}

/**
 * Levenshtein 거리 계산
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * 문자열 유사도 계산 (0~1, 1이 완전 일치)
 */
function calculateSimilarity(s1, s2) {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

/**
 * 공통 접두사 길이 비율
 */
function commonPrefixRatio(s1, s2) {
  let commonLen = 0;
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) commonLen++;
    else break;
  }
  return commonLen / Math.max(s1.length, s2.length);
}

/**
 * 공통 부분 문자열 포함 여부
 */
function containsSubstring(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  return longer.includes(shorter);
}

/**
 * 일반적인 운용사 접미사 제거
 */
const COMPANY_SUFFIXES = [
  '인베스트먼트', '벤처스', '파트너스', '캐피탈', '투자', '자산운용',
  '기술지주', '증권', '소셜컴퍼니', '생명과학', '벤처투자', '에셋',
  'Investment', 'Investments', 'Ventures', 'Partners', 'Capital',
  'Management', 'Asset', 'Fund', 'LLC', 'Inc', 'Ltd', 'Pte', 'Limited'
];

function removeCompanySuffix(name) {
  let result = name;
  for (const suffix of COMPANY_SUFFIXES) {
    const regex = new RegExp(suffix + '\\s*$', 'i');
    result = result.replace(regex, '').trim();
  }
  return result;
}

// normalizeName은 utils/normalize.js에서 import

/**
 * 영문 약어 확장 패턴
 * 예: KB → 케이비, SC → 에스씨
 */
const ABBREV_MAP = {
  // 영문 → 한글 발음
  'kb': '케이비',
  'nh': '엔에이치',
  'sc': '에스씨',
  'sk': '에스케이',
  'lg': '엘지',
  'kt': '케이티',
  'gs': '지에스',
  'ib': '아이비',
  'ds': '디에스',
  'kdb': '케이디비',
  'ibk': '아이비케이',
  'bnk': '비엔케이',
  'dgb': '디지비',
  'jb': '제이비',
  'shinhan': '신한',
  'hana': '하나',
  'woori': '우리',
  'samsung': '삼성',
  'hyundai': '현대',
  'lotte': '롯데',
  'cj': '씨제이',
  'posco': '포스코',
  'stonebridge': '스톤브릿지',
  'stic': '스틱',
  'atinum': '아티눔',
  'murex': '뮤렉스',
  'capstone': '캡스톤',
  'kofc': '한국벤처투자',
};

/**
 * 한글 발음 → 영문 약어 역매핑 (자동 생성)
 */
const REVERSE_ABBREV_MAP = Object.fromEntries(
  Object.entries(ABBREV_MAP).map(([eng, kor]) => [kor, eng.toUpperCase()])
);

/**
 * 영문 약어가 한글명에 포함되는지 확인 (양방향)
 * 예1: "KB" → "케이비" (영문 → 한글)
 * 예2: "비엔케이" → "BNK" (한글 → 영문)
 */
function matchesAbbreviation(name1, name2) {
  const lower1 = name1.toLowerCase();
  const lower2 = name2.toLowerCase();

  // 1. 영문 → 한글 방향 체크
  // name1이 영문 약어를 포함하고, name2가 해당 한글 발음을 포함하는지
  for (const [eng, kor] of Object.entries(ABBREV_MAP)) {
    if (lower1.includes(eng) && lower2.includes(kor)) {
      return true;
    }
    if (lower2.includes(eng) && lower1.includes(kor)) {
      return true;
    }
  }

  // 2. 한글 발음 → 영문 약어 방향 체크
  // name1이 한글 발음을 포함하고, name2가 해당 영문 약어를 포함하는지
  for (const [kor, eng] of Object.entries(REVERSE_ABBREV_MAP)) {
    const lowerEng = eng.toLowerCase();
    if (lower1.includes(kor) && lower2.includes(lowerEng)) {
      return true;
    }
    if (lower2.includes(kor) && lower1.includes(lowerEng)) {
      return true;
    }
  }

  return false;
}

/**
 * 두 운용사명의 유사도 종합 점수 계산
 * @returns {Object} { score: 0~1, reasons: string[] }
 */
export function calculateOperatorSimilarity(name1, name2) {
  const reasons = [];
  let score = 0;

  // 1. 정확히 일치
  if (name1 === name2) {
    return { score: 1, reasons: ['정확히 일치'] };
  }

  // 정규화
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // 2. 정규화 후 일치
  if (norm1 === norm2) {
    return { score: 0.98, reasons: ['정규화 후 일치 (공백/특수문자 차이)'] };
  }

  // 3. 한쪽이 다른 쪽을 포함
  if (containsSubstring(norm1, norm2)) {
    const shorter = norm1.length < norm2.length ? name1 : name2;
    const longer = norm1.length < norm2.length ? name2 : name1;
    const ratio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
    score = Math.max(score, 0.7 + ratio * 0.25);
    reasons.push(`"${shorter}" 포함됨`);
  }

  // 4. 접미사 제거 후 비교
  const core1 = removeCompanySuffix(norm1);
  const core2 = removeCompanySuffix(norm2);

  if (core1 === core2 && core1.length > 0) {
    return { score: 0.95, reasons: ['핵심명 동일 (접미사만 다름)'] };
  }

  if (containsSubstring(core1, core2) && Math.min(core1.length, core2.length) >= 2) {
    const ratio = Math.min(core1.length, core2.length) / Math.max(core1.length, core2.length);
    score = Math.max(score, 0.75 + ratio * 0.2);
    reasons.push('핵심명 포함 관계');
  }

  // 5. 한글 자모 유사도
  const decomposed1 = decomposeHangul(norm1);
  const decomposed2 = decomposeHangul(norm2);
  const jamoSim = calculateSimilarity(decomposed1, decomposed2);

  if (jamoSim > 0.8) {
    score = Math.max(score, jamoSim * 0.9);
    reasons.push(`자모 유사도 ${Math.round(jamoSim * 100)}%`);
  }

  // 6. 초성 비교 (한글)
  const cho1 = extractChosung(norm1);
  const cho2 = extractChosung(norm2);

  if (cho1.length > 0 && cho2.length > 0) {
    const choSim = calculateSimilarity(cho1, cho2);
    if (choSim > 0.85) {
      score = Math.max(score, choSim * 0.7);
      reasons.push(`초성 유사 (${cho1} vs ${cho2})`);
    }
  }

  // 7. 영문 약어 ↔ 한글 발음 매칭 (양방향)
  // 예: "KB투자증권" ↔ "케이비투자증권", "비엔케이투자증권" ↔ "BNK투자증권"
  if (matchesAbbreviation(name1, name2)) {
    score = Math.max(score, 0.85);
    reasons.push('영문 약어 ↔ 한글 발음 매칭');
  }

  // 8. 일반 문자열 유사도
  const stringSim = calculateSimilarity(norm1, norm2);
  if (stringSim > 0.7) {
    score = Math.max(score, stringSim * 0.85);
    reasons.push(`문자열 유사도 ${Math.round(stringSim * 100)}%`);
  }

  // 9. 공통 접두사
  const prefixRatio = commonPrefixRatio(core1, core2);
  if (prefixRatio > 0.5 && core1.length >= 3) {
    score = Math.max(score, prefixRatio * 0.7);
    reasons.push(`공통 접두사 ${Math.round(prefixRatio * 100)}%`);
  }

  return { score, reasons };
}

/**
 * 유사도가 접미사(파트너스, 벤처스 등)만 겹쳐서 발생한 것인지 확인
 * 핵심명(접미사 제거 후)이 다르면 실질적으로 다른 운용사
 */
function isSuffixOnlySimilarity(name1, name2, score) {
  // 85% 이상은 실제 유사한 것으로 간주
  if (score >= 0.85) return false;

  const core1 = removeCompanySuffix(normalizeName(name1));
  const core2 = removeCompanySuffix(normalizeName(name2));

  // 핵심명이 비어있으면 체크 불가
  if (!core1 || !core2) return false;

  // 핵심명 유사도 계산
  const coreSimilarity = calculateSimilarity(core1, core2);

  // 핵심명 유사도가 60% 미만이면 접미사만 겹친 것으로 간주
  // 예: "다성" vs "효성" = 50%, "테스트" vs "어니스트" = 57%
  if (coreSimilarity < 0.6) return true;

  return false;
}

/**
 * 신규 운용사 목록에서 기존 운용사와 유사한 항목 찾기
 * @param {string[]} newNames - 신규 운용사명 목록
 * @param {Array} existingOperators - 기존 운용사 목록 [{ ID, 운용사명, 약어 }, ...]
 * @param {number} threshold - 유사도 임계값 (기본 0.6)
 * @returns {Object} { exact: [], similar: [], new: [] }
 */
export function findSimilarOperators(newNames, existingOperators, threshold = 0.6) {
  const result = {
    exact: [],    // 정확히 일치 (기존 운용사 사용)
    similar: [],  // 유사하여 검토 필요
    new: []       // 완전 신규
  };

  for (const newName of newNames) {
    let bestMatch = null;
    let bestScore = 0;
    let bestReasons = [];

    for (const existing of existingOperators) {
      const existingName = existing['운용사명'] || existing.name;
      const alias = existing['약어'] || existing.alias || '';

      // 정확히 일치
      if (newName === existingName) {
        result.exact.push({
          newName,
          existingId: existing['ID'] || existing.id,
          existingName,
          score: 1,
          reasons: ['정확히 일치']
        });
        bestMatch = null; // 정확히 일치하면 similar에 추가 안함
        break;
      }

      // 약어와 일치
      if (alias && newName === alias) {
        result.exact.push({
          newName,
          existingId: existing['ID'] || existing.id,
          existingName,
          score: 1,
          reasons: ['약어 일치']
        });
        bestMatch = null;
        break;
      }

      // 유사도 계산
      const { score, reasons } = calculateOperatorSimilarity(newName, existingName);

      // 약어와도 비교
      if (alias) {
        const { score: aliasScore, reasons: aliasReasons } = calculateOperatorSimilarity(newName, alias);
        if (aliasScore > score) {
          if (aliasScore > bestScore) {
            bestScore = aliasScore;
            bestMatch = existing;
            bestReasons = aliasReasons.map(r => `약어 비교: ${r}`);
          }
          continue;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = existing;
        bestReasons = reasons;
      }
    }

    // 정확히 일치하지 않은 경우
    if (bestMatch !== null) {
      const existingName = bestMatch['운용사명'] || bestMatch.name;

      // 접미사만 겹쳐서 유사도가 높은 경우 제외 (예: "A파트너스" vs "B파트너스")
      if (bestScore >= threshold && isSuffixOnlySimilarity(newName, existingName, bestScore)) {
        result.new.push({ newName, bestScore, bestMatch: existingName, skippedReason: '접미사만 유사' });
      } else if (bestScore >= threshold) {
        result.similar.push({
          newName,
          existingId: bestMatch['ID'] || bestMatch.id,
          existingName,
          score: bestScore,
          reasons: bestReasons
        });
      } else {
        result.new.push({ newName, bestScore, bestMatch: existingName });
      }
    }
  }

  return result;
}

/**
 * 검토가 필요한 유사 운용사 목록 포맷팅 (터미널 출력용)
 */
export function formatSimilarOperatorsForReview(similarList) {
  if (similarList.length === 0) return '';

  const lines = [
    '',
    '⚠️  유사 운용사 검토 필요:',
    '─'.repeat(60)
  ];

  for (const item of similarList) {
    const scorePercent = Math.round(item.score * 100);
    lines.push(`  📌 "${item.newName}"`);
    lines.push(`     → 기존: "${item.existingName}" (${item.existingId})`);
    lines.push(`     → 유사도: ${scorePercent}% - ${item.reasons.join(', ')}`);
    lines.push('');
  }

  lines.push('─'.repeat(60));
  lines.push('  [y] 같은 운용사로 처리 (기존 ID 사용)');
  lines.push('  [n] 다른 운용사로 처리 (신규 등록)');
  lines.push('  [s] 건너뛰기 (나중에 처리)');

  return lines.join('\n');
}

/**
 * 유사도 점수 해석
 */
export function interpretScore(score) {
  if (score >= 0.95) return '거의 확실히 동일';
  if (score >= 0.85) return '동일 가능성 높음';
  if (score >= 0.75) return '유사함, 확인 필요';
  if (score >= 0.6) return '일부 유사, 검토 권장';
  return '다른 운용사로 보임';
}
