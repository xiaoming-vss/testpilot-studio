import { authApi } from '@/features/auth/api/auth.api'
import { aiTestingApi } from '@/features/ai-testing/api/aiTesting.api'
import { apiAutomationApi } from '@/features/api-automation/api/apiAutomation.api'
import { baseServicesApi } from '@/features/base-services/api/baseServices.api'
import { functionTestingApi } from '@/features/test-cases/api/functionTesting.api'
import { projectsApi } from '@/features/projects/api/projects.api'
import { requirementsApi } from '@/features/requirements/api/requirements.api'
import { uiAutomationApi } from '@/features/ui-automation/api/uiAutomation.api'

export type { LoginResponse, User } from '@/features/auth/types'
export type {
  ApiCaseGenerateTask,
  ApiCaseGenerateTaskRun,
  ApiCaseGenerateTaskRunReviewStatus,
  ApiCaseGenerateTaskRunStatus,
  ApiCaseGenerateTaskRunSnapshot,
  ApiCaseGenerateTaskSourceType,
  CreateApiCaseGenerateTaskPayload,
  ReviewApiCaseGenerateTaskRunPayload,
  UpdateApiCaseGenerateTaskPayload,
} from '@/features/ai-testing/types'
export type {
  ApiAssertComparator,
  ApiAssertRule,
  ApiAssertSource,
  ApiCase,
  ApiCaseRunAssertResult,
  ApiCaseRunExtractResult,
  ApiCaseRunRequestSnapshot,
  ApiCaseRunResponseSnapshot,
  ApiCaseRunResult,
  ApiCollection,
  ApiCollectionImportResult,
  ApiCollectionRunItem,
  ApiCollectionRunReport,
  ApiCollectionRunSummary,
  ApiEnvironment,
  ApiEnvironmentVar,
  ApiExtractRule,
  ApiExtractRuleSource,
  CreateApiAssertRulePayload,
  CreateApiCasePayload,
  CreateApiCollectionPayload,
  CreateApiEnvironmentPayload,
  CreateApiEnvironmentVarPayload,
  CreateApiExtractRulePayload,
  RunApiCasePayload,
  RunApiCollectionPayload,
  UpdateApiAssertRulePayload,
  UpdateApiCasePayload,
  UpdateApiCollectionPayload,
  UpdateApiEnvironmentPayload,
  UpdateApiEnvironmentVarPayload,
  UpdateApiExtractRulePayload,
} from '@/features/api-automation/types'
export type { Project, ProjectUpdatePayload, Sprint, SprintCreatePayload, SprintUpdatePayload } from '@/features/projects/types'
export type { Requirement, RequirementCreatePayload, RequirementUpdatePayload } from '@/features/requirements/types'
export type {
  CreateZentaoConnectionPayload,
  IntegrationConnectionStatus,
  UpdateZentaoConnectionPayload,
  ZentaoConnection,
} from '@/features/base-services/types'
export type {
  CreateFunctionTestCasePayload,
  CreateFunctionTestSuitePayload,
  FunctionTestCase,
  FunctionTestSuite,
  UpdateFunctionTestCasePayload,
  UpdateFunctionTestSuitePayload,
} from '@/features/test-cases/types'
export type {
  CreateUiTestCasePayload,
  CreateUiTestSuitePayload,
  UiTestCase,
  UiTestCaseDebugRunPayload,
  UiTestCaseRun,
  UiTestCaseRunStepResult,
  UiTestSuiteImportResult,
  UiTestSuite,
  UiTestSuiteRunItem,
  UiTestSuiteRunReport,
  UiTestSuiteRunSummary,
  UpdateUiTestCasePayload,
  UpdateUiTestSuitePayload,
} from '@/features/ui-automation/types'

export type { ApiEnvelope } from '@/shared/api/request'
export { ApiError } from '@/shared/api/request'

export const api = {
  ...authApi,
  ...aiTestingApi,
  ...baseServicesApi,
  ...projectsApi,
  ...requirementsApi,
  ...apiAutomationApi,
  ...functionTestingApi,
  ...uiAutomationApi,
}
