/**
 * Génère les icônes de l'app (icon, android-icon-foreground/background/monochrome, favicon) :
 * une Poké Ball stylisée aux couleurs du thème (src/ui/theme.ts), avec un cœur doré façon « loot ».
 * Pas de dépendance Python ici (contrairement aux autres scripts tools/*.py) : Node + sharp suffisent
 * pour rasteriser du SVG en PNG. Lancer avec `node tools/make_icon.js`.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'assets');
const SIZE = 1024;
const CX = SIZE / 2, CY = SIZE / 2;
const R = 330; // rayon de la Ball, ~64% du canevas : reste dans la zone sûre du masque adaptatif Android

// Couleurs du thème (src/ui/theme.ts)
const RED = '#e74c3c';
const RED_DARK = '#b8362a';
const NAVY = '#1b1f2a';
const NAVY_LIGHT = '#2f3648';
const GOLD = '#f1c40f';
const GOLD_DARK = '#c89c0e';
const LINE = '#0d0f16';

function ball({ transparent = false } = {}) {
  const bandH = R * 0.16;
  const ringOuter = R * 0.34;
  const ringMid = R * 0.24;
  const core = R * 0.14;
  const sparkle = (x, y, s, fill) => `
    <path d="M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28}
             L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z" fill="${fill}" />`;

  const bg = transparent ? '' : `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${NAVY}" />`;

  return `
    ${bg}
    <defs>
      <clipPath id="top"><rect x="${CX - R - 10}" y="${CY - R - 10}" width="${(R + 10) * 2}" height="${R + 10}" /></clipPath>
      <clipPath id="bottom"><rect x="${CX - R - 10}" y="${CY}" width="${(R + 10) * 2}" height="${R + 10}" /></clipPath>
      <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${RED}" />
        <stop offset="1" stop-color="${RED_DARK}" />
      </linearGradient>
      <linearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="1" stop-color="#e3e6ec" />
      </linearGradient>
      <radialGradient id="coreGrad" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#fff8dc" />
        <stop offset="0.5" stop-color="${GOLD}" />
        <stop offset="1" stop-color="${GOLD_DARK}" />
      </radialGradient>
    </defs>

    <circle cx="${CX}" cy="${CY}" r="${R + 14}" fill="${LINE}" />
    <g clip-path="url(#top)"><circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#topGrad)" /></g>
    <g clip-path="url(#bottom)"><circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#bottomGrad)" /></g>
    <rect x="${CX - R}" y="${CY - bandH / 2}" width="${R * 2}" height="${bandH}" fill="${LINE}" />

    <circle cx="${CX}" cy="${CY}" r="${ringOuter}" fill="${LINE}" />
    <circle cx="${CX}" cy="${CY}" r="${ringMid}" fill="#fff" />
    <circle cx="${CX}" cy="${CY}" r="${core}" fill="url(#coreGrad)" />

    ${sparkle(CX + R * 0.62, CY - R * 0.66, R * 0.16, GOLD)}
    ${sparkle(CX - R * 0.72, CY - R * 0.5, R * 0.09, '#fff')}
  `;
}

function svg(inner, { transparentCanvas = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${inner}</svg>`;
}

async function render(name, innerSvg, size = SIZE) {
  const buf = Buffer.from(svg(innerSvg));
  await sharp(buf).resize(size, size).png().toFile(path.join(OUT, name));
  console.log('->', name, `${size}x${size}`);
}

(async () => {
  // icon.png : composition complète (fond + ball), utilisée telle quelle (iOS/web/legacy Android)
  await render('icon.png', ball({ transparent: false }));
  // favicon : même composition, réduite
  await render('favicon.png', ball({ transparent: false }), 196);
  // foreground de l'icône adaptative Android : ball seule, fond transparent (le fond est une couche à part)
  await render('android-icon-foreground.png', ball({ transparent: true }));
  // background de l'icône adaptative : juste le dégradé de fond, sans la ball
  await render('android-icon-background.png', `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="${NAVY}" />
    <defs><radialGradient id="bgGrad" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="${NAVY_LIGHT}" /><stop offset="1" stop-color="${NAVY}" />
    </radialGradient></defs>
    <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="url(#bgGrad)" />`);
  // monochrome : silhouette pleine sur fond transparent, Android ignore la couleur et ne lit que
  // l'alpha (teinte tout en un seul ton) — la bande et l'anneau sont de vrais trous, découpés via un
  // <mask> (du noir dans un mask = transparence réelle, contrairement à opacity="0" qui ne « soustrait »
  // rien aux formes dessinées en dessous).
  await render('android-icon-monochrome.png', `
    <defs>
      <mask id="ballMask">
        <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="#000" />
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="#fff" />
        <rect x="${CX - R}" y="${CY - R * 0.08}" width="${R * 2}" height="${R * 0.16}" fill="#000" />
        <circle cx="${CX}" cy="${CY}" r="${R * 0.34}" fill="#000" />
        <circle cx="${CX}" cy="${CY}" r="${R * 0.22}" fill="#fff" />
      </mask>
    </defs>
    <rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="#fff" mask="url(#ballMask)" />`);
  console.log('OK');
})();
