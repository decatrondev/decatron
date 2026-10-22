/** Sonidos del overlay generados con Web Audio (sin archivos): un tic para la ruleta y una fanfarria para el ganador. */

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
    try {
        if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        if (ctx.state === 'suspended') void ctx.resume();
        return ctx;
    } catch {
        return null;
    }
}

function tone(c: AudioContext, freq: number, start: number, length: number, gain: number, type: OscillatorType = 'sine') {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + length + 0.02);
}

/** volume: 0 a 100 */
export function playTick(volume: number) {
    const c = context();
    if (!c || volume <= 0) return;
    tone(c, 900, c.currentTime, 0.05, (volume / 100) * 0.25, 'square');
}

export function playFanfare(volume: number) {
    const c = context();
    if (!c || volume <= 0) return;
    const g = (volume / 100) * 0.3;
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + i * 0.12, 0.35, g, 'triangle'));
    tone(c, 1046.5, t + 0.5, 0.9, g, 'triangle');
    tone(c, 1318.5, t + 0.5, 0.9, g * 0.7, 'triangle');
}
