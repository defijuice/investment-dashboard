import { Router } from 'express';
import { login, verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: '비밀번호를 입력하세요.' });
  }

  const result = login(password);

  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }

  res.json({ success: true, token: result.token });
});

router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ valid: false });
  }

  const token = authHeader.replace('Bearer ', '');
  const result = verifyToken(token);
  res.json({ valid: result.valid });
});

export default router;
