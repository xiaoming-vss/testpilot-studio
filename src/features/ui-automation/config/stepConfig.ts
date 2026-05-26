export const uiTestKeywordOptions = [
  { label: 'open · 打开页面', value: 'open' },
  { label: 'reload · 刷新页面', value: 'reload' },
  { label: 'click · 点击元素', value: 'click' },
  { label: 'dblclick · 双击元素', value: 'dblclick' },
  { label: 'input · 输入内容', value: 'input' },
  { label: 'clear · 清空输入框', value: 'clear' },
  { label: 'press · 键盘输入', value: 'press' },
  { label: 'wait_visible · 等待元素可见', value: 'wait_visible' },
  { label: 'wait_hidden · 等待元素隐藏', value: 'wait_hidden' },
  { label: 'wait_text · 等待文本出现', value: 'wait_text' },
  { label: 'assert_text · 断言元素文本', value: 'assert_text' },
  { label: 'assert_visible · 断言元素可见', value: 'assert_visible' },
  { label: 'assert_url · 断言当前 URL', value: 'assert_url' },
  { label: 'screenshot · 截图', value: 'screenshot' },
  { label: 'sleep · 固定等待', value: 'sleep' },
]

export const uiTestLocatorTypeOptions = [
  { label: 'css', value: 'css' },
  { label: 'xpath', value: 'xpath' },
  { label: 'text', value: 'text' },
  { label: 'placeholder', value: 'placeholder' },
  { label: 'label', value: 'label' },
  { label: 'test_id', value: 'test_id' },
  { label: 'testid', value: 'testid' },
  { label: 'role', value: 'role' },
]

export const uiTestComparatorOptions = [
  { label: 'contains', value: 'contains' },
  { label: 'eq', value: 'eq' },
]

const uiStepOperationKeywords = new Set(['open', 'input', 'press', 'wait_text', 'screenshot', 'sleep'])
const uiStepExpectKeywords = new Set(['wait_text', 'assert_text', 'assert_url'])

const uiStepLocatorRequiredKeywords = new Set([
  'click',
  'dblclick',
  'input',
  'clear',
  'wait_visible',
  'wait_hidden',
  'wait_text',
  'assert_text',
  'assert_visible',
])

const uiStepComparatorKeywords = new Set(['assert_text', 'assert_url'])

type UiStepFieldMeta = {
  locatorHint?: string
  operationLabel?: string
  operationPlaceholder?: string
  operationHint?: string
  expectLabel?: string
  expectPlaceholder?: string
  expectHint?: string
}

const uiStepFieldMetaMap: Record<string, UiStepFieldMeta> = {
  open: {
    operationLabel: '页面 URL',
    operationPlaceholder: '例如：https://test.example.com/login',
    operationHint: 'open 步骤必须填写完整 URL。',
  },
  input: {
    locatorHint: 'input 一般需要先定位到输入框。',
    operationLabel: '输入值',
    operationPlaceholder: '例如：tester',
    operationHint: 'input 使用操作值作为输入内容。',
  },
  press: {
    operationLabel: '按键名',
    operationPlaceholder: '例如：Enter',
    operationHint: 'press 使用操作值传按键名。',
  },
  wait_text: {
    locatorHint: 'wait_text 一般需要先定位到目标元素。',
    operationLabel: '回退文本',
    operationPlaceholder: '例如：登录成功',
    operationHint: '优先使用期望值；如果期望值为空，会回退到操作值。',
    expectLabel: '期望文本',
    expectPlaceholder: '例如：登录成功',
    expectHint: 'wait_text 会优先读取期望值。',
  },
  assert_text: {
    locatorHint: 'assert_text 需要定位到目标元素。',
    expectLabel: '期望文本',
    expectPlaceholder: '例如：登录成功',
    expectHint: 'assert_text 使用期望值作为断言内容。',
  },
  assert_url: {
    expectLabel: '期望 URL',
    expectPlaceholder: '例如：https://test.example.com/dashboard',
    expectHint: 'assert_url 使用期望值作为断言内容。',
  },
  screenshot: {
    operationLabel: '文件名',
    operationPlaceholder: '例如：login-page.png',
    operationHint: '可选；不填时后端会自动生成截图文件名。',
  },
  sleep: {
    operationLabel: '等待时长(ms)',
    operationPlaceholder: '例如：1000',
    operationHint: 'sleep 使用操作值传毫秒数。',
  },
}

export type UiTestRunView = 'steps' | 'snapshot'
export type UiSuiteRunReportView = 'items' | 'snapshot'

export const uiTestRunViewOptions: Array<{ label: string; value: UiTestRunView }> = [
  { label: '步骤结果', value: 'steps' },
  { label: '运行快照', value: 'snapshot' },
]

export const uiSuiteRunReportViewOptions: Array<{ label: string; value: UiSuiteRunReportView }> = [
  { label: '用例明细', value: 'items' },
  { label: '运行快照', value: 'snapshot' },
]

export function getUiStepFieldMeta(keyword?: string) {
  return (keyword ? uiStepFieldMetaMap[keyword] : undefined) ?? {}
}

export function requiresUiStepLocator(keyword?: string) {
  return Boolean(keyword && uiStepLocatorRequiredKeywords.has(keyword))
}

export function usesUiStepComparator(keyword?: string) {
  return Boolean(keyword && uiStepComparatorKeywords.has(keyword))
}

export function usesUiStepOperation(keyword?: string) {
  return Boolean(keyword && uiStepOperationKeywords.has(keyword))
}

export function usesUiStepExpect(keyword?: string) {
  return Boolean(keyword && uiStepExpectKeywords.has(keyword))
}
