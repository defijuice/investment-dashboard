import fs from 'fs';
import path from 'path';

/**
 * 검증 리포트 생성 클래스
 *
 * 출자사업 검증 과정에서 발견된 문제, 적용된 수정, 통계를 기록하고
 * 마크다운 형식의 리포트 파일을 생성합니다.
 */
export class VerificationReporter {
  constructor(projectId, projectData) {
    this.projectId = projectId;
    this.projectData = projectData;  // { 사업명, 소관, 연도, 차수 }
    this.timestamp = new Date();
    this.issues = [];      // 발견된 문제
    this.fixes = [];       // 적용된 수정
    this.statistics = {};  // 통계
  }

  /**
   * 문제 기록
   * @param {Object} issue - 문제 정보
   * @param {string} issue.severity - 심각도 ('error' | 'warning')
   * @param {string} issue.title - 문제 제목
   * @param {string} issue.description - 문제 설명
   * @param {string|string[]} issue.cause - 원인 (문자열 또는 배열)
   * @param {string} issue.location - 위치 (파일ID, 분야 등)
   */
  addIssue(issue) {
    this.issues.push({
      severity: issue.severity || 'error',
      title: issue.title,
      description: issue.description,
      cause: issue.cause,
      location: issue.location
    });
  }

  /**
   * 수정 기록
   * @param {Object} fix - 수정 정보
   * @param {string} fix.type - 수정 유형 ('신규 등록' | '매칭 수정' | '약어 추가')
   * @param {string} fix.target - 대상 (ID 등)
   * @param {string} fix.details - 수정 상세
   * @param {number} fix.count - 수정 건수 (기본값: 1)
   * @param {number} fix.relatedIssue - 관련 문제 인덱스 (선택)
   */
  addFix(fix) {
    this.fixes.push({
      type: fix.type,
      target: fix.target,
      details: fix.details,
      count: fix.count || 1,
      relatedIssue: fix.relatedIssue
    });
  }

  /**
   * 통계 설정
   * @param {Object} stats - 통계 정보
   * @param {number} stats.fileCount - 검증한 파일 수
   * @param {number} stats.totalApplications - 총 신청현황 수
   * @param {number} stats.selectedCount - 선정 건수
   * @param {number} stats.rejectedCount - 탈락 건수
   * @param {Object} stats.byCategory - 분야별 통계 { 분야명: { applied, selected } }
   * @param {string[]} stats.notes - 참고 사항 (선택)
   */
  setStatistics(stats) {
    this.statistics = stats;
  }

  /**
   * 리포트 생성 및 파일 저장
   * @param {string} finalStatus - 최종 검증 상태 ('AI자동수정완료' | '수동확인완료' | '검증실패')
   * @returns {Promise<string>} 생성된 리포트 파일 경로
   */
  async generateReport(finalStatus) {
    const markdown = this._buildMarkdown(finalStatus);

    // reports/ 폴더 생성
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 타임스탬프 포함 파일명
    const timestamp = this.timestamp.toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '_');
    const filename = `${this.projectId}_report_${timestamp}.md`;
    const reportPath = path.join(reportsDir, filename);

    fs.writeFileSync(reportPath, markdown, 'utf-8');

