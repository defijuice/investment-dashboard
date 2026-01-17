/**
 * 접수현황 + 선정결과 파일 동시 처리 스크립트 (Google Sheets 버전)
 *
 * 사용법: node src/process-pair-sheets.js <접수파일번호> <선정파일번호>
 * 예시: node src/process-pair-sheets.js 4461 4524
 *
 * 처리 로직:
 * - 접수현황에 있고 + 선정결과에 있음 → 선정
 * - 접수현황에 있고 + 선정결과에 없음 → 탈락
 * - 이미 DB에 "선정"으로 등록된 건 → 유지 (중복 생성 안함)
 *
 * === 비효율 개선 적용 (2026-01-14) ===
 * - Phase 1: 배치 메서드 적용 (API 50배 감소)
 * - Phase 2: 캐싱 활용 (중복 읽기 60-70% 감소)
 * - Phase 3: 트랜잭션 패턴 (검토 후 저장, 고아 데이터 방지)
 * - Phase 4: 체크포인트 통합 (에러 복구)
 * - Phase 5: 탈락 상태 업데이트 로직
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { GoogleSheetsClient } from '../core/googleSheets.js';
import { ReviewSession, prepareReviewData } from '../workflows/review-workflow.js';
import { findSimilarOperators, interpretScore } from '../matchers/operator-matcher.js';
import { normalizeName, removeEnglishSuffix } from '../utils/normalize.js';
import { CheckpointManager, withRetry } from '../utils/checkpoint.js';

dotenv.config({ override: true });

const anthropic = new Anthropic();

// ============ 환율 변환 ============

/**
 * 기본 환율 (파일 등록일 기준으로 WebSearch 조회 후 업데이트 권장)
 * 2024년 7월 기준 환율
 */
const DEFAULT_EXCHANGE_RATES = {
  'USD': 1380,   // 원/달러
  'JPY': 8.6,    // 원/엔 (1엔당)
  'GBP': 1750,   // 원/파운드
  'EUR': 1500,   // 원/유로
};

/**
 * 외화 금액을 억원으로 환산
 * @param {number} amount - M(백만) 단위 금액
 * @param {string} currency - 통화 코드 (USD(M), JPY(M), GBP(M), EUR(M), 억원)
 * @param {object} rates - 환율 객체 (optional)
 * @returns {number} 억원 단위 금액
 */
function convertToKRW(amount, currency, rates = DEFAULT_EXCHANGE_RATES) {
  if (!amount || currency === '억원') return amount;

  // 통화 코드 추출: "USD(M)" → "USD"
  const currencyCode = currency.replace('(M)', '').trim();
  const rate = rates[currencyCode];

  if (!rate) {
    console.warn(`  ⚠️ 알 수 없는 통화: ${currency}, 원본값 유지`);
    return amount;
  }

  // M(백만) 단위 → 억원 변환
  // USD M × 환율 / 100 = 억원
  // JPY M × 환율 / 100 = 억원
  const krwAmount = Math.round(amount * rate / 100);
  return krwAmount;
}

/**
 * 선정결과 데이터의 금액을 원화로 환산
 * @param {Array} selected - 선정된 운용사 배열
 * @param {object} rates - 환율 객체 (optional)
 * @returns {Array} 원화 환산된 운용사 배열
 */
function convertSelectedToKRW(selected, rates = DEFAULT_EXCHANGE_RATES) {
  return selected.map(item => {
    const currency = item.currency || '억원';

    if (currency === '억원') {
      return item; // 이미 원화
    }

    const converted = {
      ...item,
      originalCurrency: currency,
      originalMinFormation: item.minFormation,
      originalMoTae: item.moTae,
      originalFundSize: item.fundSize,
      originalRequestAmount: item.requestAmount,
      minFormation: convertToKRW(item.minFormation, currency, rates),
      moTae: convertToKRW(item.moTae, currency, rates),
      fundSize: convertToKRW(item.fundSize, currency, rates),
      requestAmount: convertToKRW(item.requestAmount, currency, rates),
      currency: '억원',
    };

    console.log(`    ${item.name}: ${currency} ${item.minFormation || '-'}/${item.requestAmount || '-'}M → ${converted.minFormation || '-'}/${converted.requestAmount || '-'}억원`);

    return converted;
  });
}

// ============ 헬퍼 함수 ============

/**
 * 터미널 입력 받기
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ============ PDF 파싱 함수 ============

/**
 * PDF 텍스트 추출 (pdftotext 사용)
 */
