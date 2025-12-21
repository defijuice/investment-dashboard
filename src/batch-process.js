/**
 * PDF 직접 파싱 및 Google Sheets 배치 저장 스크립트
 * - 공동GP를 각각 별도의 신청현황으로 처리
 * - PDF 상단의 개수 정보로 검증
 * - API 호출 최소화를 위해 배치 처리
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

/**
 * PDF 상단에서 개수 정보 추출
 * @param {string} text - PDF 텍스트
 * @param {string} type - 'application' 또는 'selection'
 * @returns {Object} { totalCount, totalAmount, ... }
 */
function extractPdfSummary(text, type) {
  const summary = {
    totalCount: null,
    totalMinSize: null,
    totalInvestAmount: null,
  };

  if (type === 'application') {
    // "신청조합 149개, 결성예정액 3조 4,477.3억원, 출자요청액 1조 8,533억원"
    const countMatch = text.match(/신청조합\s*([\d,]+)\s*개/);
    if (countMatch) {
      summary.totalCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
    }
  } else if (type === 'selection') {
    // "선정 조합 수 43개, 최소결성규모 7,835.29억원, 모태출자액 4,160억원"
    const countMatch = text.match(/선정\s*조합\s*수?\s*([\d,]+)\s*개/);
    if (countMatch) {
      summary.totalCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
    }
  }

  return summary;
}

/**
 * 공동GP를 분리하여 각각의 운용사로 반환
 * @param {string} line - 운용사명이 포함된 줄
 * @returns {string[]} 분리된 운용사명 배열
 */
function splitJointGP(line) {
  // "송현인베스트먼트 / 바로벤처스" -> ["송현인베스트먼트", "바로벤처스"]
  // "엠와이소셜컴퍼니 / 카이스트청년창업투자지주" -> ["엠와이소셜컴퍼니", "카이스트청년창업투자지주"]
  return line.split(/\s*\/\s*/).map(s => s.trim()).filter(s => s.length > 0);
}

// 접수현황 PDF 파싱 (공동GP 분리 포함)
function parseApplicationPdf(text) {
  const applicants = [];
  const lines = text.split('\n');
  let currentCategory = '';

  const categoryPatterns = [
    { pattern: /루키리그/, name: '루키리그' },
    { pattern: /스케일업.*중견도약/, name: '스케일업·중견도약' },
    { pattern: /여성기업/, name: '여성기업' },
    { pattern: /임팩트/, name: '임팩트' },
    { pattern: /재도약/, name: '재도약' },
    { pattern: /청년창업/, name: '청년창업' },
    { pattern: /창업초기/, name: '창업초기' },
    { pattern: /소재부품장비/, name: '소재부품장비' },
    { pattern: /지역\s*창업초기/, name: '지역 창업초기' },
    { pattern: /라이콘/, name: '라이콘' },
    { pattern: /지역AC세컨더리/, name: '지역AC세컨더리' },
    { pattern: /지역/, name: '지역' }
  ];

  // 회사명 패턴 (더 포괄적으로)
  const companyPattern = /([가-힣A-Za-z0-9]+(?:인베스트먼트|벤처스|파트너스|투자|캐피탈|기술지주|증권|자산운용|혁신센터|지주회사|벤처투자|인베스터|소셜컴퍼니|투자금융|투자파트너스|생명과학|벤처캐피탈|벤처파트너스|스퀘어|가치투자|인베스트|엑셀|큐브|뱅크|게이트))/g;

  for (const line of lines) {
    // 카테고리 감지
    for (const cat of categoryPatterns) {
      if (cat.pattern.test(line)) {
        currentCategory = cat.name;
        break;
      }
    }

    // 헤더 라인 건너뛰기
    if (line.includes('운용사명') || line.includes('결성예정액') || line.includes('출자요청액')) {
      continue;
    }

    // 공동GP 분리
    const partners = splitJointGP(line);

    for (const partnerLine of partners) {
      const companyMatch = partnerLine.match(companyPattern);
      if (companyMatch) {
        for (const name of companyMatch) {
          const trimmedName = name.trim();
          // 중복 체크 (동일 운용사 + 동일 분야)
          const key = `${trimmedName}|${currentCategory}`;
          if (!applicants.find(a => `${a.name}|${a.category}` === key) && trimmedName.length > 2) {
            applicants.push({
              name: trimmedName,
              category: currentCategory,
              region: '한국'
            });
          }
        }
      }
    }
  }

  return applicants;
}

