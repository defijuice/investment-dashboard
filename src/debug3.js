import 'dotenv/config';
import puppeteer from 'puppeteer';

async function debug() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // 목록 페이지 접속
  await page.goto('https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1', {
    waitUntil: 'networkidle2'
  });

  console.log('목록 페이지 로드 완료');

  // 선정결과 게시글 클릭
  await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    for (const row of rows) {
      const category = row.querySelector('td:nth-child(2)')?.textContent?.trim();
      if (category === '[선정결과]') {
        const link = row.querySelector('td:nth-child(4) a');
        if (link) {
          link.click();
          return;
        }
      }
    }
  });

  // 페이지 전환 대기
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  console.log('현재 URL:', page.url());

  // 상세 페이지 분석
  const pageInfo = await page.evaluate(() => {
    // 페이지 전체 HTML에서 첨부파일 찾기
    const bodyHtml = document.body.innerHTML;

    // 다운로드 관련 모든 요소 찾기
    const allElements = document.body.querySelectorAll('*');
    const downloadRelated = [];

    allElements.forEach(el => {
      const html = el.outerHTML;
      if ((html.includes('download') || html.includes('file') || html.includes('첨부')) &&
          el.tagName !== 'HTML' && el.tagName !== 'BODY' && el.tagName !== 'HEAD') {
        if (el.outerHTML.length < 500) {
          downloadRelated.push({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            html: el.outerHTML.substring(0, 300)
          });
        }
      }
    });

    // board_file_download 함수 확인
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent);
    const downloadScript = scripts.find(s => s.includes('download') || s.includes('file'));

    return {
      url: window.location.href,
      title: document.title,
      downloadRelated: downloadRelated.slice(0, 20),
      hasDownloadScript: !!downloadScript,
      scriptSample: downloadScript ? downloadScript.substring(0, 500) : '없음'
    };
  });

  console.log('\n상세 페이지 URL:', pageInfo.url);
  console.log('페이지 제목:', pageInfo.title);
  console.log('\n다운로드 관련 요소들:');
  pageInfo.downloadRelated.forEach((el, i) => {
    console.log(`${i + 1}. [${el.tag}] class="${el.class}" id="${el.id}"`);
    console.log(`   ${el.html}`);
  });

  await new Promise(r => setTimeout(r, 30000));
  await browser.close();
}

debug().catch(console.error);
