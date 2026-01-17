/**
 * 단일 선정결과 파일 검증 스크립트
 *
 * PDF 파일과 Google Sheets 데이터를 비교하여 불일치 항목을 찾습니다.
 *
 * 사용법:
 *   node scripts/verify-single-file.mjs <파일ID>
 *   node scripts/verify-single-file.mjs FH0240
 */

import 'dotenv/config';
import { GoogleSheetsClient } from '../src/core/googleSheets.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// 유사도 계산 (간단한 Levenshtein distance 기반)
function similarity(s1, s2) {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase().replace(/\s/g, '');
  s2 = s2.toLowerCase().replace(/\s/g, '');
  if (s1 === s2) return 100;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;

  // 부분 문자열 매칭
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return Math.round((shorter.length / longer.length) * 100);
  }

  // 간단한 공통 문자 비율
  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }
  return Math.round((matches / longer.length) * 100);
}

// 운용사명 정규화 (접미사 제거)
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
    .replace(/\(주\)$/i, '');
}

// PDF 파싱 (Python 스크립트 호출)
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

// 운용사 매칭 (PDF 이름 → DB 운용사)
function findMatchingOperator(pdfCompany, dbOperators, operatorMap) {
  // 1. 정확히 일치
  for (const [id, op] of operatorMap) {
    if (op['운용사명'] === pdfCompany) {
      return { id, name: op['운용사명'], matchType: 'exact' };
    }
    // 약어 체크
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

// 금액 비교 (허용 오차 1 억원)
function compareAmount(pdfVal, dbVal, tolerance = 1) {
  const pdf = parseFloat(pdfVal) || 0;
  const db = parseFloat(dbVal) || 0;

  if (pdf === 0 && db === 0) return { match: true, pdf, db };
  if (Math.abs(pdf - db) <= tolerance) return { match: true, pdf, db };
  return { match: false, pdf, db, diff: pdf - db };
}

// 메인 검증 함수
async function verifyFile(fileId) {
  console.log(`\n=== 파일 검증 시작: ${fileId} ===\n`);

  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 1. 파일 정보 조회
  const files = await sheets.getAllRows('파일');
  const file = files.find(f => f['ID'] === fileId);

  if (!file) {
    throw new Error(`파일을 찾을 수 없습니다: ${fileId}`);
  }

  if (file['파일유형'] !== '선정결과') {
    throw new Error(`선정결과 파일이 아닙니다: ${file['파일유형']}`);
  }

  console.log(`파일명: ${file['파일명']}`);
  console.log(`파일번호: ${file['파일번호']}`);
  console.log(`처리상태: ${file['처리상태']}`);
  console.log(`현황: ${file['현황']}`);

  // 2. PDF 파일 경로 확인
  const pdfPath = path.join(process.cwd(), 'downloads', file['파일명']);
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF 파일이 없습니다: ${pdfPath}`);
  }

  // 3. PDF 파싱
  console.log(`\nPDF 파싱 중...`);
  const pdfData = await parsePdf(pdfPath);
  console.log(`PDF 선정 운용사: ${pdfData.total_operators}개`);
  console.log(`공동GP: ${pdfData.joint_gp_count}개`);

  // 4. DB 데이터 조회
  const projects = await sheets.getAllRows('출자사업');
  const apps = await sheets.getAllRows('신청현황');
  const operators = await sheets.getAllOperators();
  const operatorMap = new Map(operators.map(op => [op['ID'], op]));

  // 파일과 연결된 출자사업 찾기
  const linkedProjects = projects.filter(p => {
    const resultFileIds = (p['결과파일ID'] || '').split(',').map(s => s.trim());
    return resultFileIds.includes(fileId);
  });

  if (linkedProjects.length === 0) {
    throw new Error(`연결된 출자사업이 없습니다`);
  }

  console.log(`\n연결된 출자사업: ${linkedProjects.length}개`);
  linkedProjects.forEach(p => {
    console.log(`  - ${p['ID']}: ${p['사업명']}`);
  });

  // 연결된 출자사업의 신청현황
  const projectIds = linkedProjects.map(p => p['ID']);
  const projectApps = apps.filter(a => projectIds.includes(a['출자사업ID']));
  const selectedApps = projectApps.filter(a => a['상태'] === '선정');

  console.log(`\nDB 신청현황: ${projectApps.length}건`);
  console.log(`DB 선정: ${selectedApps.length}건`);

  // 5. 비교
  const results = {
    fileId,
    fileName: file['파일명'],
    pdfCount: pdfData.total_operators,
    dbCount: selectedApps.length,
    matches: [],
    mismatches: [],
    pdfOnly: [],
    dbOnly: [],
    amountIssues: []
  };

  // PDF 항목별로 DB 매칭 확인
  const matchedDbIds = new Set();

  for (const pdfItem of pdfData.applications) {
    const match = findMatchingOperator(pdfItem.company, operators, operatorMap);

    if (!match) {
      results.pdfOnly.push({
        company: pdfItem.company,
        category: pdfItem.category,
        amounts: {
          min_formation: pdfItem.min_formation,
          mo_tae: pdfItem.mo_tae,
          fund_size: pdfItem.fund_size,
          request_amount: pdfItem.request_amount
        }
      });
      continue;
    }

    // DB에서 해당 운용사의 선정 항목 찾기
    const dbItem = selectedApps.find(a =>
      a['운용사ID'] === match.id && !matchedDbIds.has(a['ID'])
    );

    if (!dbItem) {
      results.pdfOnly.push({
        company: pdfItem.company,
        matchedOperator: match,
        category: pdfItem.category,
        reason: 'DB에 선정 상태 항목 없음'
      });
      continue;
    }

    matchedDbIds.add(dbItem['ID']);

    // 금액 비교
    // PDF 파서 결과는 순서대로: [첫번째숫자, 두번째숫자, 세번째숫자, 네번째숫자]
    // PDF 컬럼 순서는 문서마다 다를 수 있음:
    //   - 유형1: 최소결성규모, 모태출자액 (2컬럼)
    //   - 유형2: 결성예정액, 출자요청액 (2컬럼)
    //   - 유형3: 최소결성규모, 모태출자액, 결성예정액, 출자요청액 (4컬럼)
    // 파서가 min_formation, mo_tae, fund_size, request_amount 순으로 매핑하지만
    // 실제로는 첫번째 숫자가 최소결성규모, 두번째가 모태출자액인 경우가 많음

    // 금액 매핑 보정: 파서 출력 → 실제 필드
    // 파서가 mo_tae로 읽은 것이 실제로 최소결성규모일 수 있음
    const pdfAmounts = {
      first: pdfItem.min_formation || pdfItem.mo_tae,  // 첫번째 숫자
      second: pdfItem.mo_tae || pdfItem.fund_size,     // 두번째 숫자
      third: pdfItem.fund_size,                         // 세번째 숫자
      fourth: pdfItem.request_amount                    // 네번째 숫자
    };

    // 컬럼 수에 따른 매핑
    const numAmounts = [pdfItem.min_formation, pdfItem.mo_tae, pdfItem.fund_size, pdfItem.request_amount]
      .filter(v => v !== null && v !== undefined).length;

    let amountChecks = [];
    if (numAmounts === 2) {
      // 2컬럼: 최소결성규모, 모태출자액 (중기부 정시 등)
      amountChecks = [
        { field: '최소결성규모', pdf: pdfItem.mo_tae, db: dbItem['최소결성규모'] },
        { field: '모태출자액', pdf: pdfItem.fund_size, db: dbItem['모태출자액'] }
      ];
    } else if (numAmounts === 4) {
      // 4컬럼: 전체
      amountChecks = [
        { field: '최소결성규모', pdf: pdfItem.min_formation, db: dbItem['최소결성규모'] },
        { field: '모태출자액', pdf: pdfItem.mo_tae, db: dbItem['모태출자액'] },
        { field: '결성예정액', pdf: pdfItem.fund_size, db: dbItem['결성예정액'] },
        { field: '출자요청액', pdf: pdfItem.request_amount, db: dbItem['출자요청액'] }
      ];
    } else {
      // 기타: 원본 매핑
      amountChecks = [
        { field: '최소결성규모', pdf: pdfItem.min_formation, db: dbItem['최소결성규모'] },
        { field: '모태출자액', pdf: pdfItem.mo_tae, db: dbItem['모태출자액'] },
        { field: '결성예정액', pdf: pdfItem.fund_size, db: dbItem['결성예정액'] },
        { field: '출자요청액', pdf: pdfItem.request_amount, db: dbItem['출자요청액'] }
      ];
    }

    const amountIssues = [];
    for (const check of amountChecks) {
      const result = compareAmount(check.pdf, check.db);
      if (!result.match) {
        amountIssues.push({
          field: check.field,
          pdf: result.pdf,
          db: result.db,
          diff: result.diff
        });
      }
    }

    // 금액 필드 누락 체크 (핵심!)
    const minFormation = dbItem['최소결성규모'];
    const fundSize = dbItem['결성예정액'];
    const hasNoAmount = (!minFormation || minFormation === '') && (!fundSize || fundSize === '');

    if (hasNoAmount) {
      amountIssues.push({
        field: '금액필드누락',
        message: '최소결성규모와 결성예정액 모두 비어있음',
        pdfMin: pdfItem.min_formation,
        pdfFund: pdfItem.fund_size
      });
    }

    if (amountIssues.length > 0) {
      results.amountIssues.push({
        appId: dbItem['ID'],
        operatorId: match.id,
        operatorName: match.name,
        pdfCompany: pdfItem.company,
        category: pdfItem.category || dbItem['출자분야'],
        issues: amountIssues
      });
    }

    results.matches.push({
      appId: dbItem['ID'],
      operatorId: match.id,
      operatorName: match.name,
      matchType: match.matchType,
      amountIssues: amountIssues.length
    });
  }

  // DB에만 있는 항목 (PDF에 없음)
  for (const dbItem of selectedApps) {
    if (!matchedDbIds.has(dbItem['ID'])) {
      const op = operatorMap.get(dbItem['운용사ID']);
      results.dbOnly.push({
        appId: dbItem['ID'],
        operatorId: dbItem['운용사ID'],
        operatorName: op?.['운용사명'] || 'Unknown',
        category: dbItem['출자분야']
      });
    }
  }

  // 6. 결과 출력
  console.log(`\n=== 검증 결과 ===`);
  console.log(`매칭 성공: ${results.matches.length}건`);
  console.log(`PDF에만 있음: ${results.pdfOnly.length}건`);
  console.log(`DB에만 있음: ${results.dbOnly.length}건`);
  console.log(`금액 불일치: ${results.amountIssues.length}건`);

  if (results.pdfOnly.length > 0) {
    console.log(`\n[PDF에만 있는 항목]`);
    results.pdfOnly.forEach(item => {
      console.log(`  - ${item.company} (${item.category || '분야미상'})`);
      if (item.reason) console.log(`    원인: ${item.reason}`);
    });
  }

  if (results.dbOnly.length > 0) {
    console.log(`\n[DB에만 있는 항목]`);
    results.dbOnly.forEach(item => {
      console.log(`  - ${item.appId}: ${item.operatorName} (${item.category})`);
    });
  }

  if (results.amountIssues.length > 0) {
    console.log(`\n[금액 불일치 항목]`);
    results.amountIssues.forEach(item => {
      console.log(`  - ${item.appId}: ${item.operatorName}`);
      item.issues.forEach(issue => {
        if (issue.field === '금액필드누락') {
          console.log(`    ⚠️ ${issue.message}`);
          console.log(`       PDF 최소결성: ${issue.pdfMin}, PDF 결성예정: ${issue.pdfFund}`);
        } else {
          console.log(`    ${issue.field}: PDF(${issue.pdf}) ≠ DB(${issue.db})`);
        }
      });
    });
  }

  // 요약
  const hasIssues = results.pdfOnly.length > 0 || results.dbOnly.length > 0 || results.amountIssues.length > 0;
  console.log(`\n=== 요약 ===`);
  if (hasIssues) {
    console.log(`❌ 불일치 발견`);
  } else {
    console.log(`✅ 완전 일치`);
  }

  return results;
}

// CLI 실행
const fileId = process.argv[2];
if (!fileId) {
  console.log('Usage: node scripts/verify-single-file.mjs <파일ID>');
  console.log('Example: node scripts/verify-single-file.mjs FH0240');
  process.exit(1);
}

verifyFile(fileId)
  .then(results => {
    // JSON 결과 저장
    const outputPath = `verification-${fileId}.json`;
    import('fs').then(fs => {
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`\n결과 저장됨: ${outputPath}`);
    });
  })
  .catch(err => {
    console.error('검증 실패:', err.message);
    process.exit(1);
  });
