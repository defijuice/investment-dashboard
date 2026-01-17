/**
 * 운용사 매칭 검증 도구
 *
 * 출자사업별로 PDF 원본과 Google Sheets 신청현황을 비교하여
 * 운용사 매칭이 정확한지 검증
 *
 * 사용법:
 *   node src/verify-operator-matching.js                    # 전체 검증
 *   node src/verify-operator-matching.js --project PJ0001   # 특정 출자사업만
 *   node src/verify-operator-matching.js --file FH0044      # 특정 파일만
 *   node src/verify-operator-matching.js --threshold 0.7    # 유사도 임계값 조정
 */

import { GoogleSheetsClient } from '../core/googleSheets.js';
import { parsePdfWithPdfplumber } from '../processors/pdf-compare.js';
import { calculateOperatorSimilarity } from '../matchers/operator-matcher.js';
import { VerificationReporter } from '../workflows/verification-report.js';
import { normalizeName } from './normalize.js';
import fs from 'fs';
import path from 'path';

/**
 * CLI 인자 파싱
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    projectId: null,
    fileId: null,
    threshold: 0.85
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      options.projectId = args[i + 1];
      i++;
    } else if (args[i] === '--file' && args[i + 1]) {
      options.fileId = args[i + 1];
      i++;
    } else if (args[i] === '--threshold' && args[i + 1]) {
      options.threshold = parseFloat(args[i + 1]);
      i++;
    }
  }

  return options;
}

// normalizeName은 ./normalize.js에서 import

/**
 * 파일번호로 PDF 파일 찾기
 */
function findPdfByFileNo(fileNo) {
  const downloadsDir = path.join(process.cwd(), 'downloads');

  if (!fs.existsSync(downloadsDir)) {
    return null;
  }

  const files = fs.readdirSync(downloadsDir);
  const pdfFile = files.find(f => f.startsWith(fileNo + '_') && f.endsWith('.pdf'));

  if (!pdfFile) {
    return null;
  }

  return path.join(downloadsDir, pdfFile);
}

/**
 * PDF에서 운용사 목록 추출
 */
function extractOperatorsFromPdf(pdfPath, fileType) {
  const result = parsePdfWithPdfplumber(pdfPath, fileType === '선정결과' ? 'selection' : 'application');

  if (result.error) {
    return { operators: [], error: result.error };
  }

  const operators = (result.applications || []).map(app => ({
    name: app.company || app.name || '',
    category: app.category || '',
    isSelected: app.is_selected || false
  }));

  return { operators, fileName: path.basename(pdfPath) };
}

/**
 * 출자사업별 신청현황 조회 (운용사명 포함) - 캐시된 데이터 사용
 */
function getProjectApplicationsWithNames(projectId, allApplications, operatorMap) {
  const projectApps = allApplications.filter(app => app['출자사업ID'] === projectId);

  return projectApps.map(app => {
    const operatorId = app['운용사ID'] || '';
    const opData = operatorMap.get(operatorId) || { name: '(알 수 없음)', alias: '' };

    return {
      appId: app['ID'],
      operatorId,
      operatorName: opData.name,
      operatorAlias: opData.alias,
      category: app['출자분야'] || '',
      status: app['상태'] || ''
    };
  });
}

/**
 * PDF 운용사와 Sheet 신청현황 비교
 */
function compareOperators(pdfOperators, sheetApplications, threshold) {
  const result = {
    matched: [],
    similarMatch: [],
    onlyInPdf: [],
    onlyInSheet: []
  };

  const sheetUsed = new Set();

  for (const pdfOp of pdfOperators) {
    const pdfName = pdfOp.name;
    if (!pdfName) continue;

    let bestMatch = null;
    let bestScore = 0;
    let matchType = null;
    let matchReasons = [];

    for (const sheetApp of sheetApplications) {
      const key = sheetApp.appId;
      if (sheetUsed.has(key)) continue;

      // 정확히 일치
      if (normalizeName(pdfName) === normalizeName(sheetApp.operatorName)) {
        bestMatch = sheetApp;
        bestScore = 1.0;
        matchType = 'exact';
        matchReasons = ['정확히 일치'];
        break;
      }

      // 약어 일치
      if (sheetApp.operatorAlias) {
        const aliases = sheetApp.operatorAlias.split(',').map(a => a.trim());
        for (const alias of aliases) {
          if (normalizeName(pdfName) === normalizeName(alias)) {
            bestMatch = sheetApp;
            bestScore = 1.0;
            matchType = 'alias';
            matchReasons = ['약어 일치'];
            break;
          }
        }
        if (matchType === 'alias') break;
      }

      // 유사도 계산
      const { score, reasons } = calculateOperatorSimilarity(pdfName, sheetApp.operatorName);
      if (score > bestScore && score >= 0.6) {
        bestMatch = sheetApp;
        bestScore = score;
        matchType = 'similar';
        matchReasons = reasons;
      }
    }

    if (bestMatch) {
      sheetUsed.add(bestMatch.appId);

      if (matchType === 'exact' || matchType === 'alias') {
        result.matched.push({
          pdfOperator: pdfOp,
          sheetApplication: bestMatch,
          matchType,
          score: bestScore
        });
      } else if (bestScore >= threshold) {
        result.similarMatch.push({
          pdfOperator: pdfOp,
          sheetApplication: bestMatch,
          score: bestScore,
          reasons: matchReasons
        });
      } else {
        // 유사도가 threshold 미만이면 매칭 실패로 처리
        result.onlyInPdf.push(pdfOp);
      }
    } else {
      result.onlyInPdf.push(pdfOp);
    }
  }

  // Sheet에만 있는 항목
  for (const sheetApp of sheetApplications) {
    if (!sheetUsed.has(sheetApp.appId)) {
      result.onlyInSheet.push(sheetApp);
    }
  }

  return result;
}

