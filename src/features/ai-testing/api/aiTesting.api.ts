import { request, requestBlob } from '@/shared/api/request'
import type {
  AiSkillLibraryItem,
  ApiCaseGenerateTask,
  ApiCaseGenerateTaskRun,
  CreateApiCaseGenerateTaskPayload,
  CreateFunctionalCaseGenerateTaskPayload,
  CreateRequirementAnalysisTaskPayload,
  FunctionalCaseGenerateTask,
  FunctionalCaseGenerateTaskRun,
  RequirementAnalysisTask,
  RequirementAnalysisTaskRun,
  ReviewApiCaseGenerateTaskRunPayload,
  ReviewFunctionalCaseGenerateTaskRunPayload,
  ReviewFunctionalCaseGenerateTaskRunStagePayload,
  ReviewRequirementAnalysisTaskRunStagePayload,
  ReviseRequirementAnalysisTaskRunStagePayload,
  RetryFunctionalCaseGenerateTaskRunStagePayload,
  RunFunctionalCaseGenerateTaskPayload,
  RunRequirementAnalysisTaskPayload,
  UpdateApiCaseGenerateTaskPayload,
  UploadAiSkillPayload,
  UpdateFunctionalCaseGenerateTaskPayload,
  UpdateFunctionalCaseGenerateTaskRunStageOutputPayload,
  UpdateRequirementAnalysisTaskPayload,
  UpdateRequirementAnalysisTaskRunStageOutputPayload,
} from '../types'
import type { Requirement } from '@/features/requirements/types'

