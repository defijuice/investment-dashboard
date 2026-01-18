import 'dotenv/config';
import { GoogleSheetsClient } from '../src/core/googleSheets.js';

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  const apps = await sheets.getAllRows('신청현황');
  const operators = await sheets.getAllRows('운용사');

  // 통화단위가 억원이 아닌 항목
  console.log('=== 통화단위가 USD(M) 등으로 저장된 항목 ===\n');

  const foreignCurrency = apps.filter(a =>
    a['통화단위'] && a['통화단위'] !== '억원'
  );

  for (const app of foreignCurrency) {
    const op = operators.find(o => o['ID'] === app['운용사ID']);
    console.log(app['ID'], app['출자사업ID'], op ? op['운용사명'] : '?');
    console.log('  통화:', app['통화단위']);
    console.log('  최소:', app['최소결성규모'], '모태:', app['모태출자액'], '결성:', app['결성예정액'], '요청:', app['출자요청액']);
    console.log('');
  }

  console.log('총', foreignCurrency.length, '건\n');

  // 해외VC 출자사업 중 최소결성규모 vs 결성예정액 비율 분석
  console.log('=== 해외VC 출자사업 금액 비율 분석 ===\n');
  console.log('(외화 환산이 올바르면 최소결성=결성예정이어야 함)\n');

  const targetProjects = ['PJ0058', 'PJ0066', 'PJ0079'];

  for (const pid of targetProjects) {
    const pjApps = apps.filter(a => a['출자사업ID'] === pid && a['상태'] === '선정');
    if (pjApps.length === 0) continue;

    console.log('--- ' + pid + ' ---');
    let hasIssue = false;

    for (const app of pjApps) {
      const op = operators.find(o => o['ID'] === app['운용사ID']);
      const min = parseFloat(app['최소결성규모']) || 0;
      const fund = parseFloat(app['결성예정액']) || 0;

      // 결성예정액이 최소결성규모보다 크면 환산 문제 가능성
      if (fund > min * 1.1 && min > 0) {
        hasIssue = true;
        const ratio = (fund / min).toFixed(2);
        console.log('  ' + app['ID'] + ' ' + (op ? op['운용사명'] : '?'));
        console.log('    최소:' + min + ', 결성:' + fund + ', 비율:' + ratio + 'x <<<');
      }
    }

    if (!hasIssue) {
      console.log('  이상 없음');
    }
    console.log('');
  }

  // DCI Partners 특별 점검 (JPY 환산 오류 발견)
  console.log('=== DCI Partners 점검 (JPY 환산) ===\n');

  const dciOps = operators.filter(o => o['운용사명'].includes('DCI'));
  for (const op of dciOps) {
    console.log(op['ID'], op['운용사명']);
    const dciApps = apps.filter(a => a['운용사ID'] === op['ID']);
    for (const app of dciApps) {
      console.log('  ' + app['ID'] + ' ' + app['출자사업ID'] + ' 상태:' + app['상태']);
      console.log('    최소:' + app['최소결성규모'] + ', 모태:' + app['모태출자액'] + ', 결성:' + app['결성예정액'] + ', 요청:' + app['출자요청액']);
    }
  }
}

main().catch(console.error);