/**
 * 중복 운용사 감지 (캐시된 데이터 사용)
 */
function findDuplicateOperators(operators, threshold = 0.85) {
  const duplicates = [];

  for (let i = 0; i < operators.length; i++) {
    for (let j = i + 1; j < operators.length; j++) {
      const name1 = operators[i]['운용사명'] || '';
      const name2 = operators[j]['운용사명'] || '';

      if (!name1 || !name2) continue;

      const { score, reasons } = calculateOperatorSimilarity(name1, name2);

      if (score >= threshold) {
        duplicates.push({
          op1: { id: operators[i]['ID'], name: name1 },
          op2: { id: operators[j]['ID'], name: name2 },
          similarity: score,
          reasons
        });
      }
    }
  }

  return duplicates;
}

/**
 * 단일 파일 검증
 */
function verifyFile(file, project, allApplications, operatorMap, options) {
  const fileNo = file['파일번호'];
  const fileType = file['파일유형'] || '';
  const fileId = file['ID'];

  const pdfPath = findPdfByFileNo(fileNo);
  if (!pdfPath) {
    return {
      fileId,
      fileNo,
      fileName: file['파일명'],
      error: 'PDF_NOT_FOUND',
      message: `PDF 파일 없음: ${fileNo}`
    };
  }

  // PDF에서 운용사 추출
  const { operators: pdfOperators, error } = extractOperatorsFromPdf(pdfPath, fileType);
  if (error) {
    return {
      fileId,
      fileNo,
      fileName: path.basename(pdfPath),
      error: 'PARSE_ERROR',
      message: error
    };
  }

  // 신청현황 조회 (캐시된 데이터 사용)
  const sheetApplications = getProjectApplicationsWithNames(project['ID'], allApplications, operatorMap);

  // 비교
  const comparison = compareOperators(pdfOperators, sheetApplications, options.threshold);

  return {
    fileId,
    fileNo,
    fileName: path.basename(pdfPath),
    fileType,
    pdfCount: pdfOperators.length,
    sheetCount: sheetApplications.length,
    comparison,
    project
  };
}

/**
 * 전체 검증
 */
