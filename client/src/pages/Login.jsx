import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setApiKey } from '../api/client';
import { Building2 } from 'lucide-react';

export default function Login() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('API Key를 입력해주세요.');
      return;
    }
    setApiKey(key.trim());
    navigate('/');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <Building2 size={48} />
          <h1>KVIC Dashboard</h1>
          <p>출자사업 분석 대시보드</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="apiKey">API Key</label>
            <input
              type="password"
              id="apiKey"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="API Key 입력"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-primary">
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
