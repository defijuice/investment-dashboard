import { GoogleSheetsClient } from "./googleSheets.js";
import { findSimilarOperators } from "./operator-matcher.js";

// 3866: 해외VC 글로벌 펀드 2023년 일반분야 접수현황 - 45개 조합 (공동GP 5건)
// 3924: 해외VC 글로벌 펀드 2023년 일반분야 선정결과 - 7개 조합 선정 (공동GP 1건)

const applications = [
  // 미국 - 15개 조합 (공동GP 2건)
  { company: "DCM", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "KRS Ventures", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "Nautilus", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "SOSV", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "Whitestar Capital", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "The Gate Technologies", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "G Squared", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "Life Sci", category: "해외VC - 일반(미국)", isJoint: false },
  // 공동GP: Valuence Capital + 클레어보이언트벤처스
  { company: "Valuence Capital", category: "해외VC - 일반(미국)", isJoint: true },
  { company: "클레어보이언트벤처스", category: "해외VC - 일반(미국)", isJoint: true },
  { company: "Interface", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "Plug & Play", category: "해외VC - 일반(미국)", isJoint: false },
  { company: "Strong Ventures", category: "해외VC - 일반(미국)", isJoint: false },
  // 공동GP: Ataraxia + Aster COOP + NextG인베스트먼트
  { company: "Ataraxia", category: "해외VC - 일반(미국)", isJoint: true },
  { company: "Aster COOP", category: "해외VC - 일반(미국)", isJoint: true },
  { company: "NextG인베스트먼트", category: "해외VC - 일반(미국)", isJoint: true },

  // 유럽/중동 - 11개 조합
  { company: "Future Energy Ventures", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "Kurma Partners", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "Ourcrowd", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "Partech", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "Talis Capital", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "Nordstar Capital", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "DTCP", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "Brightstar", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "Greyhound Capital", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "SparkLabs", category: "해외VC - 일반(유럽/중동)", isJoint: false },
  { company: "Alpha Intelligence Capital", category: "해외VC - 일반(유럽/중동)", isJoint: false },

  // 아시아 - 22개 조합 (공동GP 3건)
  { company: "Gradient Capital Advisors Singapore", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Oceanpine Capital", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Round Ventures", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "ACV Ventures", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Access", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Quest Ventures", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Siguler Guff", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Mirae Asset", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Delta Capital", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "SL Capital", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Velocity Ventures", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Tin Men Capital", category: "해외VC - 일반(아시아)", isJoint: false },
  // 공동GP: VSV + 롯데벤처스
  { company: "VSV", category: "해외VC - 일반(아시아)", isJoint: true },
  { company: "롯데벤처스", category: "해외VC - 일반(아시아)", isJoint: true },
  { company: "CICC Ascent", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Pacific Bays", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Farquhar Capital", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Headline Asia", category: "해외VC - 일반(아시아)", isJoint: false },
  { company: "Karrin Associates Pte Ltd", category: "해외VC - 일반(아시아)", isJoint: false },
  // 공동GP: MDI + KB인베스트먼트
  { company: "MDI", category: "해외VC - 일반(아시아)", isJoint: true },
  { company: "KB인베스트먼트", category: "해외VC - 일반(아시아)", isJoint: true },
  // 공동GP: KK Investment + ES인베스터
  { company: "KK Investment", category: "해외VC - 일반(아시아)", isJoint: true },
  { company: "ES인베스터", category: "해외VC - 일반(아시아)", isJoint: true },
  { company: "Capria Ventures", category: "해외VC - 일반(아시아)", isJoint: false },
];

// 선정된 운용사 (분야별) - 7개 조합
const selectedOperators = new Set([
  // 미국 - 3개
  "DCM|해외VC - 일반(미국)",
  "SOSV|해외VC - 일반(미국)",
  "G Squared|해외VC - 일반(미국)",
  // 유럽/중동 - 2개
  "Kurma Partners|해외VC - 일반(유럽/중동)",
  "Greyhound Capital|해외VC - 일반(유럽/중동)",
  // 아시아 - 2개 (공동GP 1건)
  "Headline Asia|해외VC - 일반(아시아)",
  "MDI|해외VC - 일반(아시아)",
  "KB인베스트먼트|해외VC - 일반(아시아)",
]);

async function main() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 ID 조회
  const file3866 = await sheets.findRow("파일", "파일번호", "3866");
  const file3924 = await sheets.findRow("파일", "파일번호", "3924");
  const fileId3866 = file3866 ? file3866["ID"] : null;
  const fileId3924 = file3924 ? file3924["ID"] : null;
  console.log("파일 ID - 3866 (접수):", fileId3866);
  console.log("파일 ID - 3924 (선정):", fileId3924);

  // 2. 출자사업 생성/조회
  const projectName = "해외VC 글로벌 펀드 2023년 일반분야 출자사업";
  const project = await sheets.getOrCreateProject(projectName, {
    소관: "해외VC",
    공고유형: "정시",
    연도: "2023",
    차수: "",
    지원파일ID: fileId3866,
    결과파일ID: fileId3924
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
  if (file3866) {
    const rowIdx = file3866._rowIndex;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `신청조합 45개 (공동GP 5건), 총 ${appsToCreate.length}건`
    ]]);
    console.log("파일 3866 처리 완료");
  }

  if (file3924) {
    const rowIdx = file3924._rowIndex;
    const selected = appsToCreate.filter(a => a.상태 === "선정").length;
    await sheets.setValues(`파일!F${rowIdx}:I${rowIdx}`, [[
      "완료",
      new Date().toISOString(),
      "",
      `총 ${appsToCreate.length}개 중 선정 ${selected}건`
    ]]);
    console.log("파일 3924 처리 완료");
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
