import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3814: 한국모태펀드(문체부 등) 2023년 2차 정시 접수현황 - 79개 조합
const applications = [
  // 중저예산한국영화 - 8개 운용사 (7조합, 공동GP 1건)
  { company: "넥스트지인베스트먼트", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "레오파트너스인베스트먼트", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "로간벤처스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "센트럴투자파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "쏠레어파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  { company: "오거스트벤처파트너스", category: "문체부 - 중저예산한국영화", isJoint: true },
  { company: "오아시스벤처스", category: "문체부 - 중저예산한국영화", isJoint: true },
  { company: "이크럭스벤처파트너스", category: "문체부 - 중저예산한국영화", isJoint: false },
  // 스포츠산업 - 1개
  { company: "인피니툼파트너스", category: "문체부 - 스포츠산업", isJoint: false },
  // 스포츠출발 - 3개
  { company: "JB벤처스", category: "문체부 - 스포츠출발", isJoint: false },
  { company: "상상이비즈", category: "문체부 - 스포츠출발", isJoint: false },
  { company: "씨엔티테크", category: "문체부 - 스포츠출발", isJoint: false },
  // 관광기업육성 - 10개 운용사 (7조합, 공동GP 3건)
  { company: "NBH캐피탈", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "씨엔티테크", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "코스넷기술투자", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "서울투자파트너스", category: "문체부 - 관광기업육성", isJoint: false },
  { company: "심본투자파트너스", category: "문체부 - 관광기업육성", isJoint: false },
  { company: "웰투시벤처투자", category: "문체부 - 관광기업육성", isJoint: false },
  { company: "인피니툼파트너스", category: "문체부 - 관광기업육성", isJoint: false },
  { company: "코나인베스트먼트", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "필로소피아벤처스", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "트라이앵글파트너스", category: "문체부 - 관광기업육성", isJoint: true },
  { company: "티케이지벤처스", category: "문체부 - 관광기업육성", isJoint: true },
  // 국토교통혁신(일반) - 14개 운용사 (10조합, 공동GP 5건)
  { company: "나우아이비캐피탈", category: "문체부 - 국토교통혁신(일반)", isJoint: false },
  { company: "노보섹인베스트먼트", category: "문체부 - 국토교통혁신(일반)", isJoint: false },
  { company: "마젤란기술투자", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "에스케이증권", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "브리즈인베스트먼트", category: "문체부 - 국토교통혁신(일반)", isJoint: false },
  { company: "비엔케이벤처투자", category: "문체부 - 국토교통혁신(일반)", isJoint: false },
  { company: "어니스트벤처스", category: "문체부 - 국토교통혁신(일반)", isJoint: false },
  { company: "에스앤에스인베스트먼트", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "세아기술투자", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "오라클벤처투자", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "바로벤처스", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "코나인베스트먼트", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "필로소피아벤처스", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "플랜에이치벤처스", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  { company: "현대차증권", category: "문체부 - 국토교통혁신(일반)", isJoint: true },
  // 사회적기업 - 1개
  { company: "엠와이소셜컴퍼니", category: "문체부 - 사회적기업", isJoint: false },
  // 대학창업1 - 14개 운용사 (7조합, 공동GP 7건)
  { company: "강원대학교기술지주회사", category: "문체부 - 대학창업1", isJoint: true },
  { company: "더존비즈온", category: "문체부 - 대학창업1", isJoint: true },
  { company: "에이티피벤처스", category: "문체부 - 대학창업1", isJoint: true },
  { company: "유니스트기술지주", category: "문체부 - 대학창업1", isJoint: true },
  { company: "원투자파트너스", category: "문체부 - 대학창업1", isJoint: true },
  { company: "서울시립대학교기술지주", category: "문체부 - 대학창업1", isJoint: true },
  { company: "전북대학교기술지주회사", category: "문체부 - 대학창업1", isJoint: true },
  { company: "씨엔티테크", category: "문체부 - 대학창업1", isJoint: true },
  { company: "아이디어파트너스", category: "문체부 - 대학창업1", isJoint: true },
  { company: "포항연합기술지주", category: "문체부 - 대학창업1", isJoint: false },
  { company: "킹고스프링", category: "문체부 - 대학창업1", isJoint: true },
  { company: "카이스트홀딩스", category: "문체부 - 대학창업1", isJoint: true },
  { company: "한림대학교기술지주", category: "문체부 - 대학창업1", isJoint: true },
  { company: "비전벤처파트너스", category: "문체부 - 대학창업1", isJoint: true },
  // 대학창업2 - 12개 운용사 (9조합, 공동GP 3건)
  { company: "경북대학교기술지주", category: "문체부 - 대학창업2", isJoint: true },
  { company: "다래전략사업화센터", category: "문체부 - 대학창업2", isJoint: true },
  { company: "고려대학교기술지주", category: "문체부 - 대학창업2", isJoint: false },
  { company: "대경지역대학공동기술지주", category: "문체부 - 대학창업2", isJoint: false },
  { company: "미래과학기술지주", category: "문체부 - 대학창업2", isJoint: false },
  { company: "부산대학교기술지주", category: "문체부 - 대학창업2", isJoint: false },
  { company: "부산지역대학연합기술지주", category: "문체부 - 대학창업2", isJoint: false },
  { company: "와이앤아처", category: "문체부 - 대학창업2", isJoint: true },
  { company: "광주지역대학연합기술지주", category: "문체부 - 대학창업2", isJoint: true },
  { company: "전남대학교기술지주회사", category: "문체부 - 대학창업2", isJoint: true },
  { company: "전남지역대학연합창업기술지주", category: "문체부 - 대학창업2", isJoint: true },
  // 공공기술사업화 - 18개 운용사 (14조합, 공동GP 4건)
  { company: "한양대학교기술지주회사", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "인포뱅크", category: "문체부 - 공공기술사업화", isJoint: true },
  { company: "비디씨엑셀러레이터", category: "문체부 - 공공기술사업화", isJoint: true },
  { company: "아이파트너즈", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "경북대학교기술지주", category: "문체부 - 공공기술사업화", isJoint: true },
  { company: "제이엔피글로벌", category: "문체부 - 공공기술사업화", isJoint: true },
  { company: "고려대학교기술지주", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "미래과학기술지주", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "서울대학교기술지주", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "씨엔티테크", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "에스와이피", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "에이티피벤처스", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "전북지역대학연합기술지주", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "JB벤처스", category: "문체부 - 공공기술사업화", isJoint: false },
  { company: "광주지역대학연합기술지주", category: "문체부 - 공공기술사업화", isJoint: true },
  { company: "와이앤아처", category: "문체부 - 공공기술사업화", isJoint: true },
  { company: "파트너스라운지", category: "문체부 - 공공기술사업화", isJoint: true },
  { company: "경북창조경제혁신센터", category: "문체부 - 공공기술사업화", isJoint: true },
  // 뉴스페이스 - 4개 운용사 (3조합, 공동GP 1건)
  { company: "메디치인베스트먼트", category: "문체부 - 뉴스페이스", isJoint: false },
  { company: "오픈워터인베스트먼트", category: "문체부 - 뉴스페이스", isJoint: false },
  { company: "에트리홀딩스", category: "문체부 - 뉴스페이스", isJoint: true },
  { company: "인터밸류파트너스", category: "문체부 - 뉴스페이스", isJoint: true },
  // 메타버스 - 5개 운용사 (4조합, 공동GP 2건)
  { company: "넥스트지인베스트먼트", category: "문체부 - 메타버스", isJoint: true },
  { company: "아일럼인베스트", category: "문체부 - 메타버스", isJoint: true },
  { company: "아이온자산운용", category: "문체부 - 메타버스", isJoint: false },
  { company: "에이티유파트너스", category: "문체부 - 메타버스", isJoint: false },
  { company: "티케인베스트먼트", category: "문체부 - 메타버스", isJoint: true },
  { company: "엘에스에스프라이빗에쿼티", category: "문체부 - 메타버스", isJoint: true },
  // 미래환경산업 - 6개 운용사 (3조합, 공동GP 3건)
  { company: "현대차증권", category: "문체부 - 미래환경산업", isJoint: true },
  { company: "인프라프론티어자산운용", category: "문체부 - 미래환경산업", isJoint: true },
  { company: "디쓰리쥬빌리파트너스", category: "문체부 - 미래환경산업", isJoint: true },
  { company: "교보증권", category: "문체부 - 미래환경산업", isJoint: true },
  { company: "노보섹인베스트먼트", category: "문체부 - 미래환경산업", isJoint: true },
  { company: "바로벤처스", category: "문체부 - 미래환경산업", isJoint: true },
  // 사회서비스 - 10개 운용사 (6조합, 공동GP 4건)
  { company: "가이아벤처파트너스", category: "문체부 - 사회서비스", isJoint: false },
  { company: "엠와이소셜컴퍼니", category: "문체부 - 사회서비스", isJoint: true },
  { company: "고려대학교기술지주", category: "문체부 - 사회서비스", isJoint: true },
  { company: "소풍벤처스", category: "문체부 - 사회서비스", isJoint: true },
  { company: "어센도벤처스", category: "문체부 - 사회서비스", isJoint: true },
  { company: "아이피파트너스", category: "문체부 - 사회서비스", isJoint: false },
  { company: "임팩트스퀘어", category: "문체부 - 사회서비스", isJoint: false },
  { company: "한국사회투자", category: "문체부 - 사회서비스", isJoint: true },
  { company: "씨엔티테크", category: "문체부 - 사회서비스", isJoint: true },
  // 해양신산업 - 10개 운용사 (6조합, 공동GP 4건)
  { company: "린벤처스", category: "문체부 - 해양신산업", isJoint: true },
  { company: "블루닷파트너스", category: "문체부 - 해양신산업", isJoint: true },
  { company: "벡터기술투자", category: "문체부 - 해양신산업", isJoint: false },
  { company: "리딩에이스캐피탈", category: "문체부 - 해양신산업", isJoint: true },
  { company: "에이스투자금융", category: "문체부 - 해양신산업", isJoint: true },
  { company: "오거스트벤처파트너스", category: "문체부 - 해양신산업", isJoint: false },
  { company: "하랑기술투자", category: "문체부 - 해양신산업", isJoint: true },
  { company: "요즈마인베스트먼트", category: "문체부 - 해양신산업", isJoint: true },
];

// 3872: 선정결과 - 19개 조합
const selectedOperators = [
  // 중저예산한국영화 - 2개
  { company: "센트럴투자파트너스", category: "문체부 - 중저예산한국영화" },
  { company: "쏠레어파트너스", category: "문체부 - 중저예산한국영화" },
  // 스포츠산업 - 1개
  { company: "인피니툼파트너스", category: "문체부 - 스포츠산업" },
  // 스포츠출발 - 2개
  { company: "상상이비즈", category: "문체부 - 스포츠출발" },
  { company: "씨엔티테크", category: "문체부 - 스포츠출발" },
  // 관광기업육성 - 4개 (공동GP 1건)
  { company: "NBH캐피탈", category: "문체부 - 관광기업육성" },
  { company: "씨엔티테크", category: "문체부 - 관광기업육성" },
  { company: "코스넷기술투자", category: "문체부 - 관광기업육성" },
  { company: "인피니툼파트너스", category: "문체부 - 관광기업육성" },
  // 국토교통혁신(일반) - 1개
  { company: "어니스트벤처스", category: "문체부 - 국토교통혁신(일반)" },
  // 사회적기업 - 1개
  { company: "엠와이소셜컴퍼니", category: "문체부 - 사회적기업" },
  // 대학창업1 - 2개 (공동GP)
  { company: "강원대학교기술지주회사", category: "문체부 - 대학창업1" },
  { company: "더존비즈온", category: "문체부 - 대학창업1" },
  // 대학창업2 - 3개
  { company: "고려대학교기술지주", category: "문체부 - 대학창업2" },
  { company: "미래과학기술지주", category: "문체부 - 대학창업2" },
  { company: "부산대학교기술지주", category: "문체부 - 대학창업2" },
  // 공공기술사업화 - 3개 (공동GP 1건)
  { company: "고려대학교기술지주", category: "문체부 - 공공기술사업화" },
  { company: "인포뱅크", category: "문체부 - 공공기술사업화" },
  { company: "비디씨엑셀러레이터", category: "문체부 - 공공기술사업화" },
  // 뉴스페이스 - 1개
  { company: "메디치인베스트먼트", category: "문체부 - 뉴스페이스" },
  // 메타버스 - 2개 (공동GP)
  { company: "티케인베스트먼트", category: "문체부 - 메타버스" },
  { company: "엘에스에스프라이빗에쿼티", category: "문체부 - 메타버스" },
  // 미래환경산업 - 2개 (공동GP)
  { company: "현대차증권", category: "문체부 - 미래환경산업" },
  { company: "인프라프론티어자산운용", category: "문체부 - 미래환경산업" },
  // 사회서비스 - 1개
  { company: "가이아벤처파트너스", category: "문체부 - 사회서비스" },
  // 해양신산업 - 없음
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3814 = await sheets.findRow("파일", "파일번호", "3814");
  const file3872 = await sheets.findRow("파일", "파일번호", "3872");
  const fileId3814 = file3814 ? file3814["ID"] : null;
  const fileId3872 = file3872 ? file3872["ID"] : null;
  console.log("파일 ID - 3814:", fileId3814, ", 3872:", fileId3872);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(문체부 등) 2023년 2차 정시 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "문체부",
    공고유형: "정시",
    연도: "2023",
    차수: "2차",
    지원파일ID: fileId3814
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

  // 5. 파일 3814 처리상태 업데이트
  if (file3814) {
    const rowIdx = file3814._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 79개, 총 신청현황 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3814 처리 완료");
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

  // 배치 업데이트 (API 할당량 고려)
  const batchSize = 20;
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

  // 7. 파일 3872 처리상태 업데이트
  if (file3872) {
    const rowIdx = file3872._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${selected + rejected}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3872 처리 완료");
  }

  // 8. 출자사업 파일 연결 및 현황 업데이트
  await sheets.updateProjectFileId(project.id, "선정결과", fileId3872);
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log("접수현황:", appsToCreate.length, "건");
  console.log("선정:", selected, "건, 탈락:", rejected, "건");
}

main().catch(console.error);
