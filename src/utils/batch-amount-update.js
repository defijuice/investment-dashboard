import { GoogleSheetsClient } from '../core/googleSheets.js';
import { glob } from 'glob';
import path from 'path';
import { execSync } from 'child_process';

/**
 * PDF를 텍스트로 변환
 */
function pdfToText(pdfPath) {
  try {
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf-8' });
    return text;
  } catch (error) {
    throw new Error(`PDF 텍스트 추출 실패: ${error.message}`);
  }
}

/**
 * PDF에서 금액 데이터 파싱
 * @param {string} pdfPath - PDF 파일 경로
 * @returns {Promise<Object>} { type, currency, data }
 */
async function parsePdfAmounts(pdfPath) {
  console.log(`\n=== PDF 파싱 시작: ${path.basename(pdfPath)} ===`);
  console.log('⚠️  현재는 수동 파싱 모드입니다.');
  console.log('    PDF를 Read 도구로 직접 읽고 표 내용을 입력해야 합니다.');
  console.log('');

  // 파일번호 추출
  const fileName = path.basename(pdfPath);
  const fileNumber = fileName.split('_')[0];

  console.log(`파일번호 ${fileNumber}의 PDF 데이터를 하드코딩된 매핑에서 찾습니다...`);

  // 하드코딩 매핑 (임시)
  const manualData = {
    '4444': {
      type: 'B',
      currency: '억원',
      data: [
        // IP - 병합 (1500, 900 ÷ 5)
        {
          operator: '스마트스터디벤처스',
          category: 'IP',
          formation: 300,
          request: 180,
          merged: {
            originalFormation: 1500,
            originalRequest: 900,
            operatorCount: 5,
            operators: ['스마트스터디벤처스', '에이비즈파트너스', '디에이밸류인베스트먼트', '유티씨인베스트먼트', '솔트룩스벤처스']
          }
        },
        {
          operator: '에이비즈파트너스',
          category: 'IP',
          formation: 300,
          request: 180,
          merged: {
            originalFormation: 1500,
            originalRequest: 900,
            operatorCount: 5,
            operators: ['스마트스터디벤처스', '에이비즈파트너스', '디에이밸류인베스트먼트', '유티씨인베스트먼트', '솔트룩스벤처스']
          }
        },
        {
          operator: '디에이밸류인베스트먼트',
          category: 'IP',
          formation: 300,
          request: 180,
          merged: {
            originalFormation: 1500,
            originalRequest: 900,
            operatorCount: 5,
            operators: ['스마트스터디벤처스', '에이비즈파트너스', '디에이밸류인베스트먼트', '유티씨인베스트먼트', '솔트룩스벤처스']
          }
        },
        {
          operator: '유티씨인베스트먼트',
          category: 'IP',
          formation: 300,
          request: 180,
          merged: {
            originalFormation: 1500,
            originalRequest: 900,
            operatorCount: 5,
            operators: ['스마트스터디벤처스', '에이비즈파트너스', '디에이밸류인베스트먼트', '유티씨인베스트먼트', '솔트룩스벤처스']
          }
        },
        {
          operator: '솔트룩스벤처스',
          category: 'IP',
          formation: 300,
          request: 180,
          merged: {
            originalFormation: 1500,
            originalRequest: 900,
            operatorCount: 5,
            operators: ['스마트스터디벤처스', '에이비즈파트너스', '디에이밸류인베스트먼트', '유티씨인베스트먼트', '솔트룩스벤처스']
          }
        },
        // 문화일반 - 병합 (1200, 600 ÷ 2)
        {
          operator: '케이넷투자파트너스',
          category: '문화일반',
          formation: 600,
          request: 300,
          merged: {
            originalFormation: 1200,
            originalRequest: 600,
            operatorCount: 2,
            operators: ['케이넷투자파트너스', '펜처인베스트']
          }
        },
        {
          operator: '펜처인베스트',
          category: '문화일반',
          formation: 600,
          request: 300,
          merged: {
            originalFormation: 1200,
            originalRequest: 600,
            operatorCount: 2,
            operators: ['케이넷투자파트너스', '펜처인베스트']
          }
        },
        // 수출 - 병합 (1575, 900 ÷ 4)
        {
          operator: '가이아벤처파트너스',
          category: '수출',
          formation: 393.75,
          request: 225,
          merged: {
            originalFormation: 1575,
            originalRequest: 900,
            operatorCount: 4,
            operators: ['가이아벤처파트너스', '대교인베스트먼트', '미시간벤처캐피탈', '크릿벤처스']
          }
        },
        {
          operator: '대교인베스트먼트',
          category: '수출',
          formation: 393.75,
          request: 225,
          merged: {
            originalFormation: 1575,
            originalRequest: 900,
            operatorCount: 4,
            operators: ['가이아벤처파트너스', '대교인베스트먼트', '미시간벤처캐피탈', '크릿벤처스']
          }
        },
        {
          operator: '미시간벤처캐피탈',
          category: '수출',
          formation: 393.75,
          request: 225,
          merged: {
            originalFormation: 1575,
            originalRequest: 900,
            operatorCount: 4,
            operators: ['가이아벤처파트너스', '대교인베스트먼트', '미시간벤처캐피탈', '크릿벤처스']
          }
        },
        {
          operator: '크릿벤처스',
          category: '수출',
          formation: 393.75,
          request: 225,
          merged: {
            originalFormation: 1575,
            originalRequest: 900,
            operatorCount: 4,
            operators: ['가이아벤처파트너스', '대교인베스트먼트', '미시간벤처캐피탈', '크릿벤처스']
          }
        },
        // 신기술 - 병합 (750, 450 ÷ 3)
        {
          operator: '라구나인베스트먼트',
          category: '신기술',
          formation: 250,
          request: 150,
          merged: {
            originalFormation: 750,
            originalRequest: 450,
            operatorCount: 3,
            operators: ['라구나인베스트먼트', '티에스인베스트먼트', '엔에이치투자증권']
          }
        },
        {
          operator: '티에스인베스트먼트',
          category: '신기술',
          formation: 250,
          request: 150,
          merged: {
            originalFormation: 750,
            originalRequest: 450,
            operatorCount: 3,
            operators: ['라구나인베스트먼트', '티에스인베스트먼트', '엔에이치투자증권']
          }
        },
        {
          operator: '엔에이치투자증권',
          category: '신기술',
          formation: 250,
          request: 150,
          merged: {
            originalFormation: 750,
            originalRequest: 450,
            operatorCount: 3,
            operators: ['라구나인베스트먼트', '티에스인베스트먼트', '엔에이치투자증권']
          }
        },
        // IP직접투자
        { operator: '카스피안캐피탈', category: 'IP직접투자', formation: 202.1, request: 80 },
      ]
    },
    '4445': {
      type: 'A',
      currency: '억원',
      data: [
        // 루키리그
        { operator: '다성벤처스', category: '루키리그', min: 200, moTae: 100 },
        { operator: '바인벤처스', category: '루키리그', min: 200, moTae: 120 },
        { operator: '세이지원파트너스', category: '루키리그', min: 200, moTae: 120 },
        { operator: '에이오에이캐피탈파트너스', category: '루키리그', min: 170, moTae: 100 },
        { operator: '에이온인베스트먼트', category: '루키리그', min: 200, moTae: 100 },
        { operator: '에이타스파트너스', category: '루키리그', min: 167, moTae: 100 },
        { operator: '오엔벤처투자', category: '루키리그', min: 117, moTae: 70 },
        { operator: '젠티움파트너스', category: '루키리그', min: 167, moTae: 100 },
        { operator: '지앤피인베스트먼트', category: '루키리그', min: 200, moTae: 100 },
        { operator: '코난인베스트먼트', category: '루키리그', min: 150, moTae: 90 },
        // 청년창업
        { operator: '비에스케이인베스트먼트', category: '청년창업', min: 300, moTae: 180 },
        { operator: '비에이파트너스', category: '청년창업', min: 225, moTae: 135 },
        { operator: '수인베스트먼트캐피탈', category: '청년창업', min: 143, moTae: 85 },
        // 여성기업
        { operator: '현대투자파트너스', category: '여성기업', min: 200, moTae: 100 },
        // 재도약
        { operator: '동문파트너즈', category: '재도약', min: 169, moTae: 100 },
        { operator: '어니스트벤처스', category: '재도약', min: 200, moTae: 120 },
        {
          operator: '피앤피인베스트먼트',
          category: '재도약',
          min: 80,
          moTae: 40,
          merged: {
            originalMin: 160,
            originalMoTae: 80,
            operatorCount: 2,
            operators: ['피앤피인베스트먼트', '파이오니어인베스트먼트']
          }
        },
        {
          operator: '파이오니어인베스트먼트',
          category: '재도약',
          min: 80,
          moTae: 40,
          merged: {
            originalMin: 160,
            originalMoTae: 80,
            operatorCount: 2,
            operators: ['피앤피인베스트먼트', '파이오니어인베스트먼트']
          }
        },
        // 스케일업·중견도약
        { operator: '컴퍼니케이파트너스', category: '스케일업·중견도약', min: 1000, moTae: 250 },
        // 바이오
        { operator: '비엔에이치인베스트먼트', category: '바이오', min: 500, moTae: 300 },
        // 창업초기-일반
        { operator: '대덕벤처파트너스', category: '창업초기-일반', min: 150, moTae: 90 },
        { operator: '메인스트리트벤처스', category: '창업초기-일반', min: 230, moTae: 138 },
        { operator: '스케일업파트너스', category: '창업초기-일반', min: 250, moTae: 150 },
        { operator: '에스제이투자파트너스', category: '창업초기-일반', min: 300, moTae: 180 },
        { operator: '위벤처스', category: '창업초기-일반', min: 154, moTae: 92 },
        { operator: '케이넷투자파트너스', category: '창업초기-일반', min: 335, moTae: 200 },
        // 창업초기-소형 - 병합
        {
          operator: '광주창조경제혁신센터',
          category: '창업초기-소형',
          min: 25,
          moTae: 15,
          merged: {
            originalMin: 50,
            originalMoTae: 30,
            operatorCount: 2,
            operators: ['광주창조경제혁신센터', '지스트기술지주']
          }
        },
        {
          operator: '지스트기술지주',
          category: '창업초기-소형',
          min: 25,
          moTae: 15,
          merged: {
            originalMin: 50,
            originalMoTae: 30,
            operatorCount: 2,
            operators: ['광주창조경제혁신센터', '지스트기술지주']
          }
        },
        { operator: '뉴패러다임인베스트먼트', category: '창업초기-소형', min: 60, moTae: 30 },
        { operator: '미리어드생명과학', category: '창업초기-소형', min: 60, moTae: 30 },
        { operator: '씨앤벤처파트너스', category: '창업초기-소형', min: 50, moTae: 25 },
        { operator: '탭엔젤파트너스', category: '창업초기-소형', min: 60, moTae: 30 },
        // 라이콘
        { operator: '엠와이소셜컴퍼니', category: '라이콘', min: 50, moTae: 30 },
        { operator: '전북창조경제혁신센터', category: '라이콘', min: 20, moTae: 12 },
        { operator: '크립톤', category: '라이콘', min: 101, moTae: 60 },
        // 기업승계 M&A
        { operator: '다올프라이빗에쿼티', category: '기업승계 M&A', min: 1000, moTae: 300 },
      ]
    }
  };

  const mapped = manualData[fileNumber];
  if (!mapped) {
    throw new Error(`파일번호 ${fileNumber}에 대한 매핑 데이터가 없습니다. PDF를 직접 읽어 파싱해야 합니다.`);
  }

  console.log(`Type: ${mapped.type}`);
  console.log(`통화: ${mapped.currency}`);
  console.log(`총 ${mapped.data.length}건 로드\n`);

  return mapped;
}

