// The flight model and the mission rules, with no drawing and no browser in
// it: throttle, pitch and bank in, altitude, speed, heading, fuel, damage and
// score out. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (and beep) without the world knowing about
// screens or sound.
import { COURSE, FUEL, PLANE, SCORE, STEP } from './config.js';
import { buildCourse, nextRing, ringsPassed } from './course.js';

export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASH = 4;
export const EVENT_TIMEOUT = 8;
export const EVENT_FUEL_LOW = 16;
export const EVENT_MISSION_DONE = 32;

const DEG = Math.PI / 180;

export function createFlight(missionIndex, seed) {
  const course = buildCourse(missionIndex, seed);
  const state = {
    course,
    missionIndex,
    x: 0,
    y: 190,
    z: 0,
    headingDeg: 0,
    bankDeg: 0,
    pitch: 0,
    speedKt: 95,
    throttle: 0.72,
    verticalSpeedMs: 0,
    fuel: course.mission.fuel,
    damage: 0,
    score: 0,
    rings: 0,
    elapsed: 0,
    status: 'flying',
    reason: '',
    landingBonus: 0,
    message: '',
    messageTimer: 0,
    fuelWarned: false,
    landedAt: 0,
  };

  function reset(mission, nextSeed) {
    const fresh = createFlight(mission, nextSeed);
    // Replace the whole state so no field from the old sortie survives.
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, fresh.state);
  }

  function announce(text, seconds) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function crash(reason) {
    state.status = 'crashed';
    state.reason = reason;
    state.damage = 100;
    return EVENT_CRASH;
  }

  function finishLanding() {
    const runway = course.runway;
    const descent = -state.verticalSpeedMs;
    const align = Math.abs(state.x) * 6 + Math.abs(state.headingDeg) * 4 + Math.max(0, descent) * 15;
    state.landingBonus = Math.max(100, Math.round(SCORE.landingBase - align));
    state.score += state.landingBonus;
    state.score += Math.round(state.fuel) * SCORE.fuelPerUnit;
    if (course.mission.timeLimitSec > 0) {
      state.score += Math.round(course.mission.timeLimitSec - state.elapsed) * SCORE.stormSecondBonus;
    }
    state.status = 'landed';
    state.landedAt = state.elapsed;
    return EVENT_LANDED;
  }

  function step(dt, controls) {
    if (state.status !== 'flying' && state.status !== 'rolling') return 0;
    let events = 0;
    const mission = course.mission;
    state.elapsed += dt;

    if (state.status === 'rolling') {
      state.speedKt = Math.max(0, state.speedKt - 26 * dt);
      const ms = state.speedKt * 0.514444;
      state.z += ms * dt;
      if (state.speedKt <= 12) {
        state.status = 'complete';
        return EVENT_MISSION_DONE;
      }
      return 0;
    }

    // Throttle: W/S (or Shift/Ctrl) nudge it; the engine answers at once.
    if (state.fuel > 0) {
      state.throttle = Math.min(1, Math.max(0, state.throttle + controls.throttle * 0.65 * dt));
    } else {
      state.throttle = 0;
    }

    // Speed chases the throttle, and climbing bleeds a little of it away.
    let targetKt = PLANE.minSpeedKt + state.throttle * (PLANE.maxSpeedKt - PLANE.minSpeedKt);
    targetKt -= Math.max(0, state.pitch) * 12;
    const gap = targetKt - state.speedKt;
    state.speedKt += Math.max(-PLANE.accelKtPerSec * dt, Math.min(PLANE.accelKtPerSec * dt, gap));

    // Bank follows the stick; the heading follows the bank.
    const bankTarget = controls.turn * PLANE.maxBankDeg;
    const bankGap = bankTarget - state.bankDeg;
    state.bankDeg += Math.max(-140 * dt, Math.min(140 * dt, bankGap));
    state.headingDeg += state.bankDeg * PLANE.turnFactor * (state.speedKt / 100) * dt;
    if (state.headingDeg > 180) state.headingDeg -= 360;
    if (state.headingDeg < -180) state.headingDeg += 360;

    // Pitch sets the climb; below stall speed the wing gives up and she sinks.
    state.pitch = controls.pitch;
    const speedMs = state.speedKt * 0.514444;
    let vs = state.pitch * PLANE.climbFactor * speedMs;
    if (state.speedKt < PLANE.stallKt) vs -= (PLANE.stallKt - state.speedKt) * 0.4;
    state.verticalSpeedMs = vs;

    // Storm gusts shove the airframe sideways.
    if (mission.wind > 0) {
      state.x += Math.sin(state.elapsed * 0.7) * 9 * mission.wind * dt;
    }

    const prevZ = state.z;
    state.x += Math.sin(state.headingDeg * DEG) * speedMs * dt;
    state.z += Math.cos(state.headingDeg * DEG) * speedMs * dt;
    state.y += vs * dt;
    if (state.y > 520) state.y = 520;

    // Fuel: the tank only ever goes down.
    const burn = FUEL.burnIdlePerSec + state.throttle * (FUEL.burnFullPerSec - FUEL.burnIdlePerSec);
    state.fuel = Math.max(0, state.fuel - burn * dt);
    if (state.fuel <= FUEL.lowWarning && !state.fuelWarned) {
      state.fuelWarned = true;
      events |= EVENT_FUEL_LOW;
      announce('LOW FUEL — find the runway', 3);
    }
    if (state.fuel <= 0 && state.messageTimer <= 0) announce('FUEL EMPTY — gliding!', 2);

    if (state.messageTimer > 0) state.messageTimer -= dt;

    // Rings: crossing a ring's plane inside its circle threads it.
    const ring = nextRing(course);
    if (ring && prevZ < ring.z && state.z >= ring.z) {
      const dist = Math.hypot(state.x - ring.x, state.y - ring.y);
      if (dist <= ring.radius) {
        ring.passed = true;
        state.rings += 1;
        state.score += SCORE.ring;
        events |= EVENT_RING;
        announce(`RING ${state.rings}/${course.rings.length}  +${SCORE.ring}`, 1.6);
      } else if (dist <= ring.radius * 2) {
        announce('Missed the ring — too wide!', 1.4);
      }
    }

    // The clock only runs on the courier run.
    if (mission.timeLimitSec > 0 && state.elapsed >= mission.timeLimitSec) {
      state.status = 'timedout';
      state.reason = 'The courier clock ran out before the runway.';
      return events | EVENT_TIMEOUT;
    }

    // Terrain: an island top is solid. The runway strip itself is handled below.
    const runway = course.runway;
    const overRunway = state.z >= runway.startZ - 60 && state.z <= runway.endZ + 60;
    for (const island of course.islands) {
      if (Math.abs(state.z - island.z) > island.radius) continue;
      const dx = (state.x - island.x) / island.radius;
      const dz = (state.z - island.z) / (island.radius * 0.85);
      if (dx * dx + dz * dz >= 1) continue;
      if (island.runway && overRunway) continue;
      if (state.y <= island.height) {
        return events | crash(`Clipped ${island.runway ? 'the runway island' : 'an island'} at ${Math.round(state.y)} m.`);
      }
    }

    // Touchdown on the runway island.
    if (overRunway && state.y <= 12) {
      if (Math.abs(state.x) > runway.halfWidth + 25) {
        return events | crash('Ran off the side of the runway into the palms.');
      }
      const descent = -state.verticalSpeedMs;
      const hard = descent > 7 || Math.abs(state.bankDeg) > 22 || state.speedKt > 122;
      if (hard) {
        state.damage += 40;
        if (state.damage >= 100) return events | crash('The hard landing broke the airframe.');
        state.y = 16;
        state.verticalSpeedMs = 3;
        state.speedKt *= 0.8;
        announce('HARD LANDING — airframe damaged!', 2.5);
        return events;
      }
      state.y = 10;
      state.status = 'rolling';
      return events | finishLanding();
    }

    // The sea is not a runway.
    if (state.y <= 2) {
      return events | crash('Ditched in the sea short of the runway.');
    }
    // Flew past the end of the world.
    if (state.z > COURSE.lengthM + 800) {
      return events | crash('Flew past the archipelago and ran out of sky.');
    }
    return events;
  }

  return { state, step, reset, ringsPassed: () => ringsPassed(course) };
}
