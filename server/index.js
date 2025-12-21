import express from 'express';
import cors from 'cors';
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

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(express.json());

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
