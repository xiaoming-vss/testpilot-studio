import { ArrowLeftOutlined, CaretRightOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined, DownOutlined, EditOutlined, FullscreenOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Popover, Spin, Tabs, Tag, Tooltip, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FunctionalCaseGenerateTaskDrawer, type FunctionalCaseGenerateTaskFormValues } from '../components/FunctionalCaseGenerateTaskDrawer'
import { LlmConnectionSelectModal } from '../components/LlmConnectionSelectModal'
import type { FunctionalCaseGenerateTask, FunctionalCaseGenerateTaskRun } from '../types'
import { getApiCaseGenerateTaskRunStatusMeta, isApiCaseGenerateTaskRunInProgress, isRunnableApiCaseGenerateTaskRun } from '../utils/taskStatus'
import { JsonEditor } from '@/shared/components/JsonEditor/JsonEditor'
import '@/features/ai-testing/styles/index.css'
import { api } from '@/services/api'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId, pickUpdatedAt } from '@/utils/format'

const runResultSectionDefinitions = [
  { key: 'configJson', label: '中间配置' },
  { key: 'resultYaml', label: '结果' },
  { key: 'errorMessage', label: '错误信息' },
] as const

const configJsonTabDefinitions = [
  { key: 'enhancedText', label: '增强文本' },
  { key: 'requirementAnalysis', label: '需求分析' },
  { key: 'caseNames', label: '测试点' },
] as const

type CaseNamesViewMode = 'json' | 'tree'

type ConfigJsonTab = {
  key: string
  label: string
  content: string
}

type CaseNameTreeNode = {
  id: string
  title: string
  children: CaseNameTreeNode[]
}

type ExpandedRunResult =
  | {
      title: string
      content: string
      type?: 'content'
    }
  | {
      type: 'config'
      title: string
      tabs: ConfigJsonTab[]
      activeTabKey: string
      activeCaseNamesView?: CaseNamesViewMode
    }

const reviewStatusMetaMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已丢弃', color: 'default' },
}

function formatStructuredContent(value?: unknown) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function parseConfigJsonTabs(content?: string): ConfigJsonTab[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []

    return configJsonTabDefinitions
      .map((definition) => {
        const value = (parsed as Record<string, unknown>)[definition.key]
        return {
          ...definition,
          content: formatStructuredContent(value),
        }
      })
      .filter((item) => item.content)
  } catch {
    return []
  }
}

function isJsonText(content?: string) {
  if (!content?.trim()) return false
  try {
    JSON.parse(content)
    return true
  } catch {
    return false
  }
}

function toDisplayText(value: unknown) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    const namedValue = record.case_name ?? record.test_point ?? record.name ?? record.title
    if (namedValue !== undefined && namedValue !== null && namedValue !== '') return toDisplayText(namedValue)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(toDisplayText).filter(Boolean)
  }
  const text = toDisplayText(value)
  return text ? [text] : []
}

function parseCaseNameRows(value: unknown, inheritedModel = '', inheritedTestModel = ''): Array<{ model: string; testModel: string; testPoints: string[] }> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseCaseNameRows(item, inheritedModel, inheritedTestModel))
  }

  if (!value || typeof value !== 'object') {
    const text = toDisplayText(value)
    return text ? [{ model: inheritedModel || '未分组模块', testModel: inheritedTestModel || '未分组场景', testPoints: [text] }] : []
  }

  const record = value as Record<string, unknown>
  const model = toDisplayText(record.model) || inheritedModel
  const testModel = toDisplayText(record.test_model) || inheritedTestModel
  const directPoints = toTextList(record.test_points)
  const rows = directPoints.length > 0 ? [{ model: model || '未分组模块', testModel: testModel || '未分组场景', testPoints: directPoints }] : []

  const nestedRows = Object.entries(record)
    .filter(([key]) => key !== 'model' && key !== 'test_model' && key !== 'test_points')
    .flatMap(([key, nestedValue]) => {
      const nextModel = model || key
      const nextTestModel = model ? testModel || key : testModel
      return parseCaseNameRows(nestedValue, nextModel, nextTestModel)
    })

  return [...rows, ...nestedRows]
}

function buildCaseNameTree(content: string, rootTitle: string): CaseNameTreeNode | null {
  if (!content.trim()) return null

  try {
    const parsed = JSON.parse(content)
    const rows = parseCaseNameRows(parsed)
    if (rows.length === 0) return null

    const modelMap = new Map<string, Map<string, string[]>>()
    rows.forEach((row) => {
      const model = row.model || '未分组模块'
      const testModel = row.testModel || '未分组场景'
      const testModelMap = modelMap.get(model) ?? new Map<string, string[]>()
      const points = testModelMap.get(testModel) ?? []
      row.testPoints.forEach((point) => {
        if (point && !points.includes(point)) points.push(point)
      })
      testModelMap.set(testModel, points)
      modelMap.set(model, testModelMap)
    })

    return {
      id: 'root',
      title: rootTitle || '功能测试用例生成',
      children: [...modelMap.entries()].map(([model, testModelMap], modelIndex) => ({
        id: `model-${modelIndex}`,
        title: model,
        children: [...testModelMap.entries()].map(([testModel, testPoints], testModelIndex) => ({
          id: `model-${modelIndex}-test-${testModelIndex}`,
          title: testModel,
          children: testPoints.map((point, pointIndex) => ({
            id: `model-${modelIndex}-test-${testModelIndex}-point-${pointIndex}`,
            title: point,
            children: [],
          })),
        })),
      })),
    }
  } catch {
    return null
  }
}

function countCaseNameTree(tree: CaseNameTreeNode | null) {
  const models = tree?.children.length ?? 0
  const testModels = tree?.children.reduce((sum, model) => sum + model.children.length, 0) ?? 0
  const testPoints = tree?.children.reduce((sum, model) => sum + model.children.reduce((itemSum, testModel) => itemSum + testModel.children.length, 0), 0) ?? 0
  return { models, testModels, testPoints }
}

const CASE_NAME_TREE_NODE_HEIGHT = 38
const CASE_NAME_TREE_ROW_GAP = 14
const CASE_NAME_TREE_POINT_GAP = 10
const CASE_NAME_TREE_CONNECTOR_WIDTH = 86
const CASE_NAME_TREE_IMAGE_PADDING_X = 28
const CASE_NAME_TREE_IMAGE_PADDING_Y = 28
const CASE_NAME_TREE_IMAGE_NODE_WIDTHS = {
  root: 220,
  model: 220,
  testModel: 240,
  point: 360,
}

