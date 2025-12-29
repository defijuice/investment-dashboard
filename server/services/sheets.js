import { google } from 'googleapis';
import { config } from '../config.js';

let sheetsClient = null;
let sheets = null;

const SPREADSHEET_ID = config.spreadsheetId;

async function initSheets() {
  if (sheets) return sheets;

  let auth;

  // Vercel 환경: 환경변수에서 서비스 계정 키 사용
  if (config.serviceAccountKey) {
    const key = JSON.parse(config.serviceAccountKey);
    auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  } else {
    // 로컬 환경: 파일 기반 인증
    const { GoogleSheetsClient } = await import('../../src/googleSheets.js');
    sheetsClient = new GoogleSheetsClient();
    await sheetsClient.init();
    return sheetsClient;
  }

  const authClient = await auth.getClient();
  sheets = google.sheets({ version: 'v4', auth: authClient });

  // GoogleSheetsClient와 호환되는 래퍼 객체 반환
  return createSheetsWrapper(sheets);
}

function createSheetsWrapper(sheets) {
  return {
    sheets,
    spreadsheetId: SPREADSHEET_ID,

    async getAllRows(sheetName) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      });
      return parseSheetData(response.data.values);
    },

    async getAllOperators() {
      return this.getAllRows('운용사');
    },

    async getAllProjects() {
      return this.getAllRows('출자사업');
    },

    async getAllApplications() {
      return this.getAllRows('신청현황');
    },

    async getAllFiles() {
      return this.getAllRows('파일');
    },

    async findById(sheetName, id) {
      const rows = await this.getAllRows(sheetName);
      return rows.find(row => row['ID'] === id);
    },

    async setValues(range, values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
      });
    },

    async getExistingApplications(projectId) {
      const apps = await this.getAllApplications();
      const existingMap = new Map();
      apps
        .filter(app => app['출자사업ID'] === projectId)
        .forEach(app => {
          const key = `${app['운용사ID']}|${app['출자분야'] || ''}`;
          existingMap.set(key, app);
        });
      return existingMap;
    },

    async getOrCreateOperator(operatorName) {
      const operators = await this.getAllOperators();
      const existing = operators.find(op => op['운용사명'] === operatorName);
      if (existing) {
        return { id: existing['ID'], isNew: false };
      }
      // 신규 운용사 생성 로직은 여기서는 생략 (필요시 구현)
      throw new Error('운용사 생성 기능은 아직 구현되지 않았습니다.');
    },

    async createApplication(data) {
      const apps = await this.getAllApplications();
      const maxIdNum = Math.max(0, ...apps.map(a => {
        const match = a['ID']?.match(/^APP-(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      }));
      const newId = `APP-${String(maxIdNum + 1).padStart(4, '0')}`;

      const row = [
        newId,
        data.출자사업ID || '',
        data.운용사ID || '',
        data.출자분야 || '',
        data.결성예정액 || '',
        data.출자요청액 || '',
        data.최소결성규모 || '',
        data.통화단위 || 'KRW',
        data.상태 || '접수',
        data.비고 || ''
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: '신청현황!A:J',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
      });

      return newId;
    },

    async updateApplicationStatus(id, status) {
      const app = await this.findById('신청현황', id);
      if (!app) throw new Error(`Application not found: ${id}`);
      await this.setValues(`신청현황!I${app._rowIndex}`, [[status]]);
    },

    async updateFileHistory(id, data) {
      const file = await this.findById('파일', id);
      if (!file) throw new Error(`File not found: ${id}`);

      const updates = [];
      if (data.파일유형 !== undefined) {
        updates.push({ range: `파일!C${file._rowIndex}`, values: [[data.파일유형]] });
      }
      if (data.처리상태 !== undefined) {
        updates.push({ range: `파일!G${file._rowIndex}`, values: [[data.처리상태]] });
      }
      if (data.비고 !== undefined) {
        updates.push({ range: `파일!J${file._rowIndex}`, values: [[data.비고]] });
      }
      if (data.현황 !== undefined) {
        updates.push({ range: `파일!I${file._rowIndex}`, values: [[data.현황]] });
      }

      if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: updates
          }
        });
      }
    },

    async deleteRow(sheetName, rowIndex) {
      // 간단한 구현: 해당 행을 빈 값으로 클리어
      await this.setValues(`${sheetName}!A${rowIndex}:Z${rowIndex}`, [[]]);
    },

    async updateApplication(id, data) {
      const apps = await this.getAllApplications();
      const app = apps.find(a => a['ID'] === id);
      if (!app) throw new Error(`Application not found: ${id}`);

      const rowIndex = app._rowIndex;
      const updates = [];

      if (data.출자분야 !== undefined) {
        updates.push({
          range: `신청현황!D${rowIndex}`,
          values: [[data.출자분야]]
        });
      }
      if (data.상태 !== undefined) {
        updates.push({
          range: `신청현황!J${rowIndex}`,
          values: [[data.상태]]
        });
      }
      if (data.비고 !== undefined) {
        updates.push({
          range: `신청현황!K${rowIndex}`,
          values: [[data.비고]]
        });
      }

      if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: updates
          }
        });
      }

      return { ...app, ...data };
    },

    async syncFileStatusWithApplications(fileId) {
      const files = await this.getAllFiles();
      const file = files.find(f => f['ID'] === fileId);
      if (!file) return null;

      const projects = await this.getAllProjects();
      const apps = await this.getAllApplications();

      // 이 파일과 연결된 출자사업 찾기
      const linkedProjects = projects.filter(p =>
        (p['지원파일ID'] || '').includes(fileId) ||
        (p['결과파일ID'] || '').includes(fileId)
      );

      if (linkedProjects.length === 0) return null;

      // 연결된 출자사업의 모든 신청현황 집계
      const projectIds = linkedProjects.map(p => p['ID']);
      const linkedApps = apps.filter(a => projectIds.includes(a['출자사업ID']));

      const total = linkedApps.length;
      const selected = linkedApps.filter(a => a['상태'] === '선정').length;

      // 파일 유형에 따른 현황 문자열 생성
      const fileType = file['파일유형'];
      let statusText;
      if (fileType === '선정결과') {
        statusText = `총 ${total}개 중 선정 ${selected}건`;
      } else {
        statusText = `신청현황 ${total}건`;
      }

      // 파일 현황 업데이트
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `파일!I${file._rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[statusText]]
        }
      });

      return statusText;
    }
  };
}

function parseSheetData(values) {
  if (!values || values.length < 2) return [];

  const headers = values[0];
  return values.slice(1).map((row, index) => {
    const obj = { _rowIndex: index + 2 };
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}

export async function getSheetsClient() {
  if (!sheetsClient) {
    sheetsClient = await initSheets();
  }
  return sheetsClient;
}

export { sheetsClient };
