/**
 * PDF 처리 검토/승인 워크플로우
 *
 * 파싱된 데이터를 터미널 테이블로 보여주고,
 * 사용자가 수정/승인할 수 있게 하는 인터랙티브 모듈
 */

import Table from 'cli-table3';
import readline from 'readline';

/**
 * 검토 세션 클래스
 */
export class ReviewSession {
  constructor(reviewData) {
    this.data = reviewData;
    this.applicants = [...reviewData.applicants]; // 수정 가능하도록 복사
    this.selected = [...reviewData.selected];
    this.rl = null;
  }

  /**
   * 검토 세션 시작
   * @returns {Promise<boolean>} 승인 여부
   */
  async start() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      // 리포트 출력
      this.displayReport();

      // 사용자 명령 대기 루프
      while (true) {
        const action = await this.promptForAction();

        switch (action.toLowerCase()) {
          case 'y':
            console.log('\n승인되었습니다. 저장을 진행합니다...');
            return true;

          case 'n':
            console.log('\n취소되었습니다.');
            return false;

          case 'e':
            await this.editMode();
            this.displayReport(); // 수정 후 다시 표시
            break;

          case 'r':
            this.displayReport();
            break;

          case 's':
            this.displaySummaryOnly();
            break;

          default:
            console.log('잘못된 입력입니다. y, n, e, r, s 중 하나를 입력하세요.');
        }
      }
    } finally {
      this.rl.close();
    }
  }

  /**
   * 전체 리포트 출력
   */
  displayReport() {
    console.log('\n' + '='.repeat(70));
    console.log('  PDF 처리 결과 검토');
    console.log('='.repeat(70));

    // 1. 요약
    this.displaySummary();

    // 2. 신규 운용사
    this.displayNewOperators();

    // 3. 중복 스킵
    this.displayDuplicates();

    // 4. 공동GP 분리
    this.displayJointGPSplits();

    // 5. 신청현황 테이블
    this.displayApplicationsTable();

    // 6. 명령어 안내
    this.displayCommands();
  }

  /**
   * 요약만 출력
   */
  displaySummaryOnly() {
    console.log('\n' + '='.repeat(70));
    console.log('  요약');
    console.log('='.repeat(70));
    this.displaySummary();
    this.displayCommands();
  }

  /**
   * 요약 섹션
   */
  displaySummary() {
    const { summary } = this.data;

    console.log('\n[요약]');

    // 건수 비교
    const pdfCount = summary.pdfReportedCount?.applicants || '?';
    const actualCount = this.applicants.filter(a => !a.willSkip).length;

    console.log(`  PDF 기재 건수: ${pdfCount}개`);
    console.log(`  실제 처리 예정: ${actualCount}개`);

    if (pdfCount !== '?' && pdfCount !== actualCount) {
      const diff = actualCount - pdfCount;
      const diffStr = diff > 0 ? `+${diff}` : diff;
      console.log(`  ⚠️  차이: ${diffStr}건 (공동GP 분리/중복 등으로 인한 차이)`);
    }

    // 상태별 통계
    const selected = this.applicants.filter(a => a.status === '선정' && !a.willSkip).length;
    const rejected = this.applicants.filter(a => a.status === '탈락' && !a.willSkip).length;
    const skipped = this.applicants.filter(a => a.willSkip).length;

    console.log(`\n  선정: ${selected}건 | 탈락: ${rejected}건 | 중복 스킵: ${skipped}건`);
  }

  /**
   * 신규 운용사 테이블
   */
  displayNewOperators() {
    const newOps = this.applicants.filter(a => a.isNewOperator && !a.willSkip);

    if (newOps.length === 0) return;

    console.log(`\n[신규 운용사] ${newOps.length}건`);

    const table = new Table({
      head: ['#', '운용사명', '출자분야'],
      colWidths: [6, 35, 25],
      style: { head: ['cyan'] }
    });

    newOps.forEach(op => {
      table.push([op.index, op.name, op.category || '-']);
    });

    console.log(table.toString());
  }

  /**
   * 중복 스킵 테이블
   */
  displayDuplicates() {
    const duplicates = this.applicants.filter(a => a.isDuplicate);

    if (duplicates.length === 0) return;

    console.log(`\n[중복 - 저장 안함] ${duplicates.length}건`);

    const table = new Table({
      head: ['#', '운용사명', '출자분야', '기존 상태'],
      colWidths: [6, 30, 20, 12],
      style: { head: ['yellow'] }
    });

    duplicates.forEach(dup => {
      table.push([
        dup.index,
        dup.name,
        dup.category || '-',
        dup.existingStatus || '-'
      ]);
    });

    console.log(table.toString());
  }

  /**
   * 공동GP 분리 표시
   */
  displayJointGPSplits() {
    const jointGPs = this.applicants.filter(a => a.isJointGP && !a.willSkip);

    if (jointGPs.length === 0) return;

    console.log(`\n[공동GP 분리] ${jointGPs.length}건`);

    // 원본별로 그룹화
    const byOriginal = new Map();
    jointGPs.forEach(gp => {
      const key = gp.originalCompany || gp.name;
      if (!byOriginal.has(key)) {
        byOriginal.set(key, []);
      }
      byOriginal.get(key).push(gp.name);
    });

    byOriginal.forEach((names, original) => {
      if (names.length > 1 || original !== names[0]) {
        console.log(`  "${original}" → ${names.map(n => `"${n}"`).join(', ')}`);
      }
    });
  }

  /**
   * 메인 신청현황 테이블
   */
  displayApplicationsTable() {
    const apps = this.applicants.filter(a => !a.willSkip);

    console.log(`\n[신청현황] ${apps.length}건`);

    const table = new Table({
      head: ['#', '운용사명', '출자분야', '상태', '플래그'],
      colWidths: [6, 32, 22, 8, 18],
      style: { head: ['green'] },
      wordWrap: true
    });

    apps.forEach(app => {
      const flags = [];
      if (app.isNewOperator) flags.push('신규');
      if (app.isJointGP) flags.push('공동GP');

      const statusDisplay = app.status === '선정' ? '선정' : '탈락';

      table.push([
        app.index,
        this.truncate(app.name, 30),
        app.category || '-',
        statusDisplay,
        flags.join(', ') || '-'
      ]);
    });

    console.log(table.toString());
  }

  /**
   * 명령어 안내
   */
  displayCommands() {
    console.log('\n' + '-'.repeat(70));
    console.log('명령어:');
    console.log('  y - 승인 후 저장');
    console.log('  n - 취소 (저장 안함)');
    console.log('  e - 항목 수정');
    console.log('  r - 리포트 다시 보기');
    console.log('  s - 요약만 보기');
    console.log('-'.repeat(70));
  }

  /**
   * 사용자 입력 대기
   */
  async promptForAction() {
    return new Promise(resolve => {
      this.rl.question('\n선택: ', answer => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * 수정 모드
   */
  async editMode() {
    console.log('\n[수정 모드]');
    console.log('수정할 항목의 번호를 입력하세요. (q: 수정 완료)');

    while (true) {
      const indexStr = await this.prompt('번호 입력: ');

      if (indexStr.toLowerCase() === 'q') {
        console.log('수정 모드 종료');
        break;
      }

      const index = parseInt(indexStr, 10);
      const app = this.applicants.find(a => a.index === index);

      if (!app) {
        console.log(`  ⚠️ ${index}번 항목을 찾을 수 없습니다.`);
        continue;
      }

      await this.editItem(app);
    }
  }

  /**
   * 개별 항목 수정
   */
  async editItem(app) {
    console.log(`\n[항목 #${app.index}]`);
    console.log(`  운용사명: ${app.name}`);
    console.log(`  출자분야: ${app.category || '(없음)'}`);
    console.log(`  상태: ${app.status}`);

    console.log('\n수정 대상:');
    console.log('  1 - 운용사명');
    console.log('  2 - 출자분야');
    console.log('  3 - 상태 (선정/탈락)');
    console.log('  4 - 삭제 (저장 안함)');
    console.log('  0 - 취소');

    const choice = await this.prompt('선택: ');

    switch (choice) {
      case '1': {
        const newName = await this.prompt(`새 운용사명 (현재: ${app.name}): `);
        if (newName.trim()) {
          app.name = newName.trim();
          app.nameEdited = true; // 운용사 재조회 필요 표시
          console.log(`  ✓ 운용사명이 "${app.name}"(으)로 변경되었습니다.`);
        }
        break;
      }

      case '2': {
        console.log('\n출자분야 예시: 중진 - 루키리그, 청년 - 청년창업, 혁신모험 - 창업초기');
        const newCategory = await this.prompt(`새 출자분야 (현재: ${app.category}): `);
        if (newCategory.trim()) {
          app.category = newCategory.trim();
          console.log(`  ✓ 출자분야가 "${app.category}"(으)로 변경되었습니다.`);
        }
        break;
      }

      case '3': {
        const newStatus = app.status === '선정' ? '탈락' : '선정';
        app.status = newStatus;
        console.log(`  ✓ 상태가 "${newStatus}"(으)로 변경되었습니다.`);
        break;
      }

      case '4': {
        app.willSkip = true;
        console.log(`  ✓ 항목 #${app.index}이 삭제되었습니다. (저장되지 않음)`);
        break;
      }

      case '0':
      default:
        console.log('  취소됨');
    }
  }

  /**
   * 단순 프롬프트
   */
  async prompt(question) {
    return new Promise(resolve => {
      this.rl.question(question, answer => {
        resolve(answer);
      });
    });
  }

  /**
   * 문자열 자르기
   */
  truncate(str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 2) + '..';
  }

  /**
   * 최종 applicants 반환 (수정된 데이터)
   */
  getFinalApplicants() {
    return this.applicants.filter(a => !a.willSkip);
  }

  /**
   * 최종 selected 반환
   */
  getFinalSelected() {
    return this.selected;
  }
}

/**
 * 리뷰 데이터 준비 함수
 *
 * process-pair-sheets.js에서 호출하여 검토용 데이터를 생성
 */
export function prepareReviewData({
  applicants,
  selected,
  project,
  existingApplications,
  selectedNames,
  selectionMap,
  aliasCache,
  sheets
}) {
  // applicants에 인덱스와 추가 정보 부여
  const enrichedApplicants = [];
  let index = 1;

  for (const applicant of applicants) {
    const normalizedName = normalizeName(applicant.name);

    // 선정 여부 확인
    let isSelected = selectedNames.has(normalizedName);
    if (!isSelected) {
      for (const selectedName of selectedNames) {
        if (selectedName.includes(normalizedName) || normalizedName.includes(selectedName)) {
          isSelected = true;
          break;
        }
      }
    }

    // operatorId가 있으면 중복 체크
    let isDuplicate = false;
    let existingStatus = null;

    if (applicant.operatorId) {
      const existingKey = `${applicant.operatorId}|${applicant.category}`;
      if (existingApplications.has(existingKey)) {
        isDuplicate = true;
        existingStatus = existingApplications.get(existingKey).status;
      }
    }

    enrichedApplicants.push({
      index: index++,
      name: applicant.name,
      category: applicant.category || '',
      region: applicant.region || '한국',
      status: isSelected ? '선정' : '탈락',
      isJointGP: applicant.isJointGP || false,
      originalCompany: applicant.originalCompany || null,
      isNewOperator: applicant.isNewOperator || false,
      operatorId: applicant.operatorId || null,
      isDuplicate,
      existingStatus,
      willSkip: isDuplicate,
      nameEdited: false
    });
  }

  // 요약 정보 생성
  const summary = {
    pdfReportedCount: {
      applicants: applicants.length,
      selected: selected.length
    },
    projectName: project?.사업명 || '',
    projectId: project?.id || ''
  };

  return {
    applicants: enrichedApplicants,
    selected,
    summary,
    project
  };
}

/**
 * 운용사명 정규화 (비교용)
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[,.\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|ltd|pte|limited|management|company|co)\b/gi, '')
    .trim();
}
