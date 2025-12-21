import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4094: 지역혁신 벤처펀드(동남권, 전북·강원) 2023년 선정결과 - 4개 조합 선정
// 접수현황 파일 없음 - 선정 상태로 저장

const applications = [
  // 동남권 지역혁신 (2개 조합)
  // 공동GP: 송현인베스트먼트/바로벤처스
  { company: "송현인베스트먼트", category: "지역혁신 - 동남권", isJoint: true },
  { company: "바로벤처스", category: "지역혁신 - 동남권", isJoint: true },
  { company: "어센도벤처스", category: "지역혁신 - 동남권", isJoint: false },

  // 전북·강원 지역혁신 (2개 조합)
  { company: "서울투자파트너스", category: "지역혁신 - 전북·강원", isJoint: false },
  { company: "에코프로파트너스", category: "지역혁신 - 전북·강원", isJoint: false },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4094 = await sheets.findRow("파일", "파일번호", "4094");
  const fileId4094 = file4094 ? file4094["ID"] : null;
  console.log("파일 ID - 4094 (선정):", fileId4094);

  // 2. 출자사업 생성/조회
  const projectName = "지역혁신 벤처펀드(동남권, 전북·강원) 2023년 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "지역혁신",
    공고유형: "정시",
    연도: "2023",
    차수: "",
    지원파일ID: null,
    결과파일ID: fileId4094
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

  // 4. 신청현황 생성 (모두 선정 상태)
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
      상태: "선정",  // 선정결과만 있으므로 모두 선정
      비고: app.isJoint ? "공동GP" : ""
    });
  }

  if (appsToCreate.length > 0) {
    await sheets.createApplicationsBatch(appsToCreate);
    console.log(`신청현황 생성: ${appsToCreate.length}건 (모두 선정 상태)`);
  }

  if (missingOps.length > 0) {
    console.log("운용사 ID 없음:", [...new Set(missingOps)].join(", "));
  }

  // 5. 파일 처리상태 업데이트
  if (file4094) {
    const rowIdx = file4094._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `선정조합 4개 (공동GP 1건), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4094 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log(`신청현황: ${appsToCreate.length}건 (모두 선정 상태)`);
}

main().catch(console.error);
