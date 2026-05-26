import { ApiOutlined, BugOutlined, ExperimentOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiAutomationPage } from '@/features/api-automation/pages/ApiAutomationPage'
import { TestCasePage } from '@/features/test-cases/pages/TestCasePage'
import { UiAutomationPage } from '@/features/ui-automation/pages/UiAutomationPage'
import '@/features/testing/styles/index.css'

type TestingTab = 'api' | 'ui' | 'functional'

const tabOptions: Array<{
  key: TestingTab
  label: string
  icon: ReactNode
}> = [
  { key: 'api', label: 'API测试', icon: <ApiOutlined /> },
  { key: 'ui', label: 'UI测试', icon: <BugOutlined /> },
  { key: 'functional', label: '功能测试', icon: <ExperimentOutlined /> },
]

export function TestingPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = useMemo<TestingTab>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'ui' || tab === 'functional' || tab === 'api') return tab
    return 'api'
  }, [searchParams])

  function handleTabChange(nextTab: TestingTab) {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('tab', nextTab)
    setSearchParams(nextSearchParams, { replace: true })
  }

  return (
    <div className="workbench-page testing-page">
      <section className="workbench-project-toolbar testing-toolbar">
        <div className="testing-tab-switcher" role="tablist" aria-label="测试模块切换">
          {tabOptions.map((option) => {
            const active = option.key === activeTab
            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`testing-tab${active ? ' active' : ''}`}
                onClick={() => handleTabChange(option.key)}
              >
                <span className="testing-tab-icon">{option.icon}</span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="testing-tab-panel">
        {activeTab === 'api' ? <ApiAutomationPage /> : null}
        {activeTab === 'ui' ? <UiAutomationPage /> : null}
        {activeTab === 'functional' ? <TestCasePage /> : null}
      </div>
    </div>
  )
}
