import { describe, expect, it } from "vitest";
import { detectSource, hostOf } from "@/components/features/resources/source";

describe("PB-07 detectSource", () => {
  it("recognizes the places students keep files", () => {
    expect(detectSource("https://drive.google.com/file/d/abc/view")).toBe("Google Drive");
    expect(detectSource("https://docs.google.com/document/d/abc")).toBe("Google Drive");
    expect(detectSource("https://onedrive.live.com/?id=1")).toBe("OneDrive");
    expect(detectSource("https://1drv.ms/w/s!abc")).toBe("OneDrive");
    expect(detectSource("https://uta-my.sharepoint.com/:w:/g/personal/x")).toBe("OneDrive");
    expect(detectSource("https://uta.instructure.com/courses/1/files/2")).toBe("Canvas");
    expect(detectSource("https://canvas.example.edu/courses/1")).toBe("Canvas");
    expect(detectSource("https://github.com/tambevarad/studycrew")).toBe("GitHub");
    expect(detectSource("https://example.edu/syllabus")).toBe("Web");
  });

  it("doesn't match look-alike domains or bad input", () => {
    expect(detectSource("https://notgithub.com/x")).toBe("Web");
    expect(detectSource("https://canvas.example.com/x")).toBe("Web");
    expect(detectSource("https://drive.google.com.evil.test/x")).toBe("Web");
    expect(detectSource(null)).toBeNull();
    expect(detectSource("not a url")).toBeNull();
  });

  it("shows a short host for generic links", () => {
    expect(hostOf("https://www.example.edu/a/b")).toBe("example.edu");
    expect(hostOf("nope")).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
});
