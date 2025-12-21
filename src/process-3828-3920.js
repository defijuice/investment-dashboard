import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3828: 한국모태펀드 2023년 2차 정시 중기부 소관 접수현황 - 88개 조합
const applications = [
  // 혁신모험 창업초기 일반 - 20개 운용사 (17조합, 공동GP 3건)
  { company: "넥스트지인베스트먼트", category: "혁신모험 - 창업초기일반", isJoint: true },
  { company: "바로벤처스", category: "혁신모험 - 창업초기일반", isJoint: true },
  { company: "마그나인베스트먼트", category: "혁신모험 - 창업초기일반", isJoint: true },
  { company: "파이오니어인베스트먼트", category: "혁신모험 - 창업초기일반", isJoint: true },
  { company: "비에스케이인베스트먼트", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "비에이파트너스", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "비하이인베스트먼트", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "빅뱅벤처스", category: "혁신모험 - 창업초기일반", isJoint: true },
  { company: "빅뱅엔젤스", category: "혁신모험 - 창업초기일반", isJoint: true },
  { company: "서울대학교기술지주", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "스톤브릿지벤처스", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "심본투자파트너스", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "씨케이디창업투자", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "어니스트벤처스", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "에스제이투자파트너스", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "엔코어벤처스", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "이에스인베스터", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "인터베스트", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "코나벤처파트너스", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "킹고투자파트너스", category: "혁신모험 - 창업초기일반", isJoint: false },
  { company: "펜타스톤인베스트먼트", category: "혁신모험 - 창업초기일반", isJoint: true },
  { company: "비엠벤처스", category: "혁신모험 - 창업초기일반", isJoint: true },
  { company: "플래티넘기술투자", category: "혁신모험 - 창업초기일반", isJoint: false },
  // 혁신모험 창업초기 루키 - 17개 운용사 (16조합, 공동GP 1건)
  { company: "500글로벌매니지먼트코리아", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "노보섹인베스트먼트", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "다날투자파트너스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "라이징에스벤처스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "린벤처스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "뮤어우즈벤처스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "수이제네리스파트너스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "아이피파트너스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "에이온인베스트먼트", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "엑스퀘어드", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "제이씨에이치인베스트먼트", category: "혁신모험 - 창업초기루키", isJoint: true },
  { company: "오라클벤처투자", category: "혁신모험 - 창업초기루키", isJoint: true },
  { company: "지노바인베스트먼트", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "크로스로드파트너스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "티케인베스트먼트", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "플랜에이치벤처스", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "한국가치투자", category: "혁신모험 - 창업초기루키", isJoint: false },
  { company: "가이아벤처파트너스", category: "혁신모험 - 창업초기루키", isJoint: false },
  // 초격차(민간제안) 일반 - 28개 운용사 (21조합, 공동GP 10건)
  { company: "경남벤처투자", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "쿼드자산운용", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "나우아이비캐피탈", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "아이비케이캐피탈", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "동문파트너즈", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "다날투자파트너스", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "마그나인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "티케이지벤처스", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "메디치인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "메디톡스벤처투자", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "비하이인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "삼호그린인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "신한벤처투자", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "케이씨투자파트너스", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "아주아이비투자", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "알바트로스인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "에스앤에스인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "세아기술투자", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "에트리홀딩스", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "에스케이증권", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "엔코어벤처스", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "이앤인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "이에스인베스터", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "플랜에이치벤처스", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "코오롱인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "킹고투자파트너스", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "토니인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: false },
  { company: "티인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "프롤로그벤처스", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "펜타스톤인베스트먼트", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "비엠벤처스", category: "혁신모험 - 초격차일반", isJoint: true },
  { company: "퓨처플레이", category: "혁신모험 - 초격차일반", isJoint: false },
  // 초격차(민간제안) 루키 - 14개 운용사 (12조합, 공동GP 2건)
  { company: "노보섹인베스트먼트", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "린벤처스", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "뮤어우즈벤처스", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "빅뱅벤처스", category: "혁신모험 - 초격차루키", isJoint: true },
  { company: "라이징에스벤처스", category: "혁신모험 - 초격차루키", isJoint: true },
  { company: "에스벤처스", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "에이온인베스트먼트", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "엑스퀘어드", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "엔케이에스인베스트먼트", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "와이즈레터인베스트먼트", category: "혁신모험 - 초격차루키", isJoint: true },
  { company: "제이커브인베스트먼트", category: "혁신모험 - 초격차루키", isJoint: true },
  { company: "크로스로드파트너스", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "트라이앵글파트너스", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "티케인베스트먼트", category: "혁신모험 - 초격차루키", isJoint: false },
  { company: "포레스트벤처스", category: "혁신모험 - 초격차루키", isJoint: false },
  // 중진 스케일업·중견도약 중소형 - 4개
  { company: "라구나인베스트먼트", category: "중진 - 스케일업중소형", isJoint: false },
  { company: "시그나이트파트너스", category: "중진 - 스케일업중소형", isJoint: false },
  { company: "에이치비인베스트먼트", category: "중진 - 스케일업중소형", isJoint: false },
  { company: "제미니투자", category: "중진 - 스케일업중소형", isJoint: false },
  // 중진 스케일업·중견도약 대형 - 1개
  { company: "티에스인베스트먼트", category: "중진 - 스케일업대형", isJoint: false },
  // 중진 일반세컨더리 중소형 - 10개 운용사 (8조합, 공동GP 2건)
  { company: "대성창업투자", category: "중진 - 세컨더리중소형", isJoint: false },
  { company: "라구나인베스트먼트", category: "중진 - 세컨더리중소형", isJoint: false },
  { company: "메이플투자파트너스", category: "중진 - 세컨더리중소형", isJoint: true },
  { company: "아이비케이캐피탈", category: "중진 - 세컨더리중소형", isJoint: true },
  { company: "삼호그린인베스트먼트", category: "중진 - 세컨더리중소형", isJoint: false },
  { company: "얼머스인베스트먼트", category: "중진 - 세컨더리중소형", isJoint: false },
  { company: "유티씨인베스트먼트", category: "중진 - 세컨더리중소형", isJoint: false },
  { company: "지앤텍벤처투자", category: "중진 - 세컨더리중소형", isJoint: true },
  { company: "엔에이치투자증권", category: "중진 - 세컨더리중소형", isJoint: true },
  { company: "쿼드벤처스", category: "중진 - 세컨더리중소형", isJoint: true },
  { company: "프롤로그벤처스", category: "중진 - 세컨더리중소형", isJoint: true },
  // 중진 일반세컨더리 대형 - 1개
  { company: "신한벤처투자", category: "중진 - 세컨더리대형", isJoint: false },
  // 중진 LP지분유동화 - 3개 운용사 (2조합, 공동GP 1건)
  { company: "메타인베스트먼트", category: "중진 - LP지분유동화", isJoint: true },
  { company: "리딩에이스캐피탈", category: "중진 - LP지분유동화", isJoint: true },
  { company: "제이비인베스트먼트", category: "중진 - LP지분유동화", isJoint: false },
];

// 3920: 선정결과 - 23개 조합
const selectedOperators = [
  // 중진 스케일업·중견도약 중소형 - 1개
  { company: "라구나인베스트먼트", category: "중진 - 스케일업중소형" },
  // 중진 스케일업·중견도약 대형 - 1개
  { company: "티에스인베스트먼트", category: "중진 - 스케일업대형" },
  // 중진 일반세컨더리 중소형 - 3개
  { company: "라구나인베스트먼트", category: "중진 - 세컨더리중소형" },
  { company: "삼호그린인베스트먼트", category: "중진 - 세컨더리중소형" },
  { company: "얼머스인베스트먼트", category: "중진 - 세컨더리중소형" },
  // 중진 일반세컨더리 대형 - 1개
  { company: "신한벤처투자", category: "중진 - 세컨더리대형" },
  // 중진 LP지분유동화 - 2개 (공동GP)
  { company: "메타인베스트먼트", category: "중진 - LP지분유동화" },
  { company: "리딩에이스캐피탈", category: "중진 - LP지분유동화" },
  // 혁신모험 창업초기 일반 - 4개
  { company: "비에스케이인베스트먼트", category: "혁신모험 - 창업초기일반" },
  { company: "비에이파트너스", category: "혁신모험 - 창업초기일반" },
  { company: "스톤브릿지벤처스", category: "혁신모험 - 창업초기일반" },
  { company: "인터베스트", category: "혁신모험 - 창업초기일반" },
  // 혁신모험 창업초기 루키 - 5개 (공동GP 1건)
  { company: "뮤어우즈벤처스", category: "혁신모험 - 창업초기루키" },
  { company: "엑스퀘어드", category: "혁신모험 - 창업초기루키" },
  { company: "제이씨에이치인베스트먼트", category: "혁신모험 - 창업초기루키" },
  { company: "오라클벤처투자", category: "혁신모험 - 창업초기루키" },
  { company: "크로스로드파트너스", category: "혁신모험 - 창업초기루키" },
  // 초격차(민간제안) 일반 - 4개
  { company: "삼호그린인베스트먼트", category: "혁신모험 - 초격차일반" },
  { company: "아주아이비투자", category: "혁신모험 - 초격차일반" },
  { company: "코오롱인베스트먼트", category: "혁신모험 - 초격차일반" },
  { company: "퓨처플레이", category: "혁신모험 - 초격차일반" },
  // 초격차(민간제안) 루키 - 4개
  { company: "뮤어우즈벤처스", category: "혁신모험 - 초격차루키" },
  { company: "에스벤처스", category: "혁신모험 - 초격차루키" },
  { company: "크로스로드파트너스", category: "혁신모험 - 초격차루키" },
  { company: "티케인베스트먼트", category: "혁신모험 - 초격차루키" },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3828 = await sheets.findRow("파일", "파일번호", "3828");
  const file3920 = await sheets.findRow("파일", "파일번호", "3920");
  const fileId3828 = file3828 ? file3828["ID"] : null;
  const fileId3920 = file3920 ? file3920["ID"] : null;
  console.log("파일 ID - 3828:", fileId3828, ", 3920:", fileId3920);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(중기부) 2023년 2차 정시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "중기부",
    공고유형: "정시",
    연도: "2023",
    차수: "2차",
    지원파일ID: fileId3828
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

  // 5. 파일 3828 처리상태 업데이트
  if (file3828) {
    const rowIdx = file3828._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 88개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3828 처리 완료");
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

  // 7. 파일 3920 처리상태 업데이트
  if (file3920) {
    const rowIdx = file3920._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${selected + rejected}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3920 처리 완료");
  }

  // 8. 출자사업 파일 연결 및 현황 업데이트
  await sheets.updateProjectFileId(project.id, "선정결과", fileId3920);
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건");
  console.log("선정:", selected, "건, 탈락:", rejected, "건");
}

main().catch(console.error);