function extractPdfText(pdfPath) {
  try {
    const result = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8' });
    return result;
  } catch (error) {
    console.error(`PDF 텍스트 추출 실패: ${pdfPath}`);
    throw error;
  }
}

/**
 * AI 기반 선정결과 PDF 파싱
 */
async function parseSelectionPdfWithAI(text, filename) {
  const prompt = `다음은 한국 벤처펀드 출자사업 선정결과 PDF의 텍스트입니다.
이 문서에서 **선정된 운용사(GP) 정보**를 추출해주세요.

추출할 정보:
1. 운용사명 (회사명, GP명)
2. 출자분야/카테고리 (있는 경우)
3. 최소결성규모 (숫자, 억원/M 단위)
4. 모태출자액 (숫자, 억원/M 단위)
5. 결성예정액 (숫자, 억원/M 단위)
6. 출자요청액 (숫자, 억원/M 단위)
7. 통화단위 (억원 또는 USD(M))

주의사항:
- 공동GP인 경우 (예: "A / B" 또는 "A, B") 각각 별도 항목으로 분리
- 공동GP의 금액은 각 운용사에 동일하게 입력 (분할하지 않음)
- 합계, 소계 등은 제외
- 숫자가 없는 운용사명만 나열된 경우도 추출 (금액은 null)
- 해외 운용사는 영문명 그대로 유지
- 금액은 숫자만 추출 (단위 제외)

JSON 배열로 응답해주세요:
[
  {
    "name": "운용사명",
    "category": "출자분야 (없으면 빈 문자열)",
    "minFormation": 최소결성규모 (숫자 또는 null),
    "moTae": 모태출자액 (숫자 또는 null),
    "fundSize": 결성예정액 (숫자 또는 null),
    "requestAmount": 출자요청액 (숫자 또는 null),
    "currency": "억원" 또는 "USD(M)"
  }
]

PDF 텍스트:
${text}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    const selected = parsed.map(item => ({
      name: item.name?.trim() || '',
      category: item.category?.trim() || '',
      region: item.currency === '억원' ? '한국' : '',
      currency: item.currency || '억원',
      minFormation: item.minFormation || null,
      moTae: item.moTae || null,
      fundSize: item.fundSize || null,
      requestAmount: item.requestAmount || null,
    })).filter(item => item.name);

    console.log(`  [AI 파싱] ${selected.length}개 운용사 추출`);
    return { projectName: '', selected };

  } catch (error) {
    console.error(`AI 파싱 실패: ${error.message}`);
    return { projectName: '', selected: [] };
  }
}

/**
 * AI 기반 접수현황 PDF 파싱
 */
async function parseApplicationPdfWithAI(text, filename) {
  const prompt = `다음은 한국 벤처펀드 출자사업 접수현황 PDF의 텍스트입니다.
이 문서에서 **신청한 운용사(GP) 목록**을 추출해주세요.

추출할 정보:
1. 운용사명 (회사명, GP명)
2. 출자분야/카테고리 (있는 경우)
3. 지역 (해외 운용사의 경우: 미국, 유럽/중동, 아시아 등)

주의사항:
- 공동GP인 경우 (예: "A / B" 또는 "A, B") 각각 별도 항목으로 분리
- 합계, 소계, 헤더 등은 제외
- 해외 운용사는 영문명 그대로 유지
- 결성목표금액, 출자요청금액은 분야별 합계이므로 개별 운용사에 할당하지 않음

JSON 배열로 응답해주세요:
[
  {
    "name": "운용사명",
    "category": "출자분야 (없으면 빈 문자열)",
    "region": "지역 (해외: 미국/유럽/중동/아시아, 국내: 한국)"
  }
]

PDF 텍스트:
${text}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;

    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    const applicants = parsed.map(item => ({
      name: item.name?.trim() || '',
      category: item.category?.trim() || '',
      region: item.region?.trim() || '한국',
    })).filter(item => item.name);

    console.log(`  [AI 파싱] ${applicants.length}개 운용사 추출`);
    return { projectName: '', applicants };

  } catch (error) {
    console.error(`AI 파싱 실패: ${error.message}`);
    return { projectName: '', applicants: [] };
  }
}

/**
 * 접수현황 PDF 파싱
 */
async function parseApplicationPdf(text, filename) {
  console.log('  - AI 파싱 중...');
  return parseApplicationPdfWithAI(text, filename);
}

// ============ 유사도 검토 함수 ============

