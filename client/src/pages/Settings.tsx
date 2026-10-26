import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { HandleSchema, type SettingsPatch, type SettingsView } from "@cssdojo/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { GitHubMark, GoogleMark, I, Page } from "@/components/Craft";
import { api, ApiError } from "@/lib/api";
import { shortDate, useSettings } from "@/lib/dojo";
import { signOut, useMe } from "@/lib/me";
import { getPref, setPref, type Pref } from "@/lib/prefs";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";
import { toast } from "@/lib/toast";

const NOTIFY: { key: keyof SettingsView["notify"]; title: string; sub: string }[] = [
  { key: "passed", title: "Someone passes you", sub: "On a board you are on. At most one per board per hour." },
  { key: "packOpen", title: "A Battle Pack opens", sub: "Only packs you asked to be told about." },
  { key: "badge", title: "Badge earned", sub: "Bell and a toast." },
  { key: "live", title: "Live line in the header", sub: "Big moments only: new #1, top 3 on a live pack, belts, pack openings." },
];

const BellIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0" />
  </svg>
);

const UserIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="d-card d-set">
      <h3 className="d-ch">
        {icon}
        <span>{title}</span>
      </h3>
      {children}
    </section>
  );
}

function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (on: boolean) => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="d-switch" disabled={disabled} onClick={() => onChange(!on)} />;
}

function Row({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="tx">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      {children}
    </div>
  );
}

function HandleField({ s }: { s: SettingsView }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(s.handle ?? "");
  const [error, setError] = useState<string | null>(null);
  const lockedUntil = s.handleChangeableAt && Date.parse(s.handleChangeableAt) > Date.now() ? s.handleChangeableAt : null;
  const save = useMutation({
    mutationFn: (handle: string) => api<SettingsView>("/settings", { method: "PATCH", json: { handle } satisfies SettingsPatch }),
    onSuccess: (next) => {
      qc.setQueryData(["settings"], next);
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast("Handle saved.");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save. Try again."),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = HandleSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Use 2 to 20 lowercase letters, digits and dashes");
      return;
    }
    setError(null);
    save.mutate(parsed.data);
  };
  const changed = value !== (s.handle ?? "");
  return (
    <form className="field" onSubmit={submit}>
      <span className="d-input">
        <span aria-hidden="true">@</span>
        <input
          aria-label="Handle"
          value={value}
          disabled={!!lockedUntil}
          maxLength={20}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value.toLowerCase());
            setError(null);
          }}
        />
        {changed ? (
          <button type="submit" className="d-btn pri" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        ) : null}
      </span>
      <span className={error ? "hint err" : "hint"} role={error ? "alert" : undefined}>
        {error ?? (lockedUntil ? `Shown on every board. You can change it again on ${shortDate(lockedUntil)}.` : "Shown on every board. You can change it once every 30 days.")}
      </span>
    </form>
  );
}

function Account({ s }: { s: SettingsView }) {
  return (
    <Section icon={UserIcon} title="Account">
      <div className="kv">
        <span className="k">Handle</span>
        <HandleField s={s} />
        <span className="k">Signed in with</span>
        <span className="v">
          {s.provider === "github" ? GitHubMark : s.provider === "google" ? GoogleMark : null}
          <span>{s.provider === "github" ? "GitHub" : s.provider === "google" ? "Google" : "Test login"}</span>
          {s.providerAccount ? <span className="d-mono" style={{ color: "var(--sub)" }}>{s.providerAccount}</span> : null}
        </span>
      </div>
    </Section>
  );
}

function Notifications({ s }: { s: SettingsView }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (notify: Partial<SettingsView["notify"]>) => api<SettingsView>("/settings", { method: "PATCH", json: { notify } satisfies SettingsPatch }),
    onMutate: (notify) => {
      const prev = qc.getQueryData<SettingsView | null>(["settings"]);
      if (prev) qc.setQueryData(["settings"], { ...prev, notify: { ...prev.notify, ...notify } });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["settings"], ctx.prev);
      toast("Could not save that. Try again.");
    },
    onSuccess: (next) => {
      qc.setQueryData(["settings"], next);
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
  return (
    <Section icon={BellIcon} title="Notifications">
      {NOTIFY.map((n) => (
        <Row key={n.key} title={n.title} sub={n.sub}>
          <Switch on={s.notify[n.key]} label={n.title} onChange={(on) => save.mutate({ [n.key]: on })} />
        </Row>
      ))}
    </Section>
  );
}

function Display() {
  const [theme, setTheme] = useState<Theme>(currentTheme());
  const [prefs, setPrefs] = useState<Record<Pref, boolean>>({ motion: getPref("motion"), ligatures: getPref("ligatures"), sound: getPref("sound") });
  const flip = (p: Pref, on: boolean) => {
    setPref(p, on);
    setPrefs((x) => ({ ...x, [p]: on }));
  };
  return (
    <Section icon={I.grid} title="Display">
      <Row title="Theme" sub="Dark is the dojo at night. Light is the same room by day.">
        <span className="d-seg" role="radiogroup" aria-label="Theme">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => {
                applyTheme(t);
                setTheme(t);
              }}
            >
              {t === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </span>
      </Row>
      <Row title="Reduce motion" sub="Your system setting always applies. On also stops flips and slides here.">
        <Switch on={prefs.motion} label="Reduce motion" onChange={(on) => flip("motion", on)} />
      </Row>
      <Row title="Sound" sub="Two wooden clacks when you solve at 90 or more.">
        <Switch on={prefs.sound} label="Sound" onChange={(on) => flip("sound", on)} />
      </Row>
      <Row title="Editor font ligatures" sub="Join pairs like => and != in the editor.">
        <Switch on={prefs.ligatures} label="Editor font ligatures" onChange={(on) => flip("ligatures", on)} />
      </Row>
    </Section>
  );
}

export function Settings() {
  const me = useMe();
  const signedIn = !!me.data?.user;
  const settings = useSettings(signedIn);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const out = async () => {
    try {
      await signOut();
      await qc.invalidateQueries();
      await navigate({ to: "/" });
    } catch {
      toast("Could not sign out. Try again.");
    }
  };
  return (
    <Page kicker="Settings" title="Settings">
      <div className="d-setcol">
        {signedIn && settings.data ? (
          <>
            <Account s={settings.data} />
            <Notifications s={settings.data} />
          </>
        ) : !signedIn && !me.isLoading ? (
          <section className="d-card d-set">
            <p className="note" style={{ margin: 0 }}>
              <Link to="/signin" className="d-lnk">
                Sign in
              </Link>{" "}
              to pick a handle and choose what the bell tells you. Display choices below work for guests too.
            </p>
          </section>
        ) : settings.isError ? (
          <section className="d-card d-set">
            <p className="note" style={{ margin: 0 }}>Could not load your settings. Refresh to try again.</p>
          </section>
        ) : null}
        <Display />
        {signedIn ? (
          <div>
            <button type="button" className="d-btn sec" onClick={() => void out()}>
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </Page>
  );
}
