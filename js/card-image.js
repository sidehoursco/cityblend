/* Renders the card to a real 1080x1920 PNG.
 *
 * Hand-drawn on canvas rather than rasterising the DOM. Rasterising libraries
 * (html2canvas and friends) have real font-fidelity problems, and this project
 * has no build step or dependencies. The cost of hand-drawing is that layout
 * lives in two places — here and in css/style.css.
 *
 * KEEP IN SYNC: every constant below is expressed in `u` (one hundredth of the
 * card width), which is exactly what 1cqw means in the stylesheet. So a value
 * of `4.7 * u` here is `4.7cqw` there. If you change one, change the other.
 */

const CARD_W = 1080;
const CARD_H = 1920;

/* How city names are cased on the card. People type them inconsistently
 * ("MOSCOW", "moscow", "Moscow"), so this normalises rather than trusting the
 * input either way. Flip this single constant to change both the on-page card
 * and the exported PNG — they share formatCity() so they cannot drift.
 *   'lower' — all lowercase, understated
 *   'title' — Title Case, which is how real transit maps set station names
 */
const CITY_CASE = 'title';

function formatCity(name, mode) {
  const lowered = String(name).toLocaleLowerCase();
  if ((mode || CITY_CASE) !== 'title') return lowered;
  // capitalise after a start, space, hyphen or apostrophe: "san sebastián" ->
  // "San Sebastián", "ho chi minh city" -> "Ho Chi Minh City"
  return lowered.replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase());
}

const FONT_SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';

const INK = '#0D1014';
const TEXT = '#F2F4F0';
const TEXT_SOFT = '#E4E8E3';
/* One muted grey, not two. The route's ORIGIN / n YRS labels used to be a
   slightly darker #6E7A83, which measured 4.34:1 on the card's near-black at
   2.6cqw — a real WCAG 1.4.3 AA failure for normal-size text, and the smallest
   type on the card at that. The two greys were a step apart visually but sat
   on opposite sides of the 4.5:1 line, so they're merged rather than nudged:
   #78848C is 4.97:1 and is already what the handle and footer use. */
const TEXT_MUTED = '#78848C';

/* The card's palette, resolved per render so the exported PNG matches whatever
 * the preview is showing. The two must agree exactly: the preview is what
 * someone decides to share, and the PNG is what actually gets shared, so a
 * theme that existed in only one of them would be a lie about the product.
 *
 * "bright" makes the card the person's own colour. That colour already existed
 * — the route hashes to one of nine — but it was spent on a 2px line, so two
 * friends' cards looked identical from any distance. Dark ink on all nine
 * clears 4.5:1 comfortably, which is why the flip is a palette swap rather
 * than a redesign. */
function paletteFor(data) {
  if (data && data.theme === 'bright') {
    return {
      bg: data.color,
      text: '#14161A',
      soft: '#14161A',
      // 82%: at 62% this measured 3.21:1 on the lilac card, an AA failure on
      // the smallest type. Worst case across all nine colours is now 4.73:1.
      muted: 'rgba(20, 22, 26, 0.82)',
      accent: '#14161A',
      // On a bright card the route dot has to punch a hole in the line the way
      // it does on the dark one — so the "hole" colour is the card, not ink.
      hole: data.color,
    };
  }
  return { bg: INK, text: TEXT, soft: TEXT_SOFT, muted: TEXT_MUTED, accent: data.color, hole: INK };
}

/* Breaks a single word that is itself wider than the line. Needed because the
 * identity is one invented word with no spaces in it — "the moskvetersburger"
 * has nowhere to wrap, so a whitespace-only splitter drew it straight past the
 * card edge. Mirrors overflow-wrap:anywhere on .c-identity in the stylesheet. */
function breakLongWord(ctx, word, maxWidth) {
  if (ctx.measureText(word).width <= maxWidth) return [word];
  const pieces = [];
  let current = '';
  for (const char of word) {
    if (current && ctx.measureText(current + char).width > maxWidth) {
      pieces.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/* The identity is a single invented word, so when it's wider than the card it
 * has to break mid-word, which strands a letter or two on their own line ("the
 * leonescondens" / "e"). Shrinking the type instead keeps it as one readable
 * word — worth it because that word is the punchline and the largest thing on
 * the card. Returns a multiplier <= 1 to apply to the identity font size.
 * Measured as a ratio so it holds at any rendered size: availableRatio is the
 * usable width expressed in multiples of the base font size. */
function identityFitScale(ctx, identity, availableRatio) {
  const probeSize = 100;
  const previous = ctx.font;
  ctx.font = `700 ${probeSize}px ${FONT_SANS}`;
  const widest = String(identity)
    .split(/\s+/)
    .filter(Boolean)
    .reduce((max, word) => Math.max(max, ctx.measureText(word).width), 0);
  ctx.font = previous;
  if (!widest) return 1;
  // floor at 0.7: past that the identity stops out-ranking the line below it,
  // and a mid-word break is the lesser evil.
  return Math.max(0.7, Math.min(1, (availableRatio * probeSize) / widest));
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = '';
      const pieces = breakLongWord(ctx, word, maxWidth);
      // all but the last piece are full lines; the tail keeps accumulating
      pieces.slice(0, -1).forEach((piece) => lines.push(piece));
      current = pieces[pieces.length - 1];
    } else {
      current = candidate;
    }
  });
  if (current) {
    const pieces = breakLongWord(ctx, current, maxWidth);
    pieces.forEach((piece) => lines.push(piece));
  }
  return lines;
}

