import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('adminToken', data.token);
        navigate('/admin');
      } else {
        setError(data.error || '비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      padding: 20
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: 32
        }}>
          <img
            src="/logo.png"
            alt="VC RANK"
            style={{ width: 100, height: 100, marginBottom: 16 }}
          />
          <h1 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1a1a2e'
          }}>
            VC RANK Admin
          </h1>
          <p style={{
            margin: '8px 0 0',
            color: '#666',
            fontSize: '0.9rem'
          }}>
            관리자 비밀번호를 입력하세요
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: '#fff5f5',
            border: '1px solid #fed7d7',
            borderRadius: 8,
            marginBottom: 24,
            color: '#c53030'
          }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.9rem' }}>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{
            position: 'relative',
            marginBottom: 24
          }}>
            <div style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#999'
            }}>
              <Lock size={18} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '14px 48px 14px 44px',
                border: '2px solid #e5e5e5',
                borderRadius: 10,
                fontSize: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#c9a227';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e5e5';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#999',
                padding: 0,
                display: 'flex'
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px',
              background: isLoading
                ? '#ccc'
                : 'linear-gradient(135deg, #c9a227 0%, #f4d03f 50%, #c9a227 100%)',
              border: 'none',
              borderRadius: 10,
              color: '#1a1a2e',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(201, 162, 39, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {isLoading ? '확인 중...' : '로그인'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 32,
          textAlign: 'center',
          color: '#999',
          fontSize: '0.8rem'
        }}>
          일반 사용자는 <a
            href="/dashboard"
            style={{
              color: '#c9a227',
              textDecoration: 'none'
            }}
          >
            대시보드
          </a>를 이용해주세요.
        </div>
      </div>
    </div>
  );
}
