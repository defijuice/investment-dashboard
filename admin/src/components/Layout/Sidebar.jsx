import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: '대시보드', icon: '📊' },
  { to: '/applications', label: '신청현황', icon: '📋' },
  { to: '/operators', label: '운용사', icon: '🏢' },
  { to: '/projects', label: '출자사업', icon: '📁' },
  { to: '/files', label: '파일', icon: '📄' }
];

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-800 min-h-screen">
      <div className="p-4">
        <div className="text-white font-bold text-lg mb-8">Admin</div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
