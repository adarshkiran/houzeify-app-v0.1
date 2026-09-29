import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  buildHash,
  homeScreenFor,
  isAppScreen,
  nextParams,
  parseHash,
  resolveRoute,
  type RouteLocation,
} from './domain/navigation'
import { useConstructionData } from './mock/ConstructionDataProvider'
import { useSession } from './session/SessionProvider'

const CompanyDashboardScreen = lazy(() => import('./screens/CompanyDashboardScreen'))
const BusinessOnboardingScreen = lazy(() => import('./screens/BusinessOnboardingScreen'))
const ProjectOverviewScreen = lazy(() => import('./screens/ProjectOverviewScreen'))
const CompanyProjectsScreen = lazy(() => import('./screens/CompanyProjectsScreen'))
const CompanyCreateProjectScreen = lazy(() => import('./screens/CompanyCreateProjectScreen'))
const ProjectStructureScreen = lazy(() => import('./screens/ProjectStructureScreen'))
const ProjectTeamScreen = lazy(() => import('./screens/ProjectTeamScreen'))
const WorkLibraryScreen = lazy(() => import('./screens/WorkLibraryScreen'))
const WorkforceScreen = lazy(() => import('./screens/WorkforceScreen'))
const WorkPlanScreen = lazy(() => import('./screens/WorkPlanScreen'))
const TasksScreen = lazy(() => import('./screens/TasksScreen'))
const TaskDetailScreen = lazy(() => import('./screens/TaskDetailScreen'))
const DailyProgressSubmitScreen = lazy(() => import('./screens/DailyProgressSubmitScreen'))
const DailyProgressReviewScreen = lazy(() => import('./screens/DailyProgressReviewScreen'))
const CustomerDailyUpdateScreen = lazy(() => import('./screens/CustomerDailyUpdateScreen'))
const IssuesScreen = lazy(() => import('./screens/IssuesScreen'))
const ProjectDocumentsScreen = lazy(() => import('./screens/ProjectDocumentsScreen'))
const IssueDetailScreen = lazy(() => import('./screens/IssueDetailScreen'))
const ProjectMessagesScreen = lazy(() => import('./screens/ProjectMessagesScreen'))
const WorkerOnboardingScreen = lazy(() => import('./screens/WorkerOnboardingScreen'))
const WorkerTodayScreen = lazy(() => import('./screens/WorkerTodayScreen'))
const WorkerTaskScreen = lazy(() => import('./screens/WorkerTaskScreen'))
const WorkerSubmitScreen = lazy(() => import('./screens/WorkerSubmitScreen'))
const WorkerMessagesScreen = lazy(() => import('./screens/WorkerMessagesScreen'))

