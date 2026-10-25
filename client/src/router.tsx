import { createRootRoute, createRoute, createRouter, Outlet, useParams } from "@tanstack/react-router";
import { Toaster } from "@/components/Toaster";
import { Gallery } from "@/pages/Gallery";
import { Home } from "@/pages/Home";
import { Kata } from "@/pages/Kata";
import { Privacy, Terms } from "@/pages/Legal";
import { Placeholder } from "@/pages/Placeholder";
import { NotFound } from "@/pages/NotFound";
import { Play } from "@/pages/Play";

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
});

const home = createRoute({ getParentRoute: () => root, path: "/", component: Home });

function PlayRoute() {
  const { id } = useParams({ from: "/c/$id" });
  return <Play key={id} challengeId={id} board="library" />;
}
const play = createRoute({ getParentRoute: () => root, path: "/c/$id", component: PlayRoute });

const kata = createRoute({ getParentRoute: () => root, path: "/kata", component: Kata });
const leaderboard = createRoute({ getParentRoute: () => root, path: "/leaderboard", component: () => <Placeholder title="Leaderboard" /> });
const me = createRoute({ getParentRoute: () => root, path: "/me", component: () => <Placeholder title="Profile" /> });
const signin = createRoute({ getParentRoute: () => root, path: "/signin", component: () => <Placeholder title="Sign in" /> });
const gallery = createRoute({ getParentRoute: () => root, path: "/gallery", component: Gallery });
const privacy = createRoute({ getParentRoute: () => root, path: "/privacy", component: Privacy });
const terms = createRoute({ getParentRoute: () => root, path: "/terms", component: Terms });

export const routeTree = root.addChildren([home, play, kata, leaderboard, me, signin, gallery, privacy, terms]);
export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
