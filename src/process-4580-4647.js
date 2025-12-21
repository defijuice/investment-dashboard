import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4580: 해외VC 글로벌 펀드 2025년 하반기 접수현황 - 일반분야 34개 조합
const applications = [
  // 미국 - 16개
  { company: "196 Ventures, LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Alchemist Accelerator LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Saltagen Ventures Limited", category: "해외VC - 일반분야", isJoint: false },
  { company: "Cadenza Ventures Management Company, LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Fernbrook Capital Management LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "One Way Ventures Management PBC, Inc.", category: "해외VC - 일반분야", isJoint: false },
  { company: "Big Basin Management, LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Collaborative Fund Management", category: "해외VC - 일반분야", isJoint: false },
  { company: "New Form Capital LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Playground Global, LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Maryland Technology Economic Development Corporation(TEDCO)", category: "해외VC - 일반분야", isJoint: false },
  { company: "Turret Capital LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Fin Venture Capital Management LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Quantum Prime Ventures Management LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Stella Capital LLC", category: "해외VC - 일반분야", isJoint: false },
  { company: "Valon Capital Management, LLC", category: "해외VC - 일반분야", isJoint: false },
  // 유럽/중동 - 4개
  { company: "Atlantic Vantage Point Capital", category: "해외VC - 일반분야", isJoint: false },
  { company: "OMNES CAPITAL", category: "해외VC - 일반분야", isJoint: false },
  { company: "Verve Capital Partners AG", category: "해외VC - 일반분야", isJoint: false },
  { company: "Epidarex Management Ltd", category: "해외VC - 일반분야", isJoint: false },
  // 아시아 - 14개
  { company: "BIG Impact Inc.", category: "해외VC - 일반분야", isJoint: false },
  { company: "PT. Insan Generasi Pemimpin", category: "해외VC - 일반분야", isJoint: false },
  { company: "SparkLabs Taipei Co., Ltd.", category: "해외VC - 일반분야", isJoint: false },
  { company: "Atinum Capital Partners Pte. Ltd.", category: "해외VC - 일반분야", isJoint: false },
  { company: "NC Management Company Limited (Cayman)", category: "해외VC - 일반분야", isJoint: false },
  { company: "Insignia Ventures Partners Pte Ltd", category: "해외VC - 일반분야", isJoint: false },
  { company: "Jan Cap Pte Ltd", category: "해외VC - 일반분야", isJoint: false },
  { company: "Templewater Hong Kong Limited", category: "해외VC - 일반분야", isJoint: false },
  { company: "C Capital Investment Management Limited (CCIM)", category: "해외VC - 일반분야", isJoint: false },
  { company: "CMB International Asset Management Limited", category: "해외VC - 일반분야", isJoint: false },
  { company: "SV Investment - East Ventures", category: "해외VC - 일반분야", isJoint: false },
  { company: "Enlighten Angel Fund P.Ltd", category: "해외VC - 일반분야", isJoint: false },
  { company: "SY Capital Management (HK) Limited", category: "해외VC - 일반분야", isJoint: false },
  { company: "DV Partners Management, LLC", category: "해외VC - 일반분야", isJoint: false },
];

// 4647: 선정결과 - 일반분야 6개 조합
// 운용사명 매칭: 접수현황 이름 → 선정결과 이름
const selectedOperators = [
  { company: "Playground Global, LLC", category: "해외VC - 일반분야" },
  { company: "Maryland Technology Economic Development Corporation(TEDCO)", category: "해외VC - 일반분야" },
  { company: "One Way Ventures Management PBC, Inc.", category: "해외VC - 일반분야" },
  { company: "Atlantic Vantage Point Capital", category: "해외VC - 일반분야" },  // AVP
  { company: "CMB International Asset Management Limited", category: "해외VC - 일반분야" },  // CMBI
  { company: "DV Partners Management, LLC", category: "해외VC - 일반분야" },  // DV Partners
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4580 = await sheets.findRow("파일", "파일번호", "4580");
  const file4647 = await sheets.findRow("파일", "파일번호", "4647");
  const fileId4580 = file4580 ? file4580["ID"] : null;
  const fileId4647 = file4647 ? file4647["ID"] : null;
  console.log("파일 ID - 4580:", fileId4580, ", 4647:", fileId4647);

  // 2. 출자사업 생성/조회
  const projectName = "해외VC 글로벌 펀드 2025년 하반기 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "해외VC",
    공고유형: "정시",
    연도: "2025",
    차수: "하반기",
    지원파일ID: fileId4580
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

  // 5. 파일 4580 처리상태 업데이트
  if (file4580) {
    const rowIdx = file4580._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 34개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4580 처리 완료");
  }

  // 6. 선정결과 처리
  const ops2 = await sheets.getAllOperators();
  const opMap2 = new Map();
  for (const op of ops2) {
    opMap2.set(op["운용사명"], op["ID"]);
  }

  const selectedKeys = new Set();
  for (const sel of selectedOperators) {
    const opId = opMap2.get(sel.company);
    if (opId) {
      selectedKeys.add(`${opId}|${sel.category}`);
    } else {
      console.error("선정 운용사 ID 없음:", sel.company);
    }
  }

  const allApps = await sheets.getValues("신청현황!A:K");
  const headers = allApps[0];
  const projIdx = headers.indexOf("출자사업ID");
  const opIdx = headers.indexOf("운용사ID");
  const catIdx = headers.indexOf("출자분야");
  const statusIdx = headers.indexOf("상태");

  const updates = [];
  for (let i = 1; i < allApps.length; i++) {
    const row = allApps[i];
    if (row[projIdx] !== project.id) continue;

    const opId = row[opIdx];
    const category = row[catIdx];
    const key = `${opId}|${category}`;
    const currentStatus = row[statusIdx];

    const newStatus = selectedKeys.has(key) ? "선정" : "탈락";
    if (currentStatus !== newStatus) {
      updates.push({ rowIdx: i + 1, status: newStatus });
    }
  }

  // 배치 업데이트
  const batchSize = 15;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    for (const u of batch) {
      await sheets.setValues(`신청현황!I${u.rowIdx}`, [[u.status]]);
    }
    if (i + batchSize < updates.length) {
      console.log(`배치 ${Math.floor(i/batchSize) + 1} 완료, 3초 대기...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const selected = updates.filter(u => u.status === "선정").length;
  const rejected = updates.filter(u => u.status === "탈락").length;
  console.log("선정:", selected, "건, 탈락:", rejected, "건");

  // 7. 파일 4647 처리상태 업데이트
  if (file4647) {
    const rowIdx = file4647._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${selected + rejected}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 4647 처리 완료");
  }

  // 8. 출자사업 파일 연결 및 현황 업데이트
  await sheets.updateProjectFileId(project.id, "선정결과", fileId4647);
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건");
  console.log("선정:", selected, "건, 탈락:", rejected, "건");
}

main().catch(console.error);
