import express from 'express';
import cors from 'cors';
import { config } from '../server/config.js';
import { errorHandler } from '../server/middleware/errorHandler.js';

// Routes
import authRoutes from '../server/routes/auth.js';
import operatorsRoutes from '../server/routes/operators.js';
import projectsRoutes from '../server/routes/projects.js';
import applicationsRoutes from '../server/routes/applications.js';
import filesRoutes from '../server/routes/files.js';
import statsRoutes from '../server/routes/stats.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint - 환경변수 확인용
app.get('/api/debug', (req, res) => {
  res.json({
    hasSpreadsheetId: !!config.spreadsheetId,
    hasServiceAccountKey: !!config.serviceAccountKey,
    serviceAccountKeyLength: config.serviceAccountKey?.length || 0,
    nodeEnv: process.env.NODE_ENV
  });
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

export default app;
