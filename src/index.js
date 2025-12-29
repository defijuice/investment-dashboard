import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { KvicScraper } from './core/scraper.js';
import { GoogleDriveUploader } from './core/googleDrive.js';

// 환경 변수 검증
function validateEnv() {
  const required = ['GOOGLE_DRIVE_FOLDER_ID'];
  const missing = required.filter(key => !process.env[key] || process.env[key].includes('여기에'));

  if (missing.length > 0) {
    console.error('필수 환경 변수가 설정되지 않았습니다:');
    missing.forEach(key => console.error(`  - ${key}`));
    console.error('\n.env 파일을 확인해주세요.');
    process.exit(1);
  }
}

// 처리된 게시글 기록 관리
const PROCESSED_FILE = './processed.json';

function loadProcessed() {
  if (fs.existsSync(PROCESSED_FILE)) {
    return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
  }
  return { notices: [] };
}

function saveProcessed(data) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(data, null, 2));
}

function isProcessed(noticeId) {
  const data = loadProcessed();
  return data.notices.includes(noticeId);
}

function markProcessed(noticeId) {
  const data = loadProcessed();
  if (!data.notices.includes(noticeId)) {
    data.notices.push(noticeId);
    saveProcessed(data);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('KVIC 공지사항 첨부파일 자동 다운로드 및 Google Drive 업로드');
  console.log('='.repeat(60));
  console.log(`대상 카테고리: 접수현황, 선정결과`);
  console.log(`시작 시간: ${new Date().toLocaleString('ko-KR')}`);
  console.log('='.repeat(60));

  // 환경 변수 검증
  validateEnv();

  const downloadDir = path.resolve('./downloads');
  const credentialsPath = path.resolve(process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || './credentials/oauth-credentials.json');

  // Google Drive 초기화 (OAuth 방식)
  const uploader = new GoogleDriveUploader({
    credentialsPath,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID
  });

  try {
    await uploader.init();
  } catch (error) {
    console.error('\nGoogle Drive 초기화 실패:', error.message);
    process.exit(1);
  }

  // 스크래퍼 초기화
  const scraper = new KvicScraper({
    baseUrl: process.env.KVIC_BASE_URL || 'https://www.kvic.or.kr',
    noticePath: process.env.KVIC_NOTICE_PATH || '/notice/kvic-notice/investment-business-notice',
    downloadDir
  });

  try {
    await scraper.init();
    console.log('\n브라우저 초기화 완료\n');

    // 최근 5페이지만 스캔 (조정 가능)
    const maxPages = parseInt(process.env.MAX_PAGES || '5', 10);
    let totalNewFiles = 0;
    let totalSkipped = 0;

    for (let page = 1; page <= maxPages; page++) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`페이지 ${page}/${maxPages} 처리 중...`);
      console.log('─'.repeat(50));

      const notices = await scraper.getNoticeList(page);

      if (notices.length === 0) {
        console.log('타겟 카테고리 게시글 없음');
        continue;
      }

      console.log(`발견된 게시글: ${notices.length}개`);

      for (const notice of notices) {
        // 이미 처리된 게시글 스킵
        if (isProcessed(notice.id)) {
          console.log(`\n[스킵] 이미 처리됨: ${notice.id}`);
          totalSkipped++;
          continue;
        }

        console.log(`\n[처리] [${notice.category}] ${notice.title}`);
        console.log(`  날짜: ${notice.date}`);

        // 상세 페이지에서 첨부파일 정보 가져오기
        const attachments = await scraper.getNoticeDetail(notice.id);

        if (attachments.length === 0) {
          console.log('  첨부파일 없음');
          markProcessed(notice.id);
          continue;
        }

        console.log(`  첨부파일 ${attachments.length}개 발견`);

        // 각 첨부파일 다운로드 및 업로드
        for (const attachment of attachments) {
          console.log(`  다운로드 중: ${attachment.fileName}`);

          const localPath = await scraper.downloadFile(notice.id, attachment);

          if (localPath && fs.existsSync(localPath)) {
            // Google Drive에 업로드
            const uploadResult = await uploader.uploadFile(localPath);

            if (uploadResult.success) {
              totalNewFiles++;
              // 로컬 파일 삭제 (선택적)
              // fs.unlinkSync(localPath);
            }
          }
        }

        // 처리 완료 표시
        markProcessed(notice.id);

        // 서버 부하 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('처리 완료!');
    console.log('='.repeat(60));
    console.log(`새로 업로드된 파일: ${totalNewFiles}개`);
    console.log(`스킵된 게시글 (이미 처리됨): ${totalSkipped}개`);
    console.log(`종료 시간: ${new Date().toLocaleString('ko-KR')}`);

  } catch (error) {
    console.error('\n오류 발생:', error);
  } finally {
    await scraper.close();
    console.log('\n브라우저 종료');
  }
}

// 실행
main().catch(console.error);
