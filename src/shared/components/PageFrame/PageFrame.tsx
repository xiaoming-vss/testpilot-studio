import { Space, Typography } from 'antd'
import type { ReactNode } from 'react'

const { Title, Paragraph, Text } = Typography

export function PageFrame({
  title,
  description,
  actions,
  back,
  children,
  hideHeader = false,
}: {
  title: string
  description?: string
  actions?: ReactNode
  back?: ReactNode
  children: ReactNode
  hideHeader?: boolean
}) {
  return (
    <Space orientation="vertical" size={20} className="page-frame">
      {hideHeader ? null : (
        <div className="page-head">
          <Space orientation="vertical" size={6}>
            {back}
            <Title level={2}>{title}</Title>
            {description ? <Paragraph type="secondary">{description}</Paragraph> : null}
          </Space>
          <div className="page-actions">{actions}</div>
        </div>
      )}
      {children}
    </Space>
  )
}

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="section-head">
      <Title level={4}>{title}</Title>
      <Text type="secondary">{description}</Text>
    </div>
  )
}
