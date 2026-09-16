// Minimal figlet renderer for scripts/ascii.mjs: .flf parsing, horizontal full-width / kerning /
// smushing per the font's own layout (figlet.c rules 1-6 + universal), one line, left to right.
// Fonts live in scripts/fonts/ (Alpha by Lennert Stock; Ticks Slant by Victor Parada), unmodified.
import { readFileSync } from "node:fs";

export function loadFont(file) {
  const text = readFileSync(file, "utf8").replace(/\r/g, "");
  const lines = text.split("\n");
  const h = lines[0].split(/\s+/);
  const hardblank = h[0].slice(5, 6);
  const height = +h[1], oldLayout = +h[4], commentLines = +h[5];
  const fullLayout = h.length > 7 ? +h[7] : null;
  let mode;                                          // { smush, kern, rules }
  if (fullLayout !== null) mode = { smush: !!(fullLayout & 128), kern: !!(fullLayout & 64), rules: fullLayout & 63 };
  else if (oldLayout === -1) mode = { smush: false, kern: false, rules: 0 };
  else if (oldLayout === 0) mode = { smush: false, kern: true, rules: 0 };
  else mode = { smush: true, kern: true, rules: oldLayout & 63 };
  const glyphs = {};
  let i = 1 + commentLines;
  for (let code = 32; code <= 126; code++) {
    const rows = [];
    for (let r = 0; r < height; r++) {
      let s = lines[i++] ?? "";
      const end = s[s.length - 1];
      while (s.length && s[s.length - 1] === end) s = s.slice(0, -1);
      rows.push(s);
    }
    glyphs[String.fromCharCode(code)] = rows;
  }
  return { hardblank, height, mode, glyphs };
}

function smushem(ch1, ch2, font) {
  const { hardblank: hb, mode } = font;
  if (ch1 === " ") return ch2;
  if (ch2 === " ") return ch1;
  if (!mode.smush) return null;
  if ((mode.rules & 63) === 0) {                     // universal
    if (ch1 === hb) return ch2;
    if (ch2 === hb) return ch1;
    return ch2;
  }
  if (mode.rules & 32 && ch1 === hb && ch2 === hb) return ch1;
  if (ch1 === hb || ch2 === hb) return null;
  if (mode.rules & 1 && ch1 === ch2) return ch1;
  if (mode.rules & 2) {
    if (ch1 === "_" && "|/\\[]{}()<>".includes(ch2)) return ch2;
    if (ch2 === "_" && "|/\\[]{}()<>".includes(ch1)) return ch1;
  }
  if (mode.rules & 4) {
    const cls = ["|", "/\\", "[]", "{}", "()", "<>"];
    const c1 = cls.findIndex(c => c.includes(ch1)), c2 = cls.findIndex(c => c.includes(ch2));
    if (c1 >= 0 && c2 >= 0 && c1 !== c2) return c1 > c2 ? ch1 : ch2;
  }
  if (mode.rules & 8) {
    const pairs = ["[]", "][", "{}", "}{", "()", ")("];
    if (pairs.includes(ch1 + ch2)) return "|";
  }
  if (mode.rules & 16) {
    if (ch1 + ch2 === "/\\") return "|";
    if (ch1 + ch2 === "\\/") return "Y";
    if (ch1 + ch2 === "><") return "X";
  }
  return null;
}

export function render(font, text) {
  let out = Array.from({ length: font.height }, () => "");
  for (const ch of text) {
    const g = font.glyphs[ch] ?? font.glyphs["?"];
    const width = Math.max(...g.map(r => r.length));
    const glyph = g.map(r => r.padEnd(width));
    let amt = 0;
    if (font.mode.kern || font.mode.smush) {
      amt = width;
      for (let r = 0; r < font.height; r++) {
        const line = out[r], row = glyph[r];
        let linebd = line.length - 1; while (linebd >= 0 && line[linebd] === " ") linebd--;
        let charbd = 0; while (charbd < row.length && row[charbd] === " ") charbd++;
        let a = charbd + line.length - 1 - linebd;
        const ch1 = linebd >= 0 ? line[linebd] : null, ch2 = charbd < row.length ? row[charbd] : null;
        if (ch1 === null) a++;
        else if (ch2 !== null && smushem(ch1, ch2, font) !== null) a++;
        amt = Math.min(amt, a);
      }
    }
    out = out.map((line, r) => {
      const row = glyph[r];
      const keep = Math.max(0, line.length - amt);
      let merged = line.slice(0, keep);
      const overlap = Math.min(amt, line.length);
      for (let k = 0; k < amt; k++) {
        const c1 = k < amt - overlap ? " " : line[keep + (k - (amt - overlap))];
        const c2 = row[k];
        merged += (smushem(c1 ?? " ", c2, font) ?? c2);
      }
      return merged + row.slice(amt);
    });
  }
  return out.map(l => l.replaceAll(font.hardblank, " ").replace(/\s+$/, ""));
}
