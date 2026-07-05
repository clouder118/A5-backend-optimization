import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { UnityWebGLGuideRuntimeProvider } from '../components/guide/UnityWebGLGuideRuntime';
import VisitorLayout from '../layouts/VisitorLayout';
import AiGuidePage from '../pages/visitor/AiGuidePage';
import HomePage from '../pages/visitor/HomePage';
import RouteDraftPage from '../pages/visitor/RouteDraftPage';
import RouteRecommendPage from '../pages/visitor/RouteRecommendPage';
import SpotDetailPage from '../pages/visitor/SpotDetailPage';
import SpotListPage from '../pages/visitor/SpotListPage';
import TourPage from '../pages/visitor/TourPage';
import TourRecapPage from '../pages/visitor/TourRecapPage';
import VisitorLoginPage from '../pages/visitor/VisitorLoginPage';
import VisitorRegisterPage from '../pages/visitor/VisitorRegisterPage';

export default function VisitorApp() {
  return (
    <BrowserRouter>
      <UnityWebGLGuideRuntimeProvider>
        <Routes>
          <Route path="/login" element={<VisitorLoginPage />} />
          <Route path="/register" element={<VisitorRegisterPage />} />
          <Route element={<VisitorLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/spots" element={<SpotListPage />} />
            <Route path="/spots/:spotId" element={<SpotDetailPage />} />
            <Route path="/routes" element={<RouteRecommendPage />} />
            <Route path="/route-drafts/:draftId" element={<RouteDraftPage />} />
            <Route path="/tour/:tourId" element={<TourPage />} />
            <Route path="/tour/:tourId/recap" element={<TourRecapPage />} />
            <Route path="/guide" element={<AiGuidePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UnityWebGLGuideRuntimeProvider>
    </BrowserRouter>
  );
}
