import type { ReactNode } from 'react'
import { Button, Card, Space, Tag, Typography } from 'antd'

const { Paragraph, Text, Title } = Typography

type AiTestingEntryCard = {
  key: string
  title: string
  description: string
  tags?: string[]
}

type AiTestingEntryItem = {
  key: string
  title: string
  description: string
  icon: ReactNode
  actionLabel: string
  disabled?: boolean
  onClick: () => void
  cards: AiTestingEntryCard[]
}

type Props = {
  items: AiTestingEntryItem[]
  activeKey: string
  onActiveKeyChange: (key: string) => void
}

export function AiTestingEntryCards({ items, activeKey, onActiveKeyChange }: Props) {
  const activeItem = items.find((item) => item.key === activeKey) ?? items[0]

  return (
    <>
      <section className="workbench-project-toolbar ai-testing-overview-toolbar">
        <div className="ai-testing-overview-switcher-row">
          <div className="ai-testing-overview-tab-switcher" role="tablist" aria-label="AI测试模块切换">
            {items.map((item) => {
              const active = item.key === activeItem.key

              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`ai-testing-overview-tab${active ? ' active' : ''}`}
                  onClick={() => onActiveKeyChange(item.key)}
                >
                  <span className="ai-testing-overview-tab-icon">{item.icon}</span>
                  <span>{item.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="workbench-panel ai-testing-overview-panel">
        <div className="ai-testing-overview-panel-header">
          <div className="ai-testing-overview-panel-copy">
            <Title level={4}>{activeItem.title}</Title>
            <Paragraph>{activeItem.description}</Paragraph>
          </div>
          <Button type="primary" className="action-btn-create" disabled={activeItem.disabled} onClick={activeItem.onClick}>
            {activeItem.actionLabel}
          </Button>
        </div>

        <div className="ai-testing-overview-card-grid">
          {activeItem.cards.map((card) => (
            <Card key={card.key} className="ai-testing-overview-card" styles={{ body: { padding: 18 } }}>
              <div className="ai-testing-overview-card-head">
                <Space size={10}>
                  <span className="ai-testing-overview-card-dot" />
                  <Text strong className="ai-testing-overview-card-title">
                    {card.title}
                  </Text>
                </Space>
              </div>

              <Paragraph className="ai-testing-overview-card-description">{card.description}</Paragraph>

              {card.tags?.length ? (
                <div className="ai-testing-overview-card-tags">
                  {card.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      </section>
    </>
  )
}
