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
 * 시트 구조:
 * - 운용사DB: ID, 운용사명, 영문명, 유형, 국가, 약어
 * - 출자사업DB: ID, 사업명, 소관, 공고유형, 연도, 차수
 * - 신청현황: ID, 출자사업ID, 운용사ID(쉼표연결), 출자분야, 금액..., 상태, 파일DBID
 * - 파일DB: ID, 파일명, 파일번호, 파일유형, 파일URL, 처리상태, 처리일시, 비고
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

dotenv.config({ override: true });

const anthropic = new Anthropic();

// Google Sheets 클라이언트
let sheets = null;

// 약어 매핑 캐시 (시트에서 로드)
let aliasCache = null;

// 처리 통계 (헬퍼 함수에서 참조)
let stats = null;
let createdAppIds = null;
let newAliases = null;
let existingApplications = null;
let project = null;
let fileDBIds = null;

// ============ 헬퍼 함수 ============

/**
 * 통화 코드를 한글 단위로 변환
 * @param {string} currency - 'KRW', 'USD', 'EUR' 등
 * @returns {string} - '억원', 'USD M', 'EUR M' 등
 */
function formatCurrency(currency) {
  if (!currency) return '';
  return currency === 'KRW' ? '억원' : `${currency} M`;
}

/**
 * 약어를 저장 대기열에 추가 (중복 체크)
 * @param {string} operatorId - 운용사 ID
 * @param {string} alias - 약어
 * @param {string} fullName - 정식 운용사명
 * @returns {boolean} - 추가 여부
 */
function addAliasIfNew(operatorId, alias, fullName) {
  if (!aliasCache.has(alias)) {
    newAliases.push({ operatorId, alias, fullName });
    return true;
  }
  return false;
}

/**
 * 중복 신청현황 체크
 * @param {string} operatorId - 운용사 ID
 * @param {string} category - 출자분야
 * @param {string} operatorName - 운용사명 (로그용)
 * @returns {boolean} - 중복 여부
 */
function isDuplicateApplication(operatorId, category, operatorName) {
  const existingKey = `${operatorId}|${category}`;
  if (existingApplications.has(existingKey)) {
    const existing = existingApplications.get(existingKey);
    console.log(`  [건너뜀] ${operatorName} (${operatorId}) - 이미 ${existing.status}으로 등록됨 (${category})`);
    stats.skippedExisting++;
    return true;
  }
  return false;
}

/**
 * 신청현황 레코드 생성 (공통 로직)
 * @param {Object} params
 * @returns {Promise<string>} - 생성된 신청현황 ID
 */
async function createApplicationRecord({
  operatorId,
  operatorName,
  category,
  status,
  selectionData = null
}) {
  const currency = selectionData?.currency
    ? formatCurrency(selectionData.currency)
    : '';

  const appId = await sheets.createApplication({
    출자사업ID: project.id,
    운용사ID: operatorId,
    출자분야: category,
    결성예정액: selectionData?.minSize || '',
    출자요청액: selectionData?.investAmount || '',
    최소결성규모: '',
    통화단위: currency,
    상태: status,
    파일DBID: fileDBIds
  });

  createdAppIds.push(appId);

  const statusLabel = status === '선정' ? '선정' : status === '탈락' ? '탈락' : '추가';
  console.log(`  [${statusLabel}] ${operatorName} (${operatorId}) -> ${appId}`);

  if (status === '선정') {
    stats.newSelected++;
  } else if (status === '탈락') {
    stats.newRejected++;
  }

  return appId;
}

/**
 * 운용사 ID 조회/생성 (Early return 패턴)
 * @param {string} name - 운용사명
 * @param {Object} decision - 유사도 검토 결과
 * @param {Object} metadata - 생성 시 메타데이터 (region 등)
 * @returns {Promise<Object>} - { id, name, source }
 */
