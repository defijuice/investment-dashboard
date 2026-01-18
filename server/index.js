import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getSheetsClient } from './services/sheets.js';

// Routes
import authRoutes from './routes/auth.js';
import operatorsRoutes from './routes/operators.js';
import projectsRoutes from './routes/projects.js';
import applicationsRoutes from './routes/applications.js';
import filesRoutes from './routes/files.js';
import statsRoutes from './routes/stats.js';

const app = express();

// Cloudflare 프록시 신뢰 설정 (프로덕션)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(express.json());

// Rate Limiting (프로덕션 환경에서만 적용)
if (process.env.NODE_ENV === 'production') {
  // API 전체 Rate Limit: 1초당 10회 제한
  const apiLimiter = rateLimit({
    windowMs: 1000,
    max: 10,
    message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (req, res) => {
      console.warn(`Rate limit exceeded: ${req.ip}`);
      res.status(429).json({ error: '요청 한도 초과. 잠시 후 다시 시도해주세요.' });
    }
  });

  // 검색 API 엄격 제한 (크롤링 방지): 분당 30회
  const searchLimiter = rateLimit({
    windowMs: 60000,
    max: 30,
    message: { error: '검색 요청이 너무 많습니다.' }
  });

  // 로그인 브루트포스 방지: 분당 5회
  const loginLimiter = rateLimit({
    windowMs: 60000,
    max: 5,
    message: { error: '로그인 시도가 너무 많습니다. 1분 후 다시 시도해주세요.' }
  });

  app.use('/api', apiLimiter);
  app.use('/api/applications/search', searchLimiter);
  app.use('/api/operators', searchLimiter);
  app.use('/api/auth/login', loginLimiter);

  console.log('Rate limiting enabled (production mode)');
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/operators', operatorsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/stats', statsRoutes);

// Error handling
app.use(errorHandler);

// Initialize and start server
async function start() {
  try {
    console.log('Initializing Google Sheets client...');
    await getSheetsClient();
    console.log('Google Sheets client initialized.');

    app.listen(config.port, () => {
      console.log(`\nServer running on http://localhost:${config.port}`);
      console.log(`CORS origin: ${config.corsOrigin}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
