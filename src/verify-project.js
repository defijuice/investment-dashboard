#!/usr/bin/env node

/**
 * 출자사업 데이터 정합성 AI 검증 CLI
 *
 * 사용법:
 *   node src/verify-project.js <출자사업ID>
 *
 * 예시:
 *   node src/verify-project.js PJ0001
 */

import { ProjectVerifier } from './workflows/ai-verification.js';
import { GoogleSheetsClient } from './core/googleSheets.js';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const projectId = process.argv[2];

  if (!projectId) {
    console.error('\n❌ 사용법: node src/verify-project.js <출자사업ID>');
    console.error('   예시: node src/verify-project.js PJ0001\n');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\n❌ ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
    console.error('   .env 파일에 ANTHROPIC_API_KEY를 추가하세요.\n');
    process.exit(1);
  }

  try {
    // Google Sheets 클라이언트 초기화
    console.log('📊 Google Sheets 연결 중...');
    const sheets = new GoogleSheetsClient();
    await sheets.init();
    console.log('✅ Google Sheets 연결 완료\n');

    // Anthropic AI 클라이언트 초기화
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // ProjectVerifier 인스턴스 생성
    const verifier = new ProjectVerifier(projectId, sheets, anthropic);

    // 검증 실행
    await verifier.verify();

    // 리포트 생성 및 출력
    const report = verifier.generateReport();
    console.log(report);

    // 종료 코드 결정
    if (verifier.errors.length > 0) {
      console.error(`\n❌ ${verifier.errors.length}개 오류 발견 - 수동 수정 필요\n`);

      // 에러 상세 출력
      for (const error of verifier.errors) {
        console.error(`\n[${error.type}]`);
        if (error.items && error.items.length > 0) {
          console.error(JSON.stringify(error.items, null, 2));
        } else if (error.error) {
          console.error(error.error);
        }
      }

      process.exit(1);
    } else if (verifier.warnings.length > 0) {
      console.warn(`\n⚠️  ${verifier.warnings.length}개 경고 발견 - 자동 수정 가능\n`);

      // 경고 상세 출력
      for (const warning of verifier.warnings) {
        console.warn(`\n[${warning.type}]`);
        if (warning.items && warning.items.length > 0) {
          console.warn(JSON.stringify(warning.items.slice(0, 5), null, 2));
          if (warning.items.length > 5) {
            console.warn(`... 외 ${warning.items.length - 5}건`);
          }
        }
      }

      process.exit(0);
    } else {
      console.log('\n✅ 검증 통과 - 문제 없음\n');
      process.exit(0);
    }

  } catch (error) {
    console.error(`\n❌ 검증 실행 실패: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
