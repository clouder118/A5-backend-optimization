import {
  DatabaseOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  HomeOutlined,
  MessageOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAdminToken, getCurrentUser, readAdminToken } from '../api/auth';
import { productCopy } from '../config/product';
import type { AuthUser } from '../types/api';

const adminItems: MenuProps['items'] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">数据看板</Link> },
  { key: '/spots', icon: <HomeOutlined />, label: <Link to="/spots">景点管理</Link> },
  { key: '/routes', icon: <NodeIndexOutlined />, label: <Link to="/routes">路线管理</Link> },
  { key: '/knowledge', icon: <DatabaseOutlined />, label: <Link to="/knowledge">知识库管理</Link> },
  { key: '/logs', icon: <MessageOutlined />, label: <Link to="/logs">问答日志</Link> },
];

const adminNavItems = adminItems ?? [];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedKey =
    adminNavItems.find((item) => typeof item?.key === 'string' && location.pathname.startsWith(item.key))?.key?.toString() ??
    '/dashboard';

  useEffect(() => {
    let cancelled = false;
    const token = readAdminToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      navigate('/login', { replace: true });
      return undefined;
    }

    setLoading(true);
    getCurrentUser(token)
      .then((currentUser) => {
        if (cancelled) {
          return;
        }
        if (currentUser.role !== 'admin') {
          clearAdminToken();
          setUser(null);
          navigate('/login', { replace: true });
          return;
        }
        setUser(currentUser);
      })
      .catch(() => {
        clearAdminToken();
        if (!cancelled) {
          setUser(null);
          navigate('/login', { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function logout() {
    clearAdminToken();
    setUser(null);
    navigate('/login', { replace: true });
  }

  if (loading || !user) {
    return <div className="admin-auth-loading">[ OPS ]</div>;
  }

  return (
    <Layout className="admin-layout">
      <Layout.Sider className="admin-sider" width={232} breakpoint="lg" collapsedWidth={0}>
        <Link to="/dashboard" className="admin-brand">
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
          <Space>
            <Typography.Text className="admin-user-label">[ {user.username} ]</Typography.Text>
            <Button onClick={logout}>[ LOG OUT ]</Button>
            <a href="http://127.0.0.1:5173/">[ VISITOR ]</a>
          </Space>
        </Layout.Header>
        <Layout.Content className="admin-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
