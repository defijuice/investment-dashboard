import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Search, Users, FolderOpen, Info } from 'lucide-react';
import { useAnalytics, initializeAnalytics } from '../hooks/useAnalytics';

export default function PublicLayout() {
  // Google Analytics 초기화 (일반 유저 사이트에만)
  useEffect(() => {
    initializeAnalytics();
  }, []);

  // 페이지 전환 추적
  useAnalytics();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: '대시보드', end: true },
    { to: '/dashboard/operators', icon: Users, label: '운용사' },
    { to: '/dashboard/projects', icon: FolderOpen, label: '출자사업' },
    { to: '/dashboard/search', icon: Search, label: '검색/필터' },
    { to: '/dashboard/about', icon: Info, label: 'About Us' }
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
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
