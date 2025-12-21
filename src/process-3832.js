import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3832: 한국모태펀드(문화계정) 2023년 1차 정시 출자사업 선정결과 - 14개 조합 (접수현황 파일 없음)
// 공동GP 4건 포함, 총 18개 운용사
const applications = [
  // K-콘텐츠IP - 5개 조합 (공동GP 1건)
  { company: "가이아벤처파트너스", category: "문화 - K-콘텐츠IP", isJoint: false },
  { company: "대성창업투자", category: "문화 - K-콘텐츠IP", isJoint: false },
  { company: "아이디벤처스", category: "문화 - K-콘텐츠IP", isJoint: false },
  { company: "케이제이앤투자파트너스", category: "문화 - K-콘텐츠IP", isJoint: true },
  { company: "케이씨투자파트너스", category: "문화 - K-콘텐츠IP", isJoint: true },
  { company: "코나벤처파트너스", category: "문화 - K-콘텐츠IP", isJoint: false },
  // K-문화M&A - 2개 조합
  { company: "나우아이비캐피탈", category: "문화 - K-문화M&A", isJoint: false },
  { company: "에이티유파트너스", category: "문화 - K-문화M&A", isJoint: false },
  // K-유니콘 - 2개 조합
  { company: "데브시스터즈벤처스", category: "문화 - K-유니콘", isJoint: false },
  { company: "캡스톤파트너스", category: "문화 - K-유니콘", isJoint: false },
  // K-밸류 - 1개 조합
  { company: "로간벤처스", category: "문화 - K-밸류", isJoint: false },
  // K-문화상생 - 1개 조합 (공동GP)
  { company: "오픈워터인베스트먼트", category: "문화 - K-문화상생", isJoint: true },
  { company: "케이제이앤투자파트너스", category: "문화 - K-문화상생", isJoint: true },
  // K-문화일반 - 3개 조합 (공동GP 1건)
  { company: "넥스트지인베스트먼트", category: "문화 - K-문화일반", isJoint: true },
  { company: "프롤로그벤처스", category: "문화 - K-문화일반", isJoint: true },
  { company: "대교인베스트먼트", category: "문화 - K-문화일반", isJoint: false },
  { company: "메이플투자파트너스", category: "문화 - K-문화일반", isJoint: false },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3832 = await sheets.findRow("파일", "파일번호", "3832");
  const fileId3832 = file3832 ? file3832["ID"] : null;
  console.log("파일 ID - 3832:", fileId3832);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(문화계정) 2023년 1차 정시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "문화",
    공고유형: "정시",
    연도: "2023",
    차수: "1차",
    결과파일ID: fileId3832
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

  // 5. 파일 3832 처리상태 업데이트
  if (file3832) {
    const rowIdx = file3832._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `선정조합 14개 (공동GP 4건), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3832 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("신청현황:", appsToCreate.length, "건 (선정결과만)");
}

main().catch(console.error);
