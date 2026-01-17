/**
 * 전수조사 스크립트 - 모든 선정결과 파일 검증
 *
 * 모든 선정결과 파일(처리완료)과 Google Sheets 데이터를 비교하여
 * 불일치 항목을 찾고 리포트를 생성합니다.
 *
 * 사용법:
 *   node scripts/verify-all-selections.mjs
 *   node scripts/verify-all-selections.mjs --limit 10  # 처음 10개만
 *   node scripts/verify-all-selections.mjs --from FH0050  # 특정 파일부터
 */

import 'dotenv/config';
import { GoogleSheetsClient } from '../src/core/googleSheets.js';
import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import path from 'path';

// 유사도 계산
function similarity(s1, s2) {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase().replace(/\s/g, '');
  s2 = s2.toLowerCase().replace(/\s/g, '');
  if (s1 === s2) return 100;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return Math.round((shorter.length / longer.length) * 100);
  }

  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }
  return Math.round((matches / longer.length) * 100);
}

// 운용사명 정규화
function normalizeOperatorName(name) {
  if (!name) return '';
  return name
    .replace(/\s+/g, '')
    .replace(/인베스트먼트$/i, '')
    .replace(/벤처스$/i, '')
    .replace(/파트너스$/i, '')
    .replace(/캐피탈$/i, '')
    .replace(/자산운용$/i, '')
    .replace(/투자$/i, '')
    .replace(/(주)$/i, '')
    .replace(/\(주\)$/i, '')
    .replace(/유한회사$/i, '');
}