function getStackHeight(count: number, gap = CASE_NAME_TREE_ROW_GAP) {
  if (count <= 0) return CASE_NAME_TREE_NODE_HEIGHT
  return count * CASE_NAME_TREE_NODE_HEIGHT + (count - 1) * gap
}

function getTestModelHeight(testModel: CaseNameTreeNode) {
  return getStackHeight(testModel.children.length, CASE_NAME_TREE_POINT_GAP)
}

function getModelHeight(model: CaseNameTreeNode) {
  if (model.children.length === 0) return CASE_NAME_TREE_NODE_HEIGHT
  return model.children.reduce((sum, testModel, index) => (
    sum + getTestModelHeight(testModel) + (index === 0 ? 0 : CASE_NAME_TREE_ROW_GAP)
  ), 0)
}

function getTreeHeight(tree: CaseNameTreeNode) {
  if (tree.children.length === 0) return CASE_NAME_TREE_NODE_HEIGHT
  return tree.children.reduce((sum, model, index) => (
    sum + getModelHeight(model) + (index === 0 ? 0 : CASE_NAME_TREE_ROW_GAP)
  ), 0)
}

function getModelTargetYs(tree: CaseNameTreeNode) {
  let cursor = 0
  return tree.children.map((model) => {
    const height = getModelHeight(model)
    const y = cursor + height / 2
    cursor += height + CASE_NAME_TREE_ROW_GAP
    return y
  })
}

function getTestModelTargetYs(model: CaseNameTreeNode) {
  let cursor = 0
  return model.children.map((testModel) => {
    const height = getTestModelHeight(testModel)
    const y = cursor + height / 2
    cursor += height + CASE_NAME_TREE_ROW_GAP
    return y
  })
}

function getPointTargetYs(testModel: CaseNameTreeNode) {
  return testModel.children.map((_, index) => (
    CASE_NAME_TREE_NODE_HEIGHT / 2 + index * (CASE_NAME_TREE_NODE_HEIGHT + CASE_NAME_TREE_POINT_GAP)
  ))
}

