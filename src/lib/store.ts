'use client'

import { create } from 'zustand'

export type ActiveView = 'dashboard' | 'board' | 'agents' | 'monitor' | 'skills' | 'settings'

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
}))
