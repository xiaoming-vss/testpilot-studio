export type ApiCaseGenerateTaskSourceType = 'openapi' | 'swagger'
export type FunctionalCaseGenerateTaskSourceType = 'text' | 'docx'
export type ApiCaseGenerateTaskRunStatus =
  | 'draft'
  | 'pending'
  | 'claimed'
  | 'running'
  | 'success'
  | 'failed'
  | 'error'
  | 'canceled'
  | string

export type ApiCaseGenerateTaskRunReviewStatus = 'pending' | 'approved' | 'rejected' | string

export type ApiCaseGenerateTask = {
  taskId?: string
  taskType?: 'api_case_generate' | string
  name: string
  projectId?: string
  sprintId?: string
  requirementId?: string
  creatorUserId?: string
  sourceType: ApiCaseGenerateTaskSourceType
  sourceContent: string
  instruction: string
  createdAt?: string
  updatedAt?: string
}

export type ApiCaseGenerateTaskRunSnapshot = {
  instruction?: string
  name?: string
  projectId?: string
  requirementId?: string
  runId?: string
  sourceContent?: string
  sourceType?: ApiCaseGenerateTaskSourceType | string
  sprintId?: string
  taskId?: string
  taskType?: string
}

export type ApiCaseGenerateTaskRun = {
  runId?: string
  taskId?: string
  projectId?: string
  sprintId?: string
  requirementId?: string
  status?: ApiCaseGenerateTaskRunStatus
  reviewStatus?: ApiCaseGenerateTaskRunReviewStatus
  importedCollectionId?: string
  reviewerUserId?: string
  reviewedAt?: string
  reviewComment?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  errorMessage?: string
  createdAt?: string
  updatedAt?: string
  triggerType?: string
  triggerUserId?: string
  snapshot?: ApiCaseGenerateTaskRunSnapshot
  configJson?: string
  resultYaml?: string
  resultSummaryJson?: string
}

export type CreateApiCaseGenerateTaskPayload = {
  name: string
  sprintId: string
  requirementId: string
  sourceType: ApiCaseGenerateTaskSourceType
  sourceContent: string
  instruction: string
}

export type UpdateApiCaseGenerateTaskPayload = Partial<CreateApiCaseGenerateTaskPayload>

export type FunctionalCaseGenerateTask = {
  taskId?: string
  taskType?: 'functional_case_generate' | string
  name: string
  projectId?: string
  sprintId?: string
  requirementId?: string
  creatorUserId?: string
  sourceType: FunctionalCaseGenerateTaskSourceType
  sourceContent: string
  instruction: string
  createdAt?: string
  updatedAt?: string
}

export type FunctionalCaseGenerateTaskRunSnapshot = {
  instruction?: string
  name?: string
  projectId?: string
  requirementId?: string
  runId?: string
  sourceContent?: string
  sourceType?: FunctionalCaseGenerateTaskSourceType | string
  sprintId?: string
  taskId?: string
  taskType?: string
}

export type FunctionalCaseGenerateTaskRun = {
  runId?: string
  taskId?: string
  projectId?: string
  sprintId?: string
  requirementId?: string
  status?: ApiCaseGenerateTaskRunStatus
  reviewStatus?: ApiCaseGenerateTaskRunReviewStatus
  importedCollectionId?: string
  reviewerUserId?: string
  reviewedAt?: string
  reviewComment?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  errorMessage?: string
  createdAt?: string
  updatedAt?: string
  triggerType?: string
  triggerUserId?: string
  snapshot?: FunctionalCaseGenerateTaskRunSnapshot
  configJson?: string
  resultYaml?: string
  resultSummaryJson?: string
}

export type CreateFunctionalCaseGenerateTaskPayload = {
  name: string
  sprintId: string
  requirementId: string
  sourceType: FunctionalCaseGenerateTaskSourceType
  sourceContent?: string
  instruction: string
  file?: File
}

export type UpdateFunctionalCaseGenerateTaskPayload = Partial<CreateFunctionalCaseGenerateTaskPayload>

export type RunFunctionalCaseGenerateTaskPayload = {
  connectionId: string
}

export type ReviewApiCaseGenerateTaskRunPayload =
  | {
      action: 'approve'
      collectionId: string
      comment?: string
    }
  | {
      action: 'reject'
      comment?: string
    }

export type ReviewFunctionalCaseGenerateTaskRunPayload =
  | {
      action: 'approve'
      comment?: string
    }
  | {
      action: 'reject'
      comment?: string
    }
