import { GoogleSheetsClient } from '../core/googleSheets.js';

async function checkMissingAmounts() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 출자사업 조회 (결과파일ID가 있는 것만)
  const projects = await sheets.getAllRows('출자사업');
  const projectsWithResult = projects.filter(p => p['결과파일ID']);

  // 2. 파일 시트 (파일ID → 파일번호/파일명 매핑)
  const files = await sheets.getAllRows('파일');
  const fileMap = {};
  for (const f of files) {
    fileMap[f['ID']] = { 파일번호: f['파일번호'], 파일명: f['파일명'] };
  }

  // 3. 운용사 시트 (운용사ID → 운용사명 매핑)
  const operators = await sheets.getAllRows('운용사');
  const opMap = {};
  for (const op of operators) {
    opMap[op['ID']] = op['운용사명'];
  }

  // 4. 신청현황 (선정 상태만, 금액 미입력만)
  const apps = await sheets.getAllRows('신청현황');
  const selectedAppsNoAmount = apps.filter(a => {
    if (a['상태'] !== '선정') return false;
    const noAmount = (!a['최소결성규모'] && !a['모태출자액'] && !a['결성예정액'] && !a['출자요청액']);
    return noAmount;
  });

  // 5. 출자사업별 그룹핑
  console.log('=== 금액 미입력 선정 신청현황 상세 ===\n');

  const byProject = {};
  for (const app of selectedAppsNoAmount) {
    const pjId = app['출자사업ID'];
    if (!byProject[pjId]) byProject[pjId] = [];
    byProject[pjId].push(app);
  }

  // 출자사업별로 결과파일 정보와 함께 출력
  const result = [];
  for (const pj of projectsWithResult) {
    const pjId = pj['ID'];
    const appsInPj = byProject[pjId];
    if (!appsInPj || appsInPj.length === 0) continue;

    const resultFileIds = pj['결과파일ID'].split(',').map(s => s.trim());
    const fileInfos = resultFileIds.map(fid => {
      const fi = fileMap[fid];
      return fi ? { id: fid, 파일번호: fi['파일번호'], 파일명: fi['파일명'] } : { id: fid };
    });

    console.log('【' + pjId + '】 ' + pj['사업명']);
    console.log('결과파일: ' + fileInfos.map(f => f['파일번호']).join(', '));
    console.log('금액 미입력: ' + appsInPj.length + '건');

    // 각 신청현황 상세
    for (const app of appsInPj.slice(0, 5)) {
      const opName = opMap[app['운용사ID']] || app['운용사ID'];
      console.log('  - ' + opName + ' / ' + app['출자분야'] + ' (행: ' + app._rowIndex + ')');
    }
    if (appsInPj.length > 5) console.log('  ... 외 ' + (appsInPj.length - 5) + '건');
    console.log('');

    result.push({
      projectId: pjId,
      projectName: pj['사업명'],
      files: fileInfos,
      apps: appsInPj.map(a => ({
        appId: a['ID'],
        rowIndex: a._rowIndex,
        operatorId: a['운용사ID'],
        operatorName: opMap[a['운용사ID']] || a['운용사ID'],
        category: a['출자분야']
      }))
    });
  }

  return result;
}

checkMissingAmounts().catch(console.error);
