import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4054: 과기정통계정_메타버스 2023년 12월 수시 접수현황 - 4개 조합 (공동GP 3건)
// 선정결과 파일 없음 - 접수 상태로 저장

const applications = [
  // 공동GP: 넥스트지인베스트먼트, 아일럼인베스트
  { company: "넥스트지인베스트먼트", category: "과기정통 - 메타버스", isJoint: true },
  { company: "아일럼인베스트", category: "과기정통 - 메타버스", isJoint: true },
  // 공동GP: 노보섹인베스트먼트, 바로벤처스
  { company: "노보섹인베스트먼트", category: "과기정통 - 메타버스", isJoint: true },
  { company: "바로벤처스", category: "과기정통 - 메타버스", isJoint: true },
  // 공동GP: 티비인베스트먼트, 신한투자증권
  { company: "티비인베스트먼트", category: "과기정통 - 메타버스", isJoint: true },
  { company: "신한투자증권", category: "과기정통 - 메타버스", isJoint: true },
  // 개별
  { company: "피앤아이인베스트먼트", category: "과기정통 - 메타버스", isJoint: false },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4054 = await sheets.findRow("파일", "파일번호", "4054");
  const fileId4054 = file4054 ? file4054["ID"] : null;
  console.log("파일 ID - 4054 (접수):", fileId4054);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(과기정통계정) 2023년 12월 수시 메타버스 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "과기정통",
    공고유형: "수시",
    연도: "2023",
    차수: "12월",
    지원파일ID: fileId4054,
    결과파일ID: null
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

  // 4. 신청현황 생성 (접수 상태로)
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
      상태: "접수",  // 선정결과 없으므로 접수 상태
      비고: app.isJoint ? "공동GP" : ""
    });
  }

  if (appsToCreate.length > 0) {
    await sheets.createApplicationsBatch(appsToCreate);
    console.log(`신청현황 생성: ${appsToCreate.length}건 (모두 접수 상태)`);
  }

  if (missingOps.length > 0) {
    console.log("운용사 ID 없음:", [...new Set(missingOps)].join(", "));
  }

  // 5. 파일 처리상태 업데이트
  if (file4054) {
    const rowIdx = file4054._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 4개 (공동GP 3건), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4054 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log(`신청현황: ${appsToCreate.length}건 (모두 접수 상태)`);
}

main().catch(console.error);
