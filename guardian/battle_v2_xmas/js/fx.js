/* fx.js : 애니/웹툰풍 검기·타격·충격파·먼지·파편·속도선 */
(function () {
  const T = () => G.Assets.tex;

  class Fx {
    constructor(layer) {
      this.layer = layer;
      this.items = [];
    }

    /* ---------- 파티클 ---------- */
    _particle(x, y, opts) {
      const o = Object.assign(
        { color: 0xffffff, size: 10, vx: 0, vy: 0, life: 0.5, grav: 0, drag: 0.9,
          additive: true, tex: 'soft', rot: 0, spin: 0, fade: 1.2 },
        opts
      );
      const s = new PIXI.Sprite(T()[o.tex]);
      s.anchor.set(0.5);
      s.x = x; s.y = y;
      s.tint = o.color;
      s.width = o.size; s.height = o.size;
      s.rotation = o.rot;
      s.alpha = 1;
      if (o.additive) s.blendMode = 'add';
      this.layer.addChild(s);
      const item = {
        obj: s, t: 0, life: o.life, vx: o.vx, vy: o.vy, grav: o.grav, drag: o.drag,
        size: o.size, spin: o.spin, fade: o.fade,
        update: (dt) => {
          item.t += dt;
          const p = item.t / item.life;
          if (p >= 1) return false;
          s.x += item.vx * dt;
          s.y += item.vy * dt;
          item.vy += item.grav * dt;
          const d = Math.pow(item.drag, dt * 60);
          item.vx *= d; item.vy *= d;
          if (item.spin) s.rotation += item.spin * dt;
          const k = 1 - p;
          const sc = item.size * (0.35 + 0.65 * k);
          s.width = sc; s.height = sc;
          s.alpha = Math.pow(k, item.fade);
          return true;
        },
      };
      this.items.push(item);
      return item;
    }

    /* ---------- 타격 스파크 (방향성) ---------- */
    sparkBurst(x, y, color = 0xffffff, count = 12, power = 420, dir = null) {
      for (let i = 0; i < count; i++) {
        const a = dir === null ? G.rand(G.TAU) : dir + G.rand(1.1, -1.1);
        const sp = power * G.rand(1.25, 0.35);
        this._particle(x, y, {
          color: G.chance(0.35) ? 0xffffff : color,
          size: G.rand(22, 8),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.8,
          life: G.rand(0.6, 0.24),
          grav: 620,
          drag: 0.9,
        });
      }
      this.impact(x, y, color, 1.0);
    }

    /* ---------- 네 갈래 별 섬광 (애니 타격의 핵심) ---------- */
    hitSpark(x, y, color = 0xcfeaff, scale = 1, dur = 0.22) {
      const s = new PIXI.Sprite(T().spark);
      s.anchor.set(0.5);
      s.x = x; s.y = y;
      s.tint = color;
      s.blendMode = 'add';
      s.rotation = G.rand(G.TAU);
      s.width = 120 * scale; s.height = 120 * scale;
      this.layer.addChild(s);
      const item = {
        obj: s, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / dur;
          if (p >= 1) return false;
          const sc = (0.55 + 0.85 * G.easeOutCubic(p)) * scale;
          s.scale.set(sc, sc * (1 - 0.15 * p));
          s.alpha = Math.pow(1 - p, 1.5);
          return true;
        },
      };
      this.items.push(item);
      this.impact(x, y, color, 0.55 * scale);
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

    /* ---------- 검기 (2색 크레센트: 시안 코어 + 골드/백색 테두리) ---------- */
    slash(x, y, opts = {}) {
      const o = Object.assign(
        { radius: 150, spread: 1.15, angle: -0.18, width: 22, color: 0x2f6bff,
          color2: 0x8fd0ff, edge: null, dir: 1, dur: 0.17, scale: 1, spiral: 0.16, flare: 1 },
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
      const layer = (radius, width, color, alpha, spiral, taperPow, ySquash = 1) => {
        const N = 30;
        const pts = [];
        const edge = (sign, revS) => {
          for (let k = 0; k <= N; k++) {
            const t = revS ? 1 - k / N : k / N;
            const a = a0 + (a1 - a0) * t;
            const th = width * Math.pow(Math.sin(Math.PI * t), taperPow);
            const r = radius * (1 - spiral * t);
            pts.push([Math.cos(a) * (r + sign * th), Math.sin(a) * (r + sign * th) * ySquash]);
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

      // Three translucent echo trails, then violet bloom, blue edge and white core.
      layer(o.radius * 1.18, o.width * 2.2, 0x7553ff, 0.11 * o.flare, o.spiral, 1.6);
      layer(o.radius * 1.12, o.width * 1.8, 0x9a7aff, 0.16 * o.flare, o.spiral, 1.8);
      layer(o.radius * .93, o.width * 1.0, 0x54aaff, 0.18 * o.flare, o.spiral, 2.0);
      // 바깥 잔광 → 골드/2색 테두리 → 시안 → 백색 코어
      layer(o.radius * 1.06, o.width * 1.55, o.color, 0.13 * o.flare, o.spiral, 1.8);
      layer(o.radius * 1.02, o.width * 1.05, o.color2, 0.22 * o.flare, o.spiral * 0.9, 2.0);
      if (o.edge !== null) layer(o.radius * 1.0, o.width * 0.55, o.edge, 0.5 * o.flare, o.spiral * 0.8, 2.2);
      layer(o.radius, o.width * 0.72, o.color2, 0.34 * o.flare, o.spiral, 2.1);
      layer(o.radius * 0.985, o.width * 0.20, 0xffffff, 0.66, o.spiral, 2.5);

      const item = {
        obj: g, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / o.dur;
          if (p >= 1) return false;
          const e = G.easeOutCubic(p);
          g.scale.set(o.scale * (0.9 + 0.22 * e), o.scale * (0.95 + 0.1 * e));
          g.rotation = o.angle + 0.14 * o.dir * e;
          g.alpha = Math.pow(1 - p, 1.6);
          return true;
        },
      };
      this.items.push(item);

      // 칼끝을 따라 흩어지는 잔검 파편
      for (let i = 0; i < Math.round(10 * Math.max(1, o.flare)); i++) {
        const t = G.rand(0.95, 0.15);
        const a = o.angle - o.spread / 2 + o.spread * t;
        const rr = o.radius * (1 - 0.18 * t);
        this._particle(x + Math.cos(a) * rr, y + Math.sin(a) * rr, {
          color: G.chance(0.5) ? 0xffffff : o.color2,
          size: G.rand(22, 7),
          vx: Math.cos(a) * G.rand(340, 110),
          vy: Math.sin(a) * G.rand(340, 110),
          life: G.rand(0.36, 0.14),
          grav: 180,
          tex: 'spark',
          rot: a,
        });
      }
    }

    /* ---------- 타격 버스트 (방사형 섬광) ---------- */
    burst(x, y, opts = {}) {
      const o = Object.assign(
        { color: 0xbfe4ff, core: 0xffffff, rays: 14, length: 140, width: 8, dur: 0.2,
          angle: null, spread: G.TAU, star: true },
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
        g.circle(0, 0, o.length * 0.24).fill({ color: o.color, alpha: 0.14 });
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
      if (o.star) this.hitSpark(x, y, o.core, 0.7, 0.24);
      else this.impact(x, y, o.core, 0.32);
    }

    /* 시네마틱 검격: 한 Graphics를 생성하여 수명 동안 재사용 후 파괴. */
    cinematicCross(cx = G.W / 2, cy = G.H / 2, dur = 0.58) {
      const g = new PIXI.Graphics();
      g.blendMode = 'add';
      this.layer.addChild(g);
      const span = Math.hypot(G.W, G.H) * 0.78; // 대각선 전체 길이 약 1.4배
      const draw = (fade) => {
        g.clear();
        for (const sign of [-1, 1]) {
          const ax = cx - span, ay = cy - sign * span * 0.57;
          const bx = cx + span, by = cy + sign * span * 0.57;
          for (const [w, color, alpha] of [[86, 0x7045ff, .13], [48, 0x3d9dff, .29], [22, 0xc4baff, .48], [7, 0xffffff, .98]]) {
            g.moveTo(ax, ay).lineTo(bx, by).stroke({width:w,color,alpha:alpha*fade,cap:'round'});
          }
        }
      };
      draw(1);
      const it={obj:g,t:0,update:(dt)=>{it.t+=dt;const p=it.t/dur;if(p>=1)return false;draw(Math.pow(1-p,1.3));return true;}};
      this.items.push(it);
    }

    /* 40ms 실루엣 + 12개 속도선, 매 프레임 Graphics 신규 생성 없음. */
    impactFrame(x, y, target = null) {
      const g=new PIXI.Graphics();g.blendMode='add';this.layer.addChild(g);
      const r=target && (target.bodyPx || target.baseH) ? (target.bodyPx || target.baseH)*0.45 : 75;
      g.ellipse(x,y,r*.63,r).fill({color:0xffffff,alpha:.78});
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6, inner=105+(i%3)*12, outer=inner+G.rand(120,65);
        g.moveTo(x+Math.cos(a)*inner,y+Math.sin(a)*inner).lineTo(x+Math.cos(a)*outer,y+Math.sin(a)*outer)
          .stroke({width:i%3===0?5:2.5,color:0xffffff,alpha:.78});
      }
      const it={obj:g,t:0,update:(dt)=>{it.t+=dt;g.alpha=Math.max(0,1-it.t/.04);return it.t<.04;}};
      this.items.push(it);
    }

    perfectSeal(x=G.W/2,y=G.H-96) {
      const t=new PIXI.Text({text:'PERFECT',style:{fontFamily:G.FONT_NUM,fontSize:57,fontWeight:'900',
        fill:{color:0xffdc72},stroke:{color:0x5c2a0b,width:5},letterSpacing:6,
        dropShadow:{color:0x351c06,alpha:.8,blur:8,distance:3,angle:Math.PI/2}}});
      t.anchor.set(.5);t.position.set(x,y);t.scale.set(1.25);this.layer.addChild(t);
      const it={obj:t,t:0,update:(dt)=>{it.t+=dt;const p=Math.min(1,it.t/.7);
        t.scale.set(1+.25*Math.pow(1-p,3));t.alpha=Math.pow(1-p,1.15);return p<1;}};
      this.items.push(it);
    }

    /* ---------- 데미지 숫자 ---------- */
    damage(x, y, value, opts = {}) {
      const o = Object.assign({ crit: false, color: null, size: 0, rise: 64 }, opts);
      const size = o.size || (o.crit ? 35 : 22);
      const color = o.color || (o.crit ? 0xffd75e : 0xffffff);
      const t = new PIXI.Text({
        text: String(Math.round(value)),
        style: {
          fontFamily: G.FONT_NUM,
          fontSize: size,
          fontWeight: '900',
          fill: o.crit ? {color: 0xffc35b} : color,
          stroke: { color: o.crit ? 0x4a2104 : 0x081a30, width: o.crit ? 2 : 3 },
          letterSpacing: 0.5,
        },
      });
      t.anchor.set(0.5, 1);
      this._dmgIdx = ((this._dmgIdx || 0) + 1) % 4;
      t.x = x + G.rand(96, -96) + (this._dmgIdx - 1.5) * 30;
      t.y = y - this._dmgIdx * 16 + G.rand(14, -14);
      t.scale.set(o.crit ? 1.6 : 1.0);
      this.layer.addChild(t);

      const item = {
        obj: t, t2: 0,
        update: (dt) => {
          item.t2 += dt;
          const p = item.t2 / (o.crit ? 1.1 : 0.95);
          if (p >= 1) return false;
          const e = G.easeOutCubic(Math.min(1, item.t2 / 0.15));
          t.y = y - o.rise * G.easeOutCubic(Math.min(1, item.t2 / 0.55));
          const base = o.crit ? 1.6 : 1.0;
          t.scale.set(o.crit ? base - 0.6 * e : 1.0);
          t.alpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 충격파 링 (다중) ---------- */
    ring(x, y, color = 0xffffff, radius = 220, dur = 0.42, width = 6, squash = 1) {
      const s = new PIXI.Sprite(T().ring);
      s.anchor.set(0.5);
      s.x = x; s.y = y;
      s.tint = color;
      s.blendMode = 'add';
      s.width = 40; s.height = 40;
      s.scale.set(1, squash);
      this.layer.addChild(s);
      const item = {
        obj: s, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / dur;
          if (p >= 1) return false;
          const r = radius * (0.25 + 0.85 * G.easeOutCubic(p));
          s.width = r * 2; s.height = r * 2 * squash;
          s.alpha = (1 - p) * 0.9;
          return true;
        },
      };
      this.items.push(item);
    }

    /* 지면을 따라 퍼지는 충격파 (타원) */
    shockRing(x, y, color = 0x9fd6ff, radius = 240, dur = 0.5) {
      this.ring(x, y, color, radius * 0.86, dur, 5, 0.34);
      this.ring(x, y, 0xffffff, radius * 0.58, dur * 0.8, 2.5, 0.34);
      const s = new PIXI.Sprite(T().halo);
      s.anchor.set(0.5);
      s.x = x; s.y = y;
      s.tint = color;
      s.blendMode = 'add';
      this.layer.addChild(s);
      const item = {
        obj: s, t: 0,
        update: (dt) => {
          item.t += dt;
          const p = item.t / (dur * 0.9);
          if (p >= 1) return false;
          const r = radius * (0.28 + 0.72 * G.easeOutCubic(p));
          s.width = r * 1.5; s.height = r * 0.44;
          s.alpha = (1 - p) * 0.22;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 룬 원 ---------- */
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
          g.moveTo(Math.cos(a) * radius * 0.72, Math.sin(a) * radius * 0.72);
          g.lineTo(Math.cos(a + 0.16) * radius, Math.sin(a + 0.16) * radius);
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
          g.scale.set(0.4 + 0.75 * G.easeOutCubic(p), (0.4 + 0.75 * G.easeOutCubic(p)) * 0.38);
          g.alpha = 1 - p * 0.9;
          return true;
        },
      };
      this.items.push(item);
    }

    /* ---------- 빛 기둥 ---------- */
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

    /* ---------- 화면 텍스트 (PERFECT 등) ---------- */
    popText(x, y, text, opts = {}) {
      const o = Object.assign({ color: 0xffffff, size: 40, dur: 0.9, stroke: 0x0a1c38, letter: 3 }, opts);
      const t = new PIXI.Text({
        text,
        style: {
          fontFamily: G.FONT,
          fontSize: o.size,
          fontWeight: '900',
          fill: o.color,
          stroke: { color: o.stroke, width: 8 },
          letterSpacing: o.letter,
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
      g.x = hero.x + 64 * hero.facing;
      g.y = hero.centerY;
      this.layer.addChild(g);
      const r0 = cfg.ang - dir * (heavy ? 0.85 : 0.6);
      const r1 = cfg.ang + dir * (heavy ? 0.95 : 0.65);
      const dur = heavy ? 0.3 : 0.22;
      const span = 0.95;

      const draw = (head, alpha) => {
        g.clear();
        const inner = heavy ? 96 : 82;
        const outer = heavy ? 258 : 206;
        const steps = 22;
        for (let s = 0; s < 4; s++) {
          const w = span * (1 - s * 0.19);
          const a1 = head - dir * w;
          const col = s === 0 ? (heavy ? 0x3f7dff : 0x4f9dff)
            : s === 1 ? 0x8fd0ff : s === 2 ? 0xd8f0ff : 0xffffff;
          const al = (s === 0 ? 0.13 : s === 1 ? 0.24 : s === 2 ? 0.34 : 0.55) * alpha;
          const ri = inner + s * 12;
          const ro = outer - s * 9;
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
        const hx = Math.cos(head) * outer;
        const hy = Math.sin(head) * outer * 0.86;
        g.circle(hx, hy, heavy ? 24 : 16).fill({ color: 0xffffff, alpha: 0.62 * alpha });
        g.circle(hx, hy, heavy ? 40 : 26).fill({ color: 0x9fd6ff, alpha: 0.16 * alpha });
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

    /* ---------- 발걸음 먼지 ---------- */
    dust(x, y, dir = 1, power = 1) {
      const n = Math.round(4 + 3 * power);
      for (let i = 0; i < n; i++) {
        this._particle(x + G.rand(14, -14), y - G.rand(8, 0), {
          color: G.chance(0.5) ? 0xb9c8dc : 0x8fa4c0,
          size: G.rand(16, 6) * (0.7 + power * 0.4),
          vx: -dir * G.rand(150, 30) * power + G.rand(30, -30),
          vy: -G.rand(70, 10) * power,
          life: G.rand(0.45, 0.22),
          grav: 120,
          drag: 0.88,
          additive: false,
          fade: 1.6,
        });
      }
      // 발이 땅을 밟는 순간의 작은 빛
      if (G.chance(0.6)) {
        this._particle(x + G.rand(10, -10), y - 2, {
          color: 0x9fd6ff, size: G.rand(10, 4), vx: G.rand(20, -20), vy: -G.rand(40, 10),
          life: 0.24, additive: true,
        });
      }
    }

    /* ---------- 파편 (바닥 충격) ---------- */
    debris(x, y, count = 8, color = 0x9fb8d8, power = 1) {
      for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + G.rand(1.15, -1.15);
        const sp = G.rand(420, 160) * power;
        this._particle(x + G.rand(30, -30), y - G.rand(6, 0), {
          color,
          size: G.rand(16, 7),
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: G.rand(0.7, 0.35),
          grav: 1250,
          drag: 0.96,
          tex: 'shard',
          rot: G.rand(G.TAU),
          spin: G.rand(9, -9),
          fade: 0.8,
        });
      }
    }

    /* ---------- 지면 충격 (먼지·파편·링) ---------- */
    groundBurst(x, y) {
      this.shockRing(x, y - 4, 0x9fd6ff, 200, 0.45);
      for (let i = 0; i < 18; i++) {
        const a = G.rand(0.35, -0.35) + (G.chance(0.5) ? 0 : Math.PI);
        const sp = G.rand(380, 120);
        this._particle(x + G.rand(40, -40), y - 2, {
          color: G.chance(0.5) ? 0x9fb8d8 : 0x6d86a8,
          size: G.rand(20, 7),
          vx: Math.cos(a) * sp,
          vy: -Math.abs(Math.sin(a)) * sp * 0.75,
          life: G.rand(0.55, 0.25),
          grav: 900,
          drag: 0.9,
          additive: false,
          fade: 1.4,
        });
      }
      this.debris(x, y, 7, 0xc8d8ea, 1.1);
    }

    /* ---------- 속도선 (가속/대시) ---------- */
    speedLines(x, y, dir = 1, count = 5, power = 1) {
      for (let i = 0; i < count; i++) {
        const len = G.rand(150, 60) * power;
        const yy = y + G.rand(160, -150);
        const s = new PIXI.Sprite(T().streak);
        s.anchor.set(0.5);
        s.x = x + G.rand(40, -30);
        s.y = yy;
        s.width = 7;
        s.height = len;
        s.rotation = Math.PI / 2 * dir + G.rand(0.06, -0.06);
        s.tint = G.chance(0.4) ? 0xffffff : 0x9fd6ff;
        s.blendMode = 'add';
        s.alpha = G.rand(0.5, 0.16);
        this.layer.addChild(s);
        const vx = -dir * G.rand(1400, 800);
        const item = {
          obj: s, t: 0,
          update: (dt) => {
            item.t += dt;
            const p = item.t / 0.26;
            if (p >= 1) return false;
            s.x += vx * dt;
            s.width = 7 * (1 - p);
            s.alpha = G.rand(0.5, 0.2) * (1 - p);
            return true;
          },
        };
        this.items.push(item);
      }
    }

    /* ---------- 회피 잔상 ---------- */
    afterimage(unit, dur = 0.5, color = 0x7cc4ff) {
      const spawn = () => {
        const spr = (unit.sdSprite && unit.sdSprite.visible) ? unit.sdSprite : unit.sprite;
        if (!spr) return;
        const s = new PIXI.Sprite(spr.texture);
        s.anchor.set(spr.anchor.x, spr.anchor.y);
        s.scale.set(spr.scale.x, spr.scale.y);
        s.x = unit.x + (spr.x || 0);
        s.y = unit.y + (spr.y || 0);
        s.tint = color;
        s.blendMode = 'add';
        s.alpha = 0.34;
        this.layer.addChild(s);
        const ghost = {
          obj: s, t: 0,
          update: (dt) => {
            ghost.t += dt;
            const p = ghost.t / 0.3;
            if (p >= 1) return false;
            s.alpha = 0.34 * (1 - p);
            s.y += 4 * dt;
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
