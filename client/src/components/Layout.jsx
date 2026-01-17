import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, Settings, LogOut, Users, FolderOpen, Info } from 'lucide-react';
import { clearApiKey } from '../api/client';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearApiKey();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: '대시보드' },
    { to: '/operators', icon: Users, label: '운용사' },
    { to: '/projects', icon: FolderOpen, label: '출자사업' },
    { to: '/search', icon: Search, label: '검색/필터' },
    { to: '/about', icon: Info, label: 'About Us' },
    { to: '/admin', icon: Settings, label: '관리자' }
  ];

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header" style={{
          background: '#ffffff',
          borderRadius: 8,
          padding: '16px',
          margin: '0 0 16px 0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          width: '100%'
        }}>
          <img src="/logo.png" alt="VC RANK" style={{ width: 180, height: 180 }} />
          <span
            className="shimmer-text"
            style={{
              fontSize: '2.1rem',
              fontWeight: 900,
              fontFamily: "'Roboto', sans-serif",
              letterSpacing: '0.1em'
            }}
          >VC RANK</span>
        </div>

        <ul className="nav-list">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          <span>로그아웃</span>
        </button>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
