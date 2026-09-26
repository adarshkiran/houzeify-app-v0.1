import { lazy, Suspense, useEffect, useState } from 'react'
import SplashScreen from './screens/SplashScreen'
import WelcomeScreen from './screens/WelcomeScreen'
import LoginScreen from './screens/LoginScreen'
import OtpScreen from './screens/OtpScreen'
import CreateAccountScreen from './screens/CreateAccountScreen'
import AccountCreatedScreen from './screens/AccountCreatedScreen'
import ChooseRoleScreen from './screens/ChooseRoleScreen'
import HomeownerOnboardingScreen from './screens/HomeownerOnboardingScreen'
import HomeDashboardScreen from './screens/HomeDashboardScreen'
import AIAdvisorScreen from './screens/AIAdvisorScreen'
import CreateProjectScreen from './screens/CreateProjectScreen'
import EstimateLoadingScreen from './screens/EstimateLoadingScreen'
import EstimateDashboardScreen from './screens/EstimateDashboardScreen'
import CostBreakdownScreen from './screens/CostBreakdownScreen'
import type { AppScreen } from './domain/navigation'
import { isAppScreen } from './domain/navigation'

const CompanyDashboardScreen = lazy(() => import('./screens/CompanyDashboardScreen'))
const BusinessOnboardingScreen = lazy(() => import('./screens/BusinessOnboardingScreen'))
const ProjectOverviewScreen = lazy(() => import('./screens/ProjectOverviewScreen'))
const CompanyProjectsScreen = lazy(() => import('./screens/CompanyProjectsScreen'))
const CompanyCreateProjectScreen = lazy(() => import('./screens/CompanyCreateProjectScreen'))
const ProjectStructureScreen = lazy(() => import('./screens/ProjectStructureScreen'))
const ProjectTeamScreen = lazy(() => import('./screens/ProjectTeamScreen'))
const WorkLibraryScreen = lazy(() => import('./screens/WorkLibraryScreen'))
const WorkPlanScreen = lazy(() => import('./screens/WorkPlanScreen'))
const TasksScreen = lazy(() => import('./screens/TasksScreen'))
const TaskDetailScreen = lazy(() => import('./screens/TaskDetailScreen'))
const DailyProgressSubmitScreen = lazy(() => import('./screens/DailyProgressSubmitScreen'))
const DailyProgressReviewScreen = lazy(() => import('./screens/DailyProgressReviewScreen'))
const CustomerDailyUpdateScreen = lazy(() => import('./screens/CustomerDailyUpdateScreen'))

