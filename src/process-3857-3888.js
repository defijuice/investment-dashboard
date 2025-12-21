import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3857: 문화계정 2023년 5월 수시 접수현황 - 10개 조합 (공동GP 2건)
// 3888: 문화계정 2023년 5월 수시 선정결과 - 2개 조합 선정

const applications = [
  // K-밸류 - 1개 조합
  { company: "이크럭스벤처파트너스", category: "문화 - K-밸류", isJoint: false },
  // K-문화상생 - 6개 조합 (공동GP 1건: 오거스트벤처파트너스, 트라이앵글파트너스)
  { company: "로간벤처스", category: "문화 - K-문화상생", isJoint: false },
  { company: "에스비파트너스", category: "문화 - K-문화상생", isJoint: false },
  { company: "오거스트벤처파트너스", category: "문화 - K-문화상생", isJoint: true },
  { company: "트라이앵글파트너스", category: "문화 - K-문화상생", isJoint: true },
  { company: "이크럭스벤처파트너스", category: "문화 - K-문화상생", isJoint: false },
  { company: "펜처인베스트", category: "문화 - K-문화상생", isJoint: false },
  // 아시아문화중심도시육성 - 4개 조합 (공동GP 1건: 린벤처스, 광주지역대학연합기술지주)
  { company: "오라클벤처투자", category: "문화 - 아시아문화중심도시육성", isJoint: false },
  { company: "실버레이크인베스트먼트", category: "문화 - 아시아문화중심도시육성", isJoint: false },
  { company: "린벤처스", category: "문화 - 아시아문화중심도시육성", isJoint: true },
  { company: "광주지역대학연합기술지주", category: "문화 - 아시아문화중심도시육성", isJoint: true },
  { company: "오거스트벤처파트너스", category: "문화 - 아시아문화중심도시육성", isJoint: false },
];

// 선정된 운용사 (분야별)
const selectedOperators = new Set([
  "에스비파트너스|문화 - K-문화상생",
  "오라클벤처투자|문화 - 아시아문화중심도시육성",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3857 = await sheets.findRow("파일", "파일번호", "3857");
  const file3888 = await sheets.findRow("파일", "파일번호", "3888");
  const fileId3857 = file3857 ? file3857["ID"] : null;
  const fileId3888 = file3888 ? file3888["ID"] : null;
  console.log("파일 ID - 3857 (접수):", fileId3857);
  console.log("파일 ID - 3888 (선정):", fileId3888);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(문화계정) 2023년 5월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "문화",
    공고유형: "수시",
    연도: "2023",
    차수: "5월",
    지원파일ID: fileId3857,
    결과파일ID: fileId3888
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
  if (file3857) {
    const rowIdx = file3857._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 10개 (공동GP 2건), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3857 처리 완료");
  }

  if (file3888) {
    const rowIdx = file3888._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3888 처리 완료");
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
