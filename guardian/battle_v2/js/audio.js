/* audio.js : BGM(보스전 트랙) + 절차적 효과음(WebAudio) + 한국어 보이스
 *
 * Step 4-1 믹싱 정리
 *  - 신호 경로: 개별 SFX → sfxBus → master → limiter → destination
 *    (다단히트로 소리가 겹쳐도 limiter가 찢어짐을 막는다)
 *  - 같은 프레임 중복 방지: 효과음별 최소 재생 간격(gate)
 *  - 보이스 겹침 방지: 동시 1개 + 우선순위(보스 > 지원 > 카엘) + 종료 후 쿨다운
 *  - 보이스가 나오는 동안 BGM을 잠깐 낮춘다(더킹)
 *  - 음소거는 SFX·BGM·보이스 전부에 적용된다
 */
(function () {
  const Sfx = {
    ctx: null,
    master: null,
    limiter: null,
    sfxBus: null,
    muted: false,
    bgm: null,
    bgmStarted: false,
    bgmVolume: 0.38,
    voiceVolume: 0.66,
    voiceGap: 0.65,          // 보이스와 보이스 사이 최소 간격(초)
    mix: { master: 0.9, sfx: 0.95, duck: 0.42 },
    counts: { hit: 0, hitSkip: 0, slash: 0, slashSkip: 0, step: 0, magic: 0, voice: 0, voiceSkip: 0 },

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.mix.master;
      // 여러 타격음이 겹칠 때 파형이 찢어지지 않도록 마스터 끝단에 리미터를 둔다
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.knee.value = 8;
      this.limiter.ratio.value = 6;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.18;
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.mix.sfx;
      this.sfxBus.connect(this.master);
      this._noiseBuf = this._makeNoise(1.0);
      this._gate = {};
      this._voices = [];
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
      // BGM(4.9MB)은 첫 터치 직후에도 바로 받지 않고, 전투가 시작된 뒤 비동기로 받는다
      if (!this.bgm && !this._bgmScheduled) this._scheduleBgm(1500);
      if (this._needGesture && this.bgm) {
        this._needGesture = false;
        this._playBgm();
      }
    },

    _scheduleBgm(delay) {
      this._bgmScheduled = true;
      const go = () => setTimeout(() => this._loadBgm(), delay);
      if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 2500 });
      else go();
    },

    _loadBgm() {
      if (this.bgm) return;
      const a = new Audio();
      a.src = 'audio/boss_bgm.mp3';
      a.loop = true;
      a.volume = this.muted ? 0 : this.bgmVolume;
      a.preload = 'auto';
      this.bgm = a;
      this._wantPlay = true;
      a.addEventListener('canplay', () => {
        if (this._wantPlay) this._playBgm();
      });
      a.load();
    },

    _playBgm() {
      if (!this.bgm || this.bgmStarted) return;
      const p = this.bgm.play();
      if (p && p.then) {
        p.then(() => { this.bgmStarted = true; }).catch(() => { this._needGesture = true; });
      } else {
        this.bgmStarted = true;
      }
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : this.mix.master;
      if (this.bgm) this.bgm.volume = this.muted ? 0 : this.bgmVolume;
      // 보이스(HTMLAudio)도 함께 음소거한다
      (this._voices || []).forEach((v) => { try { v.a.volume = this.muted ? 0 : this.voiceVolume; } catch (_) {} });
      return this.muted;
    },

    /* 효과음 공통 게이트: 같은 소리가 한 프레임에 여러 번 겹치지 않게 한다 */
    _gateOk(key, gap) {
      if (!this.ctx) return false;
      const t = this.ctx.currentTime;
      const last = this._gate[key];
      if (last !== undefined && t - last < gap) return false;
      this._gate[key] = t;
      return true;
    },

    _bus() { return this.sfxBus || this.master; },

    _env(node, t0, a, d, peak) {
      const g = node.gain;
      g.setValueAtTime(0.0001, t0);
      g.exponentialRampToValueAtTime(peak, t0 + a);
      g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    },

    _nowMs() {
      return (typeof performance !== 'undefined' ? performance.now() : Date.now());
    },

    /* BGM 더킹: 보이스·연출음이 나오는 동안 배경음을 잠깐 낮춘다 */
    _duck(sec, ratio) {
      if (!this.bgm) return;
      const gen = (this._duckGen = (this._duckGen || 0) + 1);
      if (!this.muted) this.bgm.volume = this.bgmVolume * (ratio === undefined ? this.mix.duck : ratio);
      clearTimeout(this._duckTimer);
      this._duckTimer = setTimeout(() => {
        if (gen !== this._duckGen) return;
        if (this.bgm && !this.muted) this.bgm.volume = this.bgmVolume;
      }, Math.max(120, sec * 1000));
    },

    /* 검기 스윙 */
    slash(pitch = 1) {
      if (!this.ctx || this.muted) return;
      if (!this._gateOk('slash', 0.045)) { this.counts.slashSkip++; return; }
      this.counts.slash++;
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
      src.connect(bp).connect(g).connect(this._bus());
      src.start(t);
      src.stop(t + 0.3);
    },

    /* 타격 — light/heavy 두 계열은 서로 다른 게이트를 써서 같이 울릴 수 있게 한다 */
    hit(heavy = false) {
      if (!this.ctx || this.muted) return;
      // 같은 무게의 타격음이 한 프레임에 3~4번 겹쳐 '찢어지는' 현상 방지
      if (!this._gateOk(heavy ? 'hitHeavy' : 'hitLight', heavy ? 0.05 : 0.032)) {
        this.counts.hitSkip++;
        return;
      }
      this.counts.hit++;
      const ctx = this.ctx, t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(heavy ? 180 : 260, t);
      osc.frequency.exponentialRampToValueAtTime(heavy ? 46 : 70, t + 0.14);
      const g = ctx.createGain();
      this._env(g, t, 0.005, heavy ? 0.3 : 0.16, heavy ? 0.4 : 0.26);
      osc.connect(g).connect(this._bus());
      osc.start(t);
      osc.stop(t + 0.4);

      const n = ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      const ng = ctx.createGain();
      this._env(ng, t, 0.003, 0.1, 0.18);
      n.connect(hp).connect(ng).connect(this._bus());
      n.start(t);
      n.stop(t + 0.16);
    },

    /* 마법 / 스킬 */
    magic() {
      if (!this.ctx || this.muted) return;
      if (!this._gateOk('magic', 0.08)) return;
      this.counts.magic++;
      const ctx = this.ctx, t = ctx.currentTime;
      [660, 990, 1320].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.5);
        const g = ctx.createGain();
        this._env(g, t + i * 0.02, 0.02, 0.5, 0.1);
        o.connect(g).connect(this._bus());
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
      o.connect(lp).connect(g).connect(this._bus());
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
      o.connect(lp).connect(g).connect(this._bus());
      o.start(t);
      o.stop(t + 1.2);
      this._duck(1.1, 0.5);
    },

    /* 발걸음 (달리기/걷기 접지음) */
    step(power = 1) {
      if (!this.ctx || this.muted) return;
      if (!this._gateOk('step', 0.055)) return;
      this.counts.step++;
      const ctx = this.ctx, t = ctx.currentTime;
      const n = ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420 + 260 * power;
      const ng = ctx.createGain();
      this._env(ng, t, 0.004, 0.075, 0.055 + 0.05 * power);
      n.connect(lp).connect(ng).connect(this._bus());
      n.start(t);
      n.stop(t + 0.14);
    },

    /* UI */
    ui(up = true) {
      if (!this.ctx || this.muted) return;
      if (!this._gateOk('ui', 0.05)) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(up ? 880 : 520, t);
      const g = ctx.createGain();
      this._env(g, t, 0.004, 0.07, 0.08);
      o.connect(g).connect(this._bus());
      o.start(t);
      o.stop(t + 0.1);
    },

    /* 검증용 믹싱 상태 */
    mixState() {
      return {
        muted: this.muted,
        ctx: this.ctx ? this.ctx.state : null,
        master: this.master ? +this.master.gain.value.toFixed(3) : null,
        sfx: this.sfxBus ? +this.sfxBus.gain.value.toFixed(3) : null,
        bgm: this.bgm ? +this.bgm.volume.toFixed(3) : null,
        bgmBase: this.bgmVolume,
        bgmStarted: this.bgmStarted,
        limiter: this.limiter ? { threshold: this.limiter.threshold.value, ratio: this.limiter.ratio.value } : null,
        voice: this._voice && this._voice.playing ? this._voice.name : null,
        voiceVol: this.voiceVolume,
        activeVoices: (this._voices || []).filter((v) => v.playing).length,
        counts: Object.assign({}, this.counts),
      };
    },
  };

  G.Sfx = Sfx;
  Sfx._voiceT = {};
  Sfx._voice = null;
  Sfx._voiceEndAt = -1e9;
  Sfx._voices = [];
  Sfx._gate = {};

  Sfx.stopVoice = function () {
    const v = this._voice;
    if (!v) return;
    try { v.a.pause(); v.a.currentTime = 0; } catch (_) {}
    v.playing = false;
    const i = this._voices.indexOf(v);
    if (i >= 0) this._voices.splice(i, 1);
    this._voice = null;
    this._voiceEndAt = this._nowMs();
  };

  /* 한국어 보이스 — 파일이 없거나 재생이 막혀도 게임은 계속된다.
   * 동시에 하나만 재생하고, 우선순위가 높은 쪽(보스 3 > 지원 2 > 카엘 1 > 잡음성 0)이
   * 들어오면 낮은 쪽을 끊는다. 같은 이름은 min 간격으로 제한한다. */
  Sfx.playVoice = function (name, opts) {
    if (!/^[a-z0-9_]+$/i.test(name)) return false;
    const o = opts || {};
    const now = this._nowMs();
    const min = o.min === undefined ? 900 : o.min;
    if (now - (this._voiceT[name] || -1e9) < min) { this.counts.voiceSkip++; return false; }
    if (o.chance !== undefined && Math.random() > o.chance) { this.counts.voiceSkip++; return false; }
    const prio = o.priority === undefined ? 1 : o.priority;
    const cur = this._voice;
    const curPlaying = !!(cur && cur.playing);
    if (curPlaying) {
      if (cur.priority >= prio) { this.counts.voiceSkip++; return false; }  // 겹치지 않게 건너뛴다
      this.stopVoice();                                                     // 더 센 목소리가 이어받는다
    } else if (now - this._voiceEndAt < this.voiceGap && prio < 3) {
      this.counts.voiceSkip++;
      return false;
    }
    this._voiceT[name] = now;
    this.counts.voice++;
    try {
      const a = new Audio('audio/' + name + '.mp3');
      a.volume = this.muted ? 0 : this.voiceVolume;
      const rec = { name, a, playing: true, priority: prio };
      this._voices.push(rec);
      this._voice = rec;
      const done = () => {
        if (!rec.playing) return;
        rec.playing = false;
        if (this._voice === rec) { this._voice = null; this._voiceEndAt = this._nowMs(); }
        const i = this._voices.indexOf(rec);
        if (i >= 0) this._voices.splice(i, 1);
      };
      a.addEventListener('ended', done);
      a.addEventListener('error', done);
      const result = a.play();
      if (result && result.catch) result.catch(() => done());
      this._duck(1.0, this.mix.duck);
    } catch (_) {
      this._voice = null;
    }
    return true;
  };
})();
