import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 4072: 중기부 2024년 1차 정시 지역분야 접수현황 - 41개 조합 (공동GP 다수)
// 선정결과 파일 없음 - 접수 상태로 저장

const applications = [
  // 지역 창업초기 분야 (29개 신청)
  { company: "강원대학교기술지주회사", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 경남창조경제혁신센터 / 코업파트너스
  { company: "경남창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: true },
  { company: "코업파트너스", category: "지방 - 지역창업초기", isJoint: true },
  { company: "경북창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 광주지역대학연합기술지주 / 부산지역대학연합기술지주
  { company: "광주지역대학연합기술지주", category: "지방 - 지역창업초기", isJoint: true },
  { company: "부산지역대학연합기술지주", category: "지방 - 지역창업초기", isJoint: true },
  { company: "광주창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 대경지역대학공동기술지주 / 와이앤아처
  { company: "대경지역대학공동기술지주", category: "지방 - 지역창업초기", isJoint: true },
  { company: "와이앤아처", category: "지방 - 지역창업초기", isJoint: true },
  // 공동GP: 대구창조경제혁신센터 / 노틸러스인베스트먼트
  { company: "대구창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: true },
  { company: "노틸러스인베스트먼트", category: "지방 - 지역창업초기", isJoint: true },
  { company: "머스트액셀러레이터", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 미래과학기술지주 / 대전창조경제혁신센터
  { company: "미래과학기술지주", category: "지방 - 지역창업초기", isJoint: true },
  { company: "대전창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: true },
  { company: "부산창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: false },
  { company: "블루오션벤처스", category: "지방 - 지역창업초기", isJoint: false },
  { company: "블리스바인벤처스", category: "지방 - 지역창업초기", isJoint: false },
  { company: "비스퀘어", category: "지방 - 지역창업초기", isJoint: false },
  { company: "스마트파머", category: "지방 - 지역창업초기", isJoint: false },
  { company: "시리즈벤처스", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 엠와이소셜컴퍼니 / 제주창조경제혁신센터
  { company: "엠와이소셜컴퍼니", category: "지방 - 지역창업초기", isJoint: true },
  { company: "제주창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: true },
  { company: "울산창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 원투자파트너스 / 로우파트너스
  { company: "원투자파트너스", category: "지방 - 지역창업초기", isJoint: true },
  { company: "로우파트너스", category: "지방 - 지역창업초기", isJoint: true },
  { company: "유니스트기술지주", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 전남대학교기술지주회사 / 전남지역대학연합창업기술지주
  { company: "전남대학교기술지주회사", category: "지방 - 지역창업초기", isJoint: true },
  { company: "전남지역대학연합창업기술지주", category: "지방 - 지역창업초기", isJoint: true },
  // 공동GP: 제이엔피글로벌 / 세종창조경제혁신센터
  { company: "제이엔피글로벌", category: "지방 - 지역창업초기", isJoint: true },
  { company: "세종창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: true },
  { company: "제피러스랩", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 충남창조경제혁신센터 / 비전벤처파트너스
  { company: "충남창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: true },
  { company: "비전벤처파트너스", category: "지방 - 지역창업초기", isJoint: true },
  { company: "충북창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: false },
  // 공동GP: 컴퍼니엑스 / 히스토리벤처투자
  { company: "컴퍼니엑스", category: "지방 - 지역창업초기", isJoint: true },
  { company: "히스토리벤처투자", category: "지방 - 지역창업초기", isJoint: true },
  // 공동GP: 크립톤 / 전북창조경제혁신센터
  { company: "크립톤", category: "지방 - 지역창업초기", isJoint: true },
  { company: "전북창조경제혁신센터", category: "지방 - 지역창업초기", isJoint: true },
  // 공동GP: 킹고스프링 / 카이스트홀딩스
  { company: "킹고스프링", category: "지방 - 지역창업초기", isJoint: true },
  { company: "카이스트홀딩스", category: "지방 - 지역창업초기", isJoint: true },
  { company: "파트너스라운지", category: "지방 - 지역창업초기", isJoint: false },
  { company: "포항연합기술지주", category: "지방 - 지역창업초기", isJoint: false },
  { company: "한국과학기술지주", category: "지방 - 지역창업초기", isJoint: false },
  { company: "한림대학교기술지주", category: "지방 - 지역창업초기", isJoint: false },

  // 라이콘 분야 (6개 신청)
  // 공동GP: 로우파트너스 / 충남대학교기술지주
  { company: "로우파트너스", category: "지방 - 라이콘", isJoint: true },
  { company: "충남대학교기술지주", category: "지방 - 라이콘", isJoint: true },
  { company: "시리즈벤처스", category: "지방 - 라이콘", isJoint: false },
  { company: "어번데일벤처스", category: "지방 - 라이콘", isJoint: false },
  { company: "와디즈파트너스", category: "지방 - 라이콘", isJoint: false },
  { company: "와이앤아처", category: "지방 - 라이콘", isJoint: false },
  { company: "웰컴벤처스", category: "지방 - 라이콘", isJoint: false },

  // 지역AC세컨더리 분야 (4개 신청)
  { company: "라이징에스벤처스", category: "지방 - 지역AC세컨더리", isJoint: false },
  { company: "미래과학기술지주", category: "지방 - 지역AC세컨더리", isJoint: false },
  // 공동GP: 이크럭스벤처파트너스 / 원투자파트너스
  { company: "이크럭스벤처파트너스", category: "지방 - 지역AC세컨더리", isJoint: true },
  { company: "원투자파트너스", category: "지방 - 지역AC세컨더리", isJoint: true },
  { company: "파트너스라운지", category: "지방 - 지역AC세컨더리", isJoint: false },
];

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file4072 = await sheets.findRow("파일", "파일번호", "4072");
  const fileId4072 = file4072 ? file4072["ID"] : null;
  console.log("파일 ID - 4072 (접수):", fileId4072);

  // 2. 출자사업 생성/조회
  const projectName = "한국모태펀드(중기부) 2024년 1차 정시 지역분야 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "중기부",
    공고유형: "정시",
    연도: "2024",
    차수: "1차",
    지원파일ID: fileId4072,
    결과파일ID: null
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
      // 배치 처리 (15개씩)
      for (let i = 0; i < toCreate.length; i += 15) {
        const batch = toCreate.slice(i, i + 15);
        const nameToIdMap = await sheets.createOperatorsBatch(batch);
        for (const [name, id] of nameToIdMap) {
          operatorMap.set(name, id);
        }
        if (i + 15 < toCreate.length) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      console.log("신규 운용사 등록:", toCreate.length, "개");
    }
  }

  // 4. 신청현황 생성 (접수 상태로)
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
      상태: "접수",  // 선정결과 없으므로 접수 상태
      비고: app.isJoint ? "공동GP" : ""
    });
  }

  if (appsToCreate.length > 0) {
    // 배치 처리 (20개씩)
    for (let i = 0; i < appsToCreate.length; i += 20) {
      const batch = appsToCreate.slice(i, i + 20);
      await sheets.createApplicationsBatch(batch);
      if (i + 20 < appsToCreate.length) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    console.log(`신청현황 생성: ${appsToCreate.length}건 (모두 접수 상태)`);
  }

  if (missingOps.length > 0) {
    console.log("운용사 ID 없음:", [...new Set(missingOps)].join(", "));
  }

  // 5. 파일 처리상태 업데이트
  if (file4072) {
    const rowIdx = file4072._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 41개 (공동GP 다수), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 4072 처리 완료");
  }

  // 6. 출자사업 현황 업데이트
  await sheets.updateProjectStatus(project.id);

  console.log("");
  console.log("=== 처리 완료 ===");
  console.log("출자사업:", project.id);
  console.log(`신청현황: ${appsToCreate.length}건 (모두 접수 상태)`);
}

main().catch(console.error);
