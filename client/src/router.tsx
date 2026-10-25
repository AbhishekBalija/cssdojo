import { createRootRoute, createRoute, createRouter, Outlet, useParams } from "@tanstack/react-router";
import { Toaster } from "@/components/Toaster";
import { Gallery } from "@/pages/Gallery";
import { Home } from "@/pages/Home";
import { Leaderboard } from "@/pages/Leaderboard";
import { Kata } from "@/pages/Kata";
import { Privacy, Terms } from "@/pages/Legal";
import { NotFound } from "@/pages/NotFound";
import { Play } from "@/pages/Play";
import { MyProfile, PublicProfile } from "@/pages/Profile";
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
});

const home = createRoute({ getParentRoute: () => root, path: "/", component: Home });

function PlayRoute() {
  const { id } = useParams({ from: "/c/$id" });
  return <Play key={id} challengeId={id} board="library" />;
}
const play = createRoute({ getParentRoute: () => root, path: "/c/$id", component: PlayRoute });

const kata = createRoute({ getParentRoute: () => root, path: "/kata", component: Kata });
const leaderboard = createRoute({ getParentRoute: () => root, path: "/leaderboard", component: Leaderboard });
const me = createRoute({ getParentRoute: () => root, path: "/me", component: MyProfile });
function UserRoute() {
  const { handle } = useParams({ from: "/u/$handle" });
  return <PublicProfile key={handle} handle={handle} />;
}
const userPage = createRoute({ getParentRoute: () => root, path: "/u/$handle", component: UserRoute });
const signin = createRoute({ getParentRoute: () => root, path: "/signin", component: SignIn });
const gallery = createRoute({ getParentRoute: () => root, path: "/gallery", component: Gallery });
const privacy = createRoute({ getParentRoute: () => root, path: "/privacy", component: Privacy });
const terms = createRoute({ getParentRoute: () => root, path: "/terms", component: Terms });

export const routeTree = root.addChildren([home, play, kata, leaderboard, me, userPage, signin, gallery, privacy, terms]);
export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
