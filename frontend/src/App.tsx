import { ConfigProvider } from 'antd';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import VisitorLayout from './layouts/VisitorLayout';
import AdminChatLogPage from './pages/admin/AdminChatLogPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminKnowledgePage from './pages/admin/AdminKnowledgePage';
import AdminRoutePage from './pages/admin/AdminRoutePage';
import AdminSpotPage from './pages/admin/AdminSpotPage';
import AiGuidePage from './pages/visitor/AiGuidePage';
import HomePage from './pages/visitor/HomePage';
import RouteRecommendPage from './pages/visitor/RouteRecommendPage';
import SpotDetailPage from './pages/visitor/SpotDetailPage';
import SpotListPage from './pages/visitor/SpotListPage';
import { appTheme } from './styles/theme';

export default function App() {
  return (
    <ConfigProvider theme={appTheme}>
      <BrowserRouter>
        <Routes>
          <Route element={<VisitorLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/spots" element={<SpotListPage />} />
            <Route path="/spots/:spotId" element={<SpotDetailPage />} />
            <Route path="/routes" element={<RouteRecommendPage />} />
            <Route path="/guide" element={<AiGuidePage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="spots" element={<AdminSpotPage />} />
            <Route path="routes" element={<AdminRoutePage />} />
            <Route path="knowledge" element={<AdminKnowledgePage />} />
            <Route path="logs" element={<AdminChatLogPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
