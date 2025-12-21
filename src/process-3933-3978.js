import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3933: 지역혁신 벤처펀드 2023년 접수현황 (충청, 부산, 대구·제주·광주) - 23개 조합
// 3978: 지역혁신 벤처펀드 2023년 선정결과 - 6개 조합 선정

const applications = [
  // 충청 지역혁신 - 대전/충남 - 3개 조합 (공동GP 1건)
  { company: "씨케이디창업투자", category: "지역혁신 - 충청(대전/충남)", isJoint: false },
  // 공동GP: 오픈워터인베스트먼트 + 에이치지이니셔티브
  { company: "오픈워터인베스트먼트", category: "지역혁신 - 충청(대전/충남)", isJoint: true },
  { company: "에이치지이니셔티브", category: "지역혁신 - 충청(대전/충남)", isJoint: true },
  { company: "지앤텍벤처투자", category: "지역혁신 - 충청(대전/충남)", isJoint: false },

  // 충청 지역혁신 - 세종/충북 - 4개 조합 (공동GP 1건)
  { company: "동문파트너즈", category: "지역혁신 - 충청(세종/충북)", isJoint: false },
  { company: "마그나인베스트먼트", category: "지역혁신 - 충청(세종/충북)", isJoint: false },
  { company: "심본투자파트너스", category: "지역혁신 - 충청(세종/충북)", isJoint: false },
  // 공동GP: 엑스퀘어드 + 충북창조경제혁신센터
  { company: "엑스퀘어드", category: "지역혁신 - 충청(세종/충북)", isJoint: true },
  { company: "충북창조경제혁신센터", category: "지역혁신 - 충청(세종/충북)", isJoint: true },

  // 부산 지역혁신 - 9개 조합 (공동GP 3건)
  { company: "경남벤처투자", category: "지역혁신 - 부산", isJoint: false },
  { company: "동문파트너즈", category: "지역혁신 - 부산", isJoint: false },
  { company: "메이플투자파트너스", category: "지역혁신 - 부산", isJoint: false },
  { company: "비엔케이벤처투자", category: "지역혁신 - 부산", isJoint: false },
  // 공동GP: 오거스트벤처파트너스 + 티움투자파트너즈
  { company: "오거스트벤처파트너스", category: "지역혁신 - 부산", isJoint: true },
  { company: "티움투자파트너즈", category: "지역혁신 - 부산", isJoint: true },
  // 공동GP: 지앤텍벤처투자 + 플럭스벤처스
  { company: "지앤텍벤처투자", category: "지역혁신 - 부산", isJoint: true },
  { company: "플럭스벤처스", category: "지역혁신 - 부산", isJoint: true },
  { company: "케이브릿지인베스트먼트", category: "지역혁신 - 부산", isJoint: false },
  // 공동GP: 케이앤투자파트너스 + 산은캐피탈 (선정)
  { company: "케이앤투자파트너스", category: "지역혁신 - 부산", isJoint: true },
  { company: "산은캐피탈", category: "지역혁신 - 부산", isJoint: true },
  { company: "티케이지벤처스", category: "지역혁신 - 부산", isJoint: false },

  // 대구·제주·광주 지역혁신 - 7개 조합 (공동GP 5건)
  // 공동GP: 메디치인베스트먼트 + 디엔파트너스
  { company: "메디치인베스트먼트", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  { company: "디엔파트너스", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  { company: "심본투자파트너스", category: "지역혁신 - 대구·제주·광주", isJoint: false },
  // 공동GP: 오거스트벤처파트너스 + 린벤처스
  { company: "오거스트벤처파트너스", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  { company: "린벤처스", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  // 공동GP: 와이앤아처 + 삼익매츠벤처스
  { company: "와이앤아처", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  { company: "삼익매츠벤처스", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  // 공동GP: 제이씨에이치인베스트먼트 + 트라이앵글파트너스 (선정)
  { company: "제이씨에이치인베스트먼트", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  { company: "트라이앵글파트너스", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  // 공동GP: 펜타스톤인베스트먼트 + 비엠벤처스
  { company: "펜타스톤인베스트먼트", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  { company: "비엠벤처스", category: "지역혁신 - 대구·제주·광주", isJoint: true },
  { company: "플랜에이치벤처스", category: "지역혁신 - 대구·제주·광주", isJoint: false },
];

// 선정된 운용사 (6개 조합)
const selectedOperators = new Set([
  // 충청 - 대전/충남
  "지앤텍벤처투자|지역혁신 - 충청(대전/충남)",
  // 충청 - 세종/충북
  "동문파트너즈|지역혁신 - 충청(세종/충북)",
  // 부산 - 2개
  "비엔케이벤처투자|지역혁신 - 부산",
  "케이앤투자파트너스|지역혁신 - 부산",
  "산은캐피탈|지역혁신 - 부산",
  // 대구·제주·광주 - 2개
  "심본투자파트너스|지역혁신 - 대구·제주·광주",
  "제이씨에이치인베스트먼트|지역혁신 - 대구·제주·광주",
  "트라이앵글파트너스|지역혁신 - 대구·제주·광주",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3933 = await sheets.findRow("파일", "파일번호", "3933");
  const file3978 = await sheets.findRow("파일", "파일번호", "3978");
  const fileId3933 = file3933 ? file3933["ID"] : null;
  const fileId3978 = file3978 ? file3978["ID"] : null;
  console.log("파일 ID - 3933 (접수):", fileId3933);
  console.log("파일 ID - 3978 (선정):", fileId3978);

  // 2. 출자사업 생성/조회
  const projectName = "지역혁신 벤처펀드(충청, 부산, 대구·제주·광주) 2023년 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "지역혁신",
    공고유형: "정시",
    연도: "2023",
    차수: "",
    지원파일ID: fileId3933,
    결과파일ID: fileId3978
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
  if (file3933) {
    const rowIdx = file3933._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 23개 (공동GP 다수), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3933 처리 완료");
  }

  if (file3978) {
    const rowIdx = file3978._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3978 처리 완료");
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
