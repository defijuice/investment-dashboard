/**
 * 병합 셀 금액 분할 계산기
 *
 * PDF에서 여러 운용사가 금액을 공유하는 경우 (병합 셀) N분의 1로 분할 계산
 *
 * 사용법:
 *   import { calculateMergedAmounts, generateMergeRemark } from './merge-calculator.js';
 *
 *   const result = calculateMergedAmounts({
 *     operators: ['동문파트너즈', '어니스트벤처스', '피앤피/파이오니어'],
 *     amounts: { minFormation: 529, moTae: 300 },
 *     currency: '억원'
 *   });
 */

/**
 * 공동GP 운용사 분리 및 펀드 수 계산
 *
 * @param {string[]} operators - 운용사 목록 (공동GP 포함 가능)
 * @returns {{ expandedOperators: string[], fundCount: number, jointGPs: Object[] }}
 *
 * @example
 * parseOperators(['동문파트너즈', '피앤피/파이오니어'])
 * // => {
 * //   expandedOperators: ['동문파트너즈', '피앤피', '파이오니어'],
 * //   fundCount: 2,  // PDF 기준 펀드 수 (금액 분할 기준)
 * //   jointGPs: [{ original: '피앤피/파이오니어', split: ['피앤피', '파이오니어'] }]
 * // }
 */
export function parseOperators(operators) {
  const expandedOperators = [];
  const jointGPs = [];
  let fundCount = 0;

  for (const op of operators) {
    // 공동GP 구분자: /, ,
    const isJointGP = op.includes('/') || (op.includes(',') && !op.match(/^[^,]+$/));

    if (isJointGP) {
      // 공동GP 분리
      const delimiter = op.includes('/') ? '/' : ',';
      const split = op.split(delimiter).map(s => s.trim()).filter(Boolean);

      jointGPs.push({ original: op, split });
      expandedOperators.push(...split);
      fundCount += 1;  // 공동GP는 PDF 기준 1개 펀드
    } else {
      expandedOperators.push(op.trim());
      fundCount += 1;
    }
  }

  return { expandedOperators, fundCount, jointGPs };
}

/**
 * 병합 금액 분할 계산
 *
 * @param {Object} params
 * @param {string[]} params.operators - 운용사 목록 (공동GP 포함 가능)
 * @param {Object} params.amounts - 금액 정보
 * @param {number} [params.amounts.minFormation] - 최소결성규모
 * @param {number} [params.amounts.moTae] - 모태출자액
 * @param {number} [params.amounts.formation] - 결성예정액
 * @param {number} [params.amounts.request] - 출자요청액
 * @param {string} [params.currency='억원'] - 통화단위 ('억원' 또는 'USD(M)')
 * @param {number} [params.decimalPlaces=2] - 소수점 자릿수
 *
 * @returns {Object[]} 각 운용사별 분할된 금액 배열
 *
 * @example
 * calculateMergedAmounts({
 *   operators: ['동문파트너즈', '어니스트벤처스', '피앤피/파이오니어'],
 *   amounts: { minFormation: 529, moTae: 300 },
 *   currency: '억원'
 * })
 * // => [
 * //   { operator: '동문파트너즈', minFormation: 176.33, moTae: 100, ... },
 * //   { operator: '어니스트벤처스', minFormation: 176.33, moTae: 100, ... },
 * //   { operator: '피앤피', minFormation: 176.33, moTae: 100, isJointGP: true, ... },
 * //   { operator: '파이오니어', minFormation: 176.33, moTae: 100, isJointGP: true, ... },
 * // ]
 */
