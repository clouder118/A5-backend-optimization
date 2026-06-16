import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#16776f',
    colorInfo: '#16776f',
    colorSuccess: '#3f8f45',
    colorWarning: '#c27a1a',
    colorText: '#1f2a2a',
    colorBgLayout: '#f5f7f3',
    borderRadius: 8,
    fontFamily:
      '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 40,
    },
    Card: {
      borderRadiusLG: 8,
    },
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#f5f7f3',
    },
  },
};
