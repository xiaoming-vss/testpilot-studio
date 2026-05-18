import { Empty } from 'antd'
import { PageFrame } from '../components/PageFrame'

export function TestCasePage() {
  return (
    <PageFrame title="功能测试用例" description="管理功能测试用例，支持 AI 辅助生成与编辑。">
      <Empty description="功能开发中，敬请期待" />
    </PageFrame>
  )
}
