import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { normalizeProjectId } from '@/utils/format'
import { useWorkbenchStore } from '../store/workbench.store'

export function useActiveProject() {
  const activeProjectId = useWorkbenchStore((state) => state.activeProjectId)
  const setActiveProjectId = useWorkbenchStore((state) => state.setActiveProjectId)

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: api.getProjects,
  })

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data])

  useEffect(() => {
    if (projects.length === 0) return

    if (!activeProjectId) {
      setActiveProjectId(normalizeProjectId(projects[0]))
      return
    }

    if (!projects.some((project) => normalizeProjectId(project) === activeProjectId)) {
      setActiveProjectId(normalizeProjectId(projects[0]))
    }
  }, [activeProjectId, projects, setActiveProjectId])

  return {
    activeProjectId,
    projects,
    projectsQuery,
    setActiveProjectId,
  }
}
