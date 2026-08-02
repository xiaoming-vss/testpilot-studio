export type ApiCaseGenerateTaskSourceType = 'openapi' | 'swagger'
export type UiCaseGenerateTaskSourceType = 'source_archive'
export type FunctionalCaseGenerateTaskSourceType = 'text' | 'docx'
export type RequirementAnalysisTaskSourceType = 'text' | 'word' | 'docx' | string
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
export type ApiCaseGenerateTaskRunImportStatus = 'pending' | 'imported' | (string & {})

export type ApiCaseGenerateTaskRunImportedTarget = {
  targetType: 'api_collection' | (string & {})
  targetId: string
}

export type CaseGenerateTaskRunStatus = ApiCaseGenerateTaskRunStatus
export type CaseGenerateTaskRunReviewStatus = ApiCaseGenerateTaskRunReviewStatus
export type CaseGenerateTaskRunImportStatus = ApiCaseGenerateTaskRunImportStatus
export type CaseGenerateTaskRunImportedTarget = ApiCaseGenerateTaskRunImportedTarget

export type AiSkillLibraryItem = {
  skillSpaceId: string
  projectId?: string
  filename: string
  isDefault?: boolean
  downloadUrl?: string
  hash?: string
  size?: number
  version?: number
  createdAt?: string
  updatedAt?: string
}

export type UploadAiSkillPayload = {
  file: File
  publicBaseURL?: string
}

export type FunctionalCaseGenerateTaskStage =
  | 'enhanced_text'
  | 'requirement_analysis'
  | 'case_names'
  | 'detailed_cases'
  | 'completed'
  | string

export type RequirementAnalysisTaskStage =
  | 'extracting_text'
  | 'writing_requirement'
  | 'feature_understanding'
  | 'completed'
  | string

export type FunctionalCaseGenerateTaskStageStatus =
  | 'pending'
  | 'claimed'
  | 'running'
  | 'waiting_review'
  | 'success'
  | 'failed'
  | 'error'
  | 'canceled'
  | string

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

export type UiCaseSourceArchive = {
  archiveId: string
  filename: string
  sizeBytes: number
  sha256: string
  uploadedAt: string
}

export type UiCaseGenerateTask = {
  taskId?: string
  taskType?: 'ui_case_generate' | string
  name: string
  projectId?: string
  sprintId?: string
  requirementId?: string
  creatorUserId?: string
  sourceType: UiCaseGenerateTaskSourceType
  sourceContent: ''
  sourceArchive: UiCaseSourceArchive | null
  instruction: string
  createdAt?: string
  updatedAt?: string
}

export type UiCaseGenerateTaskRunSnapshot = {
  instruction?: string
  name?: string
  projectId?: string
  requirementId?: string
  runId?: string
  sourceType?: UiCaseGenerateTaskSourceType
  sprintId?: string
  taskId?: string
  taskType?: string
  sourceArchive?: UiCaseSourceArchive | null
  [key: string]: unknown
}

