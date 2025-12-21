import { GoogleSheetsClient } from './googleSheets.js';

// PDF에서 추출한 금액 데이터 (프로젝트별) - 신청현황 운용사명 기준
const amountData = {
  // PJ0003: 모태펀드(문화, 영화, 해양) 2024년 1차 정시 (파일 4148, 4131) - Type B
  'PJ0003': {
    type: 'B', // 결성예정액, 출자요청액
    currency: '억원',
    data: [
      // IP (4148)
      { operator: '넥스트지인베스트먼트', category: 'IP', formation: 2000, request: 1200 },
      { operator: '스페이스타임인베스트먼트', category: 'IP', formation: 2000, request: 1200 },
      { operator: '에스비아이인베스트먼트', category: 'IP', formation: 2000, request: 1200 },
      { operator: '케이씨벤처스', category: 'IP', formation: 2000, request: 1200 },
      { operator: '펜처인베스트', category: 'IP', formation: 2000, request: 1200 },
      // 수출 (4148)
      { operator: '스마트스터디벤처스', category: '수출', formation: 1525, request: 900 },
      { operator: '일신창업투자', category: '수출', formation: 1525, request: 900 },
      { operator: '코나벤처파트너스', category: '수출', formation: 1525, request: 900 },
      { operator: '한국투자파트너스', category: '수출', formation: 1525, request: 900 },
      // 신기술 (4148)
      { operator: '인라이트벤처스', category: '신기술', formation: 1002, request: 600 },
      { operator: '솔트룩스벤처스', category: '신기술', formation: 1002, request: 600 },
      { operator: '코나벤처파트너스', category: '신기술', formation: 1002, request: 600 },
      { operator: '현대기술투자', category: '신기술', formation: 1002, request: 600 },
    ]
  },

  // PJ0004: 모태펀드(교육) 2024년 2차 정시 (파일 4194) - Type B
  'PJ0004': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '한림대학교기술지주', category: '대학창업1', formation: 23.5, request: 15 },
      { operator: '로우파트너스', category: '대학창업1', formation: 23.5, request: 15 },
      { operator: '강원대학교기술지주회사', category: '대학창업2', formation: 109, request: 60 },
      { operator: '고려대학교기술지주', category: '대학창업2', formation: 109, request: 60 },
      { operator: '부산대학교기술지주', category: '대학창업2', formation: 109, request: 60 },
    ]
  },

  // PJ0005: 모태펀드(환경부) 2024년 3월 수시 (파일 4197) - Type B
  'PJ0005': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '소풍벤처스', category: '그린스타트업', formation: 93, request: 60 },
      { operator: '인포뱅크', category: '그린스타트업', formation: 93, request: 60 },
      { operator: '에이스톤벤처스', category: '사업화', formation: 400, request: 280 },
      { operator: '패스파인더에이치', category: '사업화', formation: 400, request: 280 },
    ]
  },

  // PJ0006: 모태펀드(문체부 등) 2024년 2차 정시 (파일 4193) - Type B
  'PJ0006': {
    type: 'B',
    currency: '억원',
    data: [
      // 스포츠
      { operator: '상상이비즈', category: '스포츠출발', formation: 100, request: 70 },
      { operator: '에이씨패스파인더', category: '스포츠출발', formation: 100, request: 70 },
      { operator: 'NBH캐피탈', category: '스포츠산업', formation: 315.5, request: 220.5 },
      { operator: '교보증권', category: '스포츠산업', formation: 315.5, request: 220.5 },
      { operator: '알펜루트자산운용', category: '스포츠산업', formation: 315.5, request: 220.5 },
      // 관광
      { operator: '가이아벤처파트너스', category: '관광기업육성', formation: 540, request: 350 },
      { operator: '키로스벤처투자', category: '관광기업육성', formation: 540, request: 350 },
      { operator: '케이비증권', category: '관광기업육성', formation: 540, request: 350 },
      // 국토교통
      { operator: '플랜에이치벤처스', category: '국토교통혁신', formation: 305, request: 150 },
      { operator: '엑스플로인베스트먼트', category: '국토교통혁신', formation: 305, request: 150 },
      // 과기정통
      { operator: '인탑스인베스트먼트', category: 'SaaS', formation: 375, request: 250 },
      { operator: '현대투자파트너스', category: 'SaaS', formation: 375, request: 250 },
      { operator: '린벤처스', category: '사이버보안', formation: 350, request: 175 },
      { operator: '엘에프인베스트먼트', category: '사이버보안', formation: 350, request: 175 },
      { operator: '액시스인베스트먼트', category: '사이버보안', formation: 350, request: 175 },
      { operator: '경기창조경제혁신센터', category: '공공기술사업화', formation: 50, request: 30 },
      { operator: '벤처스퀘어', category: '공공기술사업화', formation: 50, request: 30 },
      { operator: '포항공과대학교기술지주', category: '공공기술사업화', formation: 50, request: 30 },
    ]
  },

  // PJ0008: 2024년 해외VC 글로벌 펀드 (파일 4202) - USD
  'PJ0008': {
    type: 'B',
    currency: 'USD(M)',
    data: [
      // 미국
      { operator: 'ACVC Partners', category: '미국', formation: 21, request: 8 },
      { operator: 'IgniteXL', category: '미국', formation: 12.5, request: 2.5 },
      { operator: 'Nautilus Venture Partners', category: '미국', formation: 175, request: 15 },
      { operator: 'Patron', category: '미국', formation: 175, request: 15 },
      { operator: 'Third Prime', category: '미국', formation: 100, request: 10 },
      // 유럽/중동
      { operator: 'Amadeus Capital', category: '유럽', formation: 160, request: 25 },
      { operator: 'Mosaic Ventures', category: '유럽', formation: 350, request: 25 },
      // 아시아
      { operator: 'Access Ventures', category: '아시아', formation: 80, request: 8 },
      { operator: 'DG Daiwa Ventures', category: '아시아', formation: 80, request: 10 },
      { operator: 'K3 Ventures', category: '아시아', formation: 50, request: 10 },
      { operator: 'Lion X Ventures', category: '아시아', formation: 50, request: 5 },
      { operator: 'Qualgro Partners', category: '아시아', formation: 120, request: 15 },
      // Co-GP
      { operator: 'CICC Capital', category: 'Co-GP', formation: 100, request: 10 },
      { operator: 'Global Brain', category: 'Co-GP', formation: 100, request: 10 },
      { operator: 'VentureSouq', category: 'Co-GP', formation: 100, request: 10 },
      { operator: 'IMM Investment', category: 'Co-GP', formation: 100, request: 10 },
    ]
  },

  // PJ0009: 과기정통부 2024년 5월 수시 (파일 4219) - Type B
  'PJ0009': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '컴퍼니케이파트너스', category: '뉴스페이스', formation: 500, request: 300 },
    ]
  },

  // PJ0010: 문화계정 2024년 5월 수시 (파일 4242) - Type B
  'PJ0010': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '메이플투자파트너스', category: 'M&A', formation: 800, request: 200 },
      { operator: '메이슨캐피탈', category: 'M&A', formation: 800, request: 200 },
      { operator: '센트럴투자파트너스', category: 'M&A', formation: 800, request: 200 },
      { operator: '제이비인베스트먼트', category: '문화일반', formation: 400, request: 200 },
    ]
  },

  // PJ0011: 2024년 스타트업 코리아 (파일 4254) - Type A
  'PJ0011': {
    type: 'A',
    currency: '억원',
    data: [
      // 초격차
      { operator: '마그나인베스트먼트', category: '초격차', min: 1000, moTae: 300 },
      { operator: '삼천리인베스트먼트', category: '초격차', min: 500, moTae: 150 },
      { operator: '슈미트', category: '초격차', min: 835, moTae: 250 },
      { operator: '스틱벤처스', category: '초격차', min: 500, moTae: 150 },
      { operator: '신한벤처투자', category: '초격차', min: 1000, moTae: 300 },
      { operator: '씨케이디창업투자', category: '초격차', min: 667, moTae: 200 },
      { operator: '에스비아이인베스트먼트', category: '초격차', min: 1000, moTae: 300 },
      { operator: '삼성증권', category: '초격차', min: 1000, moTae: 300 },
      { operator: '엘앤에스벤처캐피탈', category: '초격차', min: 500, moTae: 150 },
      { operator: '인라이트벤처스', category: '초격차', min: 667, moTae: 200 },
      { operator: 'KDB인프라자산운용', category: '초격차', min: 1000, moTae: 300 },
      { operator: '인포뱅크', category: '초격차', min: 500, moTae: 150 },
      { operator: '카카오벤처스', category: '초격차', min: 1000, moTae: 300 },
      { operator: '케이씨투자파트너스', category: '초격차', min: 500, moTae: 150 },
      { operator: '코오롱인베스트먼트', category: '초격차', min: 667, moTae: 200 },
      { operator: '아이비케이벤처투자', category: '초격차', min: 835, moTae: 250 },
      { operator: '티케이지벤처스', category: '초격차', min: 500, moTae: 150 },
      { operator: '엔코어벤처스', category: '초격차', min: 667, moTae: 200 },
      { operator: '패스파인더에이치', category: '초격차', min: 667, moTae: 200 },
      { operator: '퓨처플레이', category: '초격차', min: 667, moTae: 200 },
      { operator: '효성벤처스', category: '초격차', min: 500, moTae: 150 },
      // 세컨더리
      { operator: '디티앤인베스트먼트', category: '세컨더리', min: 670, moTae: 200 },
      { operator: '뮤렉스파트너스', category: '세컨더리', min: 1000, moTae: 300 },
      { operator: '케이비인베스트먼트', category: '세컨더리', min: 1670, moTae: 500 },
    ]
  },

  // PJ0012: 대구·제주·광주 지역혁신 (파일 4237) - Type B
  'PJ0012': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '에스앤에스인베스트먼트', category: '지역혁신', formation: 591, request: 298 },
      { operator: '세아기술투자', category: '지역혁신', formation: 591, request: 298 },
      { operator: '이앤벤처파트너스', category: '지역혁신', formation: 591, request: 298 },
    ]
  },

  // PJ0013: 부산 미래성장 2024년 (파일 4272) - Type B
  'PJ0013': {
    type: 'B',
    currency: '억원',
    data: [
      // 지역리그(VC)
      { operator: '나우아이비캐피탈', category: '지역리그', formation: 561, request: 320 },
      { operator: 'BNK벤처투자', category: '지역리그', formation: 561, request: 320 },
      { operator: '에스벤처스', category: '지역리그', formation: 561, request: 320 },
      { operator: '부산대학교기술지주', category: '지역리그', formation: 561, request: 320 },
      { operator: '엔브이씨파트너스', category: '지역리그', formation: 561, request: 320 },
      { operator: '케이클라비스인베스트먼트', category: '지역리그', formation: 561, request: 320 },
      { operator: '쿨리지코너인베스트먼트', category: '지역리그', formation: 561, request: 320 },
      // 지역리그(AC)
      { operator: '부산지역대학연합기술지주', category: '지역리그', formation: 118, request: 80 },
      { operator: '부산창조경제혁신센터', category: '지역리그', formation: 118, request: 80 },
      { operator: '시리즈벤처스', category: '지역리그', formation: 118, request: 80 },
      { operator: '서울대학교기술지주', category: '지역리그', formation: 118, request: 80 },
      // 수도권리그
      { operator: '메이플투자파트너스', category: '수도권리그', formation: 1570, request: 400 },
      { operator: '아이비케이캐피탈', category: '수도권리그', formation: 1570, request: 400 },
      { operator: '유안타인베스트먼트', category: '수도권리그', formation: 1570, request: 400 },
      { operator: '이앤벤처파트너스', category: '수도권리그', formation: 1570, request: 400 },
      { operator: '코리아에셋투자증권', category: '수도권리그', formation: 1570, request: 400 },
      // 수도권리그(CVC)
      { operator: '오픈워터인베스트먼트', category: '수도권리그', formation: 1570, request: 400 },
      { operator: '세아기술투자', category: '수도권리그', formation: 1570, request: 400 },
    ]
  },

  // PJ0014: 보건계정 2024년 8월 수시 (파일 4278) - Type B
  'PJ0014': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '솔리더스인베스트먼트', category: '바이오헬스', formation: 500, request: 300 },
      { operator: '아이비케이캐피탈', category: '바이오헬스', formation: 500, request: 300 },
    ]
  },

  // PJ0015: 중기부 2024년 10월 수시 (파일 4305) - Type A
  'PJ0015': {
    type: 'A',
    currency: '억원',
    data: [
      { operator: '데브시스터즈벤처스', category: '청년창업', min: 300, moTae: 180 },
      { operator: '안다아시아벤처스', category: '스타트업코리아', min: 1000, moTae: 300 },
      { operator: '센틱스벤처스', category: '스타트업코리아', min: 500, moTae: 150 },
      { operator: '넥스트지인베스트먼트', category: '인구활력', min: 200, moTae: 100 },
      { operator: '에이치지이니셔티브', category: '인구활력', min: 200, moTae: 100 },
      { operator: '엠와이소셜컴퍼니', category: '인구활력', min: 200, moTae: 100 },
    ]
  },

  // PJ0016: 부산 글로벌리그 2024년 (파일 4316) - Type B
  'PJ0016': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '에스케이증권', category: '글로벌리그', formation: 550, request: 200 },
      { operator: 'IGIS Asia', category: '글로벌리그', formation: 550, request: 200 },
    ]
  },

  // PJ0017: 문화계정 2024년 12월 수시 (파일 4398) - Type B
  'PJ0017': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '나이스투자파트너스', category: '신기술', formation: 500, request: 300 },
      { operator: '트리거투자파트너스', category: '신기술', formation: 500, request: 300 },
    ]
  },

  // PJ0018: 보건계정 2024년 12월 수시 (파일 4388) - Type B
  'PJ0018': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '데일리파트너스', category: '바이오헬스', formation: 500, request: 300 },
      { operator: 'NH투자증권', category: '바이오헬스', formation: 500, request: 300 },
    ]
  },

  // PJ0019: 전북·강원 지역혁신 2024년 (파일 4397) - Type A
  'PJ0019': {
    type: 'A',
    currency: '억원',
    data: [
      { operator: '라이징에스벤처스', category: '지역혁신', min: 170, moTae: 102 },
      { operator: '코나인베스트먼트', category: '지역혁신', min: 170, moTae: 102 },
      { operator: '현대차증권', category: '지역혁신', min: 170, moTae: 102 },
    ]
  },

  // PJ0020: 중기부 2025년 1차 정시 (파일 4445) - Type A (이미 완료)
  'PJ0020': {
    type: 'A', // 최소결성규모, 모태출자액
    currency: '억원',
    data: [
      { operator: '다성벤처스', category: '루키리그', min: 200, moTae: 100 },
      { operator: '바인벤처스', category: '루키리그', min: 200, moTae: 120 },
      { operator: '세이지원파트너스', category: '루키리그', min: 200, moTae: 120 },
      { operator: '에이오에이캐피탈파트너스', category: '루키리그', min: 170, moTae: 100 },
      { operator: '에이온인베스트먼트', category: '루키리그', min: 200, moTae: 100 },
      { operator: '에이타스파트너스', category: '루키리그', min: 167, moTae: 100 },
      { operator: '오엔벤처투자', category: '루키리그', min: 117, moTae: 70 },
      { operator: '젠티움파트너스', category: '루키리그', min: 167, moTae: 100 },
      { operator: '지앤피인베스트먼트', category: '루키리그', min: 200, moTae: 100 },
      { operator: '코난인베스트먼트', category: '루키리그', min: 150, moTae: 90 },
      { operator: '비에스케이인베스트먼트', category: '청년창업', min: 300, moTae: 180 },
      { operator: '비에이파트너스', category: '청년창업', min: 225, moTae: 135 },
      { operator: '수인베스트먼트캐피탈', category: '청년창업', min: 143, moTae: 85 },
      { operator: '현대투자파트너스', category: '여성기업', min: 200, moTae: 100 },
      { operator: '동문파트너즈', category: '재도약', min: 169, moTae: 100 },
      { operator: '어니스트벤처스', category: '재도약', min: 200, moTae: 120 },
      { operator: '피앤피인베스트먼트', category: '재도약', min: 160, moTae: 80 },
      { operator: '파이오니어인베스트먼트', category: '재도약', min: 160, moTae: 80 },
      { operator: '컴퍼니케이파트너스', category: '스케일업·중견도약', min: 1000, moTae: 250 },
      { operator: '비엔에이치인베스트먼트', category: '바이오', min: 500, moTae: 300 },
      { operator: '대덕벤처파트너스', category: '창업초기-일반', min: 150, moTae: 90 },
      { operator: '메인스트리트벤처스', category: '창업초기-일반', min: 230, moTae: 138 },
      { operator: '스케일업파트너스', category: '창업초기-일반', min: 250, moTae: 150 },
      { operator: '에스제이투자파트너스', category: '창업초기-일반', min: 300, moTae: 180 },
      { operator: '위벤처스', category: '창업초기-일반', min: 154, moTae: 92 },
      { operator: '케이넷투자파트너스', category: '창업초기-일반', min: 335, moTae: 200 },
      { operator: '광주창조경제혁신센터', category: '창업초기-소형', min: 50, moTae: 30 },
      { operator: '지스트기술지주', category: '창업초기-소형', min: 50, moTae: 30 },
      { operator: '뉴패러다임인베스트먼트', category: '창업초기-소형', min: 60, moTae: 30 },
      { operator: '미리어드생명과학', category: '창업초기-소형', min: 60, moTae: 30 },
      { operator: '씨앤벤처파트너스', category: '창업초기-소형', min: 50, moTae: 25 },
      { operator: '탭엔젤파트너스', category: '창업초기-소형', min: 60, moTae: 30 },
      { operator: '엠와이소셜컴퍼니', category: '라이콘', min: 50, moTae: 30 },
      { operator: '전북창조경제혁신센터', category: '라이콘', min: 20, moTae: 12 },
      { operator: '크립톤', category: '라이콘', min: 101, moTae: 60 },
      { operator: '다올프라이빗에쿼티', category: '기업승계 M&A', min: 1000, moTae: 300 },
    ]
  },

  // PJ0021: 모태펀드(문화, 영화, 특허) 2025년 1차 정시 (파일 4444) - Type B
  'PJ0021': {
    type: 'B',
    currency: '억원',
    data: [
      // IP
      { operator: '스마트스터디벤처스', category: 'IP', formation: 1500, request: 900 },
      { operator: '에이비즈파트너스', category: 'IP', formation: 1500, request: 900 },
      { operator: '디에이밸류인베스트먼트', category: 'IP', formation: 1500, request: 900 },
      { operator: '유티씨인베스트먼트', category: 'IP', formation: 1500, request: 900 },
      { operator: '솔트룩스벤처스', category: 'IP', formation: 1500, request: 900 },
      // 문화일반
      { operator: '케이넷투자파트너스', category: '문화일반', formation: 1200, request: 600 },
      { operator: '펜처인베스트', category: '문화일반', formation: 1200, request: 600 },
      // 수출
      { operator: '가이아벤처파트너스', category: '수출', formation: 1575, request: 900 },
      { operator: '대교인베스트먼트', category: '수출', formation: 1575, request: 900 },
      { operator: '미시간벤처캐피탈', category: '수출', formation: 1575, request: 900 },
      { operator: '크릿벤처스', category: '수출', formation: 1575, request: 900 },
      // 신기술
      { operator: '라구나인베스트먼트', category: '신기술', formation: 750, request: 450 },
      { operator: '엔에이치투자증권', category: '신기술', formation: 750, request: 450 },
      // IP직접투자
      { operator: '카스피안캐피탈', category: 'IP직접투자', formation: 200, request: 100 },
    ]
  },

  // PJ0022: 특허계정 2024년 11월 수시 (파일 4429) - Type B
  'PJ0022': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '삼호그린인베스트먼트', category: '특허기술사업화', formation: 500, request: 300 },
      { operator: '아이비케이캐피탈', category: '특허기술사업화', formation: 500, request: 300 },
      { operator: '포스코기술투자', category: '특허기술사업화', formation: 500, request: 300 },
    ]
  },

  // PJ0023: 경남-KDB 지역혁신 (파일 4453, 4586) - Type B
  'PJ0023': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '한일브이씨', category: 'VC', formation: 300, request: 180 },
    ]
  },

  // PJ0024: 과기정통계정 2025년 2월 수시 (파일 4474) - Type B
  'PJ0024': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '트랜스링크인베스트먼트', category: 'SaaS', formation: 375, request: 250 },
      { operator: '알바트로스인베스트먼트', category: 'AI', formation: 500, request: 300 },
      { operator: '퀀텀벤처스코리아', category: 'AI', formation: 500, request: 300 },
    ]
  },

  // PJ0025: 문체부 등 2025년 2차 정시 (파일 4492) - Type B
  'PJ0025': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '케이런벤처스', category: '국토교통혁신', formation: 305, request: 150 },
      { operator: '인피니툼파트너스', category: '스포츠산업', formation: 315.5, request: 220.5 },
      { operator: '오픈워터인베스트먼트', category: '스포츠전략', formation: 500, request: 350 },
      { operator: '한양대학교기술지주회사', category: '스포츠출발', formation: 100, request: 70 },
      { operator: 'BNK벤처투자', category: '메타버스', formation: 410, request: 230 },
      { operator: '스페이스타임인베스트먼트', category: '메타버스', formation: 410, request: 230 },
      { operator: '에이온인베스트먼트', category: '사이버보안', formation: 350, request: 175 },
      { operator: '미래과학기술지주', category: '공공기술사업화', formation: 50, request: 30 },
      { operator: '한국과학기술지주', category: '공공기술사업화', formation: 50, request: 30 },
      { operator: '유니스트기술지주', category: '공공기술사업화', formation: 50, request: 30 },
      { operator: '하랑기술투자', category: '뉴스페이스', formation: 500, request: 300 },
      { operator: '케이에이치벤처파트너스', category: '그린스타트업', formation: 93, request: 60 },
      { operator: '인탑스인베스트먼트', category: '사업화', formation: 400, request: 280 },
      { operator: '한화투자증권', category: '스케일업', formation: 420, request: 292.5 },
    ]
  },

  // PJ0026: 교육 2025년 2차 정시 (파일 4495) - Type B
  'PJ0026': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '지스트기술지주', category: '대학창업1', formation: 23.5, request: 15 },
      { operator: '광주지역대학연합기술지주', category: '대학창업1', formation: 23.5, request: 15 },
      { operator: '경북대학교기술지주', category: '대학창업2', formation: 109, request: 60 },
      { operator: '로우파트너스', category: '대학창업2', formation: 109, request: 60 },
      { operator: '부산지역대학연합기술지주', category: '대학창업2', formation: 109, request: 60 },
      { operator: '빅뱅벤처스', category: '대학창업2', formation: 109, request: 60 },
      { operator: '국민대학교기술지주', category: '대학창업2', formation: 109, request: 60 },
    ]
  },

  // PJ0027: 2025년 해외VC 일반분야 (파일 4524) - USD
  'PJ0027': {
    type: 'B',
    currency: 'USD(M)',
    data: [
      { operator: 'Hustle Fund', category: '미국', formation: 25, request: 5 },
      { operator: 'Nyca Partners', category: '미국', formation: 40, request: 10 },
      { operator: 'Strong Ventures', category: '미국', formation: 40, request: 10 },
      { operator: 'Sazze Partners', category: '미국', formation: 24, request: 5 },
      { operator: 'Crane Venture Partners', category: '유럽', formation: 300, request: 15 },
      { operator: 'Korelya Capital', category: '유럽', formation: 300, request: 20 },
      { operator: 'TNB Aura', category: '아시아', formation: 60, request: 10 },
      { operator: 'DCI Partners', category: '아시아', formation: 50, request: 10 },
      { operator: 'Alpha JWC Ventures', category: '아시아', formation: 300, request: 15 },
      { operator: 'AppWorks Ventures', category: '아시아', formation: 100, request: 10 },
    ]
  },

  // PJ0028: 2025년 해외VC AI·Secondary·Climate Tech (파일 4524) - USD
  'PJ0028': {
    type: 'B',
    currency: 'USD(M)',
    data: [
      { operator: 'Jolt Capital', category: 'AI·Secondary·Climate Tech', formation: 180, request: 20 },
      { operator: 'AP Ventures', category: 'AI·Secondary·Climate Tech', formation: 250, request: 25 },
      { operator: 'Top Tier Capital Partners', category: 'AI·Secondary·Climate Tech', formation: 750, request: 15 },
    ]
  },

  // PJ0029: 2025년 스타트업 코리아 (파일 4551) - Type A
  'PJ0029': {
    type: 'A',
    currency: '억원',
    data: [
      // 초격차·글로벌
      { operator: '에스비아이인베스트먼트', category: '초격차', min: 1000, moTae: 300 },
      { operator: '아이비케이벤처투자', category: '초격차', min: 835, moTae: 250 },
      { operator: '인사이트에퀴티파트너스', category: '초격차', min: 1000, moTae: 300 },
      { operator: '제주창조경제혁신센터', category: '초격차', min: 200, moTae: 60 },
      { operator: 'SEVEN STAR PARTNERS', category: '초격차', min: 500, moTae: 150 },
      { operator: '지앤텍벤처투자', category: '초격차', min: 667, moTae: 200 },
      { operator: '교보증권', category: '초격차', min: 670, moTae: 200 },
      { operator: '케이앤투자파트너스', category: '초격차', min: 500, moTae: 150 },
      { operator: '킹고투자파트너스', category: '초격차', min: 670, moTae: 200 },
      { operator: '플럭스벤처스', category: '초격차', min: 500, moTae: 150 },
      { operator: '500글로벌매니지먼트코리아', category: '초격차', min: 670, moTae: 200 },
      { operator: '블루코너캐피탈', category: '초격차', min: 500, moTae: 150 },
      { operator: '한일브이씨', category: '초격차', min: 500, moTae: 150 },
      // 오픈이노베이션
      { operator: '디티앤인베스트먼트', category: '오픈이노베이션', min: 667, moTae: 200 },
      { operator: '비에스케이인베스트먼트', category: '오픈이노베이션', min: 667, moTae: 200 },
      { operator: '엘엑스벤처스', category: '오픈이노베이션', min: 500, moTae: 150 },
      { operator: '에이치지이니셔티브', category: '오픈이노베이션', min: 335, moTae: 100 },
      { operator: '엑스플로인베스트먼트', category: '오픈이노베이션', min: 500, moTae: 150 },
      { operator: '엔에이치벤처투자', category: '오픈이노베이션', min: 835, moTae: 250 },
      { operator: '유안타인베스트먼트', category: '오픈이노베이션', min: 1000, moTae: 300 },
      { operator: '한국혁신의약품컨소시엄', category: '오픈이노베이션', min: 500, moTae: 150 },
      { operator: '유티씨인베스트먼트', category: '오픈이노베이션', min: 667, moTae: 200 },
      { operator: '포스코기술투자', category: '오픈이노베이션', min: 1000, moTae: 300 },
      { operator: '하나증권', category: '오픈이노베이션', min: 1000, moTae: 300 },
      // 세컨더리
      { operator: '제피러스랩', category: '세컨더리', min: 250, moTae: 100 },
      { operator: '퀀텀벤처스코리아', category: '세컨더리', min: 500, moTae: 200 },
      { operator: '키움인베스트먼트', category: '세컨더리', min: 835, moTae: 250 },
    ]
  },

  // PJ0030: 경북·전남 지역혁신 2025년 (파일 4522) - Type A
  'PJ0030': {
    type: 'A',
    currency: '억원',
    data: [
      { operator: '어니스트벤처스', category: '경북', min: 150, moTae: 102 },
      { operator: '오라클벤처투자', category: '전남', min: 170, moTae: 102 },
      { operator: '벡터기술투자', category: '전남', min: 170, moTae: 102 },
    ]
  },

  // PJ0031: 문체부 등 2025년 5월 수시 (파일 4546) - Type B
  'PJ0031': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '케이씨벤처스', category: '콘텐츠', formation: 250, request: 150 },
      { operator: '이크럭스벤처파트너스', category: '애니메이션', formation: 200, request: 100 },
      { operator: '넥스트지인베스트먼트', category: '중저예산한국영화', formation: 150, request: 100 },
      { operator: '오거스트벤처파트너스', category: '한국영화 메인투자', formation: 400, request: 240 },
      { operator: '타임웍스인베스트먼트', category: 'AI 중형', formation: 300, request: 150 },
      { operator: '신한벤처투자', category: 'AI 대형', formation: 845, request: 400 },
      { operator: '에버그린투자파트너스', category: 'AI 대형', formation: 845, request: 400 },
    ]
  },

  // PJ0032: 중기부 2025년 2차 정시 (파일 4564) - Type A
  'PJ0032': {
    type: 'A',
    currency: '억원',
    data: [
      // NEXT UNICORN PROJECT 스타트업(AI융합)
      { operator: '에이스톤벤처스', category: 'AI융합', min: 500, moTae: 200 },
      { operator: '케이넷투자파트너스', category: 'AI융합', min: 750, moTae: 300 },
      { operator: '토니인베스트먼트', category: 'AI융합', min: 500, moTae: 200 },
      { operator: '현대기술투자', category: 'AI융합', min: 750, moTae: 300 },
      // NEXT UNICORN PROJECT 스타트업(딥테크)
      { operator: '아이디벤처스', category: '딥테크', min: 500, moTae: 200 },
      { operator: '이에스인베스터', category: '딥테크', min: 500, moTae: 200 },
      { operator: '제이엑스파트너스', category: '딥테크', min: 500, moTae: 200 },
      { operator: '한국자산캐피탈', category: '딥테크', min: 500, moTae: 200 },
      { operator: '이노폴리스파트너스', category: '딥테크', min: 500, moTae: 200 },
      // NEXT UNICORN PROJECT 스케일업(AI융합)
      { operator: '에스비브이에이', category: '스케일업', min: 2000, moTae: 500 },
      // NEXT UNICORN PROJECT 스케일업(딥테크)
      { operator: '케이비인베스트먼트', category: '스케일업', min: 2000, moTae: 500 },
      // 창업초기 소형
      { operator: '경기창조경제혁신센터', category: '창업초기', min: 50, moTae: 30 },
      { operator: '벤처스퀘어', category: '창업초기', min: 50, moTae: 30 },
      { operator: '마크앤컴퍼니', category: '창업초기', min: 50, moTae: 30 },
      { operator: '씨엔티테크', category: '창업초기', min: 50, moTae: 30 },
      { operator: '최성호', category: '창업초기', min: 50, moTae: 30 },
      { operator: '카이스트청년창업투자지주', category: '창업초기', min: 50, moTae: 30 },
    ]
  },

  // PJ0033: 문체부 등 2025년 7월 수시 (파일 4583) - Type B
  'PJ0033': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '메인스트리트벤처스', category: '문화일반', formation: 250, request: 150 },
      { operator: '제이비인베스트먼트', category: '신기술', formation: 340, request: 200 },
      { operator: '에이씨패스파인더', category: '스포츠산업', formation: 315.5, request: 220.5 },
      { operator: '트리거투자파트너스', category: '중저예산한국영화', formation: 150, request: 100 },
      { operator: '나이스투자파트너스', category: '중저예산한국영화', formation: 150, request: 100 },
      { operator: '케이씨벤처스', category: '한국영화 메인투자', formation: 400, request: 240 },
      { operator: '스틱벤처스', category: 'AI', formation: 1060, request: 500 },
      { operator: '에이벤처스', category: 'AI', formation: 1060, request: 500 },
    ]
  },

  // PJ0034: 보건계정 2025년 7월 수시 (파일 4587) - Type B
  'PJ0034': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '씨케이디창업투자', category: '바이오헬스', formation: 500, request: 200 },
      { operator: '메디톡스벤처투자', category: '바이오헬스', formation: 500, request: 200 },
      { operator: '키움인베스트먼트', category: '바이오헬스', formation: 600, request: 200 },
      { operator: '디에스투자파트너스', category: '바이오헬스', formation: 600, request: 200 },
    ]
  },

  // PJ0037: LP 첫걸음펀드 2025년 (파일 4597) - Type A
  'PJ0037': {
    type: 'A',
    currency: '억원',
    data: [
      { operator: '대성창업투자', category: '세컨더리', min: 290, moTae: 200 },
      { operator: '우리벤처파트너스', category: '세컨더리', min: 1000, moTae: 200 },
    ]
  },

  // PJ0038: 문화, 관광 2025년 8월 수시 (파일 4638) - Type B
  'PJ0038': {
    type: 'B',
    currency: '억원',
    data: [
      { operator: '넥스트지인베스트먼트', category: '관광기업육성', formation: 697, request: 450 },
      { operator: '로간벤처스', category: '관광기업육성', formation: 697, request: 450 },
      { operator: '에스투엘파트너스', category: 'IP', formation: 500, request: 300 },
      { operator: '에이티넘벤처스', category: 'IP', formation: 500, request: 300 },
    ]
  },

  // PJ0039: 해외VC 글로벌 펀드 2025년 하반기 (파일 4647) - USD
  'PJ0039': {
    type: 'B',
    currency: 'USD(M)',
    data: [
      { operator: 'One Way Ventures', category: '일반분야', formation: 26, request: 6 },
      { operator: 'Playground Global', category: '일반분야', formation: 200, request: 10 },
      { operator: 'Atlantic Vantage Point Capital', category: '일반분야', formation: 200, request: 10 },
      { operator: 'CMB International Asset Management', category: '일반분야', formation: 150, request: 10 },
      { operator: 'DV Partners', category: '일반분야', formation: 50, request: 10 },
      { operator: 'TEDCO', category: '일반분야', formation: 15.5, request: 6.2 },
    ]
  },
};