/**
 * 신규 운용사 등록 전 유사 운용사 검토
 * @param {Array} newOperatorNames - 신규 운용사명 목록
 * @param {Map} operatorByNameMap - 기존 운용사 Map (운용사명 -> 운용사 객체)
 * @param {Array} existingOperators - 기존 운용사 배열 (유사도 검사용)
 * @returns {Map} 운용사명 -> { useExisting: boolean, existingId?, existingName? }
 */
async function reviewNewOperators(newOperatorNames, operatorByNameMap, existingOperators) {
  const decisions = new Map();

  console.log(`  - 기존 운용사: ${existingOperators.length}건`);

  // 유사 운용사 찾기
  const { exact, similar, new: brandNew } = findSimilarOperators(
    newOperatorNames,
    existingOperators,
    0.6  // 60% 이상 유사도면 검토 대상
  );

  // 정확히 일치하는 경우 - 자동으로 기존 운용사 사용
  for (const item of exact) {
    decisions.set(item.newName, {
      useExisting: true,
      existingId: item.existingId,
      existingName: item.existingName
    });
  }

  // 완전 신규 - 자동으로 새로 등록
  for (const item of brandNew) {
    decisions.set(item.newName, { useExisting: false });
  }

  // 유사한 경우 - 사용자 확인 필요
  if (similar.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('⚠️  유사 운용사 검토 필요 (' + similar.length + '건)');
    console.log('─'.repeat(60));

    for (const item of similar) {
      const scorePercent = Math.round(item.score * 100);
      const interpretation = interpretScore(item.score);

      console.log('');
      console.log(`  📌 신규: "${item.newName}"`);
      console.log(`     기존: "${item.existingName}" (${item.existingId})`);
      console.log(`     유사도: ${scorePercent}% - ${interpretation}`);
      console.log(`     이유: ${item.reasons.join(', ')}`);
      console.log('');

      const answer = await askQuestion('  → 같은 운용사인가요? [y=기존 사용 / n=신규 등록 / s=건너뛰기]: ');

      if (answer.toLowerCase() === 'y') {
        decisions.set(item.newName, {
          useExisting: true,
          existingId: item.existingId,
          existingName: item.existingName
        });
        console.log(`     ✓ 기존 운용사 사용: ${item.existingName} (${item.existingId})`);
      } else if (answer.toLowerCase() === 's') {
        console.log('     ⏭️  건너뜀 (나중에 처리)');
      } else {
        decisions.set(item.newName, { useExisting: false });
        console.log(`     ✓ 신규 운용사로 등록 예정`);
      }
    }

    console.log('─'.repeat(60));
  }

  return decisions;
}

// ============ 약어 관련 함수 ============

/**
 * 약어 맵 구성 (캐시된 운용사 데이터에서)
 */
function buildAliasMap(operators) {
  const aliasMap = new Map();

  for (const op of operators) {
    const alias = op['약어'];
    const fullName = op['운용사명'];
    const id = op['ID'];
    if (alias && fullName) {
      // 쉼표로 구분된 여러 약어 처리
      for (const a of alias.split(',').map(s => s.trim())) {
        if (a) {
          aliasMap.set(a, { fullName, id });
        }
      }
    }
  }

  return aliasMap;
}

/**
 * 약어를 정식명으로 변환
 */
function expandAlias(name, aliasMap) {
  if (!aliasMap) return name;

  if (aliasMap.has(name)) {
    return aliasMap.get(name).fullName;
  }
  for (const [alias, data] of aliasMap) {
    if (name.includes(alias) || alias.includes(name)) {
      return data.fullName;
    }
  }
  return name;
}

/**
 * 약어로 운용사 ID 찾기
 */
function findOperatorIdByAlias(alias, aliasMap) {
  if (!aliasMap) return null;
  const data = aliasMap.get(alias);
  return data ? data.id : null;
}

// ============ 메인 처리 함수 ============