// 선정결과 PDF 파싱 (공동GP 분리 포함)
function parseSelectionPdf(text) {
  const selected = [];
  const lines = text.split('\n');
  let currentCategory = '';
  let lastMinSize = null;
  let lastInvestAmount = null;

  const categoryPatterns = [
    { pattern: /루키리그/, name: '루키리그' },
    { pattern: /스케일업.*중견도약/, name: '스케일업·중견도약' },
    { pattern: /여성기업/, name: '여성기업' },
    { pattern: /임팩트/, name: '임팩트' },
    { pattern: /재도약/, name: '재도약' },
    { pattern: /청년창업/, name: '청년창업' },
    { pattern: /창업초기/, name: '창업초기' },
    { pattern: /소재부품장비/, name: '소재부품장비' },
    { pattern: /지역\s*창업초기/, name: '지역 창업초기' },
    { pattern: /라이콘/, name: '라이콘' },
    { pattern: /지역AC세컨더리/, name: '지역AC세컨더리' }
  ];

  const companyPattern = /([가-힣A-Za-z0-9]+(?:인베스트먼트|벤처스|파트너스|투자|캐피탈|기술지주|증권|자산운용|혁신센터|지주회사|벤처투자|인베스터|소셜컴퍼니|투자금융|투자파트너스|생명과학|벤처캐피탈|벤처파트너스|아처))/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 카테고리 감지
    for (const cat of categoryPatterns) {
      if (cat.pattern.test(line)) {
        currentCategory = cat.name;
        break;
      }
    }

    // 헤더 라인 건너뛰기
    if (line.includes('운용사명') || line.includes('모태출자액') || line.includes('결성규모')) {
      continue;
    }

    // 금액 + 운용사명 패턴 (공동GP 첫 번째)
    const amountMatch = line.match(/([\d,.]+)\s+([\d,.]+)\s+(.+)/);
    if (amountMatch) {
      lastMinSize = parseFloat(amountMatch[1].replace(/,/g, ''));
      lastInvestAmount = parseFloat(amountMatch[2].replace(/,/g, ''));

      const partnerText = amountMatch[3];
      const partners = splitJointGP(partnerText);

      for (const partnerLine of partners) {
        const companyMatch = partnerLine.match(companyPattern);
        if (companyMatch) {
          for (const name of companyMatch) {
            const trimmedName = name.trim();
            if (!selected.find(s => s.name === trimmedName && s.category === currentCategory) && trimmedName.length > 2) {
              selected.push({
                name: trimmedName,
                category: currentCategory,
                minSize: lastMinSize,
                investAmount: lastInvestAmount,
                currency: 'KRW',
                region: '한국'
              });
            }
          }
        }
      }
      continue;
    }

    // 운용사명만 있는 줄 (공동GP 두 번째 줄)
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.match(/^[\d,.]+/) && !trimmedLine.includes('계정')) {
      const partners = splitJointGP(trimmedLine);
      for (const partnerLine of partners) {
        const companyMatch = partnerLine.match(companyPattern);
        if (companyMatch) {
          for (const name of companyMatch) {
            const trimmedName = name.trim();
            if (!selected.find(s => s.name === trimmedName && s.category === currentCategory) && trimmedName.length > 2) {
              selected.push({
                name: trimmedName,
                category: currentCategory,
                minSize: lastMinSize,  // 이전 줄의 금액 사용 (공동GP)
                investAmount: lastInvestAmount,
                currency: 'KRW',
                region: '한국'
              });
            }
          }
        }
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

// 메인 처리 함수 (배치 방식)
async function processPair(applicationFileNo, selectionFileNo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`접수현황(${applicationFileNo}) + 선정결과(${selectionFileNo}) 배치 처리 시작`);
  console.log('='.repeat(60));

  // Google Sheets 초기화
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 파일 찾기
  const downloadsDir = path.join(process.cwd(), 'downloads');
  const files = fs.readdirSync(downloadsDir);

  const applicationFile = files.find(f => f.startsWith(applicationFileNo) && f.endsWith('.pdf'));
  const selectionFile = files.find(f => f.startsWith(selectionFileNo) && f.endsWith('.pdf'));

  if (!applicationFile || !selectionFile) {
    throw new Error(`파일을 찾을 수 없습니다`);
  }

  console.log(`\n접수현황 파일: ${applicationFile}`);
  console.log(`선정결과 파일: ${selectionFile}`);

  // PDF 텍스트 추출
  console.log('\n[1] PDF 텍스트 추출 중...');
  const applicationText = extractPdfText(path.join(downloadsDir, applicationFile));
  const selectionText = extractPdfText(path.join(downloadsDir, selectionFile));

  // PDF 요약 정보 추출 (검증용)
  const appSummary = extractPdfSummary(applicationText, 'application');
  const selSummary = extractPdfSummary(selectionText, 'selection');

  console.log(`\n[2] PDF 요약 정보:`);
  console.log(`  - 접수현황 PDF 기준 신청조합: ${appSummary.totalCount || '(추출 실패)'}개`);
  console.log(`  - 선정결과 PDF 기준 선정조합: ${selSummary.totalCount || '(추출 실패)'}개`);

  // 텍스트 기반 파싱 (공동GP 분리 포함)
  console.log('\n[3] 텍스트 파싱 중 (공동GP 분리)...');
  const applicants = parseApplicationPdf(applicationText);
  const selectedList = parseSelectionPdf(selectionText);

  console.log(`  - 접수 운용사 (파싱): ${applicants.length}개`);
  console.log(`  - 선정 운용사 (파싱): ${selectedList.length}개`);

  // 개수 검증
  if (appSummary.totalCount && applicants.length !== appSummary.totalCount) {
    console.log(`\n⚠️  경고: 접수현황 개수 불일치!`);
    console.log(`   PDF 기준: ${appSummary.totalCount}개, 파싱 결과: ${applicants.length}개`);
    console.log(`   차이: ${Math.abs(appSummary.totalCount - applicants.length)}개`);
  }

  if (selSummary.totalCount && selectedList.length !== selSummary.totalCount) {
    console.log(`\n⚠️  경고: 선정결과 개수 불일치!`);
    console.log(`   PDF 기준: ${selSummary.totalCount}개, 파싱 결과: ${selectedList.length}개`);
    console.log(`   차이: ${Math.abs(selSummary.totalCount - selectedList.length)}개`);
  }

  // 기존 데이터 조회 (1회 호출)
  console.log('\n[4] 기존 데이터 조회...');
  const existingOperators = await sheets.getAllRows('운용사');
  const existingProjects = await sheets.getAllRows('출자사업');
  const existingApplications = await sheets.getAllRows('신청현황');
  const existingFiles = await sheets.getAllRows('파일');

  console.log(`  - 기존 운용사: ${existingOperators.length}건`);
  console.log(`  - 기존 출자사업: ${existingProjects.length}건`);
  console.log(`  - 기존 신청현황: ${existingApplications.length}건`);
  console.log(`  - 기존 파일: ${existingFiles.length}건`);

  // 기존 데이터 맵 생성
  const operatorMap = new Map(); // name -> ID
  for (const op of existingOperators) {
    operatorMap.set(op['운용사명'], op['ID']);
  }

  // 선정된 운용사 맵 (이름+분야 -> 데이터)
  const selectionMap = new Map();
  for (const s of selectedList) {
    const key = `${normalizeName(s.name)}|${s.category}`;
    selectionMap.set(key, s);
    // 분야 없이도 찾을 수 있도록
    selectionMap.set(normalizeName(s.name), s);
  }

  // 사업명 추출 (PDF에서)
  let projectName = '';
  const titleMatch = applicationText.match(/(한국모태펀드[^]*?20\d{2}년[^]*?출자사업)/);
  if (titleMatch) {
    projectName = titleMatch[1].replace(/\s+/g, ' ').replace(/접수\s*현황.*/, '').trim();
  }
  if (!projectName) {
    projectName = `모태펀드 출자사업 (파일 ${applicationFileNo})`;
  }

  // 출자사업 확인/생성
  let projectId = existingProjects.find(p => p['사업명'] === projectName)?.['ID'];
  const newProjectRows = [];
  if (!projectId) {
    const lastNum = existingProjects.length > 0
      ? parseInt(existingProjects[existingProjects.length - 1]['ID'].replace('PJ', ''), 10)
      : 0;
    projectId = `PJ${String(lastNum + 1).padStart(4, '0')}`;

    // 연도 추출
    const yearMatch = projectName.match(/20\d{2}/);
    const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();

    newProjectRows.push([projectId, projectName, '중기부', '정시', year, '', '', '']);
    console.log(`\n[5] 출자사업 생성: ${projectId} - ${projectName}`);
  } else {
    console.log(`\n[5] 기존 출자사업 사용: ${projectId}`);
  }

  // 파일 이력 확인/생성
  let appFileId = existingFiles.find(f => f['파일번호'] === applicationFileNo)?.['ID'];
  let selFileId = existingFiles.find(f => f['파일번호'] === selectionFileNo)?.['ID'];
  const newFileRows = [];
  const lastFileNum = existingFiles.length > 0
    ? parseInt(existingFiles[existingFiles.length - 1]['ID'].replace('FH', ''), 10)
    : 0;
  let fileCounter = lastFileNum;

  if (!appFileId) {
    fileCounter++;
    appFileId = `FH${String(fileCounter).padStart(4, '0')}`;
    newFileRows.push([appFileId, applicationFile, applicationFileNo, '접수현황', '', '처리중', '', '']);
  }
  if (!selFileId) {
    fileCounter++;
    selFileId = `FH${String(fileCounter).padStart(4, '0')}`;
    newFileRows.push([selFileId, selectionFile, selectionFileNo, '선정결과', '', '처리중', '', '']);
  }

  console.log(`  - 접수현황 파일: ${appFileId}`);
  console.log(`  - 선정결과 파일: ${selFileId}`);

  // 새 운용사 행 준비
  const newOperatorRows = [];
  let lastOpNum = existingOperators.length > 0
    ? parseInt(existingOperators[existingOperators.length - 1]['ID'].replace('OP', ''), 10)
    : 0;

  // 새 신청현황 행 준비
  const newApplicationRows = [];
  let lastAppNum = existingApplications.length > 0
    ? parseInt(existingApplications[existingApplications.length - 1]['ID'].replace('AP', ''), 10)
    : 0;

  // 이미 등록된 신청현황 체크용 맵 (운용사ID + 분야)
  const existingAppMap = new Set();
  for (const app of existingApplications) {
    if (app['출자사업ID'] === projectId) {
      const key = `${app['운용사ID']}|${app['출자분야']}`;
      existingAppMap.add(key);
    }
  }

  // 통계
  const stats = {
    newSelected: 0,
    newRejected: 0,
    skippedExisting: 0,
    operatorsCreated: 0,
  };

  // 모든 접수 운용사 처리
  console.log('\n[6] 신청현황 데이터 준비 중...');

  for (const applicant of applicants) {
    const normalizedName = normalizeName(applicant.name);

    // 운용사 ID 확인/생성
    let operatorId = operatorMap.get(applicant.name);
    if (!operatorId) {
      lastOpNum++;
      operatorId = `OP${String(lastOpNum).padStart(4, '0')}`;
      operatorMap.set(applicant.name, operatorId);
      newOperatorRows.push([operatorId, applicant.name, '', '국내VC', '한국']);
      stats.operatorsCreated++;
    }

    // 이미 등록된 건인지 확인 (운용사 + 분야)
    const appKey = `${operatorId}|${applicant.category}`;
    if (existingAppMap.has(appKey)) {
      stats.skippedExisting++;
      continue;
    }
    existingAppMap.add(appKey);  // 중복 방지

    // 선정 여부 확인 (이름+분야로 먼저 찾고, 없으면 이름만으로)
    const selKey = `${normalizedName}|${applicant.category}`;
    let selectionData = selectionMap.get(selKey) || selectionMap.get(normalizedName);
    let isSelected = !!selectionData;

    // 부분 매칭
    if (!isSelected) {
      for (const [key, data] of selectionMap) {
        if (key.includes(normalizedName) || normalizedName.includes(key.split('|')[0])) {
          isSelected = true;
          selectionData = data;
          break;
        }
      }
    }

    const status = isSelected ? '선정' : '탈락';
    const currency = isSelected ? '억원' : '';

    lastAppNum++;
    const appId = `AP${String(lastAppNum).padStart(4, '0')}`;

    newApplicationRows.push([
      appId,
      projectId,
      operatorId,
      applicant.category,
      isSelected && selectionData ? (selectionData.minSize || '') : '',
      isSelected && selectionData ? (selectionData.investAmount || '') : '',
      '',
      currency,
      status,
      ''
    ]);

    if (isSelected) {
      stats.newSelected++;
    } else {
      stats.newRejected++;
    }
  }

  // 선정결과에만 있는 운용사 처리
  for (const selected of selectedList) {
    const normalizedName = normalizeName(selected.name);

    // 운용사 ID 확인/생성
    let operatorId = operatorMap.get(selected.name);
    if (!operatorId) {
      lastOpNum++;
      operatorId = `OP${String(lastOpNum).padStart(4, '0')}`;
      operatorMap.set(selected.name, operatorId);
      newOperatorRows.push([operatorId, selected.name, '', '국내VC', '한국']);
      stats.operatorsCreated++;
    }

    // 이미 등록된 건인지 확인
    const appKey = `${operatorId}|${selected.category}`;
    if (existingAppMap.has(appKey)) {
      continue;
    }
    existingAppMap.add(appKey);

    lastAppNum++;
    const appId = `AP${String(lastAppNum).padStart(4, '0')}`;

    newApplicationRows.push([
      appId,
      projectId,
      operatorId,
      selected.category,
      selected.minSize || '',
      selected.investAmount || '',
      '',
      '억원',
      '선정',
      '선정결과에서 추가'
    ]);

    stats.newSelected++;
  }

  // 배치 저장
  console.log('\n[7] 데이터 배치 저장 중...');

  if (newProjectRows.length > 0) {
    await sheets.appendRows('출자사업', newProjectRows);
    console.log(`  - 출자사업: ${newProjectRows.length}건 추가`);
  }

  if (newFileRows.length > 0) {
    await sheets.appendRows('파일', newFileRows);
    console.log(`  - 파일: ${newFileRows.length}건 추가`);
  }

  if (newOperatorRows.length > 0) {
    // 배치 크기로 나누어 저장 (API 제한 회피)
    const batchSize = 50;
    for (let i = 0; i < newOperatorRows.length; i += batchSize) {
      const batch = newOperatorRows.slice(i, i + batchSize);
      await sheets.appendRows('운용사', batch);
      console.log(`  - 운용사: ${i + batch.length}/${newOperatorRows.length}건 추가`);
      if (i + batchSize < newOperatorRows.length) {
        await new Promise(r => setTimeout(r, 1000)); // 1초 대기
      }
    }
  }

  if (newApplicationRows.length > 0) {
    // 배치 크기로 나누어 저장
    const batchSize = 50;
    for (let i = 0; i < newApplicationRows.length; i += batchSize) {
      const batch = newApplicationRows.slice(i, i + batchSize);
      await sheets.appendRows('신청현황', batch);
      console.log(`  - 신청현황: ${i + batch.length}/${newApplicationRows.length}건 추가`);
      if (i + batchSize < newApplicationRows.length) {
        await new Promise(r => setTimeout(r, 1000)); // 1초 대기
      }
    }
  }

  // 출자사업에 파일ID 연결
  console.log('\n[8] 출자사업 파일ID 연결...');
  await sheets.updateProjectFileId(projectId, '접수현황', appFileId);
  await sheets.updateProjectFileId(projectId, '선정결과', selFileId);

  // 파일 처리 완료 업데이트
  console.log('\n[9] 파일 처리 완료 업데이트...');
  const now = new Date().toISOString();

  await sheets.updateFileHistory(appFileId, { 처리상태: '완료', 처리일시: now });
  await sheets.updateFileHistory(selFileId, { 처리상태: '완료', 처리일시: now });

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
  console.log(`  - 총 생성: ${newApplicationRows.length}건`);

  // 최종 검증
  const totalProcessed = stats.newSelected + stats.newRejected + stats.skippedExisting;
  console.log(`\n[검증]`);
  console.log(`  - PDF 기준 신청조합: ${appSummary.totalCount || '?'}개`);
  console.log(`  - 실제 처리: ${totalProcessed}개`);
  if (appSummary.totalCount && totalProcessed !== appSummary.totalCount) {
    console.log(`  ⚠️  차이: ${Math.abs(appSummary.totalCount - totalProcessed)}개 (검토 필요)`);
  } else if (appSummary.totalCount) {
    console.log(`  ✅ 개수 일치!`);
  }

  console.log(`\n스프레드시트: https://docs.google.com/spreadsheets/d/${sheets.spreadsheetId}`);
}

// CLI 실행
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('사용법: node src/batch-process.js <접수파일번호> <선정파일번호>');
  process.exit(1);
}

processPair(args[0], args[1]).catch(error => {
  console.error('오류 발생:', error.message);
  process.exit(1);
});
