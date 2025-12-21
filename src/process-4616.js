import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4616: 부산 혁신 스케일업 벤처펀드 2025년 출자사업 접수현황 - 16개 조합, 21개 운용사
const applications = [
  // 라이콘 - 1개
  { company: "어번데일벤처스", category: "부산 - 라이콘", isJoint: false },
  // AC - 7개 운용사 (5조합, 공동GP 3건)
  { company: "부산창조경제혁신센터", category: "부산 - AC", isJoint: true },
  { company: "한국사회투자", category: "부산 - AC", isJoint: true },
  { company: "비스퀘어", category: "부산 - AC", isJoint: true },
  { company: "부산지역대학연합기술지주", category: "부산 - AC", isJoint: true },
  { company: "스타트런", category: "부산 - AC", isJoint: true },
  { company: "티인베스트먼트", category: "부산 - AC", isJoint: true },
  { company: "콴티파이인큐베이터", category: "부산 - AC", isJoint: false },
  // 스마트첨단제조 - 2개
  { company: "에쓰비인베스트먼트", category: "부산 - 스마트첨단제조", isJoint: false },
  { company: "제피러스랩", category: "부산 - 스마트첨단제조", isJoint: false },
  // VC(지역) - 5개 운용사 (4조합, 공동GP 1건)
  { company: "비엔케이벤처투자", category: "부산 - VC(지역)", isJoint: false },
  { company: "비전에쿼티파트너스", category: "부산 - VC(지역)", isJoint: false },
  { company: "선보엔젤파트너스", category: "부산 - VC(지역)", isJoint: false },
  { company: "티케이지벤처스", category: "부산 - VC(지역)", isJoint: true },
  { company: "비엔케이투자증권", category: "부산 - VC(지역)", isJoint: true },
  // VC(중형) - 3개
  { company: "나우아이비캐피탈", category: "부산 - VC(중형)", isJoint: false },
  { company: "이앤인베스트먼트", category: "부산 - VC(중형)", isJoint: false },
  { company: "쿨리지코너인베스트먼트", category: "부산 - VC(중형)", isJoint: false },
  // VC(대형) - 2개
  { company: "인라이트벤처스", category: "부산 - VC(대형)", isJoint: false },
  { company: "하나벤처스", category: "부산 - VC(대형)", isJoint: false },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4616 = await sheets.findRow("파일", "파일번호", "4616");
  const fileId4616 = file4616 ? file4616["ID"] : null;
  console.log("파일 ID - 4616:", fileId4616);

  // 2. 출자사업 생성/조회
  const projectName = "부산 혁신 스케일업 벤처펀드 2025년 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "부산",
    공고유형: "정시",
    연도: "2025",
    차수: "",
    지원파일ID: fileId4616
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

  // 5. 파일 4616 처리상태 업데이트
  if (file4616) {
    const rowIdx = file4616._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 16개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4616 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건 (선정결과 파일 없음)");
}

main().catch(console.error);
