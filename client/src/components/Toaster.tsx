import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/prefs";
import { onToast } from "@/lib/toast";

// Up to three toasts stacked at the bottom. New ones rise in, old ones fade
// out, and the rest glide to their new place (FLIP).

const SHOW_MS = 2600;
const OUT_MS = 150;
const MAX = 3;

interface Item {
  id: number;
  msg: string;
  out: boolean;
}

let seq = 0;

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const nodes = useRef(new Map<number, HTMLDivElement>());
  const tops = useRef(new Map<number, number>());

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const off = onToast((msg) => {
      const id = ++seq;
      setItems((xs) => [...xs.filter((x) => x.msg !== msg), { id, msg, out: false }].slice(-MAX));
      later(() => {
        setItems((xs) => xs.map((x) => (x.id === id ? { ...x, out: true } : x)));
        later(() => setItems((xs) => xs.filter((x) => x.id !== id)), OUT_MS);
      }, SHOW_MS);
    });
    return () => {
      off();
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  useLayoutEffect(() => {
    const animate = !reducedMotion();
    for (const [id, el] of nodes.current) {
      const top = el.getBoundingClientRect().top;
      const before = tops.current.get(id);
      if (animate && before !== undefined && before !== top) el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,.7,.2,1)" });
      tops.current.set(id, top);
    }
    for (const id of tops.current.keys()) if (!nodes.current.has(id)) tops.current.delete(id);
  }, [items]);

  return (
    <div className="d-toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          ref={(el) => {
            if (el) nodes.current.set(t.id, el);
            else nodes.current.delete(t.id);
          }}
          className={`d-tst${t.out ? " out" : ""}`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
