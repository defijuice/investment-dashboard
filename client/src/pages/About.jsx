export default function About() {
  return (
    <div className="about-page">
      <div className="about-header">
        <h1>About Us</h1>
      </div>

      {/* Main Slogan */}
      <div className="about-section slogan-section">
        <h2 className="slogan-main">Focus on the Decision, We Handle the Data</h2>
        <p className="slogan-sub">의사결정에만 집중하세요. 데이터는 저희가 처리합니다.</p>
      </div>

      {/* Brand Story */}
      <div className="about-section">
        <h3>Brand Story</h3>
        <p>
          투자를 돕는 툴은 많지만, 정작 VC 생태계의 근간인 '펀드 결성'을 지원하는 인프라는 드뭅니다.
          흩어진 공고를 리서치하고 정리하는 소모적인 실무를 해결하고자 이 서비스를 시작했습니다.
          현재 최근 5개년 모태펀드(KVIC) 출자 데이터를 표준화하여 하나의 대시보드에 담았습니다.
          이제 반복되는 데이터 수집은 시스템에 맡기고, 심사역은 투자 결정이라는 본질에만 집중할 수 있습니다.
        </p>
      </div>

      {/* Product History */}
      <div className="about-section">
        <h3>Product History</h3>
        <div className="history-timeline">
          <div className="history-item">
            <div className="history-badge">Season 1</div>
            <div className="history-content">
              <h4>Foundation</h4>
              <p>모태펀드(KVIC) 최근 5개년 출자 데이터 전수 조사 및 실시간 대시보드 구축 완료함.</p>
            </div>
          </div>
          <div className="history-item">
            <div className="history-badge upcoming">Season 2</div>
            <div className="history-content">
              <h4>Expansion</h4>
              <p>2026년 1분기 내 농식품모태펀드(농모태) 데이터 반영 및 매칭 엔진 고도화 예정임.</p>
            </div>
          </div>
          <div className="history-item coming-soon-item">
            <div className="history-badge coming-soon-badge">Season 3</div>
            <div className="history-content">
              <h4>Coming Soon</h4>
              <p>더 많은 기능이 준비 중입니다.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Section */}
      <div className="about-section team-section">
        <h3>Team</h3>
        <div className="team-grid">
          <div className="team-card">
            <div className="team-role">Project Manager</div>
            <div className="team-title">VC 투자심사역</div>
            <div className="team-bio">
              <p>창업과 프로덕트 매니지먼트를 직접 경험한 투자심사역으로서, 초기 스타트업의 성장 잠재력을 발굴합니다.</p>
              <p>타겟 시장 30% 점유율 달성과 데이터 기반 성장 전략 수립 경험을 바탕으로, PMF와 성장 지표를 검증합니다.</p>
              <p>다양한 이해관계자와의 전략적 파트너십 구축 역량으로 포트폴리오 기업의 가치 창출에 기여합니다.</p>
            </div>
            <a
              href="https://www.linkedin.com/in/jasonheo7/"
              target="_blank"
              rel="noopener noreferrer"
              className="team-linkedin"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn Profile
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
