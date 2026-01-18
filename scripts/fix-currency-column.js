import 'dotenv/config';
import { GoogleSheetsClient } from '../src/core/googleSheets.js';

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  const apps = await sheets.getAllRows('신청현황');

  console.log('=== 통화단위 열 오류 수정 (배치 처리) ===\n');

  const badCurrency = apps.filter(a =>
    a['통화단위'] && (a['통화단위'] === '선정' || a['통화단위'] === '탈락')
  );

  console.log('잘못된 통화단위 레코드:', badCurrency.length, '건\n');

  if (badCurrency.length === 0) {
    console.log('수정할 항목 없음');
    return;
  }

  // 배치 업데이트를 위한 범위와 값 준비
  // 한 번에 여러 셀을 업데이트하기 위해 batchUpdate 사용
  const batchSize = 10;
  let updated = 0;

  for (let i = 0; i < badCurrency.length; i += batchSize) {
    const batch = badCurrency.slice(i, i + batchSize);

    for (const app of batch) {
      try {
        await sheets.setValues(`신청현황!I${app._rowIndex}`, [['억원']]);
        updated++;
      } catch (err) {
        if (err.status === 429) {
          console.log('할당량 초과 - 1분 대기...');
          await new Promise(r => setTimeout(r, 60000));
          // 재시도
          await sheets.setValues(`신청현황!I${app._rowIndex}`, [['억원']]);
          updated++;
        } else {
          throw err;
        }
      }
    }

    console.log('진행:', updated + '/' + badCurrency.length);

    // 배치 간 2초 대기
    if (i + batchSize < badCurrency.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n완료:', updated, '건 수정됨');
}

main().catch(console.error);
