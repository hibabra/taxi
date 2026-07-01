'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AuthMode } from '@taxikiwi/shared-types';

type AdminState = {
  authMode: AuthMode;
  mobileNavOpen: boolean;
  selectedGroupementId: null | string;
  setAuthMode: (mode: AuthMode) => void;
  setMobileNavOpen: (open: boolean) => void;
  setSelectedGroupementId: (groupementId: null | string) => void;
};

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      authMode: 'platform',
      mobileNavOpen: false,
      selectedGroupementId: null,
      setAuthMode: (mode) => set({ authMode: mode }),
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      setSelectedGroupementId: (groupementId) => set({ selectedGroupementId: groupementId }),
    }),
    {
      name: 'taxikiwi-backoffice-state',
      partialize: (state) => ({
        authMode: state.authMode,
        selectedGroupementId: state.selectedGroupementId,
      }),
    },
  ),
);
