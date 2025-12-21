import 'dotenv/config';

export const config = {
  port: process.env.PORT || 3001,
  corsOrigin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174'],
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  jwtExpiresIn: '24h',
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
  serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
};
