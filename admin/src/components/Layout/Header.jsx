import { useAuth } from '../../hooks/useAuth';

export default function Header() {
  const { logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">
          KVIC 출자사업 관리
        </h1>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
