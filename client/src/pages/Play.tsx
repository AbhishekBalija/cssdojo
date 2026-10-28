import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BarChart3, Check, Copy, History, Settings, TextQuote, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOLVED_AT, type Belt as BeltName, type ChallengeProgress, type CheckResult, type LeaderboardRow, type PublicChallenge, type ScoreResult, type SubmissionView } from "@cssdojo/shared";
import { Belt } from "@/components/Belt";
import { CodeEditor, type CodeEditorHandle } from "@/components/CodeEditor";
import { Dialog } from "@/components/Dialog";
import { OutputFrame, type PreviewState } from "@/components/OutputFrame";
import { PlayHeader, usePackOf } from "@/components/PlayHeader";
import { Roll } from "@/components/Roll";
import { BeltEarned, ResultCard } from "@/components/ResultCard";
import { EmptyState, StatePage } from "@/components/States";
import { TargetCanvas } from "@/components/TargetCanvas";
import { ApiError, api } from "@/lib/api";
import { pad3 } from "@/lib/belts";
import { confetti } from "@/lib/confetti";
import { formatCode, formatDuration, untilReset } from "@/lib/format";
import { useMe } from "@/lib/me";
import { playSolveSound } from "@/lib/sound";
import { storage } from "@/lib/storage";
import { markTask } from "@/lib/tasks";
import { clearToasts, toast } from "@/lib/toast";

// The play screen: editor | your output | target, as approved in
// brand/play-final-2026-10-25.html. Scores come from the server scorer.

const CHECK_LABELS: Record<string, string> = {
  "hooks-present": "Parts are where the target has them",
  "hover-changes": "Responds to hover",
  "focus-visible": "Keyboard focus is visible",
  "text-contrast-aa": "Text is easy to read",
  "target-size": "Big enough to tap",
  "semantic-control": "Controls are real controls",
  "real-text": "Text is real text",
};

interface Attempt extends SubmissionView {
  code: string;
}

type Moment = { kind: "result"; view: SubmissionView; result: Extract<ScoreResult, { status: "scored" }>; chars: number };

