import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import { exec } from 'child_process';
import { findSimilarOperators, formatSimilarOperatorsForReview } from '../matchers/operator-matcher.js';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];
const TOKEN_PATH = './credentials/token.json';

export class GoogleSheetsClient {
  constructor(options = {}) {
    this.credentialsPath = options.credentialsPath || './credentials/oauth-credentials.json';
    this.spreadsheetId = options.spreadsheetId || process.env.GOOGLE_SPREADSHEET_ID;
    this.sheets = null;
    this.auth = null;
  }

  async init() {
    // OAuth 자격 증명 로드
    if (!fs.existsSync(this.credentialsPath)) {
      console.error(`\nOAuth 자격 증명 파일을 찾을 수 없습니다: ${this.credentialsPath}`);
      console.error('\n=== OAuth 설정 방법 ===');
      console.error('1. Google Cloud Console (https://console.cloud.google.com) 접속');
      console.error('2. APIs & Services > Credentials');
      console.error('3. Create Credentials > OAuth client ID');
      console.error('4. Application type: Desktop app');
      console.error('5. JSON 다운로드 후 credentials/oauth-credentials.json 으로 저장');
      throw new Error('OAuth 자격 증명 파일 필요');
    }

    const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
    const { client_id, client_secret } = credentials.installed || credentials.web;

    this.auth = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');

    // 저장된 토큰이 있으면 사용
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      this.auth.setCredentials(token);

      // 토큰 갱신 이벤트 핸들러
      this.auth.on('tokens', (tokens) => {
        const currentToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        const updatedToken = { ...currentToken, ...tokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(updatedToken, null, 2));
      });

      // 스코프 확인 - spreadsheets 스코프가 없으면 재인증
      const currentScopes = token.scope ? token.scope.split(' ') : [];
      const needsReauth = !SCOPES.every(scope => currentScopes.includes(scope));

      if (needsReauth) {
        console.log('Google Sheets 스코프가 없습니다. 재인증이 필요합니다.');
        await this.getNewToken();
      }
    } else {
      // 새 토큰 발급
      await this.getNewToken();
    }

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    console.log('Google Sheets API 초기화 완료');
  }

  async getNewToken() {
    return new Promise((resolve, reject) => {
      const authUrl = this.auth.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      });

      console.log('\n=== Google 계정 인증 필요 ===');
      console.log('브라우저에서 다음 URL을 열어 로그인하세요:\n');
      console.log(authUrl);
      console.log('\n인증 완료를 기다리는 중...\n');

      // 로컬 서버로 콜백 받기
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost:3000');
          if (url.pathname === '/callback') {
            const code = url.searchParams.get('code');

            if (code) {
              const { tokens } = await this.auth.getToken(code);
              this.auth.setCredentials(tokens);

              // 토큰 저장
              const tokenDir = path.dirname(TOKEN_PATH);
              if (!fs.existsSync(tokenDir)) {
                fs.mkdirSync(tokenDir, { recursive: true });
              }
              fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end('<h1>인증 성공!</h1><p>이 창을 닫고 터미널로 돌아가세요.</p>');

              server.close();
              resolve();
            }
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>인증 실패</h1><p>${error.message}</p>`);
          server.close();
          reject(error);
        }
      });

      server.listen(3000, () => {
        // 자동으로 브라우저 열기
        exec(`open "${authUrl}"`);
      });

      // 5분 타임아웃
      setTimeout(() => {
        server.close();
        reject(new Error('인증 타임아웃 (5분)'));
      }, 300000);
    });
  }

  // ========== 시트 관리 ==========

  async getSheetNames() {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });
    return response.data.sheets.map(s => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId
    }));
  }

  async createSheet(title) {
    try {
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title }
            }
          }]
        }
      });
      return response.data.replies[0].addSheet.properties.sheetId;
    } catch (error) {
      if (error.message.includes('already exists')) {
        const sheets = await this.getSheetNames();
        const existing = sheets.find(s => s.title === title);
        return existing?.sheetId;
      }
      throw error;
    }
  }

  async getSheetId(sheetName) {
    const sheets = await this.getSheetNames();
    const sheet = sheets.find(s => s.title === sheetName);
    return sheet?.sheetId;
  }

  // ========== 데이터 읽기 ==========

  async getValues(range) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range
    });
    return response.data.values || [];
  }

  async getAllRows(sheetName) {
    const values = await this.getValues(`${sheetName}!A:Z`);
    if (values.length <= 1) return [];

    const headers = values[0];
    return values.slice(1).map((row, index) => {
      const obj = { _rowIndex: index + 2 }; // 1-based, 헤더 제외
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });
  }

  // ========== 데이터 쓰기 ==========

  async setValues(range, values) {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
  }

  async appendRows(sheetName, rows) {
    if (rows.length === 0) return;

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows }
    });
  }

  async updateRow(sheetName, rowIndex, values) {
    await this.setValues(`${sheetName}!A${rowIndex}`, [values]);
  }

  async clearSheet(sheetName, keepHeader = true) {
    const startRow = keepHeader ? 2 : 1;
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A${startRow}:Z`
    });
  }

  /**
   * 특정 행 삭제
   * @param {string} sheetName - 시트 이름
   * @param {number} rowIndex - 삭제할 행 번호 (1-based)
   */
  async deleteRow(sheetName, rowIndex) {
    const sheetId = await this.getSheetId(sheetName);

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,  // 0-based
              endIndex: rowIndex         // exclusive
            }
          }
        }]
      }
    });
  }

  // ========== Data Validation ==========

  async setDropdown(sheetName, column, options, startRow = 2) {
    const sheetId = await this.getSheetId(sheetName);
    const columnIndex = column.charCodeAt(0) - 65; // A=0, B=1, ...

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: startRow - 1,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: options.map(v => ({ userEnteredValue: v }))
              },
              showCustomUi: true,
              strict: false
            }
          }
        }]
      }
    });
  }

  async setDropdownFromRange(sheetName, column, sourceRange, startRow = 2) {
    const sheetId = await this.getSheetId(sheetName);
    const columnIndex = column.charCodeAt(0) - 65;

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: startRow - 1,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1
            },
            rule: {
              condition: {
                type: 'ONE_OF_RANGE',
                values: [{ userEnteredValue: `=${sourceRange}` }]
              },
              showCustomUi: true,
              strict: false
            }
          }
        }]
      }
    });
  }

  // ========== 헤더 스타일링 ==========

  async formatHeader(sheetName) {
    const sheetId = await this.getSheetId(sheetName);

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          // 헤더 행 고정
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { frozenRowCount: 1 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          }
        ]
      }
    });
  }

  // ========== 비즈니스 로직 ==========

  async findRow(sheetName, column, value) {
    const rows = await this.getAllRows(sheetName);
    return rows.find(row => row[column] === value);
  }

  async findById(sheetName, id) {
    return this.findRow(sheetName, 'ID', id);
  }

  // ========== ID 생성 ==========

  async getNextId(sheetName, prefix) {
    const rows = await this.getAllRows(sheetName);
    if (rows.length === 0) {
      return `${prefix}0001`;
    }
    // 마지막 ID에서 숫자 추출 후 +1
    const lastId = rows[rows.length - 1]['ID'] || `${prefix}0000`;
    const num = parseInt(lastId.replace(prefix, ''), 10) || 0;
    return `${prefix}${String(num + 1).padStart(4, '0')}`;
  }

  // ========== 운용사 관리 ==========

  async getOrCreateOperator(name, data = {}) {
    // 이름으로 기존 운용사 찾기
    const existing = await this.findRow('운용사', '운용사명', name);
    if (existing) {
      return { isNew: false, id: existing['ID'], data: existing };
    }

    // 새 ID 생성
    const newId = await this.getNextId('운용사', 'OP');

    // 유형/국가 결정
    const region = data.region || '';
    let country = '한국';
    let type = '국내VC';
    if (region === '미국') {
      country = '미국';
      type = '해외VC';
    } else if (region === '유럽/중동') {
      country = '유럽/중동';
      type = '해외VC';
    } else if (region === '아시아' && !name.match(/[가-힣]/)) {
      country = '아시아';
      type = '해외VC';
    }

    // 새 행 추가: ID, 운용사명, 약어, 유형, 국가
    const newRow = [
      newId,
      name,
      data.약어 || '',
      data.유형 || type,
      data.국가 || country
    ];
    await this.appendRows('운용사', [newRow]);

    console.log(`  [운용사 생성] ${newId}: ${name} (${type}, ${country})`);
    return { isNew: true, id: newId, data: { ID: newId, 운용사명: name } };
  }

  async findOperatorByName(name) {
    return this.findRow('운용사', '운용사명', name);
  }

  async findOperatorByAlias(alias) {
    const rows = await this.getAllRows('운용사');
    return rows.find(row => row['약어'] === alias);
  }

  async updateOperatorAlias(operatorId, alias) {
    const row = await this.findById('운용사', operatorId);
    if (row && row._rowIndex) {
      const existingAlias = row['약어'] || '';

      // 기존 약어가 있으면 중복 체크 후 추가
      if (existingAlias) {
        const aliases = existingAlias.split(',').map(a => a.trim());
        if (!aliases.includes(alias)) {
          const newAlias = existingAlias + ', ' + alias;
          await this.setValues(`운용사!C${row._rowIndex}`, [[newAlias]]);
          console.log(`  [약어 추가] ${operatorId}: ${existingAlias} → ${newAlias}`);
        } else {
          console.log(`  [약어 중복] ${operatorId}: "${alias}" 이미 존재`);
        }
      } else {
        // 기존 약어 없으면 그대로 저장
        await this.setValues(`운용사!C${row._rowIndex}`, [[alias]]);
        console.log(`  [약어 저장] ${operatorId}: ${alias}`);
      }
    }
  }

  /**
   * 모든 운용사 목록 조회
   */
  async getAllOperators() {
    return this.getAllRows('운용사');
  }

  /**
   * 신규 운용사명 목록에서 기존 운용사와 유사한 항목 찾기
   * @param {string[]} newNames - 신규 운용사명 목록
   * @param {number} threshold - 유사도 임계값 (기본 0.6)
   * @returns {Object} { exact: [], similar: [], new: [] }
   */
  async findSimilarOperatorsFromDB(newNames, threshold = 0.6) {
    const existingOperators = await this.getAllOperators();
    return findSimilarOperators(newNames, existingOperators, threshold);
  }

  /**
   * 유사 운용사 검토 결과 포맷팅
   */
  formatSimilarOperatorsForReview(similarList) {
    return formatSimilarOperatorsForReview(similarList);
  }

  // ========== 출자사업 관리 ==========

  async getOrCreateProject(projectName, data = {}) {
    // 이름으로 기존 출자사업 찾기
    const existing = await this.findRow('출자사업', '사업명', projectName);
    if (existing) {
      return { isNew: false, id: existing['ID'], data: existing };
    }

    // 새 ID 생성
    const newId = await this.getNextId('출자사업', 'PJ');

    // 새 행 추가: ID, 사업명, 소관, 공고유형, 연도, 차수, 지원파일ID, 결과파일ID, 현황, 비고, 확인완료
    const newRow = [
      newId,
      projectName,
      data.소관 || '',
      data.공고유형 || '',
      data.연도 || '',
      data.차수 || '',
      data.지원파일ID || '',
      data.결과파일ID || '',
      '', // 현황
      '', // 비고
      ''  // 확인완료 (기본값: 비어있음)
    ];
    await this.appendRows('출자사업', [newRow]);

    console.log(`  [출자사업 생성] ${newId}: ${projectName}`);
    return { isNew: true, id: newId, data: { ID: newId, 사업명: projectName } };
  }

  async updateProjectFileId(projectId, fileType, fileId) {
    const row = await this.findById('출자사업', projectId);
    if (!row || !row._rowIndex) return;

    // 다른 출자사업에 이미 연결된 파일인지 검증 (중복 시 에러 발생으로 처리 중단)
    const allProjects = await this.getValues('출자사업!A:H');
    const columnIndex = fileType === '접수현황' ? 6 : 7; // G열(지원파일ID) 또는 H열(결과파일ID)
    for (let i = 1; i < allProjects.length; i++) {
      const pjId = allProjects[i][0];
      const pjName = allProjects[i][1];
      const linkedFileIds = (allProjects[i][columnIndex] || '').split(',').map(s => s.trim()).filter(Boolean);
      if (pjId !== projectId && linkedFileIds.includes(fileId)) {
        const error = new Error(
          `파일 중복 연결 오류: ${fileId}는 이미 ${pjId}(${pjName})에 연결됨. ` +
          `현재 시도: ${projectId}(${row['사업명']}). 파일-출자사업 매칭을 확인하세요.`
        );
        error.code = 'DUPLICATE_FILE_LINK';
        error.existingProjectId = pjId;
        error.targetProjectId = projectId;
        error.fileId = fileId;
        throw error;
      }
    }

    // 열 순서: A:ID, B:사업명, C:소관, D:공고유형, E:연도, F:차수, G:지원파일ID, H:결과파일ID
    if (fileType === '접수현황') {
      // 지원파일ID는 G열 (7번째)
      const existing = row['지원파일ID'] || '';
      const ids = existing ? existing.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (!ids.includes(fileId)) {
        ids.push(fileId);
      }
      await this.setValues(`출자사업!G${row._rowIndex}`, [[ids.join(', ')]]);
      console.log(`  [지원파일ID 추가] ${projectId}: ${fileId}`);
    } else if (fileType === '선정결과') {
      // 결과파일ID는 H열 (8번째)
      const existing = row['결과파일ID'] || '';
      const ids = existing ? existing.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (!ids.includes(fileId)) {
        ids.push(fileId);
      }
      await this.setValues(`출자사업!H${row._rowIndex}`, [[ids.join(', ')]]);
      console.log(`  [결과파일ID 추가] ${projectId}: ${fileId}`);
    }
  }

  // ========== 신청현황 관리 ==========

  async createApplication(data) {
    // 새 ID 생성
    const newId = await this.getNextId('신청현황', 'AP');

    // 헤더: ID, 출자사업ID, 운용사ID, 출자분야, 최소결성규모, 모태출자액, 결성예정액, 출자요청액, 통화단위, 상태, 비고
    const newRow = [
      newId,                    // A: ID
      data.출자사업ID || '',     // B: 출자사업ID
      data.운용사ID || '',       // C: 운용사ID
      data.출자분야 || '',       // D: 출자분야
      data.최소결성규모 || '',   // E: 최소결성규모
      data.모태출자액 || '',     // F: 모태출자액
      data.결성예정액 || '',     // G: 결성예정액
      data.출자요청액 || '',     // H: 출자요청액
      data.통화단위 || '',       // I: 통화단위
      data.상태 || '',          // J: 상태
      data.비고 || ''           // K: 비고
    ];
    await this.appendRows('신청현황', [newRow]);

    return newId;
  }

  /**
   * 신청현황 일괄 생성 (배치)
   * @param {Array} dataList - 신청현황 데이터 배열
   * @returns {Array} 생성된 ID 배열
   */
  async createApplicationsBatch(dataList) {
    if (dataList.length === 0) return [];

    // 현재 마지막 ID 조회
    const rows = await this.getAllRows('신청현황');
    let lastNum = 0;
    if (rows.length > 0) {
      const lastId = rows[rows.length - 1]['ID'] || 'AP0000';
      lastNum = parseInt(lastId.replace('AP', ''), 10) || 0;
    }

    // 배치로 행 생성
    const newRows = [];
    const newIds = [];
    for (const data of dataList) {
      lastNum++;
      const newId = `AP${String(lastNum).padStart(4, '0')}`;
      newIds.push(newId);
      newRows.push([
        newId,
        data.출자사업ID || '',
        data.운용사ID || '',
        data.출자분야 || '',
        data.최소결성규모 || '',
        data.모태출자액 || '',
        data.결성예정액 || '',
        data.출자요청액 || '',
        data.통화단위 || '',
        data.상태 || '',
        data.비고 || ''
      ]);
    }

    // 한 번의 API 호출로 모든 행 추가
    await this.appendRows('신청현황', newRows);
    console.log(`  [신청현황 배치 생성] ${newRows.length}건`);

    return newIds;
  }

  /**
   * 운용사 일괄 생성 (배치)
   * @param {Array} names - 운용사명 배열
   * @returns {Map} 운용사명 -> ID 맵
   */
  async createOperatorsBatch(names) {
    if (names.length === 0) return new Map();

    // 현재 마지막 ID 조회
    const rows = await this.getAllRows('운용사');
    let lastNum = 0;
    if (rows.length > 0) {
      const lastId = rows[rows.length - 1]['ID'] || 'OP0000';
      lastNum = parseInt(lastId.replace('OP', ''), 10) || 0;
    }

    // 배치로 행 생성
    const newRows = [];
    const resultMap = new Map();
    for (const name of names) {
      lastNum++;
      const newId = `OP${String(lastNum).padStart(4, '0')}`;
      resultMap.set(name, newId);
      newRows.push([
        newId,
        name,
        '',           // 약어
        '국내VC',     // 유형
        '한국'        // 국가
      ]);
    }

    // 한 번의 API 호출로 모든 행 추가
    await this.appendRows('운용사', newRows);
    console.log(`  [운용사 배치 생성] ${newRows.length}건`);

    return resultMap;
  }

  async findApplicationByProjectAndOperator(projectId, operatorId) {
    const rows = await this.getAllRows('신청현황');
    return rows.find(row => {
      if (row['출자사업ID'] !== projectId) return false;
      const operatorIds = (row['운용사ID'] || '').split(',').map(s => s.trim());
      return operatorIds.includes(operatorId);
    });
  }

  async getExistingApplications(projectId) {
    const rows = await this.getAllRows('신청현황');
    const existing = new Map();

    for (const row of rows) {
      if (row['출자사업ID'] !== projectId) continue;
      const operatorIds = (row['운용사ID'] || '').split(',').map(s => s.trim());
      const category = row['출자분야'] || '';
      for (const opId of operatorIds) {
        if (opId) {
          // 키: 운용사ID|출자분야 (중복 체크 기준)
          const key = `${opId}|${category}`;
          existing.set(key, { rowIndex: row._rowIndex, status: row['상태'], appId: row['ID'], operatorId: opId, category });
        }
      }
    }
    return existing;
  }

  async updateApplicationStatus(appId, status) {
    const row = await this.findById('신청현황', appId);
    if (row && row._rowIndex) {
      // 상태는 I열 (9번째)
      await this.setValues(`신청현황!I${row._rowIndex}`, [[status]]);
    }
  }

  // ========== 출자사업 현황 관리 ==========

  /**
   * 출자사업의 현황 통계를 계산하여 업데이트
   * @param {string} projectId - 출자사업 ID
   * @returns {Object} { total, 선정, 탈락, 접수 }
   */
  async updateProjectStatus(projectId) {
    const applications = await this.getAllRows('신청현황');
    const projectApps = applications.filter(app => app['출자사업ID'] === projectId);

    const stats = {
      total: projectApps.length,
      선정: projectApps.filter(app => app['상태'] === '선정').length,
      탈락: projectApps.filter(app => app['상태'] === '탈락').length,
      접수: projectApps.filter(app => app['상태'] === '접수').length
    };

    // 현황 문자열 생성: "총 171건 (선정 45, 탈락 126)"
    let statusText = `총 ${stats.total}건`;
    if (stats.선정 > 0 || stats.탈락 > 0) {
      const details = [];
      if (stats.선정 > 0) details.push(`선정 ${stats.선정}`);
      if (stats.탈락 > 0) details.push(`탈락 ${stats.탈락}`);
      if (stats.접수 > 0) details.push(`접수 ${stats.접수}`);
      statusText += ` (${details.join(', ')})`;
    }

    // 출자사업 시트에 현황 업데이트
    const project = await this.findById('출자사업', projectId);
    if (project && project._rowIndex) {
      // 현황은 I열 (9번째) - 헤더: ID, 사업명, 소관, 공고유형, 연도, 차수, 지원파일ID, 결과파일ID, 현황
      await this.setValues(`출자사업!I${project._rowIndex}`, [[statusText]]);
      console.log(`  [현황 업데이트] ${projectId}: ${statusText}`);
    }

    return stats;
  }

  /**
   * 모든 출자사업의 현황 통계를 일괄 업데이트
   */
  async updateAllProjectStatuses() {
    const projects = await this.getAllRows('출자사업');
    console.log(`\n=== 출자사업 현황 일괄 업데이트 (${projects.length}건) ===`);

    for (const project of projects) {
      await this.updateProjectStatus(project['ID']);
    }

    console.log('=== 현황 업데이트 완료 ===\n');
  }

  /**
   * 출자사업 확인완료 상태 업데이트
   * @param {string} projectId - 출자사업 ID
   * @param {string} status - 'AI확인완료' 또는 '사람확인완료'
   */
  async updateProjectVerification(projectId, status) {
    if (!['AI확인완료', '사람확인완료'].includes(status)) {
      throw new Error(`잘못된 확인완료 상태: ${status}. 'AI확인완료' 또는 '사람확인완료'만 가능합니다.`);
    }

    const project = await this.findById('출자사업', projectId);
    if (!project || !project._rowIndex) {
      throw new Error(`출자사업을 찾을 수 없습니다: ${projectId}`);
    }

    // 확인완료는 K열 (11번째)
    await this.setValues(`출자사업!K${project._rowIndex}`, [[status]]);
    console.log(`  [확인완료 업데이트] ${projectId}: ${status}`);
  }

  // ========== 약어 캐시 로드 ==========

  async loadAliasMap() {
    const rows = await this.getAllRows('운용사');
    const aliasMap = new Map();

    for (const row of rows) {
      const alias = row['약어'];
      const fullName = row['운용사명'];
      const id = row['ID'];
      if (alias && fullName) {
        aliasMap.set(alias, { fullName, id });
      }
    }

    return aliasMap;
  }

  // ========== 파일 관리 ==========

  async getOrCreateFileHistory(fileNo, fileName, fileType = '', fileUrl = '') {
    // 파일번호로 기존 이력 찾기
    const existing = await this.findRow('파일', '파일번호', fileNo);
    if (existing) {
      return { isNew: false, id: existing['ID'], data: existing };
    }

    // 새 ID 생성
    const newId = await this.getNextId('파일', 'FH');

    // 새 행 추가: ID, 파일명, 파일번호, 파일유형, 파일URL, 처리상태, 처리일시, 비고
    const newRow = [
      newId,
      fileName || '',
      fileNo,
      fileType || '',
      fileUrl || '',
      '대기',
      '',
      ''
    ];
    await this.appendRows('파일', [newRow]);

    return { isNew: true, id: newId, data: { ID: newId, 파일번호: fileNo } };
  }

  async updateFileHistory(fileHistoryId, data) {
    const row = await this.findById('파일', fileHistoryId);
    if (!row || !row._rowIndex) return;

    // 열 순서: A:ID, B:파일명, C:파일번호, D:파일유형, E:파일URL, F:처리상태, G:처리일시, H:비고, I:현황
    if (data.파일유형) {
      await this.setValues(`파일!D${row._rowIndex}`, [[data.파일유형]]);
    }
    if (data.파일URL) {
      await this.setValues(`파일!E${row._rowIndex}`, [[data.파일URL]]);
    }
    if (data.처리상태) {
      await this.setValues(`파일!F${row._rowIndex}`, [[data.처리상태]]);
    }
    if (data.처리일시) {
      await this.setValues(`파일!G${row._rowIndex}`, [[data.처리일시]]);
    }
    if (data.비고) {
      await this.setValues(`파일!H${row._rowIndex}`, [[data.비고]]);
    }
    if (data.현황) {
      await this.setValues(`파일!I${row._rowIndex}`, [[data.현황]]);
    }
  }

  async findFileHistoryByFileNo(fileNo) {
    return this.findRow('파일', '파일번호', fileNo);
  }

  /**
   * 파일 현황을 신청현황과 동기화
   * - 선정결과 파일: 해당 출자사업의 신청현황에서 통계 계산
   * @param {string} fileId - 파일 ID
   * @returns {Object} { total, selected, summary }
   */
  async syncFileStatusWithApplications(fileId) {
    const file = await this.findById('파일', fileId);
    if (!file) return null;

    if (file['파일유형'] !== '선정결과') {
      return null; // 선정결과 파일만 동기화
    }

    // 이 파일이 연결된 출자사업 찾기
    const projects = await this.getValues('출자사업!A:H');
    let linkedProjectId = null;
    for (let i = 1; i < projects.length; i++) {
      const resultFileIds = (projects[i][7] || '').split(',').map(s => s.trim());
      if (resultFileIds.includes(fileId)) {
        linkedProjectId = projects[i][0];
        break;
      }
    }

    if (!linkedProjectId) {
      console.log(`  [동기화 스킵] ${fileId}가 연결된 출자사업 없음`);
      return null;
    }

    // 해당 출자사업의 신청현황 통계 계산
    const applications = await this.getAllRows('신청현황');
    const projectApps = applications.filter(app => app['출자사업ID'] === linkedProjectId);

    const total = projectApps.length;
    const selected = projectApps.filter(app => app['상태'] === '선정').length;
    const summary = `총 ${total}개 중 선정 ${selected}건`;

    // 파일 현황 업데이트
    if (file._rowIndex) {
      await this.setValues(`파일!I${file._rowIndex}`, [[summary]]);
      console.log(`  [파일 현황 동기화] ${fileId}: ${summary}`);
    }

    return { total, selected, summary };
  }

  // ========== 파일 매칭 (사업명 기반) ==========

  /**
   * PDF 텍스트에서 사업명 추출
   * @param {string} text - PDF 텍스트
   * @returns {string} 추출된 사업명 (정규화됨)
   */
  extractProjectNameFromText(text) {
    // 패턴 1: "2024년 해외 VC 출자사업" 형태
    const patterns = [
      /(20\d{2}년도?\s*(?:제?\d+차\s*)?(?:한국)?모태펀드\s*[^\n]+출자사업)/,
      /(20\d{2}년도?\s*(?:해외\s*VC|글로벌|국내)\s*[^\n]*출자사업)/,
      /(모태펀드\s*20\d{2}년[^\n]+출자사업)/,
      /(20\d{2}년[^\n]{0,30}출자사업)/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizeProjectName(match[1]);
      }
    }
    return '';
  }

  /**
   * 사업명 정규화 (비교용)
   */
  normalizeProjectName(name) {
    return name
      .replace(/\s+/g, ' ')
      .replace(/접수현황|선정결과|지원현황|심사결과/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();
  }

  /**
   * 파일번호로 매칭되는 쌍(접수현황+선정결과) 찾기
   * @param {string} fileNo - 파일번호
   * @param {string} projectName - 사업명 (PDF에서 추출)
   * @returns {Object} { applicationFileNo, selectionFileNo, projectName }
   */
  async findMatchingFilePair(fileNo, projectName) {
    const allFiles = await this.getAllRows('파일');
    const currentFile = allFiles.find(f => f['파일번호'] === fileNo);

    if (!currentFile) {
      return { applicationFileNo: null, selectionFileNo: null, projectName };
    }

    const currentType = currentFile['파일유형'];
    const normalizedProjectName = this.normalizeProjectName(projectName);

    // 같은 사업명을 가진 다른 유형의 파일 찾기
    let matchedFile = null;
    const targetType = currentType === '접수현황' ? '선정결과' : '접수현황';

    for (const file of allFiles) {
      if (file['파일번호'] === fileNo) continue;
      if (file['파일유형'] !== targetType) continue;

      // 파일명에서 사업명 추출하여 비교
      const fileName = file['파일명'] || '';
      // 파일명에 사업명 키워드가 포함되어 있는지 확인
      if (this.isProjectNameMatch(normalizedProjectName, fileName)) {
        matchedFile = file;
        break;
      }
    }

    if (currentType === '접수현황') {
      return {
        applicationFileNo: fileNo,
        selectionFileNo: matchedFile ? matchedFile['파일번호'] : null,
        projectName: normalizedProjectName
      };
    } else {
      return {
        applicationFileNo: matchedFile ? matchedFile['파일번호'] : null,
        selectionFileNo: fileNo,
        projectName: normalizedProjectName
      };
    }
  }

  /**
   * 사업명이 파일명과 매칭되는지 확인
   */
  isProjectNameMatch(projectName, fileName) {
    // 연도 추출
    const yearMatch = projectName.match(/20\d{2}/);
    const year = yearMatch ? yearMatch[0] : null;

    // 키워드 추출 (해외 VC, 글로벌, 국내 등)
    const keywords = [];
    if (projectName.includes('해외') || projectName.includes('글로벌')) {
      keywords.push('해외', '글로벌', 'Global');
    }
    if (projectName.includes('국내')) {
      keywords.push('국내');
    }
    if (projectName.includes('VC')) {
      keywords.push('VC');
    }

    // 연도가 일치하고 키워드 중 하나라도 포함되면 매칭
    const hasYear = year && fileName.includes(year);
    const hasKeyword = keywords.length === 0 || keywords.some(kw => fileName.includes(kw));

    return hasYear && hasKeyword;
  }

  /**
   * 파일 시트에서 처리 대기 중인 파일 쌍 조회
   */
  async getPendingFilePairs() {
    const allFiles = await this.getAllRows('파일');
    const pendingFiles = allFiles.filter(f => f['처리상태'] !== '완료');

    const pairs = [];
    const processed = new Set();

    for (const file of pendingFiles) {
      if (processed.has(file['파일번호'])) continue;

      const fileNo = file['파일번호'];
      const fileType = file['파일유형'];
      const fileName = file['파일명'];

      // 같은 사업의 쌍 찾기
      const targetType = fileType === '접수현황' ? '선정결과' : '접수현황';
      const matchedFile = pendingFiles.find(f => {
        if (f['파일번호'] === fileNo) return false;
        if (f['파일유형'] !== targetType) return false;
        return this.isProjectNameMatch(fileName, f['파일명']);
      });

      if (matchedFile) {
        processed.add(fileNo);
        processed.add(matchedFile['파일번호']);

        pairs.push({
          applicationFileNo: fileType === '접수현황' ? fileNo : matchedFile['파일번호'],
          selectionFileNo: fileType === '선정결과' ? fileNo : matchedFile['파일번호'],
          applicationFileName: fileType === '접수현황' ? fileName : matchedFile['파일명'],
          selectionFileName: fileType === '선정결과' ? fileName : matchedFile['파일명']
        });
      }
    }

    return pairs;
  }

  // ========== AI 검증용 역조회 메서드 ==========

  /**
   * 파일 ID로 연결된 신청현황 조회 (파일→출자사업→신청현황)
   * @param {string} fileId - 파일 ID (예: FH0001)
   * @returns {Array} 신청현황 배열
   */
  async getApplicationsByFile(fileId) {
    const allProjects = await this.getAllRows('출자사업');
    const allApplications = await this.getAllRows('신청현황');

    // 파일 ID가 연결된 모든 출자사업 찾기
    const linkedProjects = allProjects.filter(project => {
      const appFileIds = (project['지원파일ID'] || '').split(',').map(s => s.trim());
      const selFileIds = (project['결과파일ID'] || '').split(',').map(s => s.trim());
      return appFileIds.includes(fileId) || selFileIds.includes(fileId);
    });

    const linkedProjectIds = linkedProjects.map(p => p['ID']);

    // 연결된 출자사업의 신청현황 반환
    return allApplications.filter(app => linkedProjectIds.includes(app['출자사업ID']));
  }

  /**
   * 출자사업 ID로 연결된 파일 조회
   * @param {string} projectId - 출자사업 ID (예: PJ0001)
   * @returns {Object} { applicationFiles: [...], selectionFiles: [...] }
   */
  async getFilesByProject(projectId) {
    const project = await this.findRow('출자사업', 'ID', projectId);
    if (!project) {
      return { applicationFiles: [], selectionFiles: [] };
    }

    const allFiles = await this.getAllRows('파일');

    const appFileIds = (project['지원파일ID'] || '').split(',').map(s => s.trim()).filter(Boolean);
    const selFileIds = (project['결과파일ID'] || '').split(',').map(s => s.trim()).filter(Boolean);

    const applicationFiles = allFiles.filter(f => appFileIds.includes(f['ID']));
    const selectionFiles = allFiles.filter(f => selFileIds.includes(f['ID']));

    return { applicationFiles, selectionFiles };
  }

  /**
   * 출자사업 ID로 신청현황 조회 (이미 있지만 명시적으로 추가)
   * @param {string} projectId - 출자사업 ID
   * @returns {Array} 신청현황 배열
   */
  async getApplicationsByProject(projectId) {
    const allApplications = await this.getAllRows('신청현황');
    return allApplications.filter(app => app['출자사업ID'] === projectId);
  }

  /**
   * 출자사업 확인완료 필드 업데이트
   * @param {string} projectId - 출자사업 ID
   * @param {string} status - 확인완료 상태 (예: 'AI확인완료', '수동확인필요')
   */
  async updateProjectVerificationStatus(projectId, status) {
    const project = await this.findRow('출자사업', 'ID', projectId);
    if (!project || !project._rowIndex) {
      throw new Error(`출자사업 ${projectId}를 찾을 수 없습니다.`);
    }

    // 확인완료 필드는 J열 (10번째 컬럼)
    await this.setValues(`출자사업!J${project._rowIndex}`, [[status]]);
    console.log(`  [출자사업 확인완료] ${projectId}: ${status}`);
  }
}
