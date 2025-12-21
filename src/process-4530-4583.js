import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4530: 모태펀드(문체부 등) 2025년 7월 수시 접수현황 - 49개 조합
const applications = [
  // 문화일반 - 6개 운용사 (5조합)
  { company: "메인스트리트벤처스", category: "문체부 - 문화일반", isJoint: false },
  { company: "아이엘씨에쿼티파트너스", category: "문체부 - 문화일반", isJoint: false },
  { company: "에이본인베스트먼트", category: "문체부 - 문화일반", isJoint: false },
  { company: "일신창업투자", category: "문체부 - 문화일반", isJoint: false },
  { company: "케이앤투자파트너스", category: "문체부 - 문화일반", isJoint: true },
  { company: "웰컴벤처스", category: "문체부 - 문화일반", isJoint: true },

  // 신기술 - 14개 운용사 (11조합)
  { company: "넥스트지인베스트먼트", category: "문체부 - 신기술", isJoint: false },
  { company: "로간벤처스", category: "문체부 - 신기술", isJoint: false },
  { company: "린벤처스", category: "문체부 - 신기술", isJoint: true },
  { company: "에스케이증권", category: "문체부 - 신기술", isJoint: true },
  { company: "벡터기술투자", category: "문체부 - 신기술", isJoint: true },
  { company: "오라클벤처투자", category: "문체부 - 신기술", isJoint: true },
  { company: "에스엠컬처파트너스", category: "문체부 - 신기술", isJoint: false },
  { company: "에이본인베스트먼트", category: "문체부 - 신기술", isJoint: false },
  { company: "일신창업투자", category: "문체부 - 신기술", isJoint: false },
  { company: "제이비인베스트먼트", category: "문체부 - 신기술", isJoint: false },
  { company: "트라이앵글파트너스", category: "문체부 - 신기술", isJoint: true },
  { company: "오거스트벤처파트너스", category: "문체부 - 신기술", isJoint: true },
  { company: "페트리코파트너스", category: "문체부 - 신기술", isJoint: false },

  // 스포츠산업 - 13개 운용사 (10조합)
  { company: "로간벤처스", category: "문체부 - 스포츠산업", isJoint: false },
  { company: "린벤처스", category: "문체부 - 스포츠산업", isJoint: false },
  { company: "스탤리온파트너스", category: "문체부 - 스포츠산업", isJoint: false },
  { company: "에이씨패스파인더", category: "문체부 - 스포츠산업", isJoint: false },
  { company: "에프엠씨인베스트먼트", category: "문체부 - 스포츠산업", isJoint: true },
  { company: "아이디어브릿지자산운용", category: "문체부 - 스포츠산업", isJoint: true },
  { company: "와이앤아처", category: "문체부 - 스포츠산업", isJoint: true },
  { company: "트리거투자파트너스", category: "문체부 - 스포츠산업", isJoint: true },
  { company: "와프인베스트먼트", category: "문체부 - 스포츠산업", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "문체부 - 스포츠산업", isJoint: false },
  { company: "임팩트재단", category: "문체부 - 스포츠산업", isJoint: false },
  { company: "코나인베스트먼트", category: "문체부 - 스포츠산업", isJoint: false },

  // 중저예산한국영화 - 6개 운용사 (5조합)
  { company: "로간벤처스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "오거스트벤처파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "유니온투자파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "트리거투자파트너스", category: "문체부 - 중저예산한국영화", isJoint: true },
  { company: "나이스투자파트너스", category: "문체부 - 중저예산한국영화", isJoint: true },

  // 한국영화 메인투자 - 5개 운용사 (5조합)
  { company: "로간벤처스", category: "문체부 - 한국영화 메인투자", isJoint: false },
  { company: "에이본인베스트먼트", category: "문체부 - 한국영화 메인투자", isJoint: false },
  { company: "오거스트벤처파트너스", category: "문체부 - 한국영화 메인투자", isJoint: false },
  { company: "와프인베스트먼트", category: "문체부 - 한국영화 메인투자", isJoint: false },
  { company: "케이씨벤처스", category: "문체부 - 한국영화 메인투자", isJoint: false },

  // AI - 17개 운용사 (14조합)
  { company: "대교인베스트먼트", category: "문체부 - AI", isJoint: false },
  { company: "뮤어우즈벤처스", category: "문체부 - AI", isJoint: false },
  { company: "스틱벤처스", category: "문체부 - AI", isJoint: false },
  { company: "에버베스트파트너스", category: "문체부 - AI", isJoint: true },
  { company: "하버브릭스파트너스", category: "문체부 - AI", isJoint: true },
  { company: "에스앤에스인베스트먼트", category: "문체부 - AI", isJoint: false },
  { company: "에이벤처스", category: "문체부 - AI", isJoint: false },
  { company: "에이스톤벤처스", category: "문체부 - AI", isJoint: false },
  { company: "위벤처스", category: "문체부 - AI", isJoint: false },
  { company: "캡스톤파트너스", category: "문체부 - AI", isJoint: false },
  { company: "케이넷투자파트너스", category: "문체부 - AI", isJoint: false },
  { company: "키움인베스트먼트", category: "문체부 - AI", isJoint: false },
  { company: "티더블유지에프파트너스", category: "문체부 - AI", isJoint: false },
  { company: "패스파인더에이치", category: "문체부 - AI", isJoint: true },
  { company: "에스벤처스", category: "문체부 - AI", isJoint: true },
  { company: "힐스프링인베스트먼트", category: "문체부 - AI", isJoint: false },
];

// 4583: 선정결과 - 7개 조합 (8개 운용사)
const selectedOperators = [
  { company: "메인스트리트벤처스", category: "문체부 - 문화일반" },
  { company: "제이비인베스트먼트", category: "문체부 - 신기술" },
  { company: "에이씨패스파인더", category: "문체부 - 스포츠산업" },
  { company: "트리거투자파트너스", category: "문체부 - 중저예산한국영화" },
  { company: "나이스투자파트너스", category: "문체부 - 중저예산한국영화" },
  { company: "케이씨벤처스", category: "문체부 - 한국영화 메인투자" },
  { company: "스틱벤처스", category: "문체부 - AI" },
  { company: "에이벤처스", category: "문체부 - AI" },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4530 = await sheets.findRow("파일", "파일번호", "4530");
  const file4583 = await sheets.findRow("파일", "파일번호", "4583");
  const fileId4530 = file4530 ? file4530["ID"] : null;
  const fileId4583 = file4583 ? file4583["ID"] : null;
  console.log("파일 ID - 4530:", fileId4530, ", 4583:", fileId4583);

  // 2. 출자사업 생성/조회
  const projectName = "모태펀드(문체부 등) 2025년 7월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "문체부",
    공고유형: "수시",
    연도: "2025",
    차수: "7월",
    지원파일ID: fileId4530
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

  // 5. 파일 4530 처리상태 업데이트
  if (file4530) {
    const rowIdx = file4530._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 49개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4530 처리 완료");
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

  // 7. 파일 4583 처리상태 업데이트
  if (file4583) {
    const rowIdx = file4583._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${selected + rejected}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 4583 처리 완료");
  }

  // 8. 출자사업 파일 연결 및 현황 업데이트
  await sheets.updateProjectFileId(project.id, "선정결과", fileId4583);
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건");
  console.log("선정:", selected, "건, 탈락:", rejected, "건");
}

main().catch(console.error);
