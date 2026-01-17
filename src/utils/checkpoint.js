/**
 * 체크포인트 및 재시도 유틸리티
 *
 * 부분 실패 시 복구 가능하도록 체크포인트 시스템 제공
 */

import fs from 'fs';
import path from 'path';

const CHECKPOINT_DIR = './checkpoints';

/**
 * 체크포인트 매니저 클래스
 */
export class CheckpointManager {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.filePath = path.join(CHECKPOINT_DIR, `${sessionId}.json`);
    this.state = {
      stage: 'init',
      completedOperators: [],
      completedApplications: [],
      timestamp: null
    };
  }

  /**
   * 체크포인트 저장
   * @param {string} stage - 현재 단계
   * @param {Object} data - 추가 데이터
   */
  async save(stage, data = {}) {
    this.state = {
      ...this.state,
      ...data,
      stage,
      timestamp: new Date().toISOString()
    };

    if (!fs.existsSync(CHECKPOINT_DIR)) {
      fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    console.log(`[Checkpoint] ${stage} 저장됨`);
  }

  /**
   * 체크포인트 로드
   * @returns {Object|null} - 저장된 상태 또는 null
   */
  load() {
    if (fs.existsSync(this.filePath)) {
      this.state = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      console.log(`[Checkpoint] ${this.state.stage}에서 재개`);
      return this.state;
    }
    return null;
  }

  /**
   * 체크포인트 삭제 (완료 시)
   */
  clear() {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
      console.log('[Checkpoint] 삭제됨');
    }
  }

  /**
   * 현재 상태 조회
   */
  getState() {
    return this.state;
  }
}

/**
 * API 재시도 래퍼
 * @param {Function} fn - 실행할 함수
 * @param {Object} options - 옵션
 * @returns {Promise<any>} - 함수 실행 결과
 */
export async function withRetry(fn, options = {}) {
  const { maxRetries = 3, retryDelay = 60000, onRetry = null } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isQuotaError = error.code === 429 ||
                          error.message?.includes('Quota') ||
                          error.message?.includes('quota') ||
                          error.message?.includes('RATE_LIMIT');

      if (isQuotaError && attempt < maxRetries) {
        console.log(`[Retry] API 할당량 초과, ${retryDelay/1000}초 대기 후 재시도 (${attempt}/${maxRetries})`);
        if (onRetry) onRetry(attempt, error);
        await sleep(retryDelay);
      } else {
        throw error;
      }
    }
  }

  throw new Error('최대 재시도 횟수 초과');
}

/**
 * 배치 처리 래퍼 (청크 단위)
 * @param {Array} items - 처리할 항목들
 * @param {Function} processFn - 배치 처리 함수
 * @param {Object} options - 옵션
 * @returns {Promise<Array>} - 결과 배열
 */
export async function processBatches(items, processFn, options = {}) {
  const { batchSize = 20, delayBetweenBatches = 2000 } = options;

  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`  - 배치 ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)} 처리 중...`);

    const batchResult = await processFn(batch);
    results.push(...batchResult);

    // 마지막 배치가 아니면 대기
    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches);
    }
  }

  return results;
}

/**
 * sleep 유틸리티
 * @param {number} ms - 밀리초
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { sleep };