// 운용사명 정규화 함수
function normalizeOperatorName(name) {
  if (!name) return '';
  return name
    .replace(/\s+/g, '')
    .replace(/주식회사|㈜|\(주\)/g, '')
    .toLowerCase();
}

// 출자분야 매칭 (PDF 분야명이 시트 출자분야에 포함되는지)
function categoryMatches(pdfCategory, sheetCategory) {
  if (!pdfCategory || !sheetCategory) return false;

  // 정확히 일치
  if (sheetCategory.includes(pdfCategory)) return true;

  // 분야명 정규화
  const normalizedPdf = pdfCategory.replace(/\s+/g, '').replace(/-/g, '');
  const normalizedSheet = sheetCategory.replace(/\s+/g, '').replace(/-/g, '');

  if (normalizedSheet.includes(normalizedPdf)) return true;

  return false;
}

async function batchAmountUpdate() {
  const sheets = new GoogleSheetsClient();
  await sheets.init();

  console.log('=== 금액 배치 업데이트 시작 ===\n');

  // 1. 데이터 조회
  const [apps, operators] = await Promise.all([
    sheets.getAllRows('신청현황'),
    sheets.getAllRows('운용사'),
  ]);

  // 운용사 매핑 (ID → 이름)
  const opIdToName = {};
  for (const op of operators) {
    opIdToName[op['ID']] = op['운용사명'];
  }

  // 2. 선정 상태 + 금액 미입력 신청현황 필터링
  const targetApps = apps.filter(a => {
    if (a['상태'] !== '선정') return false;
    const noAmount = (!a['최소결성규모'] && !a['모태출자액'] && !a['결성예정액'] && !a['출자요청액']);
    return noAmount;
  });

  console.log(`선정 상태 금액 미입력: ${targetApps.length}건\n`);

  // 3. 매칭 및 업데이트 데이터 생성
  const updates = [];
  const matchedAppIds = new Set();
  const unmatchedPdf = [];

  for (const [projectId, projectData] of Object.entries(amountData)) {
    const projectApps = targetApps.filter(a => a['출자사업ID'] === projectId);

    if (projectApps.length === 0) {
      console.log(`[${projectId}] 해당 프로젝트에 금액 미입력 신청현황 없음`);
      continue;
    }

    console.log(`[${projectId}] PDF 데이터 ${projectData.data.length}건, 신청현황 ${projectApps.length}건`);

    for (const pdfEntry of projectData.data) {
      const normalizedPdfName = normalizeOperatorName(pdfEntry.operator);

      // 매칭되는 신청현황 찾기
      let matched = null;
      for (const app of projectApps) {
        if (matchedAppIds.has(app['ID'])) continue;

        const opName = opIdToName[app['운용사ID']] || '';
        const normalizedOpName = normalizeOperatorName(opName);

        // 운용사명 매칭
        const nameMatch = normalizedPdfName === normalizedOpName ||
          normalizedOpName.includes(normalizedPdfName) ||
          normalizedPdfName.includes(normalizedOpName);

        if (!nameMatch) continue;

        // 출자분야 매칭
        if (categoryMatches(pdfEntry.category, app['출자분야'])) {
          matched = app;
          break;
        }
      }

      if (matched) {
        matchedAppIds.add(matched['ID']);

        // 업데이트 데이터 생성
        const updateData = {
          rowIndex: matched._rowIndex,
          appId: matched['ID'],
          operatorName: opIdToName[matched['운용사ID']],
          category: matched['출자분야'],
          currency: projectData.currency,
        };

        if (projectData.type === 'A') {
          updateData.minFormation = pdfEntry.min;
          updateData.moTae = pdfEntry.moTae;
        } else {
          updateData.formation = pdfEntry.formation;
          updateData.request = pdfEntry.request;
        }

        updates.push(updateData);
        console.log(`  ✓ ${pdfEntry.operator} → row ${matched._rowIndex}`);
      } else {
        unmatchedPdf.push({
          projectId,
          operator: pdfEntry.operator,
          category: pdfEntry.category,
        });
        console.log(`  ✗ ${pdfEntry.operator} (${pdfEntry.category}) - 매칭 실패`);
      }
    }
  }

  console.log(`\n=== 매칭 결과 ===`);
  console.log(`매칭 성공: ${updates.length}건`);
  console.log(`매칭 실패 (PDF): ${unmatchedPdf.length}건`);

  // 4. 배치 업데이트 실행
  if (updates.length === 0) {
    console.log('\n업데이트할 항목이 없습니다.');
    return;
  }

  console.log(`\n=== 배치 업데이트 실행 (${updates.length}건) ===`);

  // Google Sheets 배치 업데이트 데이터 생성
  // 컬럼: E=최소결성규모, F=모태출자액, G=결성예정액, H=출자요청액, I=통화단위
  const batchData = updates.map(u => ({
    range: `신청현황!E${u.rowIndex}:I${u.rowIndex}`,
    values: [[
      u.minFormation || '',
      u.moTae || '',
      u.formation || '',
      u.request || '',
      u.currency,
    ]],
  }));

  // 배치 처리
  try {
    await sheets.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheets.spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      },
    });

    console.log(`✓ ${updates.length}건 업데이트 완료`);
  } catch (error) {
    console.error('배치 업데이트 실패:', error.message);
  }

  console.log(`\n=== 완료 ===`);

  return { success: updates.length, failed: unmatchedPdf.length };
}

batchAmountUpdate().catch(console.error);
