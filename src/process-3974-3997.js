import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3974: 중기부 2023년 8월 수시 접수현황 - 3개 조합
// 3997: 중기부 2023년 8월 수시 선정결과 - 2개 조합 선정

const applications = [
  { company: "오엔벤처투자", category: "중진 - 일반세컨더리(중소형)", isJoint: false },
  { company: "지앤텍벤처투자", category: "중진 - 일반세컨더리(중소형)", isJoint: false },
  { company: "코나벤처파트너스", category: "중진 - 일반세컨더리(중소형)", isJoint: false },
];

// 선정된 운용사 (2개)
const selectedOperators = new Set([
  "오엔벤처투자|중진 - 일반세컨더리(중소형)",
  "지앤텍벤처투자|중진 - 일반세컨더리(중소형)",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3974 = await sheets.findRow("파일", "파일번호", "3974");
  const file3997 = await sheets.findRow("파일", "파일번호", "3997");
  const fileId3974 = file3974 ? file3974["ID"] : null;
  const fileId3997 = file3997 ? file3997["ID"] : null;
  console.log("파일 ID - 3974 (접수):", fileId3974);
  console.log("파일 ID - 3997 (선정):", fileId3997);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(중기부) 2023년 8월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "중기부",
    공고유형: "수시",
    연도: "2023",
    차수: "8월",
    지원파일ID: fileId3974,
    결과파일ID: fileId3997
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
  if (file3974) {
    const rowIdx = file3974._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 3개, 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3974 처리 완료");
  }

  if (file3997) {
    const rowIdx = file3997._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3997 처리 완료");
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
