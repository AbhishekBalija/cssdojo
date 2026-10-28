import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminActionRow, AdminChallengeRow, AdminPackRow, AdminPlayerDetail, AdminPlayerRow, AdminStats } from "@cssdojo/shared";
import { api, ApiError } from "./api";
import { toast } from "./toast";

// Hooks for the admin panel (docs/requirements/admin.md). The server answers 404 to
// anyone who is not an admin, so `useIsAdmin` treats a 404 as "no".

export function useIsAdmin(signedIn: boolean) {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => {
      try {
        await api("/admin/me");
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return false;
        throw e;
      }
    },
    enabled: signedIn,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useAdminPacks() {
  return useQuery({ queryKey: ["admin", "packs"], queryFn: () => api<AdminPackRow[]>("/admin/packs") });
}

export function useAdminChallenges() {
  return useQuery({ queryKey: ["admin", "challenges"], queryFn: () => api<AdminChallengeRow[]>("/admin/challenges") });
}

export function useAdminPlayerSearch(q: string) {
  return useQuery({
    queryKey: ["admin", "players", q],
    queryFn: () => api<AdminPlayerRow[]>(`/admin/players?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });
}

export function useAdminPlayer(id: string | null) {
  return useQuery({ queryKey: ["admin", "player", id], queryFn: () => api<AdminPlayerDetail>(`/admin/players/${id ?? ""}`), enabled: !!id });
}

export function useAdminStats() {
  return useQuery({ queryKey: ["admin", "stats"], queryFn: () => api<AdminStats>("/admin/stats"), refetchInterval: 30_000 });
}

export function useAdminActions() {
  return useQuery({ queryKey: ["admin", "actions"], queryFn: () => api<AdminActionRow[]>("/admin/actions") });
}

/**
 * One admin write. On success it refreshes every admin query, so lists and the audit
 * log show the change, and the player-facing data the change touched.
 */
export function useAdminWrite<TBody>(method: "POST" | "PUT", done: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body: TBody }) => api<unknown>(path, { method, json: body }),
    onSuccess: async () => {
      toast(done);
      await qc.invalidateQueries({ queryKey: ["admin"] });
      await qc.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}
