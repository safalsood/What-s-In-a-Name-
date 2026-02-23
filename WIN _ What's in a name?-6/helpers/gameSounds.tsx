/**
 * Game Sounds Helper
 *
 * This helper manages sound effects for the game using the Web Audio API.
 * It synthesizes sounds programmatically so no external audio files are required.
 *
 * It provides a singleton-like access pattern where the AudioContext is initialized
 * lazily upon the first user interaction (or first call), as browsers often block
 * AudioContext until a user gesture occurs.
 */

let audioCtx: AudioContext | null = null;
let tickIntervalId: number | null = null;

/**
 * Initializes the AudioContext if it hasn't been created yet.
 * Browsers require a user gesture to resume/start the context in many cases.
 */
const getAudioContext = () => {
  if (!audioCtx) {
    // @ts-ignore - handling vendor prefixes if necessary, though modern browsers support AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

/**
 * Plays a soft "tick" sound, resembling a clock.
 * Uses a short burst of noise or a very short sine wave with a quick envelope.
 */
export const playTick = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (common browser policy)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  // High pitch, very short duration for a "click"
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  
  // Envelope for a sharp click
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
};

/**
 * Plays a "ting" sound, resembling a bell or oven ding.
 * Uses a sine wave with harmonics and a longer decay.
 */
export const playTing = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;
  const duration = 1.5;

  // Fundamental frequency
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  
  // Harmonic
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  
  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  // Bell characteristics
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, t); // A5
  
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1760, t); // A6 (First harmonic)

  // Envelope for fundamental
  gain1.gain.setValueAtTime(0, t);
  gain1.gain.linearRampToValueAtTime(0.3, t + 0.01);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + duration);

  // Envelope for harmonic (decays faster)
  gain2.gain.setValueAtTime(0, t);
  gain2.gain.linearRampToValueAtTime(0.1, t + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.6);

  osc1.start(t);
  osc1.stop(t + duration);
  
  osc2.start(t);
  osc2.stop(t + duration);
};

/**
 * Plays a swoosh/wind sound for particle swirl effect.
 * Uses filtered noise with a frequency sweep.
 */
export const playSwoosh = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;
  const duration = 1.5;

  // Create noise buffer
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(200, t);
  filter.frequency.exponentialRampToValueAtTime(800, t + duration);
  filter.Q.setValueAtTime(1, t);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(0.12, t + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);

  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);

  noise.start(t);
  noise.stop(t + duration);
};

/**
 * Plays an ethereal magic chime when particles settle.
 * Uses multiple harmonically related tones with shimmer.
 */
export const playMagicChime = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;
  const duration = 2;

  // Create a magical chord: C6, E6, G6, B6
  const frequencies = [1046.5, 1318.5, 1568, 1975.5];
  
  frequencies.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);

    const delay = index * 0.08;
    const volume = 0.08 / (index + 1);

    gainNode.gain.setValueAtTime(0, t + delay);
    gainNode.gain.linearRampToValueAtTime(volume, t + delay + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + delay + duration);

    osc.start(t + delay);
    osc.stop(t + delay + duration);
  });
};

/**
 * Plays a deep, dramatic resonant tone for title reveal.
 * Uses low frequency with slight vibrato.
 */
export const playDramaticReveal = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;
  const duration = 1.2;

  // Deep resonant tone
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  // Add vibrato
  const vibrato = ctx.createOscillator();
  const vibratoGain = ctx.createGain();

  vibrato.frequency.setValueAtTime(5, t);
  vibratoGain.gain.setValueAtTime(3, t);

  vibrato.connect(vibratoGain);
  vibratoGain.connect(osc.frequency);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.type = "triangle";
  osc.frequency.setValueAtTime(110, t); // Low A

  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(0.2, t + 0.05);
  gainNode.gain.linearRampToValueAtTime(0.15, t + 0.3);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.start(t);
  osc.stop(t + duration);
  vibrato.start(t);
  vibrato.stop(t + duration);
};

/**
 * Plays a deep, mysterious gong sound (Tam-tam).
 * Uses a cluster of low inharmonic frequencies with long decay.
 */
export const playTheatreGong = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;
  const duration = 4.0;
  
  // Fundamental and inharmonic partials for a dark gong sound
  // ~70Hz base
  const freqs = [70, 86, 115, 138, 178, 240, 360];
  
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Lower partials sine, higher triangle for metallic grit
    osc.type = i < 2 ? "sine" : "triangle";
    osc.frequency.setValueAtTime(f, t);
    
    // Slight pitch drop over time for "beating" effect
    osc.frequency.exponentialRampToValueAtTime(f * 0.99, t + duration);

    // Amplitude decreases with higher partials
    const amp = 0.5 / (i + 1);
    
    gainNode.gain.setValueAtTime(0, t);
    // Staggered attack simulates mallet strike spread
    gainNode.gain.linearRampToValueAtTime(amp, t + 0.02 + (i * 0.005));
    // Long exponential decay
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);
    
    osc.start(t);
    osc.stop(t + duration);
  });
};

/**
 * Plays a light, sparkly tinkling sound for word appearances.
 * Uses high frequency sine waves with quick decay.
 */
export const playSparkle = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;
  const duration = 0.3;

  // High sparkly notes
  const frequencies = [1760, 2217.5, 2637];

  frequencies.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);

    const delay = index * 0.03;

    gainNode.gain.setValueAtTime(0, t + delay);
    gainNode.gain.linearRampToValueAtTime(0.08, t + delay + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + delay + duration);

    osc.start(t + delay);
    osc.stop(t + delay + duration);
  });
};

/**
 * Starts a loop that plays the tick sound every second.
 * Returns a function to stop the loop.
 */
export const startTickingLoop = () => {
  // Clear any existing loop first to prevent duplicates
  if (tickIntervalId !== null) {
    window.clearInterval(tickIntervalId);
  }

  // Play immediately
  playTick();

  // Then loop
  tickIntervalId = window.setInterval(() => {
    playTick();
  }, 1000);

  return stopTickingLoop;
};

/**
 * Stops the ticking loop.
 */
const stopTickingLoop = () => {
  if (tickIntervalId !== null) {
    window.clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
};

/**
 * Stops all sounds.
 * For synthesized sounds, this primarily means stopping the loop and closing/suspending context if needed,
 * but usually just stopping the loop is sufficient for this simple implementation.
 * 
 * If we wanted to be aggressive, we could close the AudioContext, but keeping it open is better for performance.
 */
export const stopAllSounds = () => {
  stopTickingLoop();
  
  // If we had long running sounds, we would track their nodes and stop them here.
  // Since our sounds are short-lived (fire and forget), we mainly just stop the loop.
  if (audioCtx && audioCtx.state === 'running') {
     // Optional: suspend to save battery if game is paused/stopped for a long time
     // audioCtx.suspend(); 
  }
};