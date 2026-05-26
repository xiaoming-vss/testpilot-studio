import { useAuthStore } from '@/features/auth/store/auth.store'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

export class ApiError extends Error {
  code: number
  status: number

  constructor(message: string, code: number, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers = new Headers(options.headers)
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData

  if (!headers.has('Content-Type') && options.body && !isFormDataBody) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })
  const payload = (await response.json().catch(() => ({
    code: response.ok ? 0 : response.status,
    message: response.statusText,
    data: {},
  }))) as ApiEnvelope<T>

  if (!response.ok || payload.code !== 0) {
    if (payload.code === 1001 || response.status === 401) {
      useAuthStore.getState().logout()
    }
    throw new ApiError(payload.message || '请求失败', payload.code, response.status)
  }

  return payload.data
}