/**
 * 출자분야 헤더인지 판단
 */
function isCategory(line) {
  const categories = [
    '루키리그', '청년창업', '여성기업', '재도약', '스케일업', '중견도약',
    '바이오', '창업초기', '라이콘', 'M&A', '초격차', '세컨더리', '오픈이노베이션',
    'IP', '수출', '신기술', '문화일반', '관광', '국토교통', '스포츠', 'SaaS',
    '사이버보안', '공공기술사업화', '뉴스페이스', '그린스타트업', '사업화',
    '대학창업', '특허기술사업화', '지역혁신', '지역리그', '수도권리그', '글로벌리그',
    '바이오헬스', '인구활력', '애니메이션', '한국영화', 'AI', '메타버스', '딥테크',
    '스타트업코리아', '콘텐츠', 'Co-GP', '미국', '유럽', '아시아', '일반분야',
    'Climate Tech', 'Secondary'
  ];

  for (const cat of categories) {
    if (line.includes(cat)) return true;
  }

  // "창업초기-일반", "창업초기-소형" 같은 패턴
  if (/창업초기-/.test(line)) return true;
  if (/스케일업·중견도약/.test(line)) return true;
  if (/기업승계/.test(line)) return true;

  return false;
}

/**
 * 데이터 행 파싱
 */
