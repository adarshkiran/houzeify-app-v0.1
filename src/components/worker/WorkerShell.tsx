import type { ReactNode } from "react"
import { Flex } from "antd"
import CompanyThemeProvider from "../company/CompanyThemeProvider"
import LogoHorizontal from "../LogoHorizontal"

/**
 * Page frame for the worker app: company theme, slim header, and a single
 * phone-width column (workers use it on site, on their phones).
 */
export default function WorkerShell({
  headerAction,
  children,
}: {
  headerAction?: ReactNode
  children: ReactNode
}) {
  return (
    <CompanyThemeProvider>
      <Flex vertical className="company-form-page min-h-full">
        <Flex
          align="center"
          justify="space-between"
          gap="middle"
          className="business-onboarding-header worker-app-header"
        >
          <LogoHorizontal height={24} />
          {headerAction}
        </Flex>
        <Flex vertical gap="middle" className="worker-app-content">
          {children}
        </Flex>
      </Flex>
    </CompanyThemeProvider>
  )
}
