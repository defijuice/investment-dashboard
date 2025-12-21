import { GoogleSheetsClient } from './googleSheets.js';

async function listMissingAmounts() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  const apps = await sheets.getAllRows('신청현황');
  const ops = await sheets.getAllRows('운용사');
  const projects = await sheets.getAllRows('출자사업');
  const files = await sheets.getAllRows('파일');

  const opMap = {};
  for (const op of ops) {
    opMap[op['ID']] = op['운용사명'];
  }

  const fileMap = {};
  for (const f of files) {
    fileMap[f['ID']] = { 파일번호: f['파일번호'], 파일명: f['파일명'] };
  }

  // 프로젝트별 선정 금액미입력 신청현황 통계
  const projectsWithNoAmount = {};

  for (const app of apps) {
    if (app['상태'] !== '선정') continue;
    const noAmount = !app['최소결성규모'] && !app['모태출자액'] && !app['결성예정액'] && !app['출자요청액'];
    if (!noAmount) continue;

    const pjId = app['출자사업ID'];
    if (!projectsWithNoAmount[pjId]) {
      projectsWithNoAmount[pjId] = [];
    }
    projectsWithNoAmount[pjId].push({
      opName: opMap[app['운용사ID']] || app['운용사ID'],
      category: app['출자분야'],
      rowIndex: app._rowIndex
    });
  }

  console.log('=== 프로젝트별 금액 미입력 상세 ===\n');

  for (const pj of projects) {
    const pjId = pj['ID'];
    if (!projectsWithNoAmount[pjId]) continue;

    const resultFileIds = (pj['결과파일ID'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const fileNums = resultFileIds.map(fid => fileMap[fid] ? fileMap[fid]['파일번호'] : fid).join(', ');

    console.log('【' + pjId + '】 ' + pj['사업명']);
    console.log('결과파일: ' + fileNums);
    console.log('');

    for (const item of projectsWithNoAmount[pjId]) {
      console.log('  ' + item.opName + ' | ' + item.category + ' | row:' + item.rowIndex);
    }
    console.log('');
  }
}

listMissingAmounts().catch(console.error);
