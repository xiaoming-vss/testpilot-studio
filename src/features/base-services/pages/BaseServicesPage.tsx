import { BranchesOutlined, DeploymentUnitOutlined, RobotOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GitlabConnectionsPanel } from '@/features/base-services/components/GitlabConnectionsPanel'
import { LlmConnectionsPanel } from '@/features/base-services/components/LlmConnectionsPanel'
import { ZentaoConnectionsPanel } from '@/features/base-services/components/ZentaoConnectionsPanel'
import { useActiveProject } from '@/features/projects/hooks/useActiveProject'

type BaseServiceTab = 'llm' | 'zentao' | 'gitlab'

const tabOptions: Array<{
  key: BaseServiceTab
  label: string
  icon: ReactNode
}> = [
  {
    key: 'llm',
    label: 'LLM模型',
    icon: <RobotOutlined />,
  },
  {
    key: 'zentao',
    label: '禅道',
    icon: <DeploymentUnitOutlined />,
  },
  {
    key: 'gitlab',
    label: 'GitLab',
    icon: <BranchesOutlined />,
  },
]

export function BaseServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeProjectId } = useActiveProject()

  const activeTab = useMemo<BaseServiceTab>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'llm' || tab === 'zentao' || tab === 'gitlab') return tab
    return 'llm'
  }, [searchParams])

  function handleTabChange(nextTab: BaseServiceTab) {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('tab', nextTab)
    setSearchParams(nextSearchParams, { replace: true })
  }

  return (
    <div className="workbench-page base-services-page">
      <section className="workbench-project-toolbar base-services-toolbar">
        <div className="base-services-switcher-row">
          <div className="base-services-tab-switcher" role="tablist" aria-label="基础服务模块切换">
            {tabOptions.map((option) => {
              const active = option.key === activeTab
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`base-services-tab${active ? ' active' : ''}`}
                  onClick={() => handleTabChange(option.key)}
                >
                  <span className="base-services-tab-icon">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="workbench-panel base-services-panel">
        <div className="base-services-panel-body base-services-panel-body-immersive">
          {activeTab === 'zentao' ? (
            <ZentaoConnectionsPanel projectId={activeProjectId} />
          ) : activeTab === 'llm' ? (
            <LlmConnectionsPanel projectId={activeProjectId} />
          ) : (
            <GitlabConnectionsPanel projectId={activeProjectId} />
          )}
        </div>
      </section>
    </div>
  )
}