async function resolveOperatorId(name, decision, metadata = {}) {
  // 1. 유사도 검토 결과 사용
  if (decision?.useExisting) {
    return {
      id: decision.existingId,
      name: decision.existingName,
      source: 'similarity'
    };
  }

  // 2. 약어로 찾기
  const aliasId = findOperatorIdByAlias(name);
  if (aliasId) {
    const aliasData = aliasCache.get(name);
    return {
      id: aliasId,
      name: aliasData.fullName,
      source: 'alias'
    };
  }

  // 3. 이름으로 기존 운용사 찾기
  const existing = await sheets.findOperatorByName(name);
  if (existing) {
    return {
      id: existing['ID'],
      name: name,
      source: 'existing'
    };
  }

  // 4. 새 운용사 생성
  const operator = await sheets.getOrCreateOperator(name, metadata);
  stats.operatorsCreated++;
  return {
    id: operator.id,
    name: name,
    source: 'new'
  };
}

// ============ 기존 함수 ============

// PDF 텍스트 추출 (pdftotext 사용)
function extractPdfText(pdfPath) {
  try {
    const result = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8' });
    return result;
  } catch (error) {
    console.error(`PDF 텍스트 추출 실패: ${pdfPath}`);
    throw error;
  }
}

// AI 기반 선정결과 PDF 파싱
async function parseSelectionPdfWithAI(text, filename) {
  const prompt = `다음은 한국 벤처펀드 출자사업 선정결과 PDF의 텍스트입니다.
이 문서에서 **선정된 운용사(GP) 정보**를 추출해주세요.

추출할 정보:
1. 운용사명 (회사명, GP명)
2. 출자분야/카테고리 (있는 경우)
3. 결성예정액 또는 최소결성규모 (숫자만)
4. 출자요청액 또는 모태출자액 (숫자만)
5. 통화단위 (억원, USD M, EUR M 등)

주의사항:
- 공동GP인 경우 (예: "A / B" 또는 "A, B") 각각 별도 항목으로 분리
- 합계, 소계 등은 제외
- 숫자가 없는 운용사명만 나열된 경우도 추출 (금액은 null)
- 해외 운용사는 영문명 그대로 유지

JSON 배열로 응답해주세요:
[
  {
    "name": "운용사명",
    "category": "출자분야 (없으면 빈 문자열)",
    "minSize": 결성예정액/최소결성규모 (숫자 또는 null),
    "investAmount": 출자요청액/모태출자액 (숫자 또는 null),
    "currency": "KRW" 또는 "USD" 또는 "EUR" (억원이면 KRW)
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
      region: item.currency === 'KRW' ? '한국' : '',
      currency: item.currency || 'KRW',
      minSize: item.minSize || null,
      investAmount: item.investAmount || null,
    })).filter(item => item.name);

    console.log(`  [AI 파싱] ${selected.length}개 운용사 추출`);
    return { projectName: '', selected };

  } catch (error) {
    console.error(`AI 파싱 실패: ${error.message}`);
    return { projectName: '', selected: [] };
  }
}

// 접수현황 PDF 파싱 (AI 사용 - PDF 구조가 다양하므로)
async function parseApplicationPdf(text, filename) {
  console.log('  - AI 파싱 중...');
  return parseApplicationPdfWithAI(text, filename);
}

// AI 기반 접수현황 PDF 파싱 (폴백용)
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

// 운용사명 정규화 (비교용)
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[,.\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|ltd|pte|limited|management|company|co)\b/gi, '')
    .trim();
}

// 약어를 정식명으로 변환 (캐시 사용)
function expandAlias(name) {
  if (!aliasCache) return name;

  if (aliasCache.has(name)) {
    return aliasCache.get(name).fullName;
  }
  for (const [alias, data] of aliasCache) {
    if (name.includes(alias) || alias.includes(name)) {
      return data.fullName;
    }
  }
  return name;
}

// 약어로 운용사 ID 찾기
function findOperatorIdByAlias(alias) {
  if (!aliasCache) return null;
  const data = aliasCache.get(alias);
  return data ? data.id : null;
}

// 터미널 입력 받기
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

/**
 * 신규 운용사 등록 전 유사 운용사 검토
 * @param {Array} newOperatorNames - 신규 운용사명 목록
 * @param {GoogleSheetsClient} sheets - Google Sheets 클라이언트
 * @returns {Map} 운용사명 -> { useExisting: boolean, existingId?: string, existingName?: string }
 */
async function reviewNewOperators(newOperatorNames, sheets) {
  const decisions = new Map();

  // 기존 운용사 목록 조회
  const existingOperators = await sheets.getAllOperators();
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
        // 건너뛰기 - 나중에 처리
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

// 메인 처리 함수
async function processPair(applicationFileNo, selectionFileNo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`접수현황(${applicationFileNo}) + 선정결과(${selectionFileNo}) 동시 처리 시작`);
  console.log('='.repeat(60));

  // Google Sheets 초기화
  sheets = new GoogleSheetsClient();
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

  // PDF 파싱
  console.log('\n[1] PDF 파싱 중...');
  const applicationPdfPath = path.join(downloadsDir, applicationFile);
  const selectionPdfPath = path.join(downloadsDir, selectionFile);
  const applicationText = extractPdfText(applicationPdfPath);
  const selectionText = extractPdfText(selectionPdfPath);

  // 접수현황 파싱 (AI 사용)
  console.log('  - 접수현황 파싱 중...');
  const { applicants } = await parseApplicationPdf(applicationText, applicationFile);

  // 선정결과 파싱 (AI 사용)
  console.log('  - 선정결과 파싱 중...');
  const { selected } = await parseSelectionPdfWithAI(selectionText, selectionFile);

  // 국내/해외 판별 (통화 기준)
  const isDomestic = selected.length > 0 && selected[0].currency === 'KRW';

  // 사업명 추출 (PDF 텍스트에서)
  let projectName = '';
  const titleMatch = applicationText.match(/((?:한국)?모태펀드[^]*?20\d{2}년[^]*?출자사업)/) ||
                     applicationText.match(/(20\d{2}년[^]*?출자사업[^]*?접수)/);
  if (titleMatch) {
    projectName = titleMatch[1].replace(/\s+/g, ' ').trim();
  }

  console.log(`  - 접수 운용사: ${applicants.length}개`);
  console.log(`  - 선정 운용사: ${selected.length}개`);

  // 약어 매핑 로드
  console.log('\n[2] 약어 매핑 로드...');
  aliasCache = await sheets.loadAliasMap();
  console.log(`  - 약어 매핑: ${aliasCache.size}건`);

  // 출자사업 조회/생성
  console.log('\n[3] 출자사업 확인...');
  project = await sheets.getOrCreateProject(projectName, {
    소관: isDomestic ? '중기부' : 'KVIC(해외VC)',
    공고유형: '정시',
    연도: new Date().getFullYear().toString()
  });

  // 파일DB 생성 (접수현황, 선정결과)
  console.log('\n[4] 파일DB 생성...');
  const appFileHistory = await sheets.getOrCreateFileHistory(
    applicationFileNo,
    applicationFile,
    '접수현황'
  );
  const selFileHistory = await sheets.getOrCreateFileHistory(
    selectionFileNo,
    selectionFile,
    '선정결과'
  );
  fileDBIds = [appFileHistory.id, selFileHistory.id].join(', ');
  console.log(`  - 접수현황 파일: ${appFileHistory.id}`);
  console.log(`  - 선정결과 파일: ${selFileHistory.id}`);

  // 기존 신청현황 조회
  console.log('\n[5] 기존 데이터 확인...');
  existingApplications = await sheets.getExistingApplications(project.id);
  console.log(`  - 기존 등록된 신청현황: ${existingApplications.size}건`);

  // 선정된 운용사 이름 세트 (정규화된 이름 + 약어 확장)
  const selectedNames = new Set();
  for (const s of selected) {
    selectedNames.add(normalizeName(s.name));
    selectedNames.add(normalizeName(expandAlias(s.name)));
  }

  // 선정 결과 매핑 (운용사명 -> 선정 데이터)
  const selectionMap = new Map();
  for (const s of selected) {
    selectionMap.set(normalizeName(s.name), s);
    selectionMap.set(normalizeName(expandAlias(s.name)), s);
  }

  // 처리 통계 (전역 변수에 할당)
  stats = {
    newSelected: 0,
    newRejected: 0,
    skippedExisting: 0,
    operatorsCreated: 0,
  };

  // [5.5] 신규 운용사 유사도 검토
  console.log('\n[5.5] 신규 운용사 유사도 검토...');
  const allOperatorNames = [...new Set([
    ...applicants.map(a => a.name),
    ...selected.map(s => s.name)
  ])];
  const operatorDecisions = await reviewNewOperators(allOperatorNames, sheets);

  // 운용사 정보 미리 조회 (검토 화면용)
  console.log('\n[6] 데이터 검토 준비...');
  const enrichedApplicants = [];
  for (const applicant of applicants) {
    const decision = operatorDecisions.get(applicant.name);

    let operator;
    if (decision?.useExisting) {
      // 유사도 검토에서 기존 운용사 사용으로 결정됨
      operator = { id: decision.existingId, isNew: false };
      console.log(`  [기존 사용] ${applicant.name} → ${decision.existingName} (${decision.existingId})`);
    } else {
      // 신규 등록 또는 정확히 일치
      operator = await sheets.getOrCreateOperator(applicant.name, { region: applicant.region });
      if (operator.isNew) {
        stats.operatorsCreated++;
        console.log(`  [신규 등록] ${applicant.name} → ${operator.id}`);
      }
    }

    enrichedApplicants.push({
      ...applicant,
      operatorId: operator.id,
      isNewOperator: operator.isNew
    });
  }

  // 검토 세션 시작
  const reviewData = prepareReviewData({
    applicants: enrichedApplicants,
    selected,
    project,
    existingApplications,
    selectedNames,
    selectionMap,
    aliasCache,
    sheets
  });

  const review = new ReviewSession(reviewData);
  const approved = await review.start();

  if (!approved) {
    console.log('\n처리가 취소되었습니다.');
    process.exit(0);
  }

  // 승인된 데이터로 처리 계속
  const finalApplicants = review.getFinalApplicants();
  console.log(`\n[7] 신청현황 생성 중... (${finalApplicants.length}건)`);

  // 전역 변수 초기화
  createdAppIds = [];
  newAliases = [];
  const processedSelectedNames = new Set();

  for (const applicant of finalApplicants) {
    const normalizedName = normalizeName(applicant.name);

    // 운용사 조회/생성 (수정된 경우 재조회)
    let operator;
    if (applicant.nameEdited) {
      operator = await sheets.getOrCreateOperator(applicant.name, { region: applicant.region });
      if (operator.isNew) stats.operatorsCreated++;
    } else {
      // 이미 검토 단계에서 조회함
      operator = { id: applicant.operatorId, isNew: applicant.isNewOperator };
    }

    // 중복 체크 (헬퍼 함수 사용)
    if (isDuplicateApplication(operator.id, applicant.category, applicant.name)) {
      continue;
    }

    // 검토 단계에서 이미 상태 결정됨 (선정/탈락)
    const isSelected = applicant.status === '선정';

    // 선정 데이터 찾기 (금액 정보용)
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

    // 약어 추가 (헬퍼 함수 사용)
    if (isSelected && matchedAlias) {
      addAliasIfNew(operator.id, matchedAlias, applicant.name);
    }

    const decision = operatorDecisions.get(applicant.name);
    if (decision?.useExisting && applicant.name !== decision.existingName) {
      addAliasIfNew(operator.id, applicant.name, decision.existingName);
    }

    // 신청현황 레코드 생성 (헬퍼 함수 사용)
    await createApplicationRecord({
      operatorId: operator.id,
      operatorName: applicant.name,
      category: applicant.category,
      status: applicant.status,
      selectionData: isSelected ? selectionData : null
    });
  }

  // [7-2] 선정결과에는 있지만 접수현황에서 누락된 운용사 처리
  console.log('\n[7-2] 누락된 선정 운용사 확인...');
  for (const s of selected) {
    const normalizedName = normalizeName(s.name);
    const expandedName = normalizeName(expandAlias(s.name));

    if (processedSelectedNames.has(normalizedName) || processedSelectedNames.has(expandedName)) {
      continue;
    }

    console.log(`  [누락 발견] 선정결과에만 존재: ${s.name}`);

    // 운용사 ID 조회/생성 (헬퍼 함수 사용)
    const decision = operatorDecisions.get(s.name);
    const operatorInfo = await resolveOperatorId(s.name, decision, { region: s.region });

    console.log(`    → ${operatorInfo.source === 'similarity' ? '유사도 검토' :
                      operatorInfo.source === 'alias' ? '약어 매핑' :
                      operatorInfo.source === 'existing' ? '기존 운용사' :
                      '새 운용사 생성'}: ${s.name} → ${operatorInfo.name} (${operatorInfo.id})`);

    // 약어 추가 (헬퍼 함수 사용)
    if (s.name !== operatorInfo.name) {
      addAliasIfNew(operatorInfo.id, s.name, operatorInfo.name);
    }

    // 중복 체크 (헬퍼 함수 사용)
    if (isDuplicateApplication(operatorInfo.id, s.category, operatorInfo.name)) {
      continue;
    }

    // 신청현황 레코드 생성 (헬퍼 함수 사용)
    await createApplicationRecord({
      operatorId: operatorInfo.id,
      operatorName: operatorInfo.name,
      category: s.category,
      status: '선정',
      selectionData: s
    });
  }

  // 새 약어 저장
  if (newAliases.length > 0) {
    console.log('\n[8] 새 약어 저장...');
    for (const { operatorId, alias, fullName } of newAliases) {
      await sheets.updateOperatorAlias(operatorId, alias);
      console.log(`  - ${alias} → ${fullName} (${operatorId})`);
    }
  }

  // 파일DB 업데이트 (Google Sheets + 로컬 JSON)
  console.log('\n[9] 파일DB 업데이트...');
  const now = new Date().toISOString();

  // Google Sheets 업데이트
  await sheets.updateFileHistory(appFileHistory.id, {
    처리상태: '완료',
    처리일시: now
  });
  await sheets.updateFileHistory(selFileHistory.id, {
    처리상태: '완료',
    처리일시: now
  });
  console.log(`  - ${appFileHistory.id} (접수현황) 처리상태: 완료`);
  console.log(`  - ${selFileHistory.id} (선정결과) 처리상태: 완료`);

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

  // 출자사업 현황 업데이트
  console.log('\n[10] 출자사업 현황 업데이트...');
  const projectStats = await sheets.updateProjectStatus(project.id);

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('처리 완료');
  console.log('='.repeat(60));
  console.log(`  - 신규 선정: ${stats.newSelected}건`);
  console.log(`  - 신규 탈락: ${stats.newRejected}건`);
  console.log(`  - 기존 유지: ${stats.skippedExisting}건`);
  console.log(`  - 운용사 생성: ${stats.operatorsCreated}건`);
  console.log(`  - 총 생성: ${createdAppIds.length}건`);
  console.log(`\n스프레드시트: https://docs.google.com/spreadsheets/d/${sheets.spreadsheetId}`);
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
