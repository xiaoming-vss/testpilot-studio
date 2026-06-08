import { BranchesOutlined, DeploymentUnitOutlined, RobotOutlined } from '@ant-design/icons'
import { Alert, Empty, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LlmConnectionsPanel } from '@/features/base-services/components/LlmConnectionsPanel'
import { ZentaoConnectionsPanel } from '@/features/base-services/components/ZentaoConnectionsPanel'

const { Paragraph, Text, Title } = Typography

type BaseServiceTab = 'llm' | 'zentao' | 'gitlab'

const tabOptions: Array<{
  key: BaseServiceTab
  label: string
  icon: ReactNode
  title: string
  description: string
  pendingEndpoints: string[]
}> = [
  {
    key: 'llm',
    label: 'LLM模型',
    icon: <RobotOutlined />,
    title: 'LLM 模型服务',
    description: '用于承接模型供应商、模型配置和可用性检测等真实后端数据。',
    pendingEndpoints: ['列表查询', '详情查询', '新增/编辑', '删除', '连通性检测'],
  },
  {
    key: 'zentao',
    label: '禅道',
    icon: <DeploymentUnitOutlined />,
    title: '禅道服务',
    description: '用于承接禅道连接、项目映射和同步状态等真实后端数据。',
    pendingEndpoints: ['列表查询', '详情查询', '新增/编辑', '删除', '连接测试'],
  },
  {
    key: 'gitlab',
    label: 'GitLab',
    icon: <BranchesOutlined />,
    title: 'GitLab 服务',
    description: '用于承接 GitLab 仓库连接、Webhook、流水线状态等真实后端数据。',
    pendingEndpoints: ['列表查询', '详情查询', '新增/编辑', '删除', '连接测试'],
  },
]

export function BaseServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = useMemo<BaseServiceTab>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'llm' || tab === 'zentao' || tab === 'gitlab') return tab
    return 'llm'
  }, [searchParams])

  const activeMeta = tabOptions.find((item) => item.key === activeTab) ?? tabOptions[0]

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
        <div className={`base-services-panel-body${activeTab === 'zentao' || activeTab === 'llm' ? ' base-services-panel-body-immersive' : ''}`}>
          {activeTab === 'zentao' ? (
            <ZentaoConnectionsPanel />
          ) : activeTab === 'llm' ? (
            <LlmConnectionsPanel />
          ) : (
            <>
              <div className="base-services-panel-header">
                <div className="base-services-panel-copy">
                  <Title level={4}>{activeMeta.title}</Title>
                  <Paragraph>{activeMeta.description}</Paragraph>
                </div>
                <Tag color="blue" className="base-services-panel-status-tag">
                  等待后端接入
                </Tag>
              </div>

              <div className="base-services-empty-layout">
                <Alert
                  showIcon
                  type="info"
                  className="base-services-integration-alert"
                  message="Mock 数据已清理"
                  description="当前页面只保留模块切换和接入骨架，不再展示前端硬编码的连接卡片与演示数据。"
                />

                <div className="base-services-contract-card">
                  <div className="base-services-contract-copy">
                    <Title level={5}>后端接入准备完成</Title>
                    <Paragraph>
                      当前模块已经切回空态，后续可以直接接入真实的列表、详情、保存和状态检测接口，不需要再先移除前端假数据。
                    </Paragraph>
                  </div>
                  <div className="base-services-contract-tags">
                    {activeMeta.pendingEndpoints.map((item) => (
                      <Tag key={item}>{item}</Tag>
                    ))}
                  </div>
                </div>

                <div className="base-services-empty-card">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div className="base-services-empty-copy">
                        <Title level={5}>尚未接入 {activeMeta.label} 数据</Title>
                        <Text>等后端接口准备好后，这里直接展示真实连接列表和当前状态。</Text>
                      </div>
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
