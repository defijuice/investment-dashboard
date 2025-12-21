/**
 * 기존 시트에서 새 시트로 데이터 마이그레이션
 * - 운용사 → 운용사DB
 * - 출자사업 → 출자사업DB
 * - 파일처리이력 → 파일DB (신청현황ID 필드 제외)
 *
 * 마이그레이션 후 기존 시트 삭제
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env', override: true });

import { GoogleSheetsClient } from './googleSheets.js';

async function migrate() {
  console.log('=== 시트 마이그레이션 시작 ===\n');

  const client = new GoogleSheetsClient();
  await client.init();

  // 기존 시트 확인
  const sheets = await client.getSheetNames();
  console.log('현재 시트:', sheets.map(s => s.title).join(', '));

  // 1. 운용사 → 운용사DB 마이그레이션
  const oldOperators = sheets.find(s => s.title === '운용사');
  const newOperators = sheets.find(s => s.title === '운용사DB');

  if (oldOperators && newOperators) {
    console.log('\n--- 운용사 → 운용사DB 마이그레이션 ---');
    const rows = await client.getValues('운용사!A2:Z');
    if (rows.length > 0) {
      await client.appendRows('운용사DB', rows);
      console.log(`  ${rows.length}건 복사 완료`);
    } else {
      console.log('  복사할 데이터 없음');
    }
  }

  // 2. 출자사업 → 출자사업DB 마이그레이션
  const oldProjects = sheets.find(s => s.title === '출자사업');
  const newProjects = sheets.find(s => s.title === '출자사업DB');

  if (oldProjects && newProjects) {
    console.log('\n--- 출자사업 → 출자사업DB 마이그레이션 ---');
    const rows = await client.getValues('출자사업!A2:Z');
    if (rows.length > 0) {
      await client.appendRows('출자사업DB', rows);
      console.log(`  ${rows.length}건 복사 완료`);
    } else {
      console.log('  복사할 데이터 없음');
    }
  }

  // 3. 파일처리이력 → 파일DB 마이그레이션 (신청현황ID 제외)
  const oldFiles = sheets.find(s => s.title === '파일처리이력');
  const newFiles = sheets.find(s => s.title === '파일DB');

  if (oldFiles && newFiles) {
    console.log('\n--- 파일처리이력 → 파일DB 마이그레이션 ---');
    // 기존: ID, 파일명, 파일번호, 파일유형, 파일URL, 처리상태, 처리일시, 신청현황ID, 비고
    // 신규: ID, 파일명, 파일번호, 파일유형, 파일URL, 처리상태, 처리일시, 비고
    const rows = await client.getValues('파일처리이력!A2:I');
    if (rows.length > 0) {
      // 8번째 열(신청현황ID) 제거, 9번째 열(비고)을 8번째로 이동
      const migratedRows = rows.map(row => {
        // A-G (0-6): 그대로, H (7): 신청현황ID 제거, I (8): 비고 → H로
        return [
          row[0] || '',  // ID
          row[1] || '',  // 파일명
          row[2] || '',  // 파일번호
          row[3] || '',  // 파일유형
          row[4] || '',  // 파일URL
          row[5] || '',  // 처리상태
          row[6] || '',  // 처리일시
          row[8] || ''   // 비고 (기존 9번째 → 8번째)
        ];
      });
      await client.appendRows('파일DB', migratedRows);
      console.log(`  ${migratedRows.length}건 복사 완료 (신청현황ID 필드 제외)`);
    } else {
      console.log('  복사할 데이터 없음');
    }
  }

  // 4. 기존 시트 삭제
  console.log('\n--- 기존 시트 삭제 ---');
  const sheetsToDelete = ['운용사', '출자사업', '파일처리이력'];

  for (const sheetName of sheetsToDelete) {
    const sheet = sheets.find(s => s.title === sheetName);
    if (sheet) {
      try {
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: client.spreadsheetId,
          requestBody: {
            requests: [{
              deleteSheet: { sheetId: sheet.sheetId }
            }]
          }
        });
        console.log(`  ${sheetName} 삭제 완료`);
      } catch (error) {
        console.log(`  ${sheetName} 삭제 실패: ${error.message}`);
      }
    }
  }

  console.log('\n=== 마이그레이션 완료 ===');
  console.log(`스프레드시트: https://docs.google.com/spreadsheets/d/${client.spreadsheetId}`);
}

migrate().catch(console.error);