// PDF 파싱
async function parsePdf(pdfPath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'src/processors/pdf-parser.py');
    const proc = spawn('python', [pythonScript, pdfPath, '--selection'], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PDF 파싱 실패: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON 파싱 실패: ${e.message}`));
      }
    });
  });
}

// 운용사 매칭
function findMatchingOperator(pdfCompany, operatorMap) {
  // 1. 정확히 일치
  for (const [id, op] of operatorMap) {
    if (op['운용사명'] === pdfCompany) {
      return { id, name: op['운용사명'], matchType: 'exact' };
    }
    const aliases = (op['약어'] || '').split(',').map(s => s.trim());
    if (aliases.includes(pdfCompany)) {
      return { id, name: op['운용사명'], matchType: 'alias' };
    }
  }

  // 2. 정규화 후 일치
  const normalizedPdf = normalizeOperatorName(pdfCompany);
  for (const [id, op] of operatorMap) {
    const normalizedDb = normalizeOperatorName(op['운용사명']);
    if (normalizedPdf === normalizedDb) {
      return { id, name: op['운용사명'], matchType: 'normalized' };
    }
  }

  // 3. 유사도 85% 이상
  let bestMatch = null;
  let bestScore = 0;
  for (const [id, op] of operatorMap) {
    const score = similarity(pdfCompany, op['운용사명']);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { id, name: op['운용사명'], matchType: 'similar', score };
    }
  }

  if (bestScore >= 85) {
    return bestMatch;
  }

  return null;
}

// 금액 비교
function compareAmount(pdfVal, dbVal, tolerance = 1) {
  const pdf = parseFloat(pdfVal) || 0;
  const db = parseFloat(dbVal) || 0;

  if (pdf === 0 && db === 0) return { match: true, pdf, db };
  if (Math.abs(pdf - db) <= tolerance) return { match: true, pdf, db };
  return { match: false, pdf, db, diff: pdf - db };
}

// 단일 파일 검증
async function verifyFile(file, sheets, operatorMap, apps, projects) {
  const fileId = file['ID'];
  const result = {
    fileId,
    fileName: file['파일명'],
    fileNumber: file['파일번호'],
    status: 'success',
    pdfCount: 0,
    dbCount: 0,
    matchCount: 0,
    pdfOnly: [],
    dbOnly: [],
    amountIssues: [],
    missingAmountFields: []
  };

  try {
    // PDF 경로 확인
    const pdfPath = path.join(process.cwd(), 'downloads', file['파일명']);
    if (!existsSync(pdfPath)) {
      result.status = 'pdf_not_found';
      result.error = `PDF 파일 없음: ${file['파일명']}`;
      return result;
    }

    // PDF 파싱
    let pdfData;
    try {
      pdfData = await parsePdf(pdfPath);
    } catch (e) {
      result.status = 'parse_error';
      result.error = e.message;
      return result;
    }

    result.pdfCount = pdfData.total_operators;

    // 연결된 출자사업 찾기
    const linkedProjects = projects.filter(p => {
      const resultFileIds = (p['결과파일ID'] || '').split(',').map(s => s.trim());
      return resultFileIds.includes(fileId);
    });

    if (linkedProjects.length === 0) {
      result.status = 'no_linked_project';
      result.error = '연결된 출자사업 없음';
      return result;
    }

    result.linkedProjects = linkedProjects.map(p => ({ id: p['ID'], name: p['사업명'] }));

    // 신청현황 조회
    const projectIds = linkedProjects.map(p => p['ID']);
    const projectApps = apps.filter(a => projectIds.includes(a['출자사업ID']));
    const selectedApps = projectApps.filter(a => a['상태'] === '선정');

    result.dbCount = selectedApps.length;

    // 비교
    const matchedDbIds = new Set();

    // 제목 줄 필터링 (파서가 제목을 운용사로 잘못 인식하는 경우)
    const filteredPdfApps = pdfData.applications.filter(item => {
      const company = item.company || '';
      // 제목 패턴 필터링
      if (company.includes('출자사업') || company.includes('선정 결과') ||
          company.includes('모태펀드') || company.includes('벤처펀드')) {
        return false;
      }
      return true;
    });

    for (const pdfItem of filteredPdfApps) {
      const match = findMatchingOperator(pdfItem.company, operatorMap);

      if (!match) {
        result.pdfOnly.push({
          company: pdfItem.company,
          category: pdfItem.category
        });
        continue;
      }

      // DB에서 해당 운용사의 선정 항목 찾기
      const dbItem = selectedApps.find(a =>
        a['운용사ID'] === match.id && !matchedDbIds.has(a['ID'])
      );

      if (!dbItem) {
        result.pdfOnly.push({
          company: pdfItem.company,
          matchedOperator: match,
          category: pdfItem.category,
          reason: 'DB에 선정 상태 항목 없음'
        });
        continue;
      }

      matchedDbIds.add(dbItem['ID']);
      result.matchCount++;

      // 금액 필드 누락 체크 (핵심!)
      const minFormation = dbItem['최소결성규모'];
      const fundSize = dbItem['결성예정액'];
      const hasNoAmount = (!minFormation || minFormation === '') && (!fundSize || fundSize === '');

      if (hasNoAmount) {
        result.missingAmountFields.push({
          appId: dbItem['ID'],
          operatorId: match.id,
          operatorName: match.name,
          category: dbItem['출자분야'],
          pdfAmounts: {
            min_formation: pdfItem.min_formation,
            mo_tae: pdfItem.mo_tae,
            fund_size: pdfItem.fund_size,
            request_amount: pdfItem.request_amount
          }
        });
      }

      // 금액 비교
      const numAmounts = [pdfItem.min_formation, pdfItem.mo_tae, pdfItem.fund_size, pdfItem.request_amount]
        .filter(v => v !== null && v !== undefined).length;

      let amountChecks = [];
      if (numAmounts === 2) {
        amountChecks = [
          { field: '최소결성규모', pdf: pdfItem.mo_tae, db: dbItem['최소결성규모'] },
          { field: '모태출자액', pdf: pdfItem.fund_size, db: dbItem['모태출자액'] }
        ];
      } else if (numAmounts >= 3) {
        amountChecks = [
          { field: '최소결성규모', pdf: pdfItem.min_formation, db: dbItem['최소결성규모'] },
          { field: '모태출자액', pdf: pdfItem.mo_tae, db: dbItem['모태출자액'] },
          { field: '결성예정액', pdf: pdfItem.fund_size, db: dbItem['결성예정액'] },
          { field: '출자요청액', pdf: pdfItem.request_amount, db: dbItem['출자요청액'] }
        ];
      }

      const issues = [];
      for (const check of amountChecks) {
        const cmp = compareAmount(check.pdf, check.db);
        if (!cmp.match && check.pdf !== null && check.pdf !== undefined) {
          issues.push({
            field: check.field,
            pdf: cmp.pdf,
            db: cmp.db
          });
        }
      }

      if (issues.length > 0) {
        result.amountIssues.push({
          appId: dbItem['ID'],
          operatorId: match.id,
          operatorName: match.name,
          issues
        });
      }
    }

    // DB에만 있는 항목
    for (const dbItem of selectedApps) {
      if (!matchedDbIds.has(dbItem['ID'])) {
        const op = operatorMap.get(dbItem['운용사ID']);
        result.dbOnly.push({
          appId: dbItem['ID'],
          operatorId: dbItem['운용사ID'],
          operatorName: op?.['운용사명'] || 'Unknown',
          category: dbItem['출자분야']
        });
      }
    }

  } catch (e) {
    result.status = 'error';
    result.error = e.message;
  }

  return result;
}

// 메인 실행
async function main() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let fromFileId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === '--from' && args[i + 1]) {
      fromFileId = args[i + 1];
    }
  }

  console.log('=== 선정결과 전수조사 시작 ===\n');

  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 데이터 로드
  console.log('데이터 로드 중...');
  const [files, projects, apps, operators] = await Promise.all([
    sheets.getAllRows('파일'),
    sheets.getAllRows('출자사업'),
    sheets.getAllRows('신청현황'),
    sheets.getAllOperators()
  ]);

  const operatorMap = new Map(operators.map(op => [op['ID'], op]));

  // 선정결과 파일 필터링
  let selectionFiles = files.filter(f =>
    f['파일유형'] === '선정결과' && f['처리상태'] === '완료'
  );

  // 정렬 (파일ID 순)
  selectionFiles.sort((a, b) => a['ID'].localeCompare(b['ID']));

  // from 옵션 처리
  if (fromFileId) {
    const startIdx = selectionFiles.findIndex(f => f['ID'] === fromFileId);
    if (startIdx >= 0) {
      selectionFiles = selectionFiles.slice(startIdx);
    }
  }

  // limit 적용
  if (limit < Infinity) {
    selectionFiles = selectionFiles.slice(0, limit);
  }

  console.log(`대상 파일: ${selectionFiles.length}개\n`);

  // 전수조사 실행
  const allResults = [];
  const summary = {
    total: selectionFiles.length,
    success: 0,
    pdfNotFound: 0,
    parseError: 0,
    noLinkedProject: 0,
    error: 0,
    filesWithIssues: 0,
    totalMissingAmountFields: 0,
    totalAmountMismatches: 0,
    totalPdfOnly: 0,
    totalDbOnly: 0
  };

  for (let i = 0; i < selectionFiles.length; i++) {
    const file = selectionFiles[i];
    process.stdout.write(`[${i + 1}/${selectionFiles.length}] ${file['ID']} (${file['파일번호']})... `);

    const result = await verifyFile(file, sheets, operatorMap, apps, projects);
    allResults.push(result);

    // 상태별 카운트
    switch (result.status) {
      case 'success':
        summary.success++;
        break;
      case 'pdf_not_found':
        summary.pdfNotFound++;
        break;
      case 'parse_error':
        summary.parseError++;
        break;
      case 'no_linked_project':
        summary.noLinkedProject++;
        break;
      default:
        summary.error++;
    }

    // 이슈 카운트
    if (result.missingAmountFields?.length > 0 ||
        result.amountIssues?.length > 0 ||
        result.pdfOnly?.length > 0 ||
        result.dbOnly?.length > 0) {
      summary.filesWithIssues++;
    }

    summary.totalMissingAmountFields += result.missingAmountFields?.length || 0;
    summary.totalAmountMismatches += result.amountIssues?.length || 0;
    summary.totalPdfOnly += result.pdfOnly?.length || 0;
    summary.totalDbOnly += result.dbOnly?.length || 0;

    // 진행 상태 출력
    if (result.status === 'success') {
      const issues = (result.missingAmountFields?.length || 0) +
                     (result.amountIssues?.length || 0) +
                     (result.pdfOnly?.length || 0) +
                     (result.dbOnly?.length || 0);
      if (issues > 0) {
        console.log(`⚠️ ${issues}건 이슈`);
      } else {
        console.log('✅');
      }
    } else {
      console.log(`❌ ${result.status}`);
    }

    // API 할당량 고려 딜레이
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 결과 요약 출력
  console.log('\n=== 전수조사 결과 요약 ===\n');
  console.log(`총 파일: ${summary.total}개`);
  console.log(`성공: ${summary.success}개`);
  console.log(`PDF 없음: ${summary.pdfNotFound}개`);
  console.log(`파싱 오류: ${summary.parseError}개`);
  console.log(`연결된 사업 없음: ${summary.noLinkedProject}개`);
  console.log(`기타 오류: ${summary.error}개`);
  console.log('');
  console.log(`이슈 있는 파일: ${summary.filesWithIssues}개`);
  console.log(`금액 필드 누락: ${summary.totalMissingAmountFields}건`);
  console.log(`금액 불일치: ${summary.totalAmountMismatches}건`);
  console.log(`PDF에만 있음: ${summary.totalPdfOnly}건`);
  console.log(`DB에만 있음: ${summary.totalDbOnly}건`);

  // 상세 결과 저장
  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    results: allResults
  };

  writeFileSync('verification-report.json', JSON.stringify(report, null, 2));
  console.log('\n상세 결과 저장됨: verification-report.json');

  // 금액 필드 누락 목록 출력
  if (summary.totalMissingAmountFields > 0) {
    console.log('\n=== 금액 필드 누락 상세 ===');
    for (const result of allResults) {
      if (result.missingAmountFields?.length > 0) {
        console.log(`\n[${result.fileId}] ${result.fileName}`);
        for (const item of result.missingAmountFields) {
          console.log(`  - ${item.appId}: ${item.operatorName} (${item.category})`);
          console.log(`    PDF: 최소=${item.pdfAmounts.min_formation}, 모태=${item.pdfAmounts.mo_tae}, 결성=${item.pdfAmounts.fund_size}`);
        }
      }
    }
  }
}

main().catch(err => {
  console.error('전수조사 실패:', err);
  process.exit(1);
});
