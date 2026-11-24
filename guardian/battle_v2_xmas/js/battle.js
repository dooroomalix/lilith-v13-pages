/* battle.js : 전투 진행, 웨이브/보스 페이즈, AUTO AI, 데미지 판정, 오버레이 */
(function () {
  const AUTO_CYCLE = ['counter', 'full', 'manual'];

  /* 보스 컷인 배너 문구 — 시전하는 기술마다 이름이 바뀐다 */
  const BOSS_SKILL_CUTIN = {
    slam: { move: '지옥의 균열', en: 'ABYSSAL SLAM' },
    multi: { move: '삼중 그림자 파동', en: 'SHADOW WAVE' },
    perfect: { move: '암흑의 심판', en: 'DARK JUDGEMENT' },
  };

  /* 외전에서는 노엘의 기술 이름을 쓴다 */
  function bossSkillInfo(kind) {
    if (G.Xmas && G.Xmas.ON && G.Xmas.boss.skills[kind]) return G.Xmas.boss.skills[kind];
    return BOSS_SKILL_CUTIN[kind];
  }

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
      this.bossTeleLayer = new PIXI.Container();
      this.bossTeleLayer.zIndex = 515;
      this.scene.world.addChildAt(this.bossTeleLayer, 4);
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
      this.vignette.alpha = (G.Xmas && G.Xmas.ON) ? 0.46 : 0.62;
      this.vignette.zIndex = 5;
      this.root.addChild(this.vignette);

      this.overlay = new PIXI.Container();
      this.overlay.zIndex = 20;
      this.root.addChild(this.overlay);

      this.flashG = new PIXI.Graphics();
      this.flashG.alpha = 1;
      this.flashG.zIndex = 30;
      this.scene.root.addChild(this.flashG);

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
      this.queuedAttack = false;
      this.queuedJump = false;
      this.potions = 3;
      this.buffTime = 0;
      this.potionPulse = 0;
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
      this.bossCutin = null;
      this.bossCutT = 0;
      this.bossCutCD = 0;    // 보스 컷인 재발동 최소 간격(초)
      this.bossCutKind = null;
      this.bossCutLog = [];  // 검증용: 컷인 발동 시각·종류
      this.summonActive = false;
      this.bossSpawned = false;
      this.overlayButtons = [];
      this.time = 0;
      this.timers = [];
      this.kaelSkillActive = 0;
      this._critPop = 0;
      this._perfectHintShown = false;

      // 아라·보른·세나 지원 시스템 (쿨타임 자동 등장 + 컷인 + 보이스)
      this.support = new G.Support(this);

      // 성문 광장 등불 4개 — 소등 & 카엘 재점화 (외전 전용)
      this.lanterns = (G.Xmas && G.Xmas.ON) ? new G.Lanterns(this) : null;
      this.dialogueC = null;
      this.dialogueT = 0;
      this.dialogueDur = 0;
      this.lastLine = '';
      this.bossPhaseLog = [];
      this.bossCutDur = 1.22;

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
      this.phaseMsg = G.Xmas.ON ? G.Xmas.STAGE_MSG : 'STAGE 1 · 폐허의 거리';
      this.timeLeft = G.Xmas.ON ? 80 : 60;
      this.waveIndex = -1;
      this.waveQueue = [];
      this.nextWaveDelay = 0.8;
      this._buildWaves();
      this.spawnWave();
      G.Sfx.resume();
    }

    _buildWaves() {
      // 외전: 스노우볼 → 미믹 합류 → 루돌프 웨이브
      if (G.Xmas && G.Xmas.ON) {
        this.waves = [
          { list: ['snowball', 'snowball', 'snowball', 'snowball'], atk: 15, hpScale: 1.0 },
          { list: ['snowball', 'mimic', 'mimic', 'snowball', 'snowball'], atk: 16, hpScale: 1.2 },
          { list: ['rudolph', 'snowball', 'mimic', 'rudolph', 'mimic', 'snowball'], atk: 18, hpScale: 1.45 },
        ];
        return;
      }
      this.waves = [
        { count: 4, hp: 240, atk: 14 },
        { count: 5, hp: 280, atk: 16 },
        { count: 6, hp: 320, atk: 18 },
        { count: 6, hp: 360, atk: 20 },
      ];
    }

    _buildIntro() {
      const XM = !!(G.Xmas && G.Xmas.ON);
      const c = this.introC = new PIXI.Container();
      // 배경을 어둡게 깔아 '타이틀 화면' 느낌
      const shot = new PIXI.Sprite(XM ? (G.Assets.tex.bgXmas || G.Assets.tex.bg) : G.Assets.tex.bg);
      shot.anchor.set(0.5);
      shot.scale.set(Math.max(G.W / shot.width, G.H / shot.height) * 1.12);
      shot.x = G.W / 2; shot.y = G.H / 2;
      shot.tint = XM ? 0x9fb8d8 : 0x6f89b0;
      shot.alpha = XM ? 0.62 : 0.55;
      c.addChild(shot);
      const bg = new PIXI.Graphics();
      bg.rect(0, 0, G.W, G.H).fill({ color: XM ? 0x040a18 : 0x03060d, alpha: 0.5 });
      bg.rect(0, G.H * 0.3, G.W, G.H * 0.42).fill({ color: 0x03060d, alpha: XM ? 0.30 : 0.35 });
      c.addChild(bg);
      const deco = new PIXI.Graphics();
      const gold = XM ? 0xf2d48a : 0xe8c27a;
      const top = XM ? G.H / 2 - 132 : G.H / 2 - 96;
      deco.moveTo(G.W / 2 - 300, top).lineTo(G.W / 2 - 60, top).stroke({ width: 1.6, color: gold, alpha: 0.55 });
      deco.moveTo(G.W / 2 + 60, top).lineTo(G.W / 2 + 300, top).stroke({ width: 1.6, color: gold, alpha: 0.55 });
      deco.poly([G.W / 2, top - 6, G.W / 2 + 7, top, G.W / 2, top + 6, G.W / 2 - 7, top]).fill({ color: gold, alpha: 0.9 });
      deco.moveTo(G.W / 2 - 210, G.H / 2 + 66).lineTo(G.W / 2 + 210, G.H / 2 + 66).stroke({ width: 1, color: 0x9fd0ff, alpha: 0.25 });
      c.addChild(deco);
      const t = new PIXI.Text({
        text: XM ? '메리 크리스마스!\n성문을 지켜라' : '마지막 성문의 수호자',
        style: {
          fontFamily: G.FONT, fontSize: XM ? 50 : 58, fontWeight: '900',
          fill: XM ? 0xf6fbff : 0xeaf4ff, letterSpacing: XM ? 6 : 8,
          align: 'center', lineHeight: XM ? 60 : 70,
          stroke: { color: XM ? 0x0a1c38 : 0x0a1c38, width: 8 },
          dropShadow: XM ? { color: 0x5fa8ff, blur: 12, distance: 0, alpha: 0.5 } : undefined,
        },
      });
      t.anchor.set(0.5);
      t.x = G.W / 2; t.y = XM ? G.H / 2 - 46 : G.H / 2 - 34;
      c.addChild(t);
      const sub = new PIXI.Text({
        text: XM
          ? G.Xmas.SERIES + '   ·   ' + G.Xmas.VERSION
          : 'THE LAST GATEKEEPER   ·   전투 ' + G.VERSION.split('-')[0],
        style: { fontFamily: G.FONT, fontSize: 17, fontWeight: '700', fill: XM ? 0xffd9a0 : 0x8fb8e0, letterSpacing: 3 },
      });
      sub.anchor.set(0.5);
      sub.x = G.W / 2; sub.y = XM ? G.H / 2 + 44 : G.H / 2 + 30;
      c.addChild(sub);
      if (XM) {
        const tags = new PIXI.Text({
          text: '겨울 축제 · 스노우볼 / 미믹 / 루돌프 / 다크 산타 노엘',
          style: { fontFamily: G.FONT, fontSize: 14, fill: 0x9fc4e8, letterSpacing: 1 },
        });
        tags.anchor.set(0.5);
        tags.x = G.W / 2; tags.y = G.H / 2 + 74;
        c.addChild(tags);
      }
      // 시작 버튼
      const btn = new PIXI.Graphics();
      const bw = 300, bh = 56, bx = G.W / 2 - bw / 2, by = XM ? G.H / 2 + 108 : G.H / 2 + 88;
      const p = [bx + 14, by, bx + bw - 14, by, bx + bw, by + 14, bx + bw, by + bh - 14,
        bx + bw - 14, by + bh, bx + 14, by + bh, bx, by + bh - 14, bx, by + 14];
      btn.poly(p).fill({ color: XM ? 0x16304a : 0x142a44, alpha: 0.8 });
      btn.poly(p).stroke({ width: 1.8, color: gold, alpha: 0.7 });
      c.addChild(btn);
      const bt = new PIXI.Text({
        text: XM ? G.Xmas.START_TEXT : '터치하여 시작',
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
        text: XM ? G.Xmas.INTRO_HINT : '음악은 시작한 뒤 잠시 후 흐릅니다 · 가로 화면 권장',
        style: { fontFamily: G.FONT, fontSize: 13, fill: 0x6f8fb0, letterSpacing: 1 },
      });
      hint.anchor.set(0.5);
      hint.x = G.W / 2; hint.y = by + bh + 34;
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

    /* 노엘·카엘 대사 — 하단 자막 패널(구어체 한 줄) */
    dialogueLine(name, text, dur = 2.6) {
      if (!text) return;
      if (this.dialogueC) {
        this.dialogueC.destroy({ children: true });
        this.dialogueC = null;
      }
      const c = new PIXI.Container();
      c.zIndex = 14;
      const w = 520, h = 78, x = 286, y = 634;
      const g = new PIXI.Graphics();
      platePath(g, x, y, w, h, 12, 0x060d1a, 0.86);
      plateEdge(g, x, y, w, h, 12, 0xf2d48a, 0.55, 1.4);
      gem(g, x, y + 13, 6, 0xf2d48a, 0.9);
      gem(g, x + w, y + 13, 6, 0xf2d48a, 0.9);
      c.addChild(g);
      const nm = new PIXI.Text({
        text: name,
        style: G.style({ fontSize: 14, fontWeight: '900', fill: 0xffd9a0, letterSpacing: 2 }),
      });
      nm.x = x + 18; nm.y = y + 8;
      c.addChild(nm);
      const tx = new PIXI.Text({
        text,
        style: G.style({
          fontSize: 19, fontWeight: '700', fill: 0xf2f8ff,
          wordWrap: true, wordWrapWidth: w - 40, lineHeight: 25,
        }),
      });
      tx.x = x + 18; tx.y = y + 30;
      c.addChild(tx);
      c.alpha = 0;
      this.root.addChild(c);
      this.dialogueC = c;
      this.dialogueT = 0;
      this.dialogueDur = dur;
      this.lastLine = name + ': ' + text;
    }

    _updateDialogue(realDt) {
      if (!this.dialogueC) return;
      this.dialogueT += realDt;
      const tin = G.clamp(this.dialogueT / 0.18, 0, 1);
      const out = G.clamp((this.dialogueT - Math.max(0.2, this.dialogueDur - 0.3)) / 0.3, 0, 1);
      this.dialogueC.alpha = Math.min(tin, 1 - out);
      if (this.dialogueT >= this.dialogueDur) {
        this.dialogueC.destroy({ children: true });
        this.dialogueC = null;
      }
    }

    /* 등불이 전부 꺼졌거나 하나라도 다시 켜졌을 때 */
    onChill(on) {
      if (!this.lanterns) return;
      if (on) {
        this.dialogueLine('카엘', '전부 꺼졌어… 그래도 아직 포기 안 해.', 2.8);
      } else {
        this.showPrompt('빛의 온기 · 버프 회복', 0xffe0a0, 1.2);
      }
    }

    /* ---------------- 데미지 ---------------- */
    heroStrike(hero, cfg, idx = 0) {
      const near = this._nearestEnemy();
      const reachDist = near ? G.clamp(Math.abs(near.x - hero.x) * 0.55, 110, 260) : 170;
      const cx = hero.x + 78 * hero.facing;
      const cy = hero.centerY;
      const heavy = idx === 2;
      const f = hero.facing || 1;
      const XM = !!(G.Xmas && G.Xmas.ON);
      // 겸궤적: 바깥 잔광 + 골드 테두리 + 시안 + 백색 코어 (2색 검기)
      // 외전은 성탄 설화 검기 — 검붉은 안쪽 날 + 금빛 테두리
      this.fx.slash(cx, cy, {
        radius: heavy ? 206 : 162, spread: cfg.spread * 0.95, angle: cfg.ang,
        width: heavy ? 27 : 20,
        color: XM ? (heavy ? 0xc21f36 : 0xe2453f) : (heavy ? 0x2f6bff : 0x3f7dff),
        color2: XM ? (heavy ? 0xffd9a0 : 0xffc27a) : (heavy ? 0x9fd6ff : 0x8fd0ff),
        edge: XM ? 0xfff3c4 : (heavy ? 0xffd166 : 0xbfe4ff),
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
        this.fx.shockRing(hero.x + 150 * f, hero.y - 8, 0x9fd6ff, 410, 0.6);
        this.fx.sparkBurst(hx, cy, 0xffd79a, 30, 620, cfg.ang);
        this.fx.groundBurst(hero.x + 170 * f, hero.y);
      }

      let hits = 0;
      let critHit = false;
      this.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        const inFront = (e.x - hero.x) * f > -30;
        const inRange = Math.abs(e.x - hero.x) < cfg.reach + 40 && Math.abs(e.y - hero.y) < 150;
        if (inFront && inRange) {
          hits++;
          if (this._hitEnemy(e, hero, cfg.dmg, cfg)) critHit = true;
        }
      });
      if (this.boss && this.boss.alive && !this.boss.dying) {
        if (Math.abs(this.boss.x - hero.x) < cfg.reach + 260 && Math.abs(this.boss.y - hero.y) < 125) {
          if ((this.boss.x - hero.x) * f > -60) {
            hits++;
            if (this._hitBoss(hero, cfg.dmg, cfg)) critHit = true;
          }
        }
      }
      // 성탄 설화 검기: 검겤적을 따라 눈가루가 흐르고, 꺼진 등불 곁에서 휘두르면 불이 다시 붙는다
      if (this.lanterns) {
        this.fx.sparkBurst(hx, cy, 0xe8f4ff, heavy ? 12 : 8, 300, cfg.ang);
        if (this.lanterns.tryRelight(hero.x, hero.y, heavy)) this.showPrompt('등불에 불이 붙었다', 0xffd166, 0.9);
      }
      if (hits > 0) {
        // 콤보 고유 히트스톱 유지: 크리티컬 1.8배, 보스 2.5배, 최대 150ms.
        const bossHit = !!(this.boss && this.boss.alive && Math.abs(this.boss.x - hero.x) < cfg.reach + 260 && (this.boss.x - hero.x) * f > -60);
        const multiFinisher = idx >= 2 && hits > 1 ? 1.15 : 1;
        this.hitStop = Math.max(this.hitStop, Math.min(0.15, cfg.hitStop * (bossHit ? 2.5 : critHit ? 1.8 : 1) * multiFinisher));
        this.scene.shake(cfg.shake * (bossHit ? 1.7 : critHit ? 1.4 : 1), 0.16 + idx * 0.03);
        this.flashImpact(heavy ? 0.55 : 0.07);
        if (heavy) {
          this.fx.shockRing(hx, cy, 0xe6efff, 570, 0.48);
          this.fx.sparkBurst(hx, cy, 0xd7baff, 76, 850);
          this.scene.zoomTo(1.04, 0.09);
          this.after(0.12, () => this.scene.zoomTo(1, 0.28));
        }
        if (critHit || bossHit) {
          this.fx.impactFrame(hx, cy, bossHit ? this.boss : null);
          if (!heavy) this.flashImpact(0.15, 0xffffff);
        }
        G.Sfx.hit(heavy || critHit);
        this.combo += hits;
        this.comboT = 2.4;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      } else {
        // 빗나간 공격은 기존 히트스톱을 덮어쓰지 않는다.
      }
    }

    flashImpact(alpha, color = 0xbfe4ff) {
      this.flashG.clear();
      this.flashG.rect(0, 0, G.W, G.H).fill({ color, alpha });
      this.flashT = 0.06;
      this.flashDuration = 0.06;
      this.flashG.alpha = 1;
    }

    /* 등불 「빛의 온기」 — 켜진 등불 수만큼 카엘의 공격이 강해진다 */
    _lanternDmg() { return this.lanterns ? this.lanterns.dmgMul() : 1; }

    _hitEnemy(e, hero, mult, cfg) {
      const crit = G.chance(0.24);
      const dmg = Math.round(hero.atk * (this.buffTime > 0 ? 1.1 : 1) * mult * this._lanternDmg() * (crit ? 1.95 : 1) * G.rand(1.08, 0.94));
      this.stats.damage += dmg;
      const knock = cfg ? (cfg.advance > 24 ? 420 : cfg.advance > 18 ? 300 : 230) : 200;
      e.takeDamage(dmg, { crit, knock });
      if (crit) {
        this.fx.impactFrame(e.x, e.centerY, e);
        if (this.time - (this._critPop || -9) > 0.3) {
          this._critPop = this.time;
          this.fx.popText(e.x, e.centerY - 146, 'CRITICAL', { color: 0xffd166, size: 18, dur: 0.7, stroke: 0x3a1e04, letter: 2 });
        }
        this.fx.debris(e.x, e.centerY, 5, 0xffe0a0, 1.0);
        G.Sfx.hit(true);
      }
      return crit;
    }

    _hitBoss(hero, mult, cfg) {
      const crit = G.chance(0.24);
      const dmg = Math.round(hero.atk * (this.buffTime > 0 ? 1.1 : 1) * mult * this._lanternDmg() * (crit ? 1.95 : 1) * G.rand(1.1, 0.92));
      this.stats.damage += dmg;
      this.boss.takeDamage(dmg, { crit, kb: cfg && cfg.advance > 24 ? 90 : 40 });
      if (crit) {
        this.fx.impactFrame(this.boss.x, this.boss.centerY, this.boss);
        if (this.time - (this._critPop || -9) > 0.3) {
          this._critPop = this.time;
          this.fx.popText(this.boss.x - 40, this.boss.centerY - 165, 'CRITICAL', { color: 0xffd166, size: 18, dur: 0.7, stroke: 0x3a1e04, letter: 2 });
        }
        G.Sfx.hit(true);
      }
      return crit;
    }

    damageHero(amount, fromX) {
      if (this.phase === 'victory' || this.phase === 'defeat') return;
      // 등불이 전부 꺼지면 한기 디버프로 받는 피해가 커진다
      amount = amount * (this.lanterns ? this.lanterns.dmgTakenMul() : 1);
      const kael = this.kael;
      if (kael.hurt(amount, fromX)) {
        this.scene.shake(11, 0.3);
        this.flashG.clear();
        this.flashG.rect(0, 0, G.W, G.H).fill({ color: 0xff1a2a, alpha: 0.16 });
        this.flashT = 0.14;
        this.flashDuration = 0.14;
        this.flashG.alpha = 1;
        G.Sfx.hit(true);
        if (kael.hp <= 0) this._defeat();
      }
    }

    /* ---------------- 웨이브/보스 ---------------- */
    spawnWave() {
      this.waveIndex++;
      const cfg = this.waves[Math.min(this.waveIndex, this.waves.length - 1)];
      if (cfg.list) {
        cfg.list.forEach((v, i) => {
          const delay = i * G.rand(0.34, 0.16) + G.rand(0.22, 0.04);
          this.after(delay, () => {
            if (this.phase !== 'wave') return;
            this._spawnEnemy(cfg, 1050 + G.rand(150, 0), v);
          });
        });
        return;
      }
      for (let i = 0; i < cfg.count; i++) {
        const delay = i * G.rand(0.28, 0.12) + G.rand(0.2, 0);
        this.after(delay, () => {
          if (this.phase !== 'wave') return;
          this._spawnEnemy(cfg, 1000 + G.rand(140, 0));
        });
      }
    }

    _spawnEnemy(cfg, x, variant) {
      let hp = cfg.hp ? cfg.hp + this.waveIndex * 12 : undefined;
      if (!hp && variant && G.Xmas && G.Xmas.enemies[variant]) {
        hp = Math.round(G.Xmas.enemies[variant].hp * (cfg.hpScale || 1));
      }
      const e = new G.Enemy(this, {
        variant,
        hp,
        atk: cfg.atk,
        x: x || 1240,
        y: G.GROUND_Y - 2 + G.rand(34, -30),
        scale: variant ? undefined : G.rand(0.6, 0.46),
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
          this._spawnEnemy({ hp: 200, atk: 12 }, 1180 + G.rand(120, 0), G.Xmas.ON ? 'snowball' : undefined);
        });
      }
    }

    enterBossPhase() {
      if (this.phase === 'boss' || this.phase === 'bossIntro') return;
      this.phase = 'bossIntro';
      this.phaseT = 0;
      this.bossPhaseLog.length = 0;
      this.bossCutKind = null;
      this.phaseBanner = 2.6;
      this.phaseMsg = G.Xmas.ON ? G.Xmas.BOSS_MSG : 'BOSS · 그림자 군주 아르카논';
      G.Sfx.bossRoar();
      this.scene.shake(14, 0.9);
      this.scene.zoomTo(1.06, 1.4);
      // 남은 잡몹 정리
      this.enemies.forEach((e) => { if (e.alive && !e.dying) e.die(); });
      const bc = G.Xmas.ON ? 0x8fb4ff : 0xff3355;
      this.after(0.7, () => {
        this.boss = new G.Boss(this, {
          hp: G.Xmas.ON ? G.Xmas.boss.hp : 24000,
          x: 820,
          variant: G.Xmas.ON ? 'noel' : undefined,
        });
        this.actorLayer.addChild(this.boss.obj);
        this.bossSpawned = true;
        if (G.Sfx.playVoice) G.Sfx.playVoice('boss_roar');
        if (G.Xmas.ON) this.dialogueLine('노엘', G.Xmas.noel.appear, 3.4);
        this.fx.shockRing(820, G.GROUND_Y - 10, bc, 300, 0.9);
        this.fx.sparkBurst(820, G.GROUND_Y - 180, G.Xmas.ON ? 0xcfe4ff : 0xff6b4a, 34, 620);
        this.fx.debris(820, G.GROUND_Y - 6, 12, G.Xmas.ON ? 0xe8f4ff : 0xff8a6a, 1.3);
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
      if (G.Xmas.ON) this.dialogueLine('노엘', G.Xmas.noel.defeat, 2.6);
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
    usePotion() {
      if (this.potions <= 0 || this.kael.hp >= this.kael.hpMax || this.kael.state === 'dead') return false;
      this.potions--;
      const heal = Math.min(this.kael.hpMax - this.kael.hp, Math.round(this.kael.hpMax * 0.3));
      this.kael.hp += heal;
      this.buffTime = 8;
      this.potionPulse = 0.5;
      this.fx.popText(this.kael.x, this.kael.y - 140, '+' + heal + ' 회복', { color: 0x8dffc1, size: 28, dur: 0.95 });
      this.fx.sparkBurst(this.kael.x, this.kael.y - 80, 0x85ffc5, 20, 270);
      return true;
    }

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
      this.flashImpact(0.9, 0xffffff);
      this.fx.cinematicCross();
      this.scene.zoomTo(1.08, 0.20);
      this.after(0.48, () => this.scene.zoomTo(1.0, 0.42));
      if (this.boss && this.boss.alive) {
        this.fx.ring(this.boss.x, this.boss.centerY, 0xd7baff, 470, 0.65, 11);
        this.fx.ring(this.boss.x, this.boss.centerY, 0xffffff, 600, 0.78, 7);
      }
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
        this.fx.ring(tx, ty - 10, 0xd7c2ff, 400, 0.8, 12, 0.42);
        this.fx.sparkBurst(tx, ty - 80, 0xffdfff, 64, 750);
        this.fx.ring(tx, ty - 10, 0xffffff, 140, 0.45, 4, 0.42);
        this.fx.sparkBurst(tx, ty - 90, 0xd9c8ff, 36, 620);
        this.fx.groundBurst(tx, ty);
        this.flashImpact(0.95, 0xffffff);
        this.fx.shockRing(tx, ty - 30, 0xffffff, 690, 0.6);
        this.fx.sparkBurst(tx, ty - 80, 0xf2e3ff, 90, 950);
        this.scene.zoomTo(1.06, 0.11);
        this.after(0.14, () => this.scene.zoomTo(1, 0.34));
        this.scene.shake(18, 0.62);
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
      this.after(1.14, () => {
        this.fx.sparkBurst(tx, ty - 85, 0xdcc7ff, 60, 780);
        this.scene.shake(18, 0.42);
      });
      this.after(1.9, () => { this.summonActive = false; });
      return true;
    }

    /* ---------------- 보스 스킬 컷인 ---------------- */
    /* 보스가 강력 기술을 시전할 때 오른쪽에서 붉은 배너 + 초상화가 밀려 들어온다.
       판정을 바꾸지 않고 "누구의 어떤 기술인지"만 알려 주는 연출이라, 예고가 막 시작되는
       순간에 띄우고 1.2초만 유지한다. 오른쪽 1/3만 덮어 장판·회피 판단을 가리지 않는다. */
    onBossSkill(kind) {
      if (this.bossCutCD > 0) return;
      if (this.phase !== 'boss' && this.phase !== 'bossIntro') return;
      if (!this.boss || !this.boss.alive || this.boss.dying) return;
      const info = bossSkillInfo(kind);
      if (!info) return;
      this.bossCutCD = 13;
      this.bossCutDur = 1.22;
      this.bossCutLog.push({ t: +this.time.toFixed(2), kind });
      this.bossCutKind = kind;
      this._bossCutIn(info);
      this.flashImpact(0.38, 0xff2a3c);
      this.scene.shake(7, 0.3);
      this.scene.zoomTo(1.03, 0.18);
      this.after(0.45, () => { if (this.phase === 'boss') this.scene.zoomTo(1, 0.42); });
      G.Sfx.bossRoar();
      if (G.Sfx.playVoice) G.Sfx.playVoice('boss_roar', { min: 6000, chance: 0.85 });
    }

    /* 노엘 3페이즈 전환 — 사선 컷인 + 구어체 대사 + 패턴 강화 */
    onBossPhaseTransition(boss, idx) {
      const PH = G.Xmas.boss.phases[idx];
      if (!PH || !PH.cut) return;
      this.bossCutCD = 6;
      this.bossCutDur = 1.95;
      this.bossCutKind = 'phase';
      this._bossCutIn(PH.cut);
      this.bossPhaseLog.push({ t: +this.time.toFixed(2), phase: PH.key, hp: Math.round(boss.hp) });
      this.flashImpact(0.6, idx >= 2 ? 0xff7a8a : 0x9fc8ff);
      this.scene.shake(16, 0.7);
      this.scene.zoomTo(1.08, 0.3);
      this.after(0.6, () => this.scene.zoomTo(1, 0.6));
      this.fx.shockRing(boss.x - 60, boss.y - 8, idx >= 2 ? 0xff5a6e : 0x9fd8ff, 470, 0.8);
      this.fx.sparkBurst(boss.x - 40, boss.centerY, idx >= 2 ? 0xffd0d8 : 0xcfe4ff, 42, 720);
      this.showPrompt(PH.label + ' 돌입', idx >= 2 ? 0xff8a99 : 0xffd166, 1.8);
      this.after(1.25, () => this.dialogueLine('노엘', PH.cut.line, 3.2));
      G.Sfx.bossRoar();
      if (G.Sfx.playVoice) G.Sfx.playVoice('boss_roar', { min: 0, chance: 1 });
    }

    _bossCutIn(info) {
      // 외전 보스는 노엘의 상반신 컷인을 쓴다 (리아·아라급 사선 배너 문법 그대로)
      const NOEL = !!(G.Xmas && G.Xmas.ON);
      const porTex = NOEL ? G.Assets.tex.portraitNoel : G.Assets.tex.portraitBoss;
      const porAspect = NOEL ? (470 / 560) : (441 / 560);
      const porH = NOEL ? 368 : 344;
      if (this.bossCutin) {
        this.bossCutin.destroy({ children: true });
        this.bossCutin = null;
      }
      const c = new PIXI.Container();
      c.zIndex = 16;

      const band = new PIXI.Graphics();
      band.poly([1310, 176, 792, 104, 676, 340, 1310, 452]).fill({ color: 0x24050a, alpha: 0.9 });
      band.poly([1310, 208, 788, 136, 700, 322, 1310, 428]).fill({ color: 0xa80f1c, alpha: 0.22 });
      band.poly([1310, 444, 1076, 360, 1034, 376, 1310, 470]).fill({ color: NOEL ? 0x9fd8ff : 0xff5a3c, alpha: 0.32 });
      band.moveTo(1310, 176).lineTo(792, 104).stroke({ width: 4, color: 0xff3b32, alpha: 0.9 });
      band.moveTo(792, 104).lineTo(676, 340).stroke({ width: 2.4, color: 0xff6a4a, alpha: 0.75 });
      band.moveTo(1310, 452).lineTo(676, 340).stroke({ width: 1.6, color: 0xff8a5a, alpha: 0.4 });
      c.addChild(band);

      // 초상화 뒤 붉은 잔광
      const g = new PIXI.Sprite(G.Assets.tex.glow);
      g.anchor.set(0.5);
      g.blendMode = 'add';
      g.tint = 0xff2a22;
      g.width = 660; g.height = 660;
      g.x = 1104; g.y = 292;
      g.alpha = 0.34;
      c.addChild(g);

      // 배너를 가로지르는 잔상선 (위압감)
      const sl = new PIXI.Graphics();
      sl.blendMode = 'add';
      for (let i = 0; i < 4; i++) {
        const y = 152 + i * 76;
        sl.moveTo(700 + i * 26, y + 118).lineTo(1300, y - 26)
          .stroke({ width: i === 1 ? 12 : 5, color: i === 1 ? 0xff4a3a : 0xffb0a0, alpha: i === 1 ? 0.30 : 0.16 });
      }
      c.addChild(sl);

      const por = new PIXI.Sprite(porTex);
      por.anchor.set(0.5);
      por.height = porH;
      por.width = porH * porAspect;
      por.x = 1110; por.y = 286;

      // 같은 실루엣을 살짝 키워 붉게 태운 뒤 가산 블렌드 → 어두운 갑옷이 배너에서 떠 보인다
      const aura = new PIXI.Sprite(porTex);
      aura.anchor.set(0.5);
      aura.height = porH + 14; aura.width = (porH + 14) * porAspect;
      aura.x = 1108; aura.y = 286;
      aura.tint = 0xff3a1e;
      aura.blendMode = 'add';
      aura.alpha = 0.34;
      c.addChild(aura);
      c.addChild(por);
      this.bossCutPor = por;
      this.bossCutPorBase = por.scale.x;

      const name = new PIXI.Text({
        text: NOEL ? '노엘' : '아르카논',
        style: G.style({ fontSize: 42, fontWeight: '900', fill: 0xffe6dc, letterSpacing: 4, stroke: { color: 0x3a0409, width: 8 } }),
      });
      name.anchor.set(1, 0.5);
      name.x = 972; name.y = 232;
      c.addChild(name);

      const mv = new PIXI.Text({
        text: info.move,
        style: G.style({ fontSize: 27, fontWeight: '900', fill: 0xffb4a2, letterSpacing: 2, stroke: { color: 0x2c0306, width: 6 } }),
      });
      mv.anchor.set(1, 0.5);
      mv.x = 972; mv.y = 282;
      c.addChild(mv);

      const sub = new PIXI.Text({
        text: (NOEL ? 'DARK SANTA QUEEN  ·  ' : 'SHADOW LORD  ·  ') + info.en,
        style: G.style({ fontSize: 14, fontWeight: '800', fill: 0xff8f78, letterSpacing: 3 }),
      });
      sub.anchor.set(1, 0.5);
      sub.x = 972; sub.y = 320;
      c.addChild(sub);

      c.x = 760;
      c.alpha = 0;
      this.root.addChild(c);
      this.bossCutin = c;
      this.bossCutT = 0;
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
      const sdLia = G.Assets.sd?.lia_sd_idle;
      const spr = sdLia ? new PIXI.Sprite(sdLia.texture) : new PIXI.AnimatedSprite(a.frames);
      spr.anchor.set(sdLia ? sdLia.ax : a.ax, sdLia ? sdLia.ay : a.ay);
      const sc = (sdLia ? 250 / sdLia.h : 340 / (a.fh || 465));
      spr.scale.set(sc);
      if (spr.gotoAndStop) { spr.animationSpeed = 0; spr.gotoAndStop(0); }
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
      this.fx.shockRing(x, y - 6, 0xc9a8ff, 150, 0.55);
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
        this.flashG.alpha = Math.max(0, this.flashT / (this.flashDuration || 0.06));
        if (this.flashT <= 0) this.flashG.clear();
      }

      if (this.paused || this.introC) {
        this.scene.update(realDt * 0.2);
        return;
      }

      // 히트스톱 / 슬로우
      let dt = realDt;
      if (this.hitStop > 0) { this.hitStop = Math.max(0, this.hitStop - realDt); dt = 0; }
      if (this.slowT > 0) { this.slowT -= realDt; dt *= 0.35; }

      this._processTimers(dt);
      this.scene.update(dt);

      // 입력
      const inp = this.hud.consume();
      const k = this.keys;
      let mx = inp.moveX, my = inp.moveY;
      const kx = (k['ArrowRight'] || k['d'] ? 1 : 0) - (k['ArrowLeft'] || k['a'] ? 1 : 0);
      const ky = (k['s'] ? 1 : 0) - (k['w'] ? 1 : 0);
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

      // 히트스톱 동안에도 입력을 수집해 해제 직후 처리한다.
      if (dt === 0) {
        if (inp.attack) this.queuedAttack = true;
        if (inp.skill1) this.queuedSkill1 = true;
        if (inp.skill2) this.queuedSkill2 = true;
        if (inp.dodge) this.queuedDodge = true;
        if (inp.potion) this.queuedPotion = true;
        if (inp.jump) this.queuedJump = true;
        this.hud.update(realDt, this);
        this.support.update(0, realDt);   // 히트스톱 중에도 컷인 배너는 부드럽게
        return;
      }
      if (this.queuedJump) { inp.jump = true; this.queuedJump = false; }
      if (inp.jump) this.kael.jump();
      if (this.queuedAttack) { inp.attack = true; this.queuedAttack = false; }
      if (this.queuedSkill1) { inp.skill1 = true; this.queuedSkill1 = false; }
      if (this.queuedSkill2) { inp.skill2 = true; this.queuedSkill2 = false; }
      if (this.queuedDodge) { inp.dodge = true; this.queuedDodge = false; }
      if (this.queuedPotion) { inp.potion = true; this.queuedPotion = false; }
      if (inp.potion) this.usePotion();
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
        this.kael.move(mx * sp, my * sp, dt);
      } else if (this.autoMode !== 'manual') {
        this._autoMove(dt);
      }

      // 공격 쿨다운
      this.atkCD -= dt;
      if (this.atkCD <= 0.42) this.atkCD = Math.max(this.atkCD, 0);

      // 스킬 쿨다운 (수동 모드에서도 흐른다)
      this.buffTime = Math.max(0, this.buffTime - dt);
      this.potionPulse = Math.max(0, this.potionPulse - realDt);
      this.cooldowns.skill1 = Math.max(0, this.cooldowns.skill1 - dt);
      this.cooldowns.skill2 = Math.max(0, this.cooldowns.skill2 - dt);

      // 콤보 유지 시간이 지나면 1타로 리셋
      if (this.comboWindow > 0) {
        this.comboWindow -= dt;
        if (this.comboWindow <= 0) this.comboStep = 0;
      }

      this.kael.update(dt, this.time);
      this.lia.update(dt);

      // 등불 기믹 (소등·재점화·버프/디버프·한기 연출)
      if (this.lanterns) {
        this.lanterns.update(dt);
        const rg = this.lanterns.regenPerSec();
        if (rg > 0 && this.kael.hp > 0 && this.kael.state !== 'dead') {
          this.kael.hp = Math.min(this.kael.hpMax, this.kael.hp + rg * dt);
        }
      }
      this._updateDialogue(realDt);

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

      // 보스 스킬 컷인 연출 (오른쪽에서 들어왔다가 오른쪽으로 나간다)
      if (this.bossCutCD > 0) this.bossCutCD = Math.max(0, this.bossCutCD - realDt);
      if (this.bossCutin) {
        this.bossCutT += realDt;
        const dur = this.bossCutDur || 1.22;
        const hold = dur - 0.30;
        const tin = G.clamp(this.bossCutT / 0.2, 0, 1);
        const tout = G.clamp((this.bossCutT - hold) / 0.3, 0, 1);
        this.bossCutin.x = 760 * (1 - G.easeOutCubic(tin)) + 540 * G.easeInCubic(tout);
        this.bossCutin.alpha = (this.bossCutT < hold ? G.clamp(this.bossCutT / 0.1, 0, 1) : 1 - tout);
        if (this.bossCutPor) {
          const p = G.clamp(this.bossCutT / 0.28, 0, 1);
          this.bossCutPor.scale.set(this.bossCutPorBase * (0.9 + 0.1 * G.easeOutBack(p)));
        }
        if (this.bossCutT > dur) {
          this.bossCutin.destroy({ children: true });
          this.bossCutin = null;
          this.bossCutPor = null;
          this.bossCutDur = 1.22;
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

      // 적들 (세나의 기록의 인장이 걸려 있으면 이동·공격이 35% 느려진다)
      const edt = this.support && this.support.slowT > 0 ? dt * 0.65 : dt;
      this.enemies.forEach((e) => e.update(edt, this.time, this.kael));
      this.enemies = this.enemies.filter((e) => !e.dead);

      // 보스
      if (this.boss && this.boss.alive) {
        this.boss.update(edt, this.time, this.kael);
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
      this.support.update(dt, realDt);
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
        this.kael.dodgeDir = this.kael.facing;
        this.kael.dodgeY = this.kael.y;
        this.kael.dodgeYDir = Math.sign(this.kael.vy || 0);
        this.kael.dodgeFrom = this.kael.x;
        this.kael.dodgeDist = 150;
        this.kael.invuln = 0.36;
        this.kael.obj.alpha = 1;
      } else {
        this.kael.dodge();
      }
      if (wasDodge) return;
      // 회피가 실제로 시작된 뒤에만 퍼펙트 반격을 인정한다.
      if (this.perfectWindow && this.boss && this.boss.state === 'windup' && this.boss.kind === 'perfect') {
        this.perfectWindow = false;
        this.perfectCounter = true;
        this.slowT = Math.max(this.slowT || 0, 0.35);
        this.flashImpact(0.28, 0xffe7aa);
        this.fx.perfectSeal();
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
        const inside = b.teleTargets && b.teleTargets.some((q) => Math.hypot(this.kael.x - q.x, (this.kael.y - q.y) / 0.4) < q.r * 1.05);
        if (inside && b.kind !== 'perfect' && this.kael.z <= 0 && tLeft < 0.6) this.kael.jump();
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
      this.kael.x = G.clamp(this.kael.x, 120, 1040);
      this.kael.obj.x = this.kael.x;
      // y 정렬
      const dy = target.y - this.kael.y;
      if (Math.abs(dy) > 14) this.kael.move(0, Math.sign(dy) * 95, dt);
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
        text: win ? (G.Xmas.ON ? 'MERRY CHRISTMAS!' : 'VICTORY') : 'DEFEAT',
        style: G.style({
          fontSize: win && G.Xmas.ON ? 42 : 54, fontWeight: '900',
          fill: win ? 0xffd166 : 0xff8899, letterSpacing: win && G.Xmas.ON ? 4 : 8,
          stroke: { color: 0x1a0e04, width: 6 },
        }),
      });
      title.anchor.set(0.5); title.x = G.W / 2; title.y = 215;
      c.addChild(title);

      const sub = new PIXI.Text({
        text: win
          ? (G.Xmas.ON ? '노엘을 물리치고 축제의 불빛을 지켜냈습니다' : '아르카논을 쓰러뜨렸습니다')
          : `카엘이 쓰러졌습니다${reason ? ' · ' + reason : ''}`,
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
      this.enemies.forEach((e) => {
        if (e.tele) { e.tele.destroy(); e.tele = null; }
        if (e.obj) e.obj.destroy({ children: true });
      });
      this.enemies = [];
      if (this.boss && this.boss.tele) { this.boss.tele.destroy(); this.boss.tele = null; }
      if (this.boss && this.boss.obj) this.boss.obj.destroy({ children: true });
      this.boss = null;
      this.bossSpawned = false;
      if (this.bossTeleLayer) this.bossTeleLayer.removeChildren();
      this.projectiles.forEach((p) => p.spr.destroy());
      this.projectiles = [];
      this.fx.clear();
      this.actorLayer.removeChildren();
      this.stats = { damage: 0, maxCombo: 0, kills: 0 };
      this.combo = 0;
      this.cooldowns = { skill1: 0, skill2: 0 };
      this.timers.length = 0;
      if (this.cutin) { this.cutin.destroy({ children: true }); this.cutin = null; }
      if (this.bossCutin) { this.bossCutin.destroy({ children: true }); this.bossCutin = null; this.bossCutPor = null; }
      this.bossCutCD = 0;
      this.bossCutDur = 1.22;
      this.bossCutT = 0;
      this.bossCutKind = null;
      this.bossCutLog.length = 0;
      this.bossPhaseLog.length = 0;
      if (this.dialogueC) { this.dialogueC.destroy({ children: true }); this.dialogueC = null; }
      this.dialogueT = 0; this.dialogueDur = 0; this.lastLine = '';
      if (this.lanterns) this.lanterns.reset();
      if (this.support) this.support.reset();
      this.comboStep = 0; this.comboWindow = 0; this.attackBuffer = 0;
      this.kael = null; this.lia = null;
      this._initActors();
      this.kael.hp = this.kael.hpMax;
      this.phase = 'wave';
      this.phaseT = 0;
      this.timeLeft = G.Xmas.ON ? 80 : 60;
      this.scene.zoomTo(1, 0.4);
      this.scene.focus = 0;
      this.scene._focusTarget = 0;
      if (this.hud) { this.hud.hpGhost = 1; this.hud.mpGhost = 1; this.hud._bossGhostP = 1; }
      this.perfectWindow = false;
      this.perfectCounter = false;
      this.hitStop = 0;
      this.queuedAttack = this.queuedSkill1 = this.queuedSkill2 = this.queuedDodge = this.queuedPotion = false;
      this.queuedJump = false;
      this.potions = 3; this.buffTime = 0; this.potionPulse = 0;
      this.slowT = 0;
      // 키 입력·HUD 버튼까지 깨끗이 (화면 이탈·키 반복으로 눌린 채 남지 않게)
      this.keys = {};
      if (this.hud && this.hud.releaseInputs) this.hud.releaseInputs();
      this.atkCD = 0;
      this.phaseBanner = 0;
      this.phaseMsg = '';
      this.promptMsg = ''; this.promptT = 0;
      this.summonActive = false;
      this._perfectHintShown = false;
      this.kaelSkillActive = 0;
      this.paused = false;
      this.resultActive = false;
      this.time = 0;
      this.start();
      this.showPrompt('WAVE 1', 0xbfe0ff, 1.2);
    }
  }

  G.Game = Game;
})();
