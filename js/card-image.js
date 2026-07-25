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

const FONT_SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';

const INK = '#0D1014';
const TEXT = '#F2F4F0';
const TEXT_SOFT = '#E4E8E3';
const TEXT_MUTED = '#78848C';
const META_MUTED = '#6E7A83';

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
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

/* data: { handle, identity, line, path, years, color } */
function drawCard(ctx, data) {
  const u = CARD_W / 100;
  const n = data.path.length;
  const over = Math.max(0, n - 2);

  const padX = 8 * u;
  const padTop = 25.8 * u;
  const contentBottom = CARD_H - 36.5 * u;
  const innerW = CARD_W - padX * 2;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = 'alphabetic';

  let y = padTop;

  /* ---- handle + stop badge ---- */
  const badgeD = 17 * u;
  const handleSize = 3.2 * u;

  ctx.font = `${handleSize}px ${FONT_MONO}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.textAlign = 'left';
  ctx.fillText(data.handle, padX, y + 1.4 * u + handleSize * 0.85);

  const badgeCX = CARD_W - padX - badgeD / 2;
  const badgeCY = y + badgeD / 2;
  ctx.beginPath();
  ctx.arc(badgeCX, badgeCY, badgeD / 2 - 0.4 * u, 0, Math.PI * 2);
  ctx.strokeStyle = data.color;
  ctx.lineWidth = 0.8 * u;
  ctx.stroke();

  // Mirrors the DOM badge, which is a centred flex column: number (8.4u,
  // line-height 1) + 0.5u gap + label (2.2u) = 11.1u tall, so the pair is
  // centred by starting 5.55u above the circle's middle.
  ctx.textAlign = 'center';
  ctx.fillStyle = data.color;
  ctx.font = `700 ${8.4 * u}px ${FONT_SANS}`;
  ctx.fillText(String(n), badgeCX, badgeCY + 1.2 * u);
  ctx.font = `${2.2 * u}px ${FONT_MONO}`;
  ctx.fillText('STOPS', badgeCX, badgeCY + 5.1 * u);
  ctx.textAlign = 'left';

  y += badgeD + (6.5 - over * 0.5) * u;

  /* ---- identity ---- */
  const identSize = (11.5 - over * 0.28) * u;
  ctx.font = `700 ${identSize}px ${FONT_SANS}`;
  ctx.fillStyle = TEXT;
  const identLines = wrapLines(ctx, data.identity, innerW);
  identLines.forEach((line, i) => {
    ctx.fillText(line, padX, y + identSize * 0.8 + i * identSize * 0.92);
  });
  y += identLines.length * identSize * 0.92 + (5 - over * 0.3) * u;

  /* ---- the dry line ---- */
  const lineSize = (4.7 - over * 0.1) * u;
  ctx.font = `500 ${lineSize}px ${FONT_SANS}`;
  ctx.fillStyle = TEXT_SOFT;
  // mirrors max-width: 27ch in the stylesheet
  const chW = ctx.measureText('0').width;
  const lineMaxW = Math.min(innerW, chW * 27);
  const lineRows = wrapLines(ctx, data.line, lineMaxW);
  lineRows.forEach((row, i) => {
    ctx.fillText(row, padX, y + lineSize * 0.8 + i * lineSize * 1.3);
  });
  y += lineRows.length * lineSize * 1.3 + (7 - over * 0.8) * u;

  /* ---- the route ---- */
  const citySize = (4.5 - over * 0.12) * u;
  const metaSize = 2.6 * u;
  const rowH = citySize * 1.15;
  const rowGap = (5 - over * 0.45) * u;
  const dotX = padX + 2.65 * u;
  const textX = padX + 7.6 * u;

  const rowTops = data.path.map((_, i) => y + i * (rowH + rowGap));
  const dotCY = (i) => rowTops[i] + rowH * 0.55;

  // connector first, so dots sit on top of it
  if (n > 1) {
    ctx.strokeStyle = data.color;
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
      ctx.fillStyle = data.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(dotX, cy, 1.25 * u, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.strokeStyle = data.color;
      ctx.lineWidth = 0.72 * u;
      ctx.stroke();
    }

    const baseline = rowTops[i] + citySize * 0.85;
    ctx.font = `${isNow ? 700 : 500} ${citySize}px ${FONT_SANS}`;
    ctx.fillStyle = TEXT;
    // matches text-transform: lowercase on .route .city
    const shown = cityName.toLocaleLowerCase();
    ctx.fillText(shown, textX, baseline);
    const cityW = ctx.measureText(shown).width;

    const meta = metaFor(i, n - 1, data.years);
    if (meta) {
      ctx.font = `${metaSize}px ${FONT_MONO}`;
      ctx.fillStyle = isNow ? data.color : META_MUTED;
      ctx.fillText(meta, textX + cityW + 2.2 * u, baseline);
    }
  });

  /* ---- footer, baked into the image ---- */
  ctx.font = `${3 * u}px ${FONT_MONO}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText('and you? → cityblend.app', padX, contentBottom);
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
