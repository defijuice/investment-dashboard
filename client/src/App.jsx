import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Layouts
import PublicLayout from './components/PublicLayout';
import AdminLayout from './components/AdminLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Operators from './pages/Operators';
import OperatorDetail from './pages/OperatorDetail';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Search from './pages/Search';
import About from './pages/About';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';

import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1
    }
  }
});

/**
 * Admin 라우트 보호 - localStorage의 adminToken 확인
 */
function ProtectedAdminRoute({ children }) {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* 루트 → /dashboard 리다이렉트 */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 일반 유저 라우트 (/dashboard/*) */}
          <Route path="/dashboard" element={<PublicLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="operators" element={<Operators />} />
            <Route path="operators/:id" element={<OperatorDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="search" element={<Search />} />
            <Route path="about" element={<About />} />
          </Route>

          {/* 어드민 로그인 (보호되지 않음) */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* 어드민 라우트 (/admin/*) - 인증 필요 */}
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminLayout />
              </ProtectedAdminRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="operators" element={<Operators />} />
            <Route path="operators/:id" element={<OperatorDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="search" element={<Search />} />
            <Route path="manage" element={<Admin />} />
          </Route>

          {/* 구버전 URL 호환 리다이렉트 */}
          <Route path="/operators" element={<Navigate to="/dashboard/operators" replace />} />
          <Route path="/operators/:id" element={<Navigate to="/dashboard/operators" replace />} />
          <Route path="/projects" element={<Navigate to="/dashboard/projects" replace />} />
          <Route path="/projects/:id" element={<Navigate to="/dashboard/projects" replace />} />
          <Route path="/search" element={<Navigate to="/dashboard/search" replace />} />
          <Route path="/about" element={<Navigate to="/dashboard/about" replace />} />
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