    return reportPath;
  }

  /**
   * 마크다운 리포트 생성 (내부 메서드)
   * @param {string} finalStatus - 최종 검증 상태
   * @returns {string} 마크다운 텍스트
   */
  _buildMarkdown(finalStatus) {
    const lines = [];

    // 1. 헤더
    lines.push('# 운용사 매칭 검증 리포트\n');
    lines.push(`**출자사업**: ${this.projectId} - ${this.projectData.사업명 || 'N/A'}`);
    lines.push(`**검증 일시**: ${this.timestamp.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    lines.push(`**검증 상태**: ${finalStatus}\n`);

    // 2. 요약
    lines.push('## 검증 요약\n');
    lines.push('| 항목 | 건수 |');
    lines.push('|------|------|');
    lines.push(`| PDF에만 있음 (누락/오매칭) | ${this.issues.filter(i => i.severity === 'error').length}건 |`);
    lines.push(`| 유사 매칭 검토 | ${this.issues.filter(i => i.severity === 'warning').length}건 |`);
    lines.push(`| 신규 운용사 등록 | ${this.fixes.filter(f => f.type === '신규 운용사 등록').length}건 |`);
    lines.push(`| 약어 추가 | ${this.fixes.filter(f => f.type === '약어 추가').length}건 |`);
    lines.push(`| 매칭 수정 | ${this.fixes.filter(f => f.type === '매칭 수정').length}건 |\n`);

    // 3. PDF에만 있는 운용사 (진짜 문제)
    const missingOperators = this.issues.filter(i => i.severity === 'error');
    if (missingOperators.length > 0) {
      lines.push('## ❌ PDF에만 있음 (DB 누락)\n');
      lines.push('PDF에 표기되었으나 DB에 없는 운용사입니다. 신규 등록 또는 잘못된 매칭이 의심됩니다.\n');

      missingOperators.forEach((issue, idx) => {
        lines.push(`### ${idx + 1}. ${issue.description.match(/"([^"]+)"/)?.[1] || '(알 수 없음)'}\n`);
        lines.push(`- **위치**: ${issue.location}`);

        if (issue.cause) {
          lines.push(`- **원인**: ${Array.isArray(issue.cause) ? issue.cause.join(', ') : issue.cause}`);
        }

        // 해당 문제에 대한 수정 찾기
        const relatedFixes = this.fixes.filter(f => f.relatedIssue === idx);
        if (relatedFixes.length > 0) {
          lines.push(`- **조치**:`);
          relatedFixes.forEach(fix => {
            lines.push(`  - ${fix.type}: ${fix.details}`);
          });
        }
        lines.push('');
      });
    }

    // 4. 유사 매칭 검토 결과
    const similarMatches = this.issues.filter(i => i.severity === 'warning');
    if (similarMatches.length > 0) {
      lines.push('## ⚠️ 유사 매칭 검토\n');
      lines.push('유사도 85% 이상으로 매칭된 운용사들입니다. 같은 회사인지 확인이 필요합니다.\n');

      similarMatches.forEach((issue, idx) => {
        lines.push(`### ${idx + 1}. ${issue.title}\n`);
        lines.push(`- **문제**: ${issue.description}`);

        if (issue.cause) {
          lines.push(`- **판단**: ${Array.isArray(issue.cause) ? issue.cause.join(', ') : issue.cause}`);
        }

        const relatedFixes = this.fixes.filter(f => f.relatedIssue === (missingOperators.length + idx));
        if (relatedFixes.length > 0) {
          lines.push(`- **조치**:`);
          relatedFixes.forEach(fix => {
            lines.push(`  - ${fix.type}: ${fix.details}`);
          });
        }
        lines.push('');
      });
    }

    // 5. 적용된 수정 사항 요약
    if (this.fixes.length > 0) {
      lines.push('## ✅ 적용된 수정 사항\n');

      const newOperators = this.fixes.filter(f => f.type === '신규 운용사 등록');
      if (newOperators.length > 0) {
        lines.push('### 신규 운용사 등록\n');
        newOperators.forEach(fix => {
          lines.push(`- ${fix.details} (${fix.target})`);
        });
        lines.push('');
      }

      const aliasAdded = this.fixes.filter(f => f.type === '약어 추가');
      if (aliasAdded.length > 0) {
        lines.push('### 약어 추가\n');
        aliasAdded.forEach(fix => {
          lines.push(`- ${fix.details} (${fix.target})`);
        });
        lines.push('');
      }

      const matchingFixed = this.fixes.filter(f => f.type === '매칭 수정');
      if (matchingFixed.length > 0) {
        lines.push('### 매칭 수정\n');
        matchingFixed.forEach(fix => {
          lines.push(`- ${fix.details} (${fix.target})`);
        });
        lines.push('');
      }
    }

    // 6. 참고 사항
    if (this.statistics.notes && this.statistics.notes.length > 0) {
      lines.push('## 📌 참고 사항\n');
      this.statistics.notes.forEach(note => {
        lines.push(`- ${note}`);
      });
      lines.push('');
    }

    // 7. 결론
    if (this.issues.length === 0 && this.fixes.length === 0) {
      lines.push('## 결론\n');
      lines.push('✅ **모든 운용사 매칭이 정확합니다.** 추가 조치가 필요하지 않습니다.\n');
    }

    return lines.join('\n');
  }
}
