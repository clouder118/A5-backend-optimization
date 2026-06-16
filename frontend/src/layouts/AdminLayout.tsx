import {
  DatabaseOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  HomeOutlined,
  MessageOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { productCopy } from '../config/product';

const adminItems: MenuProps['items'] = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, label: <Link to="/admin/dashboard">数据看板</Link> },
  { key: '/admin/spots', icon: <HomeOutlined />, label: <Link to="/admin/spots">景点管理</Link> },
  { key: '/admin/routes', icon: <NodeIndexOutlined />, label: <Link to="/admin/routes">路线管理</Link> },
  { key: '/admin/knowledge', icon: <DatabaseOutlined />, label: <Link to="/admin/knowledge">知识库管理</Link> },
  { key: '/admin/logs', icon: <MessageOutlined />, label: <Link to="/admin/logs">问答日志</Link> },
];

const adminNavItems = adminItems ?? [];

export default function AdminLayout() {
  const location = useLocation();
  const selectedKey =
    adminNavItems.find((item) => typeof item?.key === 'string' && location.pathname.startsWith(item.key))?.key?.toString() ??
    '/admin/dashboard';

  return (
    <Layout className="admin-layout">
      <Layout.Sider className="admin-sider" width={232} breakpoint="lg" collapsedWidth={0}>
        <Link to="/admin/dashboard" className="admin-brand">
          <span className="brand-symbol admin-brand-symbol">
            <FileSearchOutlined />
          </span>
          <span>{productCopy.adminBrandName}</span>
        </Link>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={adminNavItems} />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="admin-header">
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{productCopy.adminTitle}</Typography.Text>
            <Typography.Text type="secondary">[ OPERATIONS ] 景区资料库与问答运营</Typography.Text>
          </Space>
          <Link to="/">[ VISITOR ]</Link>
        </Layout.Header>
        <Layout.Content className="admin-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
