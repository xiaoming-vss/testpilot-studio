import { Alert, Button, DatePicker, Drawer, Form, Input, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { Sprint, SprintCreatePayload } from '@/services/api'
import { getErrorMessage } from '@/utils/format'

type DateLikeValue = string | Date | { toDate?: () => Date; toISOString?: () => string } | null | undefined

export type SprintFormValues = Omit<SprintCreatePayload, 'startTime' | 'endTime'> & {
  startTime: DateLikeValue
  endTime?: DateLikeValue
} & Partial<Pick<Sprint, 'status'>>

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
      size={480}
      extra={
        <Button type="primary" className="action-btn-save" loading={loading} onClick={() => form.submit()}>
          保存
        </Button>
      }
    >
      {error ? <Alert showIcon type="error" title={getErrorMessage(error)} /> : null}
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
