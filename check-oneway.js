import { GoogleSheetsClient } from './src/googleSheets.js';

(async () => {
  const client = new GoogleSheetsClient();

  const files = await client.getAllRows('파일');
  const file = files.find(f => f['파일번호'] === '4647');

  if (!file) {
    console.log('파일번호 4647을 찾을 수 없습니다.');
    return;
  }

  console.log('파일ID:', file['ID']);
  console.log('파일명:', file['파일명']);
  console.log('파일유형:', file['파일유형']);

  // 연결된 출자사업 찾기
  const projects = await client.getAllRows('출자사업');
  const fileId = file['ID'];
  const relatedProjects = projects.filter(p =>
    p['지원파일ID']?.includes(fileId) || p['결과파일ID']?.includes(fileId)
  );

  if (relatedProjects.length === 0) {
    console.log('연결된 출자사업이 없습니다.');
    return;
  }

  const projectId = relatedProjects[0]['ID'];
  console.log('\n출자사업ID:', projectId);
  console.log('사업명:', relatedProjects[0]['사업명']);

  // 신청현황 조회
  const apps = await client.getAllRows('신청현황');
  const operators = await client.getAllRows('운용사');

  const relatedApps = apps.filter(a => a['출자사업ID'] === projectId);
  console.log('\n신청현황 건수:', relatedApps.length);

  // One way 관련 운용사 찾기
  const oneWayApps = relatedApps.filter(a => {
    if (!a['운용사ID']) return false;
    const op = operators.find(o => o['ID'] === a['운용사ID']);
    if (!op) return false;
    const name = op['운용사명'] || '';
    return name.includes('원웨이') || name.toLowerCase().includes('one') || name.toLowerCase().includes('way');
  });

  console.log('\nOne way 관련 신청현황:');
  for (const app of oneWayApps) {
    const op = operators.find(o => o['ID'] === app['운용사ID']);
    console.log('- 운용사ID:', app['운용사ID']);
    console.log('  운용사명:', op?.['운용사명']);
    console.log('  약어:', op?.['약어'] || '(없음)');
    console.log('  출자분야:', app['출자분야']);
    console.log('  상태:', app['상태']);
    console.log('');
  }

  // PDF 파일 확인
  console.log('\nPDF 파일 위치:');
  console.log('downloads/' + file['파일명']);
})();
