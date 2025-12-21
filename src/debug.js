import 'dotenv/config';
import puppeteer from 'puppeteer';

async function debug() {
  const browser = await puppeteer.launch({ headless: false }); // 브라우저 보이게
  const page = await browser.newPage();

  await page.goto('https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1', {
    waitUntil: 'networkidle2'
  });

  // 페이지 HTML 구조 확인
  const tableHtml = await page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return '테이블 없음';

    const rows = table.querySelectorAll('tbody tr');
    const data = [];

    rows.forEach((row, idx) => {
      const cells = row.querySelectorAll('td');
      const rowData = [];
      cells.forEach((cell, cellIdx) => {
        rowData.push(`[${cellIdx}] ${cell.textContent.trim().substring(0, 50)}`);
      });
      data.push(`Row ${idx}: ${rowData.join(' | ')}`);
    });

    return data.join('\n');
  });

  console.log('테이블 구조:');
  console.log(tableHtml);

  // 카테고리 값들 확인
  const categories = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const cats = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 1) {
        cats.push(cells[1]?.textContent?.trim() || 'N/A');
      }
    });
    return cats;
  });

  console.log('\n발견된 카테고리들:', categories);

  // 잠시 대기 후 닫기
  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
}

debug().catch(console.error);
