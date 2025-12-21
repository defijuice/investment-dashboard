import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4574: 모태펀드(문화, 관광) 2025년 8월 수시 접수현황 - 9개 조합, 16개 운용사
// 접수: 관광, 문화 → 선정: 관광기업육성, IP
const applications = [
  // 관광 - 6개 운용사 (4조합, 공동GP 1건)
  { company: "NBH캐피탈", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "씨엔티테크", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "유진자산운용", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "넥스트지인베스트먼트", category: "문체부 - 관광기업육성", isJoint: false },
  { company: "로간벤처스", category: "문체부 - 관광기업육성", isJoint: false },
  { company: "포스트자산운용", category: "문체부 - 관광기업육성", isJoint: false },

  // 문화(IP) - 10개 운용사 (5조합, 공동GP 4건)
  { company: "에스투엘파트너스", category: "문체부 - IP", isJoint: true },
  { company: "에이티넘벤처스", category: "문체부 - IP", isJoint: true },
  { company: "에이본인베스트먼트", category: "문체부 - IP", isJoint: false },
  { company: "엠더블유앤컴퍼니", category: "문체부 - IP", isJoint: true },
  { company: "비와이비인베스트먼트", category: "문체부 - IP", isJoint: true },
  { company: "웰컴벤처스", category: "문체부 - IP", isJoint: true },
  { company: "로간벤처스", category: "문체부 - IP", isJoint: true },
  { company: "지온인베스트먼트", category: "문체부 - IP", isJoint: true },
  { company: "솔트룩스벤처스", category: "문체부 - IP", isJoint: true },
];

// 4638: 선정결과 - 3개 조합 (4개 운용사)
const selectedOperators = [
  // 관광기업육성 - 2조합
  { company: "넥스트지인베스트먼트", category: "문체부 - 관광기업육성" },
  { company: "로간벤처스", category: "문체부 - 관광기업육성" },
  // IP - 1조합 (공동GP)
  { company: "에스투엘파트너스", category: "문체부 - IP" },
  { company: "에이티넘벤처스", category: "문체부 - IP" },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4574 = await sheets.findRow("파일", "파일번호", "4574");
  const file4638 = await sheets.findRow("파일", "파일번호", "4638");
  const fileId4574 = file4574 ? file4574["ID"] : null;
  const fileId4638 = file4638 ? file4638["ID"] : null;
  console.log("파일 ID - 4574:", fileId4574, ", 4638:", fileId4638);

  // 2. 출자사업 생성/조회
  const projectName = "모태펀드(문화, 관광) 2025년 8월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "문체부",
    공고유형: "수시",
    연도: "2025",
    차수: "8월",
    지원파일ID: fileId4574
  });
  console.log(project.isNew ? "출자사업 생성:" : "출자사업 존재:", project.id);

  // 3. 기존 운용사 조회 및 신규 등록
  const existingOps = await sheets.getAllOperators();
  const operatorMap = new Map();
  for (const op of existingOps) {
    operatorMap.set(op["운용사명"], op["ID"]);
  }

  // 신규 운용사 찾기
  const newOperatorNames = [];
  for (const app of applications) {
    if (!operatorMap.has(app.company)) {
      newOperatorNames.push(app.company);
    }
  }

  const uniqueNew = [...new Set(newOperatorNames)];
  if (uniqueNew.length > 0) {
    console.log("신규 운용사 후보:", uniqueNew.length, "개");
    const result = findSimilarOperators(uniqueNew, existingOps);

    for (const sim of result.similar) {
      if (sim.score >= 0.85) {
        console.log(`유사 운용사: ${sim.newName} → ${sim.existingName} (${(sim.score * 100).toFixed(0)}%)`);
        operatorMap.set(sim.newName, sim.existingId);
      }
    }

    const toCreate = result.new.map(n => typeof n === "string" ? n : n.newName);
    if (toCreate.length > 0) {
      const nameToIdMap = await sheets.createOperatorsBatch(toCreate);
      for (const [name, id] of nameToIdMap) {
        operatorMap.set(name, id);
      }
      console.log("신규 운용사 등록:", toCreate.length, "개");
    }
  }

  // 4. 신청현황 생성
  const existingApps = await sheets.getExistingApplications(project.id);
  const appsToCreate = [];
  const missingOps = [];

  for (const app of applications) {
    const opId = operatorMap.get(app.company);
    if (!opId) {
      missingOps.push(app.company);
      continue;
    }
    const key = `${opId}|${app.category}`;
    if (existingApps.has(key)) continue;

    appsToCreate.push({
      출자사업ID: project.id,
      운용사ID: opId,
      출자분야: app.category,
      상태: "접수",
      비고: app.isJoint ? "공동GP" : ""
    });
  }

  if (appsToCreate.length > 0) {
    await sheets.createApplicationsBatch(appsToCreate);
    console.log("신청현황 생성:", appsToCreate.length, "건");
  }

  if (missingOps.length > 0) {
    console.log("운용사 ID 없음:", [...new Set(missingOps)].join(", "));
  }

  // 5. 파일 4574 처리상태 업데이트
  if (file4574) {
    const rowIdx = file4574._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 9개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4574 처리 완료");
  }

  // 6. 선정결과 처리
  const ops2 = await sheets.getAllOperators();
  const opMap2 = new Map();
  for (const op of ops2) {
    opMap2.set(op["운용사명"], op["ID"]);
  }

  const selectedKeys = new Set();
  for (const sel of selectedOperators) {
    const opId = opMap2.get(sel.company);
    if (opId) {
      selectedKeys.add(`${opId}|${sel.category}`);
    } else {
      console.error("선정 운용사 ID 없음:", sel.company);
    }
  }

  const allApps = await sheets.getValues("신청현황!A:K");
  const headers = allApps[0];
  const projIdx = headers.indexOf("출자사업ID");
  const opIdx = headers.indexOf("운용사ID");
  const catIdx = headers.indexOf("출자분야");
  const statusIdx = headers.indexOf("상태");

  const updates = [];
  for (let i = 1; i < allApps.length; i++) {
    const row = allApps[i];
    if (row[projIdx] !== project.id) continue;

    const opId = row[opIdx];
    const category = row[catIdx];
    const key = `${opId}|${category}`;
    const currentStatus = row[statusIdx];

    const newStatus = selectedKeys.has(key) ? "선정" : "탈락";
    if (currentStatus !== newStatus) {
      updates.push({ rowIdx: i + 1, status: newStatus });
    }
  }

  for (const u of updates) {
    await sheets.setValues(`신청현황!I${u.rowIdx}`, [[u.status]]);
  }

  const selected = updates.filter(u => u.status === "선정").length;
  const rejected = updates.filter(u => u.status === "탈락").length;
  console.log("선정:", selected, "건, 탈락:", rejected, "건");

  // 7. 파일 4638 처리상태 업데이트
  if (file4638) {
    const rowIdx = file4638._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${selected + rejected}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 4638 처리 완료");
  }

  // 8. 출자사업 파일 연결 및 현황 업데이트
  await sheets.updateProjectFileId(project.id, "선정결과", fileId4638);
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건");
  console.log("선정:", selected, "건, 탈락:", rejected, "건");
}

main().catch(console.error);
