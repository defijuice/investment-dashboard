import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4636: 모태펀드(특허계정) 2025년 10월 수시 출자사업 접수현황 - 8개 조합, 12개 운용사
const applications = [
  // 특허기술사업화 - 6개 운용사 (5조합, 공동GP 1건)
  { company: "루스벤처스", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "KDB인프라자산운용", category: "특허 - 특허기술사업화", isJoint: true },
  { company: "마젤란기술투자", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "미래에셋벤처투자", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "인탑스인베스트먼트", category: "특허 - 특허기술사업화", isJoint: false },
  { company: "클레어보이언트벤처스", category: "특허 - 특허기술사업화", isJoint: false },
  // IP지역특화 - 6개 운용사 (3조합, 공동GP 3건)
  { company: "아이디어브릿지자산운용", category: "특허 - IP지역특화", isJoint: true },
  { company: "트리거투자파트너스", category: "특허 - IP지역특화", isJoint: true },
  { company: "에트리홀딩스", category: "특허 - IP지역특화", isJoint: true },
  { company: "컴퍼니케이파트너스", category: "특허 - IP지역특화", isJoint: true },
  { company: "케이기술투자", category: "특허 - IP지역특화", isJoint: true },
  { company: "제이엔피글로벌", category: "특허 - IP지역특화", isJoint: true },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4636 = await sheets.findRow("파일", "파일번호", "4636");
  const fileId4636 = file4636 ? file4636["ID"] : null;
  console.log("파일 ID - 4636:", fileId4636);

  // 2. 출자사업 생성/조회
  const projectName = "모태펀드(특허계정) 2025년 10월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "특허",
    공고유형: "수시",
    연도: "2025",
    차수: "10월",
    지원파일ID: fileId4636
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

  // 5. 파일 4636 처리상태 업데이트
  if (file4636) {
    const rowIdx = file4636._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 8개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4636 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건 (선정결과 파일 없음)");
}

main().catch(console.error);
