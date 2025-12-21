/**
 * 운용사 중복 검토 및 병합 모듈
 *
 * 기존 운용사 목록에서 중복 가능성이 있는 항목을 찾고,
 * 사용자 확인 후 병합 처리
 */

import { GoogleSheetsClient } from './googleSheets.js';
import { calculateOperatorSimilarity } from './operator-matcher.js';

/**
 * 기존 운용사 중 중복 가능성 있는 쌍 찾기
 * @param {number} threshold - 유사도 임계값 (기본 0.85)
 * @returns {Array} 중복 가능성 있는 운용사 쌍 목록
 */
export async function findDuplicateOperators(threshold = 0.85) {
  const sheets = new GoogleSheetsClient();
  await sheets.init();
  const operators = await sheets.getAllOperators();

  console.log(`총 운용사 수: ${operators.length}`);

  const duplicates = [];

  // 모든 운용사 쌍 비교
  for (let i = 0; i < operators.length; i++) {
    for (let j = i + 1; j < operators.length; j++) {
      const op1 = operators[i];
      const op2 = operators[j];
      const name1 = op1['운용사명'];
      const name2 = op2['운용사명'];

      if (!name1 || !name2) continue;

      const result = calculateOperatorSimilarity(name1, name2);

      if (result.score >= threshold) {
        duplicates.push({
          op1: { id: op1['ID'], name: name1, alias: op1['약어'] },
          op2: { id: op2['ID'], name: name2, alias: op2['약어'] },
          score: result.score,
          reasons: result.reasons
        });
      }
    }
  }

  // 유사도 높은 순으로 정렬
  duplicates.sort((a, b) => b.score - a.score);

  return duplicates;
}

/**
 * 중복 운용사 병합
 * - 유지할 운용사(keepId)로 신청현황의 운용사ID를 모두 변경
 * - 삭제할 운용사(removeId) 행을 삭제하거나 비활성화
 *
 * @param {string} keepId - 유지할 운용사 ID
 * @param {string} removeId - 삭제할 운용사 ID
 * @param {Object} options - 옵션 { dryRun: true/false }
 */
export async function mergeOperators(keepId, removeId, options = {}) {
  const { dryRun = true } = options;

  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 두 운용사 정보 확인
  const operators = await sheets.getAllOperators();
  const keepOp = operators.find(op => op['ID'] === keepId);
  const removeOp = operators.find(op => op['ID'] === removeId);

  if (!keepOp) {
    throw new Error(`유지할 운용사를 찾을 수 없습니다: ${keepId}`);
  }
  if (!removeOp) {
    throw new Error(`삭제할 운용사를 찾을 수 없습니다: ${removeId}`);
  }

  console.log('\n=== 운용사 병합 ===');
  console.log(`유지: ${keepId} - ${keepOp['운용사명']}`);
  console.log(`삭제: ${removeId} - ${removeOp['운용사명']}`);

  // 2. 신청현황에서 removeId를 사용하는 행 찾기
  const applications = await sheets.getAllRows('신청현황');
  const affectedApps = applications.filter(app => {
    const opIds = (app['운용사ID'] || '').split(',').map(s => s.trim());
    return opIds.includes(removeId);
  });

  console.log(`\n영향받는 신청현황: ${affectedApps.length}건`);

  if (affectedApps.length > 0) {
    for (const app of affectedApps) {
      console.log(`  - ${app['ID']}: ${app['출자사업ID']} / ${app['출자분야']} / ${app['상태']}`);
    }
  }

  if (dryRun) {
    console.log('\n[DRY RUN] 실제 변경은 수행되지 않았습니다.');
    console.log('실제 병합을 수행하려면 dryRun: false 옵션을 사용하세요.');
    return {
      keepId,
      removeId,
      affectedApplications: affectedApps.length,
      dryRun: true
    };
  }

  // 3. 신청현황 운용사ID 업데이트
  console.log('\n신청현황 업데이트 중...');
  for (const app of affectedApps) {
    const currentOpIds = (app['운용사ID'] || '').split(',').map(s => s.trim());
    const newOpIds = currentOpIds.map(id => id === removeId ? keepId : id);

    // 중복 제거
    const uniqueOpIds = [...new Set(newOpIds)];

    // 운용사ID 열 업데이트 (C열)
    await sheets.setValues(`신청현황!C${app._rowIndex}`, [[uniqueOpIds.join(', ')]]);
    console.log(`  ${app['ID']}: ${currentOpIds.join(',')} → ${uniqueOpIds.join(',')}`);
  }

  // 4. 유지할 운용사의 약어에 삭제된 운용사명 추가 (검색 편의)
  const currentAlias = keepOp['약어'] || '';
  const newAlias = currentAlias
    ? `${currentAlias}, ${removeOp['운용사명']}`
    : removeOp['운용사명'];

  await sheets.setValues(`운용사!C${keepOp._rowIndex}`, [[newAlias]]);
  console.log(`\n유지 운용사 약어 업데이트:`);
  console.log(`  ${keepId}: 약어에 "${removeOp['운용사명']}" 추가`);

  // 5. 삭제할 운용사 행 삭제
  console.log('\n삭제 운용사 제거...');
  await sheets.deleteRow('운용사', removeOp._rowIndex);
  console.log(`  ${removeId} (${removeOp['운용사명']}): 행 삭제 완료`);

  console.log('\n=== 병합 완료 ===');

  return {
    keepId,
    removeId,
    affectedApplications: affectedApps.length,
    dryRun: false
  };
}

