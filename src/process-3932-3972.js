import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3932: 지역엔젤투자 재간접펀드 2023년 2차 접수현황 - 14개 조합 (공동GP 다수)
// 3972: 지역엔젤투자 재간접펀드 2023년 2차 선정결과 - 5개 조합 선정

const applications = [
  // 충청북도 - 3개 조합 (공동GP 2건)
  { company: "뉴본벤처스", category: "지역엔젤 - 지역엔젤투자(충청북도)", isJoint: false },
  // 공동GP: 로우파트너스 + 충남대학교기술지주 (선정)
  { company: "로우파트너스", category: "지역엔젤 - 지역엔젤투자(충청북도)", isJoint: true },
  { company: "충남대학교기술지주", category: "지역엔젤 - 지역엔젤투자(충청북도)", isJoint: true },
  // 공동GP: 젠엑시스 + 충북창조경제혁신센터 + 알파브라더스
  { company: "젠엑시스", category: "지역엔젤 - 지역엔젤투자(충청북도)", isJoint: true },
  { company: "충북창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자(충청북도)", isJoint: true },
  { company: "알파브라더스", category: "지역엔젤 - 지역엔젤투자(충청북도)", isJoint: true },

  // 전라북도 - 6개 조합 (공동GP 2건)
  // 공동GP: 엠와이소셜컴퍼니 + 전북창조경제혁신센터 (선정)
  { company: "엠와이소셜컴퍼니", category: "지역엔젤 - 지역엔젤투자(전라북도)", isJoint: true },
  { company: "전북창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자(전라북도)", isJoint: true },
  { company: "와이앤아처", category: "지역엔젤 - 지역엔젤투자(전라북도)", isJoint: false },
  { company: "원투자파트너스", category: "지역엔젤 - 지역엔젤투자(전라북도)", isJoint: false },
  // 공동GP: 인포뱅크 + 전북대학교기술지주회사
  { company: "인포뱅크", category: "지역엔젤 - 지역엔젤투자(전라북도)", isJoint: true },
  { company: "전북대학교기술지주회사", category: "지역엔젤 - 지역엔젤투자(전라북도)", isJoint: true },
  { company: "전북지역대학연합기술지주", category: "지역엔젤 - 지역엔젤투자(전라북도)", isJoint: false },
  { company: "파트너스라운지", category: "지역엔젤 - 지역엔젤투자(전라북도)", isJoint: false },

  // 세종시 - 5개 조합 (공동GP 2건)
  // 공동GP: 고려대학교기술지주 + 세종창조경제혁신센터
  { company: "고려대학교기술지주", category: "지역엔젤 - 지역엔젤투자(세종시)", isJoint: true },
  { company: "세종창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자(세종시)", isJoint: true },
  { company: "제이엔피글로벌", category: "지역엔젤 - 지역엔젤투자(세종시)", isJoint: false },
  { company: "충남창조경제혁신센터", category: "지역엔젤 - 지역엔젤투자(세종시)", isJoint: false },
  { company: "컴퍼니에이", category: "지역엔젤 - 지역엔젤투자(세종시)", isJoint: false },
  // 공동GP: 컴퍼니엑스 + 히스토리액트원
  { company: "컴퍼니엑스", category: "지역엔젤 - 지역엔젤투자(세종시)", isJoint: true },
  { company: "히스토리액트원", category: "지역엔젤 - 지역엔젤투자(세종시)", isJoint: true },
];

// 선정된 운용사 (5개 조합)
const selectedOperators = new Set([
  // 충청북도 - 1개 조합 (공동GP)
  "로우파트너스|지역엔젤 - 지역엔젤투자(충청북도)",
  "충남대학교기술지주|지역엔젤 - 지역엔젤투자(충청북도)",
  // 전라북도 - 2개 조합 (공동GP 1건)
  "엠와이소셜컴퍼니|지역엔젤 - 지역엔젤투자(전라북도)",
  "전북창조경제혁신센터|지역엔젤 - 지역엔젤투자(전라북도)",
  "전북지역대학연합기술지주|지역엔젤 - 지역엔젤투자(전라북도)",
  // 세종시 - 2개 조합
  "제이엔피글로벌|지역엔젤 - 지역엔젤투자(세종시)",
  "컴퍼니에이|지역엔젤 - 지역엔젤투자(세종시)",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3932 = await sheets.findRow("파일", "파일번호", "3932");
  const file3972 = await sheets.findRow("파일", "파일번호", "3972");
  const fileId3932 = file3932 ? file3932["ID"] : null;
  const fileId3972 = file3972 ? file3972["ID"] : null;
  console.log("파일 ID - 3932 (접수):", fileId3932);
  console.log("파일 ID - 3972 (선정):", fileId3972);

  // 2. 출자사업 생성/조회
  const projectName = "지역엔젤투자 재간접펀드 2023년 2차 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "지역엔젤",
    공고유형: "정시",
    연도: "2023",
    차수: "2차",
    지원파일ID: fileId3932,
    결과파일ID: fileId3972
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
    await sheets.createApplicationsBatch(appsToCreate);
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    const rejected = appsToCreate.filter(a => a.상태 === "탈락").length;
    console.log(`신청현황 생성: ${appsToCreate.length}건 (선정: ${selected}, 탈락: ${rejected})`);
  }

  if (missingOps.length > 0) {
    console.log("운용사 ID 없음:", [...new Set(missingOps)].join(", "));
  }

  // 5. 파일 처리상태 업데이트
  if (file3932) {
    const rowIdx = file3932._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 14개 (공동GP 다수), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3932 처리 완료");
  }

  if (file3972) {
    const rowIdx = file3972._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3972 처리 완료");
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
