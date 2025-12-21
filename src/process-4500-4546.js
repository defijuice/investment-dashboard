import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4500: 모태펀드(문체부 등) 2025년 5월 수시 접수현황
const applications = [
  // 관광기업육성
  { company: "넥스트지인베스트먼트", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "한국가치투자", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "씨엔티테크", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "NBH캐피탈", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "유진자산운용", category: "문체부 - 관광기업육성", isJoint: false },
  // 콘텐츠 육성
  { company: "로간벤처스", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "린벤처스", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "송현인베스트먼트", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "아이엘씨에쿼티파트너스", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "어센도벤처스", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "에이본인베스트먼트", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "일신창업투자", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "제이와이피파트너스", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "컴파벤처스", category: "문체부 - 콘텐츠 육성", isJoint: true },
  { company: "비엔케이투자증권", category: "문체부 - 콘텐츠 육성", isJoint: true },
  { company: "케이씨벤처스", category: "문체부 - 콘텐츠 육성", isJoint: false },
  { company: "케이앤투자파트너스", category: "문체부 - 콘텐츠 육성", isJoint: true },
  { company: "웰컴벤처스", category: "문체부 - 콘텐츠 육성", isJoint: true },
  { company: "티지씨케이파트너스", category: "문체부 - 콘텐츠 육성", isJoint: false },
  // 애니메이션 전문
  { company: "로간벤처스", category: "문체부 - 애니메이션 전문", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "문체부 - 애니메이션 전문", isJoint: false },
  { company: "제이와이피파트너스", category: "문체부 - 애니메이션 전문", isJoint: false },
  // 중저예산한국영화
  { company: "넥스트지인베스트먼트", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "에이본인베스트먼트", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "와프인베스트먼트", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "유니온투자파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "티지씨케이파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  // 한국영화 메인투자
  { company: "넥스트지인베스트먼트", category: "문체부 - 한국영화 메인투자", isJoint: false },
  { company: "에이본인베스트먼트", category: "문체부 - 한국영화 메인투자", isJoint: false },
  { company: "오거스트벤처파트너스", category: "문체부 - 한국영화 메인투자", isJoint: false },
  { company: "웰컴벤처스", category: "문체부 - 한국영화 메인투자", isJoint: true },
  { company: "로간벤처스", category: "문체부 - 한국영화 메인투자", isJoint: true },
  // AI 중형
  { company: "대교인베스트먼트", category: "문체부 - AI 중형", isJoint: false },
  { company: "메타리얼벤처캐피탈", category: "문체부 - AI 중형", isJoint: false },
  { company: "앨리스파트너스", category: "문체부 - AI 중형", isJoint: false },
  { company: "오라클벤처투자", category: "문체부 - AI 중형", isJoint: true },
  { company: "벡터기술투자", category: "문체부 - AI 중형", isJoint: true },
  { company: "이크럭스벤처파트너스", category: "문체부 - AI 중형", isJoint: true },
  { company: "코어자산운용", category: "문체부 - AI 중형", isJoint: true },
  { company: "인탑스인베스트먼트", category: "문체부 - AI 중형", isJoint: false },
  { company: "타임웍스인베스트먼트", category: "문체부 - AI 중형", isJoint: false },
  { company: "트라이앵글파트너스", category: "문체부 - AI 중형", isJoint: false },
  { company: "티더블유지에프파트너스", category: "문체부 - AI 중형", isJoint: false },
  { company: "티인베스트먼트", category: "문체부 - AI 중형", isJoint: false },
  { company: "퓨처플레이", category: "문체부 - AI 중형", isJoint: false },
  { company: "플래티넘기술투자", category: "문체부 - AI 중형", isJoint: false },
  // AI 대형
  { company: "송현인베스트먼트", category: "문체부 - AI 대형", isJoint: false },
  { company: "신한벤처투자", category: "문체부 - AI 대형", isJoint: false },
  { company: "에버그린투자파트너스", category: "문체부 - AI 대형", isJoint: false }
];

// 4546: 선정결과
const selectedOperators = [
  { company: "케이씨벤처스", category: "문체부 - 콘텐츠 육성" },
  { company: "이크럭스벤처파트너스", category: "문체부 - 애니메이션 전문" },
  { company: "넥스트지인베스트먼트", category: "문체부 - 중저예산한국영화" },
  { company: "오거스트벤처파트너스", category: "문체부 - 한국영화 메인투자" },
  { company: "타임웍스인베스트먼트", category: "문체부 - AI 중형" },
  { company: "신한벤처투자", category: "문체부 - AI 대형" },
  { company: "에버그린투자파트너스", category: "문체부 - AI 대형" }
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4500 = await sheets.findRow("파일", "파일번호", "4500");
  const file4546 = await sheets.findRow("파일", "파일번호", "4546");
  const fileId4500 = file4500 ? file4500["ID"] : null;
  const fileId4546 = file4546 ? file4546["ID"] : null;
  console.log("파일 ID - 4500:", fileId4500, ", 4546:", fileId4546);

  // 2. 출자사업 생성/조회
  const projectName = "모태펀드(문체부 등) 2025년 5월 수시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "문체부",
    공고유형: "수시",
    연도: "2025",
    차수: "5월",
    지원파일ID: fileId4500
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
        console.log(`유사 운용사: ${sim.newName} → ${sim.existingName}`);
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

  for (const app of applications) {
    const opId = operatorMap.get(app.company);
    if (!opId) {
      console.error("운용사 ID 없음:", app.company);
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

  // 5. 파일 4500 처리상태 업데이트
  if (file4500) {
    const rowIdx = file4500._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 42개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4500 처리 완료");
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
  const batchSize = 20;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    for (const u of batch) {
      await sheets.setValues(`신청현황!I${u.rowIdx}`, [[u.status]]);
    }
    if (i + batchSize < updates.length) {
      console.log(`배치 ${Math.floor(i/batchSize) + 1} 완료, 2초 대기...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const selected = updates.filter(u => u.status === "선정").length;
  const rejected = updates.filter(u => u.status === "탈락").length;
  console.log("선정:", selected, "건, 탈락:", rejected, "건");

  // 7. 파일 4546 처리상태 업데이트
  if (file4546) {
    const rowIdx = file4546._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${selected + rejected}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 4546 처리 완료");
  }

  // 8. 출자사업 파일 연결 및 현황 업데이트
  await sheets.updateProjectFileId(project.id, "선정결과", fileId4546);
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건");
  console.log("선정:", selected, "건, 탈락:", rejected, "건");
}

main().catch(console.error);
