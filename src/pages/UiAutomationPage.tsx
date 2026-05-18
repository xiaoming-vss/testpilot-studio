import { Alert, Empty, Select, Typography } from 'antd'
import { Button, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UiTestSuiteSection, type UiTestSuiteSectionRef } from '../components/UiTestSuiteSection'
import { api, type Requirement, type Sprint } from '../services/api'
import { useWorkbenchStore } from '../store/workbench'
import { getErrorMessage, normalizeRequirementId, normalizeSprintId, pickCreatedAt } from '../utils/format'

const { Text } = Typography

type ProjectScopedSelection = {
  projectId?: string
  value?: string | null
}

function pickLatestItem<T>(items: T[], getTime: (item: T) => string | undefined) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(getTime(left) ?? 0).getTime()
    const rightTime = new Date(getTime(right) ?? 0).getTime()
    return rightTime - leftTime
  })[0]
}

export function UiAutomationPage() {
  const activeProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const uiTestSuiteSectionRef = useRef<UiTestSuiteSectionRef | null>(null)
  const [sprintSelection, setSprintSelection] = useState<ProjectScopedSelection>({})
  const [requirementSelection, setRequirementSelection] = useState<ProjectScopedSelection>({})

  const sprintsQuery = useQuery({
    queryKey: ['sprints', activeProjectId],
    queryFn: () => api.getSprints(activeProjectId!),
    enabled: Boolean(activeProjectId),
  })
  const sprints = sprintsQuery.data ?? []
  const latestSprint = useMemo(() => pickLatestItem<Sprint>(sprints, pickCreatedAt), [sprints])
  const currentSprintSelection = sprintSelection.projectId === activeProjectId ? sprintSelection.value : undefined
  const resolvedSelectedSprintId =
    currentSprintSelection === undefined
      ? latestSprint
        ? normalizeSprintId(latestSprint)
        : undefined
      : currentSprintSelection ?? undefined

  const requirementsQuery = useQuery({
    queryKey: ['requirements', resolvedSelectedSprintId],
    queryFn: () => api.getRequirements(resolvedSelectedSprintId!),
    enabled: Boolean(resolvedSelectedSprintId),
  })
  const requirements = requirementsQuery.data ?? []
  const latestRequirement = useMemo(() => pickLatestItem<Requirement>(requirements, pickCreatedAt), [requirements])
  const currentRequirementSelection = requirementSelection.projectId === activeProjectId ? requirementSelection.value : undefined
  const resolvedSelectedRequirementId =
    currentRequirementSelection === undefined
      ? latestRequirement
        ? normalizeRequirementId(latestRequirement)
        : undefined
      : currentRequirementSelection ?? undefined

  const sprintFilterOptions = useMemo(
    () => sprints.map((sprint) => ({ label: sprint.name, value: normalizeSprintId(sprint) })),
    [sprints],
  )

  const requirementFilterOptions = useMemo(
    () => requirements.map((requirement) => ({ label: requirement.name, value: normalizeRequirementId(requirement) })),
    [requirements],
  )

  return (
    <div className="workbench-page api-automation-page">
      <div className="api-automation-content">
        <section className="workbench-panel workbench-board-panel">
          <div className="panel-header api-panel-header">
            <div className="requirement-panel-head">
              <Text strong>UI测试集</Text>
              <div className="api-filter-group">
                <div className="api-filter-field">
                  <span className="api-filter-field-label">迭代</span>
                  <Select
                    className="api-filter-select business-filter-select"
                    value={resolvedSelectedSprintId}
                    options={sprintFilterOptions}
                    loading={sprintsQuery.isLoading}
                    placeholder="请选择迭代"
                    onChange={(value) => {
                      setSprintSelection({
                        projectId: activeProjectId,
                        value,
                      })
                      setRequirementSelection({
                        projectId: activeProjectId,
                        value: undefined,
                      })
                    }}
                  />
                </div>
                <div className="api-filter-field">
                  <span className="api-filter-field-label">需求</span>
                  <Select
                    className="api-filter-select business-filter-select"
                    value={resolvedSelectedRequirementId}
                    options={requirementFilterOptions}
                    loading={requirementsQuery.isLoading}
                    placeholder="请选择需求"
                    disabled={!resolvedSelectedSprintId}
                    onChange={(value) => {
                      setRequirementSelection({
                        projectId: activeProjectId,
                        value,
                      })
                    }}
                  />
                </div>
              </div>
            </div>
            <Space size={8}>
              <Button
                type="primary"
                className="action-btn-create"
                icon={<PlusOutlined />}
                disabled={!resolvedSelectedRequirementId}
                onClick={() => uiTestSuiteSectionRef.current?.openCreateDrawer()}
              >
                新建测试集
              </Button>
            </Space>
          </div>

          {sprintsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintsQuery.error)} /> : null}
          {requirementsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(requirementsQuery.error)} /> : null}

          {!activeProjectId ? (
            <div className="sprint-card-loading">
              <Empty description="请先选择项目" />
            </div>
          ) : !resolvedSelectedSprintId ? (
            <div className="sprint-card-loading">
              <Empty description="当前项目下暂无迭代" />
            </div>
          ) : !resolvedSelectedRequirementId ? (
            <div className="sprint-card-loading">
              <Empty description="请选择一个需求后查看 UI测试集" />
            </div>
          ) : (
            <UiTestSuiteSection
              ref={uiTestSuiteSectionRef}
              requirementId={resolvedSelectedRequirementId}
              selectedSprintId={resolvedSelectedSprintId}
              sprintOptions={sprintFilterOptions}
              requirementOptions={requirementFilterOptions}
              onCreateSprintChange={(value) => {
                setSprintSelection({
                  projectId: activeProjectId,
                  value,
                })
                setRequirementSelection({
                  projectId: activeProjectId,
                  value: undefined,
                })
              }}
              showInlineCreateButton={false}
            />
          )}
        </section>
      </div>
    </div>
  )
}
