export type Requirement = {
  requirementId?: string
  requirement_id?: string
  sprintId?: string
  sprint_id?: string
  name: string
  description?: string
  status: 'draft' | 'in_progress' | 'completed'
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type RequirementCreatePayload = {
  name: string
  description?: string
}

export type RequirementUpdatePayload = Partial<Pick<Requirement, 'name' | 'description' | 'status'>>
