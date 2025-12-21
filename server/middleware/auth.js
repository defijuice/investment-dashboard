import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function login(password) {
  if (password !== config.adminPassword) {
    return { success: false, error: '비밀번호가 올바르지 않습니다.' };
  }
  const token = jwt.sign({ role: 'admin' }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  return { success: true, token };
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { valid, decoded, error } = verifyToken(token);

  if (!valid) {
    return res.status(401).json({ error: error || '토큰이 유효하지 않습니다.' });
  }

  req.user = decoded;
  next();
}
