"use client";
// ── Auth store (Zustand + persist) ──
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, getToken, setToken } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (payload: { name: string; username: string; phone: string; password: string }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      ready: false,
      login: async (username, password) => {
        const { token, user } = await api.login(username, password);
        setToken(token);
        set({ user, ready: true });
        return user;
      },
      register: async (payload) => {
        const { token, user } = await api.register(payload);
        setToken(token);
        set({ user, ready: true });
        return user;
      },
      logout: () => {
        setToken(null);
        set({ user: null });
      },
      refresh: async () => {
        if (!getToken()) {
          set({ user: null, ready: true });
          return;
        }
        try {
          const { user } = await api.me();
          set({ user, ready: true });
        } catch {
          setToken(null);
          set({ user: null, ready: true });
        }
      },
    }),
    {
      name: "yassaei.auth",
      skipHydration: true,
      partialize: (s) => ({ user: s.user }),
      onRehydrateStorage: () => (state) => {
        // verify token validity on rehydrate
        state?.refresh();
      },
    },
  ),
);
