import { useState, useRef, useEffect } from 'react';
import { Share2, Linkedin, Link2, Check, X } from 'lucide-react';

const SHARE_URL = window.location.origin;

export default function ShareButton({ stats }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 공유 텍스트 생성
  const getShareText = () => {
    const hero = stats?.hero || {};
    const amount = hero.currentYearAmount >= 10000
      ? `${(hero.currentYearAmount / 10000).toFixed(1)}조원`
      : `${(hero.currentYearAmount || 0).toLocaleString()}억원`;

    const yoy = hero.yoyPercent !== null
      ? `${hero.yoyPercent >= 0 ? '+' : ''}${hero.yoyPercent}%`
      : '';

    return `KVIC 모태펀드 출자 대시보드

📊 '${String(hero.currentYear || new Date().getFullYear()).slice(2)}년 선정 펀드: ${amount}
${yoy ? `📈 전년 대비: ${yoy}` : ''}
🏆 활성 GP: ${(hero.activeGPCount || 0).toLocaleString()}개

실시간 출자 데이터를 확인하세요 👉`;
  };

  const getShareUrl = (platform) => {
    return `${SHARE_URL}?utm_source=share&utm_medium=${platform}`;
  };

  // 모바일 Web Share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'KVIC 모태펀드 출자 대시보드',
          text: getShareText(),
          url: getShareUrl('native')
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }
  };

  // 링크드인 공유
  const handleLinkedInShare = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl('linkedin'))}`;
    window.open(url, '_blank', 'width=600,height=600');
    setIsOpen(false);
  };

  // X(트위터) 공유
  const handleXShare = () => {
    const text = getShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(getShareUrl('twitter'))}`;
    window.open(url, '_blank', 'width=600,height=400');
    setIsOpen(false);
  };

  // 링크 복사
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl('copy'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // 모바일 감지
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // 모바일에서는 네이티브 공유 사용
  if (isMobile && navigator.share) {
    return (
      <button
        className="btn-icon share-trigger"
        onClick={handleNativeShare}
        title="공유하기"
      >
        <Share2 size={18} />
      </button>
    );
  }

  return (
    <div className="share-button" ref={menuRef}>
      <button
        className={`btn-icon share-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="공유하기"
      >
        <Share2 size={18} />
      </button>

      {isOpen && (
        <div className="share-menu">
          <div className="share-menu-header">
            <span>공유하기</span>
            <button className="share-close" onClick={() => setIsOpen(false)}>
              <X size={14} />
            </button>
          </div>

          <div className="share-items">
            <button className="share-item linkedin" onClick={handleLinkedInShare}>
              <Linkedin size={20} />
              <span>링크드인</span>
            </button>

            <button className="share-item twitter" onClick={handleXShare}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>X (트위터)</span>
            </button>

            <button className="share-item copy" onClick={handleCopyLink}>
              {copied ? <Check size={20} /> : <Link2 size={20} />}
              <span>{copied ? '복사 완료!' : '링크 복사'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
