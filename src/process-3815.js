import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3815: 지역혁신 벤처펀드 2022년 출자사업 선정결과 - 6개 조합 (접수현황 파일 없음)
// 선정결과만으로 신청현황 생성 (모두 선정 상태)
const applications = [
  // 동남권 지역혁신 - 2개
  { company: "경남벤처투자", category: "지역혁신 - 동남권", isJoint: false },
  { company: "라이트하우스컴바인인베스트", category: "지역혁신 - 동남권", isJoint: false },
  // 대구·제주·광주 지역혁신 - 3개 (공동GP 1건)
  { company: "넥스트지인베스트먼트", category: "지역혁신 - 대구·제주·광주", isJoint: false },
  { company: "대덕벤처파트너스", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  { company: "에스케이증권", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  // 전북·강원 지역혁신 - 2개
  { company: "소풍벤처스", category: "지역혁신 - 전북·강원", isJoint: false },
  { company: "안다아시아벤처스", category: "지역혁신 - 전북·강원", isJoint: false },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3815 = await sheets.findRow("파일", "파일번호", "3815");
  const fileId3815 = file3815 ? file3815["ID"] : null;
  console.log("파일 ID - 3815:", fileId3815);

  // 2. 출자사업 생성/조회
  const projectName = "지역혁신 벤처펀드(동남권, 대구·제주·광주, 전북·강원) 2022년 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "지역혁신",
    공고유형: "정시",
    연도: "2022",
    차수: "",
    지원파일ID: fileId3815  // 선정결과 파일을 지원파일로 사용
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
      상태: "선정",  // 선정결과만 있으므로 선정 상태로 저장
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

  // 5. 파일 3815 처리상태 업데이트
  if (file3815) {
    const rowIdx = file3815._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `선정조합 6개, 총 ${appsToCreate.length}건 (접수현황 없음)`
    ]]);
    console.log("파일 3815 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("신청현황:", appsToCreate.length, "건 (선정결과만, 접수현황 파일 없음)");
}

main().catch(console.error);
