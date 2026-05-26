import type { UiTestSuiteFormValues } from '../components/UiTestSuiteDrawer'

export const DEFAULT_UI_TEST_SUITE_RUN_CONFIG: Pick<
  UiTestSuiteFormValues,
  'headless' | 'slowMoMs' | 'viewportWidth' | 'viewportHeight' | 'defaultStepTimeoutMs'
> = {
  headless: false,
  slowMoMs: 300,
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultStepTimeoutMs: 5000,
}
