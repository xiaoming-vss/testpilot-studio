import { describe, expect, it } from 'vitest'
import { buildUiTestCaseUpdatePayload } from './updatePayload'

describe('UI 用例更新载荷', () => {
  it('结构化响应与等价序列化步骤不会被判断为修改', () => {
    const stepsJson = [{ orderNo: 1, stepName: '打开登录页', keyword: 'open' }]

    expect(buildUiTestCaseUpdatePayload(
      { name: '登录成功', enabled: true, orderNo: 1, stepsJson },
      { name: '登录成功', enabled: true, orderNo: 1, stepsJson: JSON.stringify(stepsJson) },
    )).toEqual({})
  })
})