export function calculateMergedAmounts(params) {
  const {
    operators,
    amounts,
    currency = '억원',
    decimalPlaces = 2
  } = params;

  if (!operators || operators.length === 0) {
    throw new Error('운용사 목록이 비어있습니다.');
  }

  // 운용사 파싱 및 펀드 수 계산
  const { expandedOperators, fundCount, jointGPs } = parseOperators(operators);

  // 금액 분할 (펀드 수 기준)
  const dividedAmounts = {};
  const originalAmounts = {};

  for (const [key, value] of Object.entries(amounts)) {
    if (value !== null && value !== undefined && !isNaN(value)) {
      originalAmounts[key] = value;
      dividedAmounts[key] = roundTo(value / fundCount, decimalPlaces);
    }
  }

  // 공동GP에 속한 운용사 Set
  const jointGPMembers = new Set();
  for (const jgp of jointGPs) {
    for (const member of jgp.split) {
      jointGPMembers.add(member);
    }
  }

  // 결과 생성
  const results = expandedOperators.map(op => {
    const result = {
      operator: op,
      ...dividedAmounts,
      currency,
      isMerged: true,
      mergeInfo: {
        fundCount,
        operatorCount: expandedOperators.length,
        originalAmounts,
        sharedWith: operators.filter(o => o !== op && !o.includes(op))
      }
    };

    // 공동GP 멤버인 경우 표시
    if (jointGPMembers.has(op)) {
      result.isJointGP = true;
      // 원본 공동GP 표기 찾기
      const originalJGP = jointGPs.find(jgp => jgp.split.includes(op));
      if (originalJGP) {
        result.jointGPOriginal = originalJGP.original;
      }
    }

    return result;
  });

  return results;
}

/**
 * 병합 비고 텍스트 생성
 *
 * @param {Object} params
 * @param {Object} params.originalAmounts - 원본 금액 { minFormation, moTae, formation, request }
 * @param {number} params.fundCount - 펀드 수 (금액 분할 기준)
 * @param {string} [params.currency='억원'] - 통화단위
 * @param {string} [params.existingRemark=''] - 기존 비고 (있으면 연결)
 *
 * @returns {string} 비고 텍스트
 *
 * @example
 * generateMergeRemark({
 *   originalAmounts: { minFormation: 529, moTae: 300 },
 *   fundCount: 3,
 *   currency: '억원'
 * })
 * // => "병합: 최소결성규모 529억, 모태출자액 300억 (3사 공유)"
 */
export function generateMergeRemark(params) {
  const {
    originalAmounts,
    fundCount,
    currency = '억원',
    existingRemark = ''
  } = params;

  const unit = currency === '억원' ? '억' : 'M';
  const parts = [];

  // 필드명 매핑
  const fieldNames = {
    minFormation: '최소결성규모',
    moTae: '모태출자액',
    formation: '결성예정액',
    request: '출자요청액'
  };

  for (const [key, label] of Object.entries(fieldNames)) {
    if (originalAmounts[key] !== null && originalAmounts[key] !== undefined) {
      parts.push(`${label} ${originalAmounts[key]}${unit}`);
    }
  }

  if (parts.length === 0) {
    return existingRemark;
  }

  const mergeText = `병합: ${parts.join(', ')} (${fundCount}사 공유)`;

  // 기존 비고와 연결
  if (existingRemark) {
    // 기존에 "병합:" 이 있으면 대체
    if (existingRemark.includes('병합:')) {
      return existingRemark.replace(/병합:[^;]+/, mergeText);
    }
    return `${existingRemark}; ${mergeText}`;
  }

  return mergeText;
}

/**
 * 소수점 반올림
 */
function roundTo(num, places) {
  const factor = Math.pow(10, places);
  return Math.round(num * factor) / factor;
}

