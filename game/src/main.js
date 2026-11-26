// Boot and the one loop: input is read every frame, the flight advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, game over and mission complete.
//
// ?seed=N fixes the course. ?shot=start|play|landing|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, MISSIONS, STEP } from './config.js';
import { createFlight, EVENT_CRASH, EVENT_FUEL_LOW, EVENT_LANDED, EVENT_MISSION_DONE, EVENT_RING, EVENT_TIMEOUT } from './flight.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, titleCardRect } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const flight = createFlight(0, seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, flight);
  let painted = 0;
  function paint() {
    renderer.draw(flight, scene.screen, { best: scene.best, buttons: [], mouse: null, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let selectedMission = 0;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function titleButtons() {
    return MISSIONS.map((mission, index) => {
      const rect = titleCardRect(index);
      return { ...rect, label: '', onClick: () => startMission(index) };
    });
  }

  function endButtons() {
    return [
      { label: 'Fly again', onClick: () => startMission(selectedMission) },
      { label: 'Change mission', onClick: () => showTitle() },
    ];
  }

  function showTitle() {
    screen = SCREEN_TITLE;
    input.setButtons(titleButtons());
    announce('Nusa Wings. Choose a mission to fly.');
  }

  function startMission(index) {
    selectedMission = index;
    flight.reset(index, seed);
    accumulator = 0;
    screen = SCREEN_PLAY;
    input.setButtons([]);
    audio.start();
    announce(`Flying ${MISSIONS[index].name}. Thread the rings, then land on the runway.`);
  }

  function endFlight() {
    screen = SCREEN_OVER;
    if (flight.state.score > best) {
      best = flight.state.score;
      saveBest(best);
    }
    announce(`Sortie over. Score ${flight.state.score}. Best ${best}.`);
  }

  function completeFlight() {
    screen = SCREEN_COMPLETE;
    if (flight.state.score > best) {
      best = flight.state.score;
      saveBest(best);
    }
    announce(`Mission complete. Score ${flight.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startMission(selectedMission);
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        input.setButtons([
          { label: 'Resume', onClick: () => resumeGame() },
          { label: 'Restart', onClick: () => startMission(selectedMission) },
          { label: 'Change mission', onClick: () => showTitle() },
        ]);
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startMission(selectedMission);
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) resumeGame();
      else if (actions & ACTION_RESTART) startMission(selectedMission);
      return;
    }
    // Over and complete screens: confirm restarts the same mission.
    if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startMission(selectedMission);
  }

  function resumeGame() {
    screen = SCREEN_PLAY;
    input.setButtons([]);
    announce('Flying.');
  }

  function stepWorld() {
    if (screen === SCREEN_TITLE) {
      // The title sits over a living sky: clouds drift, the plane waits.
      flight.state.elapsed += STEP;
      return;
    }
    const events = flight.step(STEP, input.controls());
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_LANDED) audio.thud();
    if (events & EVENT_FUEL_LOW) audio.alarm();
    if (events & EVENT_CRASH) {
      audio.thud();
      endFlight();
    } else if (events & EVENT_TIMEOUT) {
      endFlight();
    } else if (events & EVENT_MISSION_DONE) {
      completeFlight();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const buttons =
      screen === SCREEN_PAUSED
        ? [
            { label: 'Resume', onClick: () => resumeGame() },
            { label: 'Restart', onClick: () => startMission(selectedMission) },
            { label: 'Change mission', onClick: () => showTitle() },
          ]
        : screen === SCREEN_OVER || screen === SCREEN_COMPLETE
          ? endButtons()
          : [];
    // The pause and end panels lay their buttons out themselves; give the
    // renderer the same objects the input module hit-tests, so a click and a
    // drawn button never disagree. (drawPanel positions them in place.)
    if (screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_COMPLETE) {
      input.setButtons(buttons);
    }
    renderer.draw(flight, screen, { best, buttons, mouse: input.mouse(), muted: audio.muted });
    audio.update(flight.state.throttle, flight.state.speedKt, screen === SCREEN_PLAY);
  }

  // Leaving the tab pauses a running sortie rather than letting it fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      input.setButtons([
        { label: 'Resume', onClick: () => resumeGame() },
        { label: 'Restart', onClick: () => startMission(selectedMission) },
        { label: 'Change mission', onClick: () => showTitle() },
      ]);
      announce('Paused.');
    }
  });

  // Number keys pick a mission straight from the title screen.
  window.addEventListener('keydown', (event) => {
    if (screen !== SCREEN_TITLE) return;
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
    if (index >= 0) startMission(index);
  });

  showTitle();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
