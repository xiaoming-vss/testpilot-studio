import { Alert, Descriptions, Drawer, Empty, Skeleton, Tag } from 'antd'
import type { LlmConnection } from '@/services/api'
import { formatTime, getErrorMessage } from '@/utils/format'

function getConnectionStatusMeta(status?: string) {
  switch (status) {
    case 'active':
      return { color: 'success' as const, label: '正常' }
    case 'auth_failed':
      return { color: 'error' as const, label: '异常' }
    case 'disabled':
      return { color: 'default' as const, label: '已停用' }
    default:
      return { color: 'default' as const, label: status || '-' }
  }
}

export function LlmConnectionDetailDrawer({
  open,
  loading,
  error,
  connection,
  onClose,
}: {
  open: boolean
  loading: boolean
  error: unknown
  connection?: LlmConnection
  onClose: () => void
}) {
  const statusMeta = getConnectionStatusMeta(connection?.status)

  return (
    <Drawer title="LLM 连接详情" open={open} onClose={onClose} size={560}>
      {loading ? <Skeleton active paragraph={{ rows: 8 }} /> : null}
      {!loading && error ? <Alert showIcon type="error" title={getErrorMessage(error)} /> : null}
      {!loading && !error && !connection ? <Empty description="未找到连接详情" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
      {!loading && !error && connection ? (
        <div className="base-services-detail-layout">
          <Descriptions column={1} bordered size="middle" className="base-services-detail-descriptions">
            <Descriptions.Item label="连接名称">{connection.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="提供方">{connection.provider || '-'}</Descriptions.Item>
            <Descriptions.Item label="请求地址">{connection.baseUrl || '-'}</Descriptions.Item>
            <Descriptions.Item label="鉴权方式">{connection.authType || '-'}</Descriptions.Item>
            <Descriptions.Item label="模型 ID">{connection.modelId || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(connection.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTime(connection.updatedAt)}</Descriptions.Item>
          </Descriptions>
        </div>
      ) : null}
    </Drawer>
  )
}
