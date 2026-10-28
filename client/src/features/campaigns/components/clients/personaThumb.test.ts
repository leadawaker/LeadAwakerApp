import { test } from "node:test";
import assert from "node:assert/strict";
import { thumbInitial, thumbSources } from "./personaThumb";

test("the logo comes first, the website screenshot is the fallback", () => {
  assert.deepEqual(thumbSources({ logo: "a.webp", screenshot: "b.webp" }), [
    { kind: "logo", file: "a.webp" },
    { kind: "screenshot", file: "b.webp" },
  ]);
  assert.deepEqual(thumbSources({ logo: null, screenshot: "b.webp" }), [{ kind: "screenshot", file: "b.webp" }]);
  assert.deepEqual(thumbSources({ logo: "a.webp", screenshot: null }), [{ kind: "logo", file: "a.webp" }]);
});

test("a persona with neither (or an older server reply with neither field) has no image", () => {
  assert.deepEqual(thumbSources({ logo: null, screenshot: null }), []);
  assert.deepEqual(thumbSources({} as any), []);
  assert.deepEqual(thumbSources({ logo: "", screenshot: "" }), []);
});

test("the placeholder is the first letter or digit of the name, upper case", () => {
  assert.equal(thumbInitial("Autobedrijf Wassenaar"), "A");
  assert.equal(thumbInitial("  dr. Augusto"), "D");
  assert.equal(thumbInitial("3D Printing"), "3");
  assert.equal(thumbInitial("Élan"), "É");
  assert.equal(thumbInitial("   "), "");
  assert.equal(thumbInitial("..."), "");
});
