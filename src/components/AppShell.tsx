import {
  ApiOutlined,
  AppstoreOutlined,
  BugOutlined,
  DownOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Layout, Menu, Select, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useMemo } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuthStore } from '../store/auth'
import { useThemeStore } from '../store/theme'
import { useWorkbenchStore } from '../store/workbench'
import { ApiAutomationPage } from '../pages/ApiAutomationPage'
import { ApiCollectionDetailPage } from '../pages/ApiCollectionDetailPage'
import { ProfilePage } from '../pages/ProfilePage'
import { ProjectDetailPage } from '../pages/ProjectDetailPage'
import { ProjectsPage } from '../pages/ProjectsPage'
import { RequirementDetailPage } from '../pages/RequirementDetailPage'
import { SprintDetailPage } from '../pages/SprintDetailPage'
import { TestCasePage } from '../pages/TestCasePage'
import { UiAutomationPage } from '../pages/UiAutomationPage'
import { UiTestSuiteCasePage } from '../pages/UiTestSuiteCasePage'
import { TestPilotLogo } from './TestPilotLogo'
import { normalizeProjectId } from '../utils/format'

const { Header, Sider, Content } = Layout

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const activeProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const setActiveProjectId = useWorkbenchStore((state) => state.setActiveProjectId)
  const themeMode = useThemeStore((state) => state.mode)
  const toggleThemeMode = useThemeStore((state) => state.toggleMode)

  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: api.getUser,
    enabled: Boolean(token),
  })
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: api.getProjects })
  const projects = projectsQuery.data ?? []
  const showWorkbenchHeader = !location.pathname.startsWith('/profile')

  useEffect(() => {
    if (userQuery.data) setUser(userQuery.data)
  }, [setUser, userQuery.data])

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(normalizeProjectId(projects[0]))
    }
    if (activeProjectId && projects.length > 0 && !projects.some((project) => normalizeProjectId(project) === activeProjectId)) {
      setActiveProjectId(normalizeProjectId(projects[0]))
    }
  }, [activeProjectId, projects, setActiveProjectId])

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/test-cases')) return '/test-cases'
    if (location.pathname.startsWith('/api-automation')) return '/api-automation'
    if (location.pathname.startsWith('/ui-automation')) return '/ui-automation'
    return '/projects'
  }, [location.pathname])

  const items: MenuProps['items'] = [
    { key: '/projects', icon: <AppstoreOutlined />, label: '项目总览' },
    { key: '/test-cases', icon: <ExperimentOutlined />, label: '功能用例' },
    { key: '/api-automation', icon: <ApiOutlined />, label: '接口测试' },
    { key: '/ui-automation', icon: <BugOutlined />, label: 'UI测试' },
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
            <Route path="/test-cases" element={<TestCasePage />} />
            <Route path="/api-automation" element={<ApiAutomationPage />} />
            <Route path="/api-automation/collections/:collectionId" element={<ApiCollectionDetailPage />} />
            <Route path="/ui-automation" element={<UiAutomationPage />} />
            <Route path="/ui-automation/suites/:suiteId" element={<UiTestSuiteCasePage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
