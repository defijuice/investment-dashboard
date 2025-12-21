import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const TARGET_CATEGORIES = ['접수현황', '선정결과'];

export class KvicScraper {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://www.kvic.or.kr';
    this.noticePath = options.noticePath || '/notice/kvic-notice/investment-business-notice';
    this.downloadDir = options.downloadDir || './downloads';
    this.browser = null;
    this.page = null;
  }

  async init() {
    // 다운로드 디렉토리 생성
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }

    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();

    // 다운로드 경로 설정
    const client = await this.page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: path.resolve(this.downloadDir)
    });

    await this.page.setViewport({ width: 1280, height: 800 });
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async getNoticeList(pageNo = 1) {
    const url = `${this.baseUrl}${this.noticePath}?pageNo=${pageNo}&searchType=all&searchWord=&searchCategory=`;

    console.log(`페이지 ${pageNo} 로딩 중: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 게시글 목록 파싱
    const notices = await this.page.evaluate((targetCategories) => {
      const rows = document.querySelectorAll('table tbody tr');
      const results = [];

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return;

        const categoryCell = cells[1];
        const category = categoryCell?.textContent?.trim() || '';

        // 타겟 카테고리인지 확인 (텍스트에 포함되어 있는지 확인)
        const isTarget = targetCategories.some(tc => category.includes(tc));
        if (!isTarget) return;

        const titleCell = cells[3];
        const titleLink = titleCell?.querySelector('a');
        const title = titleLink?.textContent?.trim() || '';

        // href에서 ID 추출 (예: javascript:board_view(4653);)
        const href = titleLink?.getAttribute('href') || '';
        const idMatch = href.match(/board_view\((\d+)\)/);
        const id = idMatch ? idMatch[1] : null;

        const hasAttachment = cells[2]?.querySelector('img') !== null;
        const date = cells[4]?.textContent?.trim() || '';

        if (id) {
          results.push({
            id,
            category,
            title,
            date,
            hasAttachment
          });
        }
      });

      return results;
    }, TARGET_CATEGORIES);

    return notices;
  }

  async getNoticeDetail(noticeId) {
    // 상세 페이지로 이동 (쿼리 파라미터 방식)
    const url = `${this.baseUrl}${this.noticePath}?id=${noticeId}`;

    console.log(`게시글 상세 로딩 중: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 첨부파일 정보 파싱
    const attachments = await this.page.evaluate((baseUrl) => {
      const fileList = [];

      // 파일 다운로드 링크 찾기 (class="file-btn file-down")
      const downloadLinks = document.querySelectorAll('a.file-down, a[href*="fileDown"]');

      downloadLinks.forEach(link => {
        const href = link.getAttribute('href') || '';

        // 같은 행에서 파일명 찾기 (이전 요소들 탐색)
        let fileName = '';
        const parent = link.closest('td') || link.parentElement;
        if (parent) {
          // PDF, HWP 등 파일 아이콘 옆의 텍스트 또는 이전 링크 텍스트
          const allText = parent.textContent || '';
          // 파일명 추출 시도 (확장자 기반)
          const fileMatch = allText.match(/[\w가-힣\s\-_.()]+\.(pdf|hwp|hwpx|xlsx|xls|docx|doc|zip|pptx|ppt)/i);
          if (fileMatch) {
            fileName = fileMatch[0].trim();
          }
        }

        // 파일명이 없으면 URL에서 추출 시도
        if (!fileName && href) {
          const urlParams = new URLSearchParams(href.split('?')[1]);
          fileName = `file_${urlParams.get('boardDataNo')}_${urlParams.get('idx')}`;
        }

        if (href) {
          fileList.push({
            fileName: fileName || '첨부파일',
            href: href.startsWith('/') ? href : `/${href}`,
            downloadUrl: href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? href : '/' + href}`
          });
        }
      });

      return fileList;
    }, this.baseUrl);

    return attachments;
  }

  async downloadFile(noticeId, attachment) {
    try {
      console.log(`  다운로드 시작: ${attachment.fileName}`);

      // 다운로드 전 현재 디렉토리의 파일 목록 저장
      const filesBefore = new Set(fs.readdirSync(this.downloadDir));

      // target="_blank" 제거하고 클릭
      await this.page.evaluate((href) => {
        const link = document.querySelector(`a[href="${href}"]`);
        if (link) {
          link.removeAttribute('target');
        }
      }, attachment.href);

      // 페이지 컨텍스트에서 fetch로 다운로드
      const downloadUrl = `${this.baseUrl}${attachment.href}`;

      // CDP를 통해 직접 다운로드 요청
      const client = await this.page.createCDPSession();

      // 현재 페이지의 쿠키 가져오기
      const cookies = await this.page.cookies();

      // fetch를 사용하여 다운로드
      const response = await this.page.evaluate(async (url) => {
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include'
        });

        if (!res.ok) {
          return { error: `HTTP ${res.status}` };
        }

        const blob = await res.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // base64로 변환
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        // Content-Disposition에서 파일명 추출
        const contentDisposition = res.headers.get('content-disposition');
        let fileName = null;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[*]?=['"]?(?:UTF-8'')?([^'";]+)/i);
          if (match) {
            fileName = decodeURIComponent(match[1]);
          }
        }

        return {
          base64,
          fileName,
          contentType: res.headers.get('content-type')
        };
      }, downloadUrl);

      if (response.error) {
        console.log(`  다운로드 실패: ${response.error}`);
        return null;
      }

      // base64를 파일로 저장
      const buffer = Buffer.from(response.base64, 'base64');
      const fileName = response.fileName || attachment.fileName;
      const safeFileName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
      const filePath = path.join(this.downloadDir, `${noticeId}_${safeFileName}`);

      fs.writeFileSync(filePath, buffer);
      console.log(`  파일 저장 완료: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);

      return filePath;
    } catch (error) {
      console.error(`  파일 다운로드 실패: ${attachment.fileName}`, error.message);
    }

    return null;
  }

  async scrapeAndDownload(maxPages = 5) {
    const results = [];

    for (let page = 1; page <= maxPages; page++) {
      const notices = await this.getNoticeList(page);

      if (notices.length === 0) {
        console.log(`페이지 ${page}: 타겟 카테고리 게시글 없음`);
        continue;
      }

      console.log(`페이지 ${page}: ${notices.length}개 게시글 발견`);

      for (const notice of notices) {
        console.log(`\n처리 중: [${notice.category}] ${notice.title}`);

        const attachments = await this.getNoticeDetail(notice.id);

        if (attachments.length === 0) {
          console.log('  첨부파일 없음');
          continue;
        }

        const downloadedFiles = [];
        for (const attachment of attachments) {
          const filePath = await this.downloadFile(notice.id, attachment);
          if (filePath) {
            downloadedFiles.push({
              fileName: attachment.fileName,
              localPath: filePath
            });
          }
        }

        results.push({
          ...notice,
          downloadedFiles
        });
      }
    }

    return results;
  }
}
