import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Row, Space, Spin, Tooltip, Tag, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs from 'dayjs'
import { api, type SprintDailyMetricsSnapshot, type SprintDailyMetricsTestStats } from '@/services/api'
import { SectionHeader } from '@/shared/components/PageFrame/PageFrame'
import { message } from '@/shared/utils/feedback'
import { getErrorMessage, statusTag } from '@/utils/format'

const { Text, Title } = Typography

function numberValue(...values: Array<number | undefined>) {
  return values.find((value) => typeof value === 'number' && Number.isFinite(value)) ?? 0
}

function snapshotDate(snapshot?: SprintDailyMetricsSnapshot) {
  return snapshot?.snapshotDate ?? snapshot?.snapshot_date ?? snapshot?.date ?? '-'
}

function pickTestStats(
  snapshot: SprintDailyMetricsSnapshot | undefined,
  keys: Array<keyof SprintDailyMetricsSnapshot>,
): Required<SprintDailyMetricsTestStats> {
  const stats = keys.map((key) => snapshot?.[key]).find((value): value is SprintDailyMetricsTestStats => Boolean(value))
  return {
    total: numberValue(stats?.total),
    executed: numberValue(stats?.executed),
    pending: numberValue(stats?.pending, stats?.unexecuted),
    unexecuted: numberValue(stats?.unexecuted, stats?.pending),
    success: numberValue(stats?.success, stats?.passed),
    failed: numberValue(stats?.failed),
    passed: numberValue(stats?.passed, stats?.success),
  }
}

function normalizeDailyMetrics(snapshot?: SprintDailyMetricsSnapshot) {
  const functional = pickTestStats(snapshot, ['functional', 'function', 'functionTesting', 'function_testing'])
  const apiStats = pickTestStats(snapshot, ['api'])
  const uiStats = pickTestStats(snapshot, ['ui'])
  const bugStats = snapshot?.bug ?? snapshot?.bugs

  return {
    snapshotDate: snapshotDate(snapshot),
    totalCases: numberValue(
      snapshot?.totalCases,
      snapshot?.total_cases,
      functional.total + apiStats.total + uiStats.total,
    ),
    functional: {
      total: numberValue(snapshot?.functionTotal, snapshot?.function_total, functional.total),
      executed: functional.executed,
      unexecuted: functional.pending,
      success: functional.success,
      failed: functional.failed,
    },
    api: {
      total: numberValue(snapshot?.apiTotal, snapshot?.api_total, apiStats.total),
      executed: apiStats.executed,
      unexecuted: apiStats.pending,
      success: apiStats.success,
      failed: apiStats.failed,
    },
    ui: {
      total: numberValue(snapshot?.uiTotal, snapshot?.ui_total, uiStats.total),
      executed: uiStats.executed,
      unexecuted: uiStats.pending,
      success: uiStats.success,
      failed: uiStats.failed,
    },
    bug: {
      total: numberValue(snapshot?.bugTotal, snapshot?.bug_total, bugStats?.total),
      resolved: numberValue(snapshot?.bugResolved, snapshot?.bug_resolved, bugStats?.resolved),
      unresolved: numberValue(snapshot?.bugUnresolved, snapshot?.bug_unresolved, bugStats?.unresolved),
      fatal: numberValue(snapshot?.bugFatal, snapshot?.bug_fatal, bugStats?.fatal),
      severe: numberValue(snapshot?.bugSevere, snapshot?.bug_severe, bugStats?.serious, bugStats?.severe),
      normal: numberValue(snapshot?.bugNormal, snapshot?.bug_normal, bugStats?.normal),
      hint: numberValue(snapshot?.bugHint, snapshot?.bug_hint, bugStats?.suggestion, bugStats?.hint),
    },
  }
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="sprint-overview-summary-metric">
      <span className="sprint-overview-summary-label">{label}</span>
      <strong className="sprint-overview-summary-value">{value}</strong>
    </div>
  )
}

type TestOverviewStats = {
  total: number
  executed: number
  unexecuted: number
  success: number
  failed: number
}

