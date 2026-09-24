// client/public/social-demo/keyword.js
export function normalize(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

// Whole word, anywhere in the comment: "roof please" opens the DM, "roofing" does not.
export function matchesKeyword(comment, keyword) {
  const kw = normalize(keyword).replace(/[^A-Z]/g, "");
  if (!kw) return false;
  const words = normalize(comment).split(/[^A-Z]+/).filter(Boolean);
  return words.includes(kw);
}
