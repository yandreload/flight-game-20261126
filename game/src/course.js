// The archipelago itself: islands, sky rings and the runway island, all laid
// out from one seed so a mission is the same course every time it is flown.
// Nothing here draws or flies; it only describes where things are.
import { COURSE, MISSIONS } from './config.js';
import { createRandom } from './random.js';

/** Build one course for a mission: rings in a gentle S-curve, islands scattered clear of the rings. */
export function buildCourse(missionIndex, seed) {
  const mission = MISSIONS[missionIndex];
  const random = createRandom(seed * 7919 + missionIndex * 104729 + 13);

  const rings = [];
  for (let i = 0; i < mission.rings; i += 1) {
    const z = 700 + i * ((COURSE.runwayStartZ - 1400) / mission.rings);
    const x = Math.sin(i * 0.85 + missionIndex) * 260 + (random() - 0.5) * 160;
    const y = 150 + Math.sin(i * 1.3) * 70 + random() * 60;
    rings.push({ x, y, z, radius: COURSE.ringRadiusM, passed: false });
  }

  const islands = [];
  for (let i = 0; i < COURSE.islandCount; i += 1) {
    const z = 400 + random() * (COURSE.lengthM - 800);
    const x = (random() - 0.5) * 2900;
    // Keep the racing line clear, and the whole final approach to the runway:
    // no island on top of a ring, and none inside the landing corridor.
    let clear = Math.abs(x) > 420 || z > COURSE.runwayStartZ - 500;
    if (Math.abs(x) < 320 && z > COURSE.runwayStartZ - 1600 && z < COURSE.runwayEndZ + 300) clear = false;
    for (const ring of rings) {
      if (Math.abs(z - ring.z) < 260 && Math.abs(x - ring.x) < 220) clear = false;
    }
    if (!clear) continue;
    const radius = 70 + random() * 200;
    islands.push({
      x,
      z,
      radius,
      height: 14 + random() * 34,
      palms: 2 + Math.floor(random() * 5),
      seed: Math.floor(random() * 100000),
    });
  }
  // The runway island: a big flat island at the end of the course, dead ahead.
  islands.push({
    x: 0,
    z: (COURSE.runwayStartZ + COURSE.runwayEndZ) / 2,
    radius: COURSE.runwayIslandRadiusM,
    height: 9,
    palms: 8,
    seed: 4242,
    runway: true,
  });

  return {
    mission,
    rings,
    islands,
    runway: {
      x: 0,
      startZ: COURSE.runwayStartZ,
      endZ: COURSE.runwayEndZ,
      halfWidth: COURSE.runwayHalfWidthM,
    },
  };
}

/** The next ring the pilot still has to fly through, or null when all are done. */
export function nextRing(course) {
  for (const ring of course.rings) {
    if (!ring.passed) return ring;
  }
  return null;
}

/** How many rings are already threaded. */
export function ringsPassed(course) {
  let count = 0;
  for (const ring of course.rings) if (ring.passed) count += 1;
  return count;
}
