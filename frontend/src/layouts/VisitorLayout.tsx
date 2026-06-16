import { CompassOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { productCopy } from '../config/product';

const navItems: MenuProps['items'] = [
  { key: '/', label: <Link to="/">首页</Link> },
  { key: '/spots', label: <Link to="/spots">景点</Link> },
  { key: '/routes', label: <Link to="/routes">路线推荐</Link> },
  { key: '/guide', label: <Link to="/guide">AI 导游</Link> },
];

export default function VisitorLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const selectedKey =
    navItems?.find((item) => typeof item?.key === 'string' && location.pathname === item.key)?.key?.toString() ||
    (location.pathname.startsWith('/spots') ? '/spots' : '/');

  return (
    <Layout className={`visitor-layout ${isHome ? 'visitor-layout-home' : ''}`}>
      <Layout.Header className="visitor-header">
        <Link to="/" className="brand-mark">
          <span className="brand-icon">
            <CompassOutlined />
          </span>
          <span className="brand-text">{productCopy.visitorBrandName}</span>
        </Link>
        <Menu className="visitor-menu" mode="horizontal" selectedKeys={[selectedKey]} items={navItems} />
        <Link to="/admin" className="visitor-admin-link">
          <Button icon={<SettingOutlined />}>管理后台</Button>
        </Link>
      </Layout.Header>
      <Layout.Content className="visitor-content">
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
