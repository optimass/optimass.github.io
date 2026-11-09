export class MountainAudio {
  constructor() { this.enabled = false; this.ctx = null; }
  enable(value) {
    this.enabled = value;
    if (value && !this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const length = this.ctx.sampleRate * 2, buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate), data = buffer.getChannelData(0);
        let last = 0; for (let i = 0; i < length; i++) { last = (last + Math.random() * .04 - .02) / 1.02; data[i] = last * 3; }
        this.wind = this.ctx.createBufferSource(); this.wind.buffer = buffer; this.wind.loop = true; this.filter = this.ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 500; this.gain = this.ctx.createGain(); this.gain.gain.value = 0;
        this.wind.connect(this.filter).connect(this.gain).connect(this.ctx.destination); this.wind.start();
      } catch { this.enabled = false; }
    }
    if (this.ctx && value) this.ctx.resume().catch(() => {});
    if (!value && this.gain) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, .08);
  }
  update(speed, active, rail) { if (!this.enabled || !this.ctx) return; this.gain.gain.setTargetAtTime(active ? .05 + speed * .003 : .015, this.ctx.currentTime, .2); this.filter.frequency.setTargetAtTime(rail ? 1900 : 250 + speed * 20, this.ctx.currentTime, .1); }
  tone(frequency, duration = .15, volume = .07, type = 'sine') {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(frequency, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * .6), t + duration); g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(.001, t + duration); o.connect(g).connect(this.ctx.destination); o.start(); o.stop(t + duration);
  }
  event(name) { if (name === 'pop') this.tone(170, .12, .035, 'triangle'); if (name === 'land') this.tone(70, .16, .065, 'triangle'); if (name === 'bank') { this.tone(660, .2, .05); setTimeout(() => this.tone(880, .3, .04), 100); } if (name === 'bail') this.tone(110, .3, .07, 'sawtooth'); if (name === 'rail') this.tone(460, .1, .035, 'triangle'); }
}
