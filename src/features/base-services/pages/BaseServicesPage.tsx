import { BranchesOutlined, DeploymentUnitOutlined, RobotOutlined } from '@ant-design/icons'
import { Button, Card, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

const { Paragraph, Text, Title } = Typography

type BaseServiceTab = 'llm' | 'zentao' | 'gitlab'

type BaseServiceCard = {
  title: string
  badge: string
  summary: string
  points: string[]
}

const tabOptions: Array<{
  key: BaseServiceTab
  label: string
  icon: ReactNode
  title: string
  description: string
  actionLabel: string
  cards: BaseServiceCard[]
}> = [
  {
    key: 'llm',
    label: 'LLM模型',
    icon: <RobotOutlined />,
    title: 'LLM 模型服务',
    description: '用于后续承接模型供应商接入、默认模型选择、密钥配置与能力开关。',
    actionLabel: '新建模型配置',
    cards: [
      {
        title: '模型接入',
        badge: '规划中',
        summary: '统一管理模型供应商、Base URL、模型标识与鉴权信息。',
        points: ['支持接入多个模型供应商', '支持默认模型与环境隔离配置', '支持 API Key 与连接状态展示'],
      },
      {
        title: '推理能力',
        badge: '占位',
        summary: '后续会在这里补充模型上下文长度、温度、调用策略等能力配置。',
        points: ['预留模型参数编辑区', '预留能力标签与版本信息', '预留启用状态与最近更新时间'],
      },
    ],
  },
  {
    key: 'zentao',
    label: '禅道',
    icon: <DeploymentUnitOutlined />,
    title: '禅道服务',
    description: '用于后续承接禅道地址、组织账号、项目映射和缺陷/需求同步策略。',
    actionLabel: '新建禅道连接',
    cards: [
      {
        title: '连接配置',
        badge: '规划中',
        summary: '配置禅道服务地址、认证信息与项目空间，支撑需求和缺陷对接。',
        points: ['预留服务地址与账号配置', '预留项目映射与同步方向', '预留连接测试与状态反馈'],
      },
      {
        title: '数据同步',
        badge: '占位',
        summary: '后续会在这里补充需求、任务、Bug 等资产同步的策略与日志。',
        points: ['预留同步范围设置', '预留定时同步和手动同步入口', '预留失败重试与日志查看'],
      },
    ],
  },
  {
    key: 'gitlab',
    label: 'GitLab',
    icon: <BranchesOutlined />,
    title: 'GitLab 服务',
    description: '用于后续承接代码仓库连接、分支策略、Webhook 与流水线能力配置。',
    actionLabel: '新建 GitLab 连接',
    cards: [
      {
        title: '仓库接入',
        badge: '规划中',
        summary: '统一管理 GitLab 实例地址、访问令牌、仓库绑定与分支策略。',
        points: ['预留实例地址与 Token 配置', '预留仓库列表与绑定关系', '预留默认分支与提交策略设置'],
      },
      {
        title: '流水线能力',
        badge: '占位',
        summary: '后续会在这里补充 Webhook、CI/CD 流水线触发和执行状态展示。',
        points: ['预留 Webhook 回调配置', '预留流水线触发入口', '预留运行记录与状态看板'],
      },
    ],
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
        <div className="base-services-panel-body">
          <div className="base-services-panel-header">
            <div className="base-services-panel-copy">
              <Title level={4}>{activeMeta.title}</Title>
              <Paragraph>{activeMeta.description}</Paragraph>
            </div>
            <Button type="primary" className="base-services-panel-action" disabled>
              {activeMeta.actionLabel}
            </Button>
          </div>

          <div className="base-services-card-scroll">
            <div className="base-services-card-grid">
              {activeMeta.cards.map((card) => (
                <Card key={card.title} className="base-services-card">
                  <div className="base-services-card-top">
                    <Title level={5}>{card.title}</Title>
                    <Tag color="gold">{card.badge}</Tag>
                  </div>
                  <Paragraph className="base-services-card-summary">{card.summary}</Paragraph>
                  <div className="base-services-card-points">
                    {card.points.map((point) => (
                      <div key={point} className="base-services-card-point">
                        <span className="base-services-card-point-dot" />
                        <Text>{point}</Text>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}

              <Card className="base-services-placeholder-card">
                <div className="base-services-placeholder-badge">Coming Soon</div>
                <Title level={4}>基础服务能力建设中</Title>
                <Paragraph>
                  当前先保留侧边栏与页面结构，后续会在这里逐步补充连接配置、状态检测、同步日志与权限控制。
                </Paragraph>
                <div className="base-services-placeholder-tags">
                  <Tag>统一接入</Tag>
                  <Tag>配置管理</Tag>
                  <Tag>连接验证</Tag>
                  <Tag>状态监控</Tag>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
