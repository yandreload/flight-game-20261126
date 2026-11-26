// Nusa Wings — every tuning number, colour and mission in one place.
// The world is metres: x is lateral, y is altitude, z is distance along the course.
// Speeds are knots for the pilot (the HUD shows knots); the sim converts to m/s.
export const STEP = 1 / 60;
export const KNOT_TO_MS = 0.514444;
export const VIEW = { width: 1280, height: 720 };

export const PLANE = {
  stallKt: 55,
  minSpeedKt: 45,
  maxSpeedKt: 140,
  accelKtPerSec: 7,
  maxBankDeg: 38,
  climbFactor: 0.38,
  turnFactor: 0.45,
  sinkKt: 0.22,
};

export const COURSE = {
  lengthM: 7300,
  runwayStartZ: 6600,
  runwayEndZ: 7300,
  runwayHalfWidthM: 35,
  runwayIslandRadiusM: 720,
  islandCount: 26,
  ringRadiusM: 30,
};

export const FUEL = {
  start: 100,
  burnIdlePerSec: 0.12,
  burnFullPerSec: 0.44,
  lowWarning: 22,
};

export const SCORE = {
  ring: 100,
  landingBase: 500,
  fuelPerUnit: 2,
  stormSecondBonus: 5,
};

// Three sorties with different goals: same sky, different pressure.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    blurb: 'Thread 8 sky rings, then put her down on Pulau Landas runway.',
    rings: 8,
    fuel: 100,
    timeLimitSec: 0,
    wind: 0,
  },
  {
    id: 'island-hop',
    name: 'Island Hop',
    blurb: 'Six rings on a tight tank — 70 fuel, no room for joyriding.',
    rings: 6,
    fuel: 70,
    timeLimitSec: 0,
    wind: 0,
  },
  {
    id: 'storm-courier',
    name: 'Storm Courier',
    blurb: 'Eight rings in 170 seconds with gusts shoving you sideways.',
    rings: 8,
    fuel: 100,
    timeLimitSec: 170,
    wind: 1,
  },
];

export const PALETTE = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#ffd9a0',
  sun: '#fff3c4',
  seaDeep: '#0d4d6e',
  seaShallow: '#2fa8a0',
  sand: '#ecd9a4',
  islandGreen: '#3f8f4f',
  islandDark: '#2c6b3a',
  palm: '#1f5c2e',
  ringNext: '#ffc93c',
  ringLater: '#9fd8ff',
  ringDone: '#7be495',
  runway: '#3a3f46',
  runwayLine: '#f5f2e8',
  planeBody: '#e8543f',
  planeCream: '#f7ead2',
  planeDark: '#7c2d20',
  hudPanel: 'rgba(8, 24, 40, 0.62)',
  hudText: '#eaf6ff',
  hudAmber: '#ffc93c',
  hudRed: '#ff6b5e',
  hudGreen: '#7be495',
  panel: '#101c2b',
  panelEdge: '#2c4a66',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nusa-wings.best';
