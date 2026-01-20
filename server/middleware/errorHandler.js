export function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message);
  console.error('[Error Stack]', err.stack);

  // Google API 할당량 초과
  if (err.code === 429 || err.message?.includes('Quota exceeded')) {
    return res.status(429).json({
      error: 'API 할당량 초과. 잠시 후 다시 시도하세요.',
      retryAfter: 60
    });
  }

  // 중복 파일 연결
  if (err.code === 'DUPLICATE_FILE_LINK') {
    return res.status(409).json({
      error: err.message,
      code: err.code
    });
  }

  // 유효성 검사 오류
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // 리소스 찾을 수 없음
  if (err.code === 'NOT_FOUND') {
    return res.status(404).json({
      error: err.message,
      code: 'NOT_FOUND'
    });
  }

  // 기본 서버 오류
  res.status(500).json({
    error: '서버 오류가 발생했습니다.',
    code: 'INTERNAL_ERROR'
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
