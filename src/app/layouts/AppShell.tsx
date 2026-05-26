import {
  AppstoreOutlined,
  DownOutlined,
  ExperimentOutlined,
  LinkOutlined,
  LogoutOutlined,
  MoonOutlined,
  RobotOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Layout, Menu, Select, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ApiCollectionDetailPage } from '@/features/api-automation/pages/ApiCollectionDetailPage'
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ProfilePage } from '@/features/profile/pages/ProfilePage'
import { ProjectDetailPage } from '@/features/projects/pages/ProjectDetailPage'
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage'
import { SprintDetailPage } from '@/features/projects/pages/SprintDetailPage'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'
import { RequirementDetailPage } from '@/features/requirements/pages/RequirementDetailPage'
import { AiTestingPage } from '@/features/ai-testing/pages/AiTestingPage'
import { ApiCaseGenerateTaskDetailPage } from '@/features/ai-testing/pages/ApiCaseGenerateTaskDetailPage'
import { BaseServicesPage } from '@/features/base-services/pages/BaseServicesPage'
import { TestingPage } from '@/features/testing/pages/TestingPage'
import { FunctionTestSuiteDetailPage } from '@/features/test-cases/pages/FunctionTestSuiteDetailPage'
import { UiTestSuiteCasePage } from '@/features/ui-automation/pages/UiTestSuiteCasePage'
import { TestPilotLogo } from '@/shared/components/TestPilotLogo/TestPilotLogo'
import { useThemeStore } from '@/shared/store/theme.store'
import { normalizeProjectId } from '@/utils/format'

const { Header, Sider, Content } = Layout

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  const themeMode = useThemeStore((state) => state.mode)
  const toggleThemeMode = useThemeStore((state) => state.toggleMode)
  const { token } = useCurrentUser()
  const { activeProjectId, projects, projectsQuery, setActiveProjectId } = useActiveProject()
  const showWorkbenchHeader = !location.pathname.startsWith('/profile')

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/base-services')) return '/base-services'
    if (location.pathname.startsWith('/ai-testing')) return '/ai-testing'
    if (location.pathname.startsWith('/test-cases')) return '/testing'
    if (location.pathname.startsWith('/testing')) return '/testing'
    if (location.pathname.startsWith('/api-automation')) return '/testing'
    if (location.pathname.startsWith('/ui-automation')) return '/testing'
    return '/projects'
  }, [location.pathname])

  const items: MenuProps['items'] = [
    { key: '/projects', icon: <AppstoreOutlined />, label: '项目总览' },
    { key: '/testing', icon: <ExperimentOutlined />, label: '测试' },
    { key: '/ai-testing', icon: <RobotOutlined />, label: 'AI测试' },
    { key: '/base-services', icon: <LinkOutlined />, label: '基础服务' },
  ]

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return (
    <Layout className="app-shell">
      <Sider
        width={76}
        collapsedWidth={76}
        trigger={null}
        theme="light"
        className="app-sider"
      >
        <div className="brand-row">
          <button className="brand" type="button" onClick={() => navigate('/projects')}>
            <TestPilotLogo size={36} className="brand-logo" />
            <span className="brand-text">TestPilot</span>
          </button>
        </div>
        <Menu
          mode="inline"
          inlineCollapsed={false}
          selectedKeys={[selectedKey]}
          items={items}
          onClick={({ key }) => navigate(String(key))}
        />
      </Sider>
      <Layout>
        <Header className="app-header compact-header">
          <div className="app-header-main">
            {showWorkbenchHeader ? (
              <div className="project-header-bar project-header-bar-select-only">
                <div className="project-selector-wrap">
                  <span className="project-selector-label">当前项目</span>
                  <span className="project-separator">/</span>
                  <Select
                    className="project-select"
                    loading={projectsQuery.isLoading}
                    value={activeProjectId}
                    placeholder="请选择项目"
                    suffixIcon={<DownOutlined />}
                    options={projects.map((project) => ({ label: project.name, value: normalizeProjectId(project) }))}
                    onChange={setActiveProjectId}
                    variant="borderless"
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className="app-header-actions">
            <Tooltip title={themeMode === 'dark' ? '切换浅色模式' : '切换黑夜模式'}>
              <Button
                type="text"
                shape="circle"
                icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleThemeMode}
              />
            </Tooltip>
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', icon: <SettingOutlined />, label: '个人设置' },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    danger: true,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'profile') navigate('/profile')
                  if (key === 'logout') {
                    logout()
                    navigate('/login', { replace: true })
                  }
                },
              }}
              trigger={['click']}
            >
              <Tooltip title="当前用户">
                <Button type="text" shape="circle" icon={<UserOutlined />} />
              </Tooltip>
            </Dropdown>
          </div>
        </Header>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/projects/:projectId/sprints/:sprintId" element={<SprintDetailPage />} />
            <Route
              path="/projects/:projectId/sprints/:sprintId/requirements/:requirementId"
              element={<RequirementDetailPage />}
            />
            <Route path="/testing" element={<TestingPage />} />
            <Route path="/test-cases" element={<Navigate to="/testing?tab=functional" replace />} />
            <Route path="/test-cases/suites/:suiteId" element={<FunctionTestSuiteDetailPage />} />
            <Route path="/ai-testing" element={<AiTestingPage />} />
            <Route path="/ai-testing/tasks/:taskId" element={<ApiCaseGenerateTaskDetailPage />} />
            <Route path="/base-services" element={<BaseServicesPage />} />
            <Route path="/api-automation" element={<Navigate to="/testing?tab=api" replace />} />
            <Route path="/api-automation/collections/:collectionId" element={<ApiCollectionDetailPage />} />
            <Route path="/ui-automation" element={<Navigate to="/testing?tab=ui" replace />} />
            <Route path="/ui-automation/suites/:suiteId" element={<UiTestSuiteCasePage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
