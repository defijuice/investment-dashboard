import { GoogleSheetsClient } from "./googleSheets.js";

// 문화 계정 분야별 금액 (PDF 4073에서 추출)
const CATEGORY_AMOUNTS = {
  "문화 - IP": { 결성예정액: "4,510", 출자요청액: "2,700" },
  "문화 - M&A-세컨더리": { 결성예정액: "1,135", 출자요청액: "400" },
  "문화 - 문화일반": { 결성예정액: "2,400", 출자요청액: "1,200" },
  "문화 - 수출": { 결성예정액: "3,400", 출자요청액: "2,025" },
  "문화 - 신기술": { 결성예정액: "3,683", 출자요청액: "2,200" },
  "문화 - 중저예산 한국영화": { 결성예정액: "1,383", 출자요청액: "690" },
  "문화 - 한국영화 메인투자": { 결성예정액: "840", 출자요청액: "420" },
};

(async () => {
  const client = new GoogleSheetsClient();
  await client.init();

  const data = await client.getAllRows("신청현황");
  console.log("=== 결성예정액/출자요청액 비어있는 건 수정 ===\n");

  // 결성예정액 또는 출자요청액이 비어있는 건 찾기
  const emptyRows = data.filter(row => {
    const amount1 = row["결성예정액"];
    const amount2 = row["출자요청액"];
    return !amount1 || !amount2 || amount1 === "" || amount2 === "";
  });

  console.log(`수정 대상: ${emptyRows.length}건\n`);

  let updated = 0;
  let skipped = 0;

  for (const row of emptyRows) {
    const field = row["출자분야"];
    const amounts = CATEGORY_AMOUNTS[field];

    if (!amounts) {
      console.log(`[건너뜀] ${row["ID"]} - 분야 "${field}"의 금액 정보 없음`);
      skipped++;
      continue;
    }

    // E열: 결성예정액, F열: 출자요청액
    const rowIndex = row._rowIndex;

    await client.setValues(`신청현황!E${rowIndex}:F${rowIndex}`, [
      [amounts.결성예정액, amounts.출자요청액]
    ]);

    console.log(`[수정] ${row["ID"]} | ${field} | ${amounts.결성예정액} / ${amounts.출자요청액}`);
    updated++;

    // API 할당량 관리를 위한 딜레이
    if (updated % 20 === 0) {
      console.log(`  ... ${updated}건 처리 완료, 잠시 대기`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`수정: ${updated}건`);
  console.log(`건너뜀: ${skipped}건`);
})();
