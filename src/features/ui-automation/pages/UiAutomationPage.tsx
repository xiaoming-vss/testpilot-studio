import { Alert, Empty, Select, Typography } from 'antd'
import { Button, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useRef } from 'react'
import { useSprintRequirementScope } from '@/features/projects/hooks/useSprintRequirementScope'
import { UiTestSuiteSection, type UiTestSuiteSectionRef } from '@/features/ui-automation/components/UiTestSuiteSection'
import { useWorkbenchStore } from '@/store/workbench'
import { getErrorMessage } from '@/utils/format'

const { Text } = Typography

export function UiAutomationPage() {
  const activeProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const uiTestSuiteSectionRef = useRef<UiTestSuiteSectionRef | null>(null)
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
                    onChange={selectSprint}
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
                    onChange={selectRequirement}
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
              onCreateSprintChange={selectSprint}
              showInlineCreateButton={false}
            />
          )}
        </section>
      </div>
    </div>
  )
}