function SplashRoute({ onComplete }: { onComplete: () => void }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2600)
    const completeTimer = setTimeout(onComplete, 3000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(completeTimer)
    }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fading ? 0 : 1, transition: 'opacity 0.4s ease-out' }}>
      <SplashScreen />
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('splash')
  const [phone, setPhone] = useState('98765 43210')
  const [projectData, setProjectData] = useState<Record<string, string>>({
    property_type: 'House',
    location: 'Hyderabad, Telangana',
  })

  const navigateTo = (s: string, data?: Record<string, string>) => {
    if (!isAppScreen(s)) return
    if (data?.phone) setPhone(data.phone)
    if (data) setProjectData(prev => ({ ...prev, ...data }))
    setScreen(s)
  }

  const slide = {
    position: 'absolute' as const,
    inset: 0,
    animation: 'splashFadeIn 0.4s ease-out both',
  }

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {screen === 'splash' && (
        <SplashRoute onComplete={() => setScreen('welcome')} />
      )}
      {screen === 'welcome' && (
        <div style={slide}>
          <WelcomeScreen onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'login' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <LoginScreen onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'otp' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <OtpScreen phone={phone} onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'create-account' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <CreateAccountScreen phone={phone} onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'account-created' && (
        <div style={slide}>
          <AccountCreatedScreen onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'role' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <ChooseRoleScreen onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'onboarding-homeowner' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <HomeownerOnboardingScreen onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'onboarding-business' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <BusinessOnboardingScreen onNavigate={navigateTo} />
          </Suspense>
        </div>
      )}
      {screen === 'dashboard-home' && (
        <div style={{ ...slide }}>
          <HomeDashboardScreen onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'ai-advisor' && (
        <div style={{ ...slide }}>
          <AIAdvisorScreen onNavigate={navigateTo} />
        </div>
      )}
      {screen === 'create-project' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <CreateProjectScreen
            onNavigate={navigateTo}
            initialPropertyType={projectData.property_type}
            initialLocation={projectData.location}
          />
        </div>
      )}
      {screen === 'estimate-loading' && (
        <div style={{ ...slide }}>
          <EstimateLoadingScreen
            onNavigate={navigateTo}
            projectName={projectData.project_name ?? '3 BHK G+1 House'}
            location={projectData.location ?? 'Hyderabad'}
          />
        </div>
      )}
      {screen === 'estimate-dashboard' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <EstimateDashboardScreen
            onNavigate={navigateTo}
            projectName={projectData.project_name ?? '3 BHK G+1 House'}
            location={projectData.location ?? 'Hyderabad'}
          />
        </div>
      )}
      {screen === 'cost-breakdown' && (
        <div style={{ ...slide }}>
          <CostBreakdownScreen
            onNavigate={navigateTo}
            projectName={projectData.project_name ?? '3 BHK G+1 House'}
            location={projectData.location ?? 'Hyderabad'}
          />
        </div>
      )}
      {screen === 'company-dashboard' && (
        <div style={{ ...slide }}>
          <Suspense fallback={null}>
            <CompanyDashboardScreen onNavigate={navigateTo} />
          </Suspense>
        </div>
      )}
      {screen === 'project-overview' && (
        <div style={{ ...slide }}>
          <Suspense fallback={null}>
            <ProjectOverviewScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id ?? 'project-sharma'}
            />
          </Suspense>
        </div>
      )}
      {screen === 'company-projects' && (
        <div style={{ ...slide }}>
          <Suspense fallback={null}>
            <CompanyProjectsScreen onNavigate={navigateTo} />
          </Suspense>
        </div>
      )}
      {screen === 'company-create-project' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <CompanyCreateProjectScreen onNavigate={navigateTo} />
          </Suspense>
        </div>
      )}
      {screen === 'project-structure' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <ProjectStructureScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id ?? 'project-sharma'}
            />
          </Suspense>
        </div>
      )}
      {screen === 'project-team' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <ProjectTeamScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id ?? 'project-sharma'}
            />
          </Suspense>
        </div>
      )}
      {screen === 'work-library' && (
        <div style={{ ...slide }}>
          <Suspense fallback={null}>
            <WorkLibraryScreen onNavigate={navigateTo} />
          </Suspense>
        </div>
      )}
      {screen === 'work-plan' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <WorkPlanScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id ?? 'project-sharma'}
            />
          </Suspense>
        </div>
      )}
      {screen === 'tasks' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <TasksScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id ?? 'project-sharma'}
            />
          </Suspense>
        </div>
      )}
      {screen === 'task-detail' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <TaskDetailScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id ?? 'project-sharma'}
              taskId={projectData.task_id ?? 'task-1'}
            />
          </Suspense>
        </div>
      )}
      {screen === 'daily-progress-submit' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <DailyProgressSubmitScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id ?? 'project-sharma'}
              taskId={projectData.task_id}
            />
          </Suspense>
        </div>
      )}
      {screen === 'daily-progress-review' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <DailyProgressReviewScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id || undefined}
            />
          </Suspense>
        </div>
      )}
      {screen === 'customer-daily-update' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <CustomerDailyUpdateScreen
              onNavigate={navigateTo}
              projectId={projectData.project_id ?? 'project-sharma'}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
