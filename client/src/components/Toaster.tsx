import { useEffect, useState } from "react";
import { onToast } from "@/lib/toast";

export function Toaster() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onToast((m) => {
      setMsg(m);
      setOn(true);
      clearTimeout(t);
      t = setTimeout(() => setOn(false), 2600);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  return (
    <div className={`toast${on ? " on" : ""}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
