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
  const target = next || { x: 0, y: 14, z: course.runway.startZ + 300 };
  const dz = Math.max(1, target.z - f.z);
  const desiredHeading = Math.atan2(target.x - f.x, dz) * (180 / Math.PI);
  const headingError = wrapDegrees(desiredHeading - f.headingDeg);
  const turn = clamp(headingError / 18, -1, 1);
  const altitudeError = target.y - f.y;
  const pitch = clamp(altitudeError / 55, -0.85, 0.85);
  // Ease off on final approach so the touchdown is gentle.
  const onFinal = !next && dz < 1400;
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
    const outcome = flyForward(flight, MAX_SECONDS, (s) => s.status === 'rolling');
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
