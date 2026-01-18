import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * 상세 정보를 표시하는 슬라이드 Drawer 컴포넌트
 * URL을 변경하지 않고 State로 열고 닫음
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Drawer 열림 상태
 * @param {Function} props.onClose - 닫기 콜백
 * @param {string} [props.title] - Drawer 헤더 제목
 * @param {string} [props.width='600px'] - Drawer 너비
 * @param {React.ReactNode} props.children - Drawer 내용
 */
export default function DetailDrawer({
  isOpen,
  onClose,
  title,
  width = '600px',
  children
}) {
  // ESC 키로 닫기
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 열릴 때 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="drawer-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      />

      {/* Drawer */}
      <div
        className="drawer-content"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: width,
          maxWidth: '100vw',
          background: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e5e5',
          background: '#fafafa'
        }}>
          {title && (
            <h2 style={{
              margin: 0,
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#1a1a2e'
            }}>
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 6,
              color: '#666',
              marginLeft: 'auto'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px'
        }}>
          {children}
        </div>
      </div>
    </>
  );
}
