/* battle.js : 전투 진행, 웨이브/보스 페이즈, AUTO AI, 데미지 판정, 오버레이 */
(function () {
  const AUTO_CYCLE = ['counter', 'full', 'manual'];

  /* 애니 판타지풍 패널/버튼 (오버레이 공용) */
  function platePath(g, x, y, w, h, cut, fill, alpha) {
    const p = [x + cut, y, x + w - cut, y, x + w, y + cut, x + w, y + h - cut,
      x + w - cut, y + h, x + cut, y + h, x, y + h - cut, x, y + cut];
    g.poly(p).fill({ color: fill, alpha });
    return p;
  }
  function plateEdge(g, x, y, w, h, cut, color, alpha, width) {
    const p = [x + cut, y, x + w - cut, y, x + w, y + cut, x + w, y + h - cut,
      x + w - cut, y + h, x + cut, y + h, x, y + h - cut, x, y + cut];
    g.poly(p).stroke({ width: width || 1.6, color, alpha });
  }
  function gem(g, x, y, r, color, alpha) {
    g.poly([x, y - r, x + r * 0.72, y, x, y + r, x - r * 0.72, y]).fill({ color, alpha });
  }

  class Game {
    constructor(app) {
      this.app = app;
      this.scene = new G.Scene(app);
      this.actorLayer = this.scene.actorLayer;
      this.fx = new G.Fx(this.scene.fxLayer);

      this.root = new PIXI.Container();
      this.root.sortableChildren = true;
      this.root.addChild(this.scene.root);

      this.hud = new G.Hud(app, this);
      this.hud.root.zIndex = 10;
      this.root.addChild(this.hud.root);

      // 화면 비네트 (배경 위, HUD 아래)
      this.vignette = new PIXI.Sprite(G.Assets.tex.vignette);
      this.vignette.width = G.W; this.vignette.height = G.H;
      this.vignette.alpha = 0.62;
      this.vignette.zIndex = 5;
      this.root.addChild(this.vignette);

      this.overlay = new PIXI.Container();
      this.overlay.zIndex = 20;
      this.root.addChild(this.overlay);

      this.flashG = new PIXI.Graphics();
      this.flashG.zIndex = 30;
      this.root.addChild(this.flashG);

      app.stage.addChild(this.root);

      this.autoMode = 'counter';
      this.muted = false;
      this.paused = false;
      this.phase = 'intro';
      this.phaseT = 0;
      this.timeLeft = 60;
      this.combo = 0;
      this.comboT = 0;
      this.cooldowns = { skill1: 0, skill2: 0 };
      this.skillMax = { skill1: 7, skill2: 13 };
      this.enemies = [];
      this.projectiles = [];
      this.hitStop = 0;
      this.timeScale = 1;
      this.slowT = 0;
      this.promptMsg = '';
      this.promptT = 0;
      this.promptMax = 1.8;
      this.phaseBanner = 0;
      this.phaseMsg = '';
      this.stats = { damage: 0, maxCombo: 0, kills: 0 };
      this.perfectCounter = false;
      this.perfectWindow = false;
      this.keys = {};
      this.waveIndex = -1;
      this.waveQueue = [];
      this.atkCD = 0;
      this.attackBuffer = 0;
      this.comboStep = 0;
      this.comboWindow = 0;
      this.cutin = null;
      this.cutT = 0;
      this.summonActive = false;
      this.bossSpawned = false;
      this.overlayButtons = [];
      this.time = 0;
      this.timers = [];

      this._initActors();
      this._buildIntro();
    }

    _initActors() {
      this.kael = new G.Hero(this, {
        name: '카엘', role: '성문기사', x: 380, bodyPx: 332, hpMax: 780, shadowW: 160, glowColor: 0x5fb0ff,
      });
      this.kael.atk = 152;
      // 리아는 필드에 상주하지 않고 궁극기에서만 소환된다
      this.lia = new G.LiaSummon(this);
      this.actorLayer.addChild(this.kael.obj);
    }

    after(delay, fn) {
      this.timers.push({ t: delay, fn });
    }

    _processTimers(dt) {
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        tm.t -= dt;
        if (tm.t <= 0) {
          this.timers.splice(i, 1);
          try { tm.fn(); } catch (e) { console.error('timer', e); }
        }
      }
    }

    /* ---------------- 시작 ---------------- */
    start() {
      this.phase = 'wave';
      this.phaseT = 0;
      this.phaseBanner = 2.4;
      this.phaseMsg = 'STAGE 1 · 폐허의 거리';
      this.timeLeft = 60;
      this.waveIndex = -1;
      this.waveQueue = [];
      this.nextWaveDelay = 0.8;
      this._buildWaves();
      this.spawnWave();
      G.Sfx.resume();
    }

    _buildWaves() {
      this.waves = [
        { count: 4, hp: 240, atk: 14 },
        { count: 5, hp: 280, atk: 16 },
        { count: 6, hp: 320, atk: 18 },
        { count: 6, hp: 360, atk: 20 },
      ];
    }

    _buildIntro() {
      const c = this.introC = new PIXI.Container();
      // 배경을 어둡게 깔아 '타이틀 화면' 느낌
      const shot = new PIXI.Sprite(G.Assets.tex.bg);
      shot.anchor.set(0.5);
      shot.scale.set(Math.max(G.W / shot.width, G.H / shot.height) * 1.12);
      shot.x = G.W / 2; shot.y = G.H / 2;
      shot.tint = 0x6f89b0;
      shot.alpha = 0.55;
      c.addChild(shot);
      const bg = new PIXI.Graphics();
      bg.rect(0, 0, G.W, G.H).fill({ color: 0x03060d, alpha: 0.55 });
      bg.rect(0, G.H * 0.3, G.W, G.H * 0.42).fill({ color: 0x03060d, alpha: 0.35 });
      c.addChild(bg);
      const deco = new PIXI.Graphics();
      deco.moveTo(G.W / 2 - 300, G.H / 2 - 96).lineTo(G.W / 2 - 60, G.H / 2 - 96).stroke({ width: 1.6, color: 0xe8c27a, alpha: 0.55 });
      deco.moveTo(G.W / 2 + 60, G.H / 2 - 96).lineTo(G.W / 2 + 300, G.H / 2 - 96).stroke({ width: 1.6, color: 0xe8c27a, alpha: 0.55 });
      deco.poly([G.W / 2, G.H / 2 - 102, G.W / 2 + 7, G.H / 2 - 96, G.W / 2, G.H / 2 - 90, G.W / 2 - 7, G.H / 2 - 96]).fill({ color: 0xe8c27a, alpha: 0.9 });
      deco.moveTo(G.W / 2 - 210, G.H / 2 + 66).lineTo(G.W / 2 + 210, G.H / 2 + 66).stroke({ width: 1, color: 0x9fd0ff, alpha: 0.25 });
      c.addChild(deco);
      const t = new PIXI.Text({
        text: '마지막 성문의 수호자',
        style: { fontFamily: G.FONT, fontSize: 58, fontWeight: '900', fill: 0xeaf4ff, letterSpacing: 8, stroke: { color: 0x0a1c38, width: 8 } },
      });
      t.anchor.set(0.5);
      t.x = G.W / 2; t.y = G.H / 2 - 34;
      c.addChild(t);
      const sub = new PIXI.Text({
        text: 'THE LAST GATEKEEPER   ·   전투 ' + G.VERSION.split('-')[0],
        style: { fontFamily: G.FONT, fontSize: 18, fontWeight: '700', fill: 0x8fb8e0, letterSpacing: 3 },
      });
      sub.anchor.set(0.5);
      sub.x = G.W / 2; sub.y = G.H / 2 + 30;
      c.addChild(sub);
      // 시작 버튼
      const btn = new PIXI.Graphics();
      const bw = 300, bh = 56, bx = G.W / 2 - bw / 2, by = G.H / 2 + 88;
      const p = [bx + 14, by, bx + bw - 14, by, bx + bw, by + 14, bx + bw, by + bh - 14,
        bx + bw - 14, by + bh, bx + 14, by + bh, bx, by + bh - 14, bx, by + 14];
      btn.poly(p).fill({ color: 0x142a44, alpha: 0.8 });
      btn.poly(p).stroke({ width: 1.8, color: 0xe8c27a, alpha: 0.7 });
      c.addChild(btn);
      const bt = new PIXI.Text({
        text: '터치하여 시작',
        style: { fontFamily: G.FONT, fontSize: 22, fontWeight: '900', fill: 0xf6e6c0, letterSpacing: 3 },
      });
      bt.anchor.set(0.5);
      bt.x = G.W / 2; bt.y = by + bh / 2;
      c.addChild(bt);
      this.introBtn = { g: btn, t: bt, y: by };
      c.zIndex = 120;              // HUD 위에 올려 타이틀 화면이 깔끔하게 덮이도록
      this.hud.root.visible = false;
      this.vignette.visible = false;
      const hint = new PIXI.Text({
        text: '음악은 시작한 뒤 잠시 후 흐릅니다 · 가로 화면 권장',
        style: { fontFamily: G.FONT, fontSize: 13, fill: 0x6f8fb0, letterSpacing: 1 },
      });
      hint.anchor.set(0.5);
      hint.x = G.W / 2; hint.y = G.H / 2 + 164;
      c.addChild(hint);
      this.root.addChild(c);
    }

    /* ---------------- 입력 ---------------- */
    handlePointerDown(x, y, id) {
      G.Sfx.resume();
      if (this.introC) {
        this._dismissIntro();
        return;
      }
      if (this.resultActive) {
        const hit = this.overlayButtons.find((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
        if (hit) { hit.fn(); G.Sfx.ui(true); }
        return;
      }
      if (this.paused) {
        const hit = this.overlayButtons.find((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
        if (hit) { hit.fn(); G.Sfx.ui(true); }
        return;
      }
      this.hud.pointerDown(x, y, id);
    }

    _dismissIntro() {
      if (!this.introC) return;
      const c = this.introC;
      this.introC = null;
      this.hud.root.visible = true;
      this.vignette.visible = true;
      if (this.introBtn) this.introBtn = null;
      this.introT = 0;
      this.introFade = c;
      this.start();
    }

    handlePointerMove(x, y, id) { this.hud.pointerMove(x, y, id); }
    handlePointerUp(x, y, id) { this.hud.pointerUp(x, y, id); }

    togglePause() {
      if (this.phase === 'victory' || this.phase === 'defeat') return;
      this.paused = !this.paused;
      if (this.paused) this._buildPauseOverlay();
      else this._clearOverlay();
    }

    cycleAuto() {
      const i = AUTO_CYCLE.indexOf(this.autoMode);
      this.autoMode = AUTO_CYCLE[(i + 1) % AUTO_CYCLE.length];
      const msg = { full: 'AUTO · 완전 자동', counter: 'AUTO · 반격만 수동', manual: 'MANUAL · 완전 수동' }[this.autoMode];
      this.showPrompt(msg, this.autoMode === 'manual' ? 0xffb0a0 : 0x9fe8ff, 1.2);
    }

    showPrompt(msg, color = 0xffffff, dur = 1.6) {
      this.promptMsg = msg;
      this.promptT = dur;
      this.promptMax = dur;
      this.promptColor = color;
      this.hud.promptText.style.fill = color;
    }

    /* ---------------- 데미지 ---------------- */
    heroStrike(hero, cfg, idx = 0) {
      const near = this._nearestEnemy();
      const reachDist = near ? G.clamp(Math.abs(near.x - hero.x) * 0.55, 110, 260) : 170;
      const cx = hero.x + 78 * hero.facing;
      const cy = hero.centerY;
      const heavy = idx === 2;
      const f = hero.facing || 1;
      // 검궤적: 바깥 잔광 + 골드 테두리 + 시안 + 백색 코어 (2색 검기)
      this.fx.slash(cx, cy, {
        radius: heavy ? 206 : 162, spread: cfg.spread * 0.95, angle: cfg.ang,
        width: heavy ? 27 : 20,
        color: heavy ? 0x2f6bff : 0x3f7dff,
        color2: heavy ? 0x9fd6ff : 0x8fd0ff,
        edge: heavy ? 0xffd166 : 0xbfe4ff,
        dur: heavy ? 0.26 : 0.19, scale: 1.0,
      });
      this.fx.slash(cx + 10 * f, cy - 4, {
        radius: heavy ? 156 : 126, spread: cfg.spread * 0.72, angle: cfg.ang - 0.07, width: 8,
        color: 0xffffff, color2: 0xffffff, dur: 0.13, scale: 1.0,
      });
      this.fx.trail(hero, cfg, idx);
      // 타격 지점 섬광 (별 + 방사 버스트 + 스파크)
      const hx = cx + (reachDist - 20) * f;
      this.fx.burst(hx, cy, {
        color: 0x9fd6ff, core: 0xffffff, rays: heavy ? 22 : 16, length: heavy ? 210 : 155,
        width: heavy ? 9 : 7, dur: 0.19, angle: cfg.ang * 0.3,
      });
      this.fx.sparkBurst(hx, cy, heavy ? 0xffe0a0 : 0xbfe4ff, heavy ? 14 : 9, heavy ? 520 : 360, cfg.ang);
      if (heavy) {
        this.fx.shockRing(hero.x + 150 * f, hero.y - 8, 0x9fd6ff, 260, 0.5);
        this.fx.groundBurst(hero.x + 170 * f, hero.y);
      }

      let hits = 0;
      let critHit = false;
      this.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        const inFront = e.x > hero.x - 30;
        const inRange = Math.abs(e.x - hero.x) < cfg.reach + 40 && Math.abs(e.y - hero.y) < 150;
        if (inFront && inRange) {
          hits++;
          if (this._hitEnemy(e, hero, cfg.dmg, cfg)) critHit = true;
        }
      });
      if (this.boss && this.boss.alive && !this.boss.dying) {
        if (Math.abs(this.boss.x - hero.x) < cfg.reach + 260 && Math.abs(this.boss.y - hero.y) < 200) {
          if (this.boss.x > hero.x - 60) {
            hits++;
            if (this._hitBoss(hero, cfg.dmg, cfg)) critHit = true;
          }
        }
      }
      if (hits > 0) {
        this.hitStop = cfg.hitStop * (critHit ? 1.25 : 1);
        this.scene.shake(cfg.shake * (critHit ? 1.3 : 1), 0.16 + idx * 0.03);
        this.flashImpact(heavy ? 0.1 : 0.05);
        if (critHit) this.flashImpact(0.09, 0xffe6a8);
        G.Sfx.hit(heavy || critHit);
        this.combo += hits;
        this.comboT = 2.4;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      } else {
        this.hitStop = Math.min(this.hitStop, 0.012);
      }
    }

    flashImpact(alpha, color = 0xbfe4ff) {
      this.flashG.clear();
      this.flashG.rect(0, 0, G.W, G.H).fill({ color, alpha });
      this.flashT = 0.06;
    }

    _hitEnemy(e, hero, mult, cfg) {
      const crit = G.chance(0.24);
      const dmg = Math.round(hero.atk * mult * (crit ? 1.95 : 1) * G.rand(1.08, 0.94));
      this.stats.damage += dmg;
      const knock = cfg ? (cfg.advance > 24 ? 420 : cfg.advance > 18 ? 300 : 230) : 200;
      e.takeDamage(dmg, { crit, knock });
      if (crit) {
        if (this.time - (this._critPop || -9) > 0.3) {
          this._critPop = this.time;
          this.fx.popText(e.x, e.centerY - 96, 'CRITICAL', { color: 0xffd166, size: 21, dur: 0.7, stroke: 0x3a1e04, letter: 2 });
        }
        this.fx.debris(e.x, e.centerY, 5, 0xffe0a0, 1.0);
        G.Sfx.hit(true);
      }
      return crit;
    }

    _hitBoss(hero, mult, cfg) {
      const crit = G.chance(0.24);
      const dmg = Math.round(hero.atk * mult * (crit ? 1.95 : 1) * G.rand(1.1, 0.92));
      this.stats.damage += dmg;
      this.boss.takeDamage(dmg, { crit, kb: cfg && cfg.advance > 24 ? 90 : 40 });
      if (crit) {
        if (this.time - (this._critPop || -9) > 0.3) {
          this._critPop = this.time;
          this.fx.popText(this.boss.x - 40, this.boss.centerY - 110, 'CRITICAL', { color: 0xffd166, size: 21, dur: 0.7, stroke: 0x3a1e04, letter: 2 });
        }
        G.Sfx.hit(true);
      }
      return crit;
    }

    damageHero(amount, fromX) {
      if (this.phase === 'victory' || this.phase === 'defeat') return;
      const kael = this.kael;
      if (kael.hurt(amount, fromX)) {
        this.scene.shake(11, 0.3);
        this.flashG.clear();
        this.flashG.rect(0, 0, G.W, G.H).fill({ color: 0xff1a2a, alpha: 0.16 });
        this.flashT = 0.14;
        G.Sfx.hit(true);
        if (kael.hp <= 0) this._defeat();
      }
    }

    /* ---------------- 웨이브/보스 ---------------- */
    spawnWave() {
      this.waveIndex++;
      const cfg = this.waves[Math.min(this.waveIndex, this.waves.length - 1)];
      for (let i = 0; i < cfg.count; i++) {
        const delay = i * G.rand(0.28, 0.12) + G.rand(0.2, 0);
        this.after(delay, () => {
          if (this.phase !== 'wave') return;
          this._spawnEnemy(cfg, 1000 + G.rand(140, 0));
        });
      }
    }

    _spawnEnemy(cfg, x) {
      const e = new G.Enemy(this, {
        hp: cfg.hp + this.waveIndex * 12,
        atk: cfg.atk,
        x: x || 1240,
        y: G.GROUND_Y - 2 + G.rand(34, -30),
        scale: G.rand(0.6, 0.46),
        lv: 2 + Math.min(3, this.waveIndex),
      });
      this.enemies.push(e);
      this.actorLayer.addChild(e.obj);
      return e;
    }

    spawnAdds(n) {
      for (let i = 0; i < n; i++) {
        this.after(0.38 * i, () => {
          if (this.phase !== 'boss') return;
          this._spawnEnemy({ hp: 200, atk: 12 }, 1180 + G.rand(120, 0));
        });
      }
    }

    enterBossPhase() {
      if (this.phase === 'boss' || this.phase === 'bossIntro') return;
      this.phase = 'bossIntro';
      this.phaseT = 0;
      this.phaseBanner = 2.6;
      this.phaseMsg = 'BOSS · 그림자 군주 아르카논';
      G.Sfx.bossRoar();
      this.scene.shake(14, 0.9);
      this.scene.zoomTo(1.06, 1.4);
      // 남은 잡몹 정리
      this.enemies.forEach((e) => { if (e.alive && !e.dying) e.die(); });
      this.after(0.7, () => {
        this.boss = new G.Boss(this, { hp: 24000, x: 820 });
        this.actorLayer.addChild(this.boss.obj);
        this.bossSpawned = true;
        this.fx.shockRing(820, G.GROUND_Y - 10, 0xff3355, 300, 0.9);
        this.fx.sparkBurst(820, G.GROUND_Y - 180, 0xff6b4a, 34, 620);
        this.fx.debris(820, G.GROUND_Y - 6, 12, 0xff8a6a, 1.3);
      });
      this.after(2.1, () => {
        this.phase = 'boss';
        this.timeLeft = 180;
        this.showPrompt('보스 등장!', 0xff8a99, 1.6);
      });
    }

    onEnemyKilled(e) {
      this.stats.kills++;
      this.combo += 1;
      this.comboT = 2.4;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    }

    onBossKilled() {
      this.stats.kills++;
      this.scene.shake(18, 1.2);
      this.scene.zoomTo(1.12, 1.6);
      this.hitStop = 0.18;
      G.Sfx.counter();
      this.after(1.6, () => this._victory());
    }

    onPerfectCounter(boss) {
      this.perfectCounter = false;
      this.hitStop = 0.14;
      this.slowT = 0.85;
      this.scene.zoomTo(1.09, 0.4);
      this.scene.shake(18, 0.6);
      this.flashImpact(0.22, 0xfff2c0);
      this.fx.popText(640, 300, 'PERFECT COUNTER', { color: 0xffe9a8, size: 52, dur: 1.4, stroke: 0x3a2404, letter: 4 });
      // 카엘 주변에서 보스로 뻗는 골드 충격파
      this.fx.ring(this.kael.x + 40, this.kael.centerY, 0xfff2c0, 300, 0.6, 8, 0.7);
      this.fx.ring(boss.x - 60, boss.y - 40, 0xffe9a8, 260, 0.55, 9, 0.8);
      this.fx.shockRing(boss.x - 70, boss.y - 6, 0xffd166, 300, 0.6);
      this.fx.burst(boss.x - 70, boss.centerY, { color: 0xffd166, core: 0xffffff, rays: 22, length: 230, width: 10, dur: 0.32 });
      this.fx.sparkBurst(this.kael.x + 120, this.kael.centerY, 0xfff0b0, 34, 780);
      this.fx.sparkBurst(boss.x - 60, boss.centerY, 0xfff0b0, 30, 700);
      this.fx.speedLines(boss.x - 60, boss.centerY, 1, 10, 1.4);
      this.fx.speedLines(boss.x - 60, boss.centerY, -1, 10, 1.4);
      const dmg = 980;
      this.stats.damage += dmg;
      boss.takeDamage(dmg, { crit: true });
      this.combo += 6;
      this.comboT = 2.6;
      this.kael.invuln = 1.2;
      this.kael.hp = Math.min(this.kael.hpMax, this.kael.hp + 45);
      G.Sfx.counter();
      this.after(0.7, () => this.scene.zoomTo(1.0, 0.6));
    }

    /* ---------------- 스킬 ---------------- */
    useSkill1() {
      const h = this.kael;
      if (this.cooldowns.skill1 > 0 || h.mp < 25 || h.state === 'dead') return false;
      h.mp -= 25;
      this.cooldowns.skill1 = this.skillMax.skill1;
      h.facing = 1;
      h.cast();
      this.kaelSkillActive = 3;
      G.Sfx.magic();
      this.showPrompt('성문의 참격', 0x9fd6ff, 0.9);
      return true;
    }

    useSkill2() {
      if (this.cooldowns.skill2 > 0 || this.lia.mp < 40) return false;
      if (this.lia.active) return false;
      this.lia.mp -= 40;
      this.cooldowns.skill2 = this.skillMax.skill2;
      G.Sfx.magic();

      const target = this._densestTarget();
      const tx = target ? G.clamp(target.x, 280, 1060) : 900;
      const ty = target ? target.y : G.GROUND_Y;

      // 1) 컷인 (리아 등장 연출)
      this._liaCutIn();
      // 2) 소환 마법진 + 리아 강림
      this.summonActive = true;
      this.after(0.24, () => {
        this.fx.rune(tx - 60, ty - 20, 0xb98bff, 150, 1.0);
        this._spawnLia(tx - 150, ty - 2);
      });
      // 3) 빛의 심판 — 빛기둥 + 광역 피해 + 넉백
      this.after(0.62, () => {
        this.fx.pillar(tx, ty - 10, 0xe8f2ff, 680, 1.05, 240);
        this.fx.pillar(tx - 90, ty - 10, 0xc9a8ff, 520, 0.9, 110);
        this.fx.pillar(tx + 90, ty - 10, 0xc9a8ff, 520, 0.9, 110);
        this.fx.ring(tx, ty - 10, 0xd7c2ff, 280, 0.75, 10);
        this.fx.ring(tx, ty - 10, 0xffffff, 170, 0.5, 5);
        this.fx.sparkBurst(tx, ty - 90, 0xd9c8ff, 36, 620);
        this.fx.groundBurst(tx, ty);
        this.flashImpact(0.16);
        this.scene.shake(12, 0.42);
        this.hitStop = 0.06;
        let n = 0;
        this.enemies.forEach((e) => {
          if (e.alive && !e.dying && Math.abs(e.x - tx) < 260) {
            const dmg = Math.round(this.lia.atk * 3.4 * G.rand(1.05, 0.95));
            this.stats.damage += dmg;
            const delay = n++ * 0.06;
            this.after(delay, () => {
              if (e.alive && !e.dying) e.takeDamage(dmg, { crit: true, color: 0xd9c8ff, knock: 520 });
            });
          }
        });
        if (this.boss && this.boss.alive && !this.boss.dying && Math.abs(this.boss.x - tx) < 320) {
          const dmg = Math.round(this.lia.atk * 3.2);
          this.stats.damage += dmg;
          this.boss.takeDamage(dmg, { crit: true, kb: 70 });
        }
        G.Sfx.hit(true);
        this.combo += 3;
        this.comboT = 2.8;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      });
      this.after(1.9, () => { this.summonActive = false; });
      return true;
    }

    /* 리아 컷인: 화면 좌측에서 초상화가 미끄러져 들어왔다가 사라진다 */
    _liaCutIn() {
      if (this.cutin) {
        this.cutin.destroy({ children: true });
        this.cutin = null;
      }
      const c = new PIXI.Container();
      c.zIndex = 15;
      const band = new PIXI.Graphics();
      band.poly([-30, 150, 500, 76, 610, 330, -30, 460]).fill({ color: 0x140a2a, alpha: 0.86 });
      band.poly([-30, 180, 500, 106, 590, 310, -30, 430]).fill({ color: 0x6d3bd1, alpha: 0.22 });
      band.poly([-30, 450, 200, 360, 240, 374, -30, 476]).fill({ color: 0xc9a8ff, alpha: 0.35 });
      c.addChild(band);

      const por = new PIXI.Sprite(G.Assets.tex.portraitLia);
      por.anchor.set(0.5);
      por.width = 300; por.height = 300;
      por.x = 168; por.y = 268;
      c.addChild(por);

      const g = new PIXI.Sprite(G.Assets.tex.glow);
      g.anchor.set(0.5);
      g.blendMode = 'add';
      g.tint = 0xb98bff;
      g.width = 520; g.height = 520;
      g.x = 168; g.y = 278;
      g.alpha = 0.35;
      c.addChild(g);

      const name = new PIXI.Text({
        text: '리아 · 빛의 심판',
        style: G.style({ fontSize: 40, fontWeight: '900', fill: 0xf4ecff, letterSpacing: 3, stroke: { color: 0x2a1052, width: 8 } }),
      });
      name.anchor.set(0, 0.5);
      name.x = 322; name.y = 242;
      c.addChild(name);

      const sub = new PIXI.Text({
        text: 'SUMMON  ·  기록관의 빛',
        style: G.style({ fontSize: 17, fill: 0xc9b0ff, fontWeight: '800', letterSpacing: 2 }),
      });
      sub.anchor.set(0, 0.5);
      sub.x = 326; sub.y = 290;
      c.addChild(sub);

      c.x = -640;
      c.alpha = 0;
      this.root.addChild(c);
      this.cutin = c;
      this.cutT = 0;
    }

    _spawnLia(x, y) {
      const L = this.lia;
      if (L.obj) {
        L.obj.destroy({ children: true });
        L.obj = null;
      }
      const a = G.Assets.anim.lia;
      if (!a) return;
      const o = new PIXI.Container();
      const sh = new PIXI.Sprite(G.Assets.tex.shadow);
      sh.anchor.set(0.5);
      sh.width = 160; sh.height = 54;
      sh.alpha = 0.34;
      o.addChild(sh);
      const spr = new PIXI.AnimatedSprite(a.frames);
      spr.anchor.set(a.ax, a.ay);
      const sc = 340 / (a.fh || 465);
      spr.scale.set(sc);
      spr.animationSpeed = 0;
      spr.gotoAndStop(0);
      o.addChild(spr);

      const glow = new PIXI.Sprite(G.Assets.tex.glow);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = 0xb98bff;
      glow.width = 420; glow.height = 420;
      glow.y = -190;
      glow.alpha = 0.38;
      o.addChildAt(glow, 0);

      const rune = new PIXI.Graphics();
      rune.y = -4;
      rune.circle(0, 0, 96).stroke({ width: 3, color: 0xc9a8ff, alpha: 0.9 });
      rune.circle(0, 0, 72).stroke({ width: 1.6, color: 0xe4d6ff, alpha: 0.7 });
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * G.TAU;
        rune.moveTo(Math.cos(ang) * 72, Math.sin(ang) * 72 * 0.32);
        rune.lineTo(Math.cos(ang + 0.22) * 96, Math.sin(ang + 0.22) * 96 * 0.32);
      }
      rune.stroke({ width: 1.4, color: 0xc9a8ff, alpha: 0.7 });
      o.addChildAt(rune, 0);

      o.x = x; o.y = y; o.zIndex = y;
      this.actorLayer.addChild(o);

      L.obj = o; L.sprite = spr; L.glow = glow; L.rune = rune;
      L.shadow = sh;
      L.x = x; L.y = y; L.t = 0; L.active = true; L.dur = 1.6;

      this.fx.ring(x, y - 6, 0xb98bff, 180, 0.6, 5, 0.4);
      this.fx.sparkBurst(x, y - 140, 0xd9c8ff, 22, 440);
      this.fx.shockRing(x, y - 6, 0xc9a8ff, 200, 0.6);
      G.Sfx.magic();
    }

    _densestTarget() {
      let best = null, bestScore = -1;
      this.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        const score = this.enemies.filter((o) => o.alive && Math.abs(o.x - e.x) < 180).length + (e.x > 700 ? 0.5 : 0);
        if (score > bestScore) { bestScore = score; best = e; }
      });
      if (!best && this.boss && this.boss.alive) return this.boss;
      return best;
    }

    /* ---------------- 메인 루프 ---------------- */
    update(realDt) {
      this.time += realDt;

      if (this.introFade) {
        this.introT += realDt;
        const p = G.clamp(this.introT / 1.1, 0, 1);
        this.introFade.alpha = 1 - p;
        if (p >= 1) {
          this.introFade.destroy({ children: true });
          this.introFade = null;
        }
      }

      if (this.flashT > 0) {
        this.flashT -= realDt;
        if (this.flashT <= 0) this.flashG.clear();
      }

      if (this.paused || this.introC) {
        this.scene.update(realDt * 0.2);
        return;
      }

      // 히트스톱 / 슬로우
      let dt = realDt;
      if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - realDt); dt = realDt * 0.08; }
      if (this.slowT > 0) { this.slowT -= realDt; dt *= 0.35; }

      this._processTimers(dt);
      this.scene.update(dt);

      // 입력
      const inp = this.hud.consume();
      const k = this.keys;
      let mx = inp.moveX, my = inp.moveY;
      const kx = (k['ArrowRight'] || k['d'] ? 1 : 0) - (k['ArrowLeft'] || k['a'] ? 1 : 0);
      const ky = (k['ArrowDown'] || k['s'] ? 1 : 0) - (k['ArrowUp'] || k['w'] ? 1 : 0);
      if (kx || ky) {
        const len = Math.hypot(kx, ky) || 1;
        mx = kx / len; my = ky / len;
      }
      const manualMove = Math.abs(mx) > 0.12 || Math.abs(my) > 0.12;

      if (inp.pause) this.togglePause();
      if (inp.mute) { this.muted = G.Sfx.toggleMute(); }
      if (inp.auto) this.cycleAuto();

      if (this.phase === 'wave' || this.phase === 'boss' || this.phase === 'bossIntro') {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
      }

      if (this.phase === 'wave' && this.timeLeft <= 0) this.enterBossPhase();
      if (this.phase === 'boss' && this.timeLeft <= 0) this._defeat('시간 초과');

      // 조작
      if (inp.attack) this._tryAttack();
      if (this.attackBuffer > 0) {
        this.attackBuffer -= dt;
        this._tryAttack();
      }
      if (inp.skill1) this.useSkill1();
      if (inp.skill2) this.useSkill2();
      if (inp.dodge) this._tryDodge();

      if (this.autoMode !== 'manual') this._autoAI(dt);
      if (manualMove && this.kael.state !== 'dead') {
        const sp = 260;
        this.kael.moveSpeed = Math.abs(mx) * sp;
        this.kael.move(mx * sp, my * sp * 0.6, dt);
      } else if (this.autoMode !== 'manual') {
        this._autoMove(dt);
      }

      // 공격 쿨다운
      this.atkCD -= dt;
      if (this.atkCD <= 0.42) this.atkCD = Math.max(this.atkCD, 0);

      // 스킬 쿨다운 (수동 모드에서도 흐른다)
      this.cooldowns.skill1 = Math.max(0, this.cooldowns.skill1 - dt);
      this.cooldowns.skill2 = Math.max(0, this.cooldowns.skill2 - dt);

      // 콤보 유지 시간이 지나면 1타로 리셋
      if (this.comboWindow > 0) {
        this.comboWindow -= dt;
        if (this.comboWindow <= 0) this.comboStep = 0;
      }

      this.kael.update(dt, this.time);
      this.lia.update(dt);

      // 컷인 연출
      if (this.cutin) {
        this.cutT += realDt;
        const tin = G.clamp(this.cutT / 0.18, 0, 1);
        const tout = G.clamp((this.cutT - 0.85) / 0.28, 0, 1);
        this.cutin.x = -640 * (1 - G.easeOutCubic(tin)) - 320 * G.easeInCubic(tout);
        this.cutin.alpha = (this.cutT < 0.85 ? G.clamp(this.cutT / 0.12, 0, 1) : 1 - tout);
        if (this.cutT > 1.14) {
          this.cutin.destroy({ children: true });
          this.cutin = null;
        }
      }

      // 콤보 타이머
      if (this.comboT > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;
      }

      // 웨이브 진행
      if (this.phase === 'wave') {
        const alive = this.enemies.filter((e) => e.alive && !e.dying).length;
        if (this.phaseT > 1.4 && alive === 0) {
          this.nextWaveDelay -= dt;
          if (this.nextWaveDelay <= 0) {
            if (this.waveIndex + 1 >= this.waves.length) {
              this.enterBossPhase();
            } else {
              this.spawnWave();
              this.kael.hp = Math.min(this.kael.hpMax, this.kael.hp + 55);
              this.nextWaveDelay = 1.2;
              this.phaseBanner = 1.4;
              this.phaseMsg = `WAVE ${this.waveIndex + 1}`;
            }
          }
        }
      }
      if (this.phase === 'boss' && !this.bossSpawned) this._lateBossSpawn();

      // 적들
      this.enemies.forEach((e) => e.update(dt, this.time, this.kael));
      this.enemies = this.enemies.filter((e) => !e.dead);

      // 보스
      if (this.boss && this.boss.alive) {
        this.boss.update(dt, this.time, this.kael);
        this._bossWindow(dt);
      }

      // 마법 탄
      this._updateProjectiles(dt);

      // 카엘 스킬 참격 연출
      if (this.kaelSkillActive > 0) {
        this.kaelSkillActive -= dt;
        this.kaelSkillTick = (this.kaelSkillTick || 0) - dt;
        if (this.kaelSkillTick <= 0) {
          this.kaelSkillTick = 0.11;
          const h = this.kael;
          this.fx.slash(h.x + 150, h.centerY - 20, {
            radius: 160, spread: 1.1, angle: G.rand(-0.15, -0.75), width: 17,
            color: 0x2f7bff, color2: 0x7fc8ff, edge: 0xffd166, dur: 0.24,
          });
          this.fx.slash(h.x + 175, h.centerY, {
            radius: 176, spread: 1.0, angle: G.rand(0.45, 0.05), width: 7,
            color: 0xffffff, color2: 0xffffff, dur: 0.17,
          });
          this.fx.speedLines(h.x + 120, h.centerY, 1, 4, 1.1);
          this.scene.shake(7, 0.2);
          [this.enemies, this.boss && this.boss.alive ? [this.boss] : []].forEach(() => {});
          this.enemies.forEach((e) => {
            if (e.alive && !e.dying && e.x > h.x && Math.abs(e.x - h.x) < 340) {
              const dmg = Math.round(h.atk * 1.35 * G.rand(1.05, 0.95));
              this.stats.damage += dmg;
              e.takeDamage(dmg, { crit: G.chance(0.3) });
            }
          });
          if (this.boss && this.boss.alive && !this.boss.dying && Math.abs(this.boss.x - h.x) < 470) {
            const dmg = Math.round(h.atk * 1.2);
            this.stats.damage += dmg;
            this.boss.takeDamage(dmg, {});
          }
          G.Sfx.slash(1.3);
          this.hitStop = 0.035;
        }
      }

      this.fx.update(dt);
      this.hud.update(realDt, this);
      this.phaseT += realDt;
    }

    _lateBossSpawn() {}

    _tryAttack() {
      if (this.kael.state === 'dead') return;
      if (this.kael.state === 'attack') {
        // 공격 중 입력은 버퍼링해서 콤보로 이어진다
        if (this.kael.stateT > this.kael.atkCfg.dur * 0.55) this.attackBuffer = 0.34;
        return;
      }
      if (this.kael.state === 'dodge' || this.kael.state === 'cast') return;
      if (this.kael.attack(this.comboStep)) {
        // 2·3타는 앞으로 미세 전진 (콤보 손맛)
        const adv = this.kael.atkCfg.advance;
        this.kael.x = G.clamp(this.kael.x + adv, 140, 820);
        this.kael.obj.x = this.kael.x;
        this.comboStep = this.kael.comboStep;
        this.comboWindow = 0.62;
        this.atkCD = this.kael.atkCfg.dur * 0.55;
        this.attackBuffer = 0;
      }
    }

    _tryDodge() {
      if (this.kael.state === 'dead') return;
      const wasDodge = this.kael.state === 'dodge';
      if (this.kael.dodgeCD > 0 || this.kael.state === 'attack') {
        if (this.kael.state !== 'attack') return;
        this.kael.state = 'dodge';
        this.kael.stateT = 0;
        this.kael.dodgeFrom = this.kael.x;
        this.kael.dodgeDist = 150;
        this.kael.invuln = 0.36;
      } else {
        this.kael.dodge();
      }
      if (wasDodge) return;
      // 회피가 실제로 시작된 뒤에만 퍼펙트 반격을 인정한다.
      if (this.perfectWindow && this.boss && this.boss.state === 'windup' && this.boss.kind === 'perfect') {
        this.perfectWindow = false;
        this.perfectCounter = true;
        G.Sfx.counter();
      }
      // 회피 이펙트 + 잔상
      this.fx.sparkBurst(this.kael.x - 20, this.kael.centerY, 0x9fd6ff, 10, 240, Math.PI);
      this.fx.ring(this.kael.x, this.kael.y - 6, 0x9fd6ff, 90, 0.35, 3, 0.4);
      this.fx.speedLines(this.kael.x + 30, this.kael.centerY, 1, 5, 1.0);
      this.fx.afterimage(this.kael, 0.55);
    }

    _bossWindow() {
      const b = this.boss;
      if (!b || b.dying) { this.perfectWindow = false; return; }
      if (b.state === 'windup' && b.kind === 'perfect') {
        const p = b.stateT / b.cfg.tele;
        this.perfectWindow = p > 0.5 && p < 1.0;
        if (p > 0.62 && !this._perfectHintShown) {
          this._perfectHintShown = true;
          this.showPrompt('회피 타이밍!', 0xffffff, 0.7);
        }
        if (this.autoMode === 'full' && p > 0.78) this._tryDodge();
      } else {
        this.perfectWindow = false;
        this._perfectHintShown = false;
      }

      // 자동 회피 (반격만 수동 모드에서도 일반 공격은 회피)
      if (this.autoMode !== 'manual' && b.state === 'windup' && b.kind !== 'perfect') {
        const tLeft = b.cfg.tele - b.stateT;
        const inside = Math.abs(this.kael.x - b.teleX) < b.cfg.radius * 1.05;
        if (tLeft < 0.3 && tLeft > 0 && inside && this.kael.dodgeCD <= 0 && this.kael.state !== 'dodge' && this.kael.state !== 'attack') {
          this.kael.dodge();
          this.fx.ring(this.kael.x, this.kael.y - 8, 0x9fd6ff, 90, 0.35, 3);
        }
      }

    }

    _autoAI(dt) {
      const target = this._nearestEnemy();

      // 스킬 사용 (적이 전투 사거리 안에 들어왔을 때만)
      const closeTarget = target && Math.abs(target.x - this.kael.x) < 330;
      if (closeTarget && this.cooldowns.skill1 <= 0 && this.kael.mp >= 30 && this.kael.state !== 'attack') {
        this.useSkill1();
      }
      if (closeTarget && this.cooldowns.skill2 <= 0 && this.lia.mp >= 45 && !this.lia.active) {
        this.useSkill2();
      }

      // 기본 공격
      if (target && this.atkCD <= 0 && this.kael.state !== 'attack' && this.kael.state !== 'cast') {
        const reach = target === this.boss ? 430 : 340;
        if (Math.abs(target.x - this.kael.x) < reach) {
          this._tryAttack();
        }
      }
    }

    _autoMove(dt) {
      const target = this._nearestEnemy();
      if (!target) return;
      const dist = target.x - this.kael.x;
      const desired = target === this.boss ? 250 : 400;
      let mx = 0;
      if (dist > desired + 40) mx = 1;
      else if (dist < desired - 150) mx = -0.6;
      if (Math.abs(mx) > 0.01) {
        this.kael.moveSpeed = Math.abs(mx) * 210;
        this.kael.move(mx * 210, 0, dt);
      }
      this.kael.x = G.clamp(this.kael.x, 300, 420);
      this.kael.obj.x = this.kael.x;
      // y 정렬
      const dy = target.y - this.kael.y;
      if (Math.abs(dy) > 14) this.kael.move(0, Math.sign(dy) * 55, dt);
    }

    _nearestEnemy() {
      let best = null, bd = 1e9;
      this.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        const d = Math.abs(e.x - this.kael.x);
        if (d < bd) { bd = d; best = e; }
      });
      if (!best && this.boss && this.boss.alive && !this.boss.dying) return this.boss;
      return best;
    }

    _updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.t += dt;
        const k = G.clamp(p.t / p.dur, 0, 1);
        const e = G.easeInQuad(k);
        p.spr.x = G.lerp(p.from.x, p.to.x, e);
        p.spr.y = G.lerp(p.from.y, p.to.y, e) - Math.sin(k * Math.PI) * 26;
        p.trailT -= dt;
        if (p.trailT <= 0) {
          p.trailT = 0.03;
          this.fx._particle(p.spr.x, p.spr.y, {
            color: 0xc9a8ff, size: G.rand(20, 8), vx: G.rand(30, -30), vy: G.rand(30, -30), life: 0.28, additive: true,
          });
        }
        if (k >= 1) {
          p.spr.destroy();
          this.projectiles.splice(i, 1);
          this.fx.impact(p.to.x, p.to.y, 0xd9c8ff, 1.1);
          this.fx.sparkBurst(p.to.x, p.to.y, 0xd0b8ff, 12, 320);
          if (p.target && p.target.alive && !p.target.dying) {
            const dmg = Math.round(this.lia.atk * G.rand(1.15, 0.85));
            this.stats.damage += dmg;
            p.target.takeDamage(dmg, { crit: G.chance(0.15), color: 0xd9c8ff });
          } else if (this.boss && this.boss.alive && Math.abs(this.boss.x - p.to.x) < 160) {
            const dmg = Math.round(this.lia.atk * 0.9);
            this.stats.damage += dmg;
            this.boss.takeDamage(dmg, {});
          }
        }
      }
    }

    /* ---------------- 결과/오버레이 ---------------- */
    _clearOverlay() {
      this.overlay.removeChildren().forEach((c) => c.destroy({ children: true }));
      this.overlayButtons = [];
      this.resultActive = false;
      this.pauseActive = false;
    }

    _buildPauseOverlay() {
      this._clearOverlay();
      const c = new PIXI.Container();
      const bg = new PIXI.Graphics();
      bg.rect(0, 0, G.W, G.H).fill({ color: 0x02060d, alpha: 0.72 });
      c.addChild(bg);
      const g = new PIXI.Graphics();
      platePath(g, G.W / 2 - 230, 180, 460, 350, 16, 0x0a1626, 0.96);
      plateEdge(g, G.W / 2 - 230, 180, 460, 350, 16, 0xe8c27a, 0.75, 2);
      plateEdge(g, G.W / 2 - 224, 186, 448, 338, 14, 0x9fd0ff, 0.22, 1);
      gem(g, G.W / 2 - 230, 355, 7, 0xe8c27a, 0.95);
      gem(g, G.W / 2 + 230, 355, 7, 0xe8c27a, 0.95);
      c.addChild(g);
      const t = new PIXI.Text({ text: '일시정지', style: G.style({ fontSize: 36, fontWeight: '900', fill: 0xf6e6c0, letterSpacing: 5, stroke: { color: 0x2a1a08, width: 6 } }) });
      t.anchor.set(0.5); t.x = G.W / 2; t.y = 240;
      c.addChild(t);

      const mkBtn = (label, y, fn) => {
        const bg2 = new PIXI.Graphics();
        platePath(bg2, G.W / 2 - 150, y, 300, 54, 12, 0x14304d, 0.92);
        plateEdge(bg2, G.W / 2 - 150, y, 300, 54, 12, 0x7fb8e8, 0.8, 1.8);
        c.addChild(bg2);
        const lt = new PIXI.Text({ text: label, style: G.style({ fontSize: 20, fontWeight: '800', fill: 0xeaf4ff }) });
        lt.anchor.set(0.5); lt.x = G.W / 2; lt.y = y + 27;
        c.addChild(lt);
        this.overlayButtons.push({ x: G.W / 2 - 150, y, w: 300, h: 54, fn });
      };
      mkBtn('계속하기', 296, () => this.togglePause());
      mkBtn(this.muted ? '소리 켜기' : '소리 끄기', 362, () => {
        this.muted = G.Sfx.toggleMute();
        this._buildPauseOverlay();
      });
      mkBtn('처음부터', 428, () => { this.togglePause(); this._defeat('처음부터'); });
      this.overlay.addChild(c);
      this.pauseActive = true;
    }

    _defeat(reason = '') {
      if (this.phase === 'defeat') return;
      this.phase = 'defeat';
      this._buildResult(false, reason);
    }

    _victory() {
      if (this.phase === 'victory') return;
      this.phase = 'victory';
      this._buildResult(true);
    }

    _buildResult(win, reason = '') {
      this._clearOverlay();
      const c = new PIXI.Container();
      const bg = new PIXI.Graphics();
      bg.rect(0, 0, G.W, G.H).fill({ color: 0x02060d, alpha: 0.88 });
      c.addChild(bg);
      const g = new PIXI.Graphics();
      platePath(g, G.W / 2 - 290, 140, 580, 440, 18, 0x081422, 0.97);
      plateEdge(g, G.W / 2 - 290, 140, 580, 440, 18, win ? 0xffd166 : 0xff6b7a, 0.8, 2.2);
      plateEdge(g, G.W / 2 - 282, 148, 564, 424, 15, 0x9fd0ff, 0.2, 1);
      gem(g, G.W / 2 - 290, 360, 9, win ? 0xffd166 : 0xff6b7a, 0.95);
      gem(g, G.W / 2 + 290, 360, 9, win ? 0xffd166 : 0xff6b7a, 0.95);
      gem(g, G.W / 2, 140, 8, win ? 0xffd166 : 0xff6b7a, 0.9);
      c.addChild(g);

      const title = new PIXI.Text({
        text: win ? 'VICTORY' : 'DEFEAT',
        style: G.style({ fontSize: 54, fontWeight: '900', fill: win ? 0xffd166 : 0xff8899, letterSpacing: 8, stroke: { color: 0x1a0e04, width: 6 } }),
      });
      title.anchor.set(0.5); title.x = G.W / 2; title.y = 215;
      c.addChild(title);

      const sub = new PIXI.Text({
        text: win ? '아르카논을 쓰러뜨렸습니다' : `카엘이 쓰러졌습니다${reason ? ' · ' + reason : ''}`,
        style: G.style({ fontSize: 19, fill: 0xbcd8f0, fontWeight: '700' }),
      });
      sub.anchor.set(0.5); sub.x = G.W / 2; sub.y = 262;
      c.addChild(sub);

      const lines = [
        ['누적 피해량', G.num(this.stats.damage)],
        ['최대 콤보', `${this.stats.maxCombo} HIT`],
        ['처치 수', `${this.stats.kills}`],
        ['남은 시간', G.fmtTime(this.timeLeft)],
      ];
      lines.forEach(([k, v], i) => {
        const kt = new PIXI.Text({ text: k, style: G.style({ fontSize: 18, fill: 0x8fb0cc }) });
        kt.x = G.W / 2 - 170; kt.y = 320 + i * 36;
        c.addChild(kt);
        const vt = new PIXI.Text({ text: v, style: G.style({ fontSize: 20, fill: 0xeaf4ff, fontWeight: '900' }) });
        vt.anchor.set(1, 0); vt.x = G.W / 2 + 170; vt.y = 318 + i * 36;
        c.addChild(vt);
      });

      const btnY = 496;
      const bg2 = new PIXI.Graphics();
      platePath(bg2, G.W / 2 - 150, btnY, 300, 56, 12, win ? 0x2a3f1f : 0x14304d, 0.95);
      plateEdge(bg2, G.W / 2 - 150, btnY, 300, 56, 12, win ? 0xffd166 : 0x7fb8e8, 0.85, 2);
      c.addChild(bg2);
      const bt = new PIXI.Text({ text: '다시 도전', style: G.style({ fontSize: 22, fontWeight: '900', fill: 0xf2f8ff }) });
      bt.anchor.set(0.5); bt.x = G.W / 2; bt.y = btnY + 28;
      c.addChild(bt);
      this.overlayButtons = [{ x: G.W / 2 - 150, y: btnY, w: 300, h: 56, fn: () => this.restart() }];

      this.overlay.addChild(c);
      this.resultActive = true;
      this.overlay.alpha = 1;
    }

    restart() {
      this._clearOverlay();
      this.overlay.alpha = 1;
      // 액터 정리
      this.enemies.forEach((e) => { if (e.obj) e.obj.destroy({ children: true }); });
      this.enemies = [];
      if (this.boss && this.boss.obj) this.boss.obj.destroy({ children: true });
      this.boss = null;
      this.bossSpawned = false;
      this.projectiles.forEach((p) => p.spr.destroy());
      this.projectiles = [];
      this.fx.clear();
      this.actorLayer.removeChildren();
      this.stats = { damage: 0, maxCombo: 0, kills: 0 };
      this.combo = 0;
      this.cooldowns = { skill1: 0, skill2: 0 };
      this.timers.length = 0;
      if (this.cutin) { this.cutin.destroy({ children: true }); this.cutin = null; }
      this.comboStep = 0; this.comboWindow = 0; this.attackBuffer = 0;
      this.kael = null; this.lia = null;
      this._initActors();
      this.kael.hp = this.kael.hpMax;
      this.phase = 'wave';
      this.phaseT = 0;
      this.timeLeft = 60;
      this.scene.zoomTo(1, 0.4);
      this.scene.focus = 0;
      this.scene._focusTarget = 0;
      if (this.hud) { this.hud.hpGhost = 1; this.hud.mpGhost = 1; this.hud._bossGhostP = 1; }
      this.perfectWindow = false;
      this.perfectCounter = false;
      this.hitStop = 0;
      this.slowT = 0;
      this.time = 0;
      this.start();
      this.showPrompt('WAVE 1', 0xbfe0ff, 1.2);
    }
  }

  G.Game = Game;
})();