function metaFor(index, lastIndex, years) {
  let label = '';
  if (index === lastIndex) label = 'now';
  else if (index === 0) label = 'origin';
  const yrs = years && years[index];
  if (yrs) label = label ? `${yrs} yrs · ${label}` : `${yrs} yrs`;
  return label.toUpperCase();
}

/* Sizes/gaps below `over` (identity, line, route). Original formulas only
 * compressed for stop COUNT — a 2-line identity or a wrapped line-of-text
 * eats real height that nothing accounted for, and the footer was drawn at
 * a fixed y regardless, so long content could overlap it (found via real
 * testing: identical stop counts overlapped or not purely based on whether
 * the identity happened to wrap to 1 or 2 lines). Clamped with Math.max so
 * a large `over` (from the fit loop below) can't push a gap negative. */
function metricsFor(over, u) {
  return {
    over,
    topGap: Math.max(2, 6.5 - over * 0.5) * u,
    identSize: Math.max(6, 11.5 - over * 0.28) * u,
    identGap: Math.max(1.5, 5 - over * 0.3) * u,
    lineSize: Math.max(3, 4.7 - over * 0.1) * u,
    lineGap: Math.max(2, 7 - over * 0.8) * u,
    citySize: Math.max(3, 4.5 - over * 0.12) * u,
    rowGap: Math.max(1.2, 5 - over * 0.45) * u,
  };
}

