export type Project = {
  projectId?: string
  project_id?: string
  userId?: string
  user_id?: string
  name: string
  description?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type Sprint = {
  sprintId?: string
  sprint_id?: string
  projectId?: string
  project_id?: string
  name: string
  description?: string
  status: 'running' | 'completed'
  startTime?: string
  start_time?: string
  endTime?: string
  end_time?: string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
}

export type SprintCreatePayload = {
  name: string
  description?: string
  startTime: string
  endTime?: string
}

export type ProjectUpdatePayload = Partial<Pick<Project, 'name' | 'description'>>

export type SprintUpdatePayload = Partial<{
  name: string
  description: string
  status: Sprint['status']
  startTime: string
  endTime: string
}>
