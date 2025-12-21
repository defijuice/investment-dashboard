import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import { exec } from 'child_process';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = './credentials/token.json';

export class GoogleDriveUploader {
  constructor(options = {}) {
    this.credentialsPath = options.credentialsPath || './credentials/oauth-credentials.json';
    this.folderId = options.folderId;
    this.drive = null;
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
    } else {
      // 새 토큰 발급
      await this.getNewToken();
    }

    this.drive = google.drive({ version: 'v3', auth: this.auth });
    console.log('Google Drive API 초기화 완료');
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

  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.hwp': 'application/x-hwp',
      '.hwpx': 'application/x-hwpx',
      '.zip': 'application/zip',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async uploadFile(filePath, customFileName = null) {
    if (!this.drive) {
      throw new Error('Google Drive가 초기화되지 않았습니다. init()을 먼저 호출하세요.');
    }

    const fileName = customFileName || path.basename(filePath);
    const mimeType = this.getMimeType(fileName);

    const fileMetadata = {
      name: fileName,
      parents: this.folderId ? [this.folderId] : []
    };

    const media = {
      mimeType,
      body: fs.createReadStream(filePath)
    };

    try {
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink, webContentLink'
      });

      console.log(`업로드 완료: ${fileName}`);
      console.log(`  - 링크: ${response.data.webViewLink}`);

      return {
        success: true,
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink
      };
    } catch (error) {
      console.error(`업로드 실패: ${fileName}`, error.message);
      return {
        success: false,
        fileName,
        error: error.message
      };
    }
  }

  async uploadFiles(filePaths) {
    const results = [];

    for (const filePath of filePaths) {
      const result = await this.uploadFile(filePath);
      results.push(result);
    }

    return results;
  }

  async listFiles(folderId = null) {
    const targetFolderId = folderId || this.folderId;
    const allFiles = [];
    let pageToken = null;

    try {
      do {
        const response = await this.drive.files.list({
          q: targetFolderId ? `'${targetFolderId}' in parents` : null,
          fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
          orderBy: 'createdTime desc',
          pageSize: 1000,
          pageToken: pageToken
        });

        allFiles.push(...response.data.files);
        pageToken = response.data.nextPageToken;
      } while (pageToken);

      return allFiles;
    } catch (error) {
      console.error('파일 목록 조회 실패:', error.message);
      return [];
    }
  }
}
