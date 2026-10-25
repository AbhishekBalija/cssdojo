import { describe, expect, it } from "vitest";
import { formatCode, formatDuration } from "./format";

describe("formatCode", () => {
  it("puts one declaration per line", () => {
    expect(formatCode("<style>a{color:red;margin:0}</style>")).toBe("<style>\n  a {\n    color:red;\n    margin:0;\n  }\n</style>");
  });
});

describe("formatDuration", () => {
  it("reads naturally", () => {
    expect(formatDuration(4000)).toBe("4s");
    expect(formatDuration(252_000)).toBe("4m 12s");
  });
});
