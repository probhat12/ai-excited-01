import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// “The Last Light”: a deterministic, self-contained 768px procedural painting.
const W = 768, H = 768;
const pixels = Buffer.alloc(W * H * 4);
let seed = 0x51a7e11;
function rand(): number {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t);
};
function blend(x: number, y: number, c: [number, number, number], a = 1): void {
  const ix = Math.round(x), iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const p = (iy * W + ix) * 4, k = clamp(a);
  pixels[p] = pixels[p] * (1 - k) + c[0] * k;
  pixels[p + 1] = pixels[p + 1] * (1 - k) + c[1] * k;
  pixels[p + 2] = pixels[p + 2] * (1 - k) + c[2] * k;
  pixels[p + 3] = 255;
}
function disc(cx: number, cy: number, r: number, c: [number, number, number], a = 1): void {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < r + 0.8) blend(x, y, c, a * (1 - smooth(r - 0.8, r + 0.8, d)));
  }
}
function capsule(ax: number, ay: number, bx: number, by: number, r: number,
                 c: [number, number, number], a = 1): void {
  const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy;
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + r + 1));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + r + 1));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / (len2 || 1));
    const d = Math.hypot(x - ax - t * vx, y - ay - t * vy);
    if (d < r + 0.8) blend(x, y, c, a * (1 - smooth(r - 0.8, r + 0.8, d)));
  }
}
function polygon(points: [number, number][], c: [number, number, number], a = 1): void {
  const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p[0]))));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(...points.map(p => p[0]))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map(p => p[1]))));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) blend(x, y, c, a);
  }
}

// Deep-space base: subtle blue-violet haze and a broad gravitational spiral.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = (y * W + x) * 4;
  const dx = x - 544, dy = y - 326, r = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx) - 0.0068 * r;
  const arm = Math.cos(ang * 2.05 + Math.log(r + 24) * 4.2);
  const band = Math.pow(Math.max(0, arm), 7) * Math.exp(-Math.pow((r - 255) / 190, 2));
  const haze = Math.exp(-Math.pow((r - 250) / 205, 2));
  const neb = Math.max(0, band * 0.34 + haze * (0.055 + 0.035 * Math.sin(ang * 3.1)));
  pixels[p] = 5 + 20 * neb;
  pixels[p + 1] = 9 + 30 * neb;
  pixels[p + 2] = 24 + 75 * neb;
  pixels[p + 3] = 255;
}
// Vortex arcs are tapered into the singularity, with layered colored edges.
for (let i = 0; i < 3; i++) {
  const offset = i * 2.08, inner = 43 + i * 8, outer = 392 - i * 27;
  for (let t = 0; t <= 1; t += 0.00115) {
    const r = outer - (outer - inner) * t;
    const ang = -2.75 + t * 4.2 + offset;
    const x = 544 + Math.cos(ang) * r, y = 326 + Math.sin(ang) * r * 0.78;
    const width = (2 + 13 * t) * (i === 0 ? 1 : 0.55);
    const col: [number, number, number] = i === 0 ? [43, 220, 255] : i === 1 ? [155, 59, 255] : [255, 84, 188];
    disc(x, y, width + 9, col, 0.035 * (1 - t * 0.55));
    disc(x, y, width, col, 0.30 * (1 - t * 0.42));
    if (i === 0) disc(x, y, Math.max(1.2, width * 0.24), [202, 255, 255], 0.58);
  }
}
// Distant broken fragments trace an inward spiral toward the solar core.
for (let i = 0; i < 34; i++) {
  const t = i / 34, a = -2.95 + t * 5.5;
  const r = 272 + 28 * Math.sin(i * 8.3);
  const x = 544 + Math.cos(a) * r, y = 326 + Math.sin(a) * r * 0.78;
  const s = 4 + rand() * 12;
  const col: [number, number, number] = i % 3 === 0 ? [89, 202, 245] : [99, 87, 151];
  polygon([[x-s,y-s*.25],[x+s*.8,y-s*.55],[x+s,y+s*.3],[x-s*.65,y+s*.5]], col, 0.74);
  if (i % 4 === 0) disc(x, y, 2 + rand() * 2, [190, 244, 255], 0.9);
}
// Artificial sun: radiant shell backed by visible segmented emitter machinery.
disc(544, 326, 183, [28, 147, 255], 0.045);
disc(544, 326, 150, [74, 187, 255], 0.08);
disc(544, 326, 121, [255, 172, 69], 0.20);
disc(544, 326, 104, [255, 211, 126], 0.72);
disc(544, 326, 92, [255, 247, 204], 0.95);
disc(544, 326, 77, [255, 255, 244], 1);
// Segmented mechanical corona: a built sun, not a natural star.
for (let i = 0; i < 18; i++) {
  const a = i * Math.PI * 2 / 18, cs = Math.cos(a), sn = Math.sin(a);
  const r1 = 112 + (i % 3) * 5, r2 = r1 + 15 + (i % 2) * 8;
  capsule(544 + cs * r1, 326 + sn * r1, 544 + cs * r2, 326 + sn * r2,
    i % 3 === 0 ? 3.6 : 2.1, i % 2 === 0 ? [255, 221, 153] : [105, 226, 255], 0.85);
}
// Twelve raised emitter modules form a segmented mechanical corona.
for (let i = 0; i < 12; i++) {
  const a = i * Math.PI * 2 / 12, ux = Math.cos(a), uy = Math.sin(a), tx = -uy, ty = ux;
  const point = (r: number, side: number): [number, number] => [544 + ux * r + tx * side, 326 + uy * r + ty * side];
  polygon([point(118,-7),point(151,-6),point(158,-3),point(158,3),point(151,6),point(118,7)], [22,35,51], 0.96);
  const panel: [number,number,number] = i % 3 === 0 ? [105,222,239] : i % 2 === 0 ? [255,210,126] : [214,177,112];
  polygon([point(123,-3.5),point(150,-3),point(154,0),point(150,3),point(123,3.5)], panel, 0.96);
  capsule(...point(147,0), ...point(169,0), 2.4, i % 2 === 0 ? [255,229,164] : [131,237,255], 0.94);
  disc(...point(128,0), 1.7, [245,246,214], 0.95);
}
// The small turbine hub has a warm plate and an illuminated core, not a large pupil.
disc(544, 326, 43, [255, 255, 232], 1);
disc(544, 326, 35, [45, 68, 83], 1);
disc(544, 326, 29, [255, 207, 123], 1);
disc(544, 326, 22, [53, 76, 87], 1);
disc(544, 326, 12, [91, 161, 175], 1);
disc(544, 326, 5.5, [255, 250, 214], 1);
for (let i = 0; i < 8; i++) {
  const a = i * Math.PI / 4;
  disc(544 + Math.cos(a) * 31.5, 326 + Math.sin(a) * 31.5, 1.6, [255, 244, 199], 1);
}

