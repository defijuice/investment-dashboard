import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3874: 특허청 2023년 5월 수시 접수현황 - 15개 조합 (공동GP 4건)
// 3919: 특허청 2023년 5월 수시 선정결과 - 2개 조합 선정 (공동GP 1건)

const applications = [
  { company: "동문파트너즈", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "벡터기술투자", category: "특허 - 특허기술사업화", isJoint: false },
  // 공동GP: 서울투자파트너스 + 인텔렉추얼디스커버리
  { company: "서울투자파트너스", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "인텔렉추얼디스커버리", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "아이디어브릿지파트너스", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "에이온인베스트먼트", category: "특허 - 특허기술사업화", isJoint: false },
  // 공동GP: 오라클벤처투자 + 바로벤처스
  { company: "오라클벤처투자", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "바로벤처스", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "이앤벤처파트너스", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "특허 - 특허기술사업화", isJoint: false },
  // 공동GP: 인라이트벤처스 + KDB인프라자산운용 (선정)
  { company: "인라이트벤처스", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "KDB인프라자산운용", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "인터밸류파트너스", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "지유투자", category: "특허 - 특허기술사업화", isJoint: false },
  // 공동GP: 충남대학교기술지주 + 엘에스케이인베스트먼트
  { company: "충남대학교기술지주", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "엘에스케이인베스트먼트", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "타임웍스인베스트먼트", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "플래티넘기술투자", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "피앤피인베스트먼트", category: "특허 - 특허기술사업화", isJoint: false },
];

// 선정된 운용사 (2개 조합: 공동GP 1건 + 개별 1건)
const selectedOperators = new Set([
  "인라이트벤처스|특허 - 특허기술사업화",
  "KDB인프라자산운용|특허 - 특허기술사업화",
  "지유투자|특허 - 특허기술사업화",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3874 = await sheets.findRow("파일", "파일번호", "3874");
  const file3919 = await sheets.findRow("파일", "파일번호", "3919");
  const fileId3874 = file3874 ? file3874["ID"] : null;
  const fileId3919 = file3919 ? file3919["ID"] : null;
  console.log("파일 ID - 3874 (접수):", fileId3874);
  console.log("파일 ID - 3919 (선정):", fileId3919);

  // 2. 출자사업 생성/조회
  const projectName = "모태펀드(특허청) 2023년 5월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "특허",
    공고유형: "수시",
    연도: "2023",
    차수: "5월",
    지원파일ID: fileId3874,
    결과파일ID: fileId3919
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
  if (file3874) {
    const rowIdx = file3874._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 15개 (공동GP 4건), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3874 처리 완료");
  }

  if (file3919) {
    const rowIdx = file3919._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3919 처리 완료");
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
