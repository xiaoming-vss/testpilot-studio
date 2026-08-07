import { Alert, Button, Drawer, Form, Input, Tag } from 'antd'
import type { FormInstance } from 'antd'
import { getErrorMessage } from '@/utils/format'

export type GitlabConnectionFormValues = {
  name: string
  baseUrl: string
  accessToken: string
}

export function GitlabConnectionDrawer({
  title,
  open,
  form,
  loading,
  error,
  mode,
  hasAccessToken,
  onClose,
  onFinish,
}: {
  title: string
  open: boolean
  form: FormInstance<GitlabConnectionFormValues>
  loading: boolean
  error: unknown
  mode: 'create' | 'edit'
  hasAccessToken?: boolean
  onClose: () => void
  onFinish: (values: GitlabConnectionFormValues) => void
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
      <Form<GitlabConnectionFormValues> form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="name" label="连接名称" rules={[{ required: true, message: '请输入连接名称' }]}>
          <Input maxLength={64} placeholder="例如：公司 GitLab" />
        </Form.Item>
        <Form.Item
          name="baseUrl"
          label="GitLab 地址"
          extra="请输入 GitLab 根地址，不要添加 /api/v4。"
          rules={[
            { required: true, message: '请输入 GitLab 地址' },
            { type: 'url', warningOnly: true, message: '建议输入完整的 http/https 地址' },
          ]}
        >
          <Input maxLength={200} placeholder="https://gitlab.example.com" />
        </Form.Item>
        <Form.Item
          name="accessToken"
          label="Personal Access Token"
          extra={
            mode === 'edit' ? (
              <span>
                留空表示不修改。{' '}
                <Tag color={hasAccessToken ? 'success' : 'default'}>{hasAccessToken ? 'Token 已配置' : 'Token 未配置'}</Tag>
              </span>
            ) : (
              '请填写具备 API 访问权限的 Personal Access Token。'
            )
          }
          rules={mode === 'create' ? [{ required: true, message: '请输入 Personal Access Token' }] : undefined}
        >
          <Input.Password
            maxLength={256}
            placeholder={mode === 'edit' ? '留空则不修改 Token' : '请输入 Personal Access Token'}
            autoComplete="off"
          />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