function parseDataLine(line, type) {
  // 쉼표 제거 (1,000 → 1000)
  line = line.replace(/,/g, '');

  // 공백으로 분리
  const parts = line.split(/\s+/);

  if (parts.length < 3) return null;

  let min = null;
  let moTae = null;
  let formation = null;
  let request = null;
  let operator = null;
  let operators = [];
  let merged = null;

  if (type === 'A' || type === 'C') {
    // 최소결성규모, 모태출자액, 회사명
    min = parseFloat(parts[0]);
    moTae = parseFloat(parts[1]);
    operator = parts.slice(2).join('');

    // 병합 감지 (/)
    if (operator.includes('/')) {
      operators = operator.split('/').map(s => s.trim());
      const operatorCount = operators.length;
      merged = {
        originalMin: min,
        originalMoTae: moTae,
        operatorCount,
        operators
      };
      // n분의 1
      min = Math.round((min / operatorCount) * 100) / 100;
      moTae = Math.round((moTae / operatorCount) * 100) / 100;
    }
  }

  if (type === 'B' || type === 'C') {
    // 결성예정액, 출자요청액, 회사명
    formation = parseFloat(parts[0]);
    request = parseFloat(parts[1]);
    operator = parts.slice(2).join('');

    // 병합 감지
    if (operator.includes('/')) {
      operators = operator.split('/').map(s => s.trim());
      const operatorCount = operators.length;
      merged = {
        originalFormation: formation,
        originalRequest: request,
        operatorCount,
        operators
      };
      formation = Math.round((formation / operatorCount) * 100) / 100;
      request = Math.round((request / operatorCount) * 100) / 100;
    }
  }

  // 병합된 경우 각 운용사별로 개별 엔트리 생성
  if (merged) {
    return operators.map(op => ({
      operator: op,
      min,
      moTae,
      formation,
      request,
      merged
    }));
  }

  return {
    operator: operator || parts.slice(2).join(''),
    min,
    moTae,
    formation,
    request
  };
}