function TestOverviewChartCard({
  title,
  accent,
  stats,
}: {
  title: string
  accent: string
  stats: TestOverviewStats
}) {
  const chartData = [
    { name: '已执行', value: stats.executed, fill: '#52c41a' },
    { name: '未执行', value: stats.unexecuted, fill: '#faad14' },
    { name: '成功', value: stats.success, fill: '#13c2c2' },
    { name: '失败', value: stats.failed, fill: '#ff4d4f' },
  ]

  return (
    <Card className="sprint-overview-card sprint-overview-card-rich">
      <div className="sprint-overview-card-top">
        <div>
          <Text className="sprint-overview-card-label">{title}</Text>
          <Title level={3} className="sprint-overview-card-value">
            {stats.total}
          </Title>
        </div>
        <Tag className="sprint-overview-accent-tag">{accent}</Tag>
      </div>
      <div className="sprint-overview-bar-summary">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#edf1f7" horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#7b8395', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#5a6170', fontSize: 12 }} width={48} />
            <RechartsTooltip />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={14}>
              {chartData.map((item) => (
                <Cell key={item.name} fill={item.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function BugResolutionChartCard({ bug }: { bug: NormalizedDailyMetrics['bug'] }) {
  const chartData = [
    { name: '已解决', value: bug.resolved, color: '#52c41a' },
    { name: '未解决', value: bug.unresolved, color: '#ff4d4f' },
  ].filter((item) => item.value > 0)
  const metricData = [
    { name: '已解决', value: bug.resolved, color: '#52c41a' },
    { name: '未解决', value: bug.unresolved, color: '#ff4d4f' },
  ]

  return (
    <Card className="sprint-overview-card sprint-overview-card-rich">
      <div className="sprint-overview-card-top">
        <div>
          <Text className="sprint-overview-card-label">Bug 总数</Text>
          <Title level={3} className="sprint-overview-card-value">
            {bug.total}
          </Title>
        </div>
        <Tag className="sprint-overview-accent-tag">Defects</Tag>
      </div>
      <div className="sprint-overview-donut-layout">
        <div className="sprint-overview-mini-chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData.length ? chartData : [{ name: '暂无数据', value: 1, color: '#e8edf5' }]} dataKey="value" innerRadius="62%" outerRadius="86%" paddingAngle={4}>
                {(chartData.length ? chartData : [{ color: '#e8edf5' }]).map((item) => (
                  <Cell key={item.color} fill={item.color} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="sprint-overview-donut-center">{bug.total}</div>
        </div>
        <div className="sprint-overview-chart-metrics">
          {metricData.map((item) => (
            <span key={item.name} style={{ '--metric-color': item.color } as CSSProperties}>
              {item.name}
              <strong>{item.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}

function BugSeverityBarCard({ bug }: { bug: NormalizedDailyMetrics['bug'] }) {
  const chartData = [
    { name: '致命', value: bug.fatal, fill: '#ff4d4f' },
    { name: '严重', value: bug.severe, fill: '#faad14' },
    { name: '一般', value: bug.normal, fill: '#8b9bb4' },
    { name: '提示', value: bug.hint, fill: '#91a3bd' },
  ]

  return (
    <Card className="sprint-overview-card sprint-overview-card-rich">
      <div className="sprint-overview-card-top">
        <div>
          <Text className="sprint-overview-card-label">严重程度分布</Text>
          <Title level={4} className="sprint-overview-card-subtitle">
            缺陷风险画像
          </Title>
        </div>
      </div>
      <div className="sprint-overview-severity-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#edf1f7" horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: '#7b8395', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#5a6170', fontSize: 12 }} width={42} />
            <RechartsTooltip />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>
              {chartData.map((item) => (
                <Cell key={item.name} fill={item.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

type NormalizedDailyMetrics = ReturnType<typeof normalizeDailyMetrics>

function TrendLineChart({ data }: { data: NormalizedDailyMetrics[] }) {
  const chartData = data.map((item) => ({
    date: dayjs(item.snapshotDate).isValid() ? dayjs(item.snapshotDate).format('MM-DD') : item.snapshotDate,
    total: item.totalCases,
    executed: item.functional.executed + item.api.executed + item.ui.executed,
    pending: item.functional.unexecuted + item.api.unexecuted + item.ui.unexecuted,
    success: item.functional.success + item.api.success + item.ui.success,
    failed: item.functional.failed + item.api.failed + item.ui.failed,
  }))

  return (
    <div className="sprint-overview-chart-host">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 18, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#edf1f7" vertical={false} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#7b8395', fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7b8395', fontSize: 12 }} allowDecimals={false} />
          <RechartsTooltip />
          <Legend verticalAlign="bottom" height={32} iconType="circle" />
          <Line name="总数" type="monotone" dataKey="total" stroke="#1677ff" strokeWidth={2.4} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line name="已执行" type="monotone" dataKey="executed" stroke="#52c41a" strokeWidth={2.2} dot={{ r: 3 }} />
          <Line name="未执行" type="monotone" dataKey="pending" stroke="#faad14" strokeWidth={2.2} dot={{ r: 3 }} />
          <Line name="成功" type="monotone" dataKey="success" stroke="#13c2c2" strokeWidth={2.2} dot={{ r: 3 }} />
          <Line name="失败" type="monotone" dataKey="failed" stroke="#ff4d4f" strokeWidth={2.2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function TrendBarChart({ data }: { data: NormalizedDailyMetrics[] }) {
  const chartData = data.map((item) => ({
    date: dayjs(item.snapshotDate).isValid() ? dayjs(item.snapshotDate).format('MM-DD') : item.snapshotDate,
    total: item.bug.total,
    resolved: item.bug.resolved,
    unresolved: item.bug.unresolved,
  }))

  return (
    <div className="sprint-overview-chart-host">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 18, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#edf1f7" vertical={false} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#7b8395', fontSize: 12 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7b8395', fontSize: 12 }} allowDecimals={false} />
          <RechartsTooltip />
          <Legend verticalAlign="bottom" height={32} iconType="circle" />
          <Line name="Bug 总数" type="monotone" dataKey="total" stroke="#1677ff" strokeWidth={2.4} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line name="已解决" type="monotone" dataKey="resolved" stroke="#52c41a" strokeWidth={2.2} dot={{ r: 3 }} />
          <Line name="未解决" type="monotone" dataKey="unresolved" stroke="#ff4d4f" strokeWidth={2.2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SprintDetailPage() {
  const { sprintId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const sprintQuery = useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: () => api.getSprint(sprintId),
    enabled: Boolean(sprintId),
  })
  const metricsRange = useMemo(() => {
    const endDate = dayjs().format('YYYY-MM-DD')
    const startDate = dayjs().subtract(13, 'day').format('YYYY-MM-DD')
    return { startDate, endDate }
  }, [])
  const todayDate = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const currentMetricsQuery = useQuery({
    queryKey: ['sprintDailyMetricsByDate', sprintId, todayDate],
    queryFn: () => api.getSprintDailyMetricsByDate(sprintId, todayDate),
    enabled: Boolean(sprintId),
  })
  const historyMetricsQuery = useQuery({
    queryKey: ['sprintDailyMetrics', sprintId, metricsRange.startDate, metricsRange.endDate],
    queryFn: () => api.getSprintDailyMetrics(sprintId, metricsRange),
    enabled: Boolean(sprintId),
  })

  const generateMetricsMutation = useMutation({
    mutationFn: () => api.generateSprintDailyMetrics(sprintId, todayDate),
    onSuccess: () => {
      message.success('已生成最新统计快照')
      queryClient.invalidateQueries({ queryKey: ['sprintDailyMetricsByDate', sprintId, todayDate] })
      queryClient.invalidateQueries({ queryKey: ['sprintDailyMetrics', sprintId] })
    },
  })

  const sprintName = sprintQuery.data?.name ?? '迭代详情'
  const latestMetrics = normalizeDailyMetrics(currentMetricsQuery.data)
  const historyMetrics = (historyMetricsQuery.data ?? []).map(normalizeDailyMetrics)

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
                <SummaryMetric label="总用例数" value={latestMetrics.totalCases} />
                <SummaryMetric label="Bug 总数" value={latestMetrics.bug.total} />
                <Tooltip title="更新数据">
                  <Button
                    type="primary"
                    shape="circle"
                    className="action-btn-read sprint-overview-refresh-button"
                    icon={<ReloadOutlined />}
                    loading={generateMetricsMutation.isPending}
                    aria-label="更新数据"
                    onClick={() => generateMetricsMutation.mutate()}
                  />
                </Tooltip>
              </div>
            </div>
          </section>

          <div className="workbench-tabs">
            {sprintQuery.error ? <Alert showIcon type="error" title={getErrorMessage(sprintQuery.error)} /> : null}
            {currentMetricsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(currentMetricsQuery.error)} /> : null}
            {historyMetricsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(historyMetricsQuery.error)} /> : null}
            {generateMetricsMutation.error ? <Alert showIcon type="error" title={getErrorMessage(generateMetricsMutation.error)} /> : null}

            <section className="workbench-panel sprint-overview-panel sprint-overview-panel-unified">
              <div className="sprint-overview-panel-body">
                <div className="sprint-overview-layout">
                  <div className="sprint-overview-section">
                    <SectionHeader title="测试概览" description="按汇总口径展示当前迭代下三类测试资产的执行情况。" />
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} xl={8}>
                        <TestOverviewChartCard title="功能测试" accent="Functional" stats={latestMetrics.functional} />
                      </Col>
                      <Col xs={24} sm={12} xl={8}>
                        <TestOverviewChartCard title="API 测试" accent="API" stats={latestMetrics.api} />
                      </Col>
                      <Col xs={24} sm={12} xl={8}>
                        <TestOverviewChartCard title="UI 测试" accent="UI" stats={latestMetrics.ui} />
                      </Col>
                    </Row>
                  </div>

                  <div className="sprint-overview-section">
                    <SectionHeader title="缺陷概览" description="按汇总口径展示当前迭代下的缺陷严重程度与解决状态。" />
                    <Row gutter={[16, 16]}>
                      <Col xs={24} xl={10}>
                        <BugResolutionChartCard bug={latestMetrics.bug} />
                      </Col>
                      <Col xs={24} xl={14}>
                        <BugSeverityBarCard bug={latestMetrics.bug} />
                      </Col>
                    </Row>
                  </div>

                  <div className="sprint-overview-section">
                    <div className="sprint-overview-trend-head">
                      <SectionHeader
                        title="趋势历史"
                        description={`${metricsRange.startDate} 至 ${metricsRange.endDate}，读取服务端已归档快照。`}
                      />
                    </div>
                    {historyMetricsQuery.isLoading ? (
                      <Card className="sprint-overview-card sprint-overview-card-rich sprint-overview-history-state">
                        <Spin />
                      </Card>
                    ) : historyMetrics.length === 0 ? (
                      <Card className="sprint-overview-card sprint-overview-card-rich">
                        <Empty description="暂无历史快照" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      </Card>
                    ) : (
                      <div className="sprint-overview-trend-grid">
                        <Card className="sprint-overview-card sprint-overview-card-rich sprint-overview-chart-card">
                          <div className="sprint-overview-chart-card-head">
                            <div>
                              <Text className="sprint-overview-card-label">用例总数趋势</Text>
                              <Title level={4} className="sprint-overview-card-subtitle">
                                {historyMetrics[historyMetrics.length - 1]?.totalCases ?? 0}
                              </Title>
                            </div>
                            <Tag className="sprint-overview-accent-tag">Cases</Tag>
                          </div>
                          <TrendLineChart data={historyMetrics} />
                        </Card>
                        <Card className="sprint-overview-card sprint-overview-card-rich sprint-overview-chart-card">
                          <div className="sprint-overview-chart-card-head">
                            <div>
                              <Text className="sprint-overview-card-label">Bug 解决趋势</Text>
                              <Title level={4} className="sprint-overview-card-subtitle">
                                {historyMetrics[historyMetrics.length - 1]?.bug.total ?? 0}
                              </Title>
                            </div>
                            <Tag className="sprint-overview-accent-tag">Bugs</Tag>
                          </div>
                          <TrendBarChart data={historyMetrics} />
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="workbench-tabs">
          {sprintQuery.error ? <Alert showIcon type="error" title={getErrorMessage(sprintQuery.error)} /> : null}
          <section className="workbench-panel sprint-overview-panel sprint-overview-panel-unified sprint-overview-state-panel">
            <Empty description="未找到迭代信息" />
          </section>
        </div>
      )}

    </div>
  )
}
