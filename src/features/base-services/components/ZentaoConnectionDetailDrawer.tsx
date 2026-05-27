import { Alert, Descriptions, Drawer, Empty, Skeleton, Tag, Typography } from 'antd'
import type { ZentaoConnection } from '@/services/api'
import { formatTime, getErrorMessage } from '@/utils/format'

const { Text } = Typography

function getConnectionStatusMeta(status?: string) {
  switch (status) {
    case 'active':
      return { color: 'success' as const, label: '连接正常' }
    case 'auth_failed':
      return { color: 'error' as const, label: '鉴权失败' }
    case 'disabled':
      return { color: 'default' as const, label: '已停用' }
    default:
      return { color: 'default' as const, label: status || '-' }
  }
}

export function ZentaoConnectionDetailDrawer({
  open,
  loading,
  error,
  connection,
  onClose,
}: {
  open: boolean
  loading: boolean
  error: unknown
  connection?: ZentaoConnection
  onClose: () => void
}) {
  const statusMeta = getConnectionStatusMeta(connection?.status)

  return (
    <Drawer title="禅道连接详情" open={open} onClose={onClose} width={560}>
      {loading ? <Skeleton active paragraph={{ rows: 10 }} /> : null}
      {!loading && error ? <Alert showIcon type="error" message={getErrorMessage(error)} /> : null}
      {!loading && !error && !connection ? <Empty description="未找到连接详情" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
      {!loading && !error && connection ? (
        <div className="base-services-detail-layout">
          {connection.lastAuthError ? (
            <Alert
              showIcon
              type={connection.status === 'auth_failed' ? 'error' : 'warning'}
              message="最近鉴权异常"
              description={connection.lastAuthError}
              className="base-services-detail-alert"
            />
          ) : null}
          <Descriptions column={1} bordered size="middle" className="base-services-detail-descriptions">
            <Descriptions.Item label="连接名称">{connection.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="提供方">{connection.provider || '-'}</Descriptions.Item>
            <Descriptions.Item label="禅道地址">{connection.baseUrl || '-'}</Descriptions.Item>
            <Descriptions.Item label="鉴权方式">{connection.authType || '-'}</Descriptions.Item>
            <Descriptions.Item label="账号">{connection.account || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Access Token">
              <Tag color={connection.hasAccessToken ? 'success' : 'default'}>
                {connection.hasAccessToken ? '已获取' : '未获取'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最近鉴权时间">{formatTime(connection.lastAuthAt)}</Descriptions.Item>
            <Descriptions.Item label="Token 过期时间">{formatTime(connection.tokenExpiresAt)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(connection.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTime(connection.updatedAt)}</Descriptions.Item>
            <Descriptions.Item label="最近错误">
              <Text className="base-services-detail-error-text">{connection.lastAuthError || '-'}</Text>
            </Descriptions.Item>
          </Descriptions>
        </div>
      ) : null}
    </Drawer>
  )
}