/* data: { handle, identity, line, path, years, color } */
function drawCard(ctx, data) {
  // Resolved once per render so every draw call below agrees with it.
  const pal = paletteFor(data);
  const u = CARD_W / 100;
  const n = data.path.length;
  const baseOver = Math.max(0, n - 2);

  const padX = 8 * u;
  const padTop = 25.8 * u;
  const contentBottom = CARD_H - 36.5 * u;
  const innerW = CARD_W - padX * 2;
  // The bold domain is the tallest thing on the footer line, so it — not the
  // muted prefix — is what the fit loop has to reserve room for.
  const footerSize = 3.4 * u;
  const minGapAboveFooter = 3 * u;

  ctx.textBaseline = 'alphabetic';

  // Find the smallest extra compression (beyond stop-count alone) that
  // makes the identity + line + route actually fit above the footer, given
  // their real wrapped line counts at each candidate size.
  let over = baseOver;
  let m, identSize, identLines, lineRows, routeBottomY;
  for (let step = 0; step <= 40; step += 1) {
    m = metricsFor(over, u);
    identSize = m.identSize * identityFitScale(ctx, data.identity, innerW / m.identSize);
    ctx.font = `700 ${identSize}px ${FONT_SANS}`;
    identLines = wrapLines(ctx, data.identity, innerW);
    ctx.font = `500 ${m.lineSize}px ${FONT_SANS}`;
    // mirrors max-width: 27ch in the stylesheet, at this size's own char width
    const lineMaxW = Math.min(innerW, ctx.measureText('0').width * 27);
    lineRows = wrapLines(ctx, data.line, lineMaxW);
    const rowH = m.citySize * 1.15;
    let y = padTop + (17 * u) + m.topGap;
    y += identLines.length * identSize * 0.92 + m.identGap;
    y += lineRows.length * m.lineSize * 1.3 + m.lineGap;
    routeBottomY = y + (n - 1) * (rowH + m.rowGap) + rowH;
    if (routeBottomY + minGapAboveFooter <= contentBottom - footerSize * 0.8) break;
    over += 1;
  }

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  let y = padTop;

  /* ---- wordmark + handle + stop badge ---- */
  const badgeD = 17 * u;
  const handleSize = 3.2 * u;
  const brandSize = 3.6 * u;

  // Mirrors .c-id: 1.4u padding-top, then the wordmark box (3.6u, line-height
  // 1), then a 1.2u gap, then the handle. The pair is ~9.4u tall against the
  // badge's 17u, so it costs no height — the row was already this tall.
  ctx.textAlign = 'left';
  ctx.font = `700 ${brandSize}px ${FONT_SANS}`;
  ctx.fillStyle = pal.text;
  ctx.fillText('cityblend', padX, y + 1.4 * u + brandSize * 0.8);

  ctx.font = `${handleSize}px ${FONT_MONO}`;
  ctx.fillStyle = pal.muted;
  ctx.fillText(data.handle, padX, y + 1.4 * u + brandSize + 1.2 * u + handleSize * 0.85);

  const badgeCX = CARD_W - padX - badgeD / 2;
  const badgeCY = y + badgeD / 2;
  ctx.beginPath();
  ctx.arc(badgeCX, badgeCY, badgeD / 2 - 0.4 * u, 0, Math.PI * 2);
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 0.8 * u;
  ctx.stroke();

  // Mirrors the DOM badge, which is a centred flex column: number (8.4u,
  // line-height 1) + 0.5u gap + label (2.2u) = 11.1u tall, so the pair is
  // centred by starting 5.55u above the circle's middle.
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.accent;
  ctx.font = `700 ${8.4 * u}px ${FONT_SANS}`;
  ctx.fillText(String(n), badgeCX, badgeCY + 1.2 * u);
  ctx.font = `${2.2 * u}px ${FONT_MONO}`;
  // "1 STOPS" on a card someone is about to post reads as unfinished. Reachable
  // now that a path whose birth and current city match collapses to one stop.
  ctx.fillText(n === 1 ? 'STOP' : 'STOPS', badgeCX, badgeCY + 5.1 * u);
  ctx.textAlign = 'left';

  y += badgeD + m.topGap;

  /* ---- identity ---- */
  ctx.font = `700 ${identSize}px ${FONT_SANS}`;
  ctx.fillStyle = pal.text;
  identLines.forEach((line, i) => {
    ctx.fillText(line, padX, y + identSize * 0.8 + i * identSize * 0.92);
  });
  y += identLines.length * identSize * 0.92 + m.identGap;

  /* ---- the dry line ---- */
  ctx.font = `500 ${m.lineSize}px ${FONT_SANS}`;
  ctx.fillStyle = pal.soft;
  lineRows.forEach((row, i) => {
    ctx.fillText(row, padX, y + m.lineSize * 0.8 + i * m.lineSize * 1.3);
  });
  y += lineRows.length * m.lineSize * 1.3 + m.lineGap;

  /* ---- the route ---- */
  const citySize = m.citySize;
  const metaSize = 2.6 * u;
  const rowH = citySize * 1.15;
  const rowGap = m.rowGap;
  const dotX = padX + 2.65 * u;
  const textX = padX + 7.6 * u;

  const rowTops = data.path.map((_, i) => y + i * (rowH + rowGap));
  const dotCY = (i) => rowTops[i] + rowH * 0.55;

  // connector first, so dots sit on top of it
  if (n > 1) {
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 0.72 * u;
    ctx.beginPath();
    ctx.moveTo(dotX, dotCY(0));
    ctx.lineTo(dotX, dotCY(n - 1));
    ctx.stroke();
  }

  data.path.forEach((cityName, i) => {
    const isNow = i === n - 1;
    const cy = dotCY(i);

    if (isNow) {
      ctx.beginPath();
      ctx.arc(dotX, cy, 2.2 * u, 0, Math.PI * 2);
      ctx.fillStyle = pal.accent;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(dotX, cy, 1.25 * u, 0, Math.PI * 2);
      ctx.fillStyle = pal.hole;
      ctx.fill();
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 0.72 * u;
      ctx.stroke();
    }

    const baseline = rowTops[i] + citySize * 0.85;
    ctx.font = `${isNow ? 700 : 500} ${citySize}px ${FONT_SANS}`;
    ctx.fillStyle = pal.text;
    const shown = formatCity(cityName, data.cityCase);
    ctx.fillText(shown, textX, baseline);
    const cityW = ctx.measureText(shown).width;

    const meta = metaFor(i, n - 1, data.years);
    if (meta) {
      ctx.font = `${metaSize}px ${FONT_MONO}`;
      ctx.fillStyle = isNow ? pal.accent : pal.muted;
      ctx.fillText(meta, textX + cityW + 2.2 * u, baseline);
    }
  });

  /* ---- footer, baked into the image ----
   * Two weights sharing one baseline, mirroring .c-foot / .c-foot b. This is
   * the only route from "saw someone's card" to "made my own", so the address
   * is drawn to survive being viewed at story scale: 16.4:1 and bold, against
   * 5.0:1 and regular for the invitation in front of it. */
  const footPrefix = 'and you? → ';
  ctx.fillStyle = pal.muted;
  ctx.font = `${3 * u}px ${FONT_MONO}`;
  ctx.fillText(footPrefix, padX, contentBottom);
  const prefixW = ctx.measureText(footPrefix).width;
  ctx.fillStyle = pal.text;
  ctx.font = `700 ${3.4 * u}px ${FONT_MONO}`;
  ctx.fillText('cityblend.app', padX + prefixW, contentBottom);
}

/* Returns a Promise<Blob> of the PNG. */
async function renderCardPNG(data) {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (_) { /* non-fatal */ }
  }
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  drawCard(ctx, data);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas produced no image'));
    }, 'image/png');
  });
}
