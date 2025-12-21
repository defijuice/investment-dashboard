import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4536: 부산 미래성장 + 경남-KDB 지역혁신 벤처펀드 2025년 재공고 접수현황
// 두 개의 출자사업이 포함되어 있음

// 부산 미래성장 벤처펀드 - 글로벌리그 (1조합, 공동GP 3개)
const busanApplications = [
  { company: "비전벤처스", category: "부산 - 글로벌리그", isJoint: true },
  { company: "MCP Asset Management Co., Ltd.", category: "부산 - 글로벌리그", isJoint: true },
  { company: "비엔케이투자증권", category: "부산 - 글로벌리그", isJoint: true },
];

// 경남-KDB 지역혁신 벤처펀드 - VC (3조합)
const gyeongnamApplications = [
  { company: "넥스트지인베스트먼트", category: "경남-KDB - VC", isJoint: false },
  { company: "제이원창업투자", category: "경남-KDB - VC", isJoint: false },
  { company: "한일브이씨", category: "경남-KDB - VC", isJoint: false },
];

// 4586: 경남-KDB 선정결과 - 1개 조합
const gyeongnamSelected = [
  { company: "한일브이씨", category: "경남-KDB - VC" },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4536 = await sheets.findRow("파일", "파일번호", "4536");
  const file4586 = await sheets.findRow("파일", "파일번호", "4586");
  const fileId4536 = file4536 ? file4536["ID"] : null;
  const fileId4586 = file4586 ? file4586["ID"] : null;
  console.log("파일 ID - 4536:", fileId4536, ", 4586:", fileId4586);

  // 2. 기존 운용사 조회
  const existingOps = await sheets.getAllOperators();
  const operatorMap = new Map();
  for (const op of existingOps) {
    operatorMap.set(op["운용사명"], op["ID"]);
  }

  // 모든 신규 운용사 찾기
  const allApplications = [...busanApplications, ...gyeongnamApplications];
  const newOperatorNames = [];
  for (const app of allApplications) {
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

  // === 부산 미래성장 벤처펀드 처리 ===
  console.log("\n=== 부산 미래성장 벤처펀드 처리 ===");
  const busanProjectName = "부산 미래성장 벤처펀드 2025년 출자사업";
  const busanProject = await sheets.getOrCreateProject(busanProjectName, {
    소관: "부산",
    공고유형: "재공고",
    연도: "2025",
    차수: "",
    지원파일ID: fileId4536
  });
  console.log(busanProject.isNew ? "출자사업 생성:" : "출자사업 존재:", busanProject.id);

  // 부산 신청현황 생성
  const busanExistingApps = await sheets.getExistingApplications(busanProject.id);
  const busanAppsToCreate = [];

  for (const app of busanApplications) {
    const opId = operatorMap.get(app.company);
    if (!opId) {
      console.log("운용사 ID 없음:", app.company);
      continue;
    }
    const key = `${opId}|${app.category}`;
    if (busanExistingApps.has(key)) continue;

    busanAppsToCreate.push({
      출자사업ID: busanProject.id,
      운용사ID: opId,
      출자분야: app.category,
      상태: "접수",  // 선정결과 파일이 없으므로 접수 상태 유지
      비고: app.isJoint ? "공동GP" : ""
    });
  }

  if (busanAppsToCreate.length > 0) {
    await sheets.createApplicationsBatch(busanAppsToCreate);
    console.log("부산 신청현황 생성:", busanAppsToCreate.length, "건");
  }

  await sheets.updateProjectStatus(busanProject.id);

  // === 경남-KDB 지역혁신 벤처펀드 처리 ===
  console.log("\n=== 경남-KDB 지역혁신 벤처펀드 처리 ===");
  const gyeongnamProjectName = "경남-KDB 지역혁신 벤처펀드 2025년 출자사업";
  const gyeongnamProject = await sheets.getOrCreateProject(gyeongnamProjectName, {
    소관: "경남",
    공고유형: "재공고",
    연도: "2025",
    차수: "",
    지원파일ID: fileId4536
  });
  console.log(gyeongnamProject.isNew ? "출자사업 생성:" : "출자사업 존재:", gyeongnamProject.id);

  // 경남 신청현황 생성
  const gyeongnamExistingApps = await sheets.getExistingApplications(gyeongnamProject.id);
  const gyeongnamAppsToCreate = [];

  for (const app of gyeongnamApplications) {
    const opId = operatorMap.get(app.company);
    if (!opId) {
      console.log("운용사 ID 없음:", app.company);
      continue;
    }
    const key = `${opId}|${app.category}`;
    if (gyeongnamExistingApps.has(key)) continue;

    gyeongnamAppsToCreate.push({
      출자사업ID: gyeongnamProject.id,
      운용사ID: opId,
      출자분야: app.category,
      상태: "접수",
      비고: app.isJoint ? "공동GP" : ""
    });
  }

  if (gyeongnamAppsToCreate.length > 0) {
    await sheets.createApplicationsBatch(gyeongnamAppsToCreate);
    console.log("경남 신청현황 생성:", gyeongnamAppsToCreate.length, "건");
  }

  // 경남 선정결과 처리
  const ops2 = await sheets.getAllOperators();
  const opMap2 = new Map();
  for (const op of ops2) {
    opMap2.set(op["운용사명"], op["ID"]);
  }

  const selectedKeys = new Set();
  for (const sel of gyeongnamSelected) {
    const opId = opMap2.get(sel.company);
    if (opId) {
      selectedKeys.add(`${opId}|${sel.category}`);
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
    if (row[projIdx] !== gyeongnamProject.id) continue;

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
  console.log("경남 선정:", selected, "건, 탈락:", rejected, "건");

  // 경남 출자사업 파일 연결 및 현황 업데이트
  await sheets.updateProjectFileId(gyeongnamProject.id, "선정결과", fileId4586);
  await sheets.updateProjectStatus(gyeongnamProject.id);

  // 파일 처리상태 업데이트
  if (file4536) {
    const rowIdx = file4536._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `부산 1조합(3운용사), 경남-KDB 3조합`
    ]]);
    console.log("파일 4536 처리 완료");
  }

  if (file4586) {
    const rowIdx = file4586._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 3개 중 선정 1건`
    ]]);
    console.log("파일 4586 처리 완료");
  }

  console.log("\n=== 처리 완료 ===");
  console.log("부산 출자사업:", busanProject.id, "- 신청현황:", busanAppsToCreate.length, "건");
  console.log("경남 출자사업:", gyeongnamProject.id, "- 선정:", selected, "건, 탈락:", rejected, "건");
}

main().catch(console.error);
