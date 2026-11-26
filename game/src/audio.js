// All sound is synthesised with WebAudio — an engine hum, wind, a ring chime,
// a landing thud and a low-fuel alarm — so the game ships no audio files and
// makes no network request. Everything is guarded: no gesture yet, no sound.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      return false;
    }
    return true;
  }

  /** Call from a user gesture (or the first frame after one) to start the hum. */
  function start() {
    if (started || muted || !ensure()) return;
    started = true;
    try {
      if (context.state === 'suspended') void context.resume();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 68;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(filter).connect(engineGain).connect(context.destination);
      engineOsc.start();

      // Wind: a looped noise buffer through a bandpass, quiet at low speed.
      const length = context.sampleRate;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const band = context.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 900;
      windGain = context.createGain();
      windGain.gain.value = 0.0;
      noise.connect(band).connect(windGain).connect(context.destination);
      noise.start();
    } catch {
      // Sound is garnish: a failed AudioContext never stops the game.
      context = null;
    }
  }

  /** Called every frame while flying: hum pitch follows throttle, wind follows speed. */
  function update(throttle, speedKt, flying) {
    if (!context || !engineGain || muted) return;
    const now = context.currentTime;
    const target = flying ? 0.045 + throttle * 0.05 : 0.0;
    engineGain.gain.setTargetAtTime(target, now, 0.1);
    engineOsc.frequency.setTargetAtTime(58 + throttle * 64 + speedKt * 0.12, now, 0.15);
    if (windGain) windGain.gain.setTargetAtTime(flying ? Math.max(0, speedKt - 60) * 0.00045 : 0, now, 0.2);
  }

  function beep(frequency, durationSec, type, volume) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume || 0.16, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + durationSec);
      osc.connect(gain).connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + durationSec);
    } catch {
      // Ignore: a beep never matters enough to throw.
    }
  }

  return {
    start,
    update,
    ring() {
      beep(880, 0.22, 'sine', 0.2);
      window.setTimeout(() => beep(1318, 0.3, 'sine', 0.18), 90);
    },
    thud() {
      beep(70, 0.35, 'sine', 0.3);
    },
    alarm() {
      beep(620, 0.16, 'square', 0.08);
      window.setTimeout(() => beep(620, 0.16, 'square', 0.08), 220);
    },
    click() {
      beep(520, 0.07, 'triangle', 0.1);
    },
    toggleMute() {
      muted = !muted;
      if (context && engineGain) engineGain.gain.value = 0;
      if (context && windGain) windGain.gain.value = 0;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
