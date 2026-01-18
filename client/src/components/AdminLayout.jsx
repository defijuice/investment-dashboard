import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, Settings, LogOut, Users, FolderOpen } from 'lucide-react';
import { clearApiKey } from '../api/client';

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearApiKey();
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: '대시보드', end: true },
    { to: '/admin/operators', icon: Users, label: '운용사' },
    { to: '/admin/projects', icon: FolderOpen, label: '출자사업' },
    { to: '/admin/search', icon: Search, label: '검색/필터' },
    { to: '/admin/manage', icon: Settings, label: '관리자' }
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
          width: '100%',
          position: 'relative'
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
          <span style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'linear-gradient(135deg, #c9a227 0%, #f4d03f 50%, #c9a227 100%)',
            color: '#1a1a2e',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em'
          }}>ADMIN</span>
        </div>

        <ul className="nav-list">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
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
