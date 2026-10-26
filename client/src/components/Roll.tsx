// Digits that roll to their new value (score, countdowns). Each digit is a
// strip of 0 to 9 moved with transform only; other characters stay still.

export function Roll({ text, ms = 280, className }: { text: string; ms?: number; className?: string }) {
  return (
    <span className={`d-rollnum${className ? ` ${className}` : ""}`} aria-label={text}>
      {text.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="d-roll" aria-hidden="true">
            <span style={{ transform: `translateY(-${Number(ch) * 10}%)`, transitionDuration: `${ms}ms` }}>
              {"0123456789".split("").map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
