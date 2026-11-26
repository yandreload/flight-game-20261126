// The screenshot scenes behind ?shot=start|play|landing|end. Each one flies
// the real rules forward from a fresh world for a fixed stretch, steered by a
// simple autopilot (aim at the next ring, then at the runway; ease the
// throttle off on final), so every frame is what a real sortie looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { createFlight, EVENT_CRASH, EVENT_MISSION_DONE } from './flight.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_TARGET_Z = 4800;
const MAX_SECONDS = 260;

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function wrapDegrees(degrees) {
  let value = degrees;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

/** Steer toward the next ring, or toward the runway once they are all threaded. */
export function autopilot(flight) {
  const f = flight.state;
  const course = f.course;
  const next = course.rings.find((ring) => !ring.passed);
  // Past the rings, aim at a point beyond the far end of the strip, so the
  // target never slips behind the plane while it is still over the runway.
  // Glidepath: hold 30 m until short final, then drop to the strip — the
  // runway island's top is 9 m, so an early descent clips it.
  const shortFinal = !next && f.z > course.runway.startZ - 500;
  const target = next || { x: 0, y: shortFinal ? 8 : 30, z: course.runway.endZ + 400 };
  const dz = Math.max(1, target.z - f.z);
  // On final, steer by the lateral error against a near lookahead point, so
  // a gust gets corrected at once instead of a degree at a time.
  const desiredHeading = next
    ? Math.atan2(target.x - f.x, dz) * (180 / Math.PI)
    : Math.atan2(-f.x, 350) * (180 / Math.PI);
  const headingError = wrapDegrees(desiredHeading - f.headingDeg);
  // Gentle gain with a dead zone: full bank for a big error, level wings when
  // nearly lined up, so the heading settles instead of seesawing.
  const turn = Math.abs(headingError) < 2 ? 0 : clamp(headingError / 25, -1, 1);
  const altitudeError = target.y - f.y;
  // On final approach, descend gently and flare low, or the touchdown is hard.
  const onFinal = !next && dz < 2000;
  const pitch = onFinal
    ? clamp(altitudeError / 55, f.y > 60 ? -0.42 : -0.3, 0.5)
    : clamp(altitudeError / 55, -0.85, 0.85);
  // Ease off on final approach so the touchdown is gentle.
  const desiredThrottle = onFinal ? 0.34 : 0.75;
  const throttle = f.throttle < desiredThrottle - 0.02 ? 1 : f.throttle > desiredThrottle + 0.02 ? -1 : 0;
  return { turn, pitch, throttle };
}

function flyForward(flight, seconds, stopWhen) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = flight.step(STEP, autopilot(flight));
    if (events & EVENT_CRASH) return 'crashed';
    if (events & EVENT_MISSION_DONE) return 'complete';
    if (stopWhen && stopWhen(flight.state)) return 'stopped';
  }
  return 'flying';
}

/**
 * Set `flight` to the named scene and return the screen to draw over it and
 * the best score to show. The cover scene (play) is staged deep in the
 * course, where rings, the runway island and the HUD are all in frame.
 */
export function stageShot(name, flight) {
  const seed = 7;
  if (name === 'landing' || name === 'end') {
    flight.reset(0, seed);
    // Landing: stop on short final, low over the island with the whole strip
    // ahead, rather than at the touchdown instant when it is already behind.
    const outcome = flyForward(flight, MAX_SECONDS, (s) => s.z >= 6400 && s.y <= 45);
    if (name === 'end') {
      if (outcome !== 'crashed') flyForward(flight, 30, (s) => s.status === 'complete');
      const done = flight.state.status === 'complete';
      return { screen: done ? SCREEN_COMPLETE : SCREEN_PLAY, best: flight.state.score };
    }
    return { screen: SCREEN_PLAY, best: flight.state.score };
  }
  if (name === 'play') {
    flight.reset(0, seed);
    flyForward(flight, MAX_SECONDS, (s) => s.z >= PLAY_TARGET_Z);
    return { screen: SCREEN_PLAY, best: flight.state.score };
  }
  flight.reset(0, seed);
  flyForward(flight, START_SECONDS);
  return { screen: SCREEN_TITLE, best: 0 };
}

export function createShotFlight(seed) {
  return createFlight(0, seed);
}
