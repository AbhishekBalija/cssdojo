import { createRootRoute, createRoute, createRouter, Outlet, useParams } from "@tanstack/react-router";
import { Toaster } from "@/components/Toaster";
import { ErrorState, StatePage } from "@/components/States";
import { Assets } from "@/pages/Assets";
import { Gallery } from "@/pages/Gallery";
import { AppShell } from "@/components/Shell";
import { Home } from "@/pages/Home";
import { KataPage } from "@/pages/KataPage";
import { Packs } from "@/pages/Packs";
import { PackPage } from "@/pages/PackPage";
import { ChallengeBoardPage, PackBoardPage, StreakBoardPage, WallBoard } from "@/pages/Leaderboards";
import { Kata } from "@/pages/Kata";
import { Privacy, Terms } from "@/pages/Legal";
import { NotFound } from "@/pages/NotFound";
import { Play } from "@/pages/Play";
import { MyProfile, PublicProfile } from "@/pages/Profile";
import { Settings } from "@/pages/Settings";
import { Solutions } from "@/pages/Solutions";
import { SignIn } from "@/pages/SignIn";

// Learning note: TanStack Router builds a typed route tree, so <Link to="/c/$id">
// only compiles when the route and its params exist.

const root = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster />
    </>
  ),
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <StatePage>
      <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={reset} />
    </StatePage>
  ),
});

// Every page but the play screen sits in the shell: sidebar, header, streak tag and bell.
const shell = createRoute({ getParentRoute: () => root, id: "shell", component: AppShell });
const home = createRoute({ getParentRoute: () => shell, path: "/", component: Home });
const kata = createRoute({ getParentRoute: () => shell, path: "/kata", component: KataPage });
const packs = createRoute({ getParentRoute: () => shell, path: "/packs", component: Packs });
const pack = createRoute({ getParentRoute: () => shell, path: "/packs/$n", component: PackPage });

function PlayRoute() {
  const { id } = useParams({ from: "/c/$id" });
  return <Play key={id} challengeId={id} board="library" />;
}
const play = createRoute({ getParentRoute: () => root, path: "/c/$id", component: PlayRoute });

const kataPlay = createRoute({ getParentRoute: () => root, path: "/kata/play", component: Kata });
const leaderboard = createRoute({ getParentRoute: () => shell, path: "/leaderboard", component: WallBoard });
const lbPacks = createRoute({
  getParentRoute: () => shell,
  path: "/leaderboard/packs",
  validateSearch: (s: Record<string, unknown>): { n?: number } => ({ n: Number.isInteger(Number(s.n)) && Number(s.n) > 0 ? Number(s.n) : undefined }),
  component: PackBoardPage,
});
const lbChallenges = createRoute({
  getParentRoute: () => shell,
  path: "/leaderboard/challenges",
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({ id: typeof s.id === "string" ? s.id : undefined }),
  component: ChallengeBoardPage,
});
const lbStreaks = createRoute({ getParentRoute: () => shell, path: "/leaderboard/streaks", component: StreakBoardPage });
const me = createRoute({ getParentRoute: () => shell, path: "/me", component: MyProfile });
function SolutionsRoute() {
  const { id } = useParams({ from: "/shell/c/$id/solutions" });
  return <Solutions key={id} id={id} />;
}
const solutions = createRoute({ getParentRoute: () => shell, path: "/c/$id/solutions", component: SolutionsRoute });
const settings = createRoute({ getParentRoute: () => shell, path: "/settings", component: Settings });
function UserRoute() {
  const { handle } = useParams({ from: "/shell/u/$handle" });
  return <PublicProfile key={handle} handle={handle} />;
}
const userPage = createRoute({ getParentRoute: () => shell, path: "/u/$handle", component: UserRoute });
const signin = createRoute({
  getParentRoute: () => root,
  path: "/signin",
  validateSearch: (s: Record<string, unknown>): { next?: string; error?: string } => ({
    next: typeof s.next === "string" ? s.next : undefined,
    error: typeof s.error === "string" || typeof s.error === "number" ? String(s.error) : undefined,
  }),
  component: SignIn,
});
const gallery = createRoute({ getParentRoute: () => root, path: "/gallery", component: Gallery });
const assets = createRoute({ getParentRoute: () => root, path: "/assets", component: Assets });
const privacy = createRoute({ getParentRoute: () => root, path: "/privacy", component: Privacy });
const terms = createRoute({ getParentRoute: () => root, path: "/terms", component: Terms });

export const routeTree = root.addChildren([shell.addChildren([home, kata, packs, pack, leaderboard, lbPacks, lbChallenges, lbStreaks, me, settings, userPage, solutions]), play, kataPlay, signin, gallery, assets, privacy, terms]);
export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
