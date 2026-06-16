import { Empty } from 'antd';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({
  title = '暂时没有内容',
  description = '当前暂无可展示的数据。',
}: EmptyStateProps) {
  return <Empty description={`${title}：${description}`} />;
}
