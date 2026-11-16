/* assets.js : 이미지 로딩 + 절차적 텍스처(글로우/안개/비네트 등) 생성 */
(function () {
  const IMAGES = {
    bg: 'assets/bg_gate.png',
    kael: 'assets/kael.png',
    lia: 'assets/lia.png',
    portraitKael: 'assets/portrait_kael.png',
    portraitLia: 'assets/portrait_lia.png',
    scout: 'assets/mon_scout.png',
    boss: 'assets/boss.png',
  };

  const A = {
    tex: {},
    total: 0,
    loaded: 0,

    async load(onProgress) {
      this.total = Object.keys(IMAGES).length + 6;
      const jobs = Object.entries(IMAGES).map(([key, path]) => this._loadOne(key, path, onProgress));
      await Promise.all(jobs);

      const scene = onProgress || (() => {});
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
        scene(this.loaded / this.total);
      }
      return this.tex;
    },

    _loadOne(key, path, onProgress) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const t = PIXI.Texture.from(img);
          t.source.scaleMode = 'linear';
          this.tex[key] = t;
          this.loaded++;
          if (onProgress) onProgress(this.loaded / this.total);
          resolve(t);
        };
        img.onerror = () => reject(new Error('image load failed: ' + path));
        img.src = path;
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
