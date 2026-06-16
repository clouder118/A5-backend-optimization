import { Card, Spin } from 'antd';

interface PageLoadingProps {
  label?: string;
}

export default function PageLoading({ label = '正在加载导览数据...' }: PageLoadingProps) {
  return (
    <Card>
      <div style={{ display: 'grid', minHeight: 220, placeItems: 'center' }}>
        <Spin tip={label}>
          <div style={{ width: 180, height: 80 }} />
        </Spin>
      </div>
    </Card>
  );
}
