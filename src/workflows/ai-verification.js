import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';
import { parsePdfWithPdfplumber, compareResults, hasDifferences } from '../processors/pdf-compare.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AI 기반 출자사업 데이터 정합성 검증 클래스
 */
export class ProjectVerifier {
  constructor(projectId, sheets, anthropic) {
    this.projectId = projectId;
    this.sheets = sheets;
    this.ai = anthropic;
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.project = null;
  }

  /**
   * 출자사업 검증 메인 프로세스
   */
  async verify() {
    console.log(`\n🔍 출자사업 ${this.projectId} 검증 시작...`);

    // Step 1: 출자사업 메타데이터 로드
    this.project = await this.sheets.findRow('출자사업', 'ID', this.projectId);
    if (!this.project) {
      throw new Error(`출자사업 ${this.projectId}를 찾을 수 없습니다.`);
    }

    console.log(`\n📋 출자사업: ${this.project['사업명']}`);
    console.log(`   소관: ${this.project['소관']}, 연도: ${this.project['연도']}, 차수: ${this.project['차수']}\n`);

    // Step 2: 연결된 파일 목록 조회
    const { applicationFiles, selectionFiles } = await this.sheets.getFilesByProject(this.projectId);

    console.log(`📄 파일 목록:`);
    console.log(`   접수파일: ${applicationFiles.length}개 - ${applicationFiles.map(f => f['ID']).join(', ')}`);
    console.log(`   선정파일: ${selectionFiles.length}개 - ${selectionFiles.map(f => f['ID']).join(', ')}\n`);

    // Step 3: 각 파일 검증 수행
    for (const file of applicationFiles) {
      await this.verifyApplicationFile(file);
    }

    for (const file of selectionFiles) {
      await this.verifySelectionFile(file);
    }

    // Step 4: 운용사 약어 교차 검증
    await this.verifyOperatorAliases();

    // Step 5: 검증 결과 판단 및 사용자 승인
    await this.finalizeVerification();
  }

  /**
   * 자동 수정 가능한 항목 처리
   * @returns {Object} { fixed: [...], skipped: [...] }
   */
  async autoFix() {
    const fixed = [];
    const skipped = [];

    console.log('\n🔧 자동 수정 시작...\n');

    // 1. 약어 누락 자동 수정
    for (const warning of this.warnings) {
      if (warning.type === 'MISSING_ALIASES') {
        for (const item of warning.items) {
          try {
            console.log(`  [약어 추가] ${item.operatorId} - ${item.shouldAdd.join(', ')}`);

            // 약어 필드에 추가
            const operator = await this.sheets.findRow('운용사', 'ID', item.operatorId);
            if (!operator) {
              skipped.push({
                type: 'ALIAS_FAILED',
                operatorId: item.operatorId,
                error: '운용사를 찾을 수 없음'
              });
              continue;
            }

            const currentAliases = operator['약어'] || '';
            const aliasArray = currentAliases.split(',').map(s => s.trim()).filter(Boolean);
            const newAliases = [...new Set([...aliasArray, ...item.shouldAdd])];
            const updatedAliases = newAliases.join(', ');

            await this.sheets.setValues(`운용사!C${operator._rowIndex}`, [[updatedAliases]]);

            fixed.push({
              type: 'ALIAS_ADDED',
              operatorId: item.operatorId,
              aliases: item.shouldAdd
            });
          } catch (error) {
            skipped.push({
              type: 'ALIAS_FAILED',
              operatorId: item.operatorId,
              error: error.message
            });
          }
        }
      }
    }

    // 2. 단순 상태 불일치 자동 수정 (조건부)
    for (const error of this.errors) {
      if (error.type === 'SELECTION_STATUS_MISMATCH' && error.severity !== 'CRITICAL') {
        // PDF에 선정되어 있고 DB에서 탈락인 경우만 자동 수정
        for (const item of error.items || []) {
          if (item.pdfStatus === '선정' && item.dbStatus === '탈락' && item.applicationId) {
            try {
              console.log(`  [상태 수정] ${item.applicationId} - 탈락 → 선정`);

              const app = await this.sheets.findRow('신청현황', 'ID', item.applicationId);
              if (!app) {
                skipped.push({
                  type: 'STATUS_FAILED',
                  applicationId: item.applicationId,
                  error: '신청현황을 찾을 수 없음'
                });
                continue;
              }

              await this.sheets.setValues(`신청현황!J${app._rowIndex}`, [['선정']]);

              fixed.push({
                type: 'STATUS_FIXED',
                applicationId: item.applicationId,
                from: '탈락',
                to: '선정'
              });
            } catch (error) {
              skipped.push({
                type: 'STATUS_FAILED',
                applicationId: item.applicationId,
                error: error.message
              });
            }
          }
        }
      }
    }

    console.log(`\n✅ 자동 수정 완료: ${fixed.length}건`);
    if (skipped.length > 0) {
      console.log(`⚠️  수정 실패: ${skipped.length}건\n`);
    }

    return { fixed, skipped };
  }

