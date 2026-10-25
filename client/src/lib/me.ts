import { useQuery } from "@tanstack/react-query";
import type { MeView } from "@cssdojo/shared";
import { api } from "./api";

/** Who is playing: guest or signed-in user, with streak and belts. */
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<MeView>("/me"), staleTime: 30_000, retry: false });
}
