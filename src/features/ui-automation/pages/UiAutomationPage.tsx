import { Alert, Empty, Select, Typography } from 'antd'
import { Button, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useRef } from 'react'
import { useSprintRequirementScope } from '@/features/projects/hooks/useSprintRequirementScope'
import { UiTestSuiteSection, type UiTestSuiteSectionRef } from '@/features/ui-automation/components/UiTestSuiteSection'
import { useWorkbenchStore } from '@/features/projects/store/workbench.store'
import { getErrorMessage } from '@/utils/format'

const { Text } = Typography

type UiAutomationPageScope = {
  projectId?: string
  sprintId?: string
  sprintName?: string
  requirementId?: string
  requirementName?: string
}

export function UiAutomationPage({ scope }: { scope?: UiAutomationPageScope }) {
  const workbenchActiveProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const activeProjectId = scope?.projectId ?? workbenchActiveProjectId
  const uiTestSuiteSectionRef = useRef<UiTestSuiteSectionRef | null>(null)
  const isRequirementLocked = Boolean(scope?.requirementId)
  const {
    requirementFilterOptions,
    requirementsQuery,
    resolvedSelectedRequirementId,
    resolvedSelectedSprintId,
    selectRequirement,
    selectSprint,
    sprintFilterOptions,
    sprintsQuery,
  } = useSprintRequirementScope({ activeProjectId })
  const selectedSprintId = scope?.sprintId ?? resolvedSelectedSprintId
  const selectedRequirementId = scope?.requirementId ?? resolvedSelectedRequirementId

  return (
    <div className="workbench-page api-automation-page">
      <div className="api-automation-content">
        <section className="workbench-panel workbench-board-panel">
          <div className="panel-header api-panel-header">
            <div className="requirement-panel-head">
              <Text strong>UI测试集</Text>
              {!isRequirementLocked ? (
                <div className="api-filter-group">
                  <div className="api-filter-field">
                    <span className="api-filter-field-label">迭代</span>
                    <Select
                      className="api-filter-select business-filter-select"
                      value={selectedSprintId}
                      options={sprintFilterOptions}
                      loading={sprintsQuery.isLoading}
                      placeholder="请选择迭代"
                      onChange={selectSprint}
                    />
                  </div>
                  <div className="api-filter-field">
                    <span className="api-filter-field-label">需求</span>
                    <Select
                      className="api-filter-select business-filter-select"
                      value={selectedRequirementId}
                      options={requirementFilterOptions}
                      loading={requirementsQuery.isLoading}
                      placeholder="请选择需求"
                      disabled={!selectedSprintId}
                      onChange={selectRequirement}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <Space size={8}>
              <Button
                type="primary"
                className="action-btn-create"
                icon={<PlusOutlined />}
                disabled={!selectedRequirementId}
                onClick={() => uiTestSuiteSectionRef.current?.openCreateDrawer()}
              >
                新建测试集
              </Button>
            </Space>
          </div>

          {sprintsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(sprintsQuery.error)} /> : null}
          {!isRequirementLocked ? <>{requirementsQuery.error ? <Alert showIcon type="error" message={getErrorMessage(requirementsQuery.error)} /> : null}</> : null}

          {!activeProjectId ? (
            <div className="sprint-card-loading">
              <Empty description="请先选择项目" />
            </div>
          ) : !isRequirementLocked && !selectedSprintId ? (
            <div className="sprint-card-loading">
              <Empty description="当前项目下暂无迭代" />
            </div>
          ) : !selectedRequirementId ? (
            <div className="sprint-card-loading">
              <Empty description={isRequirementLocked ? '当前需求不可用' : '请选择一个需求后查看 UI测试集'} />
            </div>
          ) : (
            <UiTestSuiteSection
              ref={uiTestSuiteSectionRef}
              requirementId={selectedRequirementId}
              selectedSprintId={selectedSprintId}
              sprintOptions={isRequirementLocked ? undefined : sprintFilterOptions}
              requirementOptions={isRequirementLocked ? undefined : requirementFilterOptions}
              sprintName={scope?.sprintName}
              requirementName={scope?.requirementName}
              onCreateSprintChange={selectSprint}
              showInlineCreateButton={false}
            />
          )}
        </section>
      </div>
    </div>
  )
}
