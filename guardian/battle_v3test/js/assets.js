/* assets.js : 이미지 로딩 + 스프라이트 시트 애니메이션 + 절차적 텍스처(글로우/안개/비네트 등) */
(function () {
  const IMAGES = {
    bg: 'assets/bg_gate.webp',
    kael: 'assets/kael.png',
    lia: 'assets/lia.png',
    portraitKael: 'assets/portrait_kael.png',
    portraitLia: 'assets/portrait_lia.png',
    scout: 'assets/mon_scout.png',
    boss: 'assets/boss.png',
  };

  // 전투 시작 전에 반드시 필요한 카엘 애니메이션
  const ANIM_CRITICAL = ['idle', 'run', 'atk1', 'atk2', 'atk3', 'dodge', 'hurt', 'lia'];
  // 보스/몬스터 추가 프레임은 시작 후 백그라운드로
  const ANIM_LAZY = ['scout_atk', 'boss_atk'];

  const A = {
    tex: {},
    anim: {},
    animMeta: null,
    total: 0,
    loaded: 0,
    _imgCache: {},

    async load(onProgress) {
      const prog = onProgress || (() => {});
      this.total = Object.keys(IMAGES).length + 6 + ANIM_CRITICAL.length + 1;
      const jobs = Object.entries(IMAGES).map(([key, path]) => this._loadOne(key, path, prog));
      jobs.push(this._loadMeta(prog));
      await Promise.all(jobs);
      await Promise.all(ANIM_CRITICAL.map((k) => this._loadAnim(k, prog)));

      const gen = {
        glow: () => this._glowTex(),
        soft: () => this._softDotTex(),
        fog: () => this._fogTex(),
        vignette: () => this._vignetteTex(),
        streak: () => this._streakTex(),
        ring: () => this._ringTex(),
      };
      for (const [key, fn] of Object.entries(gen)) {
        this.tex[key] = fn();
        this.loaded++;
        prog(this.loaded / this.total);
      }
      return this.tex;
    },

    /* 보스/몬스터 추가 프레임은 첫 화면이 뜬 뒤 비동기로 */
    async loadLazy() {
      for (const k of ANIM_LAZY) {
        try { await this._loadAnim(k, () => {}); } catch (e) { console.warn('lazy anim', k, e.message); }
      }
    },

    async _loadMeta(prog) {
      const res = await fetch('assets/anim/meta.json', { cache: 'no-cache' });
      this.animMeta = await res.json();
      this.loaded++;
      prog(this.loaded / this.total);
    },

    _img(path) {
      if (this._imgCache[path]) return this._imgCache[path];
      const p = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image load failed: ' + path));
        img.src = path;
      });
      this._imgCache[path] = p;
      return p;
    },

    async _loadAnim(key, prog) {
      if (this.anim[key]) return this.anim[key];
      const m = this.animMeta.anims[key];
      if (!m) return null;
      const img = await this._img(m.file);
      const base = PIXI.Texture.from(img);
      base.source.scaleMode = 'linear';
      const entry = {
        key, fps: m.fps, loop: m.loop, file: m.file,
        frames: [], ax: m.anchorX, ay: m.anchorY,
        fw: m.frameW, fh: m.frameH, count: m.frames,
      };
      if (m.frames > 1) {
        for (let i = 0; i < m.frames; i++) {
          entry.frames.push(new PIXI.Texture({
            source: base.source,
            frame: new PIXI.Rectangle(i * m.frameW, 0, m.frameW, m.frameH),
          }));
        }
      } else {
        entry.frames.push(base);
        entry.fw = m.w; entry.fh = m.h;
      }
      this.anim[key] = entry;
      this.loaded++;
      if (prog) prog(this.loaded / this.total);
      return entry;
    },

    _loadOne(key, path, onProgress) {
      return this._img(path).then((img) => {
        const t = PIXI.Texture.from(img);
        t.source.scaleMode = 'linear';
        this.tex[key] = t;
        this.loaded++;
        if (onProgress) onProgress(this.loaded / this.total);
        return t;
      });
    },

    _canvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    },

    _glowTex() {
      const s = 256;
      const c = this._canvas(s, s);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, s, s);
      return PIXI.Texture.from(c);
    },

    _softDotTex() {
      const s = 64;
      const c = this._canvas(s, s);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, s, s);
      return PIXI.Texture.from(c);
    },

    _fogTex() {
      const s = 512;
      const c = this._canvas(s, s);
      const x = c.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const px = G.rand(s * 0.9, s * 0.1);
        const py = s * 0.5 + G.rand(s * 0.28, -s * 0.28);
        const r = G.rand(150, 50);
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        const a = G.rand(0.13, 0.04);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.beginPath();
        x.arc(px, py, r, 0, G.TAU);
        x.fill();
      }
      return PIXI.Texture.from(c);
    },

    _vignetteTex() {
      const w = 1280, h = 720;
      const c = this._canvas(w, h);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(w / 2, h * 0.52, h * 0.22, w / 2, h * 0.52, h * 0.92);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.6, 'rgba(2,4,12,0.28)');
      g.addColorStop(1, 'rgba(2,4,12,0.82)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      return PIXI.Texture.from(c);
    },

    _streakTex() {
      const w = 128, h = 512;
      const c = this._canvas(w, h);
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(180,220,255,0.55)');
      g.addColorStop(0.45, 'rgba(150,200,255,0.20)');
      g.addColorStop(1, 'rgba(120,180,255,0)');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(w * 0.5, 0);
      x.lineTo(w * 0.92, h);
      x.lineTo(w * 0.6, h);
      x.lineTo(w * 0.34, 0);
      x.closePath();
      x.fill();
      const blur = x.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.5);
      blur.addColorStop(0, 'rgba(255,255,255,0.35)');
      blur.addColorStop(1, 'rgba(255,255,255,0)');
      x.globalCompositeOperation = 'lighter';
      x.fillStyle = blur;
      x.fillRect(0, 0, w, h);
      return PIXI.Texture.from(c);
    },

    _ringTex() {
      const s = 256;
      const c = this._canvas(s, s);
      const x = c.getContext('2d');
      const cx = s / 2;
      x.strokeStyle = 'rgba(255,255,255,0.95)';
      x.lineWidth = 7;
      x.beginPath();
      x.arc(cx, cx, s / 2 - 12, 0, G.TAU);
      x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.28)';
      x.lineWidth = 22;
      x.beginPath();
      x.arc(cx, cx, s / 2 - 16, 0, G.TAU);
      x.stroke();
      return PIXI.Texture.from(c);
    },
  };

  G.Assets = A;
})();
