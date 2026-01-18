import 'dotenv/config';
import { GoogleSheetsClient } from '../src/core/googleSheets.js';

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  const apps = await sheets.getAllRows('신청현황');

  // 수정할 항목들
  const corrections = [
    // 대학창업1 (1펀드, 공동GP) - 결성 25.25, 요청 15
    { apId: 'AP1107', minSize: '', mof: '', fundSize: 25.25, requestAmt: 15 },
    { apId: 'AP1108', minSize: '', mof: '', fundSize: 25.25, requestAmt: 15 },

    // 대학창업2 (3펀드) - 각 펀드당 결성 35.8, 요청 20
    { apId: 'AP1109', minSize: '', mof: '', fundSize: 35.8, requestAmt: 20 },
    { apId: 'AP1110', minSize: '', mof: '', fundSize: 35.8, requestAmt: 20 },
    { apId: 'AP1113', minSize: '', mof: '', fundSize: 35.8, requestAmt: 20 },
    { apId: 'AP1114', minSize: '', mof: '', fundSize: 35.8, requestAmt: 20 },
    { apId: 'AP1115', minSize: '', mof: '', fundSize: 35.8, requestAmt: 20 },
  ];

  console.log('=== PJ0026 선정 운용사 데이터 수정 ===\n');

  for (const c of corrections) {
    const app = apps.find(a => a['ID'] === c.apId);
    if (!app) {
      console.log('X', c.apId, '찾을 수 없음');
      continue;
    }

    const row = app._rowIndex;

    console.log(c.apId, '(행', row, ')');
    console.log('  수정 전: 최소=' + (app['최소결성규모'] || '-') + ', 모태=' + (app['모태출자액'] || '-') + ', 결성=' + (app['결성예정액'] || '-') + ', 요청=' + (app['출자요청액'] || '-'));

    await sheets.setValues(`신청현황!E${row}:H${row}`, [[c.minSize, c.mof, c.fundSize, c.requestAmt]]);

    console.log('  수정 후: 최소=' + (c.minSize || '-') + ', 모태=' + (c.mof || '-') + ', 결성=' + c.fundSize + ', 요청=' + c.requestAmt);
    console.log('  OK');
  }

  console.log('\n=== 수정 완료 ===');
  console.log('대학창업1: 2건 (결성 25.25, 요청 15)');
  console.log('대학창업2: 5건 (결성 35.8, 요청 20)');
  console.log('합계 검증: 25.25 + 35.8*3 =', 25.25 + 35.8*3, '억원 (PDF: 132.65억)');
}

main().catch(console.error);
