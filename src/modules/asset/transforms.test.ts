import { describe, expect, it } from "vitest";
import {
  TransformParseError,
  canonicalizeResolved,
  parseTransforms,
  resolveFormat,
  resolveTransforms,
} from "./transforms";

describe("parseTransforms", () => {
  it("parses a Cloudinary-style token list", () => {
    expect(parseTransforms("w_400,h_300,c_fill,q_80,f_auto")).toEqual({
      width: 400,
      height: 300,
      crop: "fill",
      quality: 80,
      format: "auto",
    });
  });

  it("maps jpg to jpeg and q_auto", () => {
    expect(parseTransforms("w_200,f_jpg,q_auto")).toEqual({
      width: 200,
      format: "jpeg",
      quality: "auto",
    });
  });

  it("rejects unknown tokens", () => {
    expect(() => parseTransforms("w_200,x_1")).toThrow(TransformParseError);
  });

  it("rejects duplicate tokens", () => {
    expect(() => parseTransforms("w_200,w_400")).toThrow(/Duplicate/);
  });

  it("rejects out-of-range quality", () => {
    expect(() => parseTransforms("q_0")).toThrow(TransformParseError);
    expect(() => parseTransforms("q_101")).toThrow(TransformParseError);
  });

  it("rejects empty input", () => {
    expect(() => parseTransforms("")).toThrow(TransformParseError);
    expect(() => parseTransforms("w_400,")).toThrow(TransformParseError);
  });
});

describe("resolveTransforms", () => {
  it("resolves f_auto and q_auto from Accept", () => {
    const parsed = parseTransforms("w_800,f_auto,q_auto");
    const resolved = resolveTransforms(parsed, "image/avif,image/webp,*/*", "jpeg");
    expect(resolved).toEqual({
      width: 800,
      height: undefined,
      crop: undefined,
      quality: 80,
      format: "avif",
    });
    expect(canonicalizeResolved(resolved)).toBe("f_avif,q_80,w_800");
  });

  it("keeps png when f_auto has no modern Accept", () => {
    expect(resolveFormat("auto", "text/html", "png")).toBe("png");
    expect(resolveFormat("auto", "text/html", "jpeg")).toBe("jpeg");
    expect(resolveFormat("webp", "text/html", "jpeg")).toBe("webp");
  });
});
