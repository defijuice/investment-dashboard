import 'dotenv/config';
import puppeteer from 'puppeteer';

async function debug() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // 선정결과 게시글 상세 페이지 접속
  const noticeId = '1006'; // [선정결과] 2025년 해외VC 글로벌 펀드 하반기 출자사업 최종 선정결과
  await page.goto(`https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice/${noticeId}`, {
    waitUntil: 'networkidle2'
  });

  // 페이지 전체 HTML에서 첨부파일 관련 요소 찾기
  const pageInfo = await page.evaluate(() => {
    // 모든 링크 찾기
    const allLinks = Array.from(document.querySelectorAll('a'));
    const fileLinks = allLinks.filter(a => {
      const href = a.getAttribute('href') || '';
      const onclick = a.getAttribute('onclick') || '';
      const text = a.textContent || '';
      return href.includes('file') || href.includes('download') ||
             onclick.includes('file') || onclick.includes('download') ||
             text.includes('.pdf') || text.includes('.hwp') || text.includes('.xlsx') || text.includes('.zip');
    }).map(a => ({
      text: a.textContent?.trim().substring(0, 100),
      href: a.getAttribute('href'),
      onclick: a.getAttribute('onclick'),
      className: a.className
    }));

    // board-view 관련 요소 찾기
    const boardView = document.querySelector('.board-view, .view-wrap, .content-view, article');
    const boardViewHtml = boardView ? boardView.innerHTML.substring(0, 2000) : 'board-view 없음';

    // 첨부파일 영역 찾기
    const fileArea = document.querySelector('.file, .attach, .download, [class*="file"], [class*="attach"]');
    const fileAreaHtml = fileArea ? fileArea.outerHTML : '첨부파일 영역 없음';

    return {
      fileLinks,
      boardViewHtml,
      fileAreaHtml,
      pageTitle: document.title
    };
  });

  console.log('페이지 제목:', pageInfo.pageTitle);
  console.log('\n첨부파일 관련 링크들:');
  console.log(JSON.stringify(pageInfo.fileLinks, null, 2));
  console.log('\n첨부파일 영역:');
  console.log(pageInfo.fileAreaHtml);

  await new Promise(r => setTimeout(r, 15000));
  await browser.close();
}

debug().catch(console.error);
