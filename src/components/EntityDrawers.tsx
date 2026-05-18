import { Alert, Button, DatePicker, Drawer, Form, Input, InputNumber, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { Requirement, RequirementCreatePayload, Sprint, SprintCreatePayload } from '../services/api'
import { getErrorMessage } from '../utils/format'

type DateLikeValue = string | Date | { toDate?: () => Date; toISOString?: () => string } | null | undefined

export type SprintFormValues = Omit<SprintCreatePayload, 'startTime' | 'endTime'> & {
  startTime: DateLikeValue
  endTime?: DateLikeValue
} & Partial<Pick<Sprint, 'status'>>

export type RequirementFormValues = RequirementCreatePayload &
  Partial<Pick<Requirement, 'status'>> & {
    sprintId?: string
  }

export type CollectionFormValues = {
  sprintId?: string
  requirementId?: string
  name: string
  summary?: string
}

export type UiTestSuiteFormValues = {
  sprintId?: string
  requirementId?: string
  name: string
  description?: string
  headless?: boolean
  slowMoMs?: number
  viewportWidth?: number
  viewportHeight?: number
  defaultStepTimeoutMs?: number
}

export const DEFAULT_UI_TEST_SUITE_RUN_CONFIG: Pick<
  UiTestSuiteFormValues,
  'headless' | 'slowMoMs' | 'viewportWidth' | 'viewportHeight' | 'defaultStepTimeoutMs'
> = {
  headless: false,
  slowMoMs: 300,
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultStepTimeoutMs: 5000,
}

export function SprintDrawer({
  title,
  open,
  form,
  loading,
  error,
  onClose,
  mode = 'create',
  onFinish,
}: {
  title: string
  open: boolean
  form: FormInstance
  loading: boolean
  error: unknown
  onClose: () => void
  mode?: 'create' | 'edit'
  onFinish: (values: SprintFormValues) => void
}) {
  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={480}
      extra={
        <Button type="primary" className="action-btn-save" loading={loading} onClick={() => form.submit()}>
          保存
        </Button>
      }
    >
      {error ? <Alert showIcon type="error" message={getErrorMessage(error)} /> : null}
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="name" label="迭代名称" rules={[{ required: true, message: '请输入迭代名称' }]}>
          <Input maxLength={64} />
        </Form.Item>
        {mode === 'edit' ? (
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { label: 'running', value: 'running' },
                { label: 'completed', value: 'completed' },
              ]}
            />
          </Form.Item>
        ) : null}
        <Form.Item name="startTime" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
          <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" placeholder="请选择开始时间" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="endTime" label="结束时间">
          <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" placeholder="请选择结束时间" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="description" label="迭代描述">
          <Input.TextArea rows={4} maxLength={256} />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

export function RequirementDrawer({
  title,
  open,
  form,
  loading,
  error,
  onClose,
  mode = 'create',
  sprintOptions,
  onFinish,
}: {
  title: string
  open: boolean
  form: FormInstance
  loading: boolean
  error: unknown
  onClose: () => void
  mode?: 'create' | 'edit'
  sprintOptions?: Array<{ label: string; value: string }>
  onFinish: (values: RequirementFormValues) => void
}) {
  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={520}
      extra={
        <Button type="primary" className="action-btn-save" loading={loading} onClick={() => form.submit()}>
          保存
        </Button>
      }
    >
      {error ? <Alert showIcon type="error" message={getErrorMessage(error)} /> : null}
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        {sprintOptions ? (
          <Form.Item name="sprintId" label="所属迭代" rules={[{ required: true, message: '请选择所属迭代' }]}>
            <Select placeholder="请选择迭代" options={sprintOptions} />
          </Form.Item>
        ) : null}
        <Form.Item name="name" label="需求名称" rules={[{ required: true, message: '请输入需求名称' }]}>
          <Input maxLength={100} />
        </Form.Item>
        {mode === 'edit' ? (
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { label: 'draft', value: 'draft' },
                { label: 'in_progress', value: 'in_progress' },
                { label: 'completed', value: 'completed' },
              ]}
            />
          </Form.Item>
        ) : null}
        <Form.Item name="description" label="需求描述">
          <Input.TextArea rows={6} maxLength={512} />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

