import { Alert, Button, Drawer, Form, Input } from 'antd'
import type { FormInstance } from 'antd'
import { getErrorMessage } from '@/utils/format'

export type ZentaoConnectionFormValues = {
  name: string
  baseUrl: string
  account: string
  password?: string
}

export function ZentaoConnectionDrawer({
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
  form: FormInstance<ZentaoConnectionFormValues>
  loading: boolean
  error: unknown
  mode: 'create' | 'edit'
  onClose: () => void
  onFinish: (values: ZentaoConnectionFormValues) => void
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
      <Form<ZentaoConnectionFormValues> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="name" label="连接名称" rules={[{ required: true, message: '请输入连接名称' }]}>
          <Input maxLength={64} placeholder="例如：公司禅道-测试环境" />
        </Form.Item>
        <Form.Item
          name="baseUrl"
          label="禅道地址"
          rules={[
            { required: true, message: '请输入禅道地址' },
            { type: 'url', warningOnly: true, message: '建议输入完整的 http/https 地址' },
          ]}
        >
          <Input maxLength={200} placeholder="http://zentao.example.com" />
        </Form.Item>
        <Form.Item name="account" label="禅道账号" rules={[{ required: true, message: '请输入禅道账号' }]}>
          <Input maxLength={64} placeholder="请输入禅道账号" autoComplete="username" />
        </Form.Item>
        <Form.Item
          name="password"
          label="禅道密码"
          extra={mode === 'edit' ? '留空表示不修改密码；如果修改了地址/账号/密码，保存后会自动重新鉴权。' : undefined}
          rules={mode === 'create' ? [{ required: true, message: '请输入禅道密码' }] : undefined}
        >
          <Input.Password maxLength={128} placeholder={mode === 'edit' ? '留空则不修改密码' : '请输入禅道密码'} autoComplete="current-password" />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