function CaseNameTreeCurves({ height, targetYs, tone = 'green' }: { height: number; targetYs: number[]; tone?: 'green' | 'blue' | 'slate' }) {
  const sourceY = height / 2
  const width = CASE_NAME_TREE_CONNECTOR_WIDTH
  const safeHeight = Math.max(height, CASE_NAME_TREE_NODE_HEIGHT)

  return (
    <svg
      className={`ai-case-name-tree-curves ${tone}`}
      width={width}
      height={safeHeight}
      viewBox={`0 0 ${width} ${safeHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {targetYs.map((targetY, index) => {
        const controlOffset = Math.min(42, Math.max(24, Math.abs(targetY - sourceY) * 0.42 + 18))
        const d = `M 2 ${sourceY} C ${controlOffset} ${sourceY}, ${width - controlOffset} ${targetY}, ${width - 2} ${targetY}`
        return <path key={`${targetY}-${index}`} d={d} />
      })}
    </svg>
  )
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncateSvgText(value: string, maxLength: number) {
  const text = value.trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text
}

function renderCaseNameTreeSvgNode({
  x,
  y,
  width,
  text,
  variant,
}: {
  x: number
  y: number
  width: number
  text: string
  variant: 'root' | 'model' | 'testModel' | 'point'
}) {
  const styles = {
    root: {
      fill: '#9fdcbe',
      stroke: 'rgba(52, 168, 130, 0.48)',
      text: '#062f24',
      weight: 700,
      anchor: 'middle',
      textX: x + width / 2,
      maxLength: 18,
    },
    model: {
      fill: '#e7f6ef',
      stroke: 'rgba(52, 168, 130, 0.34)',
      text: '#116149',
      weight: 700,
      anchor: 'middle',
      textX: x + width / 2,
      maxLength: 18,
    },
    testModel: {
      fill: '#e8f5fb',
      stroke: 'rgba(70, 166, 210, 0.32)',
      text: '#1f5d80',
      weight: 700,
      anchor: 'middle',
      textX: x + width / 2,
      maxLength: 20,
    },
    point: {
      fill: '#ffffff',
      stroke: 'rgba(148, 163, 184, 0.26)',
      text: '#334155',
      weight: 600,
      anchor: 'start',
      textX: x + 14,
      maxLength: 28,
    },
  }[variant]

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${CASE_NAME_TREE_NODE_HEIGHT}" rx="12" fill="${styles.fill}" stroke="${styles.stroke}" />
      <text x="${styles.textX}" y="${y + 24}" text-anchor="${styles.anchor}" fill="${styles.text}" font-size="12" font-weight="${styles.weight}">${escapeSvgText(truncateSvgText(text, styles.maxLength))}</text>
    </g>
  `
}

function renderCaseNameTreeSvgCurve({
  sourceX,
  sourceY,
  targetX,
  targetY,
  stroke,
  width = 2,
}: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  stroke: string
  width?: number
}) {
  const distance = targetX - sourceX
  const controlOffset = Math.min(42, Math.max(24, Math.abs(targetY - sourceY) * 0.42 + 18))
  const c1 = sourceX + Math.min(distance * 0.48, controlOffset)
  const c2 = targetX - Math.min(distance * 0.48, controlOffset)
  return `<path d="M ${sourceX} ${sourceY} C ${c1} ${sourceY}, ${c2} ${targetY}, ${targetX} ${targetY}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`
}

function createCaseNameTreeImageSvg(content: string, rootTitle: string) {
  const tree = buildCaseNameTree(content, rootTitle)
  if (!tree) return null

  const treeHeight = getTreeHeight(tree)
  const widths = CASE_NAME_TREE_IMAGE_NODE_WIDTHS
  const rootX = CASE_NAME_TREE_IMAGE_PADDING_X
  const modelX = rootX + widths.root + CASE_NAME_TREE_CONNECTOR_WIDTH
  const testModelX = modelX + widths.model + CASE_NAME_TREE_CONNECTOR_WIDTH
  const pointX = testModelX + widths.testModel + CASE_NAME_TREE_CONNECTOR_WIDTH
  const svgWidth = pointX + widths.point + CASE_NAME_TREE_IMAGE_PADDING_X
  const svgHeight = treeHeight + CASE_NAME_TREE_IMAGE_PADDING_Y * 2
  const rootY = CASE_NAME_TREE_IMAGE_PADDING_Y + (treeHeight - CASE_NAME_TREE_NODE_HEIGHT) / 2
  const nodes: string[] = [
    renderCaseNameTreeSvgNode({ x: rootX, y: rootY, width: widths.root, text: tree.title, variant: 'root' }),
  ]
  const curves: string[] = []
  const rootSourceX = rootX + widths.root
  const rootSourceY = CASE_NAME_TREE_IMAGE_PADDING_Y + treeHeight / 2

  getModelTargetYs(tree).forEach((targetY) => {
    curves.push(renderCaseNameTreeSvgCurve({
      sourceX: rootSourceX,
      sourceY: rootSourceY,
      targetX: modelX,
      targetY: CASE_NAME_TREE_IMAGE_PADDING_Y + targetY,
      stroke: 'rgba(124, 195, 163, 0.78)',
    }))
  })

  let modelTop = CASE_NAME_TREE_IMAGE_PADDING_Y
  tree.children.forEach((model) => {
    const modelHeight = getModelHeight(model)
    const modelY = modelTop + (modelHeight - CASE_NAME_TREE_NODE_HEIGHT) / 2
    nodes.push(renderCaseNameTreeSvgNode({ x: modelX, y: modelY, width: widths.model, text: model.title, variant: 'model' }))

    getTestModelTargetYs(model).forEach((targetY) => {
      curves.push(renderCaseNameTreeSvgCurve({
        sourceX: modelX + widths.model,
        sourceY: modelTop + modelHeight / 2,
        targetX: testModelX,
        targetY: modelTop + targetY,
        stroke: 'rgba(70, 166, 210, 0.64)',
      }))
    })

    let testModelTop = modelTop
    model.children.forEach((testModel) => {
      const testModelHeight = getTestModelHeight(testModel)
      const testModelY = testModelTop + (testModelHeight - CASE_NAME_TREE_NODE_HEIGHT) / 2
      nodes.push(renderCaseNameTreeSvgNode({ x: testModelX, y: testModelY, width: widths.testModel, text: testModel.title, variant: 'testModel' }))

      getPointTargetYs(testModel).forEach((targetY) => {
        curves.push(renderCaseNameTreeSvgCurve({
          sourceX: testModelX + widths.testModel,
          sourceY: testModelTop + testModelHeight / 2,
          targetX: pointX,
          targetY: testModelTop + targetY,
          stroke: 'rgba(100, 116, 139, 0.52)',
          width: 1.8,
        }))
      })

      testModel.children.forEach((point, pointIndex) => {
        const pointY = testModelTop + pointIndex * (CASE_NAME_TREE_NODE_HEIGHT + CASE_NAME_TREE_POINT_GAP)
        nodes.push(renderCaseNameTreeSvgNode({ x: pointX, y: pointY, width: widths.point, text: point.title, variant: 'point' }))
      })

      testModelTop += testModelHeight + CASE_NAME_TREE_ROW_GAP
    })

    modelTop += modelHeight + CASE_NAME_TREE_ROW_GAP
  })

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
      <rect width="100%" height="100%" rx="18" fill="#f8faf9" />
      <circle cx="34" cy="34" r="28" fill="rgba(124, 195, 163, 0.11)" />
      <g font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif">
        ${curves.join('')}
        ${nodes.join('')}
      </g>
    </svg>
  `.trim()

  return { svg, width: svgWidth, height: svgHeight }
}

function triggerDownload(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  triggerDownload(url, fileName)
  URL.revokeObjectURL(url)
}

function downloadSvgAsPng(svg: string, width: number, height: number, fileName: string) {
  return new Promise<void>((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const image = new Image()

    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(width * 2)
      canvas.height = Math.ceil(height * 2)
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(svgUrl)
        reject(new Error('Canvas is not supported'))
        return
      }

      context.scale(2, 2)
      context.drawImage(image, 0, 0, width, height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(svgUrl)
        if (!blob) {
          reject(new Error('Failed to create image'))
          return
        }
        downloadBlob(blob, fileName)
        resolve()
      }, 'image/png')
    }

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl)
      reject(new Error('Failed to load tree image'))
    }

    image.src = svgUrl
  })
}

function CaseNameTreeView({ content, rootTitle, expanded = false }: { content: string; rootTitle: string; expanded?: boolean }) {
  const tree = buildCaseNameTree(content, rootTitle)
  const counts = countCaseNameTree(tree)

  if (!tree) {
    return <JsonEditor value={content} readOnly foldable minHeight={expanded ? 560 : 260} />
  }

  const treeHeight = getTreeHeight(tree)

  return (
    <div className={`ai-case-name-tree${expanded ? ' expanded' : ''}`}>
      <div className="ai-case-name-tree-stats">
        <Tag color="green">model {counts.models}</Tag>
        <Tag color="cyan">test_model {counts.testModels}</Tag>
        <Tag color="blue">test_points {counts.testPoints}</Tag>
      </div>
      <div className="ai-case-name-tree-canvas">
        <div className="ai-case-name-tree-root" title={tree.title}>{tree.title}</div>
        <CaseNameTreeCurves height={treeHeight} targetYs={getModelTargetYs(tree)} tone="green" />
        <div className="ai-case-name-tree-branches">
          {tree.children.map((model) => (
            <div key={model.id} className="ai-case-name-tree-row">
              <div className="ai-case-name-tree-node model" title={model.title}>{model.title}</div>
              <CaseNameTreeCurves height={getModelHeight(model)} targetYs={getTestModelTargetYs(model)} tone="blue" />
              <div className="ai-case-name-tree-children">
                {model.children.map((testModel) => (
                  <div key={testModel.id} className="ai-case-name-tree-row nested">
                    <div className="ai-case-name-tree-node test-model" title={testModel.title}>{testModel.title}</div>
                    <CaseNameTreeCurves height={getTestModelHeight(testModel)} targetYs={getPointTargetYs(testModel)} tone="slate" />
                    <div className="ai-case-name-tree-children point-list">
                      {testModel.children.map((point) => (
                        <div key={point.id} className="ai-case-name-tree-node point" title={point.title}>{point.title}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CaseNamesResultView({
  content,
  rootTitle,
  expanded = false,
  activeView,
  onViewChange,
}: {
  content: string
  rootTitle: string
  expanded?: boolean
  activeView?: CaseNamesViewMode
  onViewChange?: (view: CaseNamesViewMode) => void
}) {
  return (
    <Tabs
      className={`ai-case-names-inner-tabs${expanded ? ' expanded' : ''}`}
      size="small"
      activeKey={activeView}
      onChange={(key) => onViewChange?.(key as CaseNamesViewMode)}
      items={[
        {
          key: 'json',
          label: 'json',
          children: isJsonText(content) ? (
            <JsonEditor value={content} readOnly foldable minHeight={expanded ? 520 : 240} />
          ) : (
            <pre className="ai-task-code-block">{content}</pre>
          ),
        },
        {
          key: 'tree',
          label: '树图',
          children: <CaseNameTreeView content={content} rootTitle={rootTitle} expanded={expanded} />,
        },
      ]}
    />
  )
}

function formatDurationSeconds(durationMs?: number | null) {
  if (durationMs === undefined || durationMs === null) return '-'
  return `${(durationMs / 1000).toFixed(2)} s`
}

function renderRunStatusTag(status?: string) {
  const meta = getApiCaseGenerateTaskRunStatusMeta(status)
  return <Tag color={meta.color}>{meta.label}</Tag>
}

function normalizeReviewStatus(status?: string) {
  return status ?? 'pending'
}

function renderReviewStatusTag(status?: string) {
  const normalizedStatus = normalizeReviewStatus(status)
  const meta = reviewStatusMetaMap[normalizedStatus] ?? {
    label: normalizedStatus,
    color: 'default',
  }

  return <Tag color={meta.color}>{meta.label}</Tag>
}

function getFileDisplayName(task?: FunctionalCaseGenerateTask | null) {
  const sourceContent = task?.sourceContent || ''
  if (!sourceContent) return '-'
  const normalized = sourceContent.split('?')[0]
  const segments = normalized.split(/[\\/]/)
  return segments[segments.length - 1] || normalized
}

export function FunctionalCaseGenerateTaskDetailPage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [llmSelectOpen, setLlmSelectOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState<'instruction' | 'sourceContent' | 'runHistory' | null>('runHistory')
  const [selectedRunRecordId, setSelectedRunRecordId] = useState<string | null>(null)
  const [openRunDetailPopoverKey, setOpenRunDetailPopoverKey] = useState<string | null>(null)
  const [resultModalRunId, setResultModalRunId] = useState<string | null>(null)
  const [reviewSubmitAction, setReviewSubmitAction] = useState<'approve' | 'reject' | null>(null)
  const [expandedRunResult, setExpandedRunResult] = useState<ExpandedRunResult | null>(null)
  const [form] = Form.useForm<FunctionalCaseGenerateTaskFormValues>()
  const [reviewForm] = Form.useForm<{ comment?: string }>()

  const taskQuery = useQuery({
    queryKey: ['functionalCaseGenerateTask', taskId],
    queryFn: () => api.getFunctionalCaseGenerateTask(taskId),
    enabled: Boolean(taskId),
  })

  const task = taskQuery.data
  const runsQuery = useQuery({
    queryKey: ['functionalCaseGenerateTaskRuns', taskId],
    queryFn: () => api.getFunctionalCaseGenerateTaskRuns(taskId),
    enabled: Boolean(taskId),
    refetchInterval: expandedSection === 'runHistory' ? 5000 : false,
  })
  const sprintsQuery = useQuery({
    queryKey: ['sprints', 'functionalAiTestingDetail', task?.projectId],
    queryFn: async () => {
      const projectId = task?.projectId
      if (!projectId) return []
      return api.getSprints(projectId)
    },
    enabled: Boolean(task?.projectId),
  })
  const sprintOptions = useMemo(
    () => (sprintsQuery.data ?? []).map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    [sprintsQuery.data],
  )
  const requirementsQuery = useQuery({
    queryKey: ['requirements', 'functionalAiTestingDetail', drawerSprintId],
    queryFn: () => api.getRequirements(drawerSprintId!),
    enabled: Boolean(drawerSprintId),
  })
  const requirementOptions = useMemo(
    () =>
      (requirementsQuery.data ?? []).map((requirement) => ({
        label: requirement.name,
        value: normalizeRequirementId(requirement),
      })),
    [requirementsQuery.data],
  )
  const sprintNameMap = useMemo(
    () => new Map((sprintsQuery.data ?? []).map((sprint) => [normalizeSprintId(sprint), sprint.name])),
    [sprintsQuery.data],
  )
  const requirementNameMap = useMemo(
    () => new Map((requirementsQuery.data ?? []).map((requirement) => [normalizeRequirementId(requirement), requirement.name])),
    [requirementsQuery.data],
  )

  const runRecords = useMemo(
    () =>
      [...(runsQuery.data ?? [])].sort((left, right) => {
        const leftTime = new Date(left.createdAt || left.startedAt || left.updatedAt || '').getTime()
        const rightTime = new Date(right.createdAt || right.startedAt || right.updatedAt || '').getTime()
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
      }),
    [runsQuery.data],
  )
  const latestRunRecord = runRecords[0]
  const selectedRunId = selectedRunRecordId ?? runRecords[0]?.runId ?? ''
  const selectedRunQuery = useQuery({
    queryKey: ['functionalCaseGenerateTaskRun', selectedRunId],
    queryFn: () => api.getFunctionalCaseGenerateTaskRun(selectedRunId),
    enabled: Boolean(selectedRunId),
    refetchInterval: expandedSection === 'runHistory' && selectedRunId ? 5000 : false,
  })
  const selectedRun = selectedRunQuery.data
  const selectedRunResultSections = useMemo(
    () =>
      selectedRun
        ? runResultSectionDefinitions
            .map((section) => {
              const rawValue = selectedRun[section.key as keyof FunctionalCaseGenerateTaskRun]
              return { ...section, value: formatStructuredContent(rawValue) }
            })
            .filter((item) => item.value)
        : [],
    [selectedRun],
  )

  useEffect(() => {
    if (!task) return
    setDrawerSprintId(task.sprintId)
    form.setFieldsValue({
      name: task.name,
      sprintId: task.sprintId,
      requirementId: task.requirementId,
      sourceType: task.sourceType,
      sourceContent: task.sourceContent,
      sourceFileName: task.sourceType === 'text' ? undefined : getFileDisplayName(task),
      file: undefined,
      instruction: task.instruction,
    })
  }, [form, task])

  useEffect(() => {
    setExpandedSection('runHistory')
  }, [taskId])

  useEffect(() => {
    if (runRecords.length === 0) {
      setSelectedRunRecordId(null)
      return
    }
    setSelectedRunRecordId((current) =>
      current && runRecords.some((record) => record.runId === current) ? current : (runRecords[0].runId ?? null),
    )
  }, [runRecords])

  useEffect(() => {
    setOpenRunDetailPopoverKey(null)
  }, [selectedRunId])

  const updateTaskMutation = useMutation({
    mutationFn: (values: FunctionalCaseGenerateTaskFormValues) => api.updateFunctionalCaseGenerateTask(taskId, values),
    onSuccess: (updatedTask) => {
      message.success('任务已更新')
      setDrawerOpen(false)
      queryClient.setQueryData(['functionalCaseGenerateTask', taskId], updatedTask)
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTasks', updatedTask.projectId] })
    },
  })

  const runTaskMutation = useMutation({
    mutationFn: (connectionId: string) => api.runFunctionalCaseGenerateTask(taskId, { connectionId }),
    onSuccess: (run) => {
      message.success('任务已加入执行队列')
      setLlmSelectOpen(false)
      setExpandedSection('runHistory')
      setSelectedRunRecordId(run.runId ?? null)
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTask', taskId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRuns', taskId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTasks', task?.projectId ?? run.projectId] })
    },
  })

  const reviewRunMutation = useMutation({
    mutationFn: (payload: {
      runId: string
      body: { action: 'approve'; comment?: string } | { action: 'reject'; comment?: string }
    }) => api.reviewFunctionalCaseGenerateTaskRun(payload.runId, payload.body),
    onSuccess: (updatedRun, payload) => {
      message.success(payload.body.action === 'approve' ? '审核已通过并自动导入功能测试集' : '已丢弃本次生成结果')
      setResultModalRunId(null)
      setReviewSubmitAction(null)
      reviewForm.resetFields()
      setSelectedRunRecordId(updatedRun.runId ?? payload.runId)
      queryClient.setQueryData(['functionalCaseGenerateTaskRun', payload.runId], updatedRun)
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRun', payload.runId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRuns', taskId] })
      const targetRequirementId = task?.requirementId ?? updatedRun.requirementId
      if (targetRequirementId) {
        queryClient.invalidateQueries({ queryKey: ['functionTestSuites', targetRequirementId] })
      }
      queryClient.invalidateQueries({ queryKey: ['functionTestSuites'] })
      queryClient.invalidateQueries({ queryKey: ['functionTestCases'] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: () => api.deleteFunctionalCaseGenerateTask(taskId),
    onSuccess: () => {
      message.success('任务已删除')
      queryClient.removeQueries({ queryKey: ['functionalCaseGenerateTask', taskId], exact: true })
      if (task?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTasks', task.projectId] })
      }
      navigate('/ai-testing?tab=functional')
    },
  })

  const runnableTask = isRunnableApiCaseGenerateTaskRun(latestRunRecord?.status)
  const detailItems = useMemo(
    () =>
      task
        ? [
            { label: '任务名称', value: task.name || '-' },
            { label: '迭代', value: sprintNameMap.get(task.sprintId ?? '') ?? task.sprintId ?? '-' },
            { label: '需求', value: requirementNameMap.get(task.requirementId ?? '') ?? task.requirementId ?? '-' },
            { label: '来源类型', value: <Tag color={task.sourceType === 'text' ? 'blue' : 'purple'}>{task.sourceType}</Tag> },
            { label: '来源内容', value: task.sourceType === 'text' ? '文本' : '文档链接' },
            { label: '更新时间', value: formatTime(pickUpdatedAt(task)) },
          ]
        : [],
    [requirementNameMap, sprintNameMap, task],
  )
  const selectedRunResultSectionMap = useMemo(
    () => new Map(selectedRunResultSections.map((section) => [section.key, section.value])),
    [selectedRunResultSections],
  )
  const runHistoryRefreshing = runsQuery.isFetching || selectedRunQuery.isFetching
  const resultModalOpen = Boolean(resultModalRunId)
  const selectedRunReviewStatus = normalizeReviewStatus(selectedRun?.reviewStatus)
  const canReviewSelectedRun = Boolean(selectedRun) && selectedRunReviewStatus === 'pending' && !isApiCaseGenerateTaskRunInProgress(selectedRun?.status)

  useEffect(() => {
    if (!resultModalRunId) {
      reviewForm.resetFields()
      return
    }
    reviewForm.setFieldsValue({ comment: selectedRun?.reviewComment || undefined })
  }, [resultModalRunId, reviewForm, selectedRun?.reviewComment])

  function toggleSection(section: 'instruction' | 'sourceContent' | 'runHistory') {
    setExpandedSection((current) => (current === section ? null : section))
  }

  function handleRunTask() {
    if (runsQuery.isLoading) {
      message.warning('运行记录加载中，请稍后再试')
      return
    }
    if (!runnableTask) {
      message.warning('任务执行中，暂时不能重复运行')
      return
    }
    setLlmSelectOpen(true)
  }

  function handleLlmSelectConfirm(connectionId: string) {
    runTaskMutation.mutate(connectionId)
  }

  function handleRefreshRuns() {
    void runsQuery.refetch()
    if (selectedRunId) {
      void selectedRunQuery.refetch()
    }
  }

  function openResultModal(runId?: string) {
    if (!runId) return
    setSelectedRunRecordId(runId)
    setResultModalRunId(runId)
    setReviewSubmitAction(null)
  }

  function closeResultModal() {
    if (reviewRunMutation.isPending) return
    setResultModalRunId(null)
    setReviewSubmitAction(null)
    reviewForm.resetFields()
  }

  function handleApproveReview() {
    if (!resultModalRunId) return
    if (!canReviewSelectedRun) {
      message.warning('任务执行中，暂时不能审核')
      return
    }
    const values = reviewForm.getFieldsValue()
    setReviewSubmitAction('approve')
    reviewRunMutation.mutate({
      runId: resultModalRunId,
      body: {
        action: 'approve',
        comment: values.comment?.trim() || undefined,
      },
    })
  }

  function handleRejectReview() {
    if (!resultModalRunId) return
    if (!canReviewSelectedRun) {
      message.warning('任务执行中，暂时不能审核')
      return
    }
    const values = reviewForm.getFieldsValue()
    setReviewSubmitAction('reject')
    reviewRunMutation.mutate({
      runId: resultModalRunId,
      body: {
        action: 'reject',
        comment: values.comment?.trim() || undefined,
      },
    })
  }

  function openExpandedRunResult(title: string, content?: string) {
    if (!content) return
    setOpenRunDetailPopoverKey(null)
    setExpandedRunResult({ title, content })
  }

  function openExpandedConfigResult(tabs: ConfigJsonTab[], activeTabKey?: string) {
    if (tabs.length === 0) return
    setOpenRunDetailPopoverKey(null)
    setExpandedRunResult({
      type: 'config',
      title: '中间配置',
      tabs,
      activeTabKey: activeTabKey || tabs[0].key,
      activeCaseNamesView: 'json',
    })
  }

  function getExpandedRunResultContent() {
    if (!expandedRunResult) return ''
    if (expandedRunResult.type === 'config') {
      return expandedRunResult.tabs.find((tab) => tab.key === expandedRunResult.activeTabKey)?.content ?? ''
    }
    return expandedRunResult.content
  }

  function getExpandedRunResultTitle() {
    if (!expandedRunResult) return '运行结果'
    if (expandedRunResult.type === 'config') {
      const activeTab = expandedRunResult.tabs.find((tab) => tab.key === expandedRunResult.activeTabKey)
      const viewLabel = activeTab?.key === 'caseNames' && expandedRunResult.activeCaseNamesView === 'tree' ? '-树图' : ''
      return activeTab ? `${expandedRunResult.title}-${activeTab.label}${viewLabel}` : expandedRunResult.title
    }
    return expandedRunResult.title
  }

  function isExpandedCaseNameTreeActive() {
    return expandedRunResult?.type === 'config' && expandedRunResult.activeTabKey === 'caseNames' && expandedRunResult.activeCaseNamesView === 'tree'
  }

  async function handleCopyExpandedRunResult() {
    const content = getExpandedRunResultContent()
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      message.success('已复制内容')
    } catch {
      message.error('复制失败，请手动复制')
    }
  }

  async function handleDownloadExpandedRunResult() {
    const content = getExpandedRunResultContent()
    if (!content) return
    const title = getExpandedRunResultTitle()
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_')

    if (isExpandedCaseNameTreeActive()) {
      const image = createCaseNameTreeImageSvg(content, task?.name || '功能测试用例生成')
      if (!image) {
        message.warning('当前树图暂无可下载内容')
        return
      }
      try {
        await downloadSvgAsPng(image.svg, image.width, image.height, `${safeTitle}.png`)
        message.success('已下载图片')
      } catch {
        message.error('图片下载失败，请重试')
      }
      return
    }

    const extension = isJsonText(content) ? 'json' : 'txt'
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, `${safeTitle}.${extension}`)
    message.success('已下载内容')
  }

  return (
    <div className="workbench-page ai-testing-page">
      <div className="workbench-tabs">
        {taskQuery.error ? <Alert showIcon type="error" message={getErrorMessage(taskQuery.error)} /> : null}
        {runsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(runsQuery.error)} /> : null}

        {!task && taskQuery.isLoading ? (
          <Spin />
        ) : task ? (
          <div className="ai-task-detail-layout">
            <Card className="ai-task-detail-summary-card">
              <div className="ai-task-detail-inline-meta">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ai-testing?tab=functional')}>
                  返回
                </Button>
                {detailItems.map((item) => (
                  <div key={item.label} className="ai-task-detail-inline-item">
                    <span className="ai-task-detail-inline-label">{item.label}</span>
                    <span className="ai-task-detail-inline-value">{item.value}</span>
                  </div>
                ))}
                <div className="ai-task-detail-inline-actions">
                  <Button
                    className="action-btn-run"
                    icon={<CaretRightOutlined />}
                    disabled={runsQuery.isLoading || !runnableTask}
                    loading={runTaskMutation.isPending}
                    onClick={handleRunTask}
                  >
                    运行
                  </Button>
                  <Button className="action-btn-update" icon={<EditOutlined />} onClick={() => setDrawerOpen(true)}>
                    编辑
                  </Button>
                  <Popconfirm title="确认删除该任务？" onConfirm={() => deleteTaskMutation.mutate()}>
                    <Button danger className="action-btn-delete" icon={<DeleteOutlined />} loading={deleteTaskMutation.isPending}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            </Card>

            <div className={`ai-task-detail-fold-group${expandedSection === 'runHistory' ? ' run-history-expanded' : ''}`}>
              <Card
                className={`ai-task-detail-card ai-task-detail-fold-card ai-task-detail-fold-card-source${expandedSection === 'sourceContent' ? ' expanded' : ' collapsed'}`}
                title={
                  <button type="button" className="ai-task-detail-fold-trigger" onClick={() => toggleSection('sourceContent')} aria-expanded={expandedSection === 'sourceContent'}>
                    {expandedSection === 'sourceContent' ? <DownOutlined /> : <RightOutlined />}
                    <span>来源内容</span>
                  </button>
                }
              >
                {expandedSection === 'sourceContent' ? (
                  <div className="ai-task-detail-content-scroll">
                    {task.sourceType === 'text' ? (
                      <pre className="ai-task-code-block">{task.sourceContent || '-'}</pre>
                    ) : task.sourceContent ? (
                      <div className="ai-task-code-block">
                        <a href={task.sourceContent} target="_blank" rel="noreferrer">
                          下载文件
                        </a>
                        <div style={{ marginTop: 8 }}>{getFileDisplayName(task)}</div>
                      </div>
                    ) : (
                      <pre className="ai-task-code-block">-</pre>
                    )}
                  </div>
                ) : null}
              </Card>

              <Card
                className={`ai-task-detail-card ai-task-detail-fold-card ai-task-detail-fold-card-instruction${expandedSection === 'instruction' ? ' expanded' : ' collapsed'}`}
                title={
                  <button type="button" className="ai-task-detail-fold-trigger" onClick={() => toggleSection('instruction')} aria-expanded={expandedSection === 'instruction'}>
                    {expandedSection === 'instruction' ? <DownOutlined /> : <RightOutlined />}
                    <span>生成指令</span>
                  </button>
                }
              >
                {expandedSection === 'instruction' ? (
                  <div className="ai-task-detail-content-scroll">
                    <pre className="ai-task-code-block">{task.instruction || '-'}</pre>
                  </div>
                ) : null}
              </Card>

              <Card
                className={`ai-task-detail-card ai-task-detail-fold-card ai-task-detail-fold-card-history${expandedSection === 'runHistory' ? ' expanded' : ' collapsed'}`}
                extra={
                  <div className="ai-task-run-history-toolbar">
                    <span className="ai-task-run-history-auto-refresh">每 5 秒自动刷新</span>
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={runHistoryRefreshing}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRefreshRuns()
                      }}
                    >
                      刷新
                    </Button>
                  </div>
                }
                title={
                  <button type="button" className="ai-task-detail-fold-trigger" onClick={() => toggleSection('runHistory')} aria-expanded={expandedSection === 'runHistory'}>
                    {expandedSection === 'runHistory' ? <DownOutlined /> : <RightOutlined />}
                    <span>运行记录</span>
                  </button>
                }
              >
                {expandedSection === 'runHistory' ? (
                  <div className="ai-task-detail-content-scroll ai-task-run-history-scroll">
                    {runsQuery.isLoading ? (
                      <div className="ai-task-run-history-placeholder">
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="运行记录加载中..." />
                      </div>
                    ) : runRecords.length > 0 ? (
                      <div className="ai-task-run-history-list single-list">
                        {runRecords.map((record, index) => {
                          const active = record.runId === selectedRunId
                          const sectionValues = active ? selectedRunResultSectionMap : new Map<string, string>()
                          const reviewStatus = normalizeReviewStatus(active && selectedRun ? selectedRun.reviewStatus : record.reviewStatus)
                          const canReviewRecord = reviewStatus === 'pending' && !isApiCaseGenerateTaskRunInProgress(active && selectedRun ? selectedRun.status : record.status)
                          const visibleSections = runResultSectionDefinitions.filter(
                            (section) => !(section.key === 'errorMessage' && String(record.status ?? '').toLowerCase() === 'success'),
                          )

                          return (
                            <div
                              key={record.runId ?? `${index}`}
                              className={`ai-task-run-history-record-row${active ? ' active' : ''}`}
                              onClick={() => setSelectedRunRecordId(record.runId ?? null)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  setSelectedRunRecordId(record.runId ?? null)
                                }
                              }}
                            >
                              <div className="ai-task-run-history-record-main">
                                <div className="ai-task-run-history-record-identity">
                                  <span className="ai-task-run-history-record-index">#{index + 1}</span>
                                  <span className="ai-task-run-history-record-name" title={record.runId || '未命名记录'}>
                                    {record.runId || '未命名记录'}
                                  </span>
                                </div>
                                <div className="ai-task-run-history-record-meta">
                                  <span className="ai-task-run-history-record-status">{renderRunStatusTag(record.status)}</span>
                                  <span className="ai-task-run-history-review-status">{renderReviewStatusTag(active && selectedRun ? selectedRun.reviewStatus : record.reviewStatus)}</span>
                                  <span className="ai-task-run-history-record-field">开始：{formatTime(record.startedAt)}</span>
                                  <span className="ai-task-run-history-record-field">结束：{formatTime(record.finishedAt)}</span>
                                  <span className="ai-task-run-history-record-field">耗时：{formatDurationSeconds(record.durationMs)}</span>
                                </div>
                              </div>
                              <div className="ai-task-run-history-record-actions">
                                {visibleSections.map((section) => {
                                  const popoverKey = `${record.runId ?? index}:${section.key}`
                                  const isOpen = openRunDetailPopoverKey === popoverKey
                                  const loading = active && selectedRunQuery.isLoading
                                  const content = active ? sectionValues.get(section.key) : undefined
                                  const configTabs = section.key === 'configJson' ? parseConfigJsonTabs(content) : []

                                  return (
                                    <Popover
                                      key={popoverKey}
                                      trigger="click"
                                      placement="bottomRight"
                                      overlayClassName="ai-task-run-result-popover"
                                      open={isOpen}
                                      onOpenChange={(open) => {
                                        setSelectedRunRecordId(record.runId ?? null)
                                        setOpenRunDetailPopoverKey(open ? popoverKey : null)
                                      }}
                                      content={
                                        <div className="ai-task-run-result-popover-content">
                                          {loading ? (
                                            <div className="ai-task-run-result-popover-loading">
                                              <Spin size="small" />
                                            </div>
                                          ) : content ? (
                                            <>
                                              <div className="ai-task-run-result-popover-header">
                                                <span>{section.label}</span>
                                                {configTabs.length === 0 ? (
                                                  <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<FullscreenOutlined />}
                                                    aria-label="放大查看"
                                                    onClick={(event) => {
                                                      event.stopPropagation()
                                                      openExpandedRunResult(section.label, content)
                                                    }}
                                                  />
                                                ) : null}
                                              </div>
                                              {configTabs.length > 0 ? (
                                                <Tabs
                                                  className="ai-task-run-config-tabs"
                                                  size="small"
                                                  tabBarExtraContent={
                                                    <Button
                                                      type="text"
                                                      size="small"
                                                      icon={<FullscreenOutlined />}
                                                      aria-label="放大查看"
                                                      onClick={(event) => {
                                                        event.stopPropagation()
                                                        openExpandedConfigResult(configTabs)
                                                      }}
                                                    />
                                                  }
                                                  items={configTabs.map((tab) => ({
                                                    key: tab.key,
                                                    label: tab.label,
                                                    children: (
                                                      tab.key === 'caseNames' ? (
                                                        <CaseNamesResultView content={tab.content} rootTitle={task?.name || '功能测试用例生成'} />
                                                      ) : isJsonText(tab.content) ? (
                                                        <JsonEditor value={tab.content} readOnly foldable minHeight={260} />
                                                      ) : (
                                                        <pre className="ai-task-code-block">{tab.content}</pre>
                                                      )
                                                    ),
                                                  }))}
                                                />
                                              ) : section.key === 'resultYaml' ? (
                                                <JsonEditor value={content} readOnly foldable minHeight={320} />
                                              ) : (
                                                <pre className="ai-task-code-block">{content}</pre>
                                              )}
                                            </>
                                          ) : (
                                            <div className="ai-task-run-result-popover-empty">暂无内容</div>
                                          )}
                                        </div>
                                      }
                                    >
                                      <button type="button" className={`ai-task-run-result-popover-btn${isOpen ? ' active' : ''}`} onClick={(event) => event.stopPropagation()}>
                                        {section.label}
                                      </button>
                                    </Popover>
                                  )
                                })}
                                {active && selectedRun ? (
                                  <div className="ai-task-run-history-review-inline">
                                    {selectedRun.reviewedAt ? (
                                      <span className="ai-task-run-history-record-field">审核时间：{formatTime(selectedRun.reviewedAt)}</span>
                                    ) : null}
                                    {selectedRun.reviewComment ? (
                                      <Popover trigger="click" placement="bottomRight" content={<div className="ai-task-run-review-comment">{selectedRun.reviewComment}</div>}>
                                        <button type="button" className="ai-task-run-review-note-btn" onClick={(event) => event.stopPropagation()}>
                                          审核备注
                                        </button>
                                      </Popover>
                                    ) : null}
                                    {canReviewRecord ? (
                                      <Button
                                        size="small"
                                        type="primary"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          openResultModal(record.runId)
                                        }}
                                      >
                                        审核
                                      </Button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                        {selectedRunQuery.isLoading && !selectedRun ? (
                          <div className="ai-task-run-history-placeholder compact">
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="运行详情加载中..." />
                          </div>
                        ) : null}
                        {selectedRun && selectedRunResultSections.length === 0 ? (
                          <div className="ai-task-run-history-hint compact">当前选中记录暂无可展示结果</div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="ai-task-run-history-placeholder">
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前还没有运行记录" />
                        <div className="ai-task-run-history-hint">点击上方“运行”后，任务状态和最近一次执行信息会展示在这里。</div>
                      </div>
                    )}
                  </div>
                ) : null}
              </Card>
            </div>
          </div>
        ) : (
          <Alert showIcon type="warning" message="未找到对应任务" />
        )}

        <FunctionalCaseGenerateTaskDrawer
          title="编辑功能用例生成任务"
          open={drawerOpen}
          form={form}
          editing
          loading={updateTaskMutation.isPending}
          error={updateTaskMutation.error}
          sprintOptions={sprintOptions}
          requirementOptions={requirementOptions}
          onSprintChange={(value) => {
            setDrawerSprintId(value)
            form.setFieldValue('requirementId', undefined)
          }}
          onClose={() => setDrawerOpen(false)}
          onFinish={(values) => updateTaskMutation.mutate(values)}
        />

        <Modal
          title={canReviewSelectedRun ? '审核 AI 生成结果' : '功能测试用例生成结果'}
          open={resultModalOpen}
          onCancel={closeResultModal}
          footer={
            canReviewSelectedRun
              ? [
                  <Button key="cancel" onClick={closeResultModal}>
                    取消
                  </Button>,
                  <Button
                    key="reject"
                    danger
                    ghost
                    loading={reviewRunMutation.isPending && reviewSubmitAction === 'reject'}
                    onClick={handleRejectReview}
                  >
                    审核不通过
                  </Button>,
                  <Button
                    key="approve"
                    type="primary"
                    loading={reviewRunMutation.isPending && reviewSubmitAction === 'approve'}
                    onClick={handleApproveReview}
                  >
                    审核通过并导入
                  </Button>,
                ]
              : [
                  <Button key="close" type="primary" onClick={closeResultModal}>
                    关闭
                  </Button>,
                ]
          }
          width={960}
          destroyOnHidden
        >
          <Form form={reviewForm} layout="vertical">
            <div className="ai-task-review-modal-content ai-task-result-preview-modal-content single-column">
              <div className="ai-task-review-modal-section">
                <div className="ai-task-review-modal-label">生成结果</div>
                <div className="ai-task-review-modal-preview">
                  {selectedRunQuery.isLoading ? (
                    <div className="ai-task-run-result-popover-loading">
                      <Spin />
                    </div>
                  ) : selectedRun?.resultYaml ? (
                    <JsonEditor value={formatStructuredContent(selectedRun.resultYaml)} readOnly foldable minHeight={480} />
                  ) : (
                    <div className="ai-task-run-result-popover-empty">当前记录暂无结果</div>
                  )}
                </div>
              </div>
            </div>
            <Form.Item label="审核备注" name="comment">
              <Input.TextArea rows={4} placeholder="请输入审核备注或驳回原因" disabled={!canReviewSelectedRun} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          className="ai-task-run-result-expanded-modal"
          title={
            <div className="ai-task-run-result-expanded-title">
              <span>{expandedRunResult?.title ?? '运行结果'}</span>
              <div className="ai-task-run-result-expanded-actions">
                <Tooltip title="复制内容">
                  <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopyExpandedRunResult} />
                </Tooltip>
                <Tooltip title={isExpandedCaseNameTreeActive() ? '下载图片' : '下载内容'}>
                  <Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleDownloadExpandedRunResult} />
                </Tooltip>
              </div>
            </div>
          }
          open={Boolean(expandedRunResult)}
          onCancel={() => setExpandedRunResult(null)}
          footer={[
            <Button key="close" type="primary" onClick={() => setExpandedRunResult(null)}>
              关闭
            </Button>,
          ]}
          width="min(1560px, calc(100vw - 160px))"
          style={{ top: 48 }}
          destroyOnHidden
        >
          <div className="ai-task-run-result-expanded-content">
            {expandedRunResult?.type === 'config' ? (
              <Tabs
                className="ai-task-run-config-tabs expanded"
                activeKey={expandedRunResult.activeTabKey}
                onChange={(activeTabKey) => {
                  setExpandedRunResult((current) => {
                    if (!current || current.type !== 'config') return current
                    return {
                      ...current,
                      activeTabKey,
                      activeCaseNamesView: activeTabKey === 'caseNames' ? current.activeCaseNamesView ?? 'json' : 'json',
                    }
                  })
                }}
                items={expandedRunResult.tabs.map((tab) => ({
                  key: tab.key,
                  label: tab.label,
                  children: tab.key === 'caseNames' ? (
                    <CaseNamesResultView
                      content={tab.content}
                      rootTitle={task?.name || '功能测试用例生成'}
                      expanded
                      activeView={expandedRunResult.activeCaseNamesView ?? 'json'}
                      onViewChange={(activeCaseNamesView) => {
                        setExpandedRunResult((current) => {
                          if (!current || current.type !== 'config') return current
                          return { ...current, activeCaseNamesView }
                        })
                      }}
                    />
                  ) : isJsonText(tab.content) ? (
                    <JsonEditor value={tab.content} readOnly foldable minHeight={560} />
                  ) : (
                    <pre className="ai-task-code-block">{tab.content}</pre>
                  ),
                }))}
              />
            ) : expandedRunResult && isJsonText(expandedRunResult.content) ? (
              <JsonEditor value={expandedRunResult.content} readOnly foldable minHeight={560} />
            ) : (
              <pre className="ai-task-code-block">{expandedRunResult?.content ?? ''}</pre>
            )}
          </div>
        </Modal>

        <LlmConnectionSelectModal open={llmSelectOpen} onClose={() => setLlmSelectOpen(false)} onConfirm={handleLlmSelectConfirm} loading={runTaskMutation.isPending} />
      </div>
    </div>
  )
}
