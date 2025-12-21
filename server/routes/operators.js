import { Router } from 'express';
import { getSheetsClient } from '../services/sheets.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// 모든 라우트에 인증 적용
router.use(authMiddleware);

// 운용사 목록 조회
router.get('/', asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const sheets = await getSheetsClient();
  let operators = await sheets.getAllOperators();

  // 검색 필터링
  if (search) {
    const searchLower = search.toLowerCase();
    operators = operators.filter(op =>
      op['운용사명']?.toLowerCase().includes(searchLower) ||
      op['약어']?.toLowerCase().includes(searchLower)
    );
  }

  // 페이지네이션
  const total = operators.length;
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginated = operators.slice(startIndex, endIndex);

  res.json({
    data: paginated,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / parseInt(limit))
  });
}));

// 운용사 상세 조회
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();
  const operator = await sheets.findById('운용사', id);

  if (!operator) {
    const error = new Error(`운용사를 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  res.json({ data: operator });
}));

// 운용사 생성
router.post('/', asyncHandler(async (req, res) => {
  const { 운용사명, 약어, 유형, 국가 } = req.body;

  if (!운용사명) {
    return res.status(400).json({ error: '운용사명은 필수입니다.' });
  }

  const sheets = await getSheetsClient();
  const result = await sheets.getOrCreateOperator(운용사명, { 약어, 유형, 국가 });

  res.status(result.isNew ? 201 : 200).json({
    data: result.data,
    isNew: result.isNew,
    id: result.id
  });
}));

// 운용사 수정
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 운용사명, 약어, 유형, 국가 } = req.body;
  const sheets = await getSheetsClient();

  const existing = await sheets.findById('운용사', id);
  if (!existing) {
    const error = new Error(`운용사를 찾을 수 없습니다: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }

  const rowIndex = existing._rowIndex;

  // 개별 필드 업데이트
  if (운용사명 !== undefined) {
    await sheets.setValues(`운용사!B${rowIndex}`, [[운용사명]]);
  }
  if (약어 !== undefined) {
    await sheets.setValues(`운용사!C${rowIndex}`, [[약어]]);
  }
  if (유형 !== undefined) {
    await sheets.setValues(`운용사!D${rowIndex}`, [[유형]]);
  }
  if (국가 !== undefined) {
    await sheets.setValues(`운용사!E${rowIndex}`, [[국가]]);
  }

  // 업데이트된 데이터 반환
  const updated = await sheets.findById('운용사', id);
  res.json({ data: updated });
}));

// 유사도 검사
router.post('/check-similar', asyncHandler(async (req, res) => {
  const { names } = req.body;

  if (!names || !Array.isArray(names)) {
    return res.status(400).json({ error: 'names 배열이 필요합니다.' });
  }

  const sheets = await getSheetsClient();
  const result = await sheets.findSimilarOperatorsFromDB(names);

  res.json(result);
}));

export default router;
