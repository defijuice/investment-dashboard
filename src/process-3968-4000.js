import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3968: 특허계정 2023년 8월 수시 접수현황 - 13개 조합 (공동GP 3건)
// 4000: 특허계정 2023년 8월 수시 선정결과 - 1개 조합 선정

const applications = [
  // 공동GP: 노보섹인베스트먼트 / 바로벤처스
  { company: "노보섹인베스트먼트", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "바로벤처스", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "동문파트너즈", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "벡터기술투자", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "시너지아이비투자", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "아이디어브릿지파트너스", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "에이온인베스트먼트", category: "특허 - 특허기술사업화", isJoint: false },
  // 공동GP: 에트리홀딩스 / 한국특허투자
  { company: "에트리홀딩스", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "한국특허투자", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "위벤처스", category: "특허 - 특허기술사업화", isJoint: false },
  // 공동GP: 이노큐브 / 다래전략사업화센터
  { company: "이노큐브", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "다래전략사업화센터", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "인터밸류파트너스", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "트라이앵글파트너스", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "플래티넘기술투자", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "현대기술투자", category: "특허 - 특허기술사업화", isJoint: false },
];

// 선정된 운용사 (1개)
const selectedOperators = new Set([
  "인터밸류파트너스|특허 - 특허기술사업화",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3968 = await sheets.findRow("파일", "파일번호", "3968");
  const file4000 = await sheets.findRow("파일", "파일번호", "4000");
  const fileId3968 = file3968 ? file3968["ID"] : null;
  const fileId4000 = file4000 ? file4000["ID"] : null;
  console.log("파일 ID - 3968 (접수):", fileId3968);
  console.log("파일 ID - 4000 (선정):", fileId4000);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(특허계정) 2023년 8월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "특허",
    공고유형: "수시",
    연도: "2023",
    차수: "8월",
    지원파일ID: fileId3968,
    결과파일ID: fileId4000
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
  if (file3968) {
    const rowIdx = file3968._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 13개 (공동GP 3건), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3968 처리 완료");
  }

  if (file4000) {
    const rowIdx = file4000._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 4000 처리 완료");
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
