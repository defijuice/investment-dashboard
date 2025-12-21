import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3926: 중기부 2023년 6월 수시 접수현황 - 9개 조합 (벤처세컨더리사모펀드)
// 3980: 중기부 2023년 6월 수시 선정결과 - 3개 조합 선정

const applications = [
  { company: "다올자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
  { company: "디에스자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
  { company: "밸류시스템자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
  { company: "신한자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
  { company: "아이온자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
  { company: "엔에이치헤지자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
  { company: "우리자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
  { company: "쿼드자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
  { company: "플랫폼파트너스자산운용", category: "중진 - 벤처세컨더리사모펀드", isJoint: false },
];

// 선정된 운용사 (3개)
const selectedOperators = new Set([
  "신한자산운용|중진 - 벤처세컨더리사모펀드",
  "엔에이치헤지자산운용|중진 - 벤처세컨더리사모펀드",
  "쿼드자산운용|중진 - 벤처세컨더리사모펀드",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3926 = await sheets.findRow("파일", "파일번호", "3926");
  const file3980 = await sheets.findRow("파일", "파일번호", "3980");
  const fileId3926 = file3926 ? file3926["ID"] : null;
  const fileId3980 = file3980 ? file3980["ID"] : null;
  console.log("파일 ID - 3926 (접수):", fileId3926);
  console.log("파일 ID - 3980 (선정):", fileId3980);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(중기부) 2023년 6월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "중기부",
    공고유형: "수시",
    연도: "2023",
    차수: "6월",
    지원파일ID: fileId3926,
    결과파일ID: fileId3980
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

  // 4. 신청현황 생성 (선정/탈락 판정 포함)
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

    const selectionKey = `${app.company}|${app.category}`;
    const status = selectedOperators.has(selectionKey) ? "선정" : "탈락";

    appsToCreate.push({
      출자사업ID: project.id,
      운용사ID: opId,
      출자분야: app.category,
      상태: status,
      비고: app.isJoint ? "공동GP" : ""
    });
  }

  if (appsToCreate.length > 0) {
    await sheets.createApplicationsBatch(appsToCreate);
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    const rejected = appsToCreate.filter(a => a.상태 === "탈락").length;
    console.log(`신청현황 생성: ${appsToCreate.length}건 (선정: ${selected}, 탈락: ${rejected})`);
  }

  if (missingOps.length > 0) {
    console.log("운용사 ID 없음:", [...new Set(missingOps)].join(", "));
  }

  // 5. 파일 처리상태 업데이트
  if (file3926) {
    const rowIdx = file3926._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 9개, 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3926 처리 완료");
  }

  if (file3980) {
    const rowIdx = file3980._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3980 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  const selected = appsToCreate.filter(a => a.상태 === "선정").length;
  const rejected = appsToCreate.filter(a => a.상태 === "탈락").length;
  console.log(`신청현황: ${appsToCreate.length}건 (선정: ${selected}, 탈락: ${rejected})`);
}

main().catch(console.error);
