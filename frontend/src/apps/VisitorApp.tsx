import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import VisitorLayout from '../layouts/VisitorLayout';
import AiGuidePage from '../pages/visitor/AiGuidePage';
import HomePage from '../pages/visitor/HomePage';
import RouteRecommendPage from '../pages/visitor/RouteRecommendPage';
import SpotDetailPage from '../pages/visitor/SpotDetailPage';
import SpotListPage from '../pages/visitor/SpotListPage';
import VisitorLoginPage from '../pages/visitor/VisitorLoginPage';
import VisitorRegisterPage from '../pages/visitor/VisitorRegisterPage';

export default function VisitorApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<VisitorLoginPage />} />
        <Route path="/register" element={<VisitorRegisterPage />} />
        <Route element={<VisitorLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/spots" element={<SpotListPage />} />
          <Route path="/spots/:spotId" element={<SpotDetailPage />} />
          <Route path="/routes" element={<RouteRecommendPage />} />
          <Route path="/guide" element={<AiGuidePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