async function verifyAll(sheets, options, reporter = null) {
  const results = {
    projects: [],
    totalMatched: 0,
    totalSimilar: 0,
    totalOnlyInPdf: 0,
    totalOnlyInSheet: 0,
    similarMatches: [],
    onlyInPdf: [],
    onlyInSheet: [],
    duplicateOperators: [],
    errors: []
  };

  // 데이터 한 번에 로드 (API 호출 최소화)
  console.log('  데이터 로드 중...');
  const projects = await sheets.getAllRows('출자사업');
  const files = await sheets.getAllRows('파일');
  const allApplications = await sheets.getAllRows('신청현황');
  const operators = await sheets.getAllRows('운용사');

  console.log(`  출자사업: ${projects.length}개, 파일: ${files.length}개`);
  console.log(`  신청현황: ${allApplications.length}건, 운용사: ${operators.length}개`);

  // 운용사 Map 생성
  const operatorMap = new Map(operators.map(op => [op['ID'], {
    name: op['운용사명'] || '',
    alias: op['약어'] || ''
  }]));

  // 파일 Map
  const fileMap = new Map(files.map(f => [f['ID'], f]));

  for (const project of projects) {
    // 필터링
    if (options.projectId && project['ID'] !== options.projectId) continue;

    // 연결된 파일 ID 수집
    const supportFileIds = (project['지원파일ID'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const resultFileIds = (project['결과파일ID'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const allFileIds = [...supportFileIds, ...resultFileIds];

    // 특정 파일만 검증할 경우
    if (options.fileId) {
      if (!allFileIds.includes(options.fileId)) continue;
    }

    const projectFiles = allFileIds
      .map(id => fileMap.get(id))
      .filter(Boolean);

    if (projectFiles.length === 0) continue;

    const projectResult = {
      projectId: project['ID'],
      projectName: project['사업명'],
      files: []
    };

    for (const file of projectFiles) {
      // 특정 파일만 검증
      if (options.fileId && file['ID'] !== options.fileId) continue;

      const fileResult = verifyFile(file, project, allApplications, operatorMap, options);
      projectResult.files.push(fileResult);

      if (fileResult.error) {
        results.errors.push(fileResult);
        continue;
      }

      // 집계
      results.totalMatched += fileResult.comparison.matched.length;
      results.totalSimilar += fileResult.comparison.similarMatch.length;
      results.totalOnlyInPdf += fileResult.comparison.onlyInPdf.length;
      results.totalOnlyInSheet += fileResult.comparison.onlyInSheet.length;

      // 상세 수집
      for (const item of fileResult.comparison.similarMatch) {
        results.similarMatches.push({
          ...item,
          project,
          file
        });
      }

      for (const op of fileResult.comparison.onlyInPdf) {
        results.onlyInPdf.push({
          operator: op,
          project,
          file,
          fileName: fileResult.fileName
        });

        // 리포터에 문제 기록 (PDF에만 있음 = 운용사 누락)
        if (reporter) {
          reporter.addIssue({
            severity: 'error',
            title: '운용사 누락',
            description: `PDF에 "${op.name}" 운용사가 있으나 DB에 없음`,
            cause: '신규 운용사 미등록 또는 잘못된 매칭',
            location: `${file['ID']} - ${op.category || '(분야 미지정)'}`
          });
        }
      }

      for (const app of fileResult.comparison.onlyInSheet) {
        results.onlyInSheet.push({
          application: app,
          project,
          file,
          fileName: fileResult.fileName
        });

        // Sheet에만 있음은 정상 (다른 파일 또는 탈락)
        // 리포트에 기록하지 않음
      }
    }

    results.projects.push(projectResult);
  }

  // 중복 운용사 검사 (이미 로드된 데이터 사용)
  results.duplicateOperators = findDuplicateOperators(operators, options.threshold);

  results.projectCount = results.projects.length;
  results.fileCount = results.projects.reduce((sum, p) => sum + p.files.length, 0);

  return results;
}

/**
 * 리포트 출력
 */
function printReport(results) {
  console.log('\n' + '='.repeat(70));
  console.log('  운용사 매칭 검증 리포트');
  console.log('='.repeat(70));

  // 요약
  console.log('\n[요약]');
  console.log(`  검증 출자사업: ${results.projectCount}개`);
  console.log(`  검증 파일: ${results.fileCount}개`);
  console.log(`  정확 매칭: ${results.totalMatched}건`);
  console.log(`  유사 매칭 (검토 필요): ${results.totalSimilar}건`);
  console.log(`  PDF에만 있음 (누락 의심): ${results.totalOnlyInPdf}건`);
  console.log(`  Sheet에만 있음 (과잉 등록 의심): ${results.totalOnlyInSheet}건`);
  console.log(`  중복 운용사 의심: ${results.duplicateOperators.length}쌍`);

  // 에러
  if (results.errors.length > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('[오류]');
    for (const err of results.errors) {
      console.log(`  ${err.fileNo}: ${err.message}`);
    }
  }

  // 유사 매칭
  if (results.similarMatches.length > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('[유사 매칭 - 검토 필요]');
    for (const item of results.similarMatches) {
      const scorePercent = Math.round(item.score * 100);
      console.log(`  PDF: "${item.pdfOperator.name}"`);
      console.log(`  Sheet: "${item.sheetApplication.operatorName}" (${item.sheetApplication.operatorId})`);
      console.log(`  유사도: ${scorePercent}% - ${item.reasons?.join(', ') || ''}`);
      console.log(`  출자사업: ${item.project?.['사업명'] || ''}`);
      console.log('');
    }
  }

  // PDF에만 있음
  if (results.onlyInPdf.length > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('[PDF에만 있음 - 누락 의심]');
    for (const item of results.onlyInPdf) {
      console.log(`  운용사: "${item.operator.name}"`);
      console.log(`  분야: ${item.operator.category || '(없음)'}`);
      console.log(`  출자사업: ${item.project?.['사업명'] || ''}`);
      console.log(`  파일: ${item.fileName}`);
      console.log('');
    }
  }

  // Sheet에만 있음
  if (results.onlyInSheet.length > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('[Sheet에만 있음 - 과잉 등록 의심]');
    for (const item of results.onlyInSheet) {
      console.log(`  운용사: "${item.application.operatorName}" (${item.application.operatorId})`);
      console.log(`  분야: ${item.application.category || '(없음)'}`);
      console.log(`  상태: ${item.application.status}`);
      console.log(`  출자사업: ${item.project?.['사업명'] || ''}`);
      console.log('');
    }
  }

  // 중복 운용사
  if (results.duplicateOperators.length > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log('[중복 운용사 의심]');
    for (const dup of results.duplicateOperators) {
      console.log(`  ${dup.op1.id}: ${dup.op1.name}`);
      console.log(`  ${dup.op2.id}: ${dup.op2.name}`);
      console.log(`  유사도: ${Math.round(dup.similarity * 100)}% - ${dup.reasons?.join(', ') || ''}`);
      console.log('');
    }
  }

  console.log('='.repeat(70));

  // 문제가 없으면
  if (results.totalSimilar === 0 &&
      results.totalOnlyInPdf === 0 &&
      results.totalOnlyInSheet === 0 &&
      results.duplicateOperators.length === 0) {
    console.log('\n✅ 모든 운용사 매칭이 정확합니다!');
    return true;
  }

  return false;
}

/**
 * 메인 함수
 */
async function main() {
  const options = parseArgs();

  console.log('운용사 매칭 검증 시작...');
  if (options.projectId) console.log(`  출자사업: ${options.projectId}`);
  if (options.fileId) console.log(`  파일: ${options.fileId}`);
  console.log(`  유사도 임계값: ${options.threshold}`);

  const sheets = new GoogleSheetsClient();
  await sheets.init();

  // 리포터 생성 (특정 출자사업 검증 시에만)
  let reporter = null;
  let projectData = null;
  if (options.projectId) {
    const project = await sheets.findRow('출자사업', 'ID', options.projectId);
    if (project) {
      projectData = {
        사업명: project['사업명'] || '',
        소관: project['소관'] || '',
        연도: project['연도'] || '',
        차수: project['차수'] || ''
      };
      reporter = new VerificationReporter(options.projectId, projectData);
    }
  }

  const results = await verifyAll(sheets, options, reporter);
  const isValid = printReport(results);

  // 리포터가 있으면 통계 설정 및 리포트 생성
  if (reporter && results.projects.length > 0) {
    // 통계 수집
    const projectResult = results.projects[0];
    const stats = {
      fileCount: projectResult.files.length,
      totalApplications: results.totalMatched + results.totalSimilar + results.totalOnlyInPdf,
      selectedCount: 0,
      rejectedCount: 0,
      byCategory: {},
      notes: []
    };

    // 분야별 통계 계산
    const allApplications = await sheets.getAllRows('신청현황');
    const projectApps = allApplications.filter(app => app['출자사업ID'] === options.projectId);

    for (const app of projectApps) {
      const category = app['출자분야'] || '(분야 미지정)';
      const status = app['상태'] || '';

      if (!stats.byCategory[category]) {
        stats.byCategory[category] = { applied: 0, selected: 0 };
      }
      stats.byCategory[category].applied++;

      if (status === '선정') {
        stats.selectedCount++;
        stats.byCategory[category].selected++;
      } else if (status === '탈락') {
        stats.rejectedCount++;
      }
    }

    stats.totalApplications = projectApps.length;

    reporter.setStatistics(stats);

    // 리포트 생성
    const finalStatus = isValid ? 'AI자동수정완료' :
                       (results.totalOnlyInPdf > 0 || results.totalOnlyInSheet > 0) ? '검증실패' :
                       'AI확인완료';

    const reportPath = await reporter.generateReport(finalStatus);
    console.log(`\n📄 검증 리포트: ${reportPath}`);
  }

  // 검증 통과 시 출자사업 확인완료 상태 업데이트
  if (isValid && options.projectId) {
    console.log(`\n[확인완료 업데이트] ${options.projectId} → AI확인완료`);
    await sheets.updateProjectVerification(options.projectId, 'AI확인완료');
  } else if (isValid && !options.projectId && !options.fileId) {
    // 전체 검증 시 모든 출자사업 업데이트
    console.log('\n[확인완료 일괄 업데이트] 모든 출자사업 → AI확인완료');
    const projects = await sheets.getAllRows('출자사업');
    for (const project of projects) {
      await sheets.updateProjectVerification(project['ID'], 'AI확인완료');
    }
  }
}

main().catch(console.error);
