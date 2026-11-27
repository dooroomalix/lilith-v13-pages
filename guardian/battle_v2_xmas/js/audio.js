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

    /* 발걸음 (달리기/걷기 접지음) */
    step(power = 1) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const n = ctx.createBufferSource();
      n.buffer = this._noiseBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420 + 260 * power;
      const ng = ctx.createGain();
      this._env(ng, t, 0.004, 0.075, 0.055 + 0.05 * power);
      n.connect(lp).connect(ng).connect(this.master);
      n.start(t);
      n.stop(t + 0.14);
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

  /* ------------------------------------------------------------------ */
  /*  보이스 채널 (Step 11-1)                                            */
  /*  · 파일 1개당 1채널, 최대 2채널 동시 재생 — 몬스터가 여럿 겹쳐도    */
  /*    대사가 뒤엉키지 않는다. 자리가 없으면 우선순위가 낮은 쪽을 끊는다.*/
  /*  · 이름별 쿨다운(기본 900ms) + 같은 이름 연타 방지.                 */
  /*  · 재생 중에는 BGM 을 자동으로 낮춘다(더킹).                        */
  /*  · 음소거(M)면 즉시 멈추고, 해제 전에는 새 보이스를 재생하지 않는다. */
  /* ------------------------------------------------------------------ */
  const VOICE = {
    noel_intro: { pri: 5, cool: 9000, vol: 0.86 },
    noel_skill1: { pri: 4, cool: 7000, vol: 0.82 },
    noel_skill2: { pri: 4, cool: 7000, vol: 0.82 },
    noel_skill3: { pri: 5, cool: 9000, vol: 0.84 },
    noel_hit: { pri: 3, cool: 9000, vol: 0.72 },
    // Step 11-2 — 중파·각성·광폭화 보이스
    noel_damaged: { pri: 5, cool: 8000, vol: 0.86 },
    noel_damaged2: { pri: 4, cool: 8000, vol: 0.84 },
    noel_damaged_hit: { pri: 3, cool: 8000, vol: 0.72 },
    noel_awake: { pri: 6, cool: 15000, vol: 0.92 },
    noel_berserk: { pri: 6, cool: 15000, vol: 0.92 },
    // Step 11-3 — 최종 격파 시네마틱(비명·외침·마지막 속삭임)
    noel_scream: { pri: 8, cool: 20000, vol: 0.95 },
    noel_plea1: { pri: 8, cool: 20000, vol: 0.92 },
    noel_plea2: { pri: 8, cool: 20000, vol: 0.94 },
    noel_plea3: { pri: 8, cool: 20000, vol: 0.94 },
    noel_farewell: { pri: 8, cool: 20000, vol: 0.86 },
    snowball_atk: { pri: 2, cool: 3600, vol: 0.6 },
    snowball_hit: { pri: 1, cool: 4200, vol: 0.52 },
    mimic_atk: { pri: 2, cool: 3800, vol: 0.6 },
    mimic_hit: { pri: 1, cool: 4200, vol: 0.52 },
    rudolph_atk: { pri: 2, cool: 4200, vol: 0.62 },
    rudolph_hit: { pri: 1, cool: 4600, vol: 0.52 },
    boss_roar: { pri: 3, cool: 6000, vol: 0.7 },
    kael_atk: { pri: 1, cool: 3400, vol: 0.6 },
    kael_skill: { pri: 2, cool: 2500, vol: 0.68 },
    lia_ult: { pri: 2, cool: 2500, vol: 0.7 },
    ara_support: { pri: 2, cool: 2500, vol: 0.68 },
    born_support: { pri: 2, cool: 2500, vol: 0.68 },
    sena_support: { pri: 2, cool: 2500, vol: 0.68 },
  };
  Sfx.VOICE = VOICE;
  Sfx._vAct = [];          // 재생 중인 채널 [{ name, audio, pri }]
  Sfx._vLast = {};         // 이름별 마지막 재생 시각(ms)
  Sfx._vCount = {};        // 이름별 재생 횟수(검증용)
  Sfx._vLog = [];          // 최근 재생 기록(검증용, 최대 40개)
  Sfx.voiceMax = 2;        // 동시 채널 상한
  Sfx.voiceDuck = 0.16;    // 보이스 재생 중 BGM 볼륨

  Sfx._voiceClean = function () {
    this._vAct = this._vAct.filter((v) => v && !v.done);
    return this._vAct.length;
  };

  Sfx._stopVoice = function (v) {
    if (!v || v.done) return;
    v.done = true;
    try { v.audio.pause(); } catch (_) {}
    try { v.audio.currentTime = 0; } catch (_) {}
  };

  Sfx._unduck = function () {
    this._voiceClean();
    if (this._vAct.length) return;
    if (this.bgm && !this.muted) this.bgm.volume = this.bgmHold != null ? this.bgmHold : this.bgmVolume;
  };

  /* Step 11-3 — 엔딩에서 BGM 을 서서히 잠재운다(0 이면 완전 정지) */
  Sfx.bgmHold = null;
  Sfx.fadeBgmTo = function (to, dur) {
    const a = this.bgm;
    const secs = Math.max(0.15, dur || 1.2);
    if (this._bgmFadeT) { clearInterval(this._bgmFadeT); this._bgmFadeT = null; }
    if (!a) { this.bgmHold = to; return; }
    const from = a.volume || 0;
    const steps = Math.max(1, Math.round(secs * 20));
    let i = 0;
    this.bgmHold = to;
    this._bgmFadeT = setInterval(() => {
      i += 1;
      const p = Math.min(1, i / steps);
      const v = from + (to - from) * p;
      try { a.volume = Math.max(0, Math.min(1, v)); } catch (_) {}
      if (p >= 1) {
        clearInterval(this._bgmFadeT);
        this._bgmFadeT = null;
        if (to <= 0.001) { try { a.pause(); } catch (_) {} this.bgmStarted = false; }
      }
    }, 50);
  };

  /* Step 11-3 — 바람 소리(모래가 흩날리는 구간) */
  Sfx.wind = function (power) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const pw = Math.max(0.2, Math.min(1.6, power == null ? 1 : power));
    const n = ctx.createBufferSource();
    n.buffer = this._noiseBuf;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(380, t);
    bp.frequency.exponentialRampToValueAtTime(1350, t + 1.3);
    bp.frequency.exponentialRampToValueAtTime(620, t + 3.0);
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15 * pw, t + 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 3.2);
  };

  Sfx.stopAllVoices = function () {
    this._vAct.forEach((v) => this._stopVoice(v));
    this._vAct.length = 0;
    if (this.bgm && !this.muted) this.bgm.volume = this.bgmVolume;
  };

  Sfx.voiceInfo = function () {
    return {
      muted: this.muted, max: this.voiceMax, active: this._voiceClean(),
      activeNames: this._vAct.map((v) => v.name),
      count: Object.assign({}, this._vCount),
      last: Object.assign({}, this._vLast),
      log: this._vLog.slice(-16),
    };
  };

  /* 음소거 토글 — 켜는 순간 재생 중인 보이스도 함께 멈춘다 */
  const _toggleMute = Sfx.toggleMute.bind(Sfx);
  Sfx.toggleMute = function () {
    const m = _toggleMute();
    if (m) this.stopAllVoices();
    return m;
  };

  /* 이름별 오디오 1개를 재사용한다 — 매 재생마다 새 Audio 를 만들면 해제가 늦어져 무거워진다 */
  Sfx._voiceAudio = function (name) {
    if (!this._pool) this._pool = {};
    let a = this._pool[name];
    if (!a) {
      try { a = new Audio('audio/' + name + '.mp3'); } catch (_) { return null; }
      a.preload = 'auto';
      this._pool[name] = a;
    }
    return a;
  };

  /* 보이스 재생 — 파일이 없거나 재생에 실패해도 게임은 멈추지 않는다 */
  Sfx.playVoice = function (name, opts) {
    if (!name || !/^[a-z0-9_]+$/i.test(name)) return false;
    if (this.muted) return false;
    const o = opts || {};
    const spec = VOICE[name] || {};
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const last = this._vLast[name] || -1e9;
    if (now - last < (o.min != null ? o.min : (spec.cool || 900))) return false;
    if (o.chance !== undefined && Math.random() > o.chance) return false;
    const pri = o.pri != null ? o.pri : (spec.pri || 1);

    this._voiceClean();
    const max = o.maxCh || this.voiceMax;
    if (this._vAct.length >= max) {
      let low = null;
      this._vAct.forEach((v) => { if (!low || v.pri < low.pri) low = v; });
      if (!low || low.pri >= pri) { this._vLog.push({ name, skip: 'full' }); return false; }
      this._stopVoice(low);
      this._voiceClean();
    }

    const audio = this._voiceAudio(name);
    if (!audio) return false;
    try { audio.currentTime = 0; } catch (_) {}
    audio.volume = o.vol != null ? o.vol : (spec.vol || 0.72);
    if (o.rate) audio.playbackRate = o.rate;
    const ch = { name, audio, pri, done: false };
    audio._ch = ch;
    this._vAct.push(ch);
    this._vLast[name] = now;
    this._vCount[name] = (this._vCount[name] || 0) + 1;
    if (this._vLog.length > 60) this._vLog.shift();
    this._vLog.push({ name, pri, t: +(now / 1000).toFixed(2) });
    const p = audio.play();
    if (p && p.catch) p.catch(() => { ch.done = true; this._unduck(); });
    // 캐시된 오디오는 ended/error 리스너를 한 번만 단다
    if (!audio._bound) {
      audio._bound = true;
      audio.addEventListener('ended', () => { if (audio._ch) audio._ch.done = true; Sfx._unduck(); });
      audio.addEventListener('error', () => { if (audio._ch) audio._ch.done = true; Sfx._unduck(); });
    }
    if (this.bgm && !this.bgm.paused) this.bgm.volume = this.voiceDuck;
    return true;
  };
})();
