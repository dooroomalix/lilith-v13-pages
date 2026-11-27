/* assets.js : 이미지 로딩 + 스프라이트 시트 애니메이션 + 절차적 텍스처(그림자/할로/안개/빛줄기 등) */
(function () {
  const IMAGES = {
    bg: 'assets/bg_gate.webp',
    bgXmas: 'assets/bg_xmas.webp',
    portraitNoel: 'assets/portrait_noel.webp',
    portraitNoelDamaged: 'assets/portrait_noel_damaged.webp',
    portraitKael: 'assets/portrait_kael.webp',
    portraitLia: 'assets/portrait_lia.webp',
    portraitBoss: 'assets/portrait_boss.webp',
    portraitAra: 'assets/portrait_ara.webp',
    portraitBorn: 'assets/portrait_born.webp',
    portraitSena: 'assets/portrait_sena.webp',
    scout: 'assets/mon_scout.webp',
    boss: 'assets/boss.webp',
    // Step 11-3 : 최종 격파 시네마틱 — 쓰러진 노엘(손 분리) · 마지막에 남는 손
    noelFallen: 'assets/ending/noel_fallen.webp',
    noelHand: 'assets/ending/noel_hand.webp',
    noelHandHold: 'assets/ending/noel_hand_hold.webp',
  };

  // 첫 화면에 바로 필요한 것만 먼저 받는다 (대기·걷기·달리기·1타·리아)
  const ANIM_CRITICAL = ['idle', 'walk', 'run', 'atk1', 'lia'];
  // 나머지는 인트로가 뜬 뒤 백그라운드로 (모바일 첫 로딩 경량화)
  const ANIM_LAZY = ['atk2', 'atk3', 'dodge', 'hurt', 'scout_atk', 'boss_atk'];

  const A = {
    tex: {},
    anim: {},
    animMeta: null,
    sd: {},
    seq: {},
    total: 0,
    loaded: 0,
    _imgCache: {},
    _pending: {},

    async load(onProgress) {
      const prog = onProgress || (() => {});
      this.total = Object.keys(IMAGES).length + 6 + ANIM_CRITICAL.length + 1;
      const jobs = Object.entries(IMAGES).map(([key, path]) => this._loadOne(key, path, prog));
      jobs.push(this._loadMeta(prog));
      await Promise.all(jobs);
      await Promise.all(ANIM_CRITICAL.map((k) => this._loadAnim(k, prog)));
      await this._loadSDMeta('assets/sd/meta.json');
      // 외전 전용 SD(적 3종·보스 노엘) — 본편 메타는 건드리지 않는다
      await this._loadSDMeta('assets/sd/meta_xmas.json');

      const gen = {
        glow: () => this._glowTex(),
        soft: () => this._softDotTex(),
        fog: () => this._fogTex(),
        vignette: () => this._vignetteTex(),
        streak: () => this._streakTex(),
        ring: () => this._ringTex(),
        shadow: () => this._shadowTex(),
        halo: () => this._haloTex(),
        mist: () => this._mistTex(),
        spark: () => this._sparkTex(),
        shard: () => this._shardTex(),
        beam: () => this._beamTex(),
      };
      for (const [key, fn] of Object.entries(gen)) {
        this.tex[key] = fn();
        this.loaded++;
        prog(this.loaded / this.total);
      }
      return this.tex;
    },

    /* SD 메타 한 벌을 읽어 sd[]에 등록 (본편 meta.json / 외전 meta_xmas.json 공용) */
    async _loadSDMeta(url) {
      try {
        const meta = await (await fetch(url)).json();
        await Promise.all(Object.entries(meta).map(async ([key, info]) => {
          try {
            const img = await this._img(info.file);
            const base = PIXI.Texture.from(img);
            base.source.scaleMode = 'linear';
            base.source.autoGarbageCollect = false;
            if (info.frames) {
              // 가로 N칸 시퀀스 시트 → 프레임별 서브 텍스처
              const frames = [];
              for (let i = 0; i < info.frames; i++) {
                frames.push(new PIXI.Texture({
                  source: base.source,
                  frame: new PIXI.Rectangle(i * info.frameW, 0, info.frameW, info.frameH),
                }));
              }
              const short = key.replace(/_sd_seq$/, '');
              this.seq[short] = {
                key, frames, ax: info.anchorX, ay: info.anchorY,
                w: info.frameW, h: info.frameH, bodyH: info.bodyH || info.frameH,
                fps: info.fps || 7, strike: info.strike || 3,
              };
              this.sd[key] = { texture: frames[0], ax: info.anchorX, ay: info.anchorY,
                h: info.frameH, w: info.frameW, bodyH: info.bodyH || info.frameH };
            } else {
              this.sd[key] = { texture: base, ax: info.anchorX, ay: info.anchorY, h: info.h, w: info.w,
                bodyH: info.bodyH || info.h, bodyPx: info.bodyPx || 0 };
            }
          } catch (_) { /* optional SD art: keep original sprites/Graphics fallback */ }
        }));
      } catch (_) { /* optional SD metadata */ }
    },

    /* 보스/몬스터 추가 프레임은 첫 화면이 뜬 뒤 비동기로 */
    async loadLazy() {
      for (const k of ANIM_LAZY) {
        try { await this._loadAnim(k, () => {}); } catch (e) { console.warn('lazy anim', k, e.message); }
      }
    },

    /* 아직 안 받은 동작을 쓰려 할 때: 지금 있는 프레임으로 버티고 뒤에서 받는다 */
    ensureAnim(key) {
      if (this.anim[key] || !this.animMeta || this._pending[key]) return null;
      this._pending[key] = true;
      this._loadAnim(key, () => {}).catch(() => {}).then(() => { this._pending[key] = false; });
      return null;
    },

    async _loadMeta(prog) {
      const res = await fetch('assets/anim/meta.json', { cache: 'no-cache' });
      this.animMeta = await res.json();
      this.loaded++;
      prog(this.loaded / this.total);
    },

    /* 버전 쿼리: 배포 후 CDN/브라우저에 옛 이미지가 남지 않게 */
    _v(path) {
      const v = (window.G && (G.ASSET_V || G.VERSION)) || 'v0';
      return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(v);
    },

    _img(path) {
      path = this._v(path);
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
      base.source.autoGarbageCollect = false;
      const entry = {
        key, fps: m.fps, loop: m.loop, file: m.file,
        frames: [], ax: m.anchorX, ay: m.anchorY,
        fw: m.frameW, fh: m.frameH, count: m.frames,
        pxBodyH: m.pxBodyH || this.animMeta.bodyH,
        bob: m.bob || null, contacts: m.contacts || null, atkScale: m.atkScale || 1,
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
        entry.pxBodyH = m.h;
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
        t.source.autoGarbageCollect = false;
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

    /* 캐릭터 발밑 접지 그림자 — 타원 소프트 (중심 진하게, 가장자리 0) */
    _shadowTex() {
      const w = 256, h = 128;
      const c = this._canvas(w, h);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.35, 'rgba(0,0,0,0.72)');
      g.addColorStop(0.62, 'rgba(0,0,0,0.30)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.setTransform(1, 0, 0, h / w, 0, (h - h) / 2);
      x.fillStyle = g;
      x.fillRect(0, 0, w, w);
      return PIXI.Texture.from(c);
    },

    /* 발밑 환경광 — 바닥이 캐릭터 빛을 받는 느낌 */
    _haloTex() {
      const w = 256, h = 128;
      const c = this._canvas(w, h);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.42, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.78, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.setTransform(1, 0, 0, h / w, 0, 0);
      x.fillStyle = g;
      x.fillRect(0, 0, w, w);
      return PIXI.Texture.from(c);
    },

    /* 낮게 깔리는 안개 띠 */
    _mistTex() {
      const w = 768, h = 256;
      const c = this._canvas(w, h);
      const x = c.getContext('2d');
      for (let i = 0; i < 44; i++) {
        const px = G.rand(w * 1.0, 0);
        const py = h * 0.55 + G.rand(h * 0.3, -h * 0.3);
        const rx = G.rand(230, 70);
        const ry = rx * G.rand(0.22, 0.09);
        const a = G.rand(0.10, 0.025);
        const g = x.createRadialGradient(px, py, 0, px, py, rx);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.save();
        x.translate(px, py);
        x.scale(1, ry / rx);
        x.translate(-px, -py);
        x.fillStyle = g;
        x.beginPath();
        x.arc(px, py, rx, 0, G.TAU);
        x.fill();
        x.restore();
      }
      return PIXI.Texture.from(c);
    },

    /* 네 갈래 스파크 (타격 섬광) */
    _sparkTex() {
      const s = 128;
      const c = this._canvas(s, s);
      const x = c.getContext('2d');
      x.translate(s / 2, s / 2);
      const star = (r1, r2, w, a) => {
        x.beginPath();
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * G.TAU;
          const nx = Math.cos(ang + Math.PI / 4), ny = Math.sin(ang + Math.PI / 4);
          x.moveTo(0, 0);
          x.lineTo(nx * w, ny * w);
          x.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
          x.lineTo(-nx * w, -ny * w);
          x.closePath();
        }
        x.fillStyle = `rgba(255,255,255,${a})`;
        x.fill();
        x.beginPath();
        x.arc(0, 0, r2, 0, G.TAU);
        x.fill();
      };
      star(s * 0.48, s * 0.16, s * 0.045, 0.95);
      star(s * 0.30, s * 0.10, s * 0.02, 0.8);
      return PIXI.Texture.from(c);
    },

    /* 파편 조각 */
    _shardTex() {
      const s = 32;
      const c = this._canvas(s, s);
      const x = c.getContext('2d');
      x.beginPath();
      x.moveTo(s * 0.5, 0);
      x.lineTo(s * 0.92, s * 0.62);
      x.lineTo(s * 0.42, s);
      x.lineTo(s * 0.08, s * 0.55);
      x.closePath();
      const g = x.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0.35)');
      x.fillStyle = g;
      x.fill();
      return PIXI.Texture.from(c);
    },

    /* 성문에서 내려오는 빛줄기 (부드러운 사다리꼴) */
    _beamTex() {
      const w = 256, h = 512;
      const c = this._canvas(w, h);
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.26)');
      g.addColorStop(0.75, 'rgba(255,255,255,0.08)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(w * 0.34, 0);
      x.lineTo(w * 0.66, 0);
      x.lineTo(w * 1.0, h);
      x.lineTo(w * 0.0, h);
      x.closePath();
      x.fill();
      // 좌우 페더
      const side = x.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, 'rgba(0,0,0,0)');
      side.addColorStop(0.5, 'rgba(255,255,255,0.10)');
      side.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalCompositeOperation = 'lighter';
      x.fillStyle = side;
      x.fillRect(0, 0, w, h);
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
