import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Card, Empty, Form, Pagination, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  api,
  listItems,
  type GitlabConnection,
} from '@/services/api'
import { message } from '@/shared/utils/feedback'
import { formatTime, getErrorMessage } from '@/utils/format'
import { buildGitlabCreatePayload, buildGitlabUpdatePayload } from '../utils/gitlabConnectionPayload'
import { GitlabConnectionDetailDrawer } from './GitlabConnectionDetailDrawer'
import { GitlabConnectionDrawer, type GitlabConnectionFormValues } from './GitlabConnectionDrawer'

const { Paragraph, Text, Title } = Typography

function getConnectionStatusMeta(status?: string) {
  switch (status) {
    case 'active':
      return { color: 'success' as const, label: '连接正常', badgeStatus: 'success' as const }
    case 'auth_failed':
      return { color: 'error' as const, label: '鉴权失败', badgeStatus: 'error' as const }
    case 'disabled':
      return { color: 'default' as const, label: '已停用', badgeStatus: 'default' as const }
    default:
      return { color: 'default' as const, label: status || '-', badgeStatus: 'default' as const }
  }
}

function footerRange(total: number, page: number, pageSize: number) {
  if (total === 0) return '显示第 0 条 - 第 0 条，共 0 条'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `显示第 ${start} 条 - 第 ${end} 条，共 ${total} 条`
}