export function Play({ challengeId, board, kataLabel }: { challengeId: string; board: string; kataLabel?: string }) {
  const qc = useQueryClient();
  const me = useMe();
  // A 404 will not fix itself, so show "not here" at once instead of retrying for several seconds.
  const challenge = useQuery({
    queryKey: ["challenge", challengeId],
    queryFn: () => api<PublicChallenge>(`/challenges/${challengeId}`),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 3,
  });
  const progress = useQuery({ queryKey: ["progress", challengeId], queryFn: () => api<ChallengeProgress>(`/challenges/${challengeId}/progress`) });
  const pack = usePackOf(challengeId);

  const codeKey = `dojo-code:${challengeId}:${board}`;
  const [code, setCode] = useState<string>(() => storage.get(codeKey) ?? "");
  const editor = useRef<CodeEditorHandle | null>(null);
  const [state, setState] = useState<PreviewState>("rest");
  const [slide, setSlide] = useState(true);
  const [diff, setDiff] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  // The scorer's mismatch maps from the last Submit, valid while the code is unchanged.
  const [scored, setScored] = useState<{ code: string; maps: NonNullable<SubmissionView["maps"]> } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [onion, setOnion] = useState(false);
  const [measure, setMeasure] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  // D and G are held to peek: release puts things back as they were.
  const held = useRef<{ d?: boolean; g?: boolean }>({});
  const [dlg, setDlg] = useState<null | "keys" | "lb" | "hist">(null);
  const [pop, setPop] = useState<null | "gear">(null);
  const [moment, setMoment] = useState<null | { kind: "belt"; belt: BeltName; then: Moment | null } | Moment>(null);
  const [saved, setSaved] = useState(false);
  const [tipHidden, setTipHidden] = useState(storage.get("dojo-mode-hidden") === "1");
  const [fontSize, setFontSize] = useState(storage.get("dojo-fs") ?? "12.5");
  const [resetIn, setResetIn] = useState(untilReset());
  const [pane, setPane] = useState<"editor" | "output" | "target">("editor");

  const c = challenge.data;

  // Starter code on first visit.
  useEffect(() => {
    if (c && !storage.get(codeKey)) {
      setCode(c.starter);
      editor.current?.setValue(c.starter);
    }
  }, [c, codeKey]);

  // Record the first open (solve time starts here).
  useEffect(() => {
    void api(`/challenges/${challengeId}/open`, { method: "POST", json: { board } }).catch(() => undefined);
  }, [challengeId, board]);
  // Toasts (and their Undo) belong to this challenge, so drop them on the way out.
  useEffect(() => () => clearToasts(), [challengeId, board]);

  useEffect(() => {
    const t = setInterval(() => setResetIn(untilReset()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (me.data?.user) task("signin");
  }, [me.data?.user]);

  const task = useCallback((k: Parameters<typeof markTask>[0]) => void markTask(k), []);

  // The quiet "Saved" label: in one second after the last keystroke, out two seconds later.
  const savedTimer = useRef<{ show?: ReturnType<typeof setTimeout>; hide?: ReturnType<typeof setTimeout> }>({});
  useEffect(() => () => {
    clearTimeout(savedTimer.current.show);
    clearTimeout(savedTimer.current.hide);
  }, []);
  const onChange = (v: string) => {
    setCode(v);
    storage.set(codeKey, v);
    setSaved(false);
    clearTimeout(savedTimer.current.show);
    clearTimeout(savedTimer.current.hide);
    savedTimer.current.show = setTimeout(() => {
      setSaved(true);
      savedTimer.current.hide = setTimeout(() => setSaved(false), 2000);
    }, 1000);
  };

  const submit = useCallback(async () => {
    // The starter arrives with the challenge; an early click would submit nothing.
    if (submitting || !code.trim()) return;
    setSubmitting(true);
    try {
      const { id } = await api<{ id: string }>("/submissions", { method: "POST", json: { challengeId, code, board } });
      let view = await api<SubmissionView>(`/submissions/${id}?wait=1`);
      for (let i = 0; i < 4 && (view.status === "queued" || view.status === "running"); i++) view = await api<SubmissionView>(`/submissions/${id}?wait=1`);
      if (view.status === "failed" || !view.result) {
        toast(view.error ? `Scoring failed: ${view.error}` : "Scoring is taking longer than usual. Try again in a moment.");
        return;
      }
      const r = view.result;
      setResult(r);
      setScored(view.maps ? { code, maps: view.maps } : null);
      task("submit");
      if (r.status === "missing-hook") {
        toast(r.message);
        return;
      }
      if (r.checks.some((ch) => ch.pass && ch.id !== "hooks-present")) task("check");
      const prevBest = progress.data?.best ?? null;
      const firstSolve = r.score >= SOLVED_AT && (prevBest === null || prevBest < SOLVED_AT);
      if (firstSolve) {
        confetti();
        playSolveSound();
      }
      const gained = view.ranking?.gained ?? 0;
      toast(view.newBest ? `New best: ${r.score}${gained > 0 ? ` · +${gained} pts` : ""}` : `Scored ${r.score} with a ${r.visual}% match`);
      for (const w of r.warnings.slice(0, 2)) toast(w);
      // A new best or a first solve opens the result card; a belt opens its own card first.
      const card: Moment | null = view.newBest || firstSolve ? { kind: "result", view, result: r, chars: code.length } : null;
      const belt = view.beltsEarned?.[0];
      setMoment(belt ? { kind: "belt", belt, then: card } : card);
      void qc.invalidateQueries({ queryKey: ["progress", challengeId] });
      void qc.invalidateQueries({ queryKey: ["challenges"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["attempts", challengeId] });
      void qc.invalidateQueries({ queryKey: ["lb", challengeId] });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not reach the scorer. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, challengeId, code, board, task, progress.data?.best, qc]);

  const scoreMap = scored && scored.code === code ? scored.maps[state] : undefined;

  const siblings = pack?.challenges ?? [];
  const at = siblings.findIndex((x) => x.id === challengeId);
  const nextTarget = at >= 0 ? siblings.slice(at + 1).concat(siblings.slice(0, at)).find((x) => x.best === null || x.best < SOLVED_AT) : undefined;

  // Shortcuts from the approved list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const typing = (e.target as HTMLElement | null)?.closest(".cm-editor, input, textarea");
      if (e.key === "Escape") {
        setPop(null);
        return;
      }
      if (mod && e.key === "Enter") {
        e.preventDefault();
        void submit();
      } else if (e.shiftKey && e.altKey && k === "f") {
        e.preventDefault();
        doFormat();
      } else if (mod && e.shiftKey && k === "e") {
        e.preventDefault();
        setPane("editor");
        editor.current?.focus();
      } else if (mod && e.shiftKey && k === "s") {
        e.preventDefault();
        setSlide((v) => !v);
      } else if (mod && e.shiftKey && k === "d") {
        e.preventDefault();
        setDiff((v) => !v);
      } else if (mod && e.shiftKey && k === "c") {
        e.preventDefault();
        setPane("target");
        document.querySelector<HTMLButtonElement>(".colorchip")?.focus();
      } else if (e.key === "?" && !typing) {
        e.preventDefault();
        setDlg("keys");
      } else if (!typing && !mod && !e.altKey && !e.repeat && (k === "d" || k === "g")) {
        e.preventDefault();
        held.current[k] = true;
        if (k === "d") setDiff(true);
        else setOnion(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((k === "d" || k === "g") && held.current[k]) {
        held.current[k] = false;
        if (k === "d") setDiff(false);
        else setOnion(false);
      }
    };
    addEventListener("keydown", onKey);
    addEventListener("keyup", onUp);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onUp);
    };
  });

  // Target states playback: rest, hover, focus with a 900ms hold each, one loop.
  const playStates = () => {
    if (!c || playing) return;
    const seq = (["rest", "hover", "focus"] as const).filter((x) => x === "rest" || c.frames.includes(x));
    setPlaying(true);
    seq.forEach((st, i) => setTimeout(() => setState(st), i * 900));
    setTimeout(() => {
      setState("rest");
      setPlaying(false);
    }, seq.length * 900);
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".pop, [aria-haspopup]")) setPop(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function doFormat() {
    const next = formatCode(code);
    onChange(next);
    editor.current?.setValue(next);
    toast("Code formatted");
  }

  const checks: (CheckResult & { pending?: boolean })[] = useMemo(() => {
    if (result?.status === "scored") return result.checks;
    return (c?.checks ?? []).map((id) => ({ id, label: CHECK_LABELS[id] ?? id, pass: false, pending: true }));
  }, [result, c]);

  const high = progress.data?.best ?? null;
  const last = result?.status === "scored" ? result : null;
  const lbTitle = c ? `${pad3(c.number)} ${c.title}${kataLabel ? ` · ${kataLabel}` : ""}` : "";

  if (challenge.isError) {
    return (
      <StatePage>
        <EmptyState
          title="That challenge isn't here"
          action={
            <Link to="/packs" className="d-btn sec">
              All Battle Packs
            </Link>
          }
        >
          It may have been renamed.
        </EmptyState>
      </StatePage>
    );
  }

  return (
    <div className="app app-locked" style={{ ["--editor-fs" as string]: `${fontSize}px` }}>
      <PlayHeader c={c} challengeId={challengeId} kataLabel={kataLabel} />
      <div className="desk-note">The editor works best on a desktop. You can browse and read here.</div>

      <main className="play-main">
        <section className={`pane${pane === "editor" ? " on" : ""}`} aria-label="Editor">
          <div className="pane-h">
            <h2>Editor</h2>
            <span className="meta">{code.length} chars</span>
            <button
              className="btn ghost sm"
              type="button"
              onClick={() => {
                if (!c) return;
                const before = code;
                onChange(c.starter);
                editor.current?.setValue(c.starter);
                toast("Code reset to the starter", {
                  label: "Undo",
                  run: () => {
                    onChange(before);
                    editor.current?.setValue(before);
                  },
                });
              }}
            >
              Reset
            </button>
            <button className="icon-btn" style={{ width: 30, height: 30 }} type="button" aria-label="Editor settings" aria-haspopup="true" aria-expanded={pop === "gear"} onClick={() => setPop(pop === "gear" ? null : "gear")}>
              <Settings size={15} />
            </button>
          </div>
          {pop === "gear" ? (
            <div className="pop" style={{ top: 48, right: 12, width: 260 }}>
              <div className="menu-sec">
                <span className="lbl">Font size</span>
                <span className="seg">
                  {[
                    ["11.5", "S"],
                    ["12.5", "M"],
                    ["14", "L"],
                  ].map(([fs, l]) => (
                    <button
                      key={fs}
                      type="button"
                      aria-pressed={fontSize === fs}
                      onClick={() => {
                        setFontSize(fs ?? "12.5");
                        storage.set("dojo-fs", fs ?? "12.5");
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </span>
              </div>
              <div className="menu-sec">
                <span className="lbl">Tip card</span>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => {
                    setTipHidden(false);
                    storage.set("dojo-mode-hidden", "0");
                    setPop(null);
                  }}
                >
                  Show the scoring tip again
                </button>
              </div>
            </div>
          ) : null}
          {!tipHidden ? (
            <div className="mode">
              <span className="ic">
                <i className="mark" />
              </span>
              <div>
                <b>Match the look, then the states</b>
                <p>70% looks, 30% outcome checks. How you build it is up to you.</p>
              </div>
              <button
                className="x"
                type="button"
                aria-label="Hide this tip"
                onClick={() => {
                  setTipHidden(true);
                  storage.set("dojo-mode-hidden", "1");
                }}
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          ) : null}
          <div className="editor">
            <CodeEditor value={code} onChange={onChange} onSubmit={() => void submit()} onReady={(h) => (editor.current = h)} />
          </div>
          <div className="ed-foot">
            <button className="btn primary" type="button" onClick={() => void submit()} disabled={submitting || !code.trim()} data-testid="submit">
              {submitting ? "Scoring…" : "Submit"} <kbd>Ctrl</kbd>
              <kbd>⏎</kbd>
            </button>
            <span className="ed-tools">
              <button className="btn ghost sm" type="button" title="Format code (Shift+Alt+F)" onClick={doFormat}>
                <TextQuote size={15} />
                Format
              </button>
              <button
                className="btn ghost sm"
                type="button"
                title="Copy your code"
                onClick={() => {
                  navigator.clipboard.writeText(code).then(
                    () => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    },
                    () => toast("Couldn't copy here"),
                  );
                }}
              >
                <span className="d-swap" data-on={copied}>
                  <Copy size={15} />
                  <Check size={15} />
                </span>
                {copied ? "Copied" : "Copy"}
              </button>
            </span>
            <span className={`meta d-saved${saved ? " on" : ""}`} aria-live="polite">
              {saved ? "Saved" : ""}
            </span>
          </div>
        </section>

        <div className="side">
          <section className={`pane${pane === "output" ? " on" : ""}`} aria-label="Your output">
            <div className="pane-h">
              <h2>Your output</h2>
              <div className="togs">
                <button className="tog" type="button" aria-pressed={slide} title="Ctrl+Shift+S" onClick={() => setSlide(!slide)}>
                  <span className="box" />
                  Slide
                </button>
                <button className="tog" type="button" aria-pressed={diff} title="Show what doesn't match yet in red. Ctrl+Shift+D, or hold D" onClick={() => setDiff(!diff)}>
                  <span className="box" />
                  Mismatch
                </button>
                <button className="tog" type="button" aria-pressed={onion} title="The target at 30% over your output. Hold G" onClick={() => setOnion(!onion)}>
                  <span className="box" />
                  Onion
                </button>
              </div>
            </div>
            <div className="pane-b">
              {c ? (
                <OutputFrame
                  code={code}
                  challengeId={c.id}
                  hooks={c.hooks}
                  states={c.states}
                  state={state}
                  slide={slide}
                  diff={diff}
                  scoreMap={scoreMap}
                  onion={onion}
                  onSlide={() => task("slide")}
                />
              ) : (
                <div className="frame" />
              )}
              {diff && scoreMap ? (
                <p className="smap-note" data-testid="score-map-note">
                  <i className="red" /> shape <i className="amber" /> colour · from your last Submit. Edit to go live.
                </p>
              ) : null}
              <div className="statebar">
                <span className="seg" role="group" aria-label="Preview state">
                  {(["rest", "hover", "focus"] as const)
                    .filter((s) => s === "rest" || c?.frames.includes(s))
                    .map((s) => (
                      <button key={s} type="button" aria-pressed={state === s} onClick={() => setState(s)}>
                        {s === "rest" ? "Rest" : `:${s}`}
                      </button>
                    ))}
                </span>
                <span className="lbl">{state === "rest" ? "Preview both in a state" : state === "hover" ? "Showing :hover on both" : "Showing :focus-visible on both"}</span>
                {c && c.frames.length > 1 ? (
                  <button type="button" className="btn ghost sm" onClick={playStates} disabled={playing} title="Play rest, hover and focus once">
                    {playing ? "Playing…" : "▶ Play states"}
                  </button>
                ) : null}
              </div>
              {result?.status === "missing-hook" ? <div className="banner warn">{result.message}</div> : null}
              <div className="stats">
                <div className={`tile${last ? "" : " empty"}${last && high !== null && last.score >= high ? " best" : ""}`} data-testid="last-score">
                  <span className="k">Last score</span>
                  <span className={`v${last ? " acc" : ""}`}>{last ? <Roll text={last.score.toFixed(1)} /> : "–"}</span>
                  {last ? (
                    <>
                      <span className={`d-scorebar${last.score >= SOLVED_AT ? " ok" : ""}`} aria-hidden="true">
                        <i style={{ transform: `scaleX(${last.score / 100})` }} />
                        <b style={{ left: `${SOLVED_AT}%` }} />
                      </span>
                      <span className="d">
                        {last.visual}% · {last.checksPassed}/{last.checksRun}
                      </span>
                      <button
                        className="share"
                        type="button"
                        onClick={() => {
                          const n = Math.round(last.score / 10);
                          const txt = `CSS Dojo · ${pad3(c?.number ?? 0)} ${c?.title ?? ""}\n${"▰".repeat(n)}${"▱".repeat(10 - n)} ${last.score}/100\n${last.visual}% match · ${last.checksPassed}/${last.checksRun} checks\ncssdojo.com`;
                          navigator.clipboard.writeText(txt).then(
                            () => toast("Result copied. Paste it anywhere"),
                            () => toast(`Your result: ${last.score}/100`),
                          );
                        }}
                      >
                        Share result
                      </button>
                    </>
                  ) : null}
                </div>
                <div className={`tile${high === null ? " empty" : ""}`}>
                  <span className="k">High score</span>
                  <span className="v" data-testid="high-score">
                    {high ?? "–"}
                  </span>
                  {progress.data?.locked ? <span className="d-chip" style={{ alignSelf: "flex-start" }}>LOCKED</span> : null}
                  <Link to="/c/$id/solutions" params={{ id: challengeId }} className="share">
                    Solutions
                  </Link>
                </div>
              </div>
              <div className="row2">
                <button className="btn" type="button" onClick={() => setDlg("lb")}>
                  <BarChart3 size={15} />
                  Leaderboard
                </button>
                <button className="btn" type="button" onClick={() => setDlg("hist")}>
                  <History size={15} />
                  My attempts
                </button>
              </div>
            </div>
          </section>

          <section className={`pane${pane === "target" ? " on" : ""}`} aria-label="Target">
            <div className="pane-h">
              <h2>Target</h2>
              <div className="togs">
                <button className="tog" type="button" aria-pressed={measure} title="Crosshair with x, y and colour" onClick={() => setMeasure(!measure)}>
                  <span className="box" />
                  Measure
                </button>
              </div>
              <span className="meta">400 × 300</span>
            </div>
            <div className="pane-b">
              {c ? <TargetCanvas challengeId={c.id} title={c.title} forced={state} measure={measure} /> : <div className="frame" />}
              <span className="livetag">
                <i />
                {c && c.frames.includes("focus")
                  ? "Hover it. Click it, then Tab for focus."
                  : c && c.frames.length > 1
                    ? "Live target. Hover it to see the change."
                    : "Target. Match it pixel for pixel."}
              </span>
              {c ? (
                <div className="t-title">
                  <span className="lbl">
                    {pad3(c.number)}
                    {kataLabel ? ` · ${kataLabel}` : ""}
                  </span>
                  <span className="art">{c.title}</span>
                  <Belt belt={c.belt} />
                </div>
              ) : null}
              {c ? (
                <div className="sec">
                  <span className="lbl">Colors</span>
                  <div className="chips">
                    {c.colors.map((hex) => (
                      <ColorChip key={hex} hex={hex} />
                    ))}
                  </div>
                </div>
              ) : null}
              {c && c.fonts.length > 0 ? (
                <div className="sec">
                  <span className="lbl">Fonts · loaded for you</span>
                  <div className="chips">
                    {c.fonts.map((f) => (
                      <FontChip key={f} family={f} />
                    ))}
                  </div>
                </div>
              ) : null}
              {/* Collapsed by default to keep the panel calm. The summary still shows how many checks pass. */}
              <details className="sec checks-fold">
                <summary className="lbl">
                  Outcome checks
                  <span className="cnt">{result?.status === "scored" ? `${checks.filter((x) => x.pass).length} of ${checks.length} pass` : `${checks.length} checks`}</span>
                </summary>
                <div className="checks" data-testid="checks">
                  {checks.map((ch, i) => {
                    const cls = ch.pending ? "pending" : ch.pass ? "pass" : "miss";
                    const hint = !ch.pending && !ch.pass ? ch.hint : undefined;
                    return (
                      <div key={`${ch.id}-${result ? "r" : "p"}`} className={`check ${cls}${ch.pending ? "" : " d-checkin"}`} style={ch.pending ? undefined : { animationDelay: `${i * 30}ms` }}>
                        <i>{ch.pending ? "" : ch.pass ? "✓" : "✕"}</i>
                        <span>{ch.label}</span>
                        <span className="r">{ch.pending ? "not run" : ch.pass ? "pass" : "miss"}</span>
                        {hint ? <span className="hint">{hint}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </details>
              {progress.data?.note ? (
                <div className="sec">
                  <span className="lbl">A nudge</span>
                  <p className="brief" style={{ whiteSpace: "pre-wrap" }}>
                    {progress.data.note}
                  </p>
                </div>
              ) : (
                <span className="note">A nudge unlocks after 3 Submits. It never changes your rank.</span>
              )}
              {c?.inspiration.length ? (
                <span className="frame-note">
                  Inspired by{" "}
                  {c.inspiration.map((i, n) => (
                    <span key={i.url}>
                      {n > 0 ? ", " : ""}
                      <a href={i.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                        {i.source}
                      </a>
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <div className="switch" role="tablist" aria-label="Pane">
        {(["editor", "output", "target"] as const).map((p) => (
          <button key={p} role="tab" aria-selected={pane === p} type="button" onClick={() => setPane(p)}>
            {p === "editor" ? "Editor" : p === "output" ? "Output" : "Target"}
          </button>
        ))}
      </div>

      <div className="status">
        <span>
          Streak <b>{me.data?.streak ?? 0} {(me.data?.streak ?? 0) === 1 ? "day" : "days"}</b>
        </span>
        <span>
          Kata resets in <b>{resetIn}</b>
        </span>
        <span className="end">
          <button className="linkish" type="button" onClick={() => setDlg("keys")}>
            <kbd>?</kbd> Shortcuts
          </button>
        </span>
      </div>

      <Dialog open={dlg === "keys"} title="Keyboard shortcuts" onClose={() => setDlg(null)}>
        <div className="keylist">
          {[
            ["Focus the editor", ["Ctrl", "Shift", "E"]],
            ["Submit", ["Ctrl", "⏎"]],
            ["Toggle slide & compare", ["Ctrl", "Shift", "S"]],
            ["Toggle mismatch", ["Ctrl", "Shift", "D"]],
            ["Peek at mismatch", ["Hold D"]],
            ["Peek with onion skin", ["Hold G"]],
            ["Focus target colors", ["Ctrl", "Shift", "C"]],
            ["Slide top to bottom", ["Shift while hovering"]],
            ["Format code", ["Shift", "Alt", "F"]],
            ["Show this list", ["?"]],
          ].map(([label, keys]) => (
            <div key={label as string}>
              <span>{label as string}</span>
              <span className="keys">
                {(keys as string[]).map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </Dialog>
      {dlg === "lb" ? <LeaderboardDialog challengeId={challengeId} board={board} title={lbTitle} onClose={() => setDlg(null)} /> : null}
      {dlg === "hist" ? (
        <AttemptsDialog
          challengeId={challengeId}
          title={c ? `My attempts on ${pad3(c.number)}` : "My attempts"}
          onClose={() => setDlg(null)}
          onLoad={(v) => {
            onChange(v);
            editor.current?.setValue(v);
            setDlg(null);
            toast("Attempt loaded into the editor");
          }}
        />
      ) : null}
      {moment?.kind === "belt" ? <BeltEarned belt={moment.belt} pack={pack} onClose={() => setMoment(moment.then)} /> : null}
      {moment?.kind === "result" && c ? (
        <ResultCard c={c} r={moment.result} ranking={moment.view.ranking} newBest={!!moment.view.newBest} chars={moment.chars} pack={pack} next={nextTarget} onClose={() => setMoment(null)} />
      ) : null}
    </div>
  );
}

function ColorChip({ hex }: { hex: string }) {
  const [copied, setCopied] = useState(false);
  const done = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className={`colorchip${copied ? " copied" : ""}`} type="button" onClick={() => navigator.clipboard.writeText(hex).then(done, done)}>
      <i style={{ background: hex }} />
      {copied ? "Copied" : hex}
    </button>
  );
}

/** Shows a font in its own face; a click copies a ready font-family value. */
function FontChip({ family }: { family: string }) {
  const [copied, setCopied] = useState(false);
  const fallback = family === "Martian Mono" ? "monospace" : family === "Instrument Serif" ? "serif" : "sans-serif";
  const value = `"${family}", ${fallback}`;
  const done = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className={`colorchip fontchip${copied ? " copied" : ""}`} type="button" title={`Copy font-family: ${value}`} onClick={() => navigator.clipboard.writeText(value).then(done, done)}>
      <b style={{ fontFamily: value }}>Aa</b>
      {copied ? "Copied" : family}
    </button>
  );
}

function LeaderboardDialog({ challengeId, board, title, onClose }: { challengeId: string; board: string; title: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["lb", challengeId, board], queryFn: () => api<LeaderboardRow[]>(`/leaderboard/${challengeId}?board=${encodeURIComponent(board)}`) });
  return (
    <Dialog open title={title} onClose={onClose}>
      <div className="lb">
        {(q.data ?? []).map((r) => (
          <div key={`${r.rank}-${r.handle}`} className={r.me ? "me" : ""}>
            <span className="n">{r.rank}</span>
            <span>{r.me ? "You" : r.handle}</span>
            <span className="t">{formatDuration(r.solveMs)}</span>
            <span className="s">{r.score}</span>
          </div>
        ))}
        {q.isLoading ? <div className="empty-note d-wait">Loading scores…</div> : null}
        {q.isError ? <div className="empty-note">Could not load scores. Close and try again.</div> : null}
        {q.data && q.data.length === 0 ? <div className="empty-note">No signed-in scores yet. Be the first.</div> : null}
      </div>
      <span className="note">Best score first. Ties are broken by solve time, from first open to your best Submit.</span>
    </Dialog>
  );
}

function AttemptsDialog({ challengeId, title, onClose, onLoad }: { challengeId: string; title: string; onClose: () => void; onLoad: (code: string) => void }) {
  const q = useQuery({ queryKey: ["attempts", challengeId], queryFn: () => api<Attempt[]>(`/challenges/${challengeId}/attempts`) });
  return (
    <Dialog open title={title} onClose={onClose}>
      <div className="hist">
        {(q.data ?? []).map((a) => {
          const r = a.result;
          return (
            <div key={a.id}>
              <span>
                <span className="s">{r?.status === "scored" ? r.score : "–"}</span>{" "}
                <span className="t">{r?.status === "scored" ? `${r.visual}% · ${r.checksPassed}/${r.checksRun}` : r?.status === "missing-hook" ? "missing part" : "failed"}</span>
              </span>
              <span className="t">{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <button className="btn sm" type="button" onClick={() => onLoad(a.code)}>
                Load
              </button>
            </div>
          );
        })}
        {q.isLoading ? <div className="empty-note d-wait">Loading attempts…</div> : null}
        {q.isError ? <div className="empty-note">Could not load attempts. Close and try again.</div> : null}
        {q.data && q.data.length === 0 ? <div className="empty-note">No attempts yet. Submit once and it shows up here.</div> : null}
      </div>
      <span className="note">Load any attempt back into the editor.</span>
    </Dialog>
  );
}
