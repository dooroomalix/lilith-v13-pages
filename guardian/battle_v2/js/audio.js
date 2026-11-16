/* audio.js : BGM(보스전 트랙) + 절차적 효과음(WebAudio) */
(function () {
  const Sfx = {
    ctx: null,
    master: null,
    muted: false,
    bgm: null,
    bgmStarted: false,
    bgmVolume: 0.38,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this._noiseBuf = this._makeNoise(1.0);
    },

    _makeNoise(sec) {
      const ctx = this.ctx;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    },

    resume() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.bgm) {
        const a = new Audio('audio/boss_bgm.mp3');
        a.loop = true;
        a.volume = this.bgmVolume;
        a.preload = 'auto';
        this.bgm = a;
      }
      if (!this.bgmStarted && this.bgm) {
        this.bgmStarted = true;
        this.bgm.play().catch(() => {});
      }
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.9;
      if (this.bgm) this.bgm.volume = this.muted ? 0 : this.bgmVolume;
      return this.muted;
    },

    _env(node, t0, a, d, peak) {
      const g = node.gain;
      g.setValueAtTime(0.0001, t0);
      g.exponentialRampToValueAtTime(peak, t0 + a);
      g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    },

    /* 검기 스윙 */
    slash(pitch = 1) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      src.playbackRate.value = pitch;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1800 * pitch, t);
      bp.frequency.exponentialRampToValueAtTime(520, t + 0.18);
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      this._env(g, t, 0.012, 0.2, 0.28);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.3);
    },

    /* 타격 */
    hit(heavy = false) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(heavy ? 180 : 260, t);
      osc.frequency.exponentialRampToValueAtTime(heavy ? 46 : 70, t + 0.14);
      const g = ctx.createGain();
      this._env(g, t, 0.005, heavy ? 0.3 : 0.16, heavy ? 0.4 : 0.26);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.4);

      const n = ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      const ng = ctx.createGain();
      this._env(ng, t, 0.003, 0.1, 0.18);
      n.connect(hp).connect(ng).connect(this.master);
      n.start(t);
      n.stop(t + 0.16);
    },

    /* 마법 / 스킬 */
    magic() {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx, t = ctx.currentTime;
      [660, 990, 1320].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.5);
        const g = ctx.createGain();
        this._env(g, t + i * 0.02, 0.02, 0.5, 0.1);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 0.6);
      });
    },

    /* 퍼펙트 카운터 */
    counter() {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.25);
      const g = ctx.createGain();
      this._env(g, t, 0.005, 0.45, 0.22);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1200, t);
      lp.frequency.exponentialRampToValueAtTime(6000, t + 0.3);
      o.connect(lp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.55);
      this.hit(true);
    },

    /* 보스 등장 */
    bossRoar() {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.9);
      const g = ctx.createGain();
      this._env(g, t, 0.06, 1.0, 0.32);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, t);
      o.connect(lp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 1.2);
    },

    /* UI */
    ui(up = true) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(up ? 880 : 520, t);
      const g = ctx.createGain();
      this._env(g, t, 0.004, 0.07, 0.08);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.1);
    },
  };

  G.Sfx = Sfx;
})();