export type UiCaseGenerateTaskRun = {
  runId?: string
  taskId?: string
  projectId?: string
  sprintId?: string
  requirementId?: string
  status?: CaseGenerateTaskRunStatus
  reviewStatus?: CaseGenerateTaskRunReviewStatus
  importStatus?: CaseGenerateTaskRunImportStatus
  importedTargets?: CaseGenerateTaskRunImportedTarget[]
  importedAt?: string | null
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
  snapshot?: UiCaseGenerateTaskRunSnapshot
  configJson?: unknown
  resultYaml?: string
  resultSummaryJson?: unknown
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
  importStatus?: ApiCaseGenerateTaskRunImportStatus
  importedTargets?: ApiCaseGenerateTaskRunImportedTarget[]
  importedAt?: string
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

export type CreateUiCaseGenerateTaskPayload = {
  name: string
  sprintId: string
  requirementId: string
  instruction?: string
}

export type UpdateUiCaseGenerateTaskPayload = Partial<CreateUiCaseGenerateTaskPayload>

export type RunUiCaseGenerateTaskPayload = {
  connectionId: string
}

export type UpdateUiCaseGenerateTaskRunResultPayload = {
  resultYaml: string
}

export type ReviewUiCaseGenerateTaskRunPayload =
  | { action: 'approve'; reviewComment?: string }
  | { action: 'reject'; reviewComment?: string }

export type UpdateApiCaseGenerateTaskPayload = Partial<CreateApiCaseGenerateTaskPayload>

export type UpdateApiCaseGenerateTaskRunResultPayload = {
  resultYaml: string
}

export type ImportApiCaseGenerateTaskRunPayload = {
  collectionId: string
  confirmOverwrite?: boolean
}

export type ApiCaseGenerateTaskRunImportExtractRule = {
  name?: string
  enabled?: boolean
  orderNo?: number
  source?: string
  sourceExpr?: string
  varKey?: string
  defaultValue?: unknown
}

export type ApiCaseGenerateTaskRunImportAssertRule = {
  name?: string
  enabled?: boolean
  orderNo?: number
  assertSource?: string
  targetExpr?: string
  comparator?: string
  expectedValue?: unknown
}

export type ApiCaseGenerateTaskRunImportCase = {
  name?: string
  description?: string
  enabled?: boolean
  orderNo?: number
  method?: string
  urlTemplate?: string
  headers?: unknown
  query?: unknown
  bodyType?: string
  bodyJson?: unknown
  bodyText?: string
  timeoutMs?: number
  continueOnFailure?: boolean
  extractRules?: ApiCaseGenerateTaskRunImportExtractRule[]
  assertRules?: ApiCaseGenerateTaskRunImportAssertRule[]
}

export type ApiCaseGenerateTaskRunImportConflict = {
  normalizedName: string
  existingCase: ApiCaseGenerateTaskRunImportCase
  generatedCase: ApiCaseGenerateTaskRunImportCase
}

export type ImportApiCaseGenerateTaskRunResult = {
  requiresConfirmation: boolean
  conflicts: ApiCaseGenerateTaskRunImportConflict[]
  run: ApiCaseGenerateTaskRun
}

export type FunctionalCaseGenerateTask = {
  taskId?: string
  taskType?: 'functional_case_generate' | string
  name: string
  projectId?: string
  sprintId?: string
  requirementId?: string
  creatorUserId?: string
  instruction: string
  createdAt?: string
  updatedAt?: string
}

export type RequirementAnalysisTask = {
  taskId?: string
  taskType?: 'requirement_analysis' | string
  name: string
  projectId?: string
  sprintId?: string
  requirementId?: string
  creatorUserId?: string
  sourceType?: RequirementAnalysisTaskSourceType
  sourceContent?: string
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

export type RequirementAnalysisTaskRunSnapshot = {
  instruction?: string
  name?: string
  projectId?: string
  requirementId?: string
  runId?: string
  sourceContent?: string
  sourceType?: RequirementAnalysisTaskSourceType
  sprintId?: string
  taskId?: string
  taskType?: string
  [key: string]: unknown
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
  configJson?: unknown
  resultYaml?: string
  resultSummaryJson?: unknown
  checkpointEnabled?: boolean
  currentStage?: FunctionalCaseGenerateTaskStage
  stageStatus?: FunctionalCaseGenerateTaskStageStatus
  stageOutput?: unknown
}

export type RequirementAnalysisTaskRun = {
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
  checkpointEnabled?: boolean
  currentStage?: RequirementAnalysisTaskStage
  stageStatus?: FunctionalCaseGenerateTaskStageStatus
  snapshotJson?: RequirementAnalysisTaskRunSnapshot
  configJson?: unknown
  firstStepOutput?: string
  secondStepOutput?: string
  resultYaml?: string
  resultSummaryJson?: unknown
}

export type CreateFunctionalCaseGenerateTaskPayload = {
  name: string
  sprintId: string
  requirementId: string
  instruction: string
}

export type UpdateFunctionalCaseGenerateTaskPayload = Partial<CreateFunctionalCaseGenerateTaskPayload>

export type RunFunctionalCaseGenerateTaskPayload = {
  connectionId: string
  checkpointEnabled?: boolean
}

export type CreateRequirementAnalysisTaskPayload = {
  name: string
  requirementId: string
  instruction?: string
}

export type UpdateRequirementAnalysisTaskPayload = Partial<CreateRequirementAnalysisTaskPayload>

export type RunRequirementAnalysisTaskPayload = {
  connectionId: string
  instruction?: string
  triggerType?: 'manual' | string
  checkpointEnabled?: boolean
  configJson?: string
}

export type ReviewApiCaseGenerateTaskRunPayload =
  | {
      action: 'approve'
      reviewComment?: string
    }
  | {
      action: 'reject'
      reviewComment?: string
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

export type UpdateFunctionalCaseGenerateTaskRunStageOutputPayload = {
  stage: string
  configJson: string
}

export type UpdateRequirementAnalysisTaskRunStageOutputPayload = {
  stage: string
  configJson: Record<string, unknown>
  resultYaml?: string
}

export type ReviewFunctionalCaseGenerateTaskRunStagePayload =
  | {
      stage: string
      action: 'approve'
      comment?: string
    }
  | {
      stage: string
      action: 'reject'
      comment?: string
    }

export type RetryFunctionalCaseGenerateTaskRunStagePayload = {
  stage: string
}

export type ReviewRequirementAnalysisTaskRunStagePayload = {
  stage: string
  action: 'approve'
  configJson: Record<string, unknown>
}

export type ReviseRequirementAnalysisTaskRunStagePayload = {
  stage: string
  revisionInstruction: string
  configJson: Record<string, unknown>
  resultYaml?: string
}
