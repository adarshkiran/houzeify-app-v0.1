import type { ReactNode } from "react"
import { App, ConfigProvider } from "antd"

const houzeifyCompanyTheme = {
  cssVar: { key: "houzeify-company" },
  token: {
    colorPrimary: "#722ED1",
    colorInfo: "#0284C7",
    colorSuccess: "#16A34A",
    colorWarning: "#D97706",
    colorError: "#DC2626",
    colorBgBase: "#FFFFFF",
    // Page background: soft light blue, deep enough for white cards to stand out.
    colorBgLayout: "#F1F5FB",
    colorText: "#1C1917",
    colorTextSecondary: "#6B7280",
    colorBorder: "#E7E5E4",
    colorBorderSecondary: "#F3F4F6",
    fontFamily: '"Inter", sans-serif',
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
  },
  components: {
    Layout: {
      headerBg: "#FFFFFF",
      headerColor: "#1C1917",
      headerHeight: 64,
      headerPadding: "0 24px",
      bodyBg: "#F1F5FB",
      lightSiderBg: "#FFFFFF",
      siderBg: "#FFFFFF",
    },
    Menu: {
      itemHeight: 40,
      itemMarginInline: 8,
      itemPaddingInline: 16,
      itemBorderRadius: 8,
      itemColor: "#6B7280",
      itemHoverColor: "#1C1917",
      itemHoverBg: "#F4F0EC",
      itemSelectedColor: "#722ED1",
      itemSelectedBg: "#F3EAFF",
      collapsedWidth: 72,
    },
    Card: {
      headerBg: "transparent",
      headerFontSize: 15,
      headerHeight: 56,
      headerPadding: 20,
      bodyPadding: 20,
      extraColor: "#722ED1",
      borderRadiusLG: 8,
    },
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 30,
    },
    Progress: {
      defaultColor: "#722ED1",
      remainingColor: "#F3EAFF",
      lineBorderRadius: 999,
    },
    Tag: {
      defaultBg: "#F4F0EC",
      defaultColor: "#68636D",
    },
  },
}

export default function CompanyThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={houzeifyCompanyTheme}>
      {/* component={false}: provides message/modal context without a wrapper div. */}
      <App component={false}>{children}</App>
    </ConfigProvider>
  )
}
