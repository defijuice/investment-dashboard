import { GoogleSheetsClient } from "./googleSheets.js";

(async () => {
  const client = new GoogleSheetsClient();
  await client.init();

  const data = await client.getAllRows("신청현황");
  console.log("=== 신청현황 전체 데이터 ===");
  console.log("총 건수:", data.length);

  // 결성예정액 또는 출자요청액이 비어있는 건 찾기
  const emptyRows = data.filter(row => {
    const amount1 = row["결성예정액"];
    const amount2 = row["출자요청액"];
    return !amount1 || !amount2 || amount1 === "" || amount2 === "";
  });

  console.log("\n=== 결성예정액/출자요청액 비어있는 건 ===");
  console.log("건수:", emptyRows.length);

  // 출자분야별로 그룹핑
  const byField = {};
  emptyRows.forEach(row => {
    const field = row["출자분야"] || "(미지정)";
    if (!byField[field]) byField[field] = [];
    byField[field].push(row);
  });

  console.log("\n=== 출자분야별 비어있는 건수 ===");
  for (const [field, rows] of Object.entries(byField)) {
    console.log(`${field}: ${rows.length}건`);
  }

  // 출자사업ID 확인
  const projectIds = [...new Set(emptyRows.map(r => r["출자사업ID"]))];
  console.log("\n=== 관련 출자사업 ===");

  const projects = await client.getAllRows("출자사업");
  for (const pjId of projectIds) {
    const pj = projects.find(p => p["ID"] === pjId);
    if (pj) {
      console.log(`${pjId}: ${pj["사업명"]} | 지원파일ID: ${pj["지원파일ID"]} | 결과파일ID: ${pj["결과파일ID"]}`);
    }
  }

  // 해당 파일 확인
  const files = await client.getAllRows("파일");
  console.log("\n=== 관련 파일 정보 ===");
  for (const pjId of projectIds) {
    const pj = projects.find(p => p["ID"] === pjId);
    if (pj && pj["지원파일ID"]) {
      const fileIds = pj["지원파일ID"].split(",").map(s => s.trim());
      for (const fid of fileIds) {
        const file = files.find(f => f["ID"] === fid);
        if (file) {
          console.log(`${fid}: ${file["파일명"]} (${file["파일번호"]})`);
        }
      }
    }
  }
})();