/**
 * 운용사명 정규화
 */
function normalizeOperatorName(name) {
  if (!name) return '';
  return name
    .replace(/\s+/g, '')
    .replace(/주식회사|㈜|\(주\)/g, '')
    .toLowerCase();
}

/**
 * 출자분야 매칭
 */
function categoryMatches(pdfCategory, sheetCategory) {
  if (!pdfCategory || !sheetCategory) return false;

  // 정확히 일치
  if (sheetCategory.includes(pdfCategory)) return true;

  // 분야명 정규화
  const normalizedPdf = pdfCategory.replace(/\s+/g, '').replace(/-/g, '');
  const normalizedSheet = sheetCategory.replace(/\s+/g, '').replace(/-/g, '');

  if (normalizedSheet.includes(normalizedPdf)) return true;

  return false;
}

/**
 * 병합 금액에 대한 비고 텍스트 생성
 */
function generateMergeRemarks(pdfEntry, type, currency) {
  const unit = currency === '억원' ? '억' : 'M';
  const count = pdfEntry.merged.operatorCount;

  const parts = [];

  if (type === 'A' || type === 'C') {
    if (pdfEntry.merged.originalMin) {
      parts.push(`최소결성규모 ${pdfEntry.merged.originalMin}${unit}`);
    }
    if (pdfEntry.merged.originalMoTae) {
      parts.push(`모태출자액 ${pdfEntry.merged.originalMoTae}${unit}`);
    }
  }

  if (type === 'B' || type === 'C') {
    if (pdfEntry.merged.originalFormation) {
      parts.push(`결성예정액 ${pdfEntry.merged.originalFormation}${unit}`);
    }
    if (pdfEntry.merged.originalRequest) {
      parts.push(`출자요청액 ${pdfEntry.merged.originalRequest}${unit}`);
    }
  }

  return `병합: ${parts.join(', ')} (${count}사 공유)`;
}

/**
 * 메인 실행 함수
 */
