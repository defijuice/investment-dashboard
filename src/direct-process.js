/**
 * PDF 직접 파싱 및 Google Sheets 저장 스크립트
 * AI 없이 텍스트 기반 파싱
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { GoogleSheetsClient } from './googleSheets.js';

dotenv.config({ override: true });

// PDF 텍스트 추출
function extractPdfText(pdfPath) {
  try {
    const result = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8' });
    return result;
  } catch (error) {
    console.error(`PDF 텍스트 추출 실패: ${pdfPath}`);
    throw error;
  }
}

// 접수현황 PDF 파싱 (텍스트 기반)
function parseApplicationPdf(text) {
  const applicants = [];
  const lines = text.split('\n');
  let currentCategory = '';

  // 카테고리별 운용사명 추출
  const categoryPatterns = [
    /루키리그/,
    /스케일업.*중견도약/,
    /여성기업/,
    /임팩트/,
    /재도약/,
    /청년창업/,
    /창업초기/,
    /소재부품장비/,
    /지역/
  ];

  for (const line of lines) {
    // 카테고리 감지
    for (const pattern of categoryPatterns) {
      if (pattern.test(line)) {
        const match = line.match(pattern);
        if (match) {
          currentCategory = match[0];
        }
      }
    }

    // 운용사명 추출 (한글+영문 회사명 패턴)
    const companyMatch = line.match(/([가-힣A-Za-z]+(?:인베스트먼트|벤처스|파트너스|투자|캐피탈|기술지주|증권|자산운용|혁신센터|지주회사|벤처투자|인베스터|소셜컴퍼니|투자금융|투자파트너스|생명과학|벤처캐피탈|벤처파트너스))/g);

    if (companyMatch) {
      for (const name of companyMatch) {
        // 중복 체크
        if (!applicants.find(a => a.name === name.trim())) {
          applicants.push({
            name: name.trim(),
            category: currentCategory,
            region: '한국'
          });
        }
      }
    }
  }

  return applicants;
}

// 선정결과 PDF 파싱 (텍스트 기반)
function parseSelectionPdf(text) {
  const selected = [];
  const lines = text.split('\n');
  let currentCategory = '';

  // 카테고리별 운용사명 추출
  const categoryPatterns = [
    /루키리그/,
    /스케일업.*중견도약/,
    /여성기업/,
    /임팩트/,
    /재도약/,
    /청년창업/,
    /창업초기/,
    /소재부품장비/,
    /지역.*창업초기/,
    /라이콘/,
    /지역AC세컨더리/
  ];

  for (const line of lines) {
    // 카테고리 감지
    for (const pattern of categoryPatterns) {
      if (pattern.test(line)) {
        const match = line.match(pattern);
        if (match) {
          currentCategory = match[0];
        }
      }
    }

    // 금액 + 운용사명 패턴 (예: "200 100 노보섹인베스트먼트")
    const amountMatch = line.match(/[\d,.]+\s+[\d,.]+\s+([가-힣A-Za-z]+(?:인베스트먼트|벤처스|파트너스|투자|캐피탈|기술지주|증권|자산운용|혁신센터|지주회사|벤처투자|인베스터|소셜컴퍼니|투자금융|투자파트너스|생명과학|벤처캐피탈|벤처파트너스|아처))/);

    if (amountMatch) {
      const name = amountMatch[1].trim();
      const amounts = line.match(/([\d,.]+)\s+([\d,.]+)/);

      if (!selected.find(s => s.name === name)) {
        selected.push({
          name: name,
          category: currentCategory,
          minSize: amounts ? parseFloat(amounts[1].replace(',', '')) : null,
          investAmount: amounts ? parseFloat(amounts[2].replace(',', '')) : null,
          currency: 'KRW',
          region: '한국'
        });
      }
    }

    // 운용사명만 있는 줄도 추출 (공동GP의 경우 다음 줄에 나옴)
    const companyOnlyMatch = line.match(/^\s+([가-힣A-Za-z]+(?:인베스트먼트|벤처스|파트너스|투자|캐피탈|기술지주|증권|자산운용|혁신센터|지주회사|벤처투자|인베스터|소셜컴퍼니|투자금융|투자파트너스|생명과학|벤처캐피탈|벤처파트너스|아처))\s*$/);

    if (companyOnlyMatch) {
      const name = companyOnlyMatch[1].trim();
      if (!selected.find(s => s.name === name)) {
        selected.push({
          name: name,
          category: currentCategory,
          minSize: null,
          investAmount: null,
          currency: 'KRW',
          region: '한국'
        });
      }
    }
  }

  return selected;
}

// 운용사명 정규화
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[,.\-()\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 메인 처리 함수
async function processPair(applicationFileNo, selectionFileNo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`접수현황(${applicationFileNo}) + 선정결과(${selectionFileNo}) 처리 시작`);
  console.log('='.repeat(60));

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

  // PDF 텍스트 추출
  console.log('\n[1] PDF 텍스트 추출 중...');
  const applicationText = extractPdfText(path.join(downloadsDir, applicationFile));
  const selectionText = extractPdfText(path.join(downloadsDir, selectionFile));

  // 텍스트 기반 파싱
  console.log('\n[2] 텍스트 파싱 중...');
  const applicants = parseApplicationPdf(applicationText);
  const selectedList = parseSelectionPdf(selectionText);

  console.log(`  - 접수 운용사: ${applicants.length}개`);
  console.log(`  - 선정 운용사: ${selectedList.length}개`);

  // 사업명 추출
  const projectName = '한국모태펀드(중기부 소관) 2024년 1차 정시 출자사업';

  // 선정된 운용사 이름 세트
  const selectedNames = new Set(selectedList.map(s => normalizeName(s.name)));

  // 선정 데이터 맵
  const selectionMap = new Map();
  for (const s of selectedList) {
    selectionMap.set(normalizeName(s.name), s);
  }

  // 출자사업 조회 (기존 것 사용)
  console.log('\n[3] 출자사업 확인...');
  const project = await sheets.getOrCreateProject(projectName, {
    소관: '중기부',
    공고유형: '정시',
    연도: '2024'
  });
  console.log(`  - 출자사업: ${project.id} (${project.isNew ? '신규 생성' : '기존 사용'})`);

  // 파일DB 조회/생성
  console.log('\n[4] 파일DB 확인...');
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
  console.log(`  - 접수현황 파일: ${appFileHistory.id}`);
  console.log(`  - 선정결과 파일: ${selFileHistory.id}`);

  // 기존 신청현황 조회
  console.log('\n[5] 기존 신청현황 확인...');
  const existingApplications = await sheets.getExistingApplications(project.id);
  console.log(`  - 기존 등록된 신청현황: ${existingApplications.size}건`);

  // 통계
  const stats = {
    newSelected: 0,
    newRejected: 0,
    skippedExisting: 0,
    operatorsCreated: 0,
  };

  // 신청현황 생성
  console.log('\n[6] 신청현황 생성 중...');
  const createdAppIds = [];
  const processedNames = new Set();

  for (const applicant of applicants) {
    const normalizedName = normalizeName(applicant.name);

    // 이미 처리한 이름은 건너뜀
    if (processedNames.has(normalizedName)) continue;
    processedNames.add(normalizedName);

    // 운용사 조회/생성
    const operator = await sheets.getOrCreateOperator(applicant.name, { region: applicant.region });
    if (operator.isNew) stats.operatorsCreated++;

    // 이미 등록된 건인지 확인
    if (existingApplications.has(operator.id)) {
      const existing = existingApplications.get(operator.id);
      console.log(`  [건너뜀] ${applicant.name} - 이미 ${existing.status}으로 등록됨`);
      stats.skippedExisting++;
      continue;
    }

    // 선정 여부 확인
    let isSelected = selectedNames.has(normalizedName);
    let selectionData = selectionMap.get(normalizedName);

    // 부분 매칭으로도 확인
    if (!isSelected) {
      for (const [name, data] of selectionMap) {
        if (name.includes(normalizedName) || normalizedName.includes(name)) {
          isSelected = true;
          selectionData = data;
          break;
        }
      }
    }

    // 상태 및 금액 정보
    const status = isSelected ? '선정' : '탈락';
    const currency = isSelected && selectionData ? '억원' : '';

    // 신청현황 생성
    const appId = await sheets.createApplication({
      출자사업ID: project.id,
      운용사ID: operator.id,
      출자분야: applicant.category,
      결성예정액: isSelected && selectionData ? selectionData.minSize || '' : '',
      출자요청액: isSelected && selectionData ? selectionData.investAmount || '' : '',
      최소결성규모: '',
      통화단위: currency,
      상태: status,
      비고: ''
    });

    createdAppIds.push(appId);

    if (isSelected) {
      console.log(`  [선정] ${applicant.name} (${operator.id}) -> ${appId}`);
      stats.newSelected++;
    } else {
      console.log(`  [탈락] ${applicant.name} (${operator.id}) -> ${appId}`);
      stats.newRejected++;
    }
  }

  // 선정결과에만 있는 운용사 처리
  console.log('\n[6-2] 선정결과에만 있는 운용사 처리...');
  for (const selected of selectedList) {
    const normalizedName = normalizeName(selected.name);

    // 이미 처리됨
    if (processedNames.has(normalizedName)) continue;
    processedNames.add(normalizedName);

    console.log(`  [누락 발견] ${selected.name}`);

    // 운용사 조회/생성
    const operator = await sheets.getOrCreateOperator(selected.name, { region: selected.region });
    if (operator.isNew) stats.operatorsCreated++;

    // 이미 등록된 건인지 확인
    if (existingApplications.has(operator.id)) {
      const existing = existingApplications.get(operator.id);
      console.log(`    → 이미 ${existing.status}으로 등록됨, 건너뜀`);
      stats.skippedExisting++;
      continue;
    }

    // 신청현황 생성 (선정)
    const appId = await sheets.createApplication({
      출자사업ID: project.id,
      운용사ID: operator.id,
      출자분야: selected.category,
      결성예정액: selected.minSize || '',
      출자요청액: selected.investAmount || '',
      최소결성규모: '',
      통화단위: '억원',
      상태: '선정',
      비고: '선정결과에서 추가'
    });

    createdAppIds.push(appId);
    console.log(`  [선정-추가] ${selected.name} (${operator.id}) -> ${appId}`);
    stats.newSelected++;
  }

  // 파일 처리 완료 업데이트
  console.log('\n[7] 파일 처리 완료 업데이트...');
  const now = new Date().toISOString();

  await sheets.updateFileHistory(appFileHistory.id, {
    처리상태: '완료',
    처리일시: now
  });
  await sheets.updateFileHistory(selFileHistory.id, {
    처리상태: '완료',
    처리일시: now
  });

  // 출자사업에 파일ID 연결
  await sheets.updateProjectFileId(project.id, '접수현황', appFileHistory.id);
  await sheets.updateProjectFileId(project.id, '선정결과', selFileHistory.id);

  console.log(`  - ${appFileHistory.id} (접수현황) 처리상태: 완료`);
  console.log(`  - ${selFileHistory.id} (선정결과) 처리상태: 완료`);

  // processed.json 업데이트
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
  console.log('사용법: node src/direct-process.js <접수파일번호> <선정파일번호>');
  console.log('예시: node src/direct-process.js 4076 4116');
  process.exit(1);
}

processPair(args[0], args[1]).catch(error => {
  console.error('오류 발생:', error.message);
  process.exit(1);
});
