import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import PageLoading from '../../components/common/PageLoading';
import SpotDetailSlider from '../../components/scenic/SpotDetailSlider';
import { fallbackSpotImage, resolveSpotPhotos } from '../../api/spotImages';
import { getSpotDetail } from '../../api/spots';
import type { ScenicSpot } from '../../types/scenic';

export default function SpotDetailPage() {
  const { spotId } = useParams();
  const [spot, setSpot] = useState<ScenicSpot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSpot = () => {
    if (!spotId) {
      setError('缺少景点 ID。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    getSpotDetail(spotId)
      .then(setSpot)
      .catch(() => setError('景点详情加载失败。'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSpot();
  }, [spotId]);

  if (loading) {
    return <PageLoading label="正在加载景点详情..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadSpot} />;
  }

  if (!spot) {
    return <EmptyState title="未找到景点" description="请回到景点列表重新选择。" />;
  }

  const buildGuideHref = (question: string) =>
    `/guide?spotId=${encodeURIComponent(spot.id)}&spotName=${encodeURIComponent(spot.name)}&question=${encodeURIComponent(question)}`;
  const guideQuestions = [
    `请介绍一下${spot.name}的主要看点、适合人群和游览建议。`,
    `${spot.name}适合带小朋友看吗？`,
    `${spot.name}附近路线怎么安排？`,
  ];

  return (
    <SpotDetailSlider
      spot={spot}
      photos={resolveSpotPhotos(spot.id, spot.imageUrl ?? fallbackSpotImage)}
      questions={guideQuestions.map((question) => ({ label: question, to: buildGuideHref(question) }))}
    />
  );
}
