import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BELTS, type GalleryItem } from "@cssdojo/shared";
import { Belt } from "@/components/Belt";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { api, staticUrl } from "@/lib/api";
import { pad3 } from "@/lib/belts";

const STATIC_FRAMES = ["rest", "hover", "focus"];

function GalleryRow({ g }: { g: GalleryItem }) {
  const frames = g.frames.filter((f) => STATIC_FRAMES.includes(f));
  return (
    <article className="gallery-row" data-testid="gallery-row">
      <div className="gallery-frames">
        {frames.map((f) => (
          <figure key={f}>
            <img src={staticUrl(`/targets/${g.id}/${f}.png`)} alt={`${g.title}, ${f}`} width={200} height={150} loading="lazy" style={{ background: g.background }} />
            <figcaption>{f}</figcaption>
          </figure>
        ))}
      </div>
      <div className="gallery-meta">
        <div className="gallery-head">
          <span className="no">{pad3(g.number)}</span>
          <h3>{g.title}</h3>
          <Belt belt={g.belt} />
          {g.kind === "kata" ? <span className="tag">Kata day {g.kataDay}</span> : null}
          <Link to="/c/$id" params={{ id: g.id }} className="btn ghost sm">
            Play
          </Link>
        </div>
        <p>{g.brief}</p>
        <p className="note">Checks: {g.checks.join(", ")}</p>
        <details>
          <summary>Golden set ({g.golden.length})</summary>
          <table className="gallery-golden">
            <tbody>
              {g.golden.map((a) => (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td>
                    {a.min} to {a.max}
                  </td>
                  <td>{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <ul className="gallery-insp">
          {g.inspiration.map((i) => (
            <li key={i.url}>
              <a href={i.url} target="_blank" rel="noreferrer">
                {i.source}
              </a>{" "}
              <span className="note">{i.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/** Review page for every challenge and kata: target frames, belt, golden set and inspiration. */
export function Gallery() {
  const q = useQuery({ queryKey: ["gallery"], queryFn: () => api<GalleryItem[]>("/gallery") });
  const items = q.data ?? [];
  return (
    <div className="app">
      <Header />
      <main className="page">
        <h1>Challenge gallery</h1>
        <p className="lead">Every challenge and kata with its target frames, belt, golden set and the sources that inspired it. Nothing here is copied from one source.</p>
        {q.isLoading ? <p className="note d-wait">Loading…</p> : null}
        {BELTS.map((belt) => {
          const rows = items.filter((g) => g.kind === "challenge" && g.belt === belt);
          if (rows.length === 0) return null;
          return (
            <section key={belt}>
              <div className="sec-title">
                <h2>{belt[0]?.toUpperCase() + belt.slice(1)}</h2>
                <Belt belt={belt} label={`${rows.length}`} />
              </div>
              {rows.map((g) => (
                <GalleryRow key={g.id} g={g} />
              ))}
            </section>
          );
        })}
        {items.some((g) => g.kind === "kata") ? (
          <section>
            <div className="sec-title">
              <h2>Daily kata</h2>
            </div>
            {items
              .filter((g) => g.kind === "kata")
              .sort((a, b) => (a.kataDay ?? 0) - (b.kataDay ?? 0))
              .map((g) => (
                <GalleryRow key={g.id} g={g} />
              ))}
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
