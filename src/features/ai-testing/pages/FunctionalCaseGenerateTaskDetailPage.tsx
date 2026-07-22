import { ArrowLeftOutlined, CaretRightOutlined, DeleteOutlined, DownOutlined, EditOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Popover, Spin, Tabs, Tag } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FunctionalCaseGenerateTaskDrawer, type FunctionalCaseGenerateTaskFormValues } from '../components/FunctionalCaseGenerateTaskDrawer'
import { AiTaskQuickLinks } from '../components/AiTaskQuickLinks'
import { LlmConnectionSelectModal } from '../components/LlmConnectionSelectModal'
import type { FunctionalCaseGenerateTaskRun } from '../types'
import { getApiCaseGenerateTaskRunStatusMeta, isRunnableApiCaseGenerateTaskRun } from '../utils/taskStatus'
import { JsonEditor } from '@/shared/components/JsonEditor/JsonEditor'
import { TextCodeEditor } from '@/shared/components/TextCodeEditor/TextCodeEditor'
import { message } from '@/shared/utils/feedback'
import '@/features/ai-testing/styles/index.css'
import { RequirementDocumentPreviewContent } from '@/features/requirements/components/RequirementDocumentPreviewModal'
import { hasRequirementDocument } from '@/features/requirements/utils/requirementDocument'
import { api } from '@/services/api'
import { formatTime, getErrorMessage, normalizeRequirementId, normalizeSprintId, pickUpdatedAt } from '@/utils/format'

const runResultSectionDefinitions = [
  { key: 'enhancedText', label: '增强文本' },
  { key: 'requirementAnalysis', label: '需求分析' },
  { key: 'caseNames', label: '测试点' },
  { key: 'resultYaml', label: '结果' },
  { key: 'errorMessage', label: '错误信息' },
] as const

type CaseNamesViewMode = 'json' | 'tree'
type RequirementAnalysisViewMode = 'json' | 'diagram'
type GeneratedCasesViewMode = 'json' | 'diagram'

type CaseNameTreeNode = {
  id: string
  title: string
  kind: 'root' | 'model' | 'testModel' | 'point'
  children: CaseNameTreeNode[]
}

type RunResultSectionKey = (typeof runResultSectionDefinitions)[number]['key']

type RunResultModalState = {
  key: RunResultSectionKey
  label: string
} | null

type GeneratedCaseImportStats = {
  moduleCount: number
  caseCount: number
  moduleNames: string[]
}

const reviewStatusMetaMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待导入', color: 'gold' },
  approved: { label: '已导入', color: 'success' },
  rejected: { label: '已丢弃', color: 'default' },
}

const functionalStageMetaMap: Record<string, { label: string; color: string }> = {
  enhanced_text: { label: '增强文档输出', color: 'cyan' },
  requirement_analysis: { label: '测试需求/风险/测试点输出', color: 'blue' },
  case_names: { label: '测试用例名称/测试点输出', color: 'geekblue' },
  detailed_cases: { label: '详细测试用例输出', color: 'purple' },
  completed: { label: '已完成', color: 'success' },
}

const stageConfigFieldMap: Record<string, { key: string; label: string }> = {
  enhanced_text: { key: 'enhancedText', label: '增强文本 enhancedText' },
  requirement_analysis: { key: 'requirementAnalysis', label: '需求分析 requirementAnalysis' },
  case_names: { key: 'caseNames', label: '测试点 caseNames' },
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

function parseJsonLikeContent(value?: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function getGeneratedCaseImportStats(content?: unknown): GeneratedCaseImportStats {
  const parsed = parseJsonLikeContent(content)
  const cases = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).cases)
      ? (parsed as Record<string, unknown>).cases as unknown[]
      : []
  const moduleNames = new Set<string>()

  cases.forEach((item) => {
    if (!item || typeof item !== 'object') {
      moduleNames.add('未分组')
      return
    }
    const moduleName = toDisplayText((item as Record<string, unknown>).case_module) || '未分组'
    moduleNames.add(moduleName)
  })

  return {
    moduleCount: moduleNames.size,
    caseCount: cases.length,
    moduleNames: [...moduleNames],
  }
}

function getConfigStageFieldContent(configJson?: unknown, fieldKey?: string) {
  if (!fieldKey) return ''
  const parsed = parseJsonLikeContent(configJson)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ''
  const record = parsed as Record<string, unknown>
  const directFieldContent = record[fieldKey]
  if (directFieldContent !== undefined && directFieldContent !== null && directFieldContent !== '') {
    return formatStructuredContent(directFieldContent)
  }

  if (isDirectStageConfigContent(record, fieldKey)) {
    return formatStructuredContent(record)
  }

  return ''
}

function isDirectStageConfigContent(record: Record<string, unknown>, fieldKey: string) {
  if (fieldKey === 'caseNames') {
    return Array.isArray(record.categories)
  }

  if (fieldKey === 'requirementAnalysis') {
    return Boolean(
      record.Platform_core_functions ||
        record.Target_understanding ||
        record.Risk_point_prediction ||
        record.function_flow ||
        record.Scene_Design,
    )
  }

  return false
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

function toCaseNamePointList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(toDisplayText).filter(Boolean)
  }
  const text = toDisplayText(value)
  return text ? [text] : []
}

type RequirementAnalysisSection = {
  Platform_core_functions?: unknown
  Target_understanding?: unknown
  Risk_point_prediction?: unknown
  function_flow?: unknown
  Scene_Design?: unknown
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function formatTextList(value: unknown) {
  return toTextList(value).join('\n')
}

function formatRoleConcerns(value: unknown) {
  return toRecordArray(value)
    .map((item) => {
      const role = toDisplayText(item.role)
      const concern = toDisplayText(item.concern)
      if (role && concern) return `${role}：${concern}`
      return role || concern || toDisplayText(item)
    })
    .filter(Boolean)
    .join('\n')
}

type GeneratedTestCase = {
  moduleName: string
  displayName: string
  tagFields: Array<{ key: string; label: string; value: string }>
  detailFields: Array<{ key: string; label: string; value: string }>
}

type GeneratedCaseModuleGroup = {
  moduleName: string
  cases: GeneratedTestCase[]
}

const MODULE_FIELD_CANDIDATES = ['case_module', 'module', 'module_name', 'moduleName', 'group', 'category']
const NAME_FIELD_CANDIDATES = ['Case Title', 'case_title', 'case_name', 'name', 'title', 'caseName', 'test_point', 'testPoint', 'scenario', 'description']
const TAG_FIELD_CANDIDATES = ['priority', 'case_type', 'caseType', 'type', 'level', 'severity']

const FIELD_LABEL_MAP: Record<string, string> = {
  case_name: '用例名称',
  case_title: '用例名称',
  'Case Title': '用例名称',
  name: '用例名称',
  title: '用例名称',
  caseName: '用例名称',
  test_point: '测试点',
  testPoint: '测试点',
  scenario: '场景',
  description: '描述',
  preconditions: '前置条件',
  precondition: '前置条件',
  preCondition: '前置条件',
  steps: '测试步骤',
  test_steps: '测试步骤',
  testSteps: '测试步骤',
  operation: '操作步骤',
  expected_results: '预期结果',
  expectedResult: '预期结果',
  expectedResults: '预期结果',
  expected_result: '预期结果',
  priority: '优先级',
  case_type: '用例类型',
  caseType: '用例类型',
  type: '类型',
  level: '级别',
  severity: '严重程度',
  case_module: '模块',
  module: '模块',
  module_name: '模块',
  moduleName: '模块',
  group: '分组',
  category: '分类',
  order: '序号',
  orderNo: '序号',
  remark: '备注',
  note: '备注',
}

function pickFirstField(record: Record<string, unknown>, candidates: string[]): string {
  for (const key of candidates) {
    const val = toDisplayText(record[key])
    if (val) return val
  }
  return ''
}

function isTagField(key: string, value: string): boolean {
  if (TAG_FIELD_CANDIDATES.includes(key)) return true
  if (value.length <= 12 && /^P[1-4]$/.test(value)) return true
  if (value.length <= 8 && /^\d+$/.test(value)) return true
  return false
}

function formatFieldLabel(key: string): string {
  if (FIELD_LABEL_MAP[key]) return FIELD_LABEL_MAP[key]
  return key.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseGeneratedCases(content?: string): GeneratedCaseModuleGroup[] {
  if (!content?.trim()) return []
  try {
    const parsed = JSON.parse(content)
    const rawCases: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).cases)
        ? (parsed as Record<string, unknown>).cases as unknown[]
        : []
    if (rawCases.length === 0) return []

    const moduleMap = new Map<string, GeneratedTestCase[]>()
    rawCases.forEach((item) => {
      if (!item || typeof item !== 'object') {
        const group = moduleMap.get('未分组') ?? []
        group.push({ moduleName: '未分组', displayName: toDisplayText(item) || '未命名用例', tagFields: [], detailFields: [] })
        moduleMap.set('未分组', group)
        return
      }
      const record = item as Record<string, unknown>
      const moduleName = pickFirstField(record, MODULE_FIELD_CANDIDATES) || '未分组'
      const displayName = pickFirstField(record, NAME_FIELD_CANDIDATES) || '未命名用例'

      const tagFields: Array<{ key: string; label: string; value: string }> = []
      const detailFields: Array<{ key: string; label: string; value: string }> = []
      const nameKey = NAME_FIELD_CANDIDATES.find((k) => toDisplayText(record[k]))
      const moduleKey = MODULE_FIELD_CANDIDATES.find((k) => toDisplayText(record[k]))

      Object.entries(record).forEach(([key, rawValue]) => {
        if (key === nameKey || key === moduleKey) return
        const value = toDisplayText(rawValue)
        if (!value) return
        if (isTagField(key, value)) {
          tagFields.push({ key, label: formatFieldLabel(key), value })
        } else {
          detailFields.push({ key, label: formatFieldLabel(key), value })
        }
      })

      const testCase: GeneratedTestCase = { moduleName, displayName, tagFields, detailFields }
      const group = moduleMap.get(moduleName) ?? []
      group.push(testCase)
      moduleMap.set(moduleName, group)
    })

    return [...moduleMap.entries()].map(([moduleName, cases]) => ({ moduleName, cases }))
  } catch {
    return []
  }
}

