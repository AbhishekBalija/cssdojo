import { describe, expect, it } from "vitest";
import { sanitizeCode } from "./sanitize";

describe("sanitizeCode", () => {
  it("keeps plain HTML and CSS", () => {
    const code = `<button class="btn">Go</button><style>.btn{color:red}</style>`;
    expect(sanitizeCode(code)).toEqual({ code, removed: [] });
  });
  it("removes scripts, handlers, images and url()", () => {
    const r = sanitizeCode(`<script>alert(1)</script><b onclick="x()">a</b><img src=x><style>a{background:url(http://x)}</style>`);
    expect(r.code).toBe(`<b>a</b><style>a{background:}</style>`);
    expect(r.removed.length).toBeGreaterThanOrEqual(4);
  });
  it("removes @import and @font-face", () => {
    const r = sanitizeCode(`<style>@import "x.css";@font-face{font-family:a;src:local(b)}p{}</style>`);
    expect(r.code).toBe(`<style>p{}</style>`);
  });
});
