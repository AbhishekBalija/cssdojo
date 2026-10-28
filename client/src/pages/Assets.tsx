import { BELTS } from "@cssdojo/shared";
import { Belt } from "@/components/Belt";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { EmptyState, ErrorState, LostState } from "@/components/States";

const SVGS = ["logo-dark.svg", "logo-light.svg", "mark.svg", "mark-light.svg", "app-icon.svg"];
const PNGS = ["icon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

function Spec({ title, note, children, light }: { title: string; note?: string; children: React.ReactNode; light?: boolean }) {
  return (
    <figure className={`asset${light ? " on-light" : ""}`}>
      <div className="asset-box">{children}</div>
      <figcaption>
        <b>{title}</b>
        {note ? <span className="note"> {note}</span> : null}
      </figcaption>
    </figure>
  );
}

/** Review sheet for every brand asset in client/public/brand, made by `bun run brand`. */
export function Assets() {
  return (
    <div className="app">
      <Header />
      <main className="page">
        <h1>Brand assets</h1>
        <p className="lead">Everything here is hand-written SVG or rendered from HTML by <code>bun run brand</code>, from the approved tokens. No generated imagery.</p>

        <h2 className="h2">Logo and mark</h2>
        <div className="asset-grid">
          <Spec title="Header logo" note="live component">
            <Logo />
          </Spec>
          {SVGS.map((f) => (
            <Spec key={f} title={f} light={f.includes("light")}>
              <img src={`/brand/${f}`} alt={f} />
            </Spec>
          ))}
        </div>

        <h2 className="h2">Icons</h2>
        <div className="asset-grid">
          {PNGS.map((f) => (
            <Spec key={f} title={f}>
              <img src={`/brand/${f}`} alt={f} style={{ maxWidth: 128, maxHeight: 128 }} />
            </Spec>
          ))}
        </div>

        <h2 className="h2">Belt badges</h2>
        <div className="asset-grid">
          {BELTS.map((b) => (
            <Spec key={b} title={`belt-${b}.svg`}>
              <img src={`/brand/belt-${b}.svg`} alt={`${b} belt`} />
            </Spec>
          ))}
          {BELTS.map((b) => (
            <Spec key={`${b}-l`} title={`belt-${b}-light.svg`} light>
              <img src={`/brand/belt-${b}-light.svg`} alt={`${b} belt, light`} />
            </Spec>
          ))}
          <Spec title="Belt component" note="live, uses theme tokens">
            <div className="row-gap wrap">
              {BELTS.map((b) => (
                <Belt key={b} belt={b} />
              ))}
            </div>
          </Spec>
        </div>

        <h2 className="h2">Share image</h2>
        <p className="note">1200 x 630, from <code>share-template.html</code>. Used for Open Graph and Twitter cards.</p>
        <img className="asset-og" src="/brand/og-default.png" alt="Default share image" width={1200} height={630} />

        <h2 className="h2">States</h2>
        <div className="asset-grid wide">
          <Spec title="Empty state">
            <EmptyState title="No attempts yet">Submit once and it shows up here.</EmptyState>
          </Spec>
          <Spec title="Error state">
            <ErrorState onRetry={() => undefined} />
          </Spec>
          <Spec title="404" note="see any unknown URL">
            <LostState />
          </Spec>
        </div>
      </main>
      <Footer />
    </div>
  );
}