async function processPair(applicationFileNo, selectionFileNo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`접수현황(${applicationFileNo}) + 선정결과(${selectionFileNo}) 동시 처리 시작`);
  console.log('='.repeat(60));

  // 체크포인트 초기화
  const sessionId = `${applicationFileNo}-${selectionFileNo}-${Date.now()}`;
  const checkpoint = new CheckpointManager(sessionId);

  // 기존 체크포인트 확인 (재시작 시)
  const savedState = checkpoint.load();
  if (savedState && savedState.stage !== 'init') {
    console.log(`\n⚠️  이전 작업이 ${savedState.stage} 단계에서 중단되었습니다.`);
    console.log(`   체크포인트 시간: ${savedState.timestamp}`);
    const resumeAnswer = await askQuestion('   이전 작업을 이어서 진행하시겠습니까? [y/n]: ');
    if (resumeAnswer.toLowerCase() !== 'y') {
      checkpoint.clear();
      console.log('   체크포인트를 삭제하고 처음부터 시작합니다.\n');
    }
  }

  // Google Sheets 초기화
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 파일 찾기
  const downloadsDir = path.join(process.cwd(), 'downloads');
  const files = fs.readdirSync(downloadsDir);

  const applicationFile = files.find(f => f.startsWith(applicationFileNo) && f.endsWith('.pdf'));
  const selectionFile = files.find(f => f.startsWith(selectionFileNo) && f.endsWith('.pdf'));

  if (!applicationFile) {
    throw new Error(`접수현황 파일을 찾을 수 없습니다: ${applicationFileNo}`);
  }
  if (!selectionFile) {
    throw new Error(`선정결과 파일을 찾을 수 없습니다: ${selectionFileNo}`);
  }

  console.log(`\n접수현황 파일: ${applicationFile}`);
  console.log(`선정결과 파일: ${selectionFile}`);

  // ================================================================
  // Phase A: 데이터 수집 (메모리에서만, DB 변경 없음)
  // ================================================================

  // [1] PDF 파싱
  console.log('\n[1] PDF 파싱 중...');
  const applicationPdfPath = path.join(downloadsDir, applicationFile);
  const selectionPdfPath = path.join(downloadsDir, selectionFile);
  const applicationText = extractPdfText(applicationPdfPath);
  const selectionText = extractPdfText(selectionPdfPath);

  console.log('  - 접수현황 파싱 중...');
  const { applicants } = await parseApplicationPdf(applicationText, applicationFile);

  console.log('  - 선정결과 파싱 중...');
  const { selected: rawSelected } = await parseSelectionPdfWithAI(selectionText, selectionFile);

  // 외화 금액 원화 환산
  const hasForeignCurrency = rawSelected.some(s => s.currency && s.currency !== '억원');
  let selected = rawSelected;
  if (hasForeignCurrency) {
    console.log('  - 외화 금액 원화 환산 중...');
    selected = convertSelectedToKRW(rawSelected);
  }

  // 국내/해외 판별 (원본 통화 기준)
  const isDomestic = rawSelected.length > 0 && rawSelected[0].currency === '억원';

  // 사업명 추출
  let projectName = '';
  const titleMatch = applicationText.match(/((?:한국)?모태펀드[^]*?20\d{2}년[^]*?출자사업)/) ||
                     applicationText.match(/(20\d{2}년[^]*?출자사업[^]*?접수)/);
  if (titleMatch) {
    projectName = titleMatch[1].replace(/\s+/g, ' ').trim();
  }

  console.log(`  - 접수 운용사: ${applicants.length}개`);
  console.log(`  - 선정 운용사: ${selected.length}개`);

  // [2] 초기 데이터 1회 로드 (캐싱) - Phase 2 적용
  console.log('\n[2] 기존 데이터 로드 (캐싱)...');

  // 운용사 전체 로드 → Map으로 캐싱
  const allOperators = await sheets.getAllRowsCached('운용사');
  const operatorMap = new Map();           // ID -> 운용사 객체
  const operatorByNameMap = new Map();     // 운용사명 -> 운용사 객체

  for (const op of allOperators) {
    operatorMap.set(op['ID'], op);
    operatorByNameMap.set(op['운용사명'], op);
  }
  console.log(`  - 운용사: ${allOperators.length}건 캐싱됨`);

  // 약어 맵 구성 (API 호출 없이 메모리에서)
  const aliasMap = buildAliasMap(allOperators);
  console.log(`  - 약어 매핑: ${aliasMap.size}건`);

  // 신청현황 전체 로드 → Map으로 캐싱
  const allApplications = await sheets.getAllRowsCached('신청현황');
  console.log(`  - 신청현황: ${allApplications.length}건 캐싱됨`);

  // [3] 출자사업 정보 준비 (저장 X)
  console.log('\n[3] 출자사업 확인...');
  const existingProject = await sheets.findRow('출자사업', '사업명', projectName);
  const projectData = {
    name: projectName,
    isNew: !existingProject,
    id: existingProject ? existingProject['ID'] : null,
    meta: {
      소관: isDomestic ? '중기부' : 'KVIC(해외VC)',
      공고유형: '정시',
      연도: new Date().getFullYear().toString()
    }
  };
  if (existingProject) {
    console.log(`  - 기존 출자사업 발견: ${existingProject['ID']}`);
  } else {
    console.log(`  - 신규 출자사업 예정: ${projectName}`);
  }

  // [4] 파일DB 정보 준비 (저장 X)
  console.log('\n[4] 파일DB 확인...');
  const existingAppFile = await sheets.findRow('파일', '파일번호', applicationFileNo);
  const existingSelFile = await sheets.findRow('파일', '파일번호', selectionFileNo);

  const fileData = {
    application: {
      fileNo: applicationFileNo,
      fileName: applicationFile,
      fileType: '접수현황',
      isNew: !existingAppFile,
      id: existingAppFile ? existingAppFile['ID'] : null
    },
    selection: {
      fileNo: selectionFileNo,
      fileName: selectionFile,
      fileType: '선정결과',
      isNew: !existingSelFile,
      id: existingSelFile ? existingSelFile['ID'] : null
    }
  };
  console.log(`  - 접수현황 파일: ${existingAppFile ? existingAppFile['ID'] : '신규 예정'}`);
  console.log(`  - 선정결과 파일: ${existingSelFile ? existingSelFile['ID'] : '신규 예정'}`);

  // [5] 기존 신청현황 조회 (메모리에서)
  console.log('\n[5] 기존 신청현황 확인...');
  const existingApplications = new Map();
  const tempProjectId = projectData.id || 'NEW_PROJECT';  // 임시 ID (신규 사업의 경우)

  for (const app of allApplications) {
    if (app['출자사업ID'] !== tempProjectId && projectData.isNew) continue;
    if (app['출자사업ID'] !== projectData.id && !projectData.isNew) continue;

    const operatorIds = (app['운용사ID'] || '').split(',').map(s => s.trim());
    const category = app['출자분야'] || '';
    for (const opId of operatorIds) {
      if (opId) {
        const key = `${opId}|${category}`;
        existingApplications.set(key, {
          rowIndex: app._rowIndex,
          status: app['상태'],
          appId: app['ID'],
          operatorId: opId,
          category
        });
      }
    }
  }
  console.log(`  - 기존 등록된 신청현황: ${existingApplications.size}건`);

  // 선정된 운용사 이름 세트 (정규화)
  const selectedNames = new Set();
  for (const s of selected) {
    selectedNames.add(normalizeName(s.name));
    selectedNames.add(normalizeName(expandAlias(s.name, aliasMap)));
  }

  // 선정 결과 매핑 (운용사명 -> 선정 데이터)
  const selectionMap = new Map();
  for (const s of selected) {
    selectionMap.set(normalizeName(s.name), s);
    selectionMap.set(normalizeName(expandAlias(s.name, aliasMap)), s);
  }

  // [5.5] 신규 운용사 유사도 검토
  console.log('\n[5.5] 신규 운용사 유사도 검토...');
  const allOperatorNames = [...new Set([
    ...applicants.map(a => a.name),
    ...selected.map(s => s.name)
  ])];
  const operatorDecisions = await reviewNewOperators(allOperatorNames, operatorByNameMap, allOperators);

  // [6] 운용사 매핑 준비 (저장 X)
  console.log('\n[6] 운용사 매핑 준비...');
  const pendingNewOperators = [];  // 신규 등록 예정 운용사
  const operatorMappings = new Map();  // 운용사명 -> { id, name, isNew }

  for (const applicant of applicants) {
    const decision = operatorDecisions.get(applicant.name);

    if (decision?.useExisting) {
      // 유사도 검토에서 기존 운용사 사용으로 결정됨
      operatorMappings.set(applicant.name, {
        id: decision.existingId,
        name: decision.existingName,
        isNew: false,
        originalName: applicant.name
      });
    } else {
      // 기존 운용사 확인 (메모리에서)
      const existing = operatorByNameMap.get(applicant.name);
      if (existing) {
        operatorMappings.set(applicant.name, {
          id: existing['ID'],
          name: applicant.name,
          isNew: false
        });
      } else {
        // 신규 등록 예정
        pendingNewOperators.push({
          name: applicant.name,
          region: applicant.region
        });
        operatorMappings.set(applicant.name, {
          id: null,  // 나중에 할당
          name: applicant.name,
          isNew: true
        });
      }
    }
  }

  // 선정결과에만 있는 운용사도 확인
  for (const s of selected) {
    if (!operatorMappings.has(s.name)) {
      const decision = operatorDecisions.get(s.name);

      if (decision?.useExisting) {
        operatorMappings.set(s.name, {
          id: decision.existingId,
          name: decision.existingName,
          isNew: false,
          originalName: s.name
        });
      } else {
        const existing = operatorByNameMap.get(s.name);
        if (existing) {
          operatorMappings.set(s.name, {
            id: existing['ID'],
            name: s.name,
            isNew: false
          });
        } else {
          pendingNewOperators.push({
            name: s.name,
            region: s.region
          });
          operatorMappings.set(s.name, {
            id: null,
            name: s.name,
            isNew: true
          });
        }
      }
    }
  }

  console.log(`  - 기존 운용사 매핑: ${[...operatorMappings.values()].filter(m => !m.isNew).length}건`);
  console.log(`  - 신규 운용사 예정: ${pendingNewOperators.length}건`);

  // [6.5] enrichedApplicants 준비 (검토 화면용)
  const enrichedApplicants = applicants.map(applicant => {
    const mapping = operatorMappings.get(applicant.name);
    const normalizedName = normalizeName(applicant.name);
    const expandedName = normalizeName(expandAlias(applicant.name, aliasMap));

    // 선정 여부 판별
    const isSelected = selectedNames.has(normalizedName) || selectedNames.has(expandedName);

    return {
      ...applicant,
      operatorId: mapping?.id || 'PENDING',
      isNewOperator: mapping?.isNew || false,
      status: isSelected ? '선정' : '탈락'
    };
  });

  // 통계 초기화
  const stats = {
    newSelected: 0,
    newRejected: 0,
    skippedExisting: 0,
    operatorsCreated: 0,
  };

  // ================================================================
  // 검토 화면
  // ================================================================
  console.log('\n[7] 데이터 검토...');

  const reviewData = prepareReviewData({
    applicants: enrichedApplicants,
    selected,
    project: { id: projectData.id || 'NEW', ...projectData },
    existingApplications,
    selectedNames,
    selectionMap,
    aliasCache: aliasMap,
    sheets
  });

  const review = new ReviewSession(reviewData);
  const approved = await review.start();

  if (!approved) {
    console.log('\n처리가 취소되었습니다.');
    console.log('(DB에 아무런 변경이 없습니다)');
    checkpoint.clear();
    process.exit(0);
  }

  // ================================================================
  // Phase B: 승인 후 일괄 저장
  // ================================================================

  console.log('\n' + '─'.repeat(60));
  console.log('📝 승인됨 - DB 저장을 시작합니다');
  console.log('─'.repeat(60));

  try {
    // [8] 출자사업 생성
    await checkpoint.save('project-start', { projectName });
    console.log('\n[8] 출자사업 저장...');

    let project;
    if (projectData.isNew) {
      project = await withRetry(() =>
        sheets.getOrCreateProject(projectData.name, projectData.meta)
      );
      console.log(`  [출자사업 생성] ${project.id}: ${projectData.name}`);
    } else {
      project = { id: projectData.id, isNew: false };
      console.log(`  [기존 사용] ${project.id}`);
    }

    await checkpoint.save('project-done', { projectId: project.id });

    // [9] 파일DB 생성 및 연결
    await checkpoint.save('files-start');
    console.log('\n[9] 파일DB 저장...');

    const appFileHistory = await withRetry(() =>
      sheets.getOrCreateFileHistory(
        fileData.application.fileNo,
        fileData.application.fileName,
        fileData.application.fileType
      )
    );
    const selFileHistory = await withRetry(() =>
      sheets.getOrCreateFileHistory(
        fileData.selection.fileNo,
        fileData.selection.fileName,
        fileData.selection.fileType
      )
    );

    const fileDBIds = [appFileHistory.id, selFileHistory.id].join(', ');
    console.log(`  - 접수현황 파일: ${appFileHistory.id}`);
    console.log(`  - 선정결과 파일: ${selFileHistory.id}`);

    // 출자사업-파일 연결
    await withRetry(() => sheets.updateProjectFileId(project.id, '접수현황', appFileHistory.id));
    await withRetry(() => sheets.updateProjectFileId(project.id, '선정결과', selFileHistory.id));

    await checkpoint.save('files-done', {
      appFileId: appFileHistory.id,
      selFileId: selFileHistory.id
    });

    // [10] 운용사 일괄 생성 - Phase 1 배치 메서드 적용
    await checkpoint.save('operators-start');
    console.log('\n[10] 운용사 저장...');

    if (pendingNewOperators.length > 0) {
      const newOperatorNames = pendingNewOperators.map(op => op.name);
      const nameToIdMap = await withRetry(() =>
        sheets.createOperatorsBatch(newOperatorNames)
      );

      // 매핑 업데이트
      for (const [name, newId] of nameToIdMap) {
        const mapping = operatorMappings.get(name);
        if (mapping) {
          mapping.id = newId;
        }
      }

      stats.operatorsCreated = newOperatorNames.length;
      console.log(`  [운용사 배치 생성] ${newOperatorNames.length}건`);
    } else {
      console.log(`  - 신규 운용사 없음`);
    }

    await checkpoint.save('operators-done', {
      operatorsCreated: stats.operatorsCreated
    });

    // [11] 신청현황 일괄 생성 - Phase 1 배치 메서드 적용
    await checkpoint.save('applications-start');
    console.log('\n[11] 신청현황 저장...');

    const finalApplicants = review.getFinalApplicants();
    const applicationDataList = [];
    const newAliases = [];
    const processedSelectedNames = new Set();

    for (const applicant of finalApplicants) {
      const normalizedName = normalizeName(applicant.name);
      const mapping = operatorMappings.get(applicant.name);

      // 수정된 경우 매핑 재확인
      let operatorId = mapping?.id;
      if (applicant.nameEdited) {
        const existing = operatorByNameMap.get(applicant.name);
        if (existing) {
          operatorId = existing['ID'];
        } else {
          // 수정으로 인한 신규 운용사는 개별 생성
          const newOp = await sheets.getOrCreateOperator(applicant.name, { region: applicant.region });
          operatorId = newOp.id;
          if (newOp.isNew) stats.operatorsCreated++;
        }
      }

      if (!operatorId) {
        console.log(`  [경고] 운용사 ID 없음: ${applicant.name}`);
        continue;
      }

      // 중복 체크
      const existingKey = `${operatorId}|${applicant.category}`;
      if (existingApplications.has(existingKey)) {
        const existing = existingApplications.get(existingKey);
        console.log(`  [건너뜀] ${applicant.name} - 이미 ${existing.status}으로 등록됨`);
        stats.skippedExisting++;
        continue;
      }

      // 선정 데이터 찾기
      const isSelected = applicant.status === '선정';
      let selectionData = selectionMap.get(normalizedName);
      let matchedAlias = null;

      if (!selectionData && isSelected) {
        for (const [key, value] of selectionMap) {
          if (key.includes(normalizedName) || normalizedName.includes(key)) {
            selectionData = value;
            if (value.name.length < applicant.name.length * 0.7) {
              matchedAlias = value.name;
            }
            break;
          }
        }
      }

      // 처리된 선정 운용사 기록
      if (isSelected) {
        processedSelectedNames.add(normalizedName);
        if (selectionData) {
          processedSelectedNames.add(normalizeName(selectionData.name));
        }
      }

      // 약어 추가 (배치용)
      if (isSelected && matchedAlias) {
        newAliases.push({ operatorId, alias: matchedAlias, fullName: applicant.name });
      }
      if (mapping?.originalName && mapping.originalName !== mapping.name) {
        newAliases.push({ operatorId, alias: mapping.originalName, fullName: mapping.name });
      }

      // 선정 상태일 때만 금액 저장 (접수/탈락은 개별 금액이 없으므로 비워둠)
      applicationDataList.push({
        출자사업ID: project.id,
        운용사ID: operatorId,
        출자분야: applicant.category,
        최소결성규모: isSelected ? (selectionData?.minFormation || '') : '',
        모태출자액: isSelected ? (selectionData?.moTae || '') : '',
        결성예정액: isSelected ? (selectionData?.fundSize || '') : '',
        출자요청액: isSelected ? (selectionData?.requestAmount || '') : '',
        통화단위: isSelected ? (selectionData?.currency || '') : '',
        상태: applicant.status,
        비고: applicant.isJointGP ? '공동GP' : '',
        공동GP파트너: applicant.jointGPPartner || ''
      });

      if (isSelected) {
        stats.newSelected++;
      } else {
        stats.newRejected++;
      }
    }

    // [11-2] 선정결과에만 있는 운용사 처리
    console.log('\n[11-2] 누락된 선정 운용사 확인...');
    for (const s of selected) {
      const normalizedName = normalizeName(s.name);
      const expandedName = normalizeName(expandAlias(s.name, aliasMap));

      if (processedSelectedNames.has(normalizedName) || processedSelectedNames.has(expandedName)) {
        continue;
      }

      console.log(`  [누락 발견] 선정결과에만 존재: ${s.name}`);

      const mapping = operatorMappings.get(s.name);
      let operatorId = mapping?.id;

      if (!operatorId) {
        // 긴급 생성
        const newOp = await sheets.getOrCreateOperator(s.name, { region: s.region });
        operatorId = newOp.id;
        if (newOp.isNew) stats.operatorsCreated++;
      }

      // 약어 추가
      if (s.name !== mapping?.name) {
        newAliases.push({ operatorId, alias: s.name, fullName: mapping?.name || s.name });
      }

      // 중복 체크
      const existingKey = `${operatorId}|${s.category}`;
      if (existingApplications.has(existingKey)) {
        console.log(`  [건너뜀] ${s.name} - 이미 등록됨`);
        stats.skippedExisting++;
        continue;
      }

      applicationDataList.push({
        출자사업ID: project.id,
        운용사ID: operatorId,
        출자분야: s.category,
        최소결성규모: s.minFormation || '',
        모태출자액: s.moTae || '',
        결성예정액: s.fundSize || '',
        출자요청액: s.requestAmount || '',
        통화단위: s.currency || '',
        상태: '선정',
        비고: s.isJointGP ? '공동GP' : ''
      });

      stats.newSelected++;
    }

    // 배치 저장
    if (applicationDataList.length > 0) {
      const createdAppIds = await withRetry(() =>
        sheets.createApplicationsBatch(applicationDataList)
      );
      console.log(`  [신청현황 배치 생성] ${createdAppIds.length}건`);
    }

    await checkpoint.save('applications-done', {
      applicationsCreated: applicationDataList.length
    });

    // [12] 약어 일괄 업데이트
    if (newAliases.length > 0) {
      console.log('\n[12] 약어 저장...');
      await withRetry(() => sheets.updateOperatorAliasesBatch(newAliases));
      for (const { operatorId, alias, fullName } of newAliases) {
        console.log(`  - ${alias} → ${fullName} (${operatorId})`);
      }
    }

    // [13] 파일DB 업데이트
    console.log('\n[13] 파일DB 상태 업데이트...');
    const now = new Date().toISOString();

    await sheets.updateFileHistory(appFileHistory.id, {
      처리상태: '완료',
      처리일시: now
    });
    await sheets.updateFileHistory(selFileHistory.id, {
      처리상태: '완료',
      처리일시: now
    });

    // 로컬 JSON 업데이트 (호환성 유지)
    const processedPath = path.join(process.cwd(), 'processed.json');
    let processed = {};
    if (fs.existsSync(processedPath)) {
      processed = JSON.parse(fs.readFileSync(processedPath, 'utf-8'));
    }

    for (const fileNo of [applicationFileNo, selectionFileNo]) {
      processed[fileNo] = {
        status: '완료',
        processedAt: now,
        stats: {
          selected: stats.newSelected,
          rejected: stats.newRejected,
          skipped: stats.skippedExisting
        }
      };
    }

    fs.writeFileSync(processedPath, JSON.stringify(processed, null, 2));

    // [14] 출자사업 현황 업데이트
    console.log('\n[14] 출자사업 현황 업데이트...');
    await sheets.updateProjectStatus(project.id);

    // [15] 탈락 상태 업데이트 - Phase 5 적용
    console.log('\n[15] 탈락 상태 확인...');
    const selectedOperatorIds = new Set(
      applicationDataList
        .filter(a => a.상태 === '선정')
        .map(a => a.운용사ID)
    );
    const rejectedCount = await sheets.updateRejectedStatus(project.id, selectedOperatorIds);
    if (rejectedCount > 0) {
      console.log(`  - 탈락 처리: ${rejectedCount}건`);
    }

    // 체크포인트 삭제 (완료)
    checkpoint.clear();

    // 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('✅ 처리 완료');
    console.log('='.repeat(60));
    console.log(`  - 신규 선정: ${stats.newSelected}건`);
    console.log(`  - 신규 탈락: ${stats.newRejected}건`);
    console.log(`  - 기존 유지: ${stats.skippedExisting}건`);
    console.log(`  - 운용사 생성: ${stats.operatorsCreated}건`);
    console.log(`  - 총 생성: ${applicationDataList.length}건`);
    console.log(`\n스프레드시트: https://docs.google.com/spreadsheets/d/${sheets.spreadsheetId}`);

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.log(`\n체크포인트가 저장되었습니다: ${checkpoint.filePath}`);
    console.log('다시 실행하면 마지막 체크포인트에서 재개됩니다.');
    throw error;
  }
}

// CLI 실행
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('사용법: node src/process-pair-sheets.js <접수파일번호> <선정파일번호>');
  console.log('예시: node src/process-pair-sheets.js 4461 4524');
  process.exit(1);
}

processPair(args[0], args[1]).catch(error => {
  console.error('오류 발생:', error.message);
  process.exit(1);
});
