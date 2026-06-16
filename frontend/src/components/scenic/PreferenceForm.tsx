import { Alert, Button, Card, Checkbox, Form, Radio, Select, Space, Typography } from 'antd';
import type { RoutePreferenceInput, VisitorPreference } from '../../types/scenic';

export interface PreferenceFormProps {
  initialValues: RoutePreferenceInput;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  onSubmit: (values: RoutePreferenceInput) => void;
}

const visitorTypeOptions: Array<{ value: VisitorPreference; label: string }> = [
  { value: 'family', label: '亲子游' },
  { value: 'culture', label: '历史文化游' },
  { value: 'relax', label: '轻松游' },
  { value: 'photo', label: '摄影游' },
];

const durationOptions = [
  { value: 60, label: '1 小时' },
  { value: 90, label: '1.5 小时' },
  { value: 120, label: '2 小时' },
  { value: 180, label: '3 小时' },
];

const interestOptions = ['历史', '建筑', '自然', '拍照', '亲子', '休息'];

export default function PreferenceForm({
  initialValues,
  loading = false,
  disabled = false,
  error,
  onSubmit,
}: PreferenceFormProps) {
  const [form] = Form.useForm<RoutePreferenceInput>();

  return (
    <Card className="preference-card">
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <div>
          <Typography.Text className="mono-label">[ PREFERENCE ]</Typography.Text>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            选择你的游览偏好
          </Typography.Title>
        </div>
        {error ? <Alert type="warning" showIcon message="路线推荐异常" description={error} /> : null}
        <Form
          form={form}
          disabled={disabled || loading}
          layout="vertical"
          initialValues={initialValues}
          onFinish={onSubmit}
        >
          <Form.Item<RoutePreferenceInput>
            name="visitorType"
            label="游客类型"
            rules={[{ required: true, message: '请选择游客类型' }]}
          >
            <Radio.Group>
              {visitorTypeOptions.map((option) => (
                <Radio.Button value={option.value} key={option.value}>
                  {option.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item<RoutePreferenceInput> name="durationMinutes" label="可游览时间">
            <Select options={durationOptions} />
          </Form.Item>
          <Form.Item<RoutePreferenceInput> name="physicalLevel" label="步行强度">
            <Radio.Group>
              <Radio.Button value="low">低</Radio.Button>
              <Radio.Button value="medium">中</Radio.Button>
              <Radio.Button value="high">高</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item<RoutePreferenceInput> name="interestTags" label="兴趣标签">
            <Checkbox.Group options={interestOptions} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} data-cue="[ GENERATE ]">
            [ GENERATE ROUTE ]
          </Button>
        </Form>
      </Space>
    </Card>
  );
}
