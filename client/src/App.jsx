import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Operators from './pages/Operators';
import OperatorDetail from './pages/OperatorDetail';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Search from './pages/Search';
import Admin from './pages/Admin';
import About from './pages/About';
import Login from './pages/Login';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1
    }
  }
});

function ProtectedRoute({ children }) {
  // 인증 체크 비활성화 - 바로 접근 허용
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="operators" element={<Operators />} />
            <Route path="operators/:id" element={<OperatorDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="search" element={<Search />} />
            <Route path="about" element={<About />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
