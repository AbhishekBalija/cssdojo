import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, ChevronDown, Copy, History, Settings, TextQuote, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOLVED_AT, type ChallengeProgress, type ChallengeSummary, type CheckResult, type LeaderboardRow, type PublicChallenge, type ScoreResult, type SubmissionView } from "@cssdojo/shared";
import { Belt } from "@/components/Belt";
import { CodeEditor, type CodeEditorHandle } from "@/components/CodeEditor";
import { Dialog } from "@/components/Dialog";
import { Header } from "@/components/Header";
import { OutputFrame, type PreviewState } from "@/components/OutputFrame";
import { TargetCanvas } from "@/components/TargetCanvas";
import { ApiError, api } from "@/lib/api";
import { pad3 } from "@/lib/belts";
import { confetti } from "@/lib/confetti";
import { formatCode, formatDuration, untilReset } from "@/lib/format";
import { useMe } from "@/lib/me";
import { storage } from "@/lib/storage";
import { toast } from "@/lib/toast";

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

const TASKS = [
  ["slide", "Compare with the target", "Hover your output to slide over the target."],
  ["check", "Pass a technique check", "Make the hover or focus behaviour match."],
  ["submit", "Submit your first kata", "Press Submit or Ctrl+Enter."],
  ["signin", "Sign in to save your streak", "Guests can play. Signing in keeps your progress."],
] as const;
type TaskKey = (typeof TASKS)[number][0];

interface Attempt extends SubmissionView {
  code: string;
}

function loadTasks(): Partial<Record<TaskKey, boolean>> {
  try {
    return JSON.parse(storage.get("dojo-tasks") ?? "{}") as Partial<Record<TaskKey, boolean>>;
  } catch {
    return {};
  }
}