// Nearby debris in front of the light establishes depth and collapse direction.
for (let i = 0; i < 42; i++) {
  const x = 110 + rand() * 600, y = 80 + rand() * 600;
  if (Math.hypot(x - 544, y - 326) < 145 || (x < 275 && y > 455)) continue;
  const s = 2 + rand() * 7, shade = 55 + rand() * 70;
  const dist = Math.hypot(544 - x, 326 - y), ux = (544 - x) / dist, uy = (326 - y) / dist;
  const tx = -uy, ty = ux, len = 11 + rand() * 24 + s * 0.7, half = s * 0.38;
  polygon([[x-ux*len*.55-tx*half,y-uy*len*.55-ty*half],
    [x+ux*len*.48-tx*half*.45,y+uy*len*.48-ty*half*.45],
    [x+ux*len*.62+tx*half*.5,y+uy*len*.62+ty*half*.5],
    [x-ux*len*.4+tx*half,y-uy*len*.4+ty*half]], [shade, shade + 12, shade + 38], 0.78);
  if (i % 3 === 0) capsule(x - ux * len * 1.3, y - uy * len * 1.3,
    x + ux * len * 0.7, y + uy * len * 0.7, 1.8, [81, 206, 255], 0.72);
}
// Star field: restrained points and crosses, seeded for reproducible output.
for (let i = 0; i < 250; i++) {
  const x = rand() * W, y = rand() * H;
  const d = Math.hypot(x - 544, y - 326);
  if (d < 145) continue;
  const b = 0.25 + rand() * 0.7;
  disc(x, y, i % 23 === 0 ? 1.8 : 0.85, [128 + 90*b, 166 + 75*b, 220 + 35*b], b);
  if (i % 47 === 0) {
    capsule(x-5,y,x+5,y,0.7,[117,220,255],0.45);
    capsule(x,y-5,x,y+5,0.7,[117,220,255],0.45);
  }
}

