import dotenv from 'dotenv';
dotenv.config({ path: './.env', override: true });

import { GoogleSheetsClient } from './core/googleSheets.js';

// ========== 시트 구조 정의 ==========
// 각 테이블에 고유 ID 추가, 신청현황에서는 ID로 참조

const SHEETS_CONFIG = {
  운용사: {
    headers: ['ID', '운용사명', '약어', '유형', '국가'],
    dropdowns: {
      D: ['국내VC', '해외VC', '창투사', '자산운용사', '기타'],
      E: ['한국', '미국', '유럽/중동', '아시아', '기타']
    }
  },
  출자사업: {
    headers: ['ID', '사업명', '소관', '공고유형', '연도', '차수', '지원파일ID', '결과파일ID', '현황'],
    dropdowns: {
      D: ['정시', '수시']
    }
  },
  신청현황: {
    headers: ['ID', '출자사업ID', '운용사ID', '출자분야', '결성예정액', '출자요청액', '최소결성규모', '통화단위', '상태', '비고'],
    dropdowns: {
      H: ['억원', 'USD M', 'EUR M'],
      I: ['접수', '선정', '탈락']
    }
  },
  파일: {
    headers: ['ID', '파일명', '파일번호', '파일유형', '파일URL', '처리상태', '처리일시', '비고', '현황'],
    dropdowns: {
      D: ['접수현황', '선정결과'],
      F: ['대기', '처리중', '완료', '오류']
    }
  }
};

async function setupSheets() {
  console.log('=== Google Sheets 초기화 시작 ===\n');

  const client = new GoogleSheetsClient();
  await client.init();

  // 기존 시트 확인
  const existingSheets = await client.getSheetNames();
  console.log('기존 시트:', existingSheets.map(s => s.title).join(', ') || '없음');

  // 각 시트 생성/초기화
  for (const [sheetName, config] of Object.entries(SHEETS_CONFIG)) {
    console.log(`\n--- ${sheetName} 시트 설정 ---`);

    // 시트 존재 확인/생성
    const existing = existingSheets.find(s => s.title === sheetName);
    if (existing) {
      console.log(`  시트 존재함 (ID: ${existing.sheetId})`);
    } else {
      const sheetId = await client.createSheet(sheetName);
      console.log(`  시트 생성됨 (ID: ${sheetId})`);
    }

    // 헤더 설정
    await client.setValues(`${sheetName}!A1`, [config.headers]);
    console.log(`  헤더 설정: ${config.headers.length}개 열`);

    // 헤더 스타일링
    await client.formatHeader(sheetName);
    console.log('  헤더 스타일 적용');

    // 드롭다운 설정
    if (config.dropdowns) {
      for (const [col, options] of Object.entries(config.dropdowns)) {
        await client.setDropdown(sheetName, col, options);
        console.log(`  드롭다운 설정: ${col}열 (${options.length}개 옵션)`);
      }
    }

  }

  // 기본 시트(Sheet1) 삭제 시도
  const sheet1 = existingSheets.find(s => s.title === 'Sheet1' || s.title === '시트1');
  if (sheet1) {
    try {
      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: client.spreadsheetId,
        requestBody: {
          requests: [{
            deleteSheet: { sheetId: sheet1.sheetId }
          }]
        }
      });
      console.log('\n기본 시트(Sheet1) 삭제됨');
    } catch (error) {
      console.log('\n기본 시트 삭제 실패 (이미 없거나 마지막 시트)');
    }
  }

  console.log('\n=== 초기화 완료 ===');
  console.log(`스프레드시트: https://docs.google.com/spreadsheets/d/${client.spreadsheetId}`);
}

setupSheets().catch(console.error);
