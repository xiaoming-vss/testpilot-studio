import { Alert, Button, Drawer, Form, Input } from 'antd'
import type { FormInstance } from 'antd'
import { getErrorMessage } from '@/utils/format'

export type LlmConnectionFormValues = {
  name: string
  baseUrl: string
  modelId: string
  apiKey?: string
}

export function LlmConnectionDrawer({
  title,
  open,
  form,
  loading,
  error,
  mode,
  onClose,
  onFinish,
}: {
  title: string
  open: boolean
  form: FormInstance<LlmConnectionFormValues>
  loading: boolean
  error: unknown
  mode: 'create' | 'edit'
  onClose: () => void
  onFinish: (values: LlmConnectionFormValues) => void
}) {
  return (
    <Drawer
     
      title={title}
      open={open}
      onClose={onClose}
      size={520}
      extra={
        <Button type="primary" className="action-btn-save" loading={loading} onClick={() => form.submit()}>
          保存
        </Button>
      }
    >
      {error ? <Alert showIcon type="error" title={getErrorMessage(error)} className="base-services-drawer-alert" /> : null}
      <Form<LlmConnectionFormValues> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="name" label="连接名称" rules={[{ required: true, message: '请输入连接名称' }, { max: 100, message: '名称最长100字符' }]}>
          <Input maxLength={100} placeholder="例如：GPT-4o 生产" />
        </Form.Item>
        <Form.Item
          name="baseUrl"
          label="请求地址"
          rules={[
            { required: true, message: '请输入请求地址' },
            { max: 512, message: '地址最长512字符' },
          ]}
        >
          <Input maxLength={512} placeholder="OpenAI 兼容格式的请求地址" />
        </Form.Item>
        <Form.Item name="modelId" label="模型 ID" rules={[{ required: true, message: '请输入模型 ID' }, { max: 100, message: '模型ID最长100字符' }]}>
          <Input maxLength={100} placeholder="例如：gpt-4o" />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label="API 密钥"
          extra={mode === 'edit' ? '留空表示不修改密钥。' : undefined}
          rules={mode === 'create' ? [{ required: true, message: '请输入 API 密钥' }, { max: 256, message: '密钥最长256字符' }] : [{ max: 256, message: '密钥最长256字符' }]}
        >
          <Input.Password maxLength={256} placeholder={mode === 'edit' ? '留空则不修改密钥' : '请输入 API 密钥'} autoComplete="current-password" />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