// Astronaut silhouette in the lower-left, posed on a fractured ledge.
polygon([[0,676],[88,647],[166,660],[226,628],[286,655],[337,718],[332,768],[0,768]], [12,22,42], 1);
polygon([[0,691],[96,666],[172,678],[231,650],[279,672],[294,702],[219,694],[153,710],[82,699],[0,724]], [25,42,66], 1);
capsule(68,711,225,678,2,[80,168,208],0.45);
// Backpack and torso silhouette, outlined in cool reflected light.
polygon([[219,518],[275,501],[313,530],[305,583],[329,622],[300,679],[244,686],[211,654],[190,612]], [6,13,28], 1);
polygon([[223,520],[275,505],[307,533],[299,580],[321,620],[294,670],[248,676],[218,648],[198,610]], [164,193,205], 1);
polygon([[230,526],[273,513],[298,538],[291,578],[311,620],[288,656],[251,660],[226,638],[210,608]], [39,61,79], 1);
polygon([[209,537],[230,525],[232,584],[213,622],[193,612],[196,565]], [4,13,27], 1);
polygon([[209,544],[224,538],[222,582],[209,604],[200,598]], [75,190,221], 0.85);
// Legs bent against the ledge, chunky boot shapes for thumbnail clarity.
capsule(252,644,218,695,21,[5,13,28],1);
capsule(250,646,219,693,16,[102,132,153],1);
capsule(219,693,176,716,15,[5,12,26],1);
capsule(218,690,179,710,10,[143,164,176],1);
capsule(285,641,300,690,20,[5,13,28],1);
capsule(283,643,298,686,14,[86,114,138],1);
capsule(298,687,328,706,15,[5,12,26],1);
capsule(296,685,324,701,10,[142,158,171],1);
// Helmet: hard rim, reflective visor, and a clean silhouette.
disc(248,486,48,[4,12,27],1);
disc(248,484,40,[178,216,226],1);
disc(248,482,34,[10,26,47],1);
disc(250,480,28,[13,47,73],1);
polygon([[225,468],[241,452],[267,460],[278,480],[263,496],[235,494],[220,483]], [43,151,184], 0.92);
polygon([[231,466],[244,457],[264,463],[271,477],[257,486],[237,484]], [163,244,247], 0.60);
capsule(224,504,267,504,2.4,[238,249,238],0.95);
// Neck ring and chest controls.
capsule(236,521,266,520,7,[205,216,211],1);
capsule(236,520,265,520,4,[41,61,73],1);
disc(271,558,6,[255,182,77],0.95);
disc(252,576,3,[75,222,255],1);
capsule(246,590,278,588,2,[202,218,215],0.7);

// Reaching arm leads from shoulder toward the artificial sun; glove fingers splay.
const dark: [number,number,number] = [4,12,27], suit: [number,number,number] = [179,197,196];
capsule(275,543,324,512,20,dark,1); capsule(275,543,324,512,15,suit,1);
capsule(322,513,370,473,16,dark,1); capsule(322,513,370,473,11,[194,204,193],1);
capsule(366,474,404,445,12,dark,1); capsule(366,474,404,445,8,[206,209,190],1);
// Cuff, enlarged palm, and separated gauntlet fingers for a clear reach at thumbnail size.
capsule(344,494,354,486,13,[49,83,95],1);
polygon([[397,450],[401,434],[411,423],[426,420],[440,426],[449,437],[444,448],[431,459],[414,463],[401,459]], [5,14,28], 1);
polygon([[401,448],[405,436],[413,428],[426,425],[437,430],[443,438],[438,446],[428,455],[414,458],[405,455]], [212,211,184], 1);
capsule(415,430,435,399,6.4,[4,13,28],1); capsule(415,430,435,399,3.9,[222,217,187],1);
capsule(422,429,450,406,6.1,[4,13,28],1); capsule(422,429,450,406,3.7,[231,222,188],1);
capsule(429,434,462,420,5.8,[4,13,28],1); capsule(429,434,462,420,3.5,[230,219,184],1);
capsule(434,443,459,448,5.4,[4,13,28],1); capsule(434,443,459,448,3.3,[220,215,187],1);
capsule(405,449,417,469,6,[4,13,28],1); capsule(405,449,417,469,3.7,[191,199,184],1);
// Warm reflection on the fingertips and suit edge ties the reach to the sun.
capsule(432,401,439,397,1.5,[255,219,153],0.95);
capsule(449,407,457,404,1.4,[255,204,127],0.85);
capsule(402,457,375,478,1.6,[255,194,105],0.82);
capsule(303,535,322,521,1.8,[122,234,255],0.85);

// Final fine motes near focal light; alpha remains fully opaque throughout.
for (let i = 0; i < 95; i++) {
  const a = rand() * Math.PI * 2, r = 125 + rand() * 90;
  const x = 544 + Math.cos(a) * r, y = 326 + Math.sin(a) * r * 0.8;
  disc(x, y, 0.7 + rand() * 1.1, i % 2 ? [255,214,135] : [118,231,255], 0.65);
}

// PNG encoder: RGBA8, filter type 0 scanlines, zlib IDAT, standards-compliant CRCs.
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii'), out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
const scan = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) pixels.copy(scan, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(scan, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
if (png.length >= 1048576) throw new Error(`PNG exceeds 1 MiB: ${png.length} bytes`);
mkdirSync('/output', { recursive: true });
writeFileSync('/output/entry.png', png);
