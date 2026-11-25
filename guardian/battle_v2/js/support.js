/* support.js : 아라·보른·세나 전투 지원 — 쿨타임 자동 등장 · 측면 다프레임 시전 · 리아급 컷인
 *
 *  v5.4.0-build440 개편
 *   - 왼쪽 네모 카드(178×230)를 **완전히 없앴다**. 대신 리아 궁극기 컷인과 같은 문법
 *     (화면 왼쪽에서 밀려 들어오는 사선 띠 + 일러스트 + 빛 갈라짐)의 고퀄리티 컷인을 쓴다.
 *     띠/초상화/글자 배치는 리아 컷인의 0.86 배 — 같은 게임처럼 보이되 전투 시야를 덜 가린다.
 *   - SD는 **오른쪽(카엘·적 방향) 3/4 측면** 4프레임 연속 동작(`{ara,born,sena}_sd_seq.webp`).
 *     프레임은 7fps 로 전환되고, 전환 순간 0.07초 크로스페이드로 이어 붙여 '뚝' 끊기지 않는다.
 *       f0 ready → f1 windup → f2 cast → f3 strike(홀드)
 *     등장 동선: enter(0.34s) 카엘 뒤에서 달려와 → cast(1.18s) 4프레임 시전 → exit(0.38s) 돌아 나간다.
 *   - 스킬 효과는 f3 로 바뀌는 순간(enter+0.38s) 발동한다.
 *
 *  - 세 사람은 필드에 상주하지 않는다. 각자 쿨타임이 차고 조건(체력/사거리/적 수)이 맞으면 달려온다.
 *  - 지원 컷인끼리는 한 번에 하나만 + 최소 2.6초 간격으로 큐잉되고, 리아 컷인 중에는 비켜 준다.
 */
