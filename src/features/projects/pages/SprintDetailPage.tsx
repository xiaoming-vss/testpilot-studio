import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Form, Row, Space, Spin, Tooltip, message, Tag, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { SprintDrawer, type SprintFormValues } from '@/features/projects/components/SprintDrawer'
import { sprintBugOverviewMock, sprintTestOverviewMock } from '@/features/projects/config/sprintOverviewMock'
import { api } from '@/services/api'
import { SectionHeader } from '@/shared/components/PageFrame/PageFrame'
import { formatTime, getErrorMessage, pickEndTime, pickStartTime, statusTag } from '@/utils/format'
import { buildSprintUpdatePayload } from '@/utils/updatePayload'

const { Text, Title, Paragraph } = Typography

function toPickerValue(value?: string) {
  if (!value) return undefined
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : undefined
}

function renderProjectTime(value?: string) {
  return formatTime(value)
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="sprint-overview-summary-metric">
      <span className="sprint-overview-summary-label">{label}</span>
      <strong className="sprint-overview-summary-value">{value}</strong>
    </div>
  )
}

function DetailMetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="sprint-overview-meta-item">
      <span className="sprint-overview-meta-label">{label}</span>
      <span className="sprint-overview-meta-value">{value}</span>
    </div>
  )
}

function MetricPill({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return (
    <div className={`sprint-overview-pill sprint-overview-pill-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function OverviewCard({
  title,
  value,
  accent,
  pills,
}: {
  title: string
  value: number
  accent: string
  pills: Array<{ label: string; value: number; tone?: 'default' | 'success' | 'warning' | 'danger' }>
}) {
  return (
    <Card className="sprint-overview-card sprint-overview-card-rich">
      <div className="sprint-overview-card-top">
        <div>
          <Text className="sprint-overview-card-label">{title}</Text>
          <Title level={3} className="sprint-overview-card-value">
            {value}
          </Title>
        </div>
        <Tag className="sprint-overview-accent-tag">{accent}</Tag>
      </div>
      <div className="sprint-overview-pill-grid">
        {pills.map((pill) => (
          <MetricPill key={pill.label} label={pill.label} value={pill.value} tone={pill.tone} />
        ))}
      </div>
    </Card>
  )
}

export function SprintDetailPage() {
  const { projectId = '', sprintId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sprintOpen, setSprintOpen] = useState(false)
  const [sprintForm] = Form.useForm<SprintFormValues>()

  const sprintQuery = useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: () => api.getSprint(sprintId),
    enabled: Boolean(sprintId),
  })

  const updateSprintMutation = useMutation({
    mutationFn: (values: SprintFormValues) => api.updateSprint(sprintId, buildSprintUpdatePayload(sprintQuery.data!, values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] })
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
      message.success('迭代已更新')
      setSprintOpen(false)
    },
  })

  useEffect(() => {
    if (sprintQuery.data) {
      sprintForm.setFieldsValue({
        ...sprintQuery.data,
        startTime: toPickerValue(pickStartTime(sprintQuery.data)),
        endTime: toPickerValue(pickEndTime(sprintQuery.data)),
      })
    }
  }, [sprintForm, sprintQuery.data])

  const sprintName = sprintQuery.data?.name ?? '迭代详情'
  const sprintDescription = sprintQuery.data?.description || '当前迭代暂无描述，可在这里快速查看测试与缺陷整体情况。'

  return (
    <div className="workbench-page sprint-overview-page">
      {sprintQuery.isLoading ? (
        <div className="workbench-tabs">
          <section className="workbench-panel sprint-overview-panel sprint-overview-panel-unified sprint-overview-state-panel">
            <Spin />
          </section>
        </div>
      ) : sprintQuery.data ? (
        <>
          <section className="workbench-project-toolbar sprint-overview-toolbar">
            <div className="sprint-overview-toolbar-summary-row">
              <div className="sprint-overview-toolbar-main">
                <div className="sprint-overview-hero-title-row">
                  <Space size={10} wrap>
                    <Tooltip title="返回项目总览">
                      <Button
                        type="text"
                        shape="circle"
                        className="action-btn-read"
                        icon={<ArrowLeftOutlined />}
                        aria-label="返回项目总览"
                        onClick={() => navigate('/projects')}
                      />
                    </Tooltip>
                    <Title level={3} className="sprint-overview-hero-title">
                      {sprintName}
                    </Title>
                    <div className="sprint-overview-hero-status">{statusTag(sprintQuery.data.status)}</div>
                  </Space>
                </div>
              </div>
              <div className="sprint-overview-hero-summary">
                <SummaryMetric label="总用例数" value={sprintTestOverviewMock.totalCases} />
                <SummaryMetric label="Bug 总数" value={sprintBugOverviewMock.total} />
              </div>
            </div>
            <div className="sprint-overview-toolbar-hover-body">
              <div className="sprint-overview-hero-copy">
                <Paragraph className="sprint-overview-hero-desc">{sprintDescription}</Paragraph>
                <div className="sprint-overview-meta-grid">
                  <DetailMetaItem label="开始时间" value={renderProjectTime(pickStartTime(sprintQuery.data))} />
                  <DetailMetaItem label="结束时间" value={renderProjectTime(pickEndTime(sprintQuery.data))} />
                </div>
              </div>
              <div className="sprint-overview-floating-actions">
                <Tooltip title="编辑迭代">
                  <Button
                    type="text"
                    shape="circle"
                    className="action-btn-update"
                    icon={<EditOutlined />}
                    aria-label="编辑迭代"
                    onClick={() => setSprintOpen(true)}
                  />
                </Tooltip>
              </div>
            </div>
          </section>

          <div className="workbench-tabs">
            {sprintQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintQuery.error)} /> : null}

            <section className="workbench-panel sprint-overview-panel sprint-overview-panel-unified">
              <div className="sprint-overview-panel-body">
                <div className="sprint-overview-layout">
                  <div className="sprint-overview-section">
                    <SectionHeader title="测试概览" description="按汇总口径展示当前迭代下三类测试资产的执行情况。" />
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} xl={8}>
                        <OverviewCard
                          title="功能测试"
                          value={sprintTestOverviewMock.functional.total}
                          accent="Functional"
                          pills={[
                            { label: '已执行', value: sprintTestOverviewMock.functional.executed, tone: 'success' },
                            { label: '未执行', value: sprintTestOverviewMock.functional.unexecuted, tone: 'warning' },
                            { label: '成功', value: sprintTestOverviewMock.functional.success, tone: 'success' },
                            { label: '失败', value: sprintTestOverviewMock.functional.failed, tone: 'danger' },
                          ]}
                        />
                      </Col>
                      <Col xs={24} sm={12} xl={8}>
                        <OverviewCard
                          title="API 测试"
                          value={sprintTestOverviewMock.api.total}
                          accent="API"
                          pills={[
                            { label: '已执行', value: sprintTestOverviewMock.api.executed, tone: 'success' },
                            { label: '未执行', value: sprintTestOverviewMock.api.unexecuted, tone: 'warning' },
                            { label: '成功', value: sprintTestOverviewMock.api.success, tone: 'success' },
                            { label: '失败', value: sprintTestOverviewMock.api.failed, tone: 'danger' },
                          ]}
                        />
                      </Col>
                      <Col xs={24} sm={12} xl={8}>
                        <OverviewCard
                          title="UI 测试"
                          value={sprintTestOverviewMock.ui.total}
                          accent="UI"
                          pills={[
                            { label: '已执行', value: sprintTestOverviewMock.ui.executed, tone: 'success' },
                            { label: '未执行', value: sprintTestOverviewMock.ui.unexecuted, tone: 'warning' },
                            { label: '成功', value: sprintTestOverviewMock.ui.success, tone: 'success' },
                            { label: '失败', value: sprintTestOverviewMock.ui.failed, tone: 'danger' },
                          ]}
                        />
                      </Col>
                    </Row>
                  </div>

                  <div className="sprint-overview-section">
                    <SectionHeader title="缺陷概览" description="按汇总口径展示当前迭代下的缺陷严重程度与解决状态。" />
                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={10}>
                        <Card className="sprint-overview-card sprint-overview-card-rich">
                          <div className="sprint-overview-card-top">
                            <div>
                              <Text className="sprint-overview-card-label">Bug 总数</Text>
                              <Title level={3} className="sprint-overview-card-value">
                                {sprintBugOverviewMock.total}
                              </Title>
                            </div>
                            <Tag className="sprint-overview-accent-tag">Defects</Tag>
                          </div>
                          <div className="sprint-overview-pill-grid">
                            <MetricPill label="已解决" value={sprintBugOverviewMock.resolved} tone="success" />
                            <MetricPill label="未解决" value={sprintBugOverviewMock.unresolved} tone="danger" />
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} xl={14}>
                        <Card className="sprint-overview-card sprint-overview-card-rich">
                          <div className="sprint-overview-card-top">
                            <div>
                              <Text className="sprint-overview-card-label">严重程度分布</Text>
                              <Title level={4} className="sprint-overview-card-subtitle">
                                缺陷风险画像
                              </Title>
                            </div>
                          </div>
                          <div className="sprint-overview-pill-grid sprint-overview-pill-grid-quad">
                            <MetricPill label="致命" value={sprintBugOverviewMock.fatal} tone="danger" />
                            <MetricPill label="严重" value={sprintBugOverviewMock.severe} tone="warning" />
                            <MetricPill label="一般" value={sprintBugOverviewMock.normal} tone="default" />
                            <MetricPill label="提示" value={sprintBugOverviewMock.hint} tone="default" />
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="workbench-tabs">
          {sprintQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintQuery.error)} /> : null}
          <section className="workbench-panel sprint-overview-panel sprint-overview-panel-unified sprint-overview-state-panel">
            <Empty description="未找到迭代信息" />
          </section>
        </div>
      )}

      <SprintDrawer
        title="编辑迭代"
        open={sprintOpen}
        form={sprintForm}
        loading={updateSprintMutation.isPending}
        error={updateSprintMutation.error}
        onClose={() => setSprintOpen(false)}
        mode="edit"
        onFinish={(values) => updateSprintMutation.mutate(values)}
      />
    </div>
  )
}
