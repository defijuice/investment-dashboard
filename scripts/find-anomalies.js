import 'dotenv/config';
import { GoogleSheetsClient } from '../src/core/googleSheets.js';

async function findAnomalies() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  const apps = await sheets.getAllRows('신청현황');

  console.log('=== 금액 이상 탐지 ===\n');

  let anomalies = [];

  for (const app of apps) {
    const minSize = app['최소결성규모'];
    const mof = app['모태출자액'];
    const planned = app['결성예정액'];
    const request = app['출자요청액'];

    // 1. 천단위 콤마가 포함된 값
    if (mof && typeof mof === 'string' && mof.includes(',')) {
      anomalies.push({ id: app['ID'], pid: app['출자사업ID'], type: '콤마포함', field: '모태출자액', value: mof });
    }
    if (planned && typeof planned === 'string' && planned.includes(',')) {
      anomalies.push({ id: app['ID'], pid: app['출자사업ID'], type: '콤마포함', field: '결성예정액', value: planned });
    }

    // 2. 모태출자액이 결성예정액보다 큰 경우 (비정상)
    const mofNum = parseFloat(String(mof).replace(/,/g, '')) || 0;
    const plannedNum = parseFloat(String(planned).replace(/,/g, '')) || 0;
    const minNum = parseFloat(String(minSize).replace(/,/g, '')) || 0;

    if (mofNum > 0 && plannedNum > 0 && mofNum > plannedNum) {
      anomalies.push({
        id: app['ID'],
        pid: app['출자사업ID'],
        type: '모태>결성예정',
        field: '모태출자액',
        value: mof + ' > 결성예정액 ' + planned
      });
    }

    // 3. 모태출자액이 1000억 이상인 경우 (의심)
    if (mofNum >= 1000) {
      anomalies.push({
        id: app['ID'],
        pid: app['출자사업ID'],
        type: '모태1000+',
        field: '모태출자액',
        value: mof
      });
    }
  }

  // 타입별로 그룹화하여 출력
  const byType = {};
  for (const a of anomalies) {
    if (!byType[a.type]) byType[a.type] = [];
    byType[a.type].push(a);
  }

  for (const [type, items] of Object.entries(byType)) {
    console.log('\n### ' + type + ' (' + items.length + '건) ###');
    items.forEach(i => {
      console.log(i.id, i.pid, i.field + '=' + i.value);
    });
  }

  console.log('\n\n총 이상 항목:', anomalies.length, '건');
}

findAnomalies().catch(console.error);
