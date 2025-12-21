import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4523: 모태펀드(중기부) 2025년 2차 정시 접수현황 - 98개 조합, 123개 운용사
const applications = [
  // NEXT UNICORN PROJECT 스타트업 (AI융합) - 27개 운용사
  { company: "노보섹인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "대교인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "대성창업투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "메이플투자파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "뮤어우즈벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "벡터기술투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: true },
  { company: "오라클벤처투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: true },
  { company: "보이저벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "삼천리인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "앨리스파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "어니스트벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "어센도벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "에이벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "에이본인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "에이스톤벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "에프엠씨인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: true },
  { company: "아이디어브릿지자산운용", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: true },
  { company: "엑스퀘어드", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "위벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "이크럭스벤처파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: true },
  { company: "코어자산운용", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: true },
  { company: "케이넷투자파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "크릿벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "토니인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "티더블유지에프파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "퍼시픽캐피탈", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: true },
  { company: "비티비벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: true },
  { company: "퓨처플레이", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "플래티넘기술투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "현대기술투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },
  { company: "호라이즌인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)", isJoint: false },

  // NEXT UNICORN PROJECT 스타트업 (딥테크) - 36개 운용사
  { company: "리젠트파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "브이플랫폼인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "비에스케이인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "하나에스앤비인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "비엠벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "비하이인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "스탤리온파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "한컴밸류인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "아이디벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "얼머스인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "에쓰비인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "에이티넘벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "엔브이씨파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "오다스톤인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "엘에스케이인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "윈베스트벤처투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "유비쿼스인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "서울투자파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "이노폴리스파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "이에스인베스터", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "제이비인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "제이엑스파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "제이원창업투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "지비벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "지앤피인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "케이앤투자파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "아이비케이캐피탈", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "쿼드벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "클레어보이언트벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "에스더블유인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "타임웍스인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "트라이앵글파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "제이씨에이치인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "패스파인더에이치", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "파이오니어인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: true },
  { company: "페인터즈앤벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "펜처인베스트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "펜타스톤인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "하랑기술투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "한국자산캐피탈", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "허니팟벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },
  { company: "현대투자파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)", isJoint: false },

  // NEXT UNICORN PROJECT 스케일업 (AI융합) - 5개 운용사
  { company: "린드먼아시아인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스케일업(AI융합)", isJoint: false },
  { company: "에스비브이에이", category: "중기부 - NEXT UNICORN PROJECT 스케일업(AI융합)", isJoint: false },
  { company: "캡스톤파트너스", category: "중기부 - NEXT UNICORN PROJECT 스케일업(AI융합)", isJoint: false },
  { company: "코스넷기술투자", category: "중기부 - NEXT UNICORN PROJECT 스케일업(AI융합)", isJoint: true },
  { company: "송현인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스케일업(AI융합)", isJoint: true },

  // NEXT UNICORN PROJECT 스케일업 (딥테크) - 5개 운용사
  { company: "미래에셋벤처투자", category: "중기부 - NEXT UNICORN PROJECT 스케일업(딥테크)", isJoint: false },
  { company: "스틱벤처스", category: "중기부 - NEXT UNICORN PROJECT 스케일업(딥테크)", isJoint: false },
  { company: "유안타인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스케일업(딥테크)", isJoint: false },
  { company: "제피러스랩", category: "중기부 - NEXT UNICORN PROJECT 스케일업(딥테크)", isJoint: false },
  { company: "케이비인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스케일업(딥테크)", isJoint: false },

  // 창업초기 소형 - 50개 운용사
  { company: "경기창조경제혁신센터", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "벤처스퀘어", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "고려대학교기술지주", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "전북지역대학연합기술지주", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "노틸러스인베스트먼트", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "충북창조경제혁신센터", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "디지털헬스케어파트너스", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "리벤처스", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "마크앤컴퍼니", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "바인벤처스", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "블리스바인벤처스", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "비스퀘어", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "빅뱅벤처스", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "광주지역대학연합기술지주", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "씨엔티테크", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "최성호", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "에이씨패스파인더", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "에이치엘비인베스트먼트", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "엠와이소셜컴퍼니", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "유진투자증권", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "와이앤아처", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "전남지역대학연합창업기술지주", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "와프인베스트먼트", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "울산창조경제혁신센터", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "그래비티벤처스", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "유니스트기술지주", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "임팩트재단", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "제이비벤처스", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "젠엑시스", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "카이스트청년창업투자지주", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "케이기술투자", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "제이엔피글로벌", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "킹고스프링", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "티인베스트먼트", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "스타트런", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "퍼스트게이트", category: "중기부 - 창업초기 소형", isJoint: false },
  { company: "페인터즈앤벤처스", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "열매벤처스", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "한국가치투자", category: "중기부 - 창업초기 소형", isJoint: true },
  { company: "엔슬파트너스", category: "중기부 - 창업초기 소형", isJoint: true },
];

// 4564: 선정결과 - 15개 조합, 17개 운용사 (공동GP 분리)
const selectedOperators = [
  // NEXT UNICORN PROJECT 스타트업 (AI융합) - 4개
  { company: "에이스톤벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)" },
  { company: "케이넷투자파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)" },
  { company: "토니인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)" },
  { company: "현대기술투자", category: "중기부 - NEXT UNICORN PROJECT 스타트업(AI융합)" },
  // NEXT UNICORN PROJECT 스타트업 (딥테크) - 5개
  { company: "아이디벤처스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)" },
  { company: "이노폴리스파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)" },
  { company: "이에스인베스터", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)" },
  { company: "제이엑스파트너스", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)" },
  { company: "한국자산캐피탈", category: "중기부 - NEXT UNICORN PROJECT 스타트업(딥테크)" },
  // NEXT UNICORN PROJECT 스케일업 (AI융합) - 1개
  { company: "에스비브이에이", category: "중기부 - NEXT UNICORN PROJECT 스케일업(AI융합)" },
  // NEXT UNICORN PROJECT 스케일업 (딥테크) - 1개
  { company: "케이비인베스트먼트", category: "중기부 - NEXT UNICORN PROJECT 스케일업(딥테크)" },
  // 창업초기 소형 - 6개 운용사 (4조합, 공동GP 분리)
  { company: "경기창조경제혁신센터", category: "중기부 - 창업초기 소형" },
  { company: "벤처스퀘어", category: "중기부 - 창업초기 소형" },
  { company: "마크앤컴퍼니", category: "중기부 - 창업초기 소형" },
  { company: "씨엔티테크", category: "중기부 - 창업초기 소형" },
  { company: "최성호", category: "중기부 - 창업초기 소형" },
  { company: "카이스트청년창업투자지주", category: "중기부 - 창업초기 소형" },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4523 = await sheets.findRow("파일", "파일번호", "4523");
  const file4564 = await sheets.findRow("파일", "파일번호", "4564");
  const fileId4523 = file4523 ? file4523["ID"] : null;
  const fileId4564 = file4564 ? file4564["ID"] : null;
  console.log("파일 ID - 4523:", fileId4523, ", 4564:", fileId4564);

  // 2. 출자사업 생성/조회
  const projectName = "모태펀드(중기부) 2025년 2차 정시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "중기부",
    공고유형: "정시",
    연도: "2025",
    차수: "2차",
    지원파일ID: fileId4523
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
    console.log("운용사 ID 없음:", missingOps.join(", "));
  }

  // 5. 파일 4523 처리상태 업데이트
  if (file4523) {
    const rowIdx = file4523._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 98개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4523 처리 완료");
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

  // 7. 파일 4564 처리상태 업데이트
  if (file4564) {
    const rowIdx = file4564._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${selected + rejected}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 4564 처리 완료");
  }

  // 8. 출자사업 파일 연결 및 현황 업데이트
  await sheets.updateProjectFileId(project.id, "선정결과", fileId4564);
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건");
  console.log("선정:", selected, "건, 탈락:", rejected, "건");
}

main().catch(console.error);
