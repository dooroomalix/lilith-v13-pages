/* fx.js : 검기 슬래시, 히트 스파크, 데미지 숫자, 충격파, 파티클 */
(function () {
  const T = () => G.Assets.tex;

  class Fx {
    constructor(layer) {
      this.layer = layer;
      this.items = [];
      this.pool = [];
    }

    /* ---------- 파티클 ---------- */
    _particle(x, y, opts) {
      const o = Object.assign(
        { color: 0xffffff, size: 10, vx: 0, vy: 0, life: 0.5, grav: 0, drag: 0.9, additive: true, tex: 'soft', shrink: 1 },
        opts
      );
      const s = new PIXI.Sprite(T()[o.tex]);
      s.anchor.set(0.5);
      s.x = x; s.y = y;
      s.tint = o.color;
      s.width = o.size; s.height = o.size;
      s.alpha = 1;
      if (o.additive) s.blendMode = 'add';
      this.layer.addChild(s);
      const item = {
        obj: s, t: 0, life: o.life, vx: o.vx, vy: o.vy, grav: o.grav, drag: o.drag,
        size: o.size, shrink: o.shrink, flash: o.flash || 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / item.life;
          if (p >= 1) return false;
          s.x += item.vx * dt;
          s.y += item.vy * dt;
          item.vy += item.grav * dt;
          item.vx *= Math.pow(item.drag, dt * 60);
          item.vy *= Math.pow(item.drag, dt * 60);
          const k = 1 - p;
          const sc = item.size * (0.35 + 0.65 * k);
          s.width = sc; s.height = sc;
          s.alpha = Math.pow(k, 1.2);
          return true;
        },
      };
      this.items.push(item);
      return item;
    }

    sparkBurst(x, y, color = 0xffffff, count = 12, power = 420, dir = null) {
      for (let i = 0; i < count; i++) {
        const a = dir === null ? G.rand(G.TAU) : dir + G.rand(1.1, -1.1);
        const sp = power * G.rand(1.25, 0.35);
        this._particle(x, y, {
          color,
          size: G.rand(20, 8),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.8,
          life: G.rand(0.55, 0.24),
          grav: 620,
          drag: 0.9,
        });
      }
      // 밝은 코어
      this.impact(x, y, color, 1.0);
    }

    impact(x, y, color = 0xaad8ff, scale = 1) {
      const s = new PIXI.Sprite(T().glow);
      s.anchor.set(0.5);
      s.x = x; s.y = y;
      s.tint = color;
      s.blendMode = 'add';
      s.width = 30 * scale; s.height = 30 * scale;
      this.layer.addChild(s);
      const item = {
        obj: s, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / 0.22;
          if (p >= 1) return false;
          const sc = (32 + 130 * G.easeOutCubic(p)) * scale;
          s.width = sc; s.height = sc;
          s.alpha = (1 - p) * 0.8;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 검기 슬래시 ---------- */
    slash(x, y, opts = {}) {
      const o = Object.assign(
        { radius: 150, spread: 1.15, angle: -0.18, width: 22, color: 0x2f6bff, dir: 1, dur: 0.17, scale: 1 },
        opts
      );
      const g = new PIXI.Graphics();
      g.x = x; g.y = y;
      g.blendMode = 'add';
      g.rotation = o.angle;
      g.scale.set(o.scale * 0.9);
      this.layer.addChild(g);

      const a0 = -o.spread / 2;
      const a1 = o.spread / 2;
      const layer = (radius, width, color, alpha, spiral, taperPow) => {
        const N = 30;
        const pts = [];
        const edge = (sign, rev) => {
          for (let k = 0; k <= N; k++) {
            const t = rev ? 1 - k / N : k / N;
            const a = a0 + (a1 - a0) * t;
            const th = width * Math.pow(Math.sin(Math.PI * t), taperPow);
            const r = radius * (1 - spiral * t);
            pts.push([Math.cos(a) * (r + sign * th), Math.sin(a) * (r + sign * th)]);
          }
        };
        edge(1, false);
        edge(-1, true);
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
        g.fill({ color, alpha });
      };

      layer(o.radius * 1.03, o.width * 1.4, o.color, 0.14, 0.16, 1.8);
      layer(o.radius, o.width * 0.8, 0x8fd0ff, 0.32, 0.16, 2.1);
      layer(o.radius * 0.985, o.width * 0.24, 0xffffff, 0.75, 0.16, 2.4);

      const item = {
        obj: g, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / o.dur;
          if (p >= 1) return false;
          const e = G.easeOutCubic(p);
          g.scale.set(o.scale * (0.9 + 0.2 * e), o.scale * (0.95 + 0.08 * e));
          g.rotation = o.angle + 0.12 * o.dir * e;
          g.alpha = Math.pow(1 - p, 1.6);
          return true;
        },
      };
      this.items.push(item);

      // 잔검 파편
      for (let i = 0; i < 6; i++) {
        const t = G.rand(0.95, 0.15);
        const a = o.angle - o.spread / 2 + o.spread * t;
        const rr = o.radius * (1 - 0.18 * t);
        this._particle(x + Math.cos(a) * rr, y + Math.sin(a) * rr, {
          color: G.chance(0.5) ? 0xffffff : 0x7fc8ff,
          size: G.rand(20, 7),
          vx: Math.cos(a) * G.rand(320, 100),
          vy: Math.sin(a) * G.rand(320, 100),
          life: G.rand(0.34, 0.14),
          grav: 180,
        });
      }
    }

    /* ---------- 타격 버스트 (방사형 섬광) ---------- */
    burst(x, y, opts = {}) {
      const o = Object.assign(
        { color: 0xbfe4ff, core: 0xffffff, rays: 14, length: 140, width: 8, dur: 0.2, angle: null, spread: G.TAU },
        opts
      );
      const g = new PIXI.Graphics();
      g.x = x; g.y = y;
      g.blendMode = 'add';
      this.layer.addChild(g);
      const draw = () => {
        g.clear();
        for (let i = 0; i < o.rays; i++) {
          const base = o.angle === null ? (i / o.rays) * G.TAU : o.angle + G.rand(0.5, -0.5);
          const a = base + G.rand(0.12, -0.12);
          const len = o.length * G.rand(1.0, 0.45);
          const w = o.width * G.rand(1.0, 0.4);
          const dx = Math.cos(a), dy = Math.sin(a) * 0.72;
          g.poly([
            -dy * w * 0.5, dx * w * 0.5,
            dx * len, dy * len,
            dy * w * 0.5, -dx * w * 0.5,
          ]).fill({ color: G.chance(0.45) ? o.core : o.color, alpha: G.rand(0.9, 0.45) });
        }
        g.circle(0, 0, o.length * 0.1).fill({ color: o.core, alpha: 0.6 });
        g.circle(0, 0, o.length * 0.22).fill({ color: o.color, alpha: 0.16 });
      };
      draw();
      const item = {
        obj: g, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / o.dur;
          if (p >= 1) return false;
          const e = G.easeOutCubic(p);
          g.scale.set(0.55 + 0.85 * e, 0.55 + 0.85 * e);
          g.alpha = Math.pow(1 - p, 1.4);
          return true;
        },
      };
      this.items.push(item);
      this.impact(x, y, o.core, 0.32);
    }

    /* ---------- 데미지 숫자 ---------- */
    damage(x, y, value, opts = {}) {
      const o = Object.assign({ crit: false, color: null, size: 0, label: null, rise: 62 }, opts);
      const size = o.size || (o.crit ? 33 : 23);
      const color = o.color || (o.crit ? 0xffd75e : 0xffffff);
      const t = new PIXI.Text({
        text: String(Math.round(value)),
        style: {
          fontFamily: G.FONT_NUM,
          fontSize: size,
          fontWeight: '900',
          fill: color,
          stroke: { color: o.crit ? 0x45230a : 0x0a1c38, width: o.crit ? 7 : 6 },
          letterSpacing: 0.5,
        },
      });
      t.anchor.set(0.5, 1);
      this._dmgIdx = ((this._dmgIdx || 0) + 1) % 4;
      t.x = x + G.rand(64, -64) + (this._dmgIdx - 1.5) * 22;
      t.y = y - this._dmgIdx * 13 + G.rand(10, -10);
      t.scale.set(1.7);
      this.layer.addChild(t);

      const item = {
        obj: t, t2: 0,
        update: (dt) => {
          item.t2 += dt;
          const p = item.t2 / 0.95;
          if (p >= 1) return false;
          const e = G.easeOutCubic(Math.min(1, item.t2 / 0.18));
          t.y = y - o.rise * G.easeOutCubic(Math.min(1, item.t2 / 0.55));
          t.scale.set(1.7 - 0.7 * e);
          t.alpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 충격파 링 ---------- */
    ring(x, y, color = 0xffffff, radius = 220, dur = 0.42, width = 6) {
      const s = new PIXI.Sprite(T().ring);
      s.anchor.set(0.5);
      s.x = x; s.y = y;
      s.tint = color;
      s.blendMode = 'add';
      s.width = 40; s.height = 40;
      this.layer.addChild(s);
      const item = {
        obj: s, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / dur;
          if (p >= 1) return false;
          const r = radius * (0.25 + 0.85 * G.easeOutCubic(p));
          s.width = r * 2; s.height = r * 2;
          s.alpha = (1 - p) * 0.9;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 룬 원 (리아 마법) ---------- */
    rune(x, y, color = 0xa07bff, radius = 90, dur = 0.7) {
      const g = new PIXI.Graphics();
      g.x = x; g.y = y;
      g.blendMode = 'add';
      this.layer.addChild(g);
      const draw = (rot) => {
        g.clear();
        g.circle(0, 0, radius).stroke({ width: 2, color, alpha: 0.75 });
        g.circle(0, 0, radius * 0.72).stroke({ width: 1.2, color, alpha: 0.5 });
        for (let i = 0; i < 8; i++) {
          const a = rot + (i / 8) * G.TAU;
          const x1 = Math.cos(a) * radius * 0.72, y1 = Math.sin(a) * radius * 0.72;
          const x2 = Math.cos(a + 0.16) * radius, y2 = Math.sin(a + 0.16) * radius;
          g.moveTo(x1, y1).lineTo(x2, y2);
          g.moveTo(Math.cos(a) * radius * 0.72, Math.sin(a) * radius * 0.72);
          g.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
        }
        g.stroke({ width: 1.4, color, alpha: 0.6 });
      };
      draw(0);
      const item = {
        obj: g, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / dur;
          if (p >= 1) return false;
          draw(p * 3.4);
          g.scale.set(0.4 + 0.75 * G.easeOutCubic(p));
          g.alpha = 1 - p * 0.9;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 빛 기둥 (리아 스킬) ---------- */
    pillar(x, y, color = 0xbfe3ff, height = 460, dur = 0.7, width = 130) {
      const s = new PIXI.Sprite(T().streak);
      s.anchor.set(0.5, 1);
      s.x = x; s.y = y;
      s.tint = color;
      s.blendMode = 'add';
      s.width = width; s.height = height;
      this.layer.addChild(s);
      const item = {
        obj: s, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / dur;
          if (p >= 1) return false;
          s.height = height * (0.5 + 0.75 * G.easeOutCubic(Math.min(1, item.t / 0.16)));
          s.width = width * (1 - 0.35 * p);
          s.alpha = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 화면 자체 텍스트 (PERFECT 등) ---------- */
    popText(x, y, text, opts = {}) {
      const o = Object.assign({ color: 0xffffff, size: 40, dur: 0.9, stroke: 0x0a1c38 }, opts);
      const t = new PIXI.Text({
        text,
        style: {
          fontFamily: G.FONT,
          fontSize: o.size,
          fontWeight: '900',
          fill: o.color,
          stroke: { color: o.stroke, width: 7 },
          letterSpacing: 3,
        },
      });
      t.anchor.set(0.5);
      t.x = x; t.y = y;
      t.scale.set(0.5);
      this.layer.addChild(t);
      const item = {
        obj: t, t2: 0,
        update: (dt) => {
          item.t2 += dt;
          const p = item.t2 / o.dur;
          if (p >= 1) return false;
          t.scale.set(0.5 + 0.5 * G.easeOutBack(Math.min(1, item.t2 / 0.25)));
          t.y = y - 18 * G.easeOutCubic(Math.min(1, item.t2 / 0.6));
          t.alpha = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 검기 궤적 (블레이드 트레일) ---------- */
    trail(hero, cfg, idx = 0) {
      const dir = idx === 1 ? -1 : 1;
      const heavy = idx === 2;
      const g = new PIXI.Graphics();
      g.blendMode = 'add';
      g.x = hero.x + 64;
      g.y = hero.centerY;
      this.layer.addChild(g);
      const r0 = cfg.ang - dir * (heavy ? 0.85 : 0.6);
      const r1 = cfg.ang + dir * (heavy ? 0.95 : 0.65);
      const dur = heavy ? 0.3 : 0.22;
      const span = 0.95;

      const draw = (head, alpha) => {
        g.clear();
        const inner = heavy ? 96 : 82;
        const outer = heavy ? 244 : 200;
        const steps = 22;
        for (let s = 0; s < 3; s++) {
          const w = span * (1 - s * 0.24);
          const a1 = head - dir * w;
          const col = s === 0 ? (heavy ? 0x2f6bff : 0x3f7dff) : s === 1 ? 0x8fd0ff : 0xffffff;
          const al = (s === 0 ? 0.16 : s === 1 ? 0.3 : 0.55) * alpha;
          const ri = inner + s * 14;
          const ro = outer - s * 10;
          const pts = [];
          for (let i = 0; i <= steps; i++) {
            const a = a1 + (head - a1) * (i / steps);
            const k = i / steps;
            const rr = ro * (0.86 + 0.14 * k);
            pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.86]);
          }
          for (let i = steps; i >= 0; i--) {
            const a = a1 + (head - a1) * (i / steps);
            const k = i / steps;
            const rr = ri + (ro - ri) * 0.25 * k;
            pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.86]);
          }
          g.poly(pts).fill({ color: col, alpha: al });
        }
        // 선두 백색 섬광
        const hx = Math.cos(head) * outer;
        const hy = Math.sin(head) * outer * 0.86;
        g.circle(hx, hy, heavy ? 22 : 15).fill({ color: 0xffffff, alpha: 0.5 * alpha });
      };
      draw(r0, 1);

      const item = {
        obj: g, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / dur;
          if (p >= 1) return false;
          const head = G.lerp(r0, r1, G.easeOutCubic(Math.min(1, p * 1.6)));
          draw(head, Math.pow(1 - p, 1.3));
          g.alpha = Math.pow(1 - p, 1.1);
          g.scale.set(0.94 + 0.12 * p);
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 지면 충격(먼지·파편) ---------- */
    groundBurst(x, y) {
      this.ring(x, y - 4, 0x9fd6ff, 190, 0.42, 4);
      for (let i = 0; i < 16; i++) {
        const a = G.rand(0.35, -0.35) + (G.chance(0.5) ? 0 : Math.PI);
        const sp = G.rand(360, 120);
        this._particle(x + G.rand(40, -40), y - 2, {
          color: G.chance(0.5) ? 0x9fb8d8 : 0x6d86a8,
          size: G.rand(18, 6),
          vx: Math.cos(a) * sp,
          vy: -Math.abs(Math.sin(a)) * sp * 0.75,
          life: G.rand(0.5, 0.25),
          grav: 900,
          drag: 0.9,
        });
      }
    }

    /* ---------- 회피 잔상 ---------- */
    afterimage(unit, dur = 0.5) {
      const spawn = () => {
        const spr = unit.sprite;
        if (!spr) return;
        const s = new PIXI.Sprite(spr.texture);
        s.anchor.set(spr.anchor.x, spr.anchor.y);
        s.scale.set(spr.scale.x, spr.scale.y);
        s.x = unit.x + (spr.x || 0);
        s.y = unit.y + (spr.y || 0);
        s.tint = 0x7cc4ff;
        s.blendMode = 'add';
        s.alpha = 0.4;
        this.layer.addChild(s);
        const ghost = {
          obj: s, t: 0,
          update: (dt) => {
            ghost.t += dt;
            const p = ghost.t / 0.28;
            if (p >= 1) return false;
            s.alpha = 0.4 * (1 - p);
            s.y += 6 * dt;
            return true;
          },
        };
        this.items.push(ghost);
      };
      const item = {
        obj: null, t: 0, tick: 0,
        update: (dt) => {
          item.t += dt;
          if (item.t > dur) return false;
          item.tick -= dt;
          if (item.tick <= 0) {
            item.tick = 0.055;
            spawn();
          }
          return true;
        },
      };
      spawn();
      this.items.push(item);
    }

    update(dt) {
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        if (!it.update(dt)) {
          if (it.obj) it.obj.destroy();
          this.items.splice(i, 1);
        }
      }
    }

    clear() {
      this.items.forEach((it) => { if (it.obj) it.obj.destroy(); });
      this.items.length = 0;
    }
  }

  G.Fx = Fx;
})();
