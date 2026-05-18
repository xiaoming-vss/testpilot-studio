import { UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Form, Input, Space, Typography, message } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { TestPilotLogo } from '../components/TestPilotLogo'
import { api } from '../services/api'
import { useAuthStore } from '../store/auth'
import { getErrorMessage } from '../utils/format'

const { Title, Text } = Typography

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const setToken = useAuthStore((state) => state.setToken)
  const [form] = Form.useForm()
  const isLogin = mode === 'login'
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/projects'

  const mutation = useMutation({
    mutationFn: async (values: { name: string; password: string; email?: string }) => {
      if (isLogin) {
        return api.login({ name: values.name, password: values.password })
      }
      await api.register(values)
      return null
    },
    onSuccess: (data) => {
      if (isLogin && data) {
        setToken(data.accessToken)
        message.success('登录成功')
        navigate(from, { replace: true })
      } else {
        message.success('注册成功，请登录')
        navigate('/login', { replace: true })
      }
    },
  })

  return (
    <div className="auth-page">
      <main className="auth-main" aria-label={isLogin ? '登录 TestPilot Studio' : '注册 TestPilot Studio'}>
        <Card className="auth-card">
          <div className="auth-brand-icon" aria-hidden="true">
            <TestPilotLogo size={48} />
          </div>
          <Space direction="vertical" size={8} className="auth-title">
            <Title level={1}>TestPilot Studio</Title>
            <Text>{isLogin ? '欢迎回来，请登录您的账号' : '创建账号，开始使用测试平台'}</Text>
          </Space>

          {mutation.error ? <Alert showIcon type="error" message={getErrorMessage(mutation.error)} /> : null}

          <Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)} requiredMark={false} className="auth-form">
            <Form.Item name="name" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="请输入用户名" autoComplete="username" />
            </Form.Item>

            <Form.Item
              name="password"
              label={
                <span className="auth-password-label">
                  <span>密码</span>
                  {isLogin ? (
                    <Button
                      type="link"
                      className="auth-forgot"
                      onClick={() => message.info('暂未开放')}
                    >
                      忘记密码？
                    </Button>
                  ) : null}
                </span>
              }
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" autoComplete={isLogin ? 'current-password' : 'new-password'} />
            </Form.Item>

            {!isLogin ? (
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" autoComplete="email" />
              </Form.Item>
            ) : null}

            <Button type="primary" htmlType="submit" block loading={mutation.isPending} className="auth-submit">
              {isLogin ? '登录' : '注册'}
            </Button>
          </Form>

          <div className="auth-switch">
            <Text type="secondary">{isLogin ? '还没有账号？' : '已有账号？'}</Text>
            <Button type="link" onClick={() => navigate(isLogin ? '/register' : '/login')}>
              {isLogin ? '立即注册' : '返回登录'}
            </Button>
          </div>
        </Card>
        <footer className="auth-footer">© 2024 TestPilot Studio. 版权所有</footer>
      </main>
    </div>
  )
}
