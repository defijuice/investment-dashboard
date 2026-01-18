import 'dotenv/config';
import { GoogleSheetsClient } from '../src/core/googleSheets.js';

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  const apps = await sheets.getAllRows('신청현황');

  console.log('=== 글로벌/해외 출자사업 외화 환산 수정 ===\n');

  // 1. DCI Partners JPY 환산 오류 수정 (PJ0027)
  console.log('### 1. DCI Partners JPY 환산 수정 (AP1165) ###');

  const ap1165 = apps.find(a => a['ID'] === 'AP1165');
  if (ap1165) {
    console.log('현재값: 최소=' + ap1165['최소결성규모'] + ', 모태=' + ap1165['모태출자액'] + ', 결성=' + ap1165['결성예정액'] + ', 요청=' + ap1165['출자요청액']);

    // PDF: JPY 15,000M, 1,428M → 환산: 15000*8.6/100=1290, 1428*8.6/100=122.81
    const minSize = 1290;
    const mof = 122.81;

    await sheets.setValues(`신청현황!E${ap1165._rowIndex}:H${ap1165._rowIndex}`, [[minSize, mof, minSize, mof]]);
    console.log('수정후: 최소=' + minSize + ', 모태=' + mof + ', 결성=' + minSize + ', 요청=' + mof);
    console.log('OK\n');
  }

  // 2. 2021~2022년 해외VC 최소결성규모 환산
  // 이 사업들은 최소결성규모가 외화(M)로 저장되어 있고, 결성예정액은 원화로 환산되어 있음
  // 최소결성규모 = 결성예정액과 같아야 함 (해외VC 특성)

  console.log('### 2. 2021~2022년 해외VC 최소결성규모 수정 ###\n');

  const targetProjects = ['PJ0058', 'PJ0066', 'PJ0079'];

  for (const pid of targetProjects) {
    console.log('--- ' + pid + ' ---');
    const pjApps = apps.filter(a => a['출자사업ID'] === pid && a['상태'] === '선정');

    for (const app of pjApps) {
      const min = parseFloat(app['최소결성규모']) || 0;
      const fund = parseFloat(app['결성예정액']) || 0;

      // 결성예정액이 최소결성규모보다 훨씬 크면 (10배 이상) 수정 필요
      if (fund > min * 5 && min > 0) {
        console.log(app['ID'] + ': 최소=' + min + ' → ' + fund + ' (결성예정액과 동일하게)');

        await sheets.setValues(`신청현황!E${app._rowIndex}`, [[fund]]);
      }
    }
    console.log('');
  }

  // 3. PJ0001 통화단위 열 오류 수정
  console.log('### 3. PJ0001 통화단위 열 오류 수정 ###');

  const badCurrency = apps.filter(a =>
    a['통화단위'] && (a['통화단위'] === '선정' || a['통화단위'] === '탈락')
  );

  console.log('잘못된 통화단위 레코드:', badCurrency.length, '건');

  // 배치로 수정 (20건씩)
  const batchSize = 20;
  for (let i = 0; i < badCurrency.length; i += batchSize) {
    const batch = badCurrency.slice(i, i + batchSize);

    for (const app of batch) {
      // 통화단위 열 (I열)을 "억원"으로 수정
      await sheets.setValues(`신청현황!I${app._rowIndex}`, [['억원']]);
    }

    console.log('수정됨:', Math.min(i + batchSize, badCurrency.length) + '/' + badCurrency.length);

    if (i + batchSize < badCurrency.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n=== 수정 완료 ===');
}

main().catch(console.error);
