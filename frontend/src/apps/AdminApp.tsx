import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import AdminChatLogPage from '../pages/admin/AdminChatLogPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminKnowledgePage from '../pages/admin/AdminKnowledgePage';
import AdminLoginPage from '../pages/admin/AdminLoginPage';
import AdminRoutePage from '../pages/admin/AdminRoutePage';
import AdminSpotPage from '../pages/admin/AdminSpotPage';

export default function AdminApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboardPage />} />
          <Route path="/spots" element={<AdminSpotPage />} />
          <Route path="/routes" element={<AdminRoutePage />} />
          <Route path="/knowledge" element={<AdminKnowledgePage />} />
          <Route path="/logs" element={<AdminChatLogPage />} />
        </Route>
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
