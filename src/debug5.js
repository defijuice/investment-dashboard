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

  // 스크래퍼와 동일한 로직 사용
  const notices = await page.evaluate((targetCategories) => {
    const rows = document.querySelectorAll('table tbody tr');
    const results = [];

    console.log('Total rows found:', rows.length);

    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('td');
      console.log(`Row ${rowIndex}: ${cells.length} cells`);

      if (cells.length < 5) {
        console.log(`  Skipping: not enough cells`);
        return;
      }

      const categoryCell = cells[1];
      const category = categoryCell?.textContent?.trim() || '';
      console.log(`  Category: "${category}"`);

      // 타겟 카테고리인지 확인
      const isTarget = targetCategories.some(tc => category.includes(tc));
      console.log(`  Is target: ${isTarget}`);

      if (!isTarget) {
        console.log(`  Skipping: not target category`);
        return;
      }

      const titleCell = cells[3];
      const titleLink = titleCell?.querySelector('a');
      const title = titleLink?.textContent?.trim() || '';
      console.log(`  Title: "${title}"`);

      // onclick에서 ID 추출
      const onclick = titleLink?.getAttribute('onclick') || '';
      console.log(`  onclick: "${onclick}"`);

      const idMatch = onclick.match(/board_view\((\d+)\)/);
      const id = idMatch ? idMatch[1] : null;
      console.log(`  ID: ${id}`);

      if (id) {
        results.push({
          id,
          category,
          title,
          date: cells[4]?.textContent?.trim() || ''
        });
      }
    });

    return results;
  }, TARGET_CATEGORIES);

  console.log('\n=== 결과 ===');
  console.log('발견된 게시글 수:', notices.length);
  notices.forEach(n => {
    console.log(`- [${n.category}] ${n.title} (ID: ${n.id})`);
  });

  await browser.close();
}

debug().catch(console.error);
