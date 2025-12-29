import { GoogleDriveUploader } from '../core/googleDrive.js';
import { GoogleSheetsClient } from '../core/googleSheets.js';
import 'dotenv/config';

const FOLDER_ID = '1OhnHUj9I11kQYaBN6j-K9xUWOxiak1ni';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function main() {
  // Google Drive 초기화
  const drive = new GoogleDriveUploader({ folderId: FOLDER_ID });
  await drive.init();

  // Google Sheets 초기화
  const sheets = new GoogleSheetsClient({ spreadsheetId: SPREADSHEET_ID });
  await sheets.init();
  
  // Drive 폴더의 파일 목록 가져오기
  console.log('\n=== Google Drive 파일 목록 ===');
  const driveFiles = await drive.listFiles(FOLDER_ID);
  console.log(`총 ${driveFiles.length}개 파일`);
  
  // 시트의 파일 목록 가져오기
  console.log('\n=== 시트 파일 목록 ===');
  const sheetFiles = await sheets.getAllRows('파일');
  console.log(`총 ${sheetFiles.length}개 파일`);
  
  // 시트에 등록된 파일명 Set
  const sheetFileNames = new Set(sheetFiles.map(f => f['파일명']));
  
  // Drive에는 있지만 시트에 없는 파일 찾기
  console.log('\n=== 시트에 미등록된 파일 ===');
  const missingFiles = driveFiles.filter(f => !sheetFileNames.has(f.name));
  
  if (missingFiles.length === 0) {
    console.log('모든 파일이 시트에 등록되어 있습니다.');
    return;
  }
  
  console.log(`미등록 파일 ${missingFiles.length}개:`);
  for (const file of missingFiles) {
    console.log(`  - ${file.name} (${file.id})`);
  }
  
  // 미등록 파일을 시트에 추가
  console.log('\n=== 파일 등록 시작 ===');
  for (const file of missingFiles) {
    // 파일번호 추출 (파일명 앞 4자리)
    const fileNoMatch = file.name.match(/^(\d+)_/);
    const fileNo = fileNoMatch ? fileNoMatch[1] : '';
    
    // 파일유형 판별
    let fileType = '';
    if (file.name.includes('접수') || file.name.includes('신청')) {
      fileType = '접수현황';
    } else if (file.name.includes('선정') || file.name.includes('결과')) {
      fileType = '선정결과';
    }
    
    // 파일 URL
    const fileUrl = `https://drive.google.com/file/d/${file.id}/view`;
    
    // 시트에 등록
    const result = await sheets.getOrCreateFileHistory(fileNo, file.name, fileType, fileUrl);
    if (result.isNew) {
      console.log(`  [등록] ${file.name}`);
    } else {
      console.log(`  [이미 존재] ${file.name}`);
    }
  }
  
  console.log('\n완료!');
}

main().catch(console.error);
