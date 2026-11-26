// Keyboard and mouse, in one place: the game loop reads a plain controls
// object every frame, and the menus register clickable rectangles that a
// mouse (or a tap) can hit. No game rule lives here.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let buttons = [];
  let mouseX = 0;
  let mouseY = 0;

  function keyDown(event) {
    const code = event.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(code);
    if (code === 'Enter' || code === 'Space') actions |= ACTION_CONFIRM;
    if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
    if (code === 'KeyR') actions |= ACTION_RESTART;
    if (code === 'KeyM') actions |= ACTION_MUTE;
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    mouseY = ((event.clientY - rect.top) / rect.height) * 720;
  }

  function pointerDown(event) {
    pointerMove(event);
    for (const button of buttons) {
      if (
        mouseX >= button.x &&
        mouseX <= button.x + button.width &&
        mouseY >= button.y &&
        mouseY <= button.y + button.height
      ) {
        button.onClick();
        return;
      }
    }
    // A click anywhere else on the title or end screens confirms, like Space.
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);

  function held(...codes) {
    return codes.some((code) => keys.has(code));
  }

  return {
    /** -1/0/1 turn, -1/0/1 pitch (up is climb), -1/0/1 throttle nudge. */
    controls() {
      return {
        turn: (held('ArrowRight', 'KeyD') ? 1 : 0) - (held('ArrowLeft', 'KeyA') ? 1 : 0),
        pitch: (held('ArrowUp', 'KeyW') ? 1 : 0) - (held('ArrowDown', 'KeyS') ? 1 : 0),
        throttle: (held('ShiftLeft', 'ShiftRight', 'KeyE') ? 1 : 0) - (held('ControlLeft', 'KeyQ') ? 1 : 0),
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Replace the clickable buttons for the current screen. */
    setButtons(next) {
      buttons = next;
    },
    mouse() {
      return { x: mouseX, y: mouseY };
    },
  };
}
