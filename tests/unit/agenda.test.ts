import { describe, expect, it } from "vitest";
import { helpCountLabel } from "@/components/features/agenda/format";

describe("PB-15 help count label", () => {
  it("uses the right verb for one person and for several", () => {
    expect(helpCountLabel(1)).toBe("1 needs help");
    expect(helpCountLabel(3)).toBe("3 need help");
  });
});
