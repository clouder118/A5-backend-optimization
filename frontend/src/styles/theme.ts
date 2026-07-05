import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#d8dcc9',
    colorInfo: '#9aa696',
    colorSuccess: '#a8c2a2',
    colorWarning: '#d6b778',
    colorError: '#d78b7f',
    colorText: '#f3f0e8',
    colorTextSecondary: 'rgba(243, 240, 232, 0.66)',
    colorBgLayout: '#090a09',
    colorBgContainer: '#111310',
    colorBorder: 'rgba(216, 220, 201, 0.18)',
    borderRadius: 6,
    fontFamily:
      '"Avenir Next", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Button: {
      borderRadius: 4,
      controlHeight: 40,
    },
    Card: {
      borderRadiusLG: 4,
    },
    Layout: {
      headerBg: '#090a09',
      bodyBg: '#090a09',
    },
  },
};
