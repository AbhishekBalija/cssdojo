import { useQuery } from "@tanstack/react-query";
import type {
  ChallengeBoardRow,
  EventView,
  KataMonth,
  NotificationsView,
  PackBoardRow,
  PackDetail,
  PackSummary,
  ProfileView,
  SettingsView,
  SolutionsView,
  StreakRow,
  WallView,
} from "@cssdojo/shared";
import { api, ApiError } from "./api";

// Hooks for the ranking data (docs/requirements/ranking.md). A route that the
// server does not have yet answers 404; those hooks return null so the section
// that needs it stays hidden instead of breaking the page.

async function optional<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function usePacks() {
  return useQuery({ queryKey: ["packs"], queryFn: () => optional<PackSummary[]>("/packs"), staleTime: 60_000, retry: false });
}

export function usePack(n: number) {
  return useQuery({ queryKey: ["pack", n], queryFn: () => optional<PackDetail>(`/packs/${n}`), staleTime: 30_000, retry: false });
}

export function useKataMonth(month: string) {
  return useQuery({ queryKey: ["kata-month", month], queryFn: () => optional<KataMonth>(`/kata/days?month=${month}`), staleTime: 60_000, retry: false });
}

/** Big moments for the header LIVE line, or one board's recent moves. */
export function useEvents(board?: string) {
  const q = board ? `?board=${encodeURIComponent(board)}` : "";
  return useQuery({ queryKey: ["events", board ?? "live"], queryFn: () => optional<EventView[]>(`/events${q}`), refetchInterval: 30_000, retry: false });
}

export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: () => optional<NotificationsView>("/notifications"), staleTime: 30_000, retry: false });
}

export function useWall(page: number) {
  return useQuery({ queryKey: ["wall", page], queryFn: () => optional<WallView>(`/boards/wall?page=${page}`), staleTime: 30_000, retry: false });
}

export function usePackBoard(n: number) {
  return useQuery({ queryKey: ["board-pack", n], queryFn: () => optional<PackBoardRow[]>(`/boards/pack/${n}`), staleTime: 30_000, retry: false, enabled: n > 0 });
}

export function useChallengeBoard(id: string) {
  return useQuery({ queryKey: ["board-challenge", id], queryFn: () => optional<ChallengeBoardRow[]>(`/boards/challenge/${id}`), staleTime: 30_000, retry: false, enabled: !!id });
}

export function useStreakBoard() {
  return useQuery({ queryKey: ["board-streaks"], queryFn: () => optional<StreakRow[]>("/boards/streaks"), staleTime: 30_000, retry: false });
}

export function useProfile(handle: string) {
  return useQuery({ queryKey: ["profile", handle], queryFn: () => api<ProfileView>(`/profile/${encodeURIComponent(handle)}`), retry: false });
}

export function useSolutions(id: string) {
  return useQuery({ queryKey: ["solutions", id], queryFn: () => optional<SolutionsView>(`/challenges/${id}/solutions`), retry: false });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => optional<SettingsView>("/settings"), retry: false });
}

/** "Battle Pack 05". */
export function packName(n: number): string {
  return `Battle Pack ${String(n).padStart(2, "0")}`;
}

/** UTC month key "2026-11" for a date. */
export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}
