import { Alert, Button, Drawer, Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd'
import { getErrorMessage } from '@/utils/format'

export type CollectionFormValues = {
  sprintId?: string
  requirementId?: string
  name: string
  summary?: string
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
        <Form.Item name="name" label="API测试集名称" rules={[{ required: true, message: '请输入API测试集名称' }]}>
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item name="summary" label="描述">
          <Input.TextArea rows={6} maxLength={200} />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