function SplashRoute({ onComplete }: { onComplete: () => void }) {
  const [fading, setFading] = useState(false)
  // Latest callback without restarting the timers when the parent re-renders.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2600)
    const completeTimer = setTimeout(() => onCompleteRef.current(), 3000)

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

const DEFAULT_PARAMS: Record<string, string> = {
  property_type: 'House',
  location: 'Hyderabad, Telangana',
}

function readLocation(): RouteLocation {
  return parseHash(window.location.hash) ?? { screen: 'splash', params: {} }
}

export default function App() {
  const { session, signOut } = useSession()
  const { state } = useConstructionData()
  const [location, setLocation] = useState<RouteLocation>(readLocation)
  const [phone, setPhone] = useState('98765 43210')

  const knownProjectIds = useMemo(
    () => new Set(state.projects.map(project => project.id)),
    [state.projects],
  )

  // The URL hash is the single source of truth; state mirrors it.
  useEffect(() => {
    const onHashChange = () => setLocation(readLocation())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const goTo = (next: RouteLocation, replace = false) => {
    const hash = buildHash(next)
    if (replace) {
      window.history.replaceState(null, '', hash)
      setLocation(next)
    } else if (window.location.hash === hash) {
      setLocation(next)
    } else {
      window.location.hash = hash
    }
  }

  const navigateTo = (s: string, data?: Record<string, string>) => {
    if (!isAppScreen(s)) {
      console.warn(`[navigation] ignoring unknown screen "${s}"`)
      return
    }
    if (data?.phone) setPhone(data.phone)
    // Going back to the entry screens ends the session.
    if (s === 'welcome' || s === 'login') signOut()
    goTo({ screen: s, params: nextParams(location.params, data) })
  }

  const decision = resolveRoute(location, {
    session,
    memberships: state.memberships,
    knownProjectIds,
  })

  // Empty hash (or an unknown one) lands on the splash, which then routes on.
  const redirect = decision.ok ? null : decision.redirect
  useEffect(() => {
    if (redirect) goTo(redirect, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirect?.screen, JSON.stringify(redirect?.params)])

  const { screen, params } = location
  const projectId = params.project_id

  if (!decision.ok) return null

  const slide = {
    position: 'absolute' as const,
    inset: 0,
    animation: 'splashFadeIn 0.4s ease-out both',
  }

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {screen === 'splash' && (
        <SplashRoute
          onComplete={() => goTo({ screen: homeScreenFor(session), params: {} }, true)}
        />
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
      {screen === 'onboarding-worker' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <WorkerOnboardingScreen onNavigate={navigateTo} />
          </Suspense>
        </div>
      )}
      {screen === 'worker-today' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <WorkerTodayScreen onNavigate={navigateTo} />
          </Suspense>
        </div>
      )}
      {screen === 'worker-task' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <WorkerTaskScreen
              onNavigate={navigateTo}
              projectId={projectId}
              taskId={params.task_id}
            />
          </Suspense>
        </div>
      )}
      {screen === 'worker-submit' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <WorkerSubmitScreen
              onNavigate={navigateTo}
              projectId={projectId}
              taskId={params.task_id}
            />
          </Suspense>
        </div>
      )}
      {screen === 'worker-messages' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <WorkerMessagesScreen onNavigate={navigateTo} threadId={params.thread_id} />
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
            initialPropertyType={params.property_type ?? DEFAULT_PARAMS.property_type}
            initialLocation={params.location ?? DEFAULT_PARAMS.location}
          />
        </div>
      )}
      {screen === 'estimate-loading' && (
        <div style={{ ...slide }}>
          <EstimateLoadingScreen
            onNavigate={navigateTo}
            estimateId={params.estimate_id}
          />
        </div>
      )}
      {screen === 'estimate-dashboard' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <EstimateDashboardScreen
            onNavigate={navigateTo}
            estimateId={params.estimate_id}
          />
        </div>
      )}
      {screen === 'cost-breakdown' && (
        <div style={{ ...slide }}>
          <CostBreakdownScreen
            onNavigate={navigateTo}
            estimateId={params.estimate_id}
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
              projectId={projectId}
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
              projectId={projectId}
              setup={params.setup === '1'}
            />
          </Suspense>
        </div>
      )}
      {screen === 'project-team' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <ProjectTeamScreen
              onNavigate={navigateTo}
              projectId={projectId}
              setup={params.setup === '1'}
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
      {screen === 'workforce' && (
        <div style={{ ...slide }}>
          <Suspense fallback={null}>
            <WorkforceScreen onNavigate={navigateTo} />
          </Suspense>
        </div>
      )}
      {screen === 'work-plan' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <WorkPlanScreen
              onNavigate={navigateTo}
              projectId={projectId}
            />
          </Suspense>
        </div>
      )}
      {screen === 'tasks' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <TasksScreen
              onNavigate={navigateTo}
              projectId={projectId}
            />
          </Suspense>
        </div>
      )}
      {screen === 'task-detail' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <TaskDetailScreen
              onNavigate={navigateTo}
              projectId={projectId}
              taskId={params.task_id}
            />
          </Suspense>
        </div>
      )}
      {screen === 'daily-progress-submit' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <DailyProgressSubmitScreen
              onNavigate={navigateTo}
              projectId={projectId}
              taskId={params.task_id}
            />
          </Suspense>
        </div>
      )}
      {screen === 'daily-progress-review' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <DailyProgressReviewScreen
              onNavigate={navigateTo}
              projectId={projectId}
            />
          </Suspense>
        </div>
      )}
      {screen === 'issues' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <IssuesScreen onNavigate={navigateTo} projectId={projectId} />
          </Suspense>
        </div>
      )}
      {screen === 'project-documents' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <ProjectDocumentsScreen onNavigate={navigateTo} projectId={projectId} />
          </Suspense>
        </div>
      )}
      {screen === 'project-messages' && (
        <div style={{ ...slide }}>
          <Suspense fallback={null}>
            <ProjectMessagesScreen onNavigate={navigateTo} projectId={projectId} threadId={params.thread_id} from={params.from} />
          </Suspense>
        </div>
      )}
      {screen === 'issue-detail' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <IssueDetailScreen
              onNavigate={navigateTo}
              projectId={projectId}
              issueId={params.issue_id}
            />
          </Suspense>
        </div>
      )}
      {screen === 'customer-daily-update' && (
        <div style={{ ...slide, overflowY: 'auto' }}>
          <Suspense fallback={null}>
            <CustomerDailyUpdateScreen
              onNavigate={navigateTo}
              projectId={projectId}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}
