import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react'

type AppHeaderContextValue = {
  headerContent: ReactNode
  setHeaderContent: Dispatch<SetStateAction<ReactNode>>
}

export const AppHeaderContext = createContext<AppHeaderContextValue | null>(null)

export function useAppHeader() {
  const context = useContext(AppHeaderContext)
  if (!context) {
    throw new Error('useAppHeader must be used inside AppHeaderContext.Provider')
  }
  return context
}
