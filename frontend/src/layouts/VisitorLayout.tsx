import { SettingOutlined } from '@ant-design/icons';
import { Button, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { productCopy } from '../config/product';

const navItems: MenuProps['items'] = [
  { key: '/', label: <Link to="/">[ HOME ]</Link> },
  { key: '/spots', label: <Link to="/spots">[ SPOTS ]</Link> },
  { key: '/routes', label: <Link to="/routes">[ ROUTES ]</Link> },
  { key: '/guide', label: <Link to="/guide">[ GUIDE ]</Link> },
];

export default function VisitorLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isSpots = location.pathname === '/spots';
  const selectedKey =
    navItems?.find((item) => typeof item?.key === 'string' && location.pathname === item.key)?.key?.toString() ||
    (location.pathname.startsWith('/spots') ? '/spots' : '/');

  return (
    <Layout className={`visitor-layout ${isHome ? 'visitor-layout-home' : ''} ${isSpots ? 'visitor-layout-spots' : ''}`}>
      <Layout.Header className="visitor-header">
        <Link to="/" className="brand-mark" data-cue="[ HOME ]">
          <span className="brand-symbol" aria-hidden="true">
            L
          </span>
          <span className="brand-text">{productCopy.visitorBrandName}</span>
        </Link>
        <Menu className="visitor-menu" mode="horizontal" selectedKeys={[selectedKey]} items={navItems} />
        <Link to="/admin" className="visitor-admin-link">
          <Button icon={<SettingOutlined />} data-cue="[ ADMIN ]">
            [ OPS ]
          </Button>
        </Link>
      </Layout.Header>
      <Layout.Content className="visitor-content">
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}
