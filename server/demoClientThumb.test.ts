import { test } from "node:test";
import assert from "node:assert/strict";
import { clientThumbFiles } from "./demoClientThumb";

const FILE = "61474f7ada9bf371.webp";
const OTHER = "e6e3fc698a152b80.webp";

test("a stored logo and screenshot are both passed on as file names", () => {
  assert.deepEqual(clientThumbFiles({ logoPath: FILE, logoEnabled: true, screenshotPath: OTHER }), { logo: FILE, screenshot: OTHER });
});

test("a logo switched off is not offered, the screenshot still is", () => {
  assert.deepEqual(clientThumbFiles({ logoPath: FILE, logoEnabled: false, screenshotPath: OTHER }), { logo: null, screenshot: OTHER });
});

test("a missing switch counts as on, as the demo pages read it", () => {
  assert.equal(clientThumbFiles({ logoPath: FILE, logoEnabled: null, screenshotPath: null }).logo, FILE);
  assert.equal(clientThumbFiles({ logoPath: FILE, screenshotPath: null }).logo, FILE);
});

test("empty, missing or odd file names become null: the serve route would 404 them", () => {
  assert.deepEqual(clientThumbFiles({ logoPath: "", logoEnabled: true, screenshotPath: "" }), { logo: null, screenshot: null });
  assert.deepEqual(clientThumbFiles({ logoPath: null, screenshotPath: undefined }), { logo: null, screenshot: null });
  assert.deepEqual(clientThumbFiles({ logoPath: "../etc/passwd", screenshotPath: "x.png" }), { logo: null, screenshot: null });
});
