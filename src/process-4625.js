import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4625: 강원 전략산업 벤처펀드 2025년 출자사업 접수현황 - 12개 조합, 18개 운용사
const applications = [
  // 지역기업첫걸음 - 2개 (개별)
  { company: "강원창조경제혁신센터", category: "강원 - 지역기업첫걸음", isJoint: false },
  { company: "와이앤아처", category: "강원 - 지역기업첫걸음", isJoint: false },
  // 지역리그VC - 16개 운용사 (10조합, 공동GP 6건)
  { company: "강원대기술지주", category: "강원 - 지역리그VC", isJoint: true },
  { company: "트리거투자파트너스", category: "강원 - 지역리그VC", isJoint: true },
  { company: "로이투자파트너스", category: "강원 - 지역리그VC", isJoint: true },
  { company: "웰컴벤처스", category: "강원 - 지역리그VC", isJoint: true },
  { company: "송현인베스트먼트", category: "강원 - 지역리그VC", isJoint: false },
  { company: "수성에셋인베스트먼트", category: "강원 - 지역리그VC", isJoint: false },
  { company: "와프인베스트먼트", category: "강원 - 지역리그VC", isJoint: true },
  { company: "제이케이피파트너스", category: "강원 - 지역리그VC", isJoint: true },
  { company: "이에스인베스터", category: "강원 - 지역리그VC", isJoint: true },
  { company: "와이케이벤처스", category: "강원 - 지역리그VC", isJoint: true },
  { company: "임팩트스퀘어", category: "강원 - 지역리그VC", isJoint: false },
  { company: "코스넷기술투자", category: "강원 - 지역리그VC", isJoint: true },
  { company: "어번데일벤처스", category: "강원 - 지역리그VC", isJoint: true },
  { company: "패스파인더에이치", category: "강원 - 지역리그VC", isJoint: false },
  { company: "한림대기술지주", category: "강원 - 지역리그VC", isJoint: true },
  { company: "넥스트지인베스트먼트", category: "강원 - 지역리그VC", isJoint: true },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4625 = await sheets.findRow("파일", "파일번호", "4625");
  const fileId4625 = file4625 ? file4625["ID"] : null;
  console.log("파일 ID - 4625:", fileId4625);

  // 2. 출자사업 생성/조회
  const projectName = "강원 전략산업 벤처펀드 2025년 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "강원",
    공고유형: "정시",
    연도: "2025",
    차수: "",
    지원파일ID: fileId4625
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

  // 5. 파일 4625 처리상태 업데이트
  if (file4625) {
    const rowIdx = file4625._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 12개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4625 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건 (선정결과 파일 없음)");
}

main().catch(console.error);