async function batchAmountUpdate(fileNumberOrProjectId) {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  console.log('=== 금액 배치 업데이트 시작 ===\n');

  // 1. 입력값 처리 (파일번호 또는 출자사업ID)
  let fileNumber = null;
  let projectId = null;

  if (fileNumberOrProjectId.startsWith('PJ')) {
    projectId = fileNumberOrProjectId;
    console.log(`출자사업 ID: ${projectId}`);

    // 출자사업에서 결과파일ID 조회
    const projects = await sheets.getAllRows('출자사업');
    const project = projects.find(p => p['ID'] === projectId);

    if (!project) {
      throw new Error(`출자사업을 찾을 수 없습니다: ${projectId}`);
    }

    const resultFileIds = (project['결과파일ID'] || '').split(',').map(s => s.trim()).filter(Boolean);
    if (resultFileIds.length === 0) {
      throw new Error(`출자사업 ${projectId}에 연결된 선정결과 파일이 없습니다.`);
    }

    // 첫 번째 결과파일 사용
    const files = await sheets.getAllRows('파일');
    const resultFile = files.find(f => f['ID'] === resultFileIds[0]);

    if (!resultFile) {
      throw new Error(`파일을 찾을 수 없습니다: ${resultFileIds[0]}`);
    }

    fileNumber = resultFile['파일번호'];
    console.log(`→ 선정결과 파일: ${resultFile['파일명']} (${fileNumber})`);

  } else {
    fileNumber = fileNumberOrProjectId;
    console.log(`파일번호: ${fileNumber}`);

    // 파일 시트에서 메타데이터 조회
    const files = await sheets.getAllRows('파일');
    const file = files.find(f => f['파일번호'] === fileNumber);

    if (!file) {
      throw new Error(`파일을 찾을 수 없습니다: ${fileNumber}`);
    }

    if (file['파일유형'] !== '선정결과') {
      throw new Error(`선정결과 파일만 처리 가능합니다. (현재: ${file['파일유형']})`);
    }

    console.log(`파일명: ${file['파일명']}`);

    // 연결된 출자사업 찾기
    const projects = await sheets.getAllRows('출자사업');
    const connectedProjects = projects.filter(p => {
      const resultFileIds = (p['결과파일ID'] || '').split(',').map(s => s.trim());
      return resultFileIds.includes(file['ID']);
    });

    if (connectedProjects.length === 0) {
      throw new Error(`파일 ${fileNumber}에 연결된 출자사업이 없습니다.`);
    }

    projectId = connectedProjects[0]['ID'];
    console.log(`→ 출자사업: ${connectedProjects[0]['사업명']} (${projectId})`);
  }

  // 2. PDF 파일 찾기
  const pdfFiles = glob.sync(`downloads/${fileNumber}_*.pdf`);

  if (pdfFiles.length === 0) {
    throw new Error(`PDF 파일을 찾을 수 없습니다: downloads/${fileNumber}_*.pdf`);
  }

  const pdfPath = pdfFiles[0];
  console.log(`PDF 경로: ${pdfPath}\n`);

  // 3. PDF 파싱
  const pdfData = await parsePdfAmounts(pdfPath);

  // 4. 데이터 조회
  const [apps, operators] = await Promise.all([
    sheets.getAllRows('신청현황'),
    sheets.getAllRows('운용사'),
  ]);

  // 운용사 매핑 (ID → 이름)
  const opIdToName = new Map();
  for (const op of operators) {
    opIdToName.set(op['ID'], op['운용사명']);
  }

  // 5. 선정 상태 신청현황 필터링
  const targetApps = apps.filter(a => {
    if (a['상태'] !== '선정') return false;
    if (a['출자사업ID'] !== projectId) return false;
    return true;
  });

  console.log(`\n=== 매칭 시작 ===`);
  console.log(`선정 상태 신청현황: ${targetApps.length}건`);
  console.log(`PDF 파싱 데이터: ${pdfData.data.length}건\n`);

  // 6. 매칭 및 업데이트 데이터 생성
  const updates = [];
  const matchedAppIds = new Set();
  const unmatchedPdf = [];

  for (const pdfEntry of pdfData.data) {
    const normalizedPdfName = normalizeOperatorName(pdfEntry.operator);

    // 매칭되는 신청현황 찾기
    let matched = null;
    for (const app of targetApps) {
      if (matchedAppIds.has(app['ID'])) continue;

      const opName = opIdToName.get(app['운용사ID']) || '';
      const normalizedOpName = normalizeOperatorName(opName);

      // 운용사명 매칭
      const nameMatch = normalizedPdfName === normalizedOpName ||
        normalizedOpName.includes(normalizedPdfName) ||
        normalizedPdfName.includes(normalizedOpName);

      if (!nameMatch) continue;

      // 출자분야 매칭
      if (categoryMatches(pdfEntry.category, app['출자분야'])) {
        matched = app;
        break;
      }
    }

    if (matched) {
      matchedAppIds.add(matched['ID']);

      // 업데이트 데이터 생성
      const updateData = {
        rowIndex: matched._rowIndex,
        appId: matched['ID'],
        operatorName: opIdToName.get(matched['운용사ID']),
        category: matched['출자분야'],
        currency: pdfData.currency,
      };

      if (pdfData.type === 'A' || pdfData.type === 'C') {
        updateData.minFormation = pdfEntry.min;
        updateData.moTae = pdfEntry.moTae;
      }

      if (pdfData.type === 'B' || pdfData.type === 'C') {
        updateData.formation = pdfEntry.formation;
        updateData.request = pdfEntry.request;
      }

      // 병합 정보 추가
      if (pdfEntry.merged) {
        const existingRemarks = matched['비고'] || '';
        const mergeRemarks = generateMergeRemarks(pdfEntry, pdfData.type, pdfData.currency);

        if (existingRemarks && !existingRemarks.includes('병합')) {
          updateData.remarks = `${existingRemarks}; ${mergeRemarks}`;
        } else {
          updateData.remarks = mergeRemarks;
        }

        updateData.mergeInfo = {
          isMerged: true,
          operatorCount: pdfEntry.merged.operatorCount
        };
      }

      updates.push(updateData);

      if (pdfEntry.merged) {
        console.log(`  ✓ ${pdfEntry.operator} → row ${matched._rowIndex} [병합: ${pdfEntry.merged.operatorCount}사]`);
      } else {
        console.log(`  ✓ ${pdfEntry.operator} → row ${matched._rowIndex}`);
      }
    } else {
      unmatchedPdf.push({
        projectId,
        operator: pdfEntry.operator,
        category: pdfEntry.category,
      });
      console.log(`  ✗ ${pdfEntry.operator} (${pdfEntry.category}) - 매칭 실패`);
    }
  }

  console.log(`\n=== 매칭 결과 ===`);
  console.log(`매칭 성공: ${updates.length}건`);
  console.log(`매칭 실패 (PDF): ${unmatchedPdf.length}건`);

  // 7. 배치 업데이트 실행
  if (updates.length === 0) {
    console.log('\n업데이트할 항목이 없습니다.');
    return;
  }

  console.log(`\n=== 배치 업데이트 실행 (${updates.length}건) ===`);

  // Google Sheets 배치 업데이트 데이터 생성
  // 컬럼: E=최소결성규모, F=모태출자액, G=결성예정액, H=출자요청액, I=통화단위, J=비고
  const batchData = updates.map(u => ({
    range: `신청현황!E${u.rowIndex}:J${u.rowIndex}`,
    values: [[
      u.minFormation || '',
      u.moTae || '',
      u.formation || '',
      u.request || '',
      u.currency,
      u.remarks || '',
    ]],
  }));

  // 배치 처리
  try {
    await sheets.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheets.spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      },
    });

    console.log(`✓ ${updates.length}건 업데이트 완료`);

    // 병합 통계
    const mergedCount = updates.filter(u => u.mergeInfo?.isMerged).length;
    if (mergedCount > 0) {
      console.log(`  (병합 처리: ${mergedCount}건)`);

      const mergeGroups = new Map();
      for (const u of updates.filter(u => u.mergeInfo?.isMerged)) {
        const key = `${u.mergeInfo.operatorCount}사`;
        mergeGroups.set(key, (mergeGroups.get(key) || 0) + 1);
      }

      for (const [key, count] of mergeGroups) {
        console.log(`    - ${key} 공유: ${count}건`);
      }
    }
  } catch (error) {
    console.error('배치 업데이트 실패:', error.message);
    throw error;
  }

  console.log(`\n=== 완료 ===`);

  return { success: updates.length, failed: unmatchedPdf.length };
}

// CLI 실행
const arg = process.argv[2];
if (!arg) {
  console.error('사용법: node src/utils/batch-amount-update.js <파일번호|출자사업ID>');
  console.error('예시: node src/utils/batch-amount-update.js 4445');
  console.error('예시: node src/utils/batch-amount-update.js PJ0020');
  process.exit(1);
}

batchAmountUpdate(arg).catch(error => {
  console.error('\n❌ 에러:', error.message);
  process.exit(1);
});
