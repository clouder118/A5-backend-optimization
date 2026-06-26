import { ConfigProvider } from 'antd';
import AdminApp from './apps/AdminApp';
import VisitorApp from './apps/VisitorApp';
import { getAppEntry } from './appEntry';
import { appTheme } from './styles/theme';

export default function App() {
  const EntryApp = getAppEntry() === 'admin' ? AdminApp : VisitorApp;

  return (
    <ConfigProvider theme={appTheme}>
      <EntryApp />
    </ConfigProvider>
  );
}
