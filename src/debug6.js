import 'dotenv/config';
import puppeteer from 'puppeteer';

const TARGET_CATEGORIES = ['접수현황', '선정결과'];

async function debug() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.goto('https://www.kvic.or.kr/notice/kvic-notice/investment-business-notice?pageNo=1&searchType=all&searchWord=&searchCategory=', {
    waitUntil: 'networkidle2'
  });

  // 모든 행 데이터를 반환
  const rowsData = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const data = [];

    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 5) {
        const category = cells[1]?.textContent?.trim() || '';
        const titleLink = cells[3]?.querySelector('a');
        const onclick = titleLink?.getAttribute('onclick') || '';
        const idMatch = onclick.match(/board_view\((\d+)\)/);

        data.push({
          rowIndex,
          cellCount: cells.length,
          category,
          title: titleLink?.textContent?.trim() || '',
          onclick,
          id: idMatch ? idMatch[1] : null
        });
      }
    });

    return data;
  });

  console.log('=== 전체 행 데이터 ===');
  rowsData.forEach(row => {
    console.log(`Row ${row.rowIndex}: category="${row.category}", id=${row.id}`);
    console.log(`  title: ${row.title.substring(0, 50)}`);
  });

  console.log('\n=== 타겟 카테고리 필터링 테스트 ===');
  rowsData.forEach(row => {
    TARGET_CATEGORIES.forEach(tc => {
      const includes = row.category.includes(tc);
      if (includes) {
        console.log(`"${row.category}".includes("${tc}") = ${includes} ✓`);
      }
    });
  });

  const filtered = rowsData.filter(row =>
    TARGET_CATEGORIES.some(tc => row.category.includes(tc))
  );

  console.log('\n=== 필터링된 결과 ===');
  console.log(`총 ${filtered.length}개`);
  filtered.forEach(row => {
    console.log(`- [${row.category}] ${row.title.substring(0, 40)}... (ID: ${row.id})`);
  });

  await browser.close();
}

debug().catch(console.error);
