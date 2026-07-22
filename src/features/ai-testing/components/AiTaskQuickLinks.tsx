import { AppstoreOutlined, LinkOutlined } from '@ant-design/icons'
import { Button, Space, Tooltip } from 'antd'
import { useNavigate } from 'react-router-dom'

export function AiTaskQuickLinks() {
  const navigate = useNavigate()

  return (
    <Space size={8} className="ai-task-quick-links">
      <Tooltip title="等待 Skill 接口接入">
        <Button icon={<AppstoreOutlined />} disabled>
          选择 Skill
        </Button>
      </Tooltip>
      <Button icon={<LinkOutlined />} onClick={() => navigate('/ai-testing/skills')}>
        管理 Skill
      </Button>
    </Space>
  )
}
