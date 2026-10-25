import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { Belt, MeView } from "@cssdojo/shared";
import { api, clearGuestId, guestId } from "./api";
import { toast } from "./toast";

/** Who is playing: guest or signed-in user, with streak and belts. */
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<MeView>("/me"), staleTime: 30_000, retry: false });
}

/**
 * After sign-in, moves this browser's guest progress onto the account once,
 * then forgets the guest id. Mounted in the header so it runs on any page.
 */
export function useGuestMerge(): void {
  const me = useMe();
  const qc = useQueryClient();
  const started = useRef(false);
  const signedIn = !!me.data?.user;
  useEffect(() => {
    if (!signedIn || started.current || !guestId()) return;
    started.current = true;
    void api<{ moved: number; beltsEarned: Belt[] }>("/me/merge", { method: "POST" })
      .then((r) => {
        clearGuestId();
        if (r.moved > 0) toast(`Your guest progress is now on your account (${r.moved} Submit${r.moved === 1 ? "" : "s"}).`);
        void qc.invalidateQueries();
      })
      .catch(() => {
        started.current = false;
      });
  }, [signedIn, qc]);
}

export async function signOut(): Promise<void> {
  await api("/auth/sign-out", { method: "POST", json: {} });
}
