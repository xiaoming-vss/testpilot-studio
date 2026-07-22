import { LinkOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Modal, Radio, Space, Spin, Switch, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/format'

const { Text } = Typography

export function LlmConnectionSelectModal({
  open,
  onClose,
  onConfirm,
  loading,
  showCheckpointOption = false,
  checkpointEnabled = false,
  onCheckpointEnabledChange,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (connectionId: string) => void
  loading?: boolean
  showCheckpointOption?: boolean
  checkpointEnabled?: boolean
  onCheckpointEnabledChange?: (enabled: boolean) => void
}) {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string>('')

  const connectionsQuery = useQuery({
    queryKey: ['llmConnections', 'select'],
    queryFn: () => api.getLlmConnections(),
    enabled: open,
  })

  const activeConnections = useMemo(
    () => (connectionsQuery.data ?? []).filter((conn) => conn.status === 'active'),
    [connectionsQuery.data],
  )

  function handleConfirm() {
    if (!selectedId) return
    onConfirm(selectedId)
  }

  function handleClose() {
    setSelectedId('')
    onCheckpointEnabledChange?.(false)
    onClose()
  }

  function handleGoToConfig() {
    handleClose()
    navigate('/base-services?tab=llm')
  }

  return (
    <Modal
      title="选择 LLM 模型"
      open={open}
      onCancel={handleClose}
      width={480}
      destroyOnHidden
      afterClose={() => setSelectedId('')}
      footer={
        <Space>
          <Button onClick={handleClose}>取消</Button>
          <Button
            type="primary"
            disabled={!selectedId}
            loading={loading}
            onClick={handleConfirm}
          >
            确认运行
          </Button>
        </Space>
      }
    >
      {connectionsQuery.isLoading ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Spin />
        </div>
      ) : connectionsQuery.error ? (
        <Alert showIcon type="error" title={getErrorMessage(connectionsQuery.error)} />
      ) : activeConnections.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Text>暂无可用的 LLM 连接</Text>
              <Text type="secondary">请先前往基础设施页面配置 LLM 连接。</Text>
            </div>
          }
        >
          <Button type="primary" icon={<LinkOutlined />} onClick={handleGoToConfig}>
            去配置
          </Button>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text type="secondary">请选择一个 LLM 连接用于本次任务执行：</Text>
          <Radio.Group
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ width: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeConnections.map((conn) => (
                <Radio
                  key={conn.connectionId}
                  value={conn.connectionId}
                  style={{
                    padding: '12px 16px',
                    border: '1px solid var(--tp-border-soft, rgba(148, 163, 184, 0.18))',
                    borderRadius: 8,
                    margin: 0,
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong>{conn.name}</Text>
                    {conn.modelId ? <Tag>{conn.modelId}</Tag> : null}
                  </div>
                </Radio>
              ))}
            </div>
          </Radio.Group>
          {showCheckpointOption ? (
            <div
              style={{
                padding: '12px 14px',
                border: '1px solid var(--tp-border-soft, rgba(148, 163, 184, 0.18))',
                borderRadius: 10,
                background: 'var(--tp-surface-soft, rgba(148, 163, 184, 0.06))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Text strong>开启阶段卡点审核</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  开启后每个生成阶段会暂停，可编辑确认后再继续。
                </Text>
              </div>
              <Switch checked={checkpointEnabled} onChange={onCheckpointEnabledChange} />
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  )
}
