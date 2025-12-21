import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3901: 지역엔젤투자 재간접펀드 2023년 1차 접수현황 - 35개 조합 (공동GP 다수)
// 3944: 지역엔젤투자 재간접펀드 2023년 1차 선정결과 - 8개 조합 선정 (공동GP 2건)

const applications = [
  // 개별 신청
  { company: "JB벤처스", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "강원창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  // 공동GP: 노틸러스인베스트먼트 + 경북창조경제혁신센터
  { company: "노틸러스인베스트먼트", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "경북창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "뉴본벤처스", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "대경지역대학공동기술지주", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "리벤처스", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  // 공동GP: 미래과학기술지주 + 대전창조경제혁신센터
  { company: "미래과학기술지주", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "대전창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  // 공동GP: 벤처포트 + 강원대학교기술지주회사
  { company: "벤처포트", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "강원대학교기술지주회사", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "부산창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "비스퀘어", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "선보엔젤파트너스", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  // 공동GP: 스마트파머 + 토탈소프트뱅크
  { company: "스마트파머", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "토탈소프트뱅크", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  // 공동GP: 시리즈벤처스 + 부산지역대학연합기술지주 (선정)
  { company: "시리즈벤처스", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "부산지역대학연합기술지주", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "씨엔티테크", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "최성호", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "아이파트너즈", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  // 공동GP: 에이티피벤처스 + 유니스트기술지주
  { company: "에이티피벤처스", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "유니스트기술지주", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "엑센트리벤처스", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "와이앤아처", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  // 공동GP: 인포뱅크 + 대구창조경제혁신센터 (선정)
  { company: "인포뱅크", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "대구창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  // 공동GP: 전남대학교기술지주회사 + 광주창조경제혁신센터
  { company: "전남대학교기술지주회사", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "광주창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  // 공동GP: 전북지역대학연합기술지주 + 원투자파트너스
  { company: "전북지역대학연합기술지주", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "원투자파트너스", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  // 공동GP: 제이씨에이치인베스트먼트 + 오픈놀
  { company: "제이씨에이치인베스트먼트", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "오픈놀", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "제이엔피글로벌", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  // 공동GP: 제주창조경제혁신센터 + 비전벤처파트너스
  { company: "제주창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "비전벤처파트너스", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "제피러스랩", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  // 공동GP: 충남창조경제혁신센터 + 에이비엘기술사업협동조합
  { company: "충남창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "에이비엘기술사업협동조합", category: "지역엔젤 - 지역엔젤투자", isJoint: true },
  { company: "카이트창업가재단", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "컴퍼니엑스", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "코벤트캐피탈파트너스", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "콜즈다이나믹스", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "크립톤", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "킹고스프링", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "특허법인지원", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "파트너스라운지", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
  { company: "포항연합기술지주", category: "지역엔젤 - 지역엔젤투자", isJoint: false },
];

// 선정된 운용사 (8개 조합, 공동GP 2건)
const selectedOperators = new Set([
  "JB벤처스|지역엔젤 - 지역엔젤투자",
  "강원창조경제혁신센터|지역엔젤 - 지역엔젤투자",
  "리벤처스|지역엔젤 - 지역엔젤투자",
  "선보엔젤파트너스|지역엔젤 - 지역엔젤투자",
  // 공동GP: 시리즈벤처스 + 부산지역대학연합기술지주
  "시리즈벤처스|지역엔젤 - 지역엔젤투자",
  "부산지역대학연합기술지주|지역엔젤 - 지역엔젤투자",
  "아이파트너즈|지역엔젤 - 지역엔젤투자",
  "와이앤아처|지역엔젤 - 지역엔젤투자",
  // 공동GP: 인포뱅크 + 대구창조경제혁신센터
  "인포뱅크|지역엔젤 - 지역엔젤투자",
  "대구창조경제혁신센터|지역엔젤 - 지역엔젤투자",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3901 = await sheets.findRow("파일", "파일번호", "3901");
  const file3944 = await sheets.findRow("파일", "파일번호", "3944");
  const fileId3901 = file3901 ? file3901["ID"] : null;
  const fileId3944 = file3944 ? file3944["ID"] : null;
  console.log("파일 ID - 3901 (접수):", fileId3901);
  console.log("파일 ID - 3944 (선정):", fileId3944);

  // 2. 출자사업 생성/조회
  const projectName = "지역엔젤투자 재간접펀드 2023년 1차 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "지역엔젤",
    공고유형: "정시",
    연도: "2023",
    차수: "1차",
    지원파일ID: fileId3901,
    결과파일ID: fileId3944
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
    // 배치 처리 (20개씩)
    for (let i = 0; i < appsToCreate.length; i += 20) {
      const batch = appsToCreate.slice(i, i + 20);
      await sheets.createApplicationsBatch(batch);
      if (i + 20 < appsToCreate.length) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    const rejected = appsToCreate.filter(a => a.상태 === "탈락").length;
    console.log(`신청현황 생성: ${appsToCreate.length}건 (선정: ${selected}, 탈락: ${rejected})`);
  }

  if (missingOps.length > 0) {
    console.log("운용사 ID 없음:", [...new Set(missingOps)].join(", "));
  }

  // 5. 파일 처리상태 업데이트
  if (file3901) {
    const rowIdx = file3901._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 35개 (공동GP 다수), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3901 처리 완료");
  }

  if (file3944) {
    const rowIdx = file3944._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3944 처리 완료");
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