function parseRequirementAnalysisContent(content: string): RequirementAnalysisSection | null {
  if (!content.trim()) return null

  try {
    const parsed = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as RequirementAnalysisSection
  } catch {
    return null
  }
}

function RequirementAnalysisDiagramView({ content }: { content: string }) {
  const parsed = useMemo(() => parseRequirementAnalysisContent(content), [content])

  if (!parsed) {
    return isJsonText(content) ? (
      <JsonEditor value={content} readOnly foldable minHeight={640} />
    ) : (
      <pre className="ai-task-code-block">{content}</pre>
    )
  }

  const coreFunctions = toRecordArray(parsed.Platform_core_functions)
  const targetUnderstanding = toRecord(parsed.Target_understanding)
  const legacyTargets = toRecordArray(parsed.Target_understanding)
  const targetSections = targetUnderstanding
    ? [
        { key: 'business_goal', title: '业务目标', content: formatTextList(targetUnderstanding.business_goal) },
        { key: 'test_goal', title: '测试目标', content: formatTextList(targetUnderstanding.test_goal) },
        { key: 'user_roles_and_concerns', title: '用户角色与关注点', content: formatRoleConcerns(targetUnderstanding.user_roles_and_concerns) },
        { key: 'quality_attributes', title: '质量属性', content: formatTextList(targetUnderstanding.quality_attributes) },
      ].filter((item) => item.content)
    : []
  const risks = toRecordArray(parsed.Risk_point_prediction)
  const flows = toRecordArray(parsed.function_flow)
  const scenes = toRecordArray(parsed.Scene_Design)

  return (
    <div className="ai-requirement-analysis-view">
      {coreFunctions.length > 0 ? (
        <section className="ai-requirement-analysis-section">
          <div className="ai-requirement-analysis-section-head">
            <div className="ai-requirement-analysis-section-title">平台核心功能</div>
            <Tag color="blue">{coreFunctions.length}</Tag>
          </div>
          <div className="ai-requirement-analysis-grid two-col">
            {coreFunctions.map((item, index) => (
              <article key={`core-${index}`} className="ai-requirement-analysis-card">
                <div className="ai-requirement-analysis-card-title">{toDisplayText(item.function_name ?? item.function) || `功能 ${index + 1}`}</div>
                <div className="ai-requirement-analysis-field">
                  <span>能力说明</span>
                  <p>{toDisplayText(item.function_description ?? item.description) || '-'}</p>
                </div>
                <div className="ai-requirement-analysis-field">
                  <span>来源依据</span>
                  <p>{formatTextList(item.derived_from) || '-'}</p>
                </div>
                <div className="ai-requirement-analysis-field accent">
                  <span>业务价值</span>
                  <p>{toDisplayText(item.business_value) || '-'}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {targetSections.length > 0 || legacyTargets.length > 0 ? (
        <section className="ai-requirement-analysis-section">
          <div className="ai-requirement-analysis-section-head">
            <div className="ai-requirement-analysis-section-title">目标理解</div>
            <Tag color="cyan">{targetSections.length || legacyTargets.length}</Tag>
          </div>
          <div className="ai-requirement-analysis-list">
            {targetSections.length > 0 ? targetSections.map((item, index) => (
              <article key={`target-${item.key}`} className="ai-requirement-analysis-row-card">
                <div className="ai-requirement-analysis-row-index">{index + 1}</div>
                <div className="ai-requirement-analysis-row-body">
                  <div className="ai-requirement-analysis-card-title">{item.title}</div>
                  <p>{item.content}</p>
                </div>
              </article>
            )) : legacyTargets.map((item, index) => (
              <article key={`target-${index}`} className="ai-requirement-analysis-row-card">
                <div className="ai-requirement-analysis-row-index">{index + 1}</div>
                <div className="ai-requirement-analysis-row-body">
                  <div className="ai-requirement-analysis-card-title">{toDisplayText(item.target) || `目标 ${index + 1}`}</div>
                  <p>{toDisplayText(item.description) || '-'}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {risks.length > 0 ? (
        <section className="ai-requirement-analysis-section">
          <div className="ai-requirement-analysis-section-head">
            <div className="ai-requirement-analysis-section-title">风险点预测</div>
            <Tag color="volcano">{risks.length}</Tag>
          </div>
          <div className="ai-requirement-analysis-grid two-col">
            {risks.map((item, index) => (
              <article key={`risk-${index}`} className="ai-requirement-analysis-card risk">
                <div className="ai-requirement-analysis-card-title">{toDisplayText(item.risk_category ?? item.risk_area) || `风险 ${index + 1}`}</div>
                <div className="ai-requirement-analysis-field">
                  <span>风险说明</span>
                  <p>{formatTextList(item.risk_points ?? item.risk_description) || '-'}</p>
                </div>
                <div className="ai-requirement-analysis-field accent danger">
                  <span>影响链路</span>
                  <p>{formatTextList(item.affected_links ?? item.impact) || '-'}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {flows.length > 0 ? (
        <section className="ai-requirement-analysis-section">
          <div className="ai-requirement-analysis-section-head">
            <div className="ai-requirement-analysis-section-title">功能流程</div>
            <Tag color="geekblue">{flows.length}</Tag>
          </div>
          <div className="ai-requirement-analysis-flow-list">
            {flows.map((item, index) => (
              <article key={`flow-${index}`} className="ai-requirement-analysis-flow-card">
                <div className="ai-requirement-analysis-flow-step">0{index + 1}</div>
                <div className="ai-requirement-analysis-flow-body">
                  <div className="ai-requirement-analysis-card-title">{toDisplayText(item.flow_name) || `流程 ${index + 1}`}</div>
                  <div className="ai-requirement-analysis-field">
                    <span>步骤</span>
                    <p>{formatTextList(item.steps ?? item.description) || '-'}</p>
                  </div>
                  <div className="ai-requirement-analysis-field accent">
                    <span>依赖</span>
                    <p>{formatTextList(item.dependencies) || '-'}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {scenes.length > 0 ? (
        <section className="ai-requirement-analysis-section">
          <div className="ai-requirement-analysis-section-head">
            <div className="ai-requirement-analysis-section-title">场景设计</div>
            <Tag color="purple">{scenes.length}</Tag>
          </div>
          <div className="ai-requirement-analysis-scene-groups">
            {scenes.map((scene, index) => {
              const subCategories = toRecordArray(scene.subcategories ?? scene.sub_category)
              return (
                <article key={`scene-${index}`} className="ai-requirement-analysis-scene-group">
                  <div className="ai-requirement-analysis-scene-head">
                    <div className="ai-requirement-analysis-card-title">{toDisplayText(scene.scene_type) || `场景 ${index + 1}`}</div>
                    <Tag color="default">{subCategories.length} 项</Tag>
                  </div>
                  <div className="ai-requirement-analysis-grid two-col">
                    {subCategories.map((item, subIndex) => (
                      <article key={`scene-${index}-sub-${subIndex}`} className="ai-requirement-analysis-card nested">
                        <div className="ai-requirement-analysis-card-title">{toDisplayText(item.name ?? item.scene_type) || `子场景 ${subIndex + 1}`}</div>
                        <div className="ai-requirement-analysis-field">
                          <span>覆盖范围</span>
                          <p>{toDisplayText(item.coverage ?? item.description) || '-'}</p>
                        </div>
                        <div className="ai-requirement-analysis-field">
                          <span>验证重点</span>
                          <p>{toDisplayText(item.verification_focus) || '-'}</p>
                        </div>
                        <div className="ai-requirement-analysis-field accent">
                          <span>保护价值/风险</span>
                          <p>{toDisplayText(item.protected_value_or_risk) || '-'}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function RequirementAnalysisView({ content }: { content: string }) {
  const [activeView, setActiveView] = useState<RequirementAnalysisViewMode>('json')
  const parsed = useMemo(() => parseRequirementAnalysisContent(content), [content])
  const isDiagramAvailable = Boolean(parsed)

  return (
    <Tabs
      className="ai-requirement-analysis-tabs"
      size="small"
      activeKey={activeView}
      onChange={(key) => setActiveView(key as RequirementAnalysisViewMode)}
      items={[
        {
          key: 'json',
          label: 'json',
          children: isJsonText(content) ? (
            <JsonEditor value={content} readOnly foldable minHeight={640} />
          ) : (
            <pre className="ai-task-code-block">{content}</pre>
          ),
        },
        {
          key: 'diagram',
          label: '图像',
          children: isDiagramAvailable ? (
            <RequirementAnalysisDiagramView content={content} />
          ) : (
            <div className="ai-task-run-result-popover-empty">当前内容无法解析为结构化需求分析</div>
          ),
        },
      ]}
    />
  )
}

function GeneratedCasesDiagramView({ content }: { content: string }) {
  const moduleGroups = useMemo(() => parseGeneratedCases(content), [content])

  if (moduleGroups.length === 0) {
    return isJsonText(content) ? (
      <JsonEditor value={content} readOnly foldable minHeight={640} />
    ) : (
      <pre className="ai-task-code-block">{content}</pre>
    )
  }

  const totalCases = moduleGroups.reduce((sum, group) => sum + group.cases.length, 0)

  return (
    <div className="ai-generated-cases-view">
      <div className="ai-generated-cases-stats">
        <Tag color="purple">模块 {moduleGroups.length}</Tag>
        <Tag color="blue">用例 {totalCases}</Tag>
      </div>
      <div className="ai-generated-cases-module-list">
        {moduleGroups.map((group, groupIndex) => (
          <section key={`module-${groupIndex}`} className="ai-generated-cases-module">
            <div className="ai-generated-cases-module-head">
              <div className="ai-generated-cases-module-title">{group.moduleName}</div>
              <Tag color="default">{group.cases.length} 条</Tag>
            </div>
            <div className="ai-generated-cases-case-list">
              {group.cases.map((testCase, caseIndex) => (
                <article key={`case-${groupIndex}-${caseIndex}`} className="ai-generated-cases-case-card">
                  <div className="ai-generated-cases-case-header">
                    <div className="ai-generated-cases-case-name">{testCase.displayName}</div>
                    <div className="ai-generated-cases-case-badges">
                      {testCase.tagFields.map((tag) => (
                        <Tag key={tag.key} color="orange">{tag.value}</Tag>
                      ))}
                    </div>
                  </div>
                  {testCase.detailFields.map((field) => (
                    <div key={field.key} className={`ai-generated-cases-case-field${field.key === 'expected_results' || field.key === 'expectedResult' || field.key === 'expectedResults' ? ' accent' : ''}`}>
                      <span>{field.label}</span>
                      <p>{field.value}</p>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function GeneratedCasesResultView({
  content,
  expanded = false,
  activeView,
  onViewChange,
}: {
  content: string
  expanded?: boolean
  activeView?: GeneratedCasesViewMode
  onViewChange?: (view: GeneratedCasesViewMode) => void
}) {
  return (
    <Tabs
      className={`ai-case-names-inner-tabs${expanded ? ' expanded' : ''}`}
      size="small"
      activeKey={activeView}
      onChange={(key) => onViewChange?.(key as GeneratedCasesViewMode)}
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
          key: 'diagram',
          label: '卡片',
          children: <GeneratedCasesDiagramView content={content} />,
        },
      ]}
    />
  )
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
  const directPoints = toCaseNamePointList(record.test_points)
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

function buildCategoryCaseNameTree(parsed: unknown, rootTitle: string): CaseNameTreeNode | null {
  const rootRecord = toRecord(parsed)
  const categories = rootRecord?.categories
  if (!Array.isArray(categories)) return null

  const categoryNodes = categories.reduce<CaseNameTreeNode[]>((categoryNodes, category, categoryIndex) => {
    const categoryRecord = toRecord(category)
    const data = categoryRecord?.data
    if (!categoryRecord || !Array.isArray(data)) return categoryNodes

    const testModelNodes = data.reduce<CaseNameTreeNode[]>((testModelNodes, item, dataIndex) => {
      const itemRecord = toRecord(item)
      const points = itemRecord?.test_points
      if (!itemRecord || !Array.isArray(points)) return testModelNodes

      const pointNodes = points.reduce<CaseNameTreeNode[]>((pointNodes, point, pointIndex) => {
        const title = toDisplayText(point)
        if (!title) return pointNodes
        pointNodes.push({
          id: `category-${categoryIndex}-data-${dataIndex}-point-${pointIndex}`,
          title,
          kind: 'point',
          children: [],
        })
        return pointNodes
      }, [])

      testModelNodes.push({
        id: `category-${categoryIndex}-data-${dataIndex}`,
        title: toDisplayText(itemRecord.test_model) || '未分组场景',
        kind: 'testModel',
        children: pointNodes,
      })

      return testModelNodes
    }, [])

    if (testModelNodes.length === 0) return categoryNodes

    categoryNodes.push({
      id: `category-${categoryIndex}`,
      title: toDisplayText(categoryRecord.model) || '未分组模块',
      kind: 'model',
      children: testModelNodes,
    })

    return categoryNodes
  }, [])

  if (categoryNodes.length === 0) return null

  return {
    id: 'root',
    title: rootTitle || '功能测试用例生成',
    kind: 'root',
    children: categoryNodes,
  }
}

type CategoryCaseNameNodePath = {
  categoryIndex: number
  dataIndex?: number
  pointIndex?: number
}

function parseCategoryCaseNameNodePath(nodeId: string): CategoryCaseNameNodePath | null {
  const match = /^category-(\d+)(?:-data-(\d+))?(?:-point-(\d+))?$/.exec(nodeId)
  if (!match) return null

  return {
    categoryIndex: Number(match[1]),
    dataIndex: match[2] === undefined ? undefined : Number(match[2]),
    pointIndex: match[3] === undefined ? undefined : Number(match[3]),
  }
}

function updateCaseNamePointTitle(point: unknown, nextTitle: string) {
  const pointRecord = toRecord(point)
  if (!pointRecord) return nextTitle
  if ('case_name' in pointRecord) return { ...pointRecord, case_name: nextTitle }
  if ('name' in pointRecord) return { ...pointRecord, name: nextTitle }
  if ('title' in pointRecord) return { ...pointRecord, title: nextTitle }
  if ('test_point' in pointRecord) return { ...pointRecord, test_point: nextTitle }
  return { ...pointRecord, case_name: nextTitle }
}

function updateCategoryCaseNamesContent(content: string, nodeId: string, action: 'rename' | 'delete', nextTitle?: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }

  const rootRecord = toRecord(parsed)
  const path = parseCategoryCaseNameNodePath(nodeId)
  if (!rootRecord || !path || !Array.isArray(rootRecord.categories)) return null

  const categories = [...rootRecord.categories]
  const categoryRecord = toRecord(categories[path.categoryIndex])
  if (!categoryRecord) return null

  if (path.dataIndex === undefined) {
    if (action === 'delete') {
      categories.splice(path.categoryIndex, 1)
    } else if (nextTitle) {
      categories[path.categoryIndex] = { ...categoryRecord, model: nextTitle }
    }
    return JSON.stringify({ ...rootRecord, categories }, null, 2)
  }

  const data = categoryRecord.data
  if (!Array.isArray(data)) return null
  const nextData = [...data]
  const itemRecord = toRecord(nextData[path.dataIndex])
  if (!itemRecord) return null

  if (path.pointIndex === undefined) {
    if (action === 'delete') {
      nextData.splice(path.dataIndex, 1)
      if (nextData.length === 0) {
        categories.splice(path.categoryIndex, 1)
      } else {
        categories[path.categoryIndex] = { ...categoryRecord, data: nextData }
      }
    } else if (nextTitle) {
      nextData[path.dataIndex] = { ...itemRecord, test_model: nextTitle }
      categories[path.categoryIndex] = { ...categoryRecord, data: nextData }
    }
    return JSON.stringify({ ...rootRecord, categories }, null, 2)
  }

  const points = itemRecord.test_points
  if (!Array.isArray(points)) return null
  const nextPoints = [...points]

  if (action === 'delete') {
    nextPoints.splice(path.pointIndex, 1)
    if (nextPoints.length === 0) {
      nextData.splice(path.dataIndex, 1)
    } else {
      nextData[path.dataIndex] = { ...itemRecord, test_points: nextPoints }
    }

    if (nextData.length === 0) {
      categories.splice(path.categoryIndex, 1)
    } else {
      categories[path.categoryIndex] = { ...categoryRecord, data: nextData }
    }
  } else if (nextTitle) {
    nextPoints[path.pointIndex] = updateCaseNamePointTitle(nextPoints[path.pointIndex], nextTitle)
    nextData[path.dataIndex] = { ...itemRecord, test_points: nextPoints }
    categories[path.categoryIndex] = { ...categoryRecord, data: nextData }
  }

  return JSON.stringify({ ...rootRecord, categories }, null, 2)
}

function buildCaseNameTree(content: string, rootTitle: string): CaseNameTreeNode | null {
  if (!content.trim()) return null

  try {
    const parsed = JSON.parse(content)
    const categoryTree = buildCategoryCaseNameTree(parsed, rootTitle)
    if (categoryTree) return categoryTree

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
      kind: 'root',
      children: [...modelMap.entries()].map(([model, testModelMap], modelIndex) => ({
        id: `model-${modelIndex}`,
        title: model,
        kind: 'model',
        children: [...testModelMap.entries()].map(([testModel, testPoints], testModelIndex) => ({
          id: `model-${modelIndex}-test-${testModelIndex}`,
          title: testModel,
          kind: 'testModel',
          children: testPoints.map((point, pointIndex) => ({
            id: `model-${modelIndex}-test-${testModelIndex}-point-${pointIndex}`,
            title: point,
            kind: 'point',
            children: [],
          })),
        })),
      })),
    }
  } catch {
    return null
  }
}

function renameCaseNameTreeNode(tree: CaseNameTreeNode, nodeId: string, nextTitle: string): CaseNameTreeNode {
  if (tree.id === nodeId) {
    return { ...tree, title: nextTitle }
  }

  return {
    ...tree,
    children: tree.children.map((child) => renameCaseNameTreeNode(child, nodeId, nextTitle)),
  }
}

function pruneEmptyCaseNameTreeNode(node: CaseNameTreeNode): CaseNameTreeNode | null {
  if (node.kind === 'point') return node

  const children = node.children
    .map(pruneEmptyCaseNameTreeNode)
    .filter((child): child is CaseNameTreeNode => Boolean(child))

  if (node.kind !== 'root' && children.length === 0) return null
  return { ...node, children }
}

function deleteCaseNameTreeNode(tree: CaseNameTreeNode, nodeId: string): CaseNameTreeNode {
  if (tree.id === nodeId) return tree

  const nextTree = {
    ...tree,
    children: tree.children
      .filter((child) => child.id !== nodeId)
      .map((child) => deleteCaseNameTreeNode(child, nodeId)),
  }

  return pruneEmptyCaseNameTreeNode(nextTree) ?? { ...tree, children: [] }
}

function serializeCaseNameTree(tree: CaseNameTreeNode) {
  const rows = tree.children.flatMap((model) =>
    model.children.map((testModel) => ({
      model: model.title,
      test_model: testModel.title,
      test_points: testModel.children.map((point) => point.title),
    })),
  )

  return JSON.stringify(rows, null, 2)
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

function CaseNameTreeNodeView({
  node,
  className,
  editable,
  onRename,
  onDelete,
}: {
  node: CaseNameTreeNode
  className: string
  editable?: boolean
  onRename?: (nodeId: string, title: string) => void
  onDelete?: (nodeId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(node.title)
  const canEdit = Boolean(editable && node.kind !== 'root')

  useEffect(() => {
    setDraftTitle(node.title)
  }, [node.title])

  function commitEdit() {
    const nextTitle = draftTitle.trim()
    if (!nextTitle) {
      message.warning('节点名称不能为空')
      setDraftTitle(node.title)
      setEditing(false)
      return
    }

    if (nextTitle !== node.title) {
      onRename?.(node.id, nextTitle)
    }
    setEditing(false)
  }

  return (
    <div className={`${className}${canEdit ? ' editable' : ''}`} title={node.title}>
      {editing ? (
        <Input
          className="ai-case-name-tree-node-input"
          size="small"
          value={draftTitle}
          autoFocus
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={commitEdit}
          onPressEnter={commitEdit}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraftTitle(node.title)
              setEditing(false)
            }
          }}
        />
      ) : (
        <span className="ai-case-name-tree-node-label">{node.title}</span>
      )}
      {canEdit && !editing ? (
        <span className="ai-case-name-tree-node-actions">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            aria-label="编辑节点"
            onClick={(event) => {
              event.stopPropagation()
              setEditing(true)
            }}
          />
          <Popconfirm
            title="确认删除该节点？"
            onConfirm={() => onDelete?.(node.id)}
          >
            <Button
              danger
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              aria-label="删除节点"
              onClick={(event) => event.stopPropagation()}
            />
          </Popconfirm>
        </span>
      ) : null}
    </div>
  )
}

function CaseNameTreeView({
  content,
  rootTitle,
  expanded = false,
  editable = false,
  onTreeChange,
}: {
  content: string
  rootTitle: string
  expanded?: boolean
  editable?: boolean
  onTreeChange?: (content: string) => void
}) {
  const tree = buildCaseNameTree(content, rootTitle)
  const counts = countCaseNameTree(tree)

  if (!tree) {
    return <JsonEditor value={content} readOnly foldable minHeight={expanded ? 560 : 260} />
  }

  const treeHeight = getTreeHeight(tree)
  const handleRename = (nodeId: string, title: string) => {
    onTreeChange?.(updateCategoryCaseNamesContent(content, nodeId, 'rename', title) ?? serializeCaseNameTree(renameCaseNameTreeNode(tree, nodeId, title)))
  }
  const handleDelete = (nodeId: string) => {
    onTreeChange?.(updateCategoryCaseNamesContent(content, nodeId, 'delete') ?? serializeCaseNameTree(deleteCaseNameTreeNode(tree, nodeId)))
  }

  return (
    <div className={`ai-case-name-tree${expanded ? ' expanded' : ''}${editable ? ' editable' : ''}`}>
      <div className="ai-case-name-tree-stats">
        <Tag color="green">model {counts.models}</Tag>
        <Tag color="cyan">test_model {counts.testModels}</Tag>
        <Tag color="blue">test_points {counts.testPoints}</Tag>
      </div>
      <div className="ai-case-name-tree-canvas">
        <CaseNameTreeNodeView
          node={tree}
          className="ai-case-name-tree-root"
          editable={editable}
          onRename={handleRename}
          onDelete={handleDelete}
        />
        <CaseNameTreeCurves height={treeHeight} targetYs={getModelTargetYs(tree)} tone="green" />
        <div className="ai-case-name-tree-branches">
          {tree.children.map((model) => (
            <div key={model.id} className="ai-case-name-tree-row">
              <CaseNameTreeNodeView
                node={model}
                className="ai-case-name-tree-node model"
                editable={editable}
                onRename={handleRename}
                onDelete={handleDelete}
              />
              <CaseNameTreeCurves height={getModelHeight(model)} targetYs={getTestModelTargetYs(model)} tone="blue" />
              <div className="ai-case-name-tree-children">
                {model.children.map((testModel) => (
                  <div key={testModel.id} className="ai-case-name-tree-row nested">
                    <CaseNameTreeNodeView
                      node={testModel}
                      className="ai-case-name-tree-node test-model"
                      editable={editable}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                    <CaseNameTreeCurves height={getTestModelHeight(testModel)} targetYs={getPointTargetYs(testModel)} tone="slate" />
                    <div className="ai-case-name-tree-children point-list">
                      {testModel.children.map((point) => (
                        <CaseNameTreeNodeView
                          key={point.id}
                          node={point}
                          className="ai-case-name-tree-node point"
                          editable={editable}
                          onRename={handleRename}
                          onDelete={handleDelete}
                        />
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

function getFunctionalStageMeta(stage?: string) {
  if (!stage) return { label: '未开始', color: 'default' }
  return functionalStageMetaMap[stage] ?? { label: stage, color: 'default' }
}

function getStageConfigField(stage?: string) {
  return stage ? stageConfigFieldMap[stage] : undefined
}

function renderReviewStatusTag(status?: string) {
  const normalizedStatus = normalizeReviewStatus(status)
  const meta = reviewStatusMetaMap[normalizedStatus] ?? {
    label: normalizedStatus,
    color: 'default',
  }

  return <Tag color={meta.color}>{meta.label}</Tag>
}

export function FunctionalCaseGenerateTaskDetailPage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSprintId, setDrawerSprintId] = useState<string | undefined>(undefined)
  const [llmSelectOpen, setLlmSelectOpen] = useState(false)
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState<'instruction' | 'document' | 'runHistory' | null>('runHistory')
  const [selectedRunRecordId, setSelectedRunRecordId] = useState<string | null>(null)
  const [runResultModal, setRunResultModal] = useState<RunResultModalState>(null)
  const [resultModalRunId, setResultModalRunId] = useState<string | null>(null)
  const [reviewSubmitAction, setReviewSubmitAction] = useState<'approve' | 'reject' | null>(null)
  const [importResultView, setImportResultView] = useState<GeneratedCasesViewMode>('json')
  const [checkpointEnabled, setCheckpointEnabled] = useState(false)
  const [stageOutputDraft, setStageOutputDraft] = useState('')
  const [stageOutputDirty, setStageOutputDirty] = useState(false)
  const [stageOutputSourceKey, setStageOutputSourceKey] = useState('')
  const [stageReviewComment, setStageReviewComment] = useState('')
  const [stageReviewAction, setStageReviewAction] = useState<'approve' | 'reject' | null>(null)
  const [runResultCaseNamesView, setRunResultCaseNamesView] = useState<CaseNamesViewMode>('json')
  const [runResultGeneratedCasesView, setRunResultGeneratedCasesView] = useState<GeneratedCasesViewMode>('json')
  const [stageRequirementAnalysisView, setStageRequirementAnalysisView] = useState<RequirementAnalysisViewMode>('json')
  const [form] = Form.useForm<FunctionalCaseGenerateTaskFormValues>()
  const [reviewForm] = Form.useForm<{ comment?: string }>()

  const taskQuery = useQuery({
    queryKey: ['functionalCaseGenerateTask', taskId],
    queryFn: () => api.getFunctionalCaseGenerateTask(taskId),
    enabled: Boolean(taskId),
  })

  const task = taskQuery.data
  const taskRequirementQuery = useQuery({
    queryKey: ['requirement', task?.requirementId],
    queryFn: () => api.getRequirement(task!.requirementId!),
    enabled: Boolean(task?.requirementId),
  })
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
  const selectedStage = selectedRun?.currentStage
  const selectedStageField = getStageConfigField(selectedStage)
  const selectedStageOutputContent = useMemo(
    () =>
      formatStructuredContent(selectedRun?.stageOutput) ||
      getConfigStageFieldContent(selectedRun?.configJson, selectedStageField?.key),
    [selectedRun?.configJson, selectedRun?.stageOutput, selectedStageField?.key],
  )
  const selectedRunResultSections = useMemo(
    () =>
      selectedRun
        ? runResultSectionDefinitions
            .map((section) => {
              const rawValue =
                section.key === 'enhancedText' ||
                section.key === 'requirementAnalysis' ||
                section.key === 'caseNames'
                  ? getConfigStageFieldContent(selectedRun.configJson, section.key)
                  : selectedRun[section.key as keyof FunctionalCaseGenerateTaskRun]
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
    setRunResultModal(null)
  }, [selectedRunId])

  useEffect(() => {
    if (runResultModal?.key !== 'caseNames') {
      setRunResultCaseNamesView('json')
    }
    if (runResultModal?.key !== 'resultYaml') {
      setRunResultGeneratedCasesView('json')
    }
    if (runResultModal?.key !== selectedStageField?.key) {
      setStageRequirementAnalysisView('json')
    }
  }, [runResultModal?.key, selectedStageField?.key])

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
    mutationFn: ({ connectionId, checkpointEnabled }: { connectionId: string; checkpointEnabled?: boolean }) =>
      api.runFunctionalCaseGenerateTask(taskId, { connectionId, checkpointEnabled }),
    onSuccess: (run) => {
      message.success('任务已加入执行队列')
      setLlmSelectOpen(false)
      setCheckpointEnabled(false)
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
      message.success(payload.body.action === 'approve' ? '已导入功能测试集' : '已丢弃本次生成结果')
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

  const saveStageOutputMutation = useMutation({
    mutationFn: (payload: { runId: string; stage: string; configJson: string; silent?: boolean }) =>
      api.updateFunctionalCaseGenerateTaskRunStageOutput(payload.runId, {
        stage: payload.stage,
        configJson: payload.configJson,
      }),
    onSuccess: (updatedRun, payload) => {
      if (!payload.silent) {
        message.success('阶段产物已保存')
      }
      setStageOutputDirty(false)
      queryClient.setQueryData(['functionalCaseGenerateTaskRun', payload.runId], updatedRun)
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRun', payload.runId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRuns', taskId] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
    },
  })

  const reviewStageMutation = useMutation({
    mutationFn: (payload: {
      runId: string
      body: { stage: string; action: 'approve'; comment?: string } | { stage: string; action: 'reject'; comment?: string }
    }) => api.reviewFunctionalCaseGenerateTaskRunStage(payload.runId, payload.body),
    onSuccess: (updatedRun, payload) => {
      message.success(payload.body.action === 'approve' ? '阶段审核已通过，继续生成' : '已拒绝并停止继续生成')
      setStageReviewAction(null)
      setStageReviewComment('')
      setSelectedRunRecordId(updatedRun.runId ?? payload.runId)
      queryClient.setQueryData(['functionalCaseGenerateTaskRun', payload.runId], updatedRun)
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRun', payload.runId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRuns', taskId] })
    },
    onError: (error) => {
      message.error(getErrorMessage(error))
      setStageReviewAction(null)
    },
  })

  const retryStageMutation = useMutation({
    mutationFn: (payload: { runId: string; stage: string }) =>
      api.retryFunctionalCaseGenerateTaskRunStage(payload.runId, { stage: payload.stage }),
    onSuccess: (updatedRun, payload) => {
      message.success('已提交阶段重试，等待重新执行')
      setSelectedRunRecordId(updatedRun.runId ?? payload.runId)
      queryClient.setQueryData(['functionalCaseGenerateTaskRun', payload.runId], updatedRun)
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRun', payload.runId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTaskRuns', taskId] })
      queryClient.invalidateQueries({ queryKey: ['functionalCaseGenerateTask', taskId] })
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
      navigate('/ai-testing?tab=tasks')
    },
  })

  const runnableTask = isRunnableApiCaseGenerateTaskRun(latestRunRecord?.status)
  const detailItems = useMemo(
    () =>
      task
        ? [
            { label: '任务名称', value: task.name || '-' },
            { label: '迭代', value: sprintNameMap.get(task.sprintId ?? '') ?? task.sprintId ?? '-' },
            {
              label: '需求',
              value:
                taskRequirementQuery.data?.name ??
                requirementNameMap.get(task.requirementId ?? '') ??
                task.requirementId ??
                '-',
            },
            { label: '更新时间', value: formatTime(pickUpdatedAt(task)) },
          ]
        : [],
    [requirementNameMap, sprintNameMap, task, taskRequirementQuery.data?.name],
  )
  const selectedRunResultSectionMap = useMemo(
    () => new Map(selectedRunResultSections.map((section) => [section.key, section.value])),
    [selectedRunResultSections],
  )
  const runResultModalContent = runResultModal ? selectedRunResultSectionMap.get(runResultModal.key) : undefined
  const selectedRunImportStats = useMemo(
    () => getGeneratedCaseImportStats(selectedRun?.resultYaml),
    [selectedRun?.resultYaml],
  )
  const importTargetRequirementName = task?.requirementId
    ? taskRequirementQuery.data?.name ?? requirementNameMap.get(task.requirementId) ?? task.requirementId
    : selectedRun?.requirementId
      ? requirementNameMap.get(selectedRun.requirementId) ?? selectedRun.requirementId
      : '-'
  const runHistoryRefreshing = runsQuery.isFetching || selectedRunQuery.isFetching
  const resultModalOpen = Boolean(resultModalRunId)
  const selectedRunReviewStatus = normalizeReviewStatus(selectedRun?.reviewStatus)
  const selectedRunStatus = String(selectedRun?.status ?? '')
  const selectedStageMeta = getFunctionalStageMeta(selectedStage)
  const stageOutputIsCaseNames = selectedStageField?.key === 'caseNames'
  const stageOutputIsRequirementAnalysis = selectedStageField?.key === 'requirementAnalysis'
  const selectedStageStatusMeta = getApiCaseGenerateTaskRunStatusMeta(selectedRun?.stageStatus)
  const canRetryStage = Boolean(
    selectedRun?.checkpointEnabled &&
      selectedRun?.stageStatus === 'failed' &&
      (selectedRunStatus === 'failed' || selectedRunStatus === 'error'),
  )
  const checkpointStageWaitingReview = Boolean(
    selectedRun?.checkpointEnabled &&
      selectedRunStatus === 'waiting_review' &&
      selectedRun?.stageStatus === 'waiting_review' &&
      selectedStage,
  )
  const showStageReviewInRunResultModal = runResultModal?.key === selectedStageField?.key && checkpointStageWaitingReview
  const checkpointStageVisible = Boolean(
    selectedRun?.checkpointEnabled &&
      selectedStage &&
      selectedRunStatus !== 'success' &&
      selectedRunStatus !== 'failed' &&
      selectedRunStatus !== 'error' &&
      selectedRunStatus !== 'canceled',
  )
  const stageActionPending = saveStageOutputMutation.isPending || reviewStageMutation.isPending
  const canReviewSelectedRun = Boolean(selectedRun) && selectedRunReviewStatus === 'pending' && selectedRunStatus === 'success'

  useEffect(() => {
    if (!resultModalRunId) {
      reviewForm.resetFields()
      return
    }
    reviewForm.setFieldsValue({ comment: selectedRun?.reviewComment || undefined })
  }, [resultModalRunId, reviewForm, selectedRun?.reviewComment])

  useEffect(() => {
    const nextSourceKey = `${selectedRun?.runId ?? ''}:${selectedRun?.currentStage ?? ''}`

    if (stageOutputSourceKey !== nextSourceKey) {
      setStageOutputSourceKey(nextSourceKey)
      setStageOutputDraft(selectedStageOutputContent)
      setStageOutputDirty(false)
      setStageRequirementAnalysisView('json')
      setStageReviewComment('')
      setStageReviewAction(null)
      return
    }

    if (!stageOutputDirty) {
      setStageOutputDraft(selectedStageOutputContent)
    }
  }, [
    selectedRun?.currentStage,
    selectedRun?.runId,
    selectedStageOutputContent,
    stageOutputDirty,
    stageOutputSourceKey,
  ])

  function toggleSection(section: 'instruction' | 'document' | 'runHistory') {
    setExpandedSection((current) => (current === section ? null : section))
  }

  async function handleRunTask() {
    if (runsQuery.isLoading) {
      message.warning('运行记录加载中，请稍后再试')
      return
    }
    if (!runnableTask) {
      message.warning('任务执行中，暂时不能重复运行')
      return
    }

    let requirement = taskRequirementQuery.data
    if (!requirement && task?.requirementId) {
      try {
        requirement = await queryClient.fetchQuery({
          queryKey: ['requirement', task.requirementId],
          queryFn: () => api.getRequirement(task.requirementId!),
        })
      } catch (error) {
        message.error(getErrorMessage(error))
        return
      }
    }

    if (!hasRequirementDocument(requirement)) {
      message.warning('当前需求未配置需求文档，请先在需求中填写纯文本正文或上传 DOCX 文档')
      return
    }

    setLlmSelectOpen(true)
  }

  function handleLlmSelectConfirm(connectionId: string) {
    runTaskMutation.mutate({ connectionId, checkpointEnabled })
  }

  function handleRefreshRuns() {
    void runsQuery.refetch()
    if (selectedRunId) {
      void selectedRunQuery.refetch()
    }
  }

  function handleSaveStageOutput() {
    if (!selectedRun?.runId || !selectedStage) return
    if (!stageOutputDraft.trim()) {
      message.warning('阶段产物不能为空')
      return
    }
    saveStageOutputMutation.mutate({
      runId: selectedRun.runId,
      stage: selectedStage,
      configJson: stageOutputDraft,
    })
  }

  async function handleApproveStageReview() {
    if (!selectedRun?.runId || !selectedStage) return
    if (!stageOutputDraft.trim()) {
      message.warning('阶段产物不能为空')
      return
    }
    setStageReviewAction('approve')
    try {
      await saveStageOutputMutation.mutateAsync({
        runId: selectedRun.runId,
        stage: selectedStage,
        configJson: stageOutputDraft,
        silent: true,
      })
      await reviewStageMutation.mutateAsync({
        runId: selectedRun.runId,
        body: {
          stage: selectedStage,
          action: 'approve',
          comment: stageReviewComment.trim() || undefined,
        },
      })
    } catch {
      setStageReviewAction(null)
    }
  }

  function handleRejectStageReview() {
    if (!selectedRun?.runId || !selectedStage) return
    setStageReviewAction('reject')
    reviewStageMutation.mutate({
      runId: selectedRun.runId,
      body: {
        stage: selectedStage,
        action: 'reject',
        comment: stageReviewComment.trim() || undefined,
      },
    })
  }

  function handleRetryStage() {
    if (!selectedRun?.runId || !selectedStage || !canRetryStage) return
    retryStageMutation.mutate({
      runId: selectedRun.runId,
      stage: selectedStage,
    })
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
      message.warning('任务执行中，暂时不能导入')
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
      message.warning('任务执行中，暂时不能导入')
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

  return (
    <div className="workbench-page ai-testing-page">
      <div className="workbench-tabs">
        {taskQuery.error ? <Alert showIcon type="error" title={getErrorMessage(taskQuery.error)} /> : null}
        {runsQuery.error ? <Alert showIcon type="error" title={getErrorMessage(runsQuery.error)} /> : null}

        {!task && taskQuery.isLoading ? (
          <Spin />
        ) : task ? (
          <div className="ai-task-detail-layout">
            <Card className="ai-task-detail-summary-card">
              <div className="ai-task-detail-inline-meta">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ai-testing?tab=tasks')}>
                  返回生成任务
                </Button>
                {detailItems.map((item) => (
                  <div key={item.label} className="ai-task-detail-inline-item">
                    <span className="ai-task-detail-inline-label">{item.label}</span>
                    <span className="ai-task-detail-inline-value">{item.value}</span>
                  </div>
                ))}
                <div className="ai-task-detail-inline-actions">
                  <AiTaskQuickLinks />
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
                className="ai-task-detail-card ai-task-detail-fold-card ai-task-detail-fold-card-source collapsed"
                title={
                  <button type="button" className="ai-task-detail-fold-trigger" onClick={() => setDocumentPreviewOpen(true)}>
                    <span>需求文档</span>
                  </button>
                }
              />

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
                          const reviewStatus = normalizeReviewStatus(active && selectedRun ? selectedRun.reviewStatus : record.reviewStatus)
                          const recordStatus = String(active && selectedRun ? selectedRun.status ?? '' : record.status ?? '')
                          const recordSucceeded = recordStatus.toLowerCase() === 'success'
                          const recordResultYaml = active && selectedRun ? selectedRun.resultYaml : record.resultYaml
                          const recordHasResultYaml = Boolean(formatStructuredContent(recordResultYaml))
                          const canReviewRecord = reviewStatus === 'pending' && recordStatus === 'success'
                          const visibleSections = runResultSectionDefinitions.filter(
                            (section) => {
                              if (section.key === 'enhancedText') {
                                return active && section.key === selectedStageField?.key && checkpointStageWaitingReview
                              }
                              if (section.key === 'resultYaml') return recordSucceeded || recordHasResultYaml
                              if (section.key === 'errorMessage') return !recordSucceeded
                              return true
                            },
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
                                  <span className="ai-task-run-history-record-status">{renderRunStatusTag(active && selectedRun ? selectedRun.status : record.status)}</span>
                                  {active && selectedRun?.checkpointEnabled && selectedRun.currentStage ? (
                                    <span className="ai-task-run-history-record-stage">
                                      <Tag color={selectedStageMeta.color}>{selectedStageMeta.label}</Tag>
                                    </span>
                                  ) : null}
                                  {recordSucceeded ? (
                                    <span className="ai-task-run-history-review-status">{renderReviewStatusTag(active && selectedRun ? selectedRun.reviewStatus : record.reviewStatus)}</span>
                                  ) : null}
                                  <span className="ai-task-run-history-record-field">开始：{formatTime(record.startedAt)}</span>
                                  <span className="ai-task-run-history-record-field">结束：{formatTime(record.finishedAt)}</span>
                                  <span className="ai-task-run-history-record-field">耗时：{formatDurationSeconds(record.durationMs)}</span>
                                </div>
                              </div>
                              <div className="ai-task-run-history-record-actions">
                                {visibleSections.map((section) => {
                                  const showStageReviewInConfig = active && section.key === selectedStageField?.key && checkpointStageWaitingReview
                                  const isOpen = active && runResultModal?.key === section.key
                                  const sectionLabel = showStageReviewInConfig ? '审核' : section.label

                                  return (
                                    <button
                                      key={section.key}
                                      type="button"
                                      className={`ai-task-run-result-popover-btn${isOpen ? ' active' : ''}${showStageReviewInConfig ? ' review' : ''}`}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        setSelectedRunRecordId(record.runId ?? null)
                                        setRunResultModal({ key: section.key, label: sectionLabel })
                                      }}
                                    >
                                      {sectionLabel}
                                    </button>
                                  )
                                })}
                                {active && selectedRun ? (
                                  <div className="ai-task-run-history-review-inline">
                                    {canRetryStage ? (
                                      <Button
                                        size="small"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          handleRetryStage()
                                        }}
                                        loading={retryStageMutation.isPending}
                                      >
                                        重试阶段
                                      </Button>
                                    ) : null}
                                    {selectedRun.reviewedAt ? (
                                      <span className="ai-task-run-history-record-field">导入时间：{formatTime(selectedRun.reviewedAt)}</span>
                                    ) : null}
                                    {selectedRun.reviewComment ? (
                                      <Popover trigger="click" placement="bottomRight" content={<div className="ai-task-run-review-comment">{selectedRun.reviewComment}</div>}>
                                        <button type="button" className="ai-task-run-review-note-btn" onClick={(event) => event.stopPropagation()}>
                                          导入备注
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
                                        导入
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
                        {selectedRun && selectedRunResultSections.length === 0 && !checkpointStageVisible ? (
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
          <Alert showIcon type="warning" title="未找到对应任务" />
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
          className="ai-task-run-result-modal"
          title="需求文档"
          open={documentPreviewOpen}
          onCancel={() => setDocumentPreviewOpen(false)}
          footer={[
            <Button key="close" type="primary" onClick={() => setDocumentPreviewOpen(false)}>
              关闭
            </Button>,
          ]}
          width="min(1620px, calc(100vw - 72px))"
          centered
          destroyOnHidden
        >
          <div className="ai-task-run-result-modal-content ai-task-document-preview-modal-content">
            {taskRequirementQuery.isLoading ? (
              <div className="ai-task-run-result-popover-loading">
                <Spin />
              </div>
            ) : taskRequirementQuery.data && hasRequirementDocument(taskRequirementQuery.data) ? (
              <RequirementDocumentPreviewContent
                requirementId={normalizeRequirementId(taskRequirementQuery.data)}
                requirementName={taskRequirementQuery.data.name}
                documentType={taskRequirementQuery.data.documentType}
                documentContent={taskRequirementQuery.data.documentContent}
                documentFilename={taskRequirementQuery.data.documentFilename}
                documentDownloadUrl={taskRequirementQuery.data.documentDownloadUrl}
              />
            ) : (
              <pre className="ai-task-code-block">-</pre>
            )}
          </div>
        </Modal>

        <Modal
          className={`ai-task-run-result-modal${showStageReviewInRunResultModal ? ' review' : ''}`}
          title={showStageReviewInRunResultModal ? '审核' : runResultModal?.label ?? '运行结果'}
          open={Boolean(runResultModal)}
          onCancel={() => setRunResultModal(null)}
          footer={
            showStageReviewInRunResultModal
              ? [
                  <Button key="close" onClick={() => setRunResultModal(null)}>
                    关闭
                  </Button>,
                  <Button
                    key="save"
                    onClick={handleSaveStageOutput}
                    loading={saveStageOutputMutation.isPending && !stageReviewAction}
                    disabled={reviewStageMutation.isPending}
                  >
                    保存
                  </Button>,
                  <Button
                    key="reject"
                    danger
                    ghost
                    onClick={handleRejectStageReview}
                    loading={reviewStageMutation.isPending && stageReviewAction === 'reject'}
                    disabled={saveStageOutputMutation.isPending}
                  >
                    审核不通过
                  </Button>,
                  <Button
                    key="approve"
                    type="primary"
                    onClick={handleApproveStageReview}
                    loading={stageActionPending && stageReviewAction === 'approve'}
                    disabled={reviewStageMutation.isPending && stageReviewAction !== 'approve'}
                  >
                    审核通过并继续
                  </Button>,
                ]
              : [
                  <Button key="close" type="primary" onClick={() => setRunResultModal(null)}>
                    关闭
                  </Button>,
                ]
          }
          width="min(1620px, calc(100vw - 72px))"
          centered
          destroyOnHidden
        >
          <div className={`ai-task-run-result-modal-content${showStageReviewInRunResultModal ? ' review' : ''}`}>
            {selectedRunQuery.isLoading ? (
              <div className="ai-task-run-result-popover-loading">
                <Spin />
              </div>
            ) : showStageReviewInRunResultModal ? (
              <div className="ai-task-stage-review-popover">
                <div className="ai-task-run-result-popover-header">
                  <span>阶段产物 {selectedStageField?.label ?? '当前阶段'}</span>
                  <div className="ai-task-stage-review-mini-tags">
                    <Tag color={selectedStageMeta.color}>{selectedStageMeta.label}</Tag>
                    <Tag color={selectedStageStatusMeta.color}>{selectedStageStatusMeta.label}</Tag>
                  </div>
                </div>
                <div className="ai-task-stage-review-note compact">
                  <strong>待审核/可编辑</strong>
                  <span>当前编辑的是本阶段产物，保存后会写回当前阶段输出，审核通过后继续进入下一阶段。</span>
                </div>
                {stageOutputIsCaseNames ? (
                  <Tabs
                    className="ai-case-names-inner-tabs expanded review"
                    size="small"
                    items={[
                      {
                        key: 'json',
                        label: 'json',
                        children: (
                          <TextCodeEditor
                            value={stageOutputDraft}
                            onChange={(value) => {
                              setStageOutputDraft(value)
                              setStageOutputDirty(true)
                            }}
                            minHeight={360}
                          />
                        ),
                      },
                      {
                        key: 'tree',
                        label: '树图',
                        children: (
                          <CaseNameTreeView
                            content={stageOutputDraft}
                            rootTitle={task?.name || '功能测试用例生成'}
                            expanded
                            editable
                            onTreeChange={(value) => {
                              setStageOutputDraft(value)
                              setStageOutputDirty(true)
                            }}
                          />
                        ),
                      },
                    ]}
                  />
                ) : stageOutputIsRequirementAnalysis ? (
                  <Tabs
                    className="ai-requirement-analysis-tabs review"
                    size="small"
                    activeKey={stageRequirementAnalysisView}
                    onChange={(key) => setStageRequirementAnalysisView(key as RequirementAnalysisViewMode)}
                    items={[
                      {
                        key: 'json',
                        label: 'json',
                        children: (
                          <TextCodeEditor
                            value={stageOutputDraft}
                            onChange={(value) => {
                              setStageOutputDraft(value)
                              setStageOutputDirty(true)
                            }}
                            minHeight={360}
                          />
                        ),
                      },
                      {
                        key: 'diagram',
                        label: '图像',
                        children: (
                          <div className="ai-requirement-analysis-review-diagram">
                            <RequirementAnalysisDiagramView content={stageOutputDraft} />
                          </div>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <TextCodeEditor
                    value={stageOutputDraft}
                    onChange={(value) => {
                      setStageOutputDraft(value)
                      setStageOutputDirty(true)
                    }}
                    minHeight={360}
                  />
                )}
                <Input.TextArea
                  className="ai-task-stage-review-comment"
                  value={stageReviewComment}
                  onChange={(event) => setStageReviewComment(event.target.value)}
                  rows={2}
                  placeholder="审核备注，可选"
                />
              </div>
            ) : runResultModalContent ? (
              runResultModal?.key === 'caseNames' ? (
                <CaseNamesResultView
                  content={runResultModalContent}
                  rootTitle={task?.name || '功能测试用例生成'}
                  expanded
                  activeView={runResultCaseNamesView}
                  onViewChange={setRunResultCaseNamesView}
                />
              ) : runResultModal?.key === 'requirementAnalysis' ? (
                <RequirementAnalysisView content={runResultModalContent} />
              ) : runResultModal?.key === 'enhancedText' ? (
                isJsonText(runResultModalContent) ? (
                  <JsonEditor value={runResultModalContent} readOnly foldable minHeight={640} />
                ) : (
                  <pre className="ai-task-code-block">{runResultModalContent}</pre>
                )
              ) : runResultModal?.key === 'resultYaml' ? (
                <GeneratedCasesResultView
                  content={runResultModalContent}
                  expanded
                  activeView={runResultGeneratedCasesView}
                  onViewChange={setRunResultGeneratedCasesView}
                />
              ) : (
                <pre className="ai-task-code-block">{runResultModalContent}</pre>
              )
            ) : (
              <div className="ai-task-run-result-popover-empty">暂无内容</div>
            )}
          </div>
        </Modal>

        <Modal
          className="ai-task-import-result-modal"
          title={canReviewSelectedRun ? '导入 AI 生成结果' : '功能测试用例生成结果'}
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
                    不导入
                  </Button>,
                  <Button
                    key="approve"
                    type="primary"
                    loading={reviewRunMutation.isPending && reviewSubmitAction === 'approve'}
                    onClick={handleApproveReview}
                  >
                    确认导入
                  </Button>,
                ]
              : [
                  <Button key="close" type="primary" onClick={closeResultModal}>
                    关闭
                  </Button>,
                ]
          }
          width="min(1620px, calc(100vw - 72px))"
          centered
          destroyOnHidden
        >
          <Form form={reviewForm} layout="vertical" className="ai-task-import-result-form">
            <div className="ai-task-import-target-summary">
              <div className="ai-task-import-target-copy">
                <strong>导入到当前任务关联需求</strong>
                <span title={importTargetRequirementName}>目标需求：{importTargetRequirementName}</span>
              </div>
              <div className="ai-task-import-target-stats">
                <Tag color="cyan">模块 {selectedRunImportStats.moduleCount}</Tag>
                <Tag color="blue">用例 {selectedRunImportStats.caseCount}</Tag>
              </div>
            </div>
            <div className="ai-task-review-modal-content ai-task-result-preview-modal-content ai-task-import-result-preview-content single-column">
              <div className="ai-task-review-modal-section">
                <div className="ai-task-review-modal-label">生成结果</div>
                <div className="ai-task-review-modal-preview ai-task-import-result-preview">
                  {selectedRunQuery.isLoading ? (
                    <div className="ai-task-run-result-popover-loading">
                      <Spin />
                    </div>
                  ) : selectedRun?.resultYaml ? (
                    <GeneratedCasesResultView
                      content={formatStructuredContent(selectedRun.resultYaml)}
                      expanded
                      activeView={importResultView}
                      onViewChange={setImportResultView}
                    />
                  ) : (
                    <div className="ai-task-run-result-popover-empty">当前记录暂无结果</div>
                  )}
                </div>
              </div>
            </div>
            <Form.Item label="导入备注" name="comment">
              <Input.TextArea rows={4} placeholder="请输入导入备注或不导入原因" disabled={!canReviewSelectedRun} />
            </Form.Item>
          </Form>
        </Modal>

        <LlmConnectionSelectModal
          open={llmSelectOpen}
          onClose={() => {
            setLlmSelectOpen(false)
            setCheckpointEnabled(false)
          }}
          onConfirm={handleLlmSelectConfirm}
          loading={runTaskMutation.isPending}
          showCheckpointOption
          checkpointEnabled={checkpointEnabled}
          onCheckpointEnabledChange={setCheckpointEnabled}
        />
      </div>
    </div>
  )
}