export function Play({ challengeId, board, kataLabel }: { challengeId: string; board: string; kataLabel?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useMe();
  const challenge = useQuery({ queryKey: ["challenge", challengeId], queryFn: () => api<PublicChallenge>(`/challenges/${challengeId}`) });
  const progress = useQuery({ queryKey: ["progress", challengeId], queryFn: () => api<ChallengeProgress>(`/challenges/${challengeId}/progress`) });
  const list = useQuery({ queryKey: ["challenges"], queryFn: () => api<ChallengeSummary[]>("/challenges") });

  const codeKey = `dojo-code:${challengeId}:${board}`;
  const [code, setCode] = useState<string>(() => storage.get(codeKey) ?? "");
  const editor = useRef<CodeEditorHandle | null>(null);
  const [state, setState] = useState<PreviewState>("rest");
  const [slide, setSlide] = useState(true);
  const [diff, setDiff] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openHints, setOpenHints] = useState<Record<string, boolean>>({});
  const [dlg, setDlg] = useState<null | "keys" | "lb" | "hist" | "solution">(null);
  const [pop, setPop] = useState<null | "pick" | "start" | "gear">(null);
  const [tipHidden, setTipHidden] = useState(storage.get("dojo-mode-hidden") === "1");
  const [fontSize, setFontSize] = useState(storage.get("dojo-fs") ?? "12.5");
  const [tasks, setTasks] = useState(loadTasks);
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

  useEffect(() => {
    const t = setInterval(() => setResetIn(untilReset()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (me.data?.user) task("signin");
  }, [me.data?.user]);

  const task = useCallback((k: TaskKey) => {
    setTasks((prev) => {
      if (prev[k]) return prev;
      const next = { ...prev, [k]: true };
      storage.set("dojo-tasks", JSON.stringify(next));
      return next;
    });
  }, []);

  const onChange = (v: string) => {
    setCode(v);
    storage.set(codeKey, v);
  };

  const submit = useCallback(async () => {
    if (submitting) return;
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
      task("submit");
      if (r.status === "missing-hook") {
        toast(r.message);
        return;
      }
      if (r.checks.some((ch) => ch.pass && ch.id !== "hooks-present")) task("check");
      const prevBest = progress.data?.best ?? null;
      if (view.newBest && r.score >= SOLVED_AT && (prevBest === null || prevBest < SOLVED_AT)) {
        confetti();
        toast(`Solved with ${r.score}. Solutions are unlocked.`);
      } else if (view.newBest) {
        if (r.score >= SOLVED_AT) confetti();
        toast(`New high score: ${r.score}`);
      } else toast(`You scored ${r.score} with a ${r.visual}% match`);
      if (view.beltsEarned?.length) toast(`You earned the ${view.beltsEarned.join(", ")} belt`);
      if (r.warnings.length) toast(r.warnings[0] ?? "");
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
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

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

  const doneCount = TASKS.filter(([k]) => tasks[k]).length;
  const high = progress.data?.best ?? null;
  const last = result?.status === "scored" ? result : null;
  const lbTitle = c ? `${pad3(c.number)} ${c.title}${kataLabel ? ` · ${kataLabel}` : ""}` : "";

  if (challenge.isError) {
    return (
      <div className="app">
        <Header />
        <div className="empty-state">
          <h2>That challenge does not exist</h2>
          <p>It may have been renamed.</p>
          <Link to="/" className="btn primary">
            Browse challenges
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app app-locked" style={{ ["--editor-fs" as string]: `${fontSize}px` }}>
      <Header>
        <div className="crumbs">
          <button className="pick" type="button" aria-haspopup="true" aria-expanded={pop === "pick"} onClick={() => setPop(pop === "pick" ? null : "pick")}>
            {c ? `${pad3(c.number)} ${c.title}` : "Loading"}
            <ChevronDown size={12} strokeWidth={2.4} />
          </button>
        </div>
        <button className="start" type="button" aria-haspopup="true" aria-expanded={pop === "start"} onClick={() => setPop(pop === "start" ? null : "start")}>
          <span className="ring" style={{ ["--p" as string]: doneCount * 25 }} />
          <span className="t">Get started</span> <span>{doneCount}/4</span>
        </button>
        {pop === "pick" ? (
          <div className="pop" style={{ left: 150 }}>
            <div className="ph">
              <span className="lbl">Challenges</span>
            </div>
            <div style={{ maxHeight: 360, overflow: "auto" }}>
              {(list.data ?? []).filter((x) => x.kind === "challenge" || x.id === challengeId).map((x) => (
                <button
                  key={x.id}
                  className="tgt-item"
                  type="button"
                  aria-current={x.id === challengeId}
                  onClick={() => {
                    setPop(null);
                    void navigate({ to: "/c/$id", params: { id: x.id } });
                  }}
                >
                  <span className="th" style={{ background: x.background }} />
                  <span className="nm">
                    <b>{x.title}</b>
                    <span>
                      {pad3(x.number)} · {x.belt} belt
                    </span>
                  </span>
                  <span className="sc">{x.best ?? "–"}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {pop === "start" ? (
          <div className="pop" style={{ right: 16 }}>
            <div className="ph">
              <b>Get started</b>
              <span className="note">Four small steps to learn the dojo.</span>
            </div>
            {TASKS.map(([k, b, s]) => (
              <div key={k} className={`task${tasks[k] ? " done" : ""}`}>
                <i>✓</i>
                <div>
                  <b>{b}</b>
                  <span>{s}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Header>
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
                onChange(c.starter);
                editor.current?.setValue(c.starter);
                toast("Code reset to the starter");
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
            <button className="btn primary" type="button" onClick={() => void submit()} disabled={submitting} data-testid="submit">
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
                    () => toast("Code copied"),
                    () => toast("Couldn't copy here"),
                  );
                }}
              >
                <Copy size={15} />
                Copy
              </button>
            </span>
            <span className="meta">Autosaved</span>
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
                <button className="tog" type="button" aria-pressed={diff} title="Ctrl+Shift+D" onClick={() => setDiff(!diff)}>
                  <span className="box" />
                  Diff
                </button>
              </div>
            </div>
            <div className="pane-b">
              {c ? <OutputFrame code={code} challengeId={c.id} state={state} slide={slide} diff={diff} onSlide={() => task("slide")} /> : <div className="frame" />}
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
              </div>
              {result?.status === "missing-hook" ? <div className="banner warn">{result.message}</div> : null}
              <div className="stats">
                <div className={`tile${last ? "" : " empty"}${last && high !== null && last.score >= high ? " best" : ""}`} data-testid="last-score">
                  <span className="k">Last score</span>
                  <span className={`v${last ? " acc" : ""}`}>{last ? last.score : "–"}</span>
                  {last ? (
                    <>
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
                  {progress.data?.solved ? (
                    <button className="share" type="button" onClick={() => setDlg("solution")}>
                      See a solution
                    </button>
                  ) : null}
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
              <span className="meta">400 × 300</span>
            </div>
            <div className="pane-b">
              {c ? <TargetCanvas challengeId={c.id} title={c.title} forced={state} /> : <div className="frame" />}
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
              {c ? <p className="brief">{c.brief}</p> : null}
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
              <div className="sec">
                <span className="lbl">Outcome checks</span>
                <div className="checks" data-testid="checks">
                  {checks.map((ch) => {
                    const cls = ch.pending ? "pending" : ch.pass ? "pass" : "miss";
                    const hasHint = !ch.pending && !ch.pass && ch.hint;
                    return (
                      <div
                        key={ch.id}
                        className={`check ${cls}`}
                        {...(hasHint ? { role: "button", tabIndex: 0, title: "Show a hint" } : {})}
                        onClick={() => hasHint && setOpenHints((h) => ({ ...h, [ch.id]: !h[ch.id] }))}
                        onKeyDown={(e) => {
                          if (hasHint && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            setOpenHints((h) => ({ ...h, [ch.id]: !h[ch.id] }));
                          }
                        }}
                      >
                        <i>{ch.pending ? "" : ch.pass ? "✓" : "✕"}</i>
                        <span>{ch.label}</span>
                        <span className="r">{ch.pending ? "not run" : ch.pass ? "pass" : "hint"}</span>
                        {hasHint && openHints[ch.id] ? <span className="hint">{ch.hint}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
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
            ["Toggle diff", ["Ctrl", "Shift", "D"]],
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
      {dlg === "solution" ? <SolutionDialog challengeId={challengeId} onClose={() => setDlg(null)} /> : null}
    </div>
  );
}

function ColorChip({ hex }: { hex: string }) {
  const [copied, setCopied] = useState(false);
  const done = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
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
    setTimeout(() => setCopied(false), 1300);
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
        {q.data && q.data.length === 0 ? <div className="empty-note">No attempts yet. Submit once and it shows up here.</div> : null}
      </div>
      <span className="note">Load any attempt back into the editor.</span>
    </Dialog>
  );
}

function SolutionDialog({ challengeId, onClose }: { challengeId: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["solution", challengeId], queryFn: () => api<{ reference: string }>(`/challenges/${challengeId}/solutions`) });
  return (
    <Dialog open title="Our solution" onClose={onClose}>
      <span className="note">One way to build it. Yours may be just as good.</span>
      <pre style={{ margin: 0, maxHeight: 360, overflow: "auto", font: "400 12px/1.7 var(--font-mono)", background: "var(--bg)", padding: 12, borderRadius: 8, border: "1px solid var(--line)" }}>{q.data?.reference ?? "Loading"}</pre>
    </Dialog>
  );
}