/**
 * 병합 데이터 일괄 처리 (여러 분야)
 *
 * @param {Object[]} mergedGroups - 분야별 병합 그룹
 * @param {string} mergedGroups[].category - 출자분야
 * @param {string[]} mergedGroups[].operators - 운용사 목록
 * @param {Object} mergedGroups[].amounts - 금액 정보
 * @param {string} [currency='억원'] - 통화단위
 *
 * @returns {Object[]} 모든 분야의 분할 결과 배열
 *
 * @example
 * processMergedGroups([
 *   {
 *     category: '재도약',
 *     operators: ['동문파트너즈', '어니스트벤처스', '피앤피/파이오니어'],
 *     amounts: { minFormation: 529, moTae: 300 }
 *   },
 *   {
 *     category: 'IP',
 *     operators: ['스마트스터디벤처스', '에이비즈파트너스'],
 *     amounts: { formation: 1500, request: 900 }
 *   }
 * ])
 */
export function processMergedGroups(mergedGroups, currency = '억원') {
  const results = [];

  for (const group of mergedGroups) {
    const { category, operators, amounts } = group;

    const calculated = calculateMergedAmounts({
      operators,
      amounts,
      currency
    });

    // 분야 정보 추가
    for (const item of calculated) {
      item.category = category;
      item.remark = generateMergeRemark({
        originalAmounts: item.mergeInfo.originalAmounts,
        fundCount: item.mergeInfo.fundCount,
        currency
      });
      results.push(item);
    }
  }

  return results;
}

// CLI 테스트
if (process.argv[1].includes('merge-calculator')) {
  console.log('=== 병합 계산기 테스트 ===\n');

  // 테스트 1: 재도약 분야 (공동GP 포함)
  console.log('테스트 1: 재도약 분야 (공동GP 포함)');
  const result1 = calculateMergedAmounts({
    operators: ['동문파트너즈', '어니스트벤처스', '피앤피/파이오니어'],
    amounts: { minFormation: 529, moTae: 300 },
    currency: '억원'
  });

  console.log('입력:');
  console.log('  운용사: 동문파트너즈, 어니스트벤처스, 피앤피/파이오니어');
  console.log('  최소결성규모: 529억, 모태출자액: 300억');
  console.log('\n결과:');
  for (const r of result1) {
    console.log(`  ${r.operator}: 최소=${r.minFormation}억, 모태=${r.moTae}억${r.isJointGP ? ' (공동GP)' : ''}`);
  }
  console.log(`\n비고: ${generateMergeRemark({ originalAmounts: { minFormation: 529, moTae: 300 }, fundCount: 3 })}`);

  // 테스트 2: IP 분야 (5사 공유)
  console.log('\n\n테스트 2: IP 분야 (5사 공유)');
  const result2 = calculateMergedAmounts({
    operators: ['스마트스터디벤처스', '에이비즈파트너스', '디에이밸류인베스트먼트', '유티씨인베스트먼트', '솔트룩스벤처스'],
    amounts: { formation: 1500, request: 900 },
    currency: '억원'
  });

  console.log('입력:');
  console.log('  운용사: 5개사');
  console.log('  결성예정액: 1500억, 출자요청액: 900억');
  console.log('\n결과:');
  for (const r of result2) {
    console.log(`  ${r.operator}: 결성=${r.formation}억, 출자요청=${r.request}억`);
  }
  console.log(`\n비고: ${generateMergeRemark({ originalAmounts: { formation: 1500, request: 900 }, fundCount: 5 })}`);

  // 테스트 3: USD 통화
  console.log('\n\n테스트 3: USD 통화');
  const result3 = calculateMergedAmounts({
    operators: ['GlobalVC A', 'GlobalVC B', 'GlobalVC C'],
    amounts: { formation: 100, request: 50 },
    currency: 'USD(M)'
  });

  console.log('입력:');
  console.log('  운용사: 3개사');
  console.log('  결성예정액: 100M, 출자요청액: 50M');
  console.log('\n결과:');
  for (const r of result3) {
    console.log(`  ${r.operator}: 결성=${r.formation}M, 출자요청=${r.request}M`);
  }
  console.log(`\n비고: ${generateMergeRemark({ originalAmounts: { formation: 100, request: 50 }, fundCount: 3, currency: 'USD(M)' })}`);
}