export function CollectionDrawer({
  title,
  open,
  form,
  loading,
  error,
  onClose,
  sprintOptions,
  requirementOptions,
  onSprintChange,
  onFinish,
}: {
  title: string
  open: boolean
  form: FormInstance
  loading: boolean
  error: unknown
  onClose: () => void
  sprintOptions: Array<{ label: string; value: string }>
  requirementOptions: Array<{ label: string; value: string }>
  onSprintChange?: (value?: string) => void
  onFinish: (values: CollectionFormValues) => void
}) {
  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={520}
      extra={
        <Button type="primary" className="action-btn-save" loading={loading} onClick={() => form.submit()}>
          保存
        </Button>
      }
    >
      {error ? <Alert showIcon type="error" message={getErrorMessage(error)} /> : null}
      <Form<CollectionFormValues> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="sprintId" label="所属迭代" rules={[{ required: true, message: '请选择所属迭代' }]}>
          <Select placeholder="请选择迭代" options={sprintOptions} onChange={onSprintChange} />
        </Form.Item>
        <Form.Item name="requirementId" label="所属需求" rules={[{ required: true, message: '请选择所属需求' }]}>
          <Select placeholder="请选择需求" options={requirementOptions} />
        </Form.Item>
        <Form.Item name="name" label="Collection 名称" rules={[{ required: true, message: '请输入 Collection 名称' }]}>
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item name="summary" label="描述">
          <Input.TextArea rows={6} maxLength={200} />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

export function UiTestSuiteDrawer({
  title,
  open,
  form,
  loading,
  error,
  onClose,
  sprintOptions,
  requirementOptions,
  onSprintChange,
  onFinish,
}: {
  title: string
  open: boolean
  form: FormInstance
  loading: boolean
  error: unknown
  onClose: () => void
  sprintOptions?: Array<{ label: string; value: string }>
  requirementOptions?: Array<{ label: string; value: string }>
  onSprintChange?: (value?: string) => void
  onFinish: (values: UiTestSuiteFormValues) => void
}) {
  const watchedViewportWidth = Form.useWatch('viewportWidth', form)
  const watchedViewportHeight = Form.useWatch('viewportHeight', form)

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={780}
      className="ui-test-suite-drawer"
      extra={
        <Button type="primary" className="action-btn-save" loading={loading} onClick={() => form.submit()}>
          保存
        </Button>
      }
    >
      {error ? <Alert showIcon type="error" message={getErrorMessage(error)} /> : null}
      <Form<UiTestSuiteFormValues>
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        initialValues={DEFAULT_UI_TEST_SUITE_RUN_CONFIG}
      >
        <div className="ui-test-suite-drawer-shell">
          <div className="ui-test-suite-drawer-section">
            <div className="ui-test-suite-drawer-grid ui-test-suite-drawer-grid-2">
              {sprintOptions ? (
                <Form.Item name="sprintId" label="所属迭代" rules={[{ required: true, message: '请选择所属迭代' }]}>
                  <Select placeholder="请选择迭代" options={sprintOptions} onChange={onSprintChange} />
                </Form.Item>
              ) : null}
              {requirementOptions ? (
                <Form.Item name="requirementId" label="所属需求" rules={[{ required: true, message: '请选择所属需求' }]}>
                  <Select placeholder="请选择需求" options={requirementOptions} />
                </Form.Item>
              ) : null}
            </div>
          </div>

          <div className="ui-test-suite-drawer-section">
            <div className="ui-test-suite-drawer-grid ui-test-suite-drawer-grid-1">
              <Form.Item name="name" label="测试集名称" rules={[{ required: true, message: '请输入测试集名称' }]}>
                <Input maxLength={64} placeholder="例如：登录冒烟 / 支付主流程" />
              </Form.Item>
            </div>
          </div>

          <div className="ui-test-suite-drawer-section">
            <div className="ui-test-suite-drawer-grid ui-test-suite-drawer-config-grid">
              <Form.Item name="headless" label="运行模式">
                <Select
                  allowClear
                  placeholder="按需设置"
                  options={[
                    { label: '无头模式', value: true },
                    { label: '可视模式', value: false },
                  ]}
                />
              </Form.Item>

              <Form.Item name="slowMoMs" label="慢放延迟(ms)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="例如：300" />
              </Form.Item>

              <Form.Item
                name="defaultStepTimeoutMs"
                label="默认步骤超时(ms)"
                rules={[
                  {
                    validator: async (_, value) => {
                      if (value === undefined || value === null) return Promise.resolve()
                      if (value > 0) return Promise.resolve()
                      return Promise.reject(new Error('默认步骤超时必须大于 0'))
                    },
                  },
                ]}
              >
                <InputNumber min={1} style={{ width: '100%' }} placeholder="例如：5000" />
              </Form.Item>

              <Form.Item
                name="viewportWidth"
                label="视口宽度"
                rules={[
                  {
                    validator: async (_, value) => {
                      if ((value === undefined || value === null) && (watchedViewportHeight === undefined || watchedViewportHeight === null)) {
                        return Promise.resolve()
                      }
                      if (value === undefined || value === null || watchedViewportHeight === undefined || watchedViewportHeight === null) {
                        return Promise.reject(new Error('视口宽高需要同时填写'))
                      }
                      if (value <= 0 || watchedViewportHeight <= 0) {
                        return Promise.reject(new Error('视口宽高必须大于 0'))
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
              >
                <InputNumber min={1} style={{ width: '100%' }} placeholder="例如：1440" />
              </Form.Item>

              <Form.Item
                name="viewportHeight"
                label="视口高度"
                rules={[
                  {
                    validator: async (_, value) => {
                      if ((value === undefined || value === null) && (watchedViewportWidth === undefined || watchedViewportWidth === null)) {
                        return Promise.resolve()
                      }
                      if (value === undefined || value === null || watchedViewportWidth === undefined || watchedViewportWidth === null) {
                        return Promise.reject(new Error('视口宽高需要同时填写'))
                      }
                      if (value <= 0 || watchedViewportWidth <= 0) {
                        return Promise.reject(new Error('视口宽高必须大于 0'))
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
              >
                <InputNumber min={1} style={{ width: '100%' }} placeholder="例如：900" />
              </Form.Item>
            </div>
          </div>

          <div className="ui-test-suite-drawer-section ui-test-suite-drawer-section-last">
            <div className="ui-test-suite-drawer-grid ui-test-suite-drawer-grid-1">
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={4} maxLength={200} placeholder="补充这个 UI 测试集的目标、范围或备注" />
              </Form.Item>
            </div>
          </div>
        </div>
      </Form>
    </Drawer>
  )
}
