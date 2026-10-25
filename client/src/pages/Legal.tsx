import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export function Privacy() {
  return (
    <div className="app">
      <Header />
      <main className="page prose">
        <h1>Privacy</h1>
        <p>Short version: we keep what we need to run the dojo and nothing else. Last updated 26 October 2026.</p>
        <h2>What we store</h2>
        <p>If you sign in with GitHub or Google, we store your name, email address, profile picture URL and a public handle. For everyone, we store the code you submit, its scores and when you opened a challenge, so we can show your progress and the leaderboards.</p>
        <p>Guests get a random id kept in your browser. It is not linked to you, and its progress moves to your account when you sign in from that browser.</p>
        <h2>What we never do</h2>
        <p>We do not sell data, show ads or use third-party trackers. Your email is never shown to other players.</p>
        <h2>Cookies</h2>
        <p>One session cookie keeps you signed in. Your theme and editor settings live in your browser's local storage.</p>
        <h2>Deleting your data</h2>
        <p>Open an issue or contact the maintainer through GitHub and we will delete your account and its submissions.</p>
      </main>
      <Footer />
    </div>
  );
}

export function Terms() {
  return (
    <div className="app">
      <Header />
      <main className="page prose">
        <h1>Terms</h1>
        <p>Last updated 26 October 2026.</p>
        <h2>Play fair</h2>
        <p>Do not try to break the scorer, read other players' answers before you solve, or flood it with Submits. Rate limits apply: 30 Submits an hour for guests and 120 for signed-in players.</p>
        <h2>Your code</h2>
        <p>You keep the rights to your code. By submitting you let CSS Dojo store and render it, and show it to players who have solved the same challenge.</p>
        <h2>No warranty</h2>
        <p>CSS Dojo is a free, open-source project offered as is. Scores are for practice and fun, not a certification.</p>
      </main>
      <Footer />
    </div>
  );
}
