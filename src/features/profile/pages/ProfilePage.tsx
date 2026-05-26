import { Alert, Avatar, Button, Form, Input, Popconfirm, Space, Typography, message } from 'antd'
import { SafetyOutlined, UserOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { api } from '@/services/api'
import { getErrorMessage, normalizeUserName } from '@/utils/format'

const { Text, Title, Paragraph } = Typography

export function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const logout = useAuthStore((state) => state.logout)
  const [form] = Form.useForm()

  useEffect(() => {
    if (user) form.setFieldsValue(user)
  }, [form, user])

  const updateMutation = useMutation({
    mutationFn: api.updateUser,
    onSuccess: (_, values) => {
      message.success('用户信息已更新')
      setUser({ ...(user ?? { name: values.name ?? '' }), ...values })
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      message.success('账号已注销')
      logout()
      navigate('/login', { replace: true })
    },
  })

  return (
    <div className="settings-page">
      <div className="settings-context-bar">
        <div>
          <Text className="settings-eyebrow">Personal Settings</Text>
          <Title level={3}>个人设置</Title>
        </div>
      </div>

      <div className="settings-content">
        <aside className="settings-summary">
          <Avatar size={64} icon={<UserOutlined />} className="settings-avatar" />
          <Title level={4}>{normalizeUserName(user)}</Title>
          <Text type="secondary">{user?.email || '未设置邮箱'}</Text>
          <div className="settings-summary-meta">
            <SafetyOutlined />
            <span>账号信息由当前登录用户维护</span>
          </div>
        </aside>

        <section className="settings-panel">
          <div className="settings-panel-header">
            <div>
              <Title level={4}>账号信息</Title>
              <Paragraph type="secondary">更新用户名和邮箱，用于平台内展示与后续通知。</Paragraph>
            </div>
          </div>

          {updateMutation.error ? <Alert showIcon type="error" message={getErrorMessage(updateMutation.error)} /> : null}

          <Form form={form} layout="vertical" onFinish={(values) => updateMutation.mutate(values)} requiredMark={false} className="settings-form">
            <Form.Item name="name" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input placeholder="请输入用户名" maxLength={50} />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
              <Input placeholder="请输入邮箱" maxLength={100} />
            </Form.Item>
            <Space>
              <Button type="primary" className="action-btn-save" htmlType="submit" loading={updateMutation.isPending}>
                保存修改
              </Button>
              <Button onClick={() => user && form.setFieldsValue(user)}>重置</Button>
            </Space>
          </Form>

          <div className="danger-zone">
            <div>
              <Text strong>注销账号</Text>
              <Paragraph type="secondary">注销后当前账号将不可继续使用，请谨慎操作。</Paragraph>
            </div>
            <Popconfirm title="确认注销当前账号？" okText="确认注销" cancelText="取消" onConfirm={() => deleteMutation.mutate()}>
              <Button danger className="action-btn-delete" loading={deleteMutation.isPending}>注销账号</Button>
            </Popconfirm>
          </div>
        </section>
      </div>
    </div>
  )
}
