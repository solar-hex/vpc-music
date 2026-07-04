'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface DashboardState {
  scrollPosition: number
  selectedTab?: string
  expandedSections: Record<string, boolean>
  filters?: Record<string, any>
  searchQuery?: string
}

interface DashboardContextType {
  state: DashboardState
  updateScrollPosition: (position: number) => void
  updateTab: (tab: string) => void
  toggleSection: (sectionId: string) => void
  setFilters: (filters: Record<string, any>) => void
  setSearchQuery: (query: string) => void
  resetState: () => void
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

const initialState: DashboardState = {
  scrollPosition: 0,
  expandedSections: {},
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DashboardState>(initialState)

  const updateScrollPosition = useCallback((position: number) => {
    setState(prev => ({ ...prev, scrollPosition: position }))
  }, [])

  const updateTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, selectedTab: tab }))
  }, [])

  const toggleSection = useCallback((sectionId: string) => {
    setState(prev => ({
      ...prev,
      expandedSections: {
        ...prev.expandedSections,
        [sectionId]: !prev.expandedSections[sectionId],
      },
    }))
  }, [])

  const setFilters = useCallback((filters: Record<string, any>) => {
    setState(prev => ({ ...prev, filters }))
  }, [])

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }))
  }, [])

  const resetState = useCallback(() => {
    setState(initialState)
  }, [])

  return (
    <DashboardContext.Provider
      value={{
        state,
        updateScrollPosition,
        updateTab,
        toggleSection,
        setFilters,
        setSearchQuery,
        resetState,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboardState() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboardState must be used within DashboardProvider')
  }
  return context
}
