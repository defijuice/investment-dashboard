import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Search, Settings, LogOut, Users, FolderOpen } from 'lucide-react';
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
    { to: '/admin', icon: Settings, label: '관리자' }
  ];

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="VC RANK" style={{ width: 24, height: 24 }} />
          <span>VC RANK</span>
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
