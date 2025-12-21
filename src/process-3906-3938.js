import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3906: 해양/문화계정 2023년 6월 수시 접수현황 - 10개 조합 (공동GP 3건)
// 3938: 해양/문화계정 2023년 6월 수시 선정결과 - 2개 조합 선정

const applications = [
  // 해양신산업 - 6개 조합 (공동GP 3건)
  // 공동GP: 빅뱅벤처스 + 빅뱅엔젤스
  { company: "빅뱅벤처스", category: "해양 - 해양신산업", isJoint: true },
  { company: "빅뱅엔젤스", category: "해양 - 해양신산업", isJoint: true },
  { company: "심본투자파트너스", category: "해양 - 해양신산업", isJoint: false },
  { company: "오거스트벤처파트너스", category: "해양 - 해양신산업", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "해양 - 해양신산업", isJoint: false },
  // 공동GP: 케이앤투자파트너스 + 비엔케이투자증권 (선정)
  { company: "케이앤투자파트너스", category: "해양 - 해양신산업", isJoint: true },
  { company: "비엔케이투자증권", category: "해양 - 해양신산업", isJoint: true },
  // 공동GP: 타임웍스인베스트먼트 + 푸른인베스트먼트
  { company: "타임웍스인베스트먼트", category: "해양 - 해양신산업", isJoint: true },
  { company: "푸른인베스트먼트", category: "해양 - 해양신산업", isJoint: true },

  // K-밸류 - 4개 조합
  { company: "센트럴투자파트너스", category: "문화 - K-밸류", isJoint: false },
  { company: "스마트스터디벤처스", category: "문화 - K-밸류", isJoint: false },
  { company: "오거스트벤처파트너스", category: "문화 - K-밸류", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "문화 - K-밸류", isJoint: false },
];

// 선정된 운용사
const selectedOperators = new Set([
  "센트럴투자파트너스|문화 - K-밸류",
  "케이앤투자파트너스|해양 - 해양신산업",
  "비엔케이투자증권|해양 - 해양신산업",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3906 = await sheets.findRow("파일", "파일번호", "3906");
  const file3938 = await sheets.findRow("파일", "파일번호", "3938");
  const fileId3906 = file3906 ? file3906["ID"] : null;
  const fileId3938 = file3938 ? file3938["ID"] : null;
  console.log("파일 ID - 3906 (접수):", fileId3906);
  console.log("파일 ID - 3938 (선정):", fileId3938);

  // 2. 출자사업 생성/조회
  const projectName = "모태펀드(해양, 문화계정) 2023년 6월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "해양/문화",
    공고유형: "수시",
    연도: "2023",
    차수: "6월",
    지원파일ID: fileId3906,
    결과파일ID: fileId3938
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
  if (file3906) {
    const rowIdx = file3906._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 10개 (공동GP 3건), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3906 처리 완료");
  }

  if (file3938) {
    const rowIdx = file3938._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3938 처리 완료");
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
