/**
 * PDF 이중 파싱 비교 모듈
 *
 * Claude Code가 직접 분석한 결과와 pdfplumber 파싱 결과를 비교하여
 * 차이점만 사용자에게 확인받는 프로세스
 */

import { execSync } from 'child_process';
import path from 'path';

/**
 * pdfplumber로 PDF 파싱 (Python 스크립트 호출)
 * @param {string} pdfPath - PDF 파일 경로
 * @param {string} type - 'application' (접수현황) 또는 'selection' (선정결과)
 * @returns {Object} 파싱 결과
 */
export function parsePdfWithPdfplumber(pdfPath, type = 'application') {
  try {
    const scriptPath = path.join(process.cwd(), 'src', 'processors', 'pdf-parser.py');
    const typeFlag = type === 'selection' ? '--selection' : '';

    const result = execSync(`python3 "${scriptPath}" "${pdfPath}" ${typeFlag}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    return JSON.parse(result);
  } catch (error) {
    console.error(`pdfplumber 파싱 실패: ${error.message}`);
    return { applications: [], error: error.message };
  }
}

/**
 * 두 파싱 결과 비교
 * @param {Array} claudeResult - Claude가 분석한 결과 [{name, category, region, ...}]
 * @param {Array} pdfplumberResult - pdfplumber 파싱 결과 [{company, category, ...}]
 * @returns {Object} 비교 결과
 */
export function compareResults(claudeResult, pdfplumberResult) {
  // 이름 정규화 함수
  const normalize = (name) => {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[,.\-()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Claude 결과를 Map으로 변환 (정규화된 이름 -> 원본 데이터)
  const claudeMap = new Map();
  for (const item of claudeResult) {
    const key = normalize(item.name);
    claudeMap.set(key, item);
  }

  // pdfplumber 결과를 Map으로 변환
  const pdfplumberMap = new Map();
  for (const item of pdfplumberResult) {
    const key = normalize(item.company || item.name);
    pdfplumberMap.set(key, item);
  }

  // 비교 결과
  const comparison = {
    matched: [],      // 양쪽에서 일치하는 항목
    onlyInClaude: [], // Claude에만 있는 항목
    onlyInPdfplumber: [], // pdfplumber에만 있는 항목
    conflicting: [],  // 양쪽에 있지만 내용이 다른 항목
  };

  // Claude 결과 순회
  for (const [key, claudeItem] of claudeMap) {
    if (pdfplumberMap.has(key)) {
      const pdfItem = pdfplumberMap.get(key);

      // 카테고리 비교 (정규화 후)
      const claudeCategory = normalize(claudeItem.category || '');
      const pdfCategory = normalize(pdfItem.category || '');

      if (claudeCategory === pdfCategory || !claudeCategory || !pdfCategory) {
        // 일치하거나 한쪽이 비어있으면 매칭
        comparison.matched.push({
          name: claudeItem.name,
          category: claudeItem.category || pdfItem.category,
          region: claudeItem.region,
          claude: claudeItem,
          pdfplumber: pdfItem
        });
      } else {
        // 카테고리가 다르면 충돌
        comparison.conflicting.push({
          name: claudeItem.name,
          claudeCategory: claudeItem.category,
          pdfplumberCategory: pdfItem.category,
          claude: claudeItem,
          pdfplumber: pdfItem
        });
      }

      pdfplumberMap.delete(key);
    } else {
      // Claude에만 있음
      comparison.onlyInClaude.push(claudeItem);
    }
  }

  // 남은 pdfplumber 결과 (pdfplumber에만 있음)
  for (const [key, pdfItem] of pdfplumberMap) {
    comparison.onlyInPdfplumber.push({
      name: pdfItem.company || pdfItem.name,
      category: pdfItem.category,
      region: pdfItem.region || '한국',
      ...pdfItem
    });
  }

  return comparison;
}

/**
 * 비교 결과를 사람이 읽기 쉬운 형태로 출력
 * @param {Object} comparison - compareResults의 결과
 * @returns {string} 포맷된 문자열
 */
export function formatComparisonReport(comparison) {
  const lines = [];

  lines.push('='.repeat(60));
  lines.push('PDF 파싱 결과 비교');
  lines.push('='.repeat(60));

  lines.push(`\n✅ 일치: ${comparison.matched.length}건`);
  lines.push(`⚠️ 충돌: ${comparison.conflicting.length}건`);
  lines.push(`📋 Claude만: ${comparison.onlyInClaude.length}건`);
  lines.push(`📋 pdfplumber만: ${comparison.onlyInPdfplumber.length}건`);

  // 충돌 상세
  if (comparison.conflicting.length > 0) {
    lines.push('\n--- 충돌 항목 (확인 필요) ---');
    for (const item of comparison.conflicting) {
      lines.push(`  ${item.name}`);
      lines.push(`    Claude: ${item.claudeCategory}`);
      lines.push(`    pdfplumber: ${item.pdfplumberCategory}`);
    }
  }

  // Claude에만 있는 항목
  if (comparison.onlyInClaude.length > 0) {
    lines.push('\n--- Claude에만 있는 항목 ---');
    for (const item of comparison.onlyInClaude) {
      lines.push(`  - ${item.name} (${item.category || '분야 없음'})`);
    }
  }

  // pdfplumber에만 있는 항목
  if (comparison.onlyInPdfplumber.length > 0) {
    lines.push('\n--- pdfplumber에만 있는 항목 ---');
    for (const item of comparison.onlyInPdfplumber) {
      lines.push(`  - ${item.name} (${item.category || '분야 없음'})`);
    }
  }

  return lines.join('\n');
}

/**
 * 비교 결과에서 최종 데이터 생성
 * 일치하는 항목은 자동 포함, 차이나는 항목은 선택에 따라 처리
 * @param {Object} comparison - 비교 결과
 * @param {Object} resolutions - 충돌 해결 선택 {name: 'claude' | 'pdfplumber' | 'skip'}
 * @returns {Array} 최종 데이터
 */
export function resolveComparison(comparison, resolutions = {}) {
  const final = [];

  // 일치 항목 추가
  for (const item of comparison.matched) {
    final.push({
      name: item.name,
      category: item.category,
      region: item.region || item.claude.region || '한국',
      currency: item.claude.currency || 'KRW',
      minSize: item.claude.minSize || item.pdfplumber.amount_planned,
      investAmount: item.claude.investAmount || item.pdfplumber.amount_requested,
      source: 'matched'
    });
  }

  // 충돌 항목 처리
  for (const item of comparison.conflicting) {
    const resolution = resolutions[item.name] || 'claude'; // 기본: Claude 우선

    if (resolution === 'skip') continue;

    const source = resolution === 'pdfplumber' ? item.pdfplumber : item.claude;
    final.push({
      name: item.name,
      category: resolution === 'pdfplumber' ? item.pdfplumberCategory : item.claudeCategory,
      region: source.region || '한국',
      currency: source.currency || 'KRW',
      minSize: source.minSize || source.amount_planned,
      investAmount: source.investAmount || source.amount_requested,
      source: `resolved-${resolution}`
    });
  }

  // Claude에만 있는 항목 (기본 포함, 명시적으로 스킵 가능)
  for (const item of comparison.onlyInClaude) {
    if (resolutions[item.name] === 'skip') continue;

    final.push({
      name: item.name,
      category: item.category,
      region: item.region || '한국',
      currency: item.currency || 'KRW',
      minSize: item.minSize,
      investAmount: item.investAmount,
      source: 'claude-only'
    });
  }

  // pdfplumber에만 있는 항목 (명시적으로 포함할 때만)
  for (const item of comparison.onlyInPdfplumber) {
    if (resolutions[item.name] === 'include') {
      final.push({
        name: item.name,
        category: item.category,
        region: item.region || '한국',
        currency: 'KRW',
        minSize: item.amount_planned,
        investAmount: item.amount_requested,
        source: 'pdfplumber-only'
      });
    }
  }

  return final;
}

/**
 * 차이점이 있는지 빠르게 확인
 * @param {Object} comparison - 비교 결과
 * @returns {boolean} 차이점이 있으면 true
 */
export function hasDifferences(comparison) {
  return (
    comparison.conflicting.length > 0 ||
    comparison.onlyInClaude.length > 0 ||
    comparison.onlyInPdfplumber.length > 0
  );
}
