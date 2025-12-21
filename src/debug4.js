import 'dotenv/config';
import puppeteer from 'puppeteer';

async function debug() {
  // headless: true로 테스트 (실제 실행 환경과 동일)
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.goto('https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1', {
    waitUntil: 'networkidle2'
  });

  // 페이지 구조 상세 분석
  const analysis = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const tbodies = document.querySelectorAll('tbody');
    const trs = document.querySelectorAll('tr');

    // 첫 번째 테이블의 전체 구조 확인
    const firstTable = tables[0];
    let tableHtml = '';
    if (firstTable) {
      tableHtml = firstTable.outerHTML.substring(0, 3000);
    }

    // 모든 행 데이터
    const allRows = [];
    trs.forEach((tr, idx) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length > 0) {
        allRows.push({
          rowIndex: idx,
          cellCount: tds.length,
          cells: Array.from(tds).map(td => td.textContent?.trim().substring(0, 50))
        });
      }
    });

    return {
      tableCount: tables.length,
      tbodyCount: tbodies.length,
      trCount: trs.length,
      allRows,
      tableHtml
    };
  });

  console.log('테이블 수:', analysis.tableCount);
  console.log('tbody 수:', analysis.tbodyCount);
  console.log('tr 수:', analysis.trCount);
  console.log('\n모든 행 데이터:');
  analysis.allRows.forEach(row => {
    console.log(`Row ${row.rowIndex} (${row.cellCount} cells):`, row.cells);
  });

  console.log('\n테이블 HTML (처음 3000자):');
  console.log(analysis.tableHtml);

  await browser.close();
}

debug().catch(console.error);
