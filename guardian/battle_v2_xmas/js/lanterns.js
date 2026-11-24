/* lanterns.js : 성문 광장 등불 4개 — 소등(암흑 바람·노엘의 공격) & 카엘 재점화
 * - 켜진 등불 수에 따라 '빛의 온기' 버프(공격력·회복 소폭 상승)
 * - 전부 꺼지면 '한기' 디버프(화면 가장자리 서리·어두워짐 + 받는 피해 증가)
 * 화면 연출(서리)은 캔버스로 그린 로컬 텍스처만 쓴다 — 원격 요청 없음.
 */
(function () {
  /* 화면 가장자리가 얼고 어두워지는 텍스처 */
  function frostTexture() {
    const c = document.createElement('canvas');
    c.width = G.W; c.height = G.H;
    const x = c.getContext('2d');
    const dark = x.createRadialGradient(G.W / 2, G.H / 2, 220, G.W / 2, G.H / 2, 780);
    dark.addColorStop(0, 'rgba(2,6,14,0)');
    dark.addColorStop(0.55, 'rgba(2,6,14,0.06)');
    dark.addColorStop(0.82, 'rgba(3,8,18,0.34)');
    dark.addColorStop(1, 'rgba(2,5,12,0.66)');
    x.fillStyle = dark;
    x.fillRect(0, 0, G.W, G.H);

    const ice = x.createRadialGradient(G.W / 2, G.H / 2, 300, G.W / 2, G.H / 2, 760);
    ice.addColorStop(0, 'rgba(170,215,255,0)');
    ice.addColorStop(0.68, 'rgba(170,215,255,0.05)');
    ice.addColorStop(0.88, 'rgba(196,232,255,0.20)');
    ice.addColorStop(1, 'rgba(228,246,255,0.44)');
    x.fillStyle = ice;
    x.fillRect(0, 0, G.W, G.H);

    let seed = 7717;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 210; i++) {
      let bx, by;
      const edge = i % 4;
      if (edge === 0) { bx = rnd() * G.W; by = rnd() * 120; }
      else if (edge === 1) { bx = rnd() * G.W; by = G.H - rnd() * 130; }
      else if (edge === 2) { bx = rnd() * 120; by = rnd() * G.H; }
      else { bx = G.W - rnd() * 120; by = rnd() * G.H; }
      x.strokeStyle = 'rgba(224,246,255,' + (0.07 + rnd() * 0.30).toFixed(3) + ')';
      x.lineWidth = 0.7 + rnd() * 1.7;
      x.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = rnd() * Math.PI * 2;
        const r = 10 + rnd() * 74;
        x.moveTo(bx, by);
        x.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.62);
        bx += Math.cos(a) * r * 0.46;
        by += Math.sin(a) * r * 0.28;
      }
      x.stroke();
    }
    return PIXI.Texture.from(c);
  }

  class Lanterns {
    constructor(game) {
      this.game = game;
      this.scene = game.scene;
      this.cfg = G.Xmas.lanterns;
      this.layer = this.scene.lanternLayer || this.scene.actorLayer;
      this.items = [];
      this.windClock = 9.5;
      this.proxIdx = -1;
      this.proxT = 0;
      this.chill = false;
      this.log = [];          // 검증용: 소등/재점화 기록
      this._build();
      this._buildFrost();
    }

    /* ---------------- 구성 ---------------- */
    _build() {
      const tex = G.Assets.tex;
      const amber = 0xffc46a;
      this.cfg.spots.forEach((spot, i) => {
        const c = new PIXI.Container();
        c.x = spot.x; c.y = spot.y; c.zIndex = spot.y;

        const pool = new PIXI.Sprite(tex.glow);
        pool.anchor.set(0.5);
        pool.y = -2;
        pool.width = 340; pool.height = 128;
        pool.tint = amber;
        pool.blendMode = 'add';
        pool.alpha = 0.16;
        c.addChild(pool);

        const glow = new PIXI.Sprite(tex.glow);
        glow.anchor.set(0.5);
        glow.y = -146;
        glow.width = 230; glow.height = 230;
        glow.tint = amber;
        glow.blendMode = 'add';
        glow.alpha = 0.32;
        c.addChild(glow);

        const pole = new PIXI.Graphics();
        pole.ellipse(0, -1, 27, 10).fill({ color: 0x141a26, alpha: 0.85 });
        pole.roundRect(-5, -112, 10, 110, 4).fill({ color: 0x2a2334, alpha: 1 });
        pole.roundRect(-5, -112, 3.4, 110, 2).fill({ color: 0x4c405c, alpha: 0.7 });
        pole.roundRect(-19, -122, 38, 8, 3).fill({ color: 0x2a2334 });
        pole.poly([-27, -174, 0, -190, 27, -174]).fill({ color: 0x352943 });
        pole.roundRect(-21, -176, 42, 58, 8).fill({ color: 0x1e1828 });
        c.addChild(pole);

        const glass = new PIXI.Graphics();
        c.addChild(glass);

        const ring = new PIXI.Graphics();
        ring.y = -1;
        ring.circle(0, 0, 62).stroke({ width: 2.4, color: 0xffe6a8, alpha: 0.9 });
        ring.circle(0, 0, 74).stroke({ width: 1.2, color: 0xffffff, alpha: 0.4 });
        ring.alpha = 0;
        c.addChild(ring);

        this.layer.addChild(c);
        const item = {
          i, x: spot.x, y: spot.y, lit: true, c, glass, glow, pool, ring,
          ph: G.rand(G.TAU), smokeT: G.rand(1.4, 0.2), glowA: 0.32, poolA: 0.16,
        };
        this.items.push(item);
        this._paint(item);
      });
    }

    _buildFrost() {
      this.frost = new PIXI.Sprite(frostTexture());
      this.frost.width = G.W; this.frost.height = G.H;
      this.frost.zIndex = 6;
      this.frost.alpha = 0;
      this.game.root.addChild(this.frost);
    }

    _paint(it) {
      const g = it.glass;
      g.clear();
      if (it.lit) {
        g.roundRect(-15, -168, 30, 42, 6).fill({ color: 0xffe9b0, alpha: 0.96 });
        g.roundRect(-11, -164, 22, 34, 5).fill({ color: 0xfffdf0, alpha: 0.95 });
        g.rect(-15, -149, 30, 2.4).fill({ color: 0x6b4a1c, alpha: 0.75 });
        g.rect(-1.2, -168, 2.4, 42).fill({ color: 0x6b4a1c, alpha: 0.6 });
        g.roundRect(-15, -168, 30, 42, 6).stroke({ width: 1.6, color: 0xfff3cf, alpha: 0.85 });
      } else {
        g.roundRect(-15, -168, 30, 42, 6).fill({ color: 0x0d1522, alpha: 0.94 });
        g.roundRect(-11, -164, 22, 34, 5).fill({ color: 0x121d2c, alpha: 0.9 });
        g.roundRect(-15, -168, 30, 42, 6).stroke({ width: 1.4, color: 0x5a86b8, alpha: 0.55 });
      }
    }

    /* ---------------- 상태 ---------------- */
    litCount() {
      let n = 0;
      for (const it of this.items) if (it.lit) n++;
      return n;
    }

    allOut() { return this.litCount() === 0; }

    dmgMul() { return 1 + this.cfg.buffPerLantern * this.litCount(); }

    regenPerSec() {
      const n = this.litCount();
      return n >= 2 ? this.cfg.regenPerLantern * n * 0.5 : 0;
    }

    dmgTakenMul() { return this.allOut() ? this.cfg.chillDmgTaken : 1; }

    nearestUnlit(x, y) {
      let best = null, bd = 1e9;
      for (const it of this.items) {
        if (it.lit) continue;
        const d = Math.abs(it.x - x) + Math.abs(it.y - y) * 0.6;
        if (d < bd) { bd = d; best = it; }
      }
      return best;
    }

    itemAt(x, y) {
      for (const it of this.items) {
        if (Math.abs(it.x - x) <= this.cfg.relightRadius && Math.abs(it.y - y) <= this.cfg.relightDepth) return it;
      }
      return null;
    }

    /* ---------------- 소등 ---------------- */
    extinguish(idx, cause) {
      const it = this.items[idx];
      if (!it || !it.lit) return false;
      it.lit = false;
      this._paint(it);
      const g = this.game;
      g.fx.ring(it.x, it.y - 150, 0x9fc8ff, 150, 0.5, 5, 0.5);
      g.fx.debris(it.x, it.y - 6, 8, 0x9fb8d8, 1.0);
      g.fx.sparkBurst(it.x, it.y - 150, 0x6f9fd8, 22, 320);
      g.fx._particle(it.x, it.y - 150, {
        color: 0x8fa8c8, size: 70, vx: 0, vy: -30, life: 1.1, additive: true,
      });
      g.scene.shake(5, 0.24);
      this.log.push({ t: +g.time.toFixed(2), ev: 'out', idx, cause: cause || 'wind', lit: this.litCount() });
      if (this.allOut()) this._setChill(true);
      return true;
    }

    extinguishNear(x, y) {
      let best = -1, bd = 1e9;
      this.items.forEach((it, i) => {
        if (!it.lit) return;
        const d = Math.abs(it.x - x) + Math.abs(it.y - y) * 0.7;
        if (d < bd) { bd = d; best = i; }
      });
      if (best < 0) return false;
      return this.extinguish(best, 'boss');
    }

    extinguishRandom(cause) {
      const lit = this.items.filter((it) => it.lit);
      if (!lit.length) return false;
      return this.extinguish(G.choice(lit).i, cause || 'wind');
    }

    /* ---------------- 재점화 ---------------- */
    relight(idx) {
      const it = this.items[idx];
      if (!it || it.lit) return false;
      it.lit = true;
      this._paint(it);
      const g = this.game;
      g.fx.ring(it.x, it.y - 150, 0xffd166, 170, 0.55, 6, 0.7);
      g.fx.ring(it.x, it.y - 150, 0xfff6d0, 96, 0.4, 4, 0.6);
      g.fx.sparkBurst(it.x, it.y - 150, 0xffe0a0, 26, 380);
      g.fx.sparkBurst(it.x, it.y - 60, 0xffc46a, 14, 220);
      g.scene.shake(3, 0.16);
      this.log.push({ t: +g.time.toFixed(2), ev: 'lit', idx, cause: 'kael', lit: this.litCount() });
      if (this.chill && !this.allOut()) this._setChill(false);
      return true;
    }

    /* 카엘이 꺼진 등불 근처에서 공격하면 재점화 */
    tryRelight(x, y, heavy) {
      const it = this.itemAt(x, y);
      if (!it || it.lit) return false;
      if (heavy) {
        // 3타(강타)는 범위가 넓어 근처 등불 하나를 더 살린다
        const other = this.nearestUnlit(x + (it.x >= x ? 120 : -120), y);
        if (other && other !== it && Math.abs(other.x - it.x) < 190 && !other.lit) this.relight(other.i);
      }
      return this.relight(it.i);
    }

    relightAll() {
      this.items.forEach((it) => { it.lit = true; this._paint(it); });
      if (this.chill) this._setChill(false);
    }

    _setChill(on) {
      if (this.chill === on) return;
      this.chill = on;
      const g = this.game;
      if (on) {
        g.fx.popText(640, 250, '한기 · 받는 피해 증가', { color: 0xa8d8ff, size: 30, dur: 2.0, stroke: 0x0a1c30 });
        g.scene.shake(8, 0.4);
        g.flashImpact(0.22, 0x6f9fd8);
        if (g.onChill) g.onChill(true);
      } else {
        g.fx.popText(640, 250, '빛의 온기 회복', { color: 0xffe0a0, size: 26, dur: 1.4, stroke: 0x2a1a04 });
        if (g.onChill) g.onChill(false);
      }
    }

    /* ---------------- 주기 ---------------- */
    _darkWind() {
      const g = this.game;
      const ph = g.boss && g.boss.alive ? g.boss.phaseIdx : 0;
      this.windClock = G.rand(this.cfg.windInterval[0], this.cfg.windInterval[1]) * Math.pow(this.cfg.windPhaseStep, ph);
      const before = this.litCount();
      if (!before) return;
      const it = this.extinguishRandom('wind');
      if (it) {
        g.showPrompt('암흑 바람 · 등불이 꺼진다', 0x9fd8ff, 1.3);
        for (let i = 0; i < 3; i++) {
          g.fx.speedLines(G.rand(1100, 200), G.rand(520, 220), -1, 8, 0.9);
        }
        if (g.dialogueLine) g.dialogueLine('노엘', this.litCount() === 0 ? G.Xmas.noel.allOut : G.Xmas.noel.lanternOut, 2.6);
      }
    }

    update(dt) {
      const g = this.game;
      const t = g.time;
      for (const it of this.items) {
        const flick = 0.5 + 0.5 * Math.sin(t * 2.6 + it.ph);
        const wantGlow = it.lit ? 0.26 + 0.16 * flick : 0;
        const wantPool = it.lit ? 0.12 + 0.07 * flick : 0;
        it.glowA = G.lerp(it.glowA, wantGlow, 1 - Math.pow(0.001, dt));
        it.poolA = G.lerp(it.poolA, wantPool, 1 - Math.pow(0.001, dt));
        it.glow.alpha = it.glowA;
        it.pool.alpha = it.poolA;
        if (!it.lit) {
          it.smokeT -= dt;
          if (it.smokeT <= 0) {
            it.smokeT = G.rand(1.5, 0.5);
            g.fx._particle(it.x + G.rand(8, -8), it.y - 178, {
              color: 0x8fa8c8, size: G.rand(26, 10), vx: G.rand(14, -14), vy: -G.rand(34, 12),
              life: 1.2, additive: true,
            });
          }
        }
      }

      // 꺼진 등불 근처 안내 링 + 자동 재점화
      const near = this.nearestUnlit(g.kael.x, g.kael.y);
      const inReach = near && Math.abs(near.x - g.kael.x) <= this.cfg.relightRadius
        && Math.abs(near.y - g.kael.y) <= this.cfg.relightDepth;
      this.items.forEach((it) => {
        it.ring.alpha = (!it.lit && inReach && it === near) ? 0.45 + 0.35 * Math.sin(t * 6) : 0;
      });
      if (inReach && g.phase !== 'victory' && g.phase !== 'defeat' && g.kael.state !== 'dead') {
        if (this.proxIdx === near.i) this.proxT += dt;
        else { this.proxIdx = near.i; this.proxT = 0; }
        if (this.proxT >= this.cfg.proximityTime) {
          this.proxT = 0;
          this.relight(near.i);
          g.showPrompt('등불 점화', 0xffd166, 1.0);
        }
      } else {
        this.proxIdx = -1; this.proxT = 0;
      }

      // 암흑 바람 주기
      if (g.phase === 'wave' || g.phase === 'boss') {
        this.windClock -= dt;
        if (this.windClock <= 0) this._darkWind();
      } else {
        this.windClock = Math.max(this.windClock, 3.5);
      }

      // 한기 연출
      const want = this.chill ? 0.92 : 0;
      this.frost.alpha = G.lerp(this.frost.alpha, want, 1 - Math.pow(0.02, dt));
      g.vignette.tint = this.chill ? 0xbcd8ff : 0xffffff;
      g.vignette.alpha = this.chill ? 0.5 : ((G.Xmas && G.Xmas.ON) ? 0.46 : 0.62);
    }

    reset() {
      this.items.forEach((it) => { it.lit = true; this._paint(it); it.glowA = 0.32; it.poolA = 0.16; });
      this.chill = false;
      this.proxIdx = -1;
      this.proxT = 0;
      this.windClock = 9.5;
      this.log.length = 0;
      if (this.frost) this.frost.alpha = 0;
      if (this.game.vignette) {
        this.game.vignette.tint = 0xffffff;
        this.game.vignette.alpha = (G.Xmas && G.Xmas.ON) ? 0.46 : 0.62;
      }
    }

    state() {
      return {
        lit: this.litCount(),
        total: this.items.length,
        litFlags: this.items.map((it) => it.lit),
        chill: this.chill,
        dmgMul: +this.dmgMul().toFixed(3),
        dmgTakenMul: +this.dmgTakenMul().toFixed(3),
        regen: +this.regenPerSec().toFixed(2),
        windClock: +this.windClock.toFixed(2),
      };
    }
  }

  G.Lanterns = Lanterns;
})();
