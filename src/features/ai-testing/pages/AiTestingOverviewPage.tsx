import { AppstoreOutlined, FileSearchOutlined, RobotOutlined } from '@ant-design/icons'
import { Alert } from 'antd'
import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { AiSkillLibraryPage } from './AiSkillLibraryPage'
import { RequirementAnalysisTaskPage } from './RequirementAnalysisTaskPage'
import { UnifiedAiTestingPage } from './UnifiedAiTestingPage'
import '@/features/ai-testing/styles/index.css'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'
import { getErrorMessage } from '@/utils/format'

export function AiTestingOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { projectsQuery } = useActiveProject()
  const legacyTab = searchParams.get('tab')
  const activeEntryKey = useMemo<'skills' | 'tasks' | 'analysis'>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'tasks' || tab === 'analysis') return tab
    return 'skills'
  }, [searchParams])

  if (legacyTab === 'api' || legacyTab === 'ui' || legacyTab === 'functional') {
    return <Navigate to="/ai-testing?tab=tasks" replace />
  }

  const overviewItems = [
    {
      key: 'skills',
      title: 'Skill库',
      icon: <RobotOutlined />,
    },
    {
      key: 'tasks',
      title: '生成任务',
      icon: <AppstoreOutlined />,
    },
    {
      key: 'analysis',
      title: '需求分析',
      icon: <FileSearchOutlined />,
    },
  ] as const

  return (
    <div className="workbench-page ai-testing-page ai-testing-overview-page">
      {projectsQuery.error ? (
        <Alert showIcon type="error" title={getErrorMessage(projectsQuery.error)} />
      ) : null}

      <section className="workbench-project-toolbar base-services-toolbar ai-testing-overview-toolbar">
        <div className="ai-testing-overview-switcher-row">
          <div className="ai-testing-overview-tab-switcher" role="tablist" aria-label="AI测试模块切换">
            {overviewItems.map((item) => {
              const active = item.key === activeEntryKey

              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`ai-testing-overview-tab${active ? ' active' : ''}`}
                  onClick={() => {
                    const nextSearchParams = new URLSearchParams(searchParams)
                    nextSearchParams.set('tab', item.key)
                    setSearchParams(nextSearchParams, { replace: true })
                  }}
                >
                  <span className="ai-testing-overview-tab-icon">{item.icon}</span>
                  <span>{item.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {activeEntryKey === 'tasks' ? (
        <UnifiedAiTestingPage embedded />
      ) : activeEntryKey === 'analysis' ? (
        <RequirementAnalysisTaskPage embedded />
      ) : (
        <AiSkillLibraryPage embedded />
      )}
    </div>
  )
}