export const aiTestingApi = {
  getAiSkillLibraryItems: (projectId: string) =>
    request<AiSkillLibraryItem[]>(`/v1/projects/${projectId}/skills`),
  uploadAiSkill: (projectId: string, { file, publicBaseURL }: UploadAiSkillPayload) => {
    const formData = new FormData()
    formData.append('file', file, file.name)
    if (publicBaseURL?.trim()) {
      formData.append('publicBaseURL', publicBaseURL.trim())
    }

    return request<AiSkillLibraryItem>(`/v1/projects/${projectId}/skills`, {
      method: 'POST',
      body: formData,
    })
  },
  deleteAiSkill: (projectId: string, skillSpaceId: string) =>
    request<Record<string, never>>(`/v1/projects/${projectId}/skills/${skillSpaceId}`, {
      method: 'DELETE',
    }),
  downloadAiSkill: (projectId: string, skillSpaceId: string) =>
    requestBlob(`/v1/projects/${projectId}/skills/${skillSpaceId}/download`),
  getApiCaseGenerateTasks: (projectId: string) =>
    request<ApiCaseGenerateTask[]>(`/v1/projects/${projectId}/api-case-generate-tasks`),
  createApiCaseGenerateTask: (projectId: string, body: CreateApiCaseGenerateTaskPayload) =>
    request<ApiCaseGenerateTask>(`/v1/projects/${projectId}/api-case-generate-tasks`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getApiCaseGenerateTask: (taskId: string) =>
    request<ApiCaseGenerateTask>(`/v1/api-case-generate-tasks/${taskId}`),
  updateApiCaseGenerateTask: (taskId: string, body: UpdateApiCaseGenerateTaskPayload) =>
    request<ApiCaseGenerateTask>(`/v1/api-case-generate-tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  runApiCaseGenerateTask: (taskId: string, connectionId: string) =>
    request<ApiCaseGenerateTaskRun>(`/v1/api-case-generate-tasks/${taskId}/run`, {
      method: 'POST',
      body: JSON.stringify({ connectionId }),
    }),
  getApiCaseGenerateTaskRuns: (taskId: string) =>
    request<ApiCaseGenerateTaskRun[]>(`/v1/api-case-generate-tasks/${taskId}/runs`),
  getApiCaseGenerateTaskRun: (runId: string) =>
    request<ApiCaseGenerateTaskRun>(`/v1/api-case-generate-task-runs/${runId}`),
  reviewApiCaseGenerateTaskRun: (runId: string, body: ReviewApiCaseGenerateTaskRunPayload) =>
    request<ApiCaseGenerateTaskRun>(`/v1/api-case-generate-task-runs/${runId}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteApiCaseGenerateTask: (taskId: string) =>
    request<Record<string, never>>(`/v1/api-case-generate-tasks/${taskId}`, {
      method: 'DELETE',
    }),
  getFunctionalCaseGenerateTasks: (projectId: string) =>
    request<FunctionalCaseGenerateTask[]>(`/v1/projects/${projectId}/function-case-generate-tasks`),
  createFunctionalCaseGenerateTask: (projectId: string, body: CreateFunctionalCaseGenerateTaskPayload) =>
    request<FunctionalCaseGenerateTask>(`/v1/projects/${projectId}/function-case-generate-tasks`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getFunctionalCaseGenerateTask: (taskId: string) =>
    request<FunctionalCaseGenerateTask>(`/v1/function-case-generate-tasks/${taskId}`),
  updateFunctionalCaseGenerateTask: (taskId: string, body: UpdateFunctionalCaseGenerateTaskPayload) =>
    request<FunctionalCaseGenerateTask>(`/v1/function-case-generate-tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  runFunctionalCaseGenerateTask: (taskId: string, body: RunFunctionalCaseGenerateTaskPayload) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-tasks/${taskId}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getFunctionalCaseGenerateTaskRuns: (taskId: string) =>
    request<FunctionalCaseGenerateTaskRun[]>(`/v1/function-case-generate-tasks/${taskId}/runs`),
  getFunctionalCaseGenerateTaskRun: (runId: string) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-task-runs/${runId}`),
  updateFunctionalCaseGenerateTaskRunStageOutput: (
    runId: string,
    body: UpdateFunctionalCaseGenerateTaskRunStageOutputPayload,
  ) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-task-runs/${runId}/stage-output`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  reviewFunctionalCaseGenerateTaskRunStage: (
    runId: string,
    body: ReviewFunctionalCaseGenerateTaskRunStagePayload,
  ) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-task-runs/${runId}/stage-review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  retryFunctionalCaseGenerateTaskRunStage: (
    runId: string,
    body: RetryFunctionalCaseGenerateTaskRunStagePayload,
  ) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-task-runs/${runId}/stage-retry`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reviewFunctionalCaseGenerateTaskRun: (runId: string, body: ReviewFunctionalCaseGenerateTaskRunPayload) =>
    request<FunctionalCaseGenerateTaskRun>(`/v1/function-case-generate-task-runs/${runId}/review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteFunctionalCaseGenerateTask: (taskId: string) =>
    request<Record<string, never>>(`/v1/function-case-generate-tasks/${taskId}`, {
      method: 'DELETE',
    }),
  getRequirementAnalysisTasks: (projectId: string) =>
    request<RequirementAnalysisTask[]>(`/v1/projects/${projectId}/requirement-analysis-tasks`),
  createRequirementAnalysisTask: (projectId: string, body: CreateRequirementAnalysisTaskPayload) =>
    request<RequirementAnalysisTask>(`/v1/projects/${projectId}/requirement-analysis-tasks`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getRequirementAnalysisTask: (taskId: string) =>
    request<RequirementAnalysisTask>(`/v1/requirement-analysis-tasks/${taskId}`),
  updateRequirementAnalysisTask: (taskId: string, body: UpdateRequirementAnalysisTaskPayload) =>
    request<RequirementAnalysisTask>(`/v1/requirement-analysis-tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteRequirementAnalysisTask: (taskId: string) =>
    request<Record<string, never>>(`/v1/requirement-analysis-tasks/${taskId}`, {
      method: 'DELETE',
    }),
  runRequirementAnalysisTask: (taskId: string, body: RunRequirementAnalysisTaskPayload) =>
    request<RequirementAnalysisTaskRun>(`/v1/requirement-analysis-tasks/${taskId}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getRequirementAnalysisTaskRuns: (taskId: string) =>
    request<RequirementAnalysisTaskRun[]>(`/v1/requirement-analysis-tasks/${taskId}/runs`),
  getRequirementAnalysisRun: (runId: string) =>
    request<RequirementAnalysisTaskRun>(`/v1/requirement-analysis-runs/${runId}`),
  updateRequirementAnalysisRunStageOutput: (
    runId: string,
    body: UpdateRequirementAnalysisTaskRunStageOutputPayload,
  ) =>
    request<RequirementAnalysisTaskRun>(`/v1/requirement-analysis-runs/${runId}/stage-output`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  reviewRequirementAnalysisRunStage: (
    runId: string,
    body: ReviewRequirementAnalysisTaskRunStagePayload,
  ) =>
    request<RequirementAnalysisTaskRun>(`/v1/requirement-analysis-runs/${runId}/stage-review`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reviseRequirementAnalysisRunStage: (
    runId: string,
    body: ReviseRequirementAnalysisTaskRunStagePayload,
  ) =>
    request<RequirementAnalysisTaskRun>(`/v1/requirement-analysis-runs/${runId}/stage-revise`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  importRequirementAnalysisRunToRequirement: (runId: string) =>
    request<Requirement>(`/v1/requirement-analysis-runs/${runId}/import-to-requirement`, {
      method: 'POST',
    }),
}
