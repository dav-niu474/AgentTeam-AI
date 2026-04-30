'use client'

import { create } from 'zustand'

export type ActiveView = 'dashboard' | 'board' | 'inspirations' | 'agents' | 'monitor' | 'sessions' | 'skills' | 'settings'

export type BoardViewMode = 'kanban' | 'table'

interface AppStore {
  // Navigation
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void

  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Selected items
  selectedIssueId: string | null
  setSelectedIssueId: (id: string | null) => void

  // Inspiration input
  showInspirationInput: boolean
  setShowInspirationInput: (show: boolean) => void

  // Daemon status
  daemonOnline: boolean
  setDaemonOnline: (online: boolean) => void

  // Board view mode
  boardViewMode: BoardViewMode
  setBoardViewMode: (mode: BoardViewMode) => void
}

export const useAppStore = create<AppStore>((set) => ({
  // Navigation
  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),

  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // Selected items
  selectedIssueId: null,
  setSelectedIssueId: (id) => set({ selectedIssueId: id }),

  // Inspiration input
  showInspirationInput: false,
  setShowInspirationInput: (show) => set({ showInspirationInput: show }),

  // Daemon status
  daemonOnline: true,
  setDaemonOnline: (online) => set({ daemonOnline: online }),

  // Board view mode
  boardViewMode: 'kanban',
  setBoardViewMode: (mode) => set({ boardViewMode: mode }),
}))
