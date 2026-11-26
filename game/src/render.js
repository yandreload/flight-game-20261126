// Drawing only: the flight state and the current screen in, pixels out. The
// playfield is a fixed 1280x720 logical area scaled to the window. The world
// is a chase view: the camera sits behind the plane and looks along its
// heading, so islands, rings and the runway are projected from 3D (x, y, z)
// onto the screen with a focal length and a horizon that drops as the nose
// rises. Nothing here flies or scores.
import { FONT, FUEL, MISSIONS, PALETTE, VIEW } from './config.js';
import { hash2 } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

/** Geometry of the three mission cards on the title screen, shared with main.js so clicks land on them. */
export const TITLE_CARDS = { y: 210, height: 148, width: 330, gap: 24 };
export function titleCardRect(index) {
  const total = 3 * TITLE_CARDS.width + 2 * TITLE_CARDS.gap;
  return {
    x: VIEW.width / 2 - total / 2 + index * (TITLE_CARDS.width + TITLE_CARDS.gap),
    y: TITLE_CARDS.y,
    width: TITLE_CARDS.width,
    height: TITLE_CARDS.height,
  };
}

const FOCAL = 620;
const DEG = Math.PI / 180;
const HEADING_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const CLOUDS = [];
for (let i = 0; i < 16; i += 1) {
  CLOUDS.push({
    u: hash2(i, 11),
    v: hash2(i, 23),
    scale: 0.6 + hash2(i, 37) * 0.9,
    drift: 4 + hash2(i, 51) * 9,
  });
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function frame() {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.clearRect(0, 0, VIEW.width, VIEW.height);
  }

  /** Project a world point into screen space; null when behind the camera. */
  function project(wx, wy, wz, plane) {
    const headingRad = plane.headingDeg * DEG;
    const dx = wx - plane.x;
    const dz = wz - plane.z;
    const forward = dx * Math.sin(headingRad) + dz * Math.cos(headingRad);
    if (forward < 40) return null;
    const lateral = dx * Math.cos(headingRad) - dz * Math.sin(headingRad);
    const horizonY = 300 + plane.pitch * 150;
    return {
      x: VIEW.width / 2 + (lateral * FOCAL) / forward,
      y: horizonY - ((wy - plane.y) * FOCAL) / forward,
      scale: FOCAL / forward,
      depth: forward,
    };
  }

  function drawSky(plane, elapsed) {
    const horizonY = 300 + plane.pitch * 150;
    const gradient = context.createLinearGradient(0, 0, 0, horizonY + 40);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.62, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.skyHorizon);
    context.fillStyle = gradient;
    context.fillRect(0, 0, VIEW.width, horizonY + 40);
    // Low sun, right of the nose, with a warm glow.
    const sunX = VIEW.width * 0.78 - plane.headingDeg * 4;
    const sunY = horizonY - 130;
    const glow = context.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
    glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 220, 150, 0.55)');
    glow.addColorStop(1, 'rgba(255, 220, 150, 0)');
    context.fillStyle = glow;
    context.fillRect(sunX - 150, sunY - 150, 300, 300);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(sunX, sunY, 26, 0, Math.PI * 2);
    context.fill();
    // Drifting clouds, one coherent style: soft white puffs.
    context.fillStyle = 'rgba(255, 255, 255, 0.88)';
    for (const cloud of CLOUDS) {
      const x = (((cloud.u * 1400 + elapsed * cloud.drift) % 1400) + 1400) % 1400 - 60;
      const y = 36 + cloud.v * 200;
      const s = cloud.scale;
      context.beginPath();
      context.ellipse(x, y, 52 * s, 16 * s, 0, 0, Math.PI * 2);
      context.ellipse(x - 30 * s, y + 6 * s, 30 * s, 12 * s, 0, 0, Math.PI * 2);
      context.ellipse(x + 32 * s, y + 5 * s, 32 * s, 13 * s, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawSea(plane, elapsed) {
    const horizonY = 300 + plane.pitch * 150;
    const gradient = context.createLinearGradient(0, horizonY, 0, VIEW.height);
    gradient.addColorStop(0, PALETTE.seaShallow);
    gradient.addColorStop(0.35, '#1a7d96');
    gradient.addColorStop(1, PALETTE.seaDeep);
    context.fillStyle = gradient;
    context.fillRect(0, horizonY, VIEW.width, VIEW.height - horizonY);
    // Sun glitter on the water, stable per band of distance flown.
    const band = Math.floor(plane.z / 90);
    context.fillStyle = 'rgba(255, 240, 190, 0.5)';
    for (let row = 0; row < 9; row += 1) {
      const y = horizonY + 18 + row * 44 + row * row * 1.2;
      if (y > VIEW.height - 8) break;
      for (let col = 0; col < 4; col += 1) {
        const h = hash2(row * 7 + col, band + row);
        if (h < 0.45) continue;
        const x = 120 + h * 1040;
        const len = 14 + hash2(col, row + band) * 42;
        context.fillRect(x, y, len, 2);
      }
    }
  }

  function drawIsland(island, plane) {
    const centre = project(island.x, island.height, island.z, plane);
    if (!centre) return;
    const radiusPx = island.radius * centre.scale;
    if (radiusPx < 3 || centre.x < -radiusPx - 40 || centre.x > VIEW.width + radiusPx + 40) return;
    const base = project(island.x, 0, island.z, plane);
    if (!base) return;
    const baseRadiusPx = island.radius * base.scale;
    // Soft shadow on the water, then sand rim, then the green top.
    context.fillStyle = 'rgba(6, 40, 60, 0.25)';
    context.beginPath();
    context.ellipse(centre.x, base.y + 4, baseRadiusPx, baseRadiusPx * 0.22, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.sand;
    context.beginPath();
    context.ellipse(base.x, base.y, baseRadiusPx, baseRadiusPx * 0.26, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = island.runway ? PALETTE.islandDark : PALETTE.islandGreen;
    context.beginPath();
    context.ellipse(centre.x, centre.y - radiusPx * 0.12, radiusPx, radiusPx * 0.42, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 255, 255, 0.16)';
    context.beginPath();
    context.ellipse(centre.x - radiusPx * 0.3, centre.y - radiusPx * 0.2, radiusPx * 0.5, radiusPx * 0.16, 0, 0, Math.PI * 2);
    context.fill();
    // Palms: little dark tufts on the green, only when close enough to see.
    if (radiusPx > 26) {
      context.fillStyle = PALETTE.palm;
      for (let i = 0; i < island.palms; i += 1) {
        const px = centre.x + (hash2(island.seed, i) - 0.5) * radiusPx * 1.5;
        const py = centre.y - radiusPx * 0.1 - hash2(i, island.seed) * radiusPx * 0.25;
        context.beginPath();
        context.moveTo(px, py - 7);
        context.lineTo(px - 5, py + 3);
        context.lineTo(px + 5, py + 3);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawRunway(course, plane) {
    const runway = course.runway;
    const near = project(-runway.halfWidth, 9, runway.startZ, plane);
    const far = project(-runway.halfWidth, 9, runway.endZ, plane);
    if (!near || !far) return;
    const corners = [
      project(-runway.halfWidth, 9, runway.startZ, plane),
      project(runway.halfWidth, 9, runway.startZ, plane),
      project(runway.halfWidth, 9, runway.endZ, plane),
      project(-runway.halfWidth, 9, runway.endZ, plane),
    ];
    if (corners.some((c) => c === null)) return;
    context.fillStyle = PALETTE.runway;
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) context.lineTo(corners[i].x, corners[i].y);
    context.closePath();
    context.fill();
    // Centreline dashes, one per 120 m of strip.
    context.fillStyle = PALETTE.runwayLine;
    for (let z = runway.startZ + 90; z < runway.endZ; z += 120) {
      const a = project(0, 9.4, z, plane);
      const b = project(0, 9.4, z + 55, plane);
      if (!a || !b) continue;
      const w = Math.max(1, 3 * a.scale);
      context.fillRect(a.x - w / 2, b.y, w, a.y - b.y);
    }
    // Threshold bars at the near end.
    for (let i = -3; i <= 3; i += 1) {
      if (i === 0) continue;
      const a = project(i * 8, 9.4, runway.startZ + 18, plane);
      const b = project(i * 8, 9.4, runway.startZ + 70, plane);
      if (!a || !b) continue;
      const w = Math.max(1, 4 * a.scale);
      context.fillRect(a.x - w / 2, b.y, w, a.y - b.y);
    }
    // Windsock on the left shoulder, and two huts by the far end.
    const sock = project(-runway.halfWidth - 26, 9, runway.startZ + 160, plane);
    if (sock) {
      const h = 26 * sock.scale;
      context.strokeStyle = '#d8d2c0';
      context.lineWidth = Math.max(1, 2 * sock.scale);
      context.beginPath();
      context.moveTo(sock.x, sock.y);
      context.lineTo(sock.x, sock.y - h);
      context.stroke();
      context.fillStyle = '#ff7a3c';
      context.beginPath();
      context.moveTo(sock.x, sock.y - h);
      context.lineTo(sock.x + 16 * sock.scale, sock.y - h + 4 * sock.scale);
      context.lineTo(sock.x, sock.y - h + 8 * sock.scale);
      context.closePath();
      context.fill();
    }
    for (const side of [-1, 1]) {
      const hut = project(side * (runway.halfWidth + 90), 9, runway.endZ - 120, plane);
      if (!hut) continue;
      const w = 60 * hut.scale;
      const h = 26 * hut.scale;
      context.fillStyle = '#c9b18a';
      context.fillRect(hut.x - w / 2, hut.y - h, w, h);
      context.fillStyle = '#8a4a2f';
      context.beginPath();
      context.moveTo(hut.x - w / 2 - 4, hut.y - h);
      context.lineTo(hut.x, hut.y - h - 12 * hut.scale);
      context.lineTo(hut.x + w / 2 + 4, hut.y - h);
      context.closePath();
      context.fill();
    }
  }

  function drawRings(course, plane, elapsed) {
    const ordered = [...course.rings].sort((a, b) => b.z - a.z);
    let nextSeen = false;
    for (const ring of ordered) {
      const p = project(ring.x, ring.y, ring.z, plane);
      if (!p) continue;
      const radiusPx = ring.radius * p.scale;
      if (radiusPx < 2) continue;
      const isNext = !ring.passed && !nextSeen;
      if (isNext) nextSeen = true;
      const colour = ring.passed ? PALETTE.ringDone : isNext ? PALETTE.ringNext : PALETTE.ringLater;
      const pulse = isNext ? 1 + Math.sin(elapsed * 5) * 0.07 : 1;
      context.lineWidth = Math.max(2, radiusPx * 0.14 * pulse);
      context.strokeStyle = colour;
      context.globalAlpha = ring.passed ? 0.85 : 0.95;
      context.beginPath();
      context.arc(p.x, p.y, radiusPx * pulse, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
      context.fillStyle = colour;
      context.beginPath();
      context.arc(p.x, p.y - radiusPx * pulse, Math.max(2, radiusPx * 0.09), 0, Math.PI * 2);
      context.fill();
      if (isNext) {
        const distM = Math.max(0, Math.round(ring.z - plane.z));
        text(`${distM} m`, p.x, p.y - radiusPx * pulse - 12, 15, PALETTE.hudAmber, 'center', '700');
      }
    }
    // Off-screen arrow toward the next ring, so the pilot is never lost.
    const next = course.rings.find((ring) => !ring.passed);
    if (next) {
      const p = project(next.x, next.y, next.z, plane);
      if (!p || p.x < 40 || p.x > VIEW.width - 40 || p.y < 80 || p.y > VIEW.height - 120) {
        const tx = p ? Math.max(50, Math.min(VIEW.width - 50, p.x)) : VIEW.width / 2;
        const ty = 120;
        context.fillStyle = PALETTE.ringNext;
        context.beginPath();
        context.moveTo(tx, ty - 14);
        context.lineTo(tx - 12, ty + 8);
        context.lineTo(tx + 12, ty + 8);
        context.closePath();
        context.fill();
        text('NEXT RING', tx, ty + 30, 13, PALETTE.ringNext, 'center', '700');
      }
    }
  }

  function drawPlane(plane, elapsed) {
    const bob = Math.sin(elapsed * 2.1) * 2;
    const cx = VIEW.width / 2;
    const cy = 566 + bob;
    context.save();
    context.translate(cx, cy);
    context.rotate(plane.bankDeg * DEG * 0.85);
    const s = 1 + Math.max(0, plane.speedKt - 90) * 0.0012;
    context.scale(s, s);
    // Main wings, cream with red tips.
    context.fillStyle = PALETTE.planeCream;
    context.beginPath();
    context.moveTo(-122, 4);
    context.lineTo(-96, -6);
    context.lineTo(96, -6);
    context.lineTo(122, 4);
    context.lineTo(96, 16);
    context.lineTo(-96, 16);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeBody;
    context.fillRect(-122, 2, 14, 12);
    context.fillRect(108, 2, 14, 12);
    // Tailplane and fin.
    context.fillStyle = PALETTE.planeCream;
    context.fillRect(-54, -36, 108, 12);
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(-15, -28);
    context.lineTo(-4, -78);
    context.lineTo(10, -78);
    context.lineTo(16, -28);
    context.closePath();
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.fillRect(-11, -66, 22, 5);
    // Fuselage, red with a cream cheatline and two lit windows.
    const body = context.createLinearGradient(-24, 0, 24, 0);
    body.addColorStop(0, PALETTE.planeDark);
    body.addColorStop(0.5, PALETTE.planeBody);
    body.addColorStop(1, PALETTE.planeDark);
    context.fillStyle = body;
    context.beginPath();
    context.moveTo(-22, -30);
    context.quadraticCurveTo(-26, 10, -14, 42);
    context.lineTo(14, 42);
    context.quadraticCurveTo(26, 10, 22, -30);
    context.quadraticCurveTo(0, -40, -22, -30);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeCream;
    context.fillRect(-22, -2, 44, 6);
    context.fillStyle = '#bfe9ff';
    context.beginPath();
    context.ellipse(-9, -14, 5, 4, 0, 0, Math.PI * 2);
    context.ellipse(9, -14, 5, 4, 0, 0, Math.PI * 2);
    context.fill();
    // Navigation lights: red port, green starboard, gently blinking.
    const blink = 0.55 + Math.sin(elapsed * 4) * 0.45;
    context.globalAlpha = blink;
    context.fillStyle = '#ff3b30';
    context.beginPath();
    context.arc(-122, 8, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#35e08a';
    context.beginPath();
    context.arc(122, 8, 4, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.restore();
    // Speed streaks at the screen edges when she is really moving.
    if (plane.speedKt > 112) {
      context.strokeStyle = 'rgba(255,255,255,0.35)';
      context.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const y = 120 + hash2(i, Math.floor(elapsed * 9)) * 480;
        const len = 30 + hash2(i, 3) * 50;
        context.beginPath();
        context.moveTo(6, y);
        context.lineTo(6 + len, y);
        context.moveTo(VIEW.width - 6, y + 40);
        context.lineTo(VIEW.width - 6 - len, y + 40);
        context.stroke();
      }
    }
  }

  function drawCompass(headingDeg) {
    const cx = VIEW.width / 2;
    const y = 34;
    context.fillStyle = PALETTE.hudPanel;
    roundedRect(context, cx - 190, 12, 380, 44, 8);
    context.fill();
    context.save();
    context.beginPath();
    context.rect(cx - 190, 12, 380, 44);
    context.clip();
    for (let offset = -40; offset <= 40; offset += 5) {
      const heading = Math.round(((headingDeg + offset) % 360 + 360) % 360);
      const x = cx + offset * 4.6;
      const major = heading % 45 === 0;
      context.strokeStyle = major ? PALETTE.hudText : 'rgba(234,246,255,0.5)';
      context.lineWidth = major ? 2 : 1;
      context.beginPath();
      context.moveTo(x, y + 8);
      context.lineTo(x, y + (major ? -6 : 2));
      context.stroke();
      if (major) {
        const index = Math.round(heading / 45) % 8;
        text(HEADING_NAMES[index], x, y + 16, 11, PALETTE.hudText, 'center', '700');
      }
    }
    context.restore();
    context.fillStyle = PALETTE.hudAmber;
    context.beginPath();
    context.moveTo(cx, 14);
    context.lineTo(cx - 6, 4);
    context.lineTo(cx + 6, 4);
    context.closePath();
    context.fill();
    text(`${String(Math.round(((headingDeg % 360) + 360) % 360)).padStart(3, '0')}°`, cx, 74, 15, PALETTE.hudText, 'center', '700');
  }

  function drawAttitude(plane) {
    const cx = 92;
    const cy = 618;
    const r = 46;
    context.save();
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.clip();
    context.translate(cx, cy);
    context.rotate(-plane.bankDeg * DEG);
    context.translate(0, plane.pitch * 26);
    context.fillStyle = '#7fb2dd';
    context.fillRect(-r - 4, -r - 40, r * 2 + 8, r + 40);
    context.fillStyle = '#8a5a34';
    context.fillRect(-r - 4, 0, r * 2 + 8, r + 40);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-r, 0);
    context.lineTo(r, 0);
    context.stroke();
    context.restore();
    context.strokeStyle = PALETTE.hudText;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.stroke();
    // Fixed aircraft symbol: the pilot's own wings never move.
    context.fillStyle = PALETTE.hudAmber;
    context.fillRect(cx - 26, cy - 2, 18, 4);
    context.fillRect(cx + 8, cy - 2, 18, 4);
    context.beginPath();
    context.arc(cx, cy, 4, 0, Math.PI * 2);
    context.fill();
    text('ATT', cx, cy + r + 18, 11, 'rgba(234,246,255,0.75)', 'center', '700');
  }

  function verticalBar(x, y, height, fraction, colour, label, valueText) {
    context.fillStyle = PALETTE.hudPanel;
    roundedRect(context, x - 14, y - 24, 28, height + 48, 8);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.14)';
    roundedRect(context, x - 8, y, 16, height, 4);
    context.fill();
    const fillHeight = Math.max(0, Math.min(1, fraction)) * height;
    context.fillStyle = colour;
    roundedRect(context, x - 8, y + height - fillHeight, 16, fillHeight, 4);
    context.fill();
    text(label, x, y - 30, 11, PALETTE.hudText, 'center', '700');
    text(valueText, x, y + height + 20, 12, PALETTE.hudText, 'center', '700');
  }

  function drawHud(flight, best) {
    const f = flight.state;
    const course = f.course;
    const altFt = Math.max(0, Math.round(f.y * 3.28084));
    const passed = course.rings.filter((ring) => ring.passed).length;
    // Top-left instrument cluster: altitude, speed, vertical speed.
    context.fillStyle = PALETTE.hudPanel;
    roundedRect(context, 16, 12, 250, 108, 10);
    context.fill();
    text('ALT', 30, 40, 12, 'rgba(234,246,255,0.7)', 'left', '700');
    text(`${altFt} ft`, 30, 72, 30, PALETTE.hudText, 'left', '700');
    text('SPD', 150, 40, 12, 'rgba(234,246,255,0.7)', 'left', '700');
    text(`${Math.round(f.speedKt)} kt`, 150, 72, 30, PALETTE.hudText, 'left', '700');
    const vsText = f.verticalSpeedMs >= 0 ? `▲ ${f.verticalSpeedMs.toFixed(1)} m/s` : `▼ ${Math.abs(f.verticalSpeedMs).toFixed(1)} m/s`;
    text(vsText, 30, 104, 14, f.verticalSpeedMs < -5 ? PALETTE.hudRed : PALETTE.hudText, 'left', '700');
    drawCompass(f.headingDeg);
    // Top-right: score, rings, timer.
    context.fillStyle = PALETTE.hudPanel;
    roundedRect(context, VIEW.width - 266, 12, 250, 108, 10);
    context.fill();
    text('SCORE', VIEW.width - 252, 40, 12, 'rgba(234,246,255,0.7)', 'left', '700');
    text(String(f.score), VIEW.width - 252, 72, 30, PALETTE.hudText, 'left', '700');
    text(`RINGS ${passed}/${course.rings.length}`, VIEW.width - 252, 104, 14, PALETTE.hudAmber, 'left', '700');
    if (course.mission.timeLimitSec > 0) {
      const left = Math.max(0, course.mission.timeLimitSec - f.elapsed);
      text(`⏱ ${Math.ceil(left)}s`, VIEW.width - 120, 104, 14, left < 30 ? PALETTE.hudRed : PALETTE.hudText, 'right', '700');
    }
    // Throttle left, fuel and damage right.
    verticalBar(44, 180, 180, f.throttle, PALETTE.hudAmber, 'THR', `${Math.round(f.throttle * 100)}%`);
    const fuelColour = f.fuel < FUEL.lowWarning ? PALETTE.hudRed : PALETTE.hudGreen;
    verticalBar(VIEW.width - 44, 180, 180, f.fuel / 100, fuelColour, 'FUEL', `${Math.round(f.fuel)}`);
    verticalBar(VIEW.width - 44, 420, 110, f.damage / 100, PALETTE.hudRed, 'DMG', `${Math.round(f.damage)}%`);
    drawAttitude(f);
    // Mission line and the next objective, bottom centre.
    const next = course.rings.find((ring) => !ring.passed);
    const objective = next
      ? `Next ring ${passed + 1}/${course.rings.length} — ${Math.max(0, Math.round(next.z - f.z))} m ahead`
      : f.status === 'rolling'
        ? 'Rolling out — ease her to a stop'
        : 'All rings done — line up on the runway!';
    text(`${course.mission.name.toUpperCase()}  ·  ${objective}`, VIEW.width / 2, 700, 15, PALETTE.hudText, 'center', '700');
    if (f.message && f.messageTimer > 0) {
      context.font = `700 24px ${FONT}`;
      const w = context.measureText(f.message).width + 36;
      context.fillStyle = 'rgba(8, 24, 40, 0.55)';
      roundedRect(context, VIEW.width / 2 - w / 2, 128, w, 44, 10);
      context.fill();
      text(f.message, VIEW.width / 2, 158, 24, PALETTE.hudAmber, 'center', '700');
    }
    if (best > 0) text(`BEST ${best}`, VIEW.width - 24, 700, 13, 'rgba(234,246,255,0.65)', 'right', '700');
  }

  function drawButton(button, mouse) {
    const hover =
      mouse && mouse.x >= button.x && mouse.x <= button.x + button.width && mouse.y >= button.y && mouse.y <= button.y + button.height;
    context.fillStyle = hover ? '#2c5d84' : 'rgba(16, 40, 64, 0.88)';
    roundedRect(context, button.x, button.y, button.width, button.height, 10);
    context.fill();
    context.strokeStyle = hover ? PALETTE.hudAmber : PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text(button.label, button.x + button.width / 2, button.y + button.height / 2 + 7, 19, '#eaf6ff', 'center', '700');
  }

  function drawPanel(title, lines, buttons, mouse, accent) {
    context.fillStyle = 'rgba(5, 16, 28, 0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const width = 640;
    const height = 150 + lines.length * 32 + (buttons.length ? 84 : 20);
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundedRect(context, x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text(title, VIEW.width / 2, y + 58, 40, accent || PALETTE.hudText, 'center', '800');
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 108 + i * 32, 19, '#d7e6f2', 'center');
    });
    buttons.forEach((button, i) => {
      const total = buttons.length;
      const bw = 240;
      const gap = 20;
      const bx = VIEW.width / 2 - (total * bw + (total - 1) * gap) / 2 + i * (bw + gap);
      const placed = { ...button, x: bx, y: y + height - 66, width: bw, height: 48 };
      drawButton(placed, mouse);
      button.x = placed.x;
      button.y = placed.y;
      button.width = placed.width;
      button.height = placed.height;
    });
  }

  function drawTitle(flight, best, buttons, mouse) {
    const f = flight.state;
    drawWorld(flight, true);
    context.fillStyle = 'rgba(5, 16, 28, 0.42)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('NUSA WINGS', VIEW.width / 2, 128, 76, '#ffffff', 'center', '800');
    text('ARCHIPELAGO RUN — a bush-plane sortie over the islands', VIEW.width / 2, 166, 20, PALETTE.hudAmber, 'center', '700');
    // Three mission cards, left to right.
    const cardW = 330;
    const cardH = 148;
    const gap = 24;
    const startX = VIEW.width / 2 - (3 * cardW + 2 * gap) / 2;
    const cardY = 210;
    MISSIONS.forEach((mission, i) => {
      const bx = startX + i * (cardW + gap);
      const hover = mouse && mouse.x >= bx && mouse.x <= bx + cardW && mouse.y >= cardY && mouse.y <= cardY + cardH;
      context.fillStyle = hover ? 'rgba(28, 68, 100, 0.92)' : 'rgba(16, 40, 64, 0.88)';
      roundedRect(context, bx, cardY, cardW, cardH, 12);
      context.fill();
      context.strokeStyle = hover ? PALETTE.hudAmber : PALETTE.panelEdge;
      context.lineWidth = 2;
      context.stroke();
      text(`${i + 1}. ${mission.name}`, bx + 20, cardY + 38, 22, '#ffffff', 'left', '800');
      // Blurb, wrapped to two lines by hand (each blurb is short).
      const words = mission.blurb.split(' ');
      let line = '';
      let ly = cardY + 70;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 34) {
          text(line.trim(), bx + 20, ly, 15, '#d7e6f2', 'left');
          line = word;
          ly += 22;
        } else {
          line += ` ${word}`;
        }
      }
      if (line.trim()) text(line.trim(), bx + 20, ly, 15, '#d7e6f2', 'left');
      const tag = mission.timeLimitSec > 0 ? `${mission.rings} rings · ${mission.timeLimitSec}s` : `${mission.rings} rings · ${mission.fuel} fuel`;
      text(tag, bx + 20, cardY + cardH - 18, 14, PALETTE.hudAmber, 'left', '700');
    });
    text('Click a mission — or press 1, 2, 3 — to fly it.', VIEW.width / 2, 402, 19, '#ffffff', 'center', '700');
    text('↑ ↓ pitch      ← → turn      Shift / Ctrl throttle      P pause      M mute', VIEW.width / 2, 436, 16, '#cfe0ee', 'center');
    text('Thread the gold rings, mind the fuel, and land on the strip at Pulau Landas.', VIEW.width / 2, 464, 16, '#cfe0ee', 'center');
    if (best > 0) text(`Best score so far: ${best}`, VIEW.width / 2, 500, 17, PALETTE.hudAmber, 'center', '700');
    buttons.forEach((button) => drawButton(button, mouse));
  }

  function drawWorld(flight, titleBackdrop) {
    const f = flight.state;
    context.save();
    // The horizon tilts with the bank, as it does from a real cockpit.
    const horizonY = 300 + f.pitch * 150;
    context.translate(VIEW.width / 2, horizonY);
    context.rotate(-f.bankDeg * DEG * 0.45);
    context.translate(-VIEW.width / 2, -horizonY);
    drawSky(f, f.elapsed);
    drawSea(f, f.elapsed);
    const islands = [...f.course.islands].sort((a, b) => b.z - a.z);
    for (const island of islands) drawIsland(island, f);
    drawRunway(f.course, f);
    drawRings(f.course, f, f.elapsed);
    context.restore();
    if (!titleBackdrop) drawPlane(f, f.elapsed);
  }

  return {
    draw(flight, screen, ui) {
      frame();
      const f = flight.state;
      if (screen === SCREEN_TITLE) {
        drawTitle(flight, ui.best, ui.buttons, ui.mouse);
        return;
      }
      drawWorld(flight, false);
      drawHud(flight, ui.best);
      if (screen === SCREEN_PAUSED) {
        drawPanel('PAUSED', ['The sky will wait. Press P or click Resume to keep flying.'], ui.buttons, ui.mouse);
      } else if (screen === SCREEN_OVER) {
        const title = f.status === 'timedout' ? 'OUT OF TIME' : 'CRASHED';
        drawPanel(
          title,
          [f.reason || 'The sortie ended early.', `Rings threaded: ${f.rings}/${f.course.rings.length}`, `Score: ${f.score}`],
          ui.buttons,
          ui.mouse,
          PALETTE.hudRed,
        );
      } else if (screen === SCREEN_COMPLETE) {
        drawPanel(
          'MISSION COMPLETE',
          [
            `${f.course.mission.name} — landed safe on Pulau Landas.`,
            `Rings ${f.rings}/${f.course.rings.length}  ·  Landing bonus +${f.landingBonus}`,
            `Fuel left ${Math.round(f.fuel)}  ·  Time ${Math.round(f.elapsed)}s`,
            `Score: ${f.score}   ·   Best: ${Math.max(ui.best, f.score)}`,
          ],
          ui.buttons,
          ui.mouse,
          PALETTE.hudGreen,
        );
      } else if (f.status === 'rolling') {
        // Rolling out: the HUD stays up, no panel yet.
      }
      if (ui.muted) text('MUTED (M)', VIEW.width - 24, 150, 13, 'rgba(234,246,255,0.7)', 'right', '700');
    },
  };
}
