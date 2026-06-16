import { Button, Result } from 'antd';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = '数据加载失败',
  message = '请稍后重试，或联系现场工作人员获取帮助。',
  onRetry,
}: ErrorStateProps) {
  return (
    <Result
      status="warning"
      title={title}
      subTitle={message}
      extra={
        onRetry ? (
          <Button type="primary" onClick={onRetry}>
            重试
          </Button>
        ) : null
      }
    />
  );
}