export function GitlabConnectionsPanel({ projectId }: { projectId?: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(18)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<GitlabConnection | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailConnectionId, setDetailConnectionId] = useState('')
  const [form] = Form.useForm<GitlabConnectionFormValues>()

  const connectionsQuery = useQuery({
    queryKey: ['gitlabConnections', projectId],
    queryFn: () => api.getGitlabConnections(projectId!),
    enabled: Boolean(projectId),
  })

  const detailQuery = useQuery({
    queryKey: ['gitlabConnection', projectId, detailConnectionId],
    queryFn: () => api.getGitlabConnection(projectId!, detailConnectionId),
    enabled: detailOpen && Boolean(projectId) && Boolean(detailConnectionId),
  })

  const connections = useMemo(
    () =>
      [...listItems(connectionsQuery.data)].sort((left, right) => {
        const leftTime = new Date(left.updatedAt || left.createdAt || left.lastAuthAt || '').getTime()
        const rightTime = new Date(right.updatedAt || right.createdAt || right.lastAuthAt || '').getTime()
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
      }),
    [connectionsQuery.data],
  )
  const pagedConnections = useMemo(
    () => connections.slice((page - 1) * pageSize, page * pageSize),
    [connections, page, pageSize],
  )

  const saveMutation = useMutation({
    mutationFn: (values: GitlabConnectionFormValues) => {
      if (!projectId) throw new Error('请先选择项目')
      if (editingConnection) {
        const payload = buildGitlabUpdatePayload(editingConnection, values)
        if (Object.keys(payload).length === 0) return Promise.resolve(editingConnection)
        return api.updateGitlabConnection(projectId, editingConnection.connectionId, payload)
      }
      return api.createGitlabConnection(projectId, buildGitlabCreatePayload(values))
    },
    onSuccess: (connection) => {
      const isEditing = Boolean(editingConnection)
      const hasChanges = !editingConnection || Object.keys(buildGitlabUpdatePayload(editingConnection, form.getFieldsValue())).length > 0
      message.success(isEditing ? (hasChanges ? 'GitLab 连接已更新' : '未检测到变更') : 'GitLab 连接已创建')
      queryClient.invalidateQueries({ queryKey: ['gitlabConnections', projectId] })
      queryClient.setQueryData(['gitlabConnection', projectId, connection.connectionId], connection)
      setDrawerOpen(false)
      setEditingConnection(null)
      form.resetFields()
    },
    onError: (error) => message.error(getErrorMessage(error)),
  })

  const reauthMutation = useMutation({
    mutationFn: (connectionId: string) => {
      if (!projectId) throw new Error('请先选择项目')
      return api.reauthGitlabConnection(projectId, connectionId)
    },
    onSuccess: (connection) => {
      message.success('GitLab 连接验证成功')
      queryClient.invalidateQueries({ queryKey: ['gitlabConnections', projectId] })
      queryClient.setQueryData(['gitlabConnection', projectId, connection.connectionId], connection)
    },
    onError: (error) => message.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) => {
      if (!projectId) throw new Error('请先选择项目')
      return api.deleteGitlabConnection(projectId, connectionId)
    },
    onSuccess: (_, connectionId) => {
      message.success('GitLab 连接已删除')
      queryClient.invalidateQueries({ queryKey: ['gitlabConnections', projectId] })
      queryClient.removeQueries({ queryKey: ['gitlabConnection', projectId, connectionId], exact: true })
      if (detailConnectionId === connectionId) {
        setDetailOpen(false)
        setDetailConnectionId('')
      }
    },
    onError: (error) => message.error(getErrorMessage(error)),
  })

  function openCreateDrawer() {
    setEditingConnection(null)
    form.setFieldsValue({ name: '', baseUrl: '', accessToken: '' })
    setDrawerOpen(true)
  }

  function openEditDrawer(connection: GitlabConnection) {
    setEditingConnection(connection)
    form.setFieldsValue({ name: connection.name, baseUrl: connection.baseUrl, accessToken: '' })
    setDrawerOpen(true)
  }

  return (
    <>
      <div className="panel-header api-panel-header">
        <div className="requirement-panel-head">
          <Text strong>GitLab 连接</Text>
        </div>
        <Button type="primary" className="action-btn-create" icon={<PlusOutlined />} disabled={!projectId} onClick={openCreateDrawer}>
          新建 GitLab 连接
        </Button>
      </div>

      {!projectId ? <Alert showIcon type="info" title="请先选择项目" className="base-services-integration-alert" /> : null}
      {connectionsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(connectionsQuery.error)} className="base-services-integration-alert" /> : null}

      <div className="base-services-connection-shell">
        {connections.some((item) => item.status === 'auth_failed') ? (
          <Alert showIcon type="warning" className="base-services-integration-alert" title="存在验证失败的 GitLab 连接" description="请检查 GitLab 地址或 Token，并使用“重新验证”或“编辑”更新连接配置。" />
        ) : null}

        <div className="table-body-scroll sprint-card-scroll base-services-card-scroll">
          {connectionsQuery.isLoading ? (
            <div className="sprint-card-loading"><Empty description="GitLab 连接加载中..." image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
          ) : connections.length === 0 ? (
            <div className="base-services-empty-card base-services-empty-card-list">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<div className="base-services-empty-copy"><Title level={5}>还没有 GitLab 连接</Title><Text>创建连接后，可在这里查看连接状态并管理仓库相关配置。</Text></div>}>
                <Button type="primary" disabled={!projectId} onClick={openCreateDrawer}>新建 GitLab 连接</Button>
              </Empty>
            </div>
          ) : (
            <div className="api-collection-grid base-services-connection-grid">
              {pagedConnections.map((connection) => {
                const statusMeta = getConnectionStatusMeta(connection.status)
                const loadingReauth = reauthMutation.isPending && reauthMutation.variables === connection.connectionId
                const loadingDelete = deleteMutation.isPending && deleteMutation.variables === connection.connectionId
                return (
                  <Card key={connection.connectionId} className="sprint-card api-collection-card base-services-connection-card" styles={{ body: { padding: 20 } }}>
                    <div className="api-collection-card-top base-services-connection-head">
                      <Space size={10} className="base-services-connection-title-wrap"><Badge status={statusMeta.badgeStatus} /><Text strong className="base-services-connection-title">{connection.name}</Text></Space>
                      <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                    </div>
                    <Paragraph className="api-collection-description base-services-connection-url">{connection.baseUrl || '暂无 GitLab 地址'}</Paragraph>
                    <div className="sprint-card-meta"><span className="sprint-card-label">Token</span><span className="api-collection-inline-value">{connection.hasAccessToken ? '已配置' : '未配置'}</span></div>
                    <div className="sprint-card-meta"><span className="sprint-card-label">最近验证</span><span className="api-collection-inline-value">{formatTime(connection.lastAuthAt)}</span></div>
                    <div className="sprint-card-meta"><span className="sprint-card-label">更新时间</span><span className="api-collection-inline-value">{formatTime(connection.updatedAt)}</span></div>
                    <div className="sprint-card-actions base-services-connection-actions">
                      <Tooltip title="查看详情"><Button type="text" shape="circle" className="action-btn-read" icon={<EyeOutlined />} aria-label="查看详情" onClick={() => { setDetailConnectionId(connection.connectionId); setDetailOpen(true) }} /></Tooltip>
                      <Tooltip title="重新验证"><Button type="text" shape="circle" className={connection.status === 'auth_failed' ? 'action-btn-delete' : 'action-btn-save'} icon={<ReloadOutlined />} aria-label="重新验证" loading={loadingReauth} onClick={() => reauthMutation.mutate(connection.connectionId)} /></Tooltip>
                      <Tooltip title="编辑"><Button type="text" shape="circle" className="action-btn-update" icon={<EditOutlined />} aria-label="编辑 GitLab 连接" onClick={() => openEditDrawer(connection)} /></Tooltip>
                      <Popconfirm title="确认删除该 GitLab 连接？" description="删除后将无法继续使用该连接访问 GitLab。" onConfirm={() => deleteMutation.mutate(connection.connectionId)}>
                        <Tooltip title="删除"><Button danger type="text" shape="circle" className="action-btn-delete" icon={<DeleteOutlined />} aria-label="删除 GitLab 连接" loading={loadingDelete} /></Tooltip>
                      </Popconfirm>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <div className="table-footer">
          <Text type="secondary">{footerRange(connections.length, page, pageSize)}</Text>
          <Pagination current={page} pageSize={pageSize} total={connections.length} showSizeChanger pageSizeOptions={['18', '24', '30', '36', '48', '60']} onChange={(nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize) }} />
        </div>
      </div>

      <GitlabConnectionDrawer title={editingConnection ? '编辑 GitLab 连接' : '新建 GitLab 连接'} open={drawerOpen} form={form} loading={saveMutation.isPending} error={saveMutation.error} mode={editingConnection ? 'edit' : 'create'} hasAccessToken={editingConnection?.hasAccessToken} onClose={() => { setDrawerOpen(false); setEditingConnection(null); form.resetFields() }} onFinish={(values) => saveMutation.mutate(values)} />
      <GitlabConnectionDetailDrawer open={detailOpen} loading={detailQuery.isLoading} error={detailQuery.error} connection={detailQuery.data} onClose={() => { setDetailOpen(false); setDetailConnectionId('') }} />
    </>
  )
}
