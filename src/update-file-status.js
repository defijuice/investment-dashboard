import { GoogleSheetsClient } from './googleSheets.js';

async function updateMissingFileStatus() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 파일 시트 전체 조회
  const files = await sheets.getAllRows('파일');

  // 처리상태가 '완료'인데 현황이 비어있는 파일 찾기
  const needsUpdate = files.filter(f =>
    f['처리상태'] === '완료' && !f['현황']
  );

  console.log('=== 현황 업데이트 필요한 파일 ===');
  console.log('총', needsUpdate.length, '건\n');

  if (needsUpdate.length === 0) {
    console.log('업데이트 필요한 파일이 없습니다.');
    return;
  }

  for (const file of needsUpdate) {
    console.log(`\n처리 중: ${file['ID']} | ${file['파일유형']} | ${file['파일명']?.substring(0, 50)}`);

    try {
      const result = await sheets.syncFileStatusWithApplications(file['ID']);
      if (result) {
        console.log(`  → 현황 업데이트됨: ${result.summary}`);
      } else {
        console.log('  → 동기화 대상 아님 (접수현황 파일이거나 출자사업 연결 없음)');
      }
    } catch (error) {
      console.error(`  → 에러: ${error.message}`);
    }
  }

  console.log('\n=== 완료 ===');
}

updateMissingFileStatus().catch(console.error);