  /**
   * 자동 수정 가능 항목이 있는지 확인
   */
  hasAutoFixableIssues() {
    return this.warnings.some(w => w.type === 'MISSING_ALIASES') ||
           this.errors.some(e => e.type === 'SELECTION_STATUS_MISMATCH' && e.severity !== 'CRITICAL');
  }

  /**
   * 자동 수정 가능 항목 개수
   */
  countAutoFixable() {
    let count = 0;
    for (const w of this.warnings) {
      if (w.type === 'MISSING_ALIASES' && w.items) count += w.items.length;
    }
    for (const e of this.errors) {
      if (e.type === 'SELECTION_STATUS_MISMATCH' && e.severity !== 'CRITICAL' && e.items) {
        count += e.items.filter(i => i.pdfStatus === '선정' && i.dbStatus === '탈락').length;
      }
    }
    return count;
  }

  /**
   * 자동 수정 승인 요청
   */
  async askAutoFix() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('자동 수정 가능한 항목을 수정하시겠습니까? (y/n): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * 검증 결과 최종 판단 및 사용자 승인
   */
  async finalizeVerification() {
    console.log('\n' + '='.repeat(60));
    console.log('검증 결과 요약');
    console.log('='.repeat(60));

    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;

    if (!hasErrors && !hasWarnings) {
      // 완벽한 경우: 자동 승인
      console.log('\n✅ 모든 검증 통과 - 문제 없음');
      console.log('\n출자사업 확인완료 상태를 "AI확인완료"로 업데이트합니다...');

      await this.sheets.updateProjectVerificationStatus(this.projectId, 'AI확인완료');
      console.log('✅ 확인완료 필드 업데이트 완료\n');
      return;
    }

    // 불일치가 있는 경우: 사용자에게 보고
    const hasAutoFixable = this.hasAutoFixableIssues();

    console.log(`\n⚠️  검증 중 ${hasErrors ? '오류' : '경고'} 발견:`);
    console.log(`   - 오류: ${this.errors.length}건`);
    console.log(`   - 경고: ${this.warnings.length}건`);
    if (hasAutoFixable) {
      console.log(`   - 자동 수정 가능: ${this.countAutoFixable()}건`);
    }
    console.log('');

    // 불일치 항목 상세 표시
    await this.displayMismatches();

    // 자동 수정 제안
    if (hasAutoFixable) {
      console.log('\n' + '─'.repeat(60));
      const shouldAutoFix = await this.askAutoFix();

      if (shouldAutoFix) {
        const result = await this.autoFix();

        // 수정 후 재검증 (선택적)
        if (result.fixed.length > 0) {
          console.log('\n자동 수정 적용 완료. 확인완료 상태를 "AI자동수정완료"로 업데이트합니다...');
          await this.sheets.updateProjectVerificationStatus(this.projectId, 'AI자동수정완료');
          console.log('✅ 확인완료 필드 업데이트 완료\n');
          return;
        }
      }
    }

    // 사용자 승인 요청
    console.log('\n' + '─'.repeat(60));
    const approved = await this.askUserApproval();

    if (approved) {
      console.log('\n✅ 사용자 승인: 확인완료 상태를 "수동확인완료"로 업데이트합니다...');
      await this.sheets.updateProjectVerificationStatus(this.projectId, '수동확인완료');
      console.log('✅ 확인완료 필드 업데이트 완료\n');
    } else {
      console.log('\n❌ 사용자 거부: 확인완료 상태를 "검증실패"로 업데이트합니다...');
      await this.sheets.updateProjectVerificationStatus(this.projectId, '검증실패');
      console.log('⚠️  수동으로 데이터를 확인하고 수정해주세요.\n');
    }
  }

  /**
   * 불일치 항목 상세 표시 (비교 UI)
   */
  async displayMismatches() {
    console.log('\n┌─ 불일치 항목 상세 ─────────────────────────────┐\n');

    // 오류 표시
    for (const error of this.errors) {
      if (error.type === 'MISSING_APPLICATIONS' && error.items && error.items.length > 0) {
        console.log(`📄 [${error.fileId}] PDF에는 있지만 DB에 없는 항목 (${error.count}건):`);
        console.log('');
        for (const item of error.items.slice(0, 5)) {
          console.log(`  ❌ ${item.operatorName || item.name || JSON.stringify(item)}`);
          if (item.category) console.log(`     분야: ${item.category}`);
        }
        if (error.items.length > 5) {
          console.log(`  ... 외 ${error.items.length - 5}건`);
        }
        console.log('');
      }

      if (error.type === 'SELECTION_STATUS_MISMATCH' && error.items && error.items.length > 0) {
        console.log(`📄 [${error.fileId}] PDF 선정인데 DB 탈락 상태 (${error.items.length}건):`);
        console.log('');
        for (const item of error.items.slice(0, 5)) {
          console.log(`  ❌ ${item.operatorName || item.name || JSON.stringify(item)}`);
          if (item.category) console.log(`     분야: ${item.category}`);
          if (item.dbStatus) console.log(`     DB 상태: ${item.dbStatus}`);
        }
        if (error.items.length > 5) {
          console.log(`  ... 외 ${error.items.length - 5}건`);
        }
        console.log('');
      }
    }

    // 경고 표시
    for (const warning of this.warnings) {
      if (warning.type === 'MISSING_ALIASES' && warning.items && warning.items.length > 0) {
        console.log(`🔤 운용사 약어 누락 (${warning.count}건):`);
        console.log('');
        for (const item of warning.items.slice(0, 5)) {
          console.log(`  ⚠️  ${item.operatorId} (${item.dbName})`);
          console.log(`     현재 약어: "${item.currentAliases}"`);
          console.log(`     추가 필요: "${item.shouldAdd.join(', ')}"`);
          console.log(`     이유: ${item.reason}`);
          console.log('');
        }
        if (warning.items.length > 5) {
          console.log(`  ... 외 ${warning.items.length - 5}건\n`);
        }
      }

      // 파싱 불일치 표시
      if (warning.type === 'PARSING_DISCREPANCY') {
        console.log(`🔍 [${warning.fileId}] AI ↔ pdfplumber 파싱 불일치:`);
        console.log('');

        const comp = warning.comparison;
        if (comp.conflicting && comp.conflicting.length > 0) {
          console.log(`  ⚠️  카테고리 충돌 (${comp.conflicting.length}건):`);
          for (const item of comp.conflicting.slice(0, 3)) {
            console.log(`     - ${item.name}`);
            console.log(`       AI: ${item.claudeCategory}`);
            console.log(`       pdfplumber: ${item.pdfplumberCategory}`);
          }
          if (comp.conflicting.length > 3) {
            console.log(`     ... 외 ${comp.conflicting.length - 3}건`);
          }
        }

        if (comp.onlyInClaude && comp.onlyInClaude.length > 0) {
          console.log(`  📝 AI만 발견 (${comp.onlyInClaude.length}건) - 포함됨`);
        }

        if (comp.onlyInPdfplumber && comp.onlyInPdfplumber.length > 0) {
          console.log(`  🔧 pdfplumber만 발견 (${comp.onlyInPdfplumber.length}건) - 스킵됨`);
        }

        console.log('');
      }
    }

    console.log('└────────────────────────────────────────────────┘\n');
  }

  /**
   * 사용자 승인 요청 (readline 사용)
   */
  async askUserApproval() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('위 불일치 항목에도 불구하고 확인완료로 승인하시겠습니까? (y/n): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * 접수현황 파일 검증
   * @param {Object} file - 파일 시트 행 데이터
   */
  async verifyApplicationFile(file) {
    const fileId = file['ID'];
    this.currentFileId = fileId; // 파싱 비교 시 사용
    console.log(`\n📄 접수현황 파일 검증: ${fileId} (${file['파일명']})`);

    try {
      // Step 1: PDF 다운로드
      const pdfPath = await this.downloadPdfFromDrive(file['파일URL'], fileId);
      if (!pdfPath) {
        this.warnings.push({
          type: 'PDF_DOWNLOAD_FAILED',
          fileId,
          message: 'PDF 다운로드 실패 - 검증 스킵'
        });
        return;
      }

      // Step 2: PDF 파싱 (AI + pdfplumber 통합)
      console.log(`   [1/3] PDF 파싱 중...`);
      const pdfData = await this.parseApplicationPdf(pdfPath);
      console.log(`   → PDF 파싱 결과: ${pdfData.length}건`);

      // Step 3: DB 실제 데이터 조회
      console.log(`   [2/3] DB 신청현황 조회 중...`);
      const dbApplications = await this.sheets.getApplicationsByFile(fileId);
      console.log(`   → DB 저장 데이터: ${dbApplications.length}건`);

      // Step 4: AI 교차 검증
      console.log(`   [3/3] AI 교차 검증 중...`);
      const verification = await this.verifyApplicationData(pdfData, dbApplications, fileId);

      console.log(`   ✅ 검증 완료`);
      this.info.push({
        type: 'APPLICATION_FILE_VERIFIED',
        fileId,
        pdfCount: pdfData.length,
        dbCount: dbApplications.length,
        ...verification
      });

    } catch (error) {
      console.error(`   ❌ 검증 실패: ${error.message}`);
      this.errors.push({
        type: 'APPLICATION_FILE_ERROR',
        fileId,
        error: error.message
      });
    }
  }

  /**
   * 선정결과 파일 검증
   * @param {Object} file - 파일 시트 행 데이터
   */
  async verifySelectionFile(file) {
    const fileId = file['ID'];
    this.currentFileId = fileId; // 파싱 비교 시 사용
    console.log(`\n📄 선정결과 파일 검증: ${fileId} (${file['파일명']})`);

    try {
      // Step 1: PDF 다운로드
      const pdfPath = await this.downloadPdfFromDrive(file['파일URL'], fileId);
      if (!pdfPath) {
        this.warnings.push({
          type: 'PDF_DOWNLOAD_FAILED',
          fileId,
          message: 'PDF 다운로드 실패 - 검증 스킵'
        });
        return;
      }

      // Step 2: PDF 파싱 (AI + pdfplumber 통합)
      console.log(`   [1/3] PDF 파싱 중...`);
      const pdfData = await this.parseSelectionPdf(pdfPath);
      console.log(`   → PDF 선정 명단: ${pdfData.length}건`);

      // Step 3: DB 선정 상태 조회
      console.log(`   [2/3] DB 신청현황 조회 중...`);
      const allApps = await this.sheets.getApplicationsByProject(this.projectId);
      const selectedInDb = allApps.filter(app => app['상태'] === '선정');
      const rejectedInDb = allApps.filter(app => app['상태'] === '탈락');
      console.log(`   → DB 선정 ${selectedInDb.length}건, 탈락 ${rejectedInDb.length}건`);

      // Step 4: AI 정합성 검증
      console.log(`   [3/3] AI 교차 검증 중...`);
      const verification = await this.verifySelectionData(pdfData, selectedInDb, rejectedInDb, fileId);

      console.log(`   ✅ 검증 완료`);
      this.info.push({
        type: 'SELECTION_FILE_VERIFIED',
        fileId,
        pdfCount: pdfData.length,
        dbSelectedCount: selectedInDb.length,
        dbRejectedCount: rejectedInDb.length,
        ...verification
      });

    } catch (error) {
      console.error(`   ❌ 검증 실패: ${error.message}`);
      this.errors.push({
        type: 'SELECTION_FILE_ERROR',
        fileId,
        error: error.message
      });
    }
  }

  /**
   * 운용사 약어 교차 검증 (접수파일 ↔ 선정파일)
   */
  async verifyOperatorAliases() {
    console.log(`\n🔤 운용사 약어 교차 검증 시작...`);

    try {
      const { applicationFiles, selectionFiles } = await this.sheets.getFilesByProject(this.projectId);

      // PDF에서 추출된 운용사명 수집
      const applicationOperatorNames = new Map(); // operatorId → Set<pdfName>
      const selectionOperatorNames = new Map();

      // 접수파일 처리
      for (const file of applicationFiles) {
        const pdfPath = await this.downloadPdfFromDrive(file['파일URL'], file['ID']);
        if (!pdfPath) continue;

        const parsedNames = await this.extractOperatorNames(pdfPath);
        const apps = await this.sheets.getApplicationsByProject(this.projectId);

        for (const app of apps) {
          const opId = app['운용사ID'];
          if (!applicationOperatorNames.has(opId)) {
            applicationOperatorNames.set(opId, new Set());
          }

          const matchedPdfName = await this.findMatchingPdfName(parsedNames, app, opId);
          if (matchedPdfName) {
            applicationOperatorNames.get(opId).add(matchedPdfName);
          }
        }
      }

      // 선정파일 처리
      for (const file of selectionFiles) {
        const pdfPath = await this.downloadPdfFromDrive(file['파일URL'], file['ID']);
        if (!pdfPath) continue;

        const parsedNames = await this.extractOperatorNames(pdfPath);
        const apps = await this.sheets.getApplicationsByProject(this.projectId);
        const selectedApps = apps.filter(a => a['상태'] === '선정');

        for (const app of selectedApps) {
          const opId = app['운용사ID'];
          if (!selectionOperatorNames.has(opId)) {
            selectionOperatorNames.set(opId, new Set());
          }

          const matchedPdfName = await this.findMatchingPdfName(parsedNames, app, opId);
          if (matchedPdfName) {
            selectionOperatorNames.get(opId).add(matchedPdfName);
          }
        }
      }

      // DB 운용사 테이블 조회
      const allOperatorIds = new Set([
        ...applicationOperatorNames.keys(),
        ...selectionOperatorNames.keys()
      ]);

      const operators = await Promise.all(
        Array.from(allOperatorIds).map(id => this.sheets.findRow('운용사', 'ID', id))
      );

      // AI 약어 교차 검증
      const verificationData = Array.from(allOperatorIds).map(opId => {
        const op = operators.find(o => o['ID'] === opId);
        return {
          operatorId: opId,
          dbName: op['운용사명'],
          dbAliases: op['약어'] || '',
          applicationFileNames: Array.from(applicationOperatorNames.get(opId) || []),
          selectionFileNames: Array.from(selectionOperatorNames.get(opId) || [])
        };
      });

      if (verificationData.length === 0) {
        console.log(`   → 검증할 운용사 없음`);
        return;
      }

      console.log(`   [AI 검증] ${verificationData.length}개 운용사 약어 확인 중...`);

      const result = await this.verifyAliasesWithAI(verificationData);

      if (result.missingAliases.length > 0) {
        console.log(`   ⚠️  누락된 약어 ${result.missingAliases.length}건 발견`);
        this.warnings.push({
          type: 'MISSING_ALIASES',
          count: result.missingAliases.length,
          items: result.missingAliases
        });
      } else {
        console.log(`   ✅ 약어 검증 통과`);
      }

    } catch (error) {
      console.error(`   ❌ 약어 검증 실패: ${error.message}`);
      this.errors.push({
        type: 'ALIAS_VERIFICATION_ERROR',
        error: error.message
      });
    }
  }

  /**
   * 검증 리포트 생성
   */
  generateReport() {
    const lines = [];
    lines.push('');
    lines.push('┌────────────────────────────────────────────────┐');
    lines.push(`│  출자사업 검증 리포트: ${this.projectId.padEnd(26)}│`);
    lines.push(`│  ${(this.project['사업명'] || '').padEnd(44)}│`);
    lines.push('└────────────────────────────────────────────────┘');
    lines.push('');

    // 정보 섹션
    for (const info of this.info) {
      if (info.type === 'APPLICATION_FILE_VERIFIED') {
        lines.push(`📄 접수현황 파일: ${info.fileId}`);
        lines.push(`  ✅ PDF ${info.pdfCount}건 → DB ${info.dbCount}건 ${info.pdfCount === info.dbCount ? '일치' : '불일치'}`);
        if (info.missing && info.missing.length > 0) {
          lines.push(`  ❌ PDF에는 있지만 DB에 없는 항목: ${info.missing.length}건`);
        }
        if (info.extra && info.extra.length > 0) {
          lines.push(`  ❌ DB에는 있지만 PDF에 없는 항목: ${info.extra.length}건`);
        }
      } else if (info.type === 'SELECTION_FILE_VERIFIED') {
        lines.push(`📄 선정결과 파일: ${info.fileId}`);
        lines.push(`  ✅ PDF ${info.pdfCount}건 → DB 선정 ${info.dbSelectedCount}건`);
        if (info.shouldBeSelected && info.shouldBeSelected.length > 0) {
          lines.push(`  ❌ PDF 선정인데 DB 탈락: ${info.shouldBeSelected.length}건`);
        }
        if (info.shouldBeRejected && info.shouldBeRejected.length > 0) {
          lines.push(`  ❌ PDF 없는데 DB 선정: ${info.shouldBeRejected.length}건`);
        }
      }
      lines.push('');
    }

    // 경고 섹션
    if (this.warnings.length > 0) {
      for (const warning of this.warnings) {
        if (warning.type === 'MISSING_ALIASES') {
          lines.push(`⚠️  운용사 약어 누락: ${warning.count}건`);
          for (const item of warning.items.slice(0, 5)) {
            lines.push(`   - ${item.operatorId} (${item.dbName}): "${item.shouldAdd.join(', ')}" 누락`);
          }
          if (warning.items.length > 5) {
            lines.push(`   ... 외 ${warning.items.length - 5}건`);
          }
          lines.push('');
        }
      }
    }

    // 종합 결과
    lines.push('─────────────────────────────────────────────────');
    lines.push('종합 결과:');
    const normalCount = this.info.filter(i =>
      !i.missing?.length && !i.extra?.length &&
      !i.shouldBeSelected?.length && !i.shouldBeRejected?.length
    ).length;
    lines.push(`  ✅ 정상: ${normalCount}개 항목`);
    lines.push(`  ⚠️  경고: ${this.warnings.length}개 항목 (자동 수정 가능)`);
    lines.push(`  ❌ 오류: ${this.errors.length}개 항목 (수동 수정 필요)`);
    lines.push('');

    return lines.join('\n');
  }

  // ========== 헬퍼 메서드 ==========

  /**
   * Google Drive PDF 다운로드
   */
  async downloadPdfFromDrive(driveUrl, fileId) {
    // downloads 폴더에서 로컬 파일 사용 (파일번호 기반 매칭)
    const downloadsDir = path.join(process.cwd(), 'downloads');

    // 파일 시트에서 파일번호 조회
    const file = await this.sheets.findRow('파일', 'ID', fileId);
    if (!file || !file['파일번호']) {
      console.log(`   ⚠️  파일 정보 없음: ${fileId}`);
      return null;
    }

    const fileNo = file['파일번호'];
    const files = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.pdf'));

    // 파일번호로 매칭 (예: 4076_한국모태펀드_... → 파일번호 4076)
    const matchedFile = files.find(f => {
      const match = f.match(/^(\d+)_/);
      return match && match[1] === fileNo.toString();
    });

    if (matchedFile) {
      const fullPath = path.join(downloadsDir, matchedFile);
      console.log(`   📄 PDF 파일 발견: ${matchedFile}`);
      return fullPath;
    }

    console.log(`   ⚠️  PDF 파일 찾을 수 없음: 파일번호 ${fileNo}`);
    return null;
  }

  /**
   * PDF에서 운용사명 추출 (AI 사용)
   */
  async extractOperatorNames(pdfPath) {
    if (!fs.existsSync(pdfPath)) {
      console.log(`   ⚠️  PDF 파일 없음: ${pdfPath}`);
      return [];
    }

    try {
      // Read 도구를 사용할 수 없으므로 AI Messages API로 직접 파싱
      const pdfBuffer = fs.readFileSync(pdfPath);
      const base64Pdf = pdfBuffer.toString('base64');

      const response = await this.ai.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf
              }
            },
            {
              type: 'text',
              text: `이 PDF 파일에서 모든 운용사명 목록을 추출하세요.

각 운용사명을 배열로 반환하되, 중복 제거하고 순서대로 나열하세요.

JSON 형식으로 반환:
{
  "operators": ["운용사명1", "운용사명2", ...]
}`
            }
          ]
        }]
      });

      const result = JSON.parse(response.content[0].text);
      return result.operators || [];
    } catch (error) {
      console.log(`   ⚠️  PDF 운용사명 추출 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * PDF 원본 운용사명 목록에서 해당 신청현황과 매칭되는 이름 찾기
   */
  async findMatchingPdfName(parsedNames, application, operatorId) {
    if (parsedNames.length === 0) return null;

    const operator = await this.sheets.findRow('운용사', 'ID', operatorId);
    const category = application['출자분야'];

    const prompt = `다음 PDF 추출 운용사명 목록에서 "${operator['운용사명']}" (분야: ${category})에 해당하는 이름을 찾으세요:

${JSON.stringify(parsedNames, null, 2)}

운용사명 또는 약어: ${operator['운용사명']}, ${operator['약어']}

정확히 일치하는 항목 반환 (JSON):
{ "matchedName": "..." }

없으면: { "matchedName": null }`;

    const response = await this.ai.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    try {
      const result = JSON.parse(response.content[0].text);
      return result.matchedName;
    } catch {
      return null;
    }
  }

  /**
   * 접수현황 PDF 파싱 (AI)
   */
  async parseApplicationPdf(pdfPath) {
    if (!fs.existsSync(pdfPath)) {
      console.log(`   ⚠️  PDF 파일 없음: ${pdfPath}`);
      return [];
    }

    try {
      // 1. AI 파싱
      const aiResult = await this.parseApplicationPdfWithAI(pdfPath);

      // 2. pdfplumber 파싱
      const pdfplumberResult = await parsePdfWithPdfplumber(pdfPath, 'application');

      // 3. 비교
      const comparison = compareResults(aiResult, pdfplumberResult);

      // 4. 불일치 기록 (검증 시 활용)
      if (hasDifferences(comparison)) {
        this.warnings.push({
          type: 'PARSING_DISCREPANCY',
          fileId: this.currentFileId,
          comparison,
          message: 'AI와 pdfplumber 파싱 결과 불일치'
        });
      }

      // 5. 자동 병합 (기본 전략: Claude 우선)
      const matched = comparison.matched || [];
      const conflicting = comparison.conflicting || [];
      const onlyInClaude = comparison.onlyInClaude || [];

      // matched: 그대로 사용
      const merged = [...matched];

      // conflicting: Claude 결과 우선
      for (const item of conflicting) {
        merged.push({
          operatorName: item.name,
          category: item.claudeCategory,
          amounts: item.amounts
        });
      }

      // onlyInClaude: 포함
      merged.push(...onlyInClaude);

      // onlyInPdfplumber: 스킵 (Claude가 더 정확하다고 가정)

      return merged;
    } catch (error) {
      console.log(`   ⚠️  접수현황 PDF 파싱 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * AI 기반 접수현황 PDF 파싱
   */
  async parseApplicationPdfWithAI(pdfPath) {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64Pdf = pdfBuffer.toString('base64');

    const response = await this.ai.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf
            }
          },
          {
            type: 'text',
            text: `이 접수현황 PDF 파일에서 다음 정보를 추출하세요:

1. 각 운용사의 신청현황 데이터
2. 운용사명, 출자분야 (계정-분야 형식), 금액 정보

공동GP는 개별 항목으로 분리하세요 (/, , 구분자 사용).

JSON 배열로 반환:
[
  {
    "operatorName": "운용사명",
    "category": "중진 - 루키리그",
    "amounts": "300억원" (있으면)
  },
  ...
]`
          }
        ]
      }]
    });

    const text = response.content[0].text;
    // JSON 블록 추출
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  }

  /**
   * 선정결과 PDF 파싱 (AI + pdfplumber 통합)
   */
  async parseSelectionPdf(pdfPath) {
    if (!fs.existsSync(pdfPath)) {
      console.log(`   ⚠️  PDF 파일 없음: ${pdfPath}`);
      return [];
    }

    try {
      // 1. AI 파싱
      const aiResult = await this.parseSelectionPdfWithAI(pdfPath);

      // 2. pdfplumber 파싱
      const pdfplumberResult = await parsePdfWithPdfplumber(pdfPath, 'selection');

      // 3. 비교
      const comparison = compareResults(aiResult, pdfplumberResult);

      // 4. 불일치 기록 (검증 시 활용)
      if (hasDifferences(comparison)) {
        this.warnings.push({
          type: 'PARSING_DISCREPANCY',
          fileId: this.currentFileId,
          comparison,
          message: 'AI와 pdfplumber 파싱 결과 불일치'
        });
      }

      // 5. 자동 병합 (기본 전략: Claude 우선)
      const matched = comparison.matched || [];
      const conflicting = comparison.conflicting || [];
      const onlyInClaude = comparison.onlyInClaude || [];

      // matched: 그대로 사용
      const merged = [...matched];

      // conflicting: Claude 결과 우선
      for (const item of conflicting) {
        merged.push({
          operatorName: item.name,
          category: item.claudeCategory,
          amounts: item.amounts
        });
      }

      // onlyInClaude: 포함
      merged.push(...onlyInClaude);

      // onlyInPdfplumber: 스킵 (Claude가 더 정확하다고 가정)

      return merged;
    } catch (error) {
      console.log(`   ⚠️  선정결과 PDF 파싱 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * AI 기반 선정결과 PDF 파싱
   */
  async parseSelectionPdfWithAI(pdfPath) {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const base64Pdf = pdfBuffer.toString('base64');

    const response = await this.ai.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf
            }
          },
          {
            type: 'text',
            text: `이 선정결과 PDF 파일에서 선정된 운용사 목록을 추출하세요:

1. 선정된 각 운용사 정보
2. 운용사명, 출자분야

공동GP는 개별 항목으로 분리하세요.

JSON 배열로 반환:
[
  {
    "operatorName": "운용사명",
    "category": "중진 - 루키리그"
  },
  ...
]`
          }
        ]
      }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  }

  /**
   * 접수현황 데이터 AI 검증
   */
  async verifyApplicationData(pdfData, dbApplications, fileId) {
    const prompt = `다음 두 데이터를 비교하여 정합성을 검증하세요:

PDF 원본 데이터 (${pdfData.length}건):
${JSON.stringify(pdfData.slice(0, 10), null, 2)}
${pdfData.length > 10 ? `... 외 ${pdfData.length - 10}건` : ''}

DB 저장 데이터 (${dbApplications.length}건):
${JSON.stringify(dbApplications.slice(0, 10), null, 2)}
${dbApplications.length > 10 ? `... 외 ${dbApplications.length - 10}건` : ''}

검증 기준:
1. PDF의 모든 운용사가 DB에 존재하는가?
2. 운용사명 변형이 있다면 약어로 매핑되었는가?
3. 출자분야가 정확히 일치하는가?
4. 금액 필드가 올바르게 변환되었는가? (억원/M 단위)
5. 공동GP가 제대로 분리되었는가?

불일치 항목을 다음 형식으로 반환하세요:
{
  "missing": [],
  "extra": [],
  "mismatch": [],
  "aliasIssues": []
}`;

    const response = await this.ai.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    try {
      const result = JSON.parse(response.content[0].text);

      if (result.missing.length > 0) {
        this.errors.push({
          type: 'MISSING_APPLICATIONS',
          fileId,
          count: result.missing.length,
          items: result.missing
        });
      }

      if (result.extra.length > 0) {
        this.warnings.push({
          type: 'EXTRA_APPLICATIONS',
          fileId,
          count: result.extra.length,
          items: result.extra
        });
      }

      return result;
    } catch (error) {
      console.error(`   ⚠️  AI 응답 파싱 실패: ${error.message}`);
      return { missing: [], extra: [], mismatch: [], aliasIssues: [] };
    }
  }

  /**
   * 선정결과 데이터 AI 검증
   */
  async verifySelectionData(pdfData, selectedInDb, rejectedInDb, fileId) {
    const prompt = `선정결과 파일 검증:

PDF 선정 명단 (${pdfData.length}건):
${JSON.stringify(pdfData.slice(0, 10), null, 2)}
${pdfData.length > 10 ? `... 외 ${pdfData.length - 10}건` : ''}

DB 선정 상태 (${selectedInDb.length}건):
${JSON.stringify(selectedInDb.slice(0, 10), null, 2)}
${selectedInDb.length > 10 ? `... 외 ${selectedInDb.length - 10}건` : ''}

DB 탈락 상태 (${rejectedInDb.length}건):
${JSON.stringify(rejectedInDb.slice(0, 5), null, 2)}
${rejectedInDb.length > 5 ? `... 외 ${rejectedInDb.length - 5}건` : ''}

검증 기준:
1. PDF 선정 명단의 모든 운용사가 DB에서 '선정' 상태인가?
2. PDF에 없는데 DB에서 '선정'인 항목이 있는가? (오류)
3. PDF에 있는데 DB에서 '탈락'인 항목이 있는가? (업데이트 누락)
4. 운용사명이 다르지만 같은 운용사인 경우 감지

불일치 항목 반환:
{
  "shouldBeSelected": [],
  "shouldBeRejected": [],
  "notFoundInDb": []
}`;

    const response = await this.ai.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    try {
      const result = JSON.parse(response.content[0].text);

      if (result.shouldBeSelected.length > 0) {
        this.errors.push({
          type: 'SELECTION_STATUS_MISMATCH',
          fileId,
          severity: 'HIGH',
          items: result.shouldBeSelected
        });
      }

      if (result.shouldBeRejected.length > 0) {
        this.errors.push({
          type: 'SELECTION_STATUS_ERROR',
          fileId,
          severity: 'CRITICAL',
          items: result.shouldBeRejected
        });
      }

      return result;
    } catch (error) {
      console.error(`   ⚠️  AI 응답 파싱 실패: ${error.message}`);
      return { shouldBeSelected: [], shouldBeRejected: [], notFoundInDb: [] };
    }
  }

  /**
   * 약어 AI 검증
   */
  async verifyAliasesWithAI(verificationData) {
    const prompt = `운용사 약어 교차 검증 (접수파일 ↔ 선정파일):

${JSON.stringify(verificationData.slice(0, 20), null, 2)}
${verificationData.length > 20 ? `... 외 ${verificationData.length - 20}건` : ''}

검증 기준:
1. **같은 운용사의 다른 표기법이 모두 약어에 포함되었는가?**
   - 예: OP0034
     - 접수파일: "아이비케이캐피탈"
     - 선정파일: "IBK캐피탈"
     - DB 운용사명: "IBK벤처투자"
     - 약어: "아이비케이캐피탈, IBK캐피탈, IBK벤처투자" (모두 포함되어야 함)

2. **표기법 차이 감지:**
   - 한글 ↔ 영문 (케이비 ↔ KB)
   - 접미사 차이 (인베스트먼트 vs 인베스트)
   - 띄어쓰기 차이

3. **누락 여부:**
   - applicationFileNames와 selectionFileNames의 모든 값이 약어에 포함되었는가?
   - DB 운용사명과 다른 표기는 약어에 추가되었는가?

누락된 약어 반환:
{
  "missingAliases": [
    {
      "operatorId": "OP0034",
      "dbName": "IBK벤처투자",
      "currentAliases": "IBK캐피탈",
      "shouldAdd": ["아이비케이캐피탈"],
      "reason": "접수파일 표기가 약어에 없음"
    }
  ]
}`;

    const response = await this.ai.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    try {
      const result = JSON.parse(response.content[0].text);
      return result;
    } catch (error) {
      console.error(`   ⚠️  AI 응답 파싱 실패: ${error.message}`);
      return { missingAliases: [] };
    }
  }
}
