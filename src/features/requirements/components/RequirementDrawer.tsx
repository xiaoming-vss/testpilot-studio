import { Alert, Button, Drawer, Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { Requirement, RequirementCreatePayload } from '@/services/api'
import { getErrorMessage } from '@/utils/format'

export type RequirementFormValues = RequirementCreatePayload &
  Partial<Pick<Requirement, 'status'>> & {
    sprintId?: string
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