(function () {
  const CARDS = {
    ara: {
      name: '아라', move: '등불의 온기', en: "LAMPBEARER'S WARMTH", role: '등불지기',
      tag: 'THE LAMP KEEPER',
      color: 0xffc247, light: 0xffe9a8, dark: 0x241703,
      voice: 'ara_support', cd: 17,
      caption: '최대 체력 18% 회복 · 주변 적 밀어내기',
      sub: '등불지기 · LAMPBEARER\'S WARMTH',
    },
    born: {
      name: '보른', move: '강철의 일격', en: 'IRON VERDICT', role: '대장장이',
      tag: 'THE FORGEMASTER',
      color: 0xff8a3c, light: 0xffc98c, dark: 0x200d03,
      voice: 'born_support', cd: 15,
      caption: '전방 강타 · 기절 1.8초 · 방어력 -25%',
      sub: '대장장이 · IRON VERDICT',
    },
    sena: {
      name: '세나', move: '기록의 인장', en: 'SEAL OF RECORDS', role: '기록관',
      tag: 'THE ARCHIVIST',
      color: 0xb98bff, light: 0xe6dcff, dark: 0x120828,
      voice: 'sena_support', cd: 19,
      caption: '적 속도 -35%(3.5초) · 아군 쿨타임 -2.5초',
      sub: '기록관 · SEAL OF RECORDS',
    },
  };
  const ORDER = ['ara', 'born', 'sena'];
  const GAP = 2.6;            // 지원 컷인 사이 최소 간격(초)

  /* 등장 동선 */
  const ENTER = 0.34;         // 달려오기
  const CAST = 1.18;          // 4프레임 시전 + 홀드
  const EXIT = 0.38;          // 물러나기
  const DUR = ENTER + CAST + EXIT;
  const RUN_PX = 300;         // 달려오는 거리
  const CAST_PX = 172;        // 카엘 뒤에 서는 거리
  const BODY_PX = 232;        // 카엘 SD 몸 높이(px) — support도 같은 체급

  /* 시전 프레임 타임라인 (cast 시작 후 초) — 0.14초 간격 = 7fps */
  const F_T = [0.00, 0.10, 0.24, 0.38];   // f0, f1, f2, f3 진입 시각
  const STRIKE = ENTER + F_T[3];          // 이 순간 스킬 발동
  const XFADE = 0.07;

  /* 리아 컷인 문법을 0.86 으로 줄인 띠 */
  const CUT_IN = 0.18;        // 밀려 들어오기
  const CUT_HOLD = 1.00;      // 유지(여기까지 1.0)
  const CUT_OUT = 0.28;       // 빠져나가기
  const CUT_DUR = CUT_HOLD + CUT_OUT;

  class Support {
    constructor(game) {
      this.game = game;
      this.cards = CARDS;
      this.slowT = 0;                     // 세나 — 적 이동/공격 속도 감소 남은 시간
      this.log = [];                      // 검증용: 발동 기록
      this.frameLog = [];                 // 검증용: 프레임 전환 기록
      this.banner = null;
      this.bannerT = 0;
      this.alpha = 0;
      this.actor = null;
      this.trails = [];
      this.lastFire = -99;
      this.total = 0;
      this.reset();
    }

    reset() {
      this.ally = {};
      // 첫 등장이 시작 직후 몰리지 않게 조금씩 어긋나게 둔다
      // (플레이어로 출전한 캐릭터는 지원 편성에서 자동 제외 — Step 7)
      const me = (this.game && this.game.deployChar) || 'kael';
      this.ally.ara = { cd: 5.0 };
      this.ally.born = { cd: 7.5 };
      this.ally.sena = { cd: 9.5 };
      if (this.ally[me]) this.ally[me].cd = 1e9;
      this.slowT = 0;
      this.lastFire = -99;
      this._clearActor();
      if (this.banner) { this.banner.destroy({ children: true }); this.banner = null; this.bannerKind = null; }
    }

    _clearActor() {
      if (this.actor) { this.actor.obj.destroy({ children: true }); this.actor = null; this.actorKind = null; }
      if (this.trails) {
        this.trails.forEach((tr) => tr.spr.destroy());
        this.trails = [];
      }
    }

    state() {
      const a = this.actor;
      return {
        cds: ORDER.map((k) => ({ k, cd: +this.ally[k].cd.toFixed(2) })),
        banner: this.banner ? this.bannerKind : null,
        actor: a ? a.kind : null,
        phase: a ? a.phase : null,
        actorX: a ? Math.round(a.obj.x) : null,
        actorTex: a ? a.texKey : null,
        actorFrame: a ? a.frame : null,
        actorFrames: a ? a.frameCount : 0,
        actorBodyPx: a ? +(BODY_PX * a.persp).toFixed(1) : null,
        actorOpaque: a ? +a.obj.alpha.toFixed(2) : null,
        cutin: this.banner ? {
          x: Math.round(this.banner.x), y: Math.round(this.banner.y),
          w: this.cutW, h: this.cutH,
        } : null,
        frameLog: this.frameLog.slice(-8),
        slowT: +this.slowT.toFixed(2),
        fired: this.log.length,
      };
    }

    /* ---------------------------------------------------------------- 메인 */
    update(dt, realDt) {
      this._tickVisuals(realDt);
      if (dt <= 0) return;
      const g = this.game;
      this.slowT = Math.max(0, this.slowT - dt);
      ORDER.forEach((k) => { const a = this.ally[k]; a.cd = Math.max(0, a.cd - dt); });
      if (g.phase !== 'wave' && g.phase !== 'boss' && g.phase !== 'bossIntro') return;
      if (!g.kael || g.kael.state === 'dead') return;
      this._auto();
    }

    /* 발동 조건이 맞는 사람을 한 명씩 (한 번에 컷인 한 장) */
    _auto() {
      const g = this.game;
      if (this.banner) return;
      if (g.cutin) return;                       // 리아 컷인 중에는 비켜 준다
      if (g.coopCutin) return;                   // 협동(성광 협공) 컷인 중에도 비켜 준다
      if (g.time - this.lastFire < GAP) return;
      for (const k of ORDER) {
        if (this.ally[k].cd > 0) continue;
        if (!this._should(k)) continue;
        this.fire(k);
        return;
      }
    }

    _should(k) {
      const g = this.game;
      const kael = g.kael;
      if (k === 'ara') {
        // 카엘 체력 80% 이하 — 회복이 필요한 순간에 쓴다
        return kael.hp / kael.hpMax <= 0.8;
      }
      if (k === 'born') {
        // 사거리 안에 적이 있을 때만 (보스 포함)
        const t = g._nearestEnemy();
        if (!t) return false;
        return Math.abs(t.x - kael.x) < 430;
      }
      if (k === 'sena') {
        // 여러 적 또는 보스 — 광역 감속이 값어치를 하는 상황
        const alive = g.enemies.filter((e) => e.alive && !e.dying).length;
        const boss = !!(g.boss && g.boss.alive && !g.boss.dying);
        return alive >= 2 || boss;
      }
      return false;
    }

    /* ---------------------------------------------------------------- 발동 */
    fire(k, opts = {}) {
      const g = this.game;
      const card = CARDS[k];
      if (!card || !g.kael) return false;
      this.ally[k].cd = card.cd;
      this.lastFire = g.time;
      this.total++;
      this.log.push({ t: +g.time.toFixed(2), k, move: card.move });
      if (this.log.length > 60) this.log.shift();
      this.frameLog.length = 0;

      const kael = g.kael;
      const f = kael.facing || 1;
      // 카엘 **뒤쪽**에서 달려와 선다 (카엘이 오른쪽을 보면 왼쪽 뒤, 왼쪽을 보면 오른쪽 뒤)
      const xCast = G.clamp(kael.x - CAST_PX * f, 150, 1120);
      const x0 = G.clamp(xCast - RUN_PX * f, -110, 1180);
      const y = G.clamp(kael.y + 6, 500, 668);

      this._spawnActor(k, { x0, xCast, y, facingCast: f, persp: kael.persp });
      this._cutIn(k);

      if (G.Sfx.playVoice) G.Sfx.playVoice(card.voice, { min: 2500, chance: 1, priority: 2 });
      if (k === 'ara') G.Sfx.magic();
      else if (k === 'born') G.Sfx.slash(0.8);
      else G.Sfx.magic();

      if (opts.instant) {
        this._effect(k);
        if (this.actor) { this.actor.struck = true; }
      }
      return true;
    }

    _effect(k) {
      const g = this.game;
      if (g.phase === 'victory' || g.phase === 'defeat') return;
      if (!g.kael || g.kael.state === 'dead') return;
      if (k === 'ara') this._araEffect();
      else if (k === 'born') this._bornEffect();
      else this._senaEffect();
    }

    /* 아라 — 등불의 온기: 최대 HP 18% 회복 + 주변 적 넉백 */
    _araEffect() {
      const g = this.game, k = g.kael;
      const heal = Math.round(k.hpMax * 0.18);
      const before = k.hp;
      k.hp = Math.min(k.hpMax, k.hp + heal);
      const got = Math.round(k.hp - before);

      g.fx.popText(k.x, k.y - 152, '+' + got + ' 회복', { color: 0x9dffb8, size: 30, dur: 1.15, stroke: 0x0b2a14 });
      g.fx.pillar(k.x, k.y - 6, 0xffd88a, 400, 0.62, 108);
      g.fx.ring(k.x, k.y - 8, 0xffd166, 270, 0.55, 7, 0.4);
      g.fx.ring(k.x, k.y - 8, 0xfff0c4, 400, 0.72, 3.5, 0.4);
      g.fx.shockRing(k.x, k.y - 10, 0xffc247, 400, 0.55);
      g.fx.sparkBurst(k.x, k.y - 110, 0xffe9a8, 26, 420);
      g.fx.groundBurst(k.x, k.y);
      // 등불 파동에 밀려나는 적
      g.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        if (Math.abs(e.x - k.x) > 330 || Math.abs(e.y - k.y) > 170) return;
        e.knockback(600, e.x >= k.x ? 1 : -1);
        g.fx.ring(e.x, e.y - 6, 0xffd166, 90, 0.45, 4, 0.42);
        g.fx.sparkBurst(e.x, e.centerY, 0xffe0a0, 10, 300);
        if (e.teleMark) e.teleMark.alpha = 0;
      });
      if (g.boss && g.boss.alive && !g.boss.dying && Math.abs(g.boss.x - k.x) < 360) {
        g.boss.kbV = Math.max(g.boss.kbV, 90);
        g.boss.kbDir = g.boss.x >= k.x ? 1 : -1;
      }
      g._feel('support-ara', { stop: G.FEEL.support.ara.stop, shake: G.FEEL.support.ara.shake, shakeDur: G.FEEL.support.ara.shakeDur });
      g.flashImpact(0.08, 0xffc247);
      g.scene.zoomTo(1.025, 0.16);
      g.after(0.34, () => { if (g.phase === 'wave' || g.phase === 'boss') g.scene.zoomTo(1, 0.42); });
    }

    /* 보른 — 강철의 일격: 전방 강타 + 1.8초 기절 + 방어력 -25% */
    _bornEffect() {
      const g = this.game, k = g.kael, f = k.facing || 1;
      const cx = k.x + 170 * f;
      g.fx.shockRing(cx, k.y - 16, 0xff9a3c, 430, 0.55);
      g.fx.shockRing(cx, k.y - 16, 0xffd9a8, 250, 0.42);
      g.fx.slash(cx, k.centerY, {
        radius: 214, spread: 1.9, angle: f > 0 ? -0.12 : Math.PI + 0.12, width: 30,
        color: 0xff8a3c, color2: 0xffd9a8, edge: 0xfff3d0, dur: 0.28,
      });
      g.fx.burst(cx, k.centerY, { color: 0xffa050, core: 0xfff4dc, rays: 18, length: 210, width: 9, dur: 0.22 });
      g.fx.sparkBurst(cx, k.centerY, 0xffc27a, 30, 700);
      g.fx.debris(cx, k.y - 4, 9, 0xffa56a, 1.15);
      g.fx.groundBurst(cx, k.y);
      g._feel('support-born', { stop: G.FEEL.support.born.stop, shake: G.FEEL.support.born.shake, shakeDur: G.FEEL.support.born.shakeDur });
      g.flashImpact(0.16, 0xffd0a0);
      g.scene.zoomTo(1.03, 0.14);
      g.after(0.34, () => { if (g.phase === 'wave' || g.phase === 'boss') g.scene.zoomTo(1, 0.42); });

      let n = 0;
      g.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        const dx = (e.x - k.x) * f;
        if (dx < -50 || dx > 400 || Math.abs(e.y - k.y) > 155) return;
        const dmg = Math.round(k.atk * 2.2 * G.rand(1.06, 0.94));
        g.stats.damage += dmg;
        const delay = n++ * 0.05;
        g.after(delay, () => {
          if (!e.alive || e.dying) return;
          e.takeDamage(dmg, { crit: false, color: 0xffc27a });
          e.knockback(620, f);
          e.stun(1.8);
          e.applyDefDown(5);
          g.fx.popText(e.x, e.centerY - 70, '기절', { color: 0xffd9a8, size: 15, dur: 0.7, stroke: 0x2a1404 });
        });
      });
      if (g.boss && g.boss.alive && !g.boss.dying) {
        const dx = (g.boss.x - k.x) * f;
        if (dx > -120 && dx < 470) {
          const dmg = Math.round(k.atk * 1.7);
          g.stats.damage += dmg;
          g.boss.takeDamage(dmg, { crit: false });
          g.boss.applyDefDown(5);
          g.boss.stagger = Math.max(g.boss.stagger, 0.6);   // 보스는 완전 기절 대신 짧게 휘청
        }
      }
      G.Sfx.hit(true);
    }

    /* 세나 — 기록의 인장: 적 이동/공격 35% 감소(3.5초) + 아군 스킬 쿨타임 2.5초 단축 */
    _senaEffect() {
      const g = this.game, k = g.kael;
      this.slowT = 3.5;
      g.cooldowns.skill1 = Math.max(0, g.cooldowns.skill1 - 2.5);
      g.cooldowns.skill2 = Math.max(0, g.cooldowns.skill2 - 2.5);
      g.fx.rune(k.x, k.y - 4, 0xc9b0ff, 260, 1.5);
      g.fx.rune(k.x, k.y - 4, 0xffffff, 170, 1.1);
      g.fx.ring(640, k.y - 45, 0xd9c8ff, 700, 0.95, 8, 0.34);
      g.fx.ring(640, k.y - 45, 0xffffff, 460, 0.8, 4, 0.34);
      g.fx.shockRing(k.x, k.y - 10, 0xb98bff, 330, 0.6);
      g.fx.sparkBurst(k.x, k.y - 130, 0xe6dcff, 40, 520);
      g.fx.popText(k.x, k.y - 150, '기록 · 인장', { color: 0xd9c8ff, size: 19, dur: 0.95, stroke: 0x1a0a30, letter: 2 });
      g.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        g.fx.ring(e.x, e.y - 6, 0xb98bff, 70, 0.7, 3, 0.4);
        g.fx.sparkBurst(e.x, e.centerY - 40, 0xd9c8ff, 6, 200);
      });
      if (g.boss && g.boss.alive && !g.boss.dying) g.fx.ring(g.boss.x, g.boss.y - 12, 0xb98bff, 180, 0.8, 5, 0.4);
      g._feel('support-sena', { stop: G.FEEL.support.sena.stop, shake: G.FEEL.support.sena.shake, shakeDur: G.FEEL.support.sena.shakeDur });
      g.flashImpact(0.12, 0xb98bff);
      g.scene.zoomTo(1.02, 0.16);
      g.after(0.34, () => { if (g.phase === 'wave' || g.phase === 'boss') g.scene.zoomTo(1, 0.42); });
      G.Sfx.magic();
    }

    /* ---------------------------------------------------------------- 측면 다프레임 SD */
    _spawnActor(k, cfg) {
      const g = this.game;
      const card = CARDS[k];
      const seq = G.Assets.seq && G.Assets.seq[k];
      const idle = G.Assets.sd && G.Assets.sd[k + '_sd_idle'];
      if (!seq && !idle) return;
      this._clearActor();

      const o = new PIXI.Container();
      o.x = cfg.x0; o.y = cfg.y; o.zIndex = cfg.y - 30;   // 카엘을 가리지 않게 살짝 뒤로

      const sh = new PIXI.Sprite(G.Assets.tex.shadow);
      sh.anchor.set(0.5);
      sh.width = 150; sh.height = 52; sh.alpha = 0.36;
      o.addChild(sh);

      const rune = new PIXI.Graphics();
      rune.circle(0, 0, 74).stroke({ width: 2.4, color: card.color, alpha: 0.85 });
      rune.circle(0, 0, 52).stroke({ width: 1.2, color: card.light, alpha: 0.6 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * G.TAU;
        rune.moveTo(Math.cos(a) * 52, Math.sin(a) * 52 * 0.36);
        rune.lineTo(Math.cos(a) * 74, Math.sin(a) * 74 * 0.36);
      }
      rune.stroke({ width: 1.2, color: card.light, alpha: 0.55 });
      rune.y = -2;
      o.addChild(rune);

      const glow = new PIXI.Sprite(G.Assets.tex.glow);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = card.color;
      glow.width = 260; glow.height = 260;
      glow.y = -120; glow.alpha = 0.2;
      o.addChild(glow);

      // 이전 프레임을 겹쳐 두는 자리(전환 0.07초 크로스페이드)
      const ghost = new PIXI.Sprite(seq ? seq.frames[0] : idle.texture);
      ghost.anchor.set(seq ? seq.ax : idle.ax, seq ? seq.ay : idle.ay);
      ghost.alpha = 0; ghost.visible = false;
      o.addChild(ghost);

      const spr = new PIXI.Sprite(seq ? seq.frames[0] : idle.texture);
      spr.anchor.set(seq ? seq.ax : idle.ax, seq ? seq.ay : idle.ay);
      o.addChild(spr);

      g.actorLayer.addChild(o);
      this.actor = {
        obj: o, spr, ghost, glow, rune, shadow: sh, kind: k,
        t: 0, x0: cfg.x0, xCast: cfg.xCast, y: cfg.y,
        facingCast: cfg.facingCast, persp: cfg.persp,
        texKey: seq ? k + '_sd_f0' : k + '_sd_idle',
        frame: 0, frameCount: seq ? seq.frames.length : 1,
        frameT: 0, xfade: 0, phase: 'enter',
        struck: false, trailT: 0, dustT: 0, landT: 0,
      };
      this.actorKind = k;

      // 들어오는 첫 발 — 화면 밖에서 나타나도 튀지 않게 먼지와 함께
      g.fx.dust(cfg.x0 + 20, cfg.y, 1, 0.7);
      o.alpha = 0;
    }

    /* 프레임 전환 — 이전 프레임을 고스트로 남겨 크로스페이드한다 */
    _setFrame(a, idx) {
      if (a.frame === idx) return;
      const seq = G.Assets.seq[a.kind];
      if (!seq) return;
      a.ghost.texture = a.spr.texture;
      a.ghost.anchor.set(a.spr.anchor.x, a.spr.anchor.y);
      a.ghost.scale.copyFrom(a.spr.scale);
      a.ghost.alpha = 1;
      a.ghost.visible = true;
      a.xfade = XFADE;
      a.frame = idx;
      a.spr.texture = seq.frames[idx];
      a.texKey = a.kind + '_sd_f' + idx;
      this.frameLog.push({ t: +this.game.time.toFixed(2), k: a.kind, f: idx });
      if (this.frameLog.length > 40) this.frameLog.shift();
    }

    _spawnTrail(a) {
      const g = this.game;
      const sd = G.Assets.seq[a.kind];
      if (!sd) return;
      const spr = new PIXI.Sprite(sd.frames[a.frame]);
      spr.anchor.set(sd.ax, sd.ay);
      spr.scale.copyFrom(a.spr.scale);
      spr.x = a.obj.x; spr.y = a.obj.y;
      spr.tint = CARDS[a.kind].color;
      spr.blendMode = 'add';
      spr.alpha = 0.42;
      spr.zIndex = a.y - 31;
      g.actorLayer.addChild(spr);
      this.trails.push({ spr, t: 0, dur: 0.28 });
      if (this.trails.length > 14) { const old = this.trails.shift(); old.spr.destroy(); }
    }

    _tickActor(realDt) {
      const a = this.actor;
      if (!a) return;
      const g = this.game;
      const card = CARDS[a.kind];
      const seq = G.Assets.seq[a.kind];
      a.t += realDt;
      const t = a.t;

      let phase, x, facing;
      let bounce = 0;
      let squashY = 1, squashX = 1;
      let rot = 0;

      if (t < ENTER) {
        /* 1) 달려오기 — f0(ready) 로 두 번 튀며 뛰어온다 */
        phase = 'enter';
        const p = G.clamp(t / ENTER, 0, 1);
        x = G.lerp(a.x0, a.xCast, G.easeOutQuad(p));
        facing = a.facingCast;
        bounce = -Math.abs(Math.sin(p * Math.PI * 2)) * 11;
        rot = 0.05;
        if (seq) this._setFrame(a, 0);
        a.dustT += realDt;
        if (a.dustT > 0.10) {
          a.dustT = 0;
          g.fx.dust(x - 14 * facing, a.y, facing, 0.55);
          g.fx.speedLines(x - 26 * facing, a.y - 70, facing, 3, 0.75);
        }
        a.trailT += realDt;
        if (a.trailT > 0.055) { a.trailT = 0; this._spawnTrail(a); }
      } else if (t < ENTER + CAST) {
        /* 2) 시전 — f0 ready → f1 windup → f2 cast → f3 strike(홀드) */
        phase = 'cast';
        const tc = t - ENTER;
        x = a.xCast;
        facing = a.facingCast;
        if (seq) {
          let idx = 0;
          for (let i = 0; i < F_T.length; i++) if (tc >= F_T[i]) idx = i;
          this._setFrame(a, idx);
        }
        if (tc < F_T[1]) {
          const q = G.clamp(tc / F_T[1], 0, 1);
          squashY = 1 - 0.09 * q; squashX = 1 + 0.06 * q;   // 움츠림
          bounce = 2.5 * q;
        } else {
          const r = G.clamp((tc - F_T[2]) / 0.26, 0, 1);
          const punch = Math.max(0, 1 - r);
          squashY = 1 + 0.075 * punch * punch; squashX = 1 - 0.055 * punch * punch;  // 내려찍는 반동
          // 홀드 중에는 아주 미세한 호흡
          const hold = G.clamp((tc - F_T[3]) / 0.4, 0, 1);
          squashY += Math.sin(tc * 9) * 0.006 * hold;
        }
        if (!a.struck && tc >= F_T[3]) {
          a.struck = true;
          g.fx.groundBurst(a.xCast, a.y);
          g.fx.dust(a.xCast, a.y, facing, 1.1);
          g.scene.shake(a.kind === 'born' ? 11 : 6, 0.26);
          this._effect(a.kind);
        }
      } else {
        /* 3) 퇴장 — 몸을 돌려(facing 반전) 잔상을 남기며 나간다 */
        phase = 'exit';
        const p = G.clamp((t - ENTER - CAST) / EXIT, 0, 1);
        x = G.lerp(a.xCast, a.x0 - 130 * a.facingCast, G.easeInQuad(p));
        facing = -a.facingCast;
        if (seq) this._setFrame(a, 0);
        bounce = -Math.abs(Math.sin(p * Math.PI * 1.5)) * 9;
        rot = -0.05;
        a.dustT += realDt;
        if (a.dustT > 0.09) {
          a.dustT = 0;
          g.fx.dust(x + 12 * facing, a.y, facing, 0.5);
          g.fx.speedLines(x + 26 * facing, a.y - 70, facing, 3, 0.75);
        }
        a.trailT += realDt;
        if (a.trailT > 0.05) { a.trailT = 0; this._spawnTrail(a); }
      }

      a.phase = phase;

      /* 크기: 카엘과 같은 체급 — bodyH → 232px × 카엘과 같은 원근 배율 */
      const ref = seq || G.Assets.sd[a.kind + '_sd_idle'];
      const base = (BODY_PX / (ref.bodyH || ref.h)) * a.persp;
      const sc = base * (1 + Math.sin(a.t * 7) * 0.004);
      a.spr.scale.set(sc * facing * squashX, sc * squashY);
      a.spr.rotation = rot + (phase === 'cast' ? Math.sin(a.t * 3) * 0.006 : 0);

      // 크로스페이드: 이전 프레임이 0.07초 동안 겹쳐 사라진다
      if (a.xfade > 0) {
        a.xfade = Math.max(0, a.xfade - realDt);
        a.ghost.scale.set(sc * facing * squashX, sc * squashY);
        a.ghost.rotation = a.spr.rotation;
        a.ghost.alpha = a.xfade / XFADE;
        if (a.xfade === 0) a.ghost.visible = false;
      }

      a.obj.x = x;
      a.obj.y = a.y + bounce;
      a.obj.zIndex = a.y - 30;
      a.shadow.y = -bounce * 0.15;
      a.shadow.width = 150 - Math.abs(bounce) * 2.2;
      a.shadow.alpha = 0.34 - Math.abs(bounce) * 0.004;

      /* 알파: 등장 0.08초 페이드인, 퇴장 마지막 0.22초 페이드아웃 */
      const fin = G.clamp(t / 0.08, 0, 1);
      const fout = phase === 'exit' ? G.clamp((t - (DUR - 0.24)) / 0.24, 0, 1) : 0;
      a.obj.alpha = fin * (1 - fout);

      /* 발밑 룬 · 잔광 */
      a.rune.rotation += realDt * (phase === 'cast' ? 1.5 : 3.2);
      a.rune.alpha = (phase === 'cast' ? 0.75 : 0.9) * fin * (1 - fout);
      a.rune.scale.set(1 + (phase === 'cast' ? 0.18 : 0), 1 + (phase === 'cast' ? 0.18 : 0));
      a.glow.alpha = (phase === 'cast' ? 0.42 : 0.2) + Math.sin(a.t * 11) * 0.06;
      a.glow.y = -120 - bounce * 0.6;
      a.glow.tint = card.color;

      if (t >= DUR) {
        this._clearActor();
      }
    }

    _tickTrails(realDt) {
      for (let i = this.trails.length - 1; i >= 0; i--) {
        const tr = this.trails[i];
        tr.t += realDt;
        const p = tr.t / tr.dur;
        if (p >= 1) { tr.spr.destroy(); this.trails.splice(i, 1); continue; }
        tr.spr.alpha = 0.42 * (1 - p) * (1 - p);
        tr.spr.scale.x *= 0.995;
        tr.spr.scale.y *= 0.995;
      }
    }

    /* ---------------------------------------------------------------- 리아급 사선 컷인 */
    _cutIn(k) {
      const g = this.game;
      const card = CARDS[k];
      if (this.banner) { this.banner.destroy({ children: true }); this.banner = null; }
      this.bannerKind = k;

      const c = new PIXI.Container();
      c.zIndex = 15;
      c.label = 'support-cutin';
      c.x = -560;
      c.alpha = 0;

      /* 사선 띠 — 리아 컷인과 같은 도형을 0.86 으로 줄였다 (왼쪽 끝에서 뻗어 나온다) */
      const band = new PIXI.Graphics();
      band.poly([-30, 168, 426, 104, 520, 322, -30, 434]).fill({ color: card.dark, alpha: 0.9 });
      band.poly([-30, 193, 426, 129, 504, 305, -30, 408]).fill({ color: card.color, alpha: 0.20 });
      band.poly([-30, 425, 168, 347, 202, 359, -30, 447]).fill({ color: card.light, alpha: 0.34 });
      band.moveTo(-30, 168).lineTo(426, 104).stroke({ width: 3, color: card.color, alpha: 0.85 });
      band.moveTo(426, 104).lineTo(520, 322).stroke({ width: 1.6, color: card.light, alpha: 0.55 });
      band.moveTo(-30, 434).lineTo(520, 322).stroke({ width: 1.2, color: card.light, alpha: 0.22 });
      c.addChild(band);

      /* 빛 갈라짐 — 띠를 가로질러 화면 밖으로 뻗는 얇은 빛줄기 (보스·리아 컷인과 같은 문법) */
      const shards = new PIXI.Graphics();
      shards.blendMode = 'add';
      for (let i = 0; i < 5; i++) {
        const y = 132 + i * 62;
        shards.moveTo(-10 + i * 26, y + 130).lineTo(690 + i * 14, y - 60)
          .stroke({ width: i === 1 ? 10 : (i === 3 ? 6 : 3), color: i === 1 ? card.light : 0xffffff,
            alpha: i === 1 ? 0.30 : 0.15 });
      }
      c.addChild(shards);
      this.cutShards = shards;

      /* 띠 오른쪽 끝의 빛 조각 — 사선으로 깨져 나가는 느낌 */
      const edge = new PIXI.Graphics();
      edge.blendMode = 'add';
      edge.poly([424, 104, 470, 96, 436, 168]).fill({ color: card.light, alpha: 0.30 });
      edge.poly([470, 190, 512, 178, 480, 250]).fill({ color: card.light, alpha: 0.20 });
      edge.poly([500, 276, 536, 266, 508, 322]).fill({ color: card.light, alpha: 0.14 });
      c.addChild(edge);
      this.cutEdge = edge;

      /* 초상화 뒤 잔광 */
      const gs = new PIXI.Sprite(G.Assets.tex.glow);
      gs.anchor.set(0.5);
      gs.blendMode = 'add';
      gs.tint = card.color;
      gs.width = 430; gs.height = 430;
      gs.x = 136; gs.y = 268;
      gs.alpha = 0.34;
      c.addChild(gs);

      const tex = G.Assets.tex['portrait' + k[0].toUpperCase() + k.slice(1)];
      if (tex) {
        // 같은 실루엣을 살짝 키워 색으로 태운 뒤 가산 → 띠에서 인물이 떠 보인다
        const aura = new PIXI.Sprite(tex);
        aura.anchor.set(0.5);
        aura.width = 268; aura.height = 268;
        aura.x = 138; aura.y = 266;
        aura.tint = card.color;
        aura.blendMode = 'add';
        aura.alpha = 0.30;
        c.addChild(aura);

        const por = new PIXI.Sprite(tex);
        por.anchor.set(0.5);
        por.width = 258; por.height = 258;
        por.x = 136; por.y = 266;
        c.addChild(por);
        this.cutPor = por;
        this.cutPorBase = por.scale.x;

        // 인물 뒤쪽 어깨선을 살짝 덮는 세로 빛
        const rim = new PIXI.Graphics();
        rim.blendMode = 'add';
        rim.poly([232, 150, 252, 150, 214, 396, 194, 396]).fill({ color: card.light, alpha: 0.16 });
        c.addChild(rim);
      }

      /* 이름 · 소속 · 효과 — 리아 컷인과 같은 자리 */
      const name = new PIXI.Text({
        text: card.name + ' · ' + card.move,
        style: G.style({ fontSize: 33, fontWeight: '900', fill: card.light, letterSpacing: 2,
          stroke: { color: card.dark, width: 8 } }),
      });
      name.anchor.set(0, 0.5);
      name.x = 246; name.y = 236;
      c.addChild(name);

      const sub = new PIXI.Text({
        text: card.sub,
        style: G.style({ fontSize: 13, fontWeight: '800', fill: card.color, letterSpacing: 2 }),
      });
      sub.anchor.set(0, 0.5);
      sub.x = 250; sub.y = 276;
      c.addChild(sub);

      const div = new PIXI.Graphics();
      div.moveTo(250, 294).lineTo(470, 278).stroke({ width: 1, color: card.light, alpha: 0.35 });
      c.addChild(div);

      const cap = new PIXI.Text({
        text: card.caption,
        style: G.style({ fontSize: 12, fontWeight: '800', fill: 0xf3ecdd, letterSpacing: 0.5,
          stroke: { color: card.dark, width: 3 } }),
      });
      cap.anchor.set(0, 0.5);
      cap.x = 250; cap.y = 312;
      c.addChild(cap);

      g.root.addChild(c);
      this.banner = c;
      this.bannerT = 0;
      this.cutW = 550; this.cutH = 340;
      this.alpha = 1;
      // 들어오는 순간의 섬광
      g.flashImpact(0.05, card.color);
    }

    _tickVisuals(realDt) {
      this._tickActor(realDt);
      this._tickTrails(realDt);
      if (!this.banner) return;
      this.bannerT += realDt;
      const t = this.bannerT;
      const tin = G.clamp(t / CUT_IN, 0, 1);
      const tout = G.clamp((t - CUT_HOLD) / CUT_OUT, 0, 1);
      this.banner.x = -560 * (1 - G.easeOutCubic(tin)) - 300 * G.easeInCubic(tout);
      this.banner.alpha = G.clamp(t / 0.10, 0, 1) * (1 - tout);
      if (this.cutShards) {
        this.cutShards.alpha = 0.55 + 0.45 * Math.sin(t * 9);
      }
      if (this.cutEdge) {
        this.cutEdge.alpha = 0.6 + 0.4 * Math.cos(t * 7);
      }
      if (this.cutPor) {
        const p = G.clamp(t / 0.30, 0, 1);
        this.cutPor.scale.set(this.cutPorBase * (0.9 + 0.1 * G.easeOutBack(p)));
      }
      if (t >= CUT_DUR) {
        this.banner.destroy({ children: true });
        this.banner = null;
        this.cutPor = null;
        this.cutShards = null;
        this.cutEdge = null;
        this.bannerKind = null;
      }
    }
  }

  G.Support = Support;
})();
