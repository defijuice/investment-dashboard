import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3822: GEPS 글로벌 VC 펀드 출자사업 최종 선정 결과 - 4개사 (접수현황 파일 없음)
const applications = [
  // 해외 VC - 3개
  { company: "Adams Street Partners", category: "GEPS - 해외VC", isJoint: false },
  { company: "StepStone", category: "GEPS - 해외VC", isJoint: false },
  { company: "TTCP", category: "GEPS - 해외VC", isJoint: false },
  // KVIC 매칭 VC - 1개
  { company: "Northgate Capital", category: "GEPS - KVIC매칭VC", isJoint: false },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3822 = await sheets.findRow("파일", "파일번호", "3822");
  const fileId3822 = file3822 ? file3822["ID"] : null;
  console.log("파일 ID - 3822:", fileId3822);

  // 2. 출자사업 생성/조회
  const projectName = "GEPS 글로벌 VC 펀드 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "GEPS",
    공고유형: "정시",
    연도: "2023",
    차수: "",
    지원파일ID: fileId3822
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

  // 4. 신청현황 생성 (선정결과만 있으므로 모두 "선정" 상태로)
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
      상태: "선정",
      비고: app.isJoint ? "공동GP" : ""
    });
  }

  if (appsToCreate.length > 0) {
    await sheets.createApplicationsBatch(appsToCreate);
    console.log("신청현황 생성:", appsToCreate.length, "건 (모두 선정)");
  }

  if (missingOps.length > 0) {
    console.log("운용사 ID 없음:", [...new Set(missingOps)].join(", "));
  }

  // 5. 파일 3822 처리상태 업데이트
  if (file3822) {
    const rowIdx = file3822._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `선정 4개사 (접수현황 없음)`
    ]]);
    console.log("파일 3822 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("신청현황:", appsToCreate.length, "건 (선정결과만)");
}

main().catch(console.error);
