import 'dotenv/config';
import puppeteer from 'puppeteer';

async function debug() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1', {
    waitUntil: 'networkidle2'
  });

  // 링크의 모든 속성 확인
  const linkInfo = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const data = [];

    rows.forEach((row, idx) => {
      const titleCell = row.querySelector('td:nth-child(4)');
      const link = titleCell?.querySelector('a');

      if (link) {
        data.push({
          rowIndex: idx,
          href: link.getAttribute('href'),
          onclick: link.getAttribute('onclick'),
          outerHTML: link.outerHTML.substring(0, 300)
        });
      }
    });

    return data;
  });

  console.log('=== 링크 정보 ===');
  linkInfo.forEach(info => {
    console.log(`\nRow ${info.rowIndex}:`);
    console.log(`  href: ${info.href}`);
    console.log(`  onclick: ${info.onclick}`);
    console.log(`  HTML: ${info.outerHTML}`);
  });

  await browser.close();
}

debug().catch(console.error);