/**
 * 중복 운용사 검토 리포트 출력
 */
export async function printDuplicateReport(threshold = 0.85) {
  const duplicates = await findDuplicateOperators(threshold);

  console.log('\n' + '='.repeat(70));
  console.log('  운용사 중복 검토 리포트');
  console.log('='.repeat(70));

  if (duplicates.length === 0) {
    console.log('\n중복 가능성 있는 운용사가 없습니다.');
    return;
  }

  // 카테고리 분류
  const exactDuplicates = duplicates.filter(d => d.score >= 0.95);
  const likelyDuplicates = duplicates.filter(d => d.score >= 0.85 && d.score < 0.95);

  if (exactDuplicates.length > 0) {
    console.log('\n🔴 거의 확실한 중복 (95% 이상):');
    console.log('-'.repeat(70));
    for (const dup of exactDuplicates) {
      console.log(`  ${dup.op1.id}: ${dup.op1.name}`);
      console.log(`  ${dup.op2.id}: ${dup.op2.name}`);
      console.log(`  → ${(dup.score * 100).toFixed(0)}% - ${dup.reasons.join(', ')}`);
      console.log('');
    }
  }

  if (likelyDuplicates.length > 0) {
    console.log('\n🟡 중복 가능성 있음 (85~95%):');
    console.log('-'.repeat(70));
    for (const dup of likelyDuplicates) {
      console.log(`  ${dup.op1.id}: ${dup.op1.name}`);
      console.log(`  ${dup.op2.id}: ${dup.op2.name}`);
      console.log(`  → ${(dup.score * 100).toFixed(0)}% - ${dup.reasons.join(', ')}`);
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log(`총 ${duplicates.length}쌍 (확실: ${exactDuplicates.length}, 가능성: ${likelyDuplicates.length})`);
  console.log('');
  console.log('병합 명령어 예시:');
  console.log('  node -e "import(\'./src/operator-audit.js\').then(m => m.mergeOperators(\'OP0028\', \'OP0219\', {dryRun: false}))"');
}

// CLI 실행
if (process.argv[1] && process.argv[1].includes('operator-audit')) {
  const command = process.argv[2];

  if (command === 'report') {
    const threshold = parseFloat(process.argv[3]) || 0.85;
    printDuplicateReport(threshold);
  } else if (command === 'merge') {
    const keepId = process.argv[3];
    const removeId = process.argv[4];
    const dryRun = process.argv[5] !== '--execute';

    if (!keepId || !removeId) {
      console.log('사용법: node src/operator-audit.js merge <유지ID> <삭제ID> [--execute]');
      process.exit(1);
    }

    mergeOperators(keepId, removeId, { dryRun });
  } else {
    console.log('사용법:');
    console.log('  node src/operator-audit.js report [threshold]  - 중복 리포트');
    console.log('  node src/operator-audit.js merge <유지ID> <삭제ID> [--execute]  - 병합');
  }
}
