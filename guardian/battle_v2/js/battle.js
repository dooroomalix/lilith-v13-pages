/* battle.js : 전투 진행, 웨이브/보스 페이즈, AUTO AI, 데미지 판정, 오버레이 */
(function () {
  const AUTO_CYCLE = ['counter', 'full', 'manual'];

  /* 보스 컷인 배너 문구 — 시전하는 기술마다 이름이 바뀐다 */
  const BOSS_SKILL_CUTIN = {
    slam: { move: '지옥의 균열', en: 'ABYSSAL SLAM' },
    multi: { move: '삼중 그림자 파동', en: 'SHADOW WAVE' },
    perfect: { move: '암흑의 심판', en: 'DARK JUDGEMENT' },
  };

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

      // 2.5D 판정 디버그 (H 키) — 발밑 좌표·타점/피격 박스 표시용. 기본 OFF
      this.debugBoxes = false;
      this.debugT = 0;
      this.debugG = new PIXI.Graphics();
      this.debugG.zIndex = 9;
      this.scene.fxLayer.addChild(this.debugG);
      this.debugText = null;

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

      /* Step 7: 로비에서 고른 캐릭터·스킨이 그대로 전투 메인으로 출전한다 */
      this.deployChar = 'kael';
      this.deploySkin = 'basic';
      this.heroChar = (G.CHARS && G.CHARS.get) ? G.CHARS.get('kael') : null;
      this.kaelSkillActive = 0;
      this._critPop = -9;
      this._perfectHintShown = false;

      // 로비(성문 대기실) — 타이틀과 전투 사이의 허브. 로비가 root 에 자기를 붙인다.
      this.lobby = new G.Lobby(this);

      // 화면 전환 페이드 (로비→전투, 결과→로비)
      this.fadeG2 = new PIXI.Graphics();
      this.fadeG2.rect(0, 0, G.W, G.H).fill({ color: 0x02040a, alpha: 1 });
      this.fadeG2.zIndex = 26;
      this.fadeG2.visible = false;
      this.fadeG2.alpha = 0;
      this.root.addChild(this.fadeG2);
      this._fade = null;

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
      this.feelLog = [];      // 검증용: 타격감(히트스톱·셰이크) 적용 기록
      this._skillFeelT = -9;
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

      // ---- 스테이지 · 구역 진행 (Step 4-3) ----
      // 기본은 1스테이지(성문 외곽 수비전) — 웨이브 표가 v5.5.0 까지와 완전히 같다.
      this.stageIndex = 0;
      this.stage = G.STAGES[0];
      this.waves = [];
      this.zones = [];
      this.zoneIndex = 0;
      this.lastResult = null;        // 직전 전투 결과 — 로비 첫 대사가 반응한다

      // ---- 리아 협동 · 성광 협공 (Step 4-3) — R/C 또는 HUD 협동 버튼 ----
      this.coopMax = G.COOP.max;
      this.coopGauge = 0;
      this.coopActive = 0;           // 남은 지속(초)
      this.coopCd = 0;               // 재사용 대기(초)
      this.coopUses = 0;
      this.coopLog = [];             // 검증용: 발동 · 호응타 기록
      this.coopLia = null;           // 필드에 합류한 리아 SD
      this.coopShield = null;        // 카엘을 감싸는 성문 빛의 결계
      this.coopCutin = null;         // 협동 전용 사선 컷인 (궁극기 cutin 과 별개)
      this.coopCutT = 0;
      this._coopFollowT = -9;

      // 아라·보른·세나 지원 시스템 (쿨타임 자동 등장 + 컷인 + 보이스)
      this.support = new G.Support(this);

      this._initActors();
      this._buildIntro();
    }

    _initActors() {
      const C = (G.CHARS && G.CHARS.get) ? G.CHARS.get(this.deployChar) : null;
      this.heroChar = C;
      this.kael = new G.Hero(this, {
        char: C, skin: this.deploySkin,
        name: C ? C.name : '카엘', role: C ? C.role : '성문기사',
        x: 380, bodyPx: C ? C.bodyPx : 332, hpMax: C ? C.hpMax : 780, shadowW: 160,
        glowColor: C ? C.colors.glow : 0x5fb0ff,
        haloColor: C ? C.colors.glow : 0x6fb8ff,
        rimColor: C ? C.colors.slash2 : 0x8fd6ff,
      });
      this.kael.atk = C ? C.atk : 152;
      // 컷인·HUD 초상은 지금 스킨과 다른 스킨까지 미리 받아 둔다 (컷인 순간 빈 사각형 방지)
      if (C) {
        G.CHARS.skins.forEach((sk) => { this._portraitTex(C, sk); });
        G.CHARS.get('kael') && this._portraitTex(C, this.deploySkin);
      }
      // HUD 이름·직함·초상·스킬 쿨을 출전 캐릭터·스킨에 맞춘다
      if (this.hud) {
        if (this.hud.setHero) this.hud.setHero(C, this.deploySkin);
        this.skillMax.skill1 = C ? C.skill.cd : 7;
        this.skillMax.skill2 = C ? C.ult.cd : 13;
      }
      // 리아는 필드에 상주하지 않고 궁극기·협동에서만 등장한다
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
    /* 스테이지 선택 (로비 · 검증 훅) */
    setStage(i) {
      const idx = typeof i === 'number' ? i : G.STAGES.indexOf(G.stageByKey(i));
      if (!(idx >= 0 && idx < G.STAGES.length)) return false;
      this.stageIndex = idx;
      this.stage = G.STAGES[idx];
      return true;
    }

    start() {
      this.phase = 'wave';
      this.phaseT = 0;
      this.phaseBanner = 2.6;
      this.phaseMsg = 'STAGE ' + this.stage.order + ' · ' + this.stage.name;
      this.timeLeft = this.stage.timeLimit;
      this.waveIndex = -1;
      this.waveQueue = [];
      this.nextWaveDelay = 0.8;
      this.zoneIndex = 0;
      this._buildWaves();
      this._applyStageLook();
      this.spawnWave();
      G.Sfx.resume();
    }

    /* 스테이지별 배경 색온도 — 결전(2스테이지)은 노을·핏빛으로 물든다 */
    _applyStageLook() {
      const st = this.stage;
      if (this.scene && this.scene.bg) this.scene.bg.tint = st.bgTint || 0xffffff;
    }

    /* ---------------- 로비 ↔ 전투 ----------------
     * 타이틀 → 로비 → (출격) 전투 → 결과 → 로비 … 의 닫힌 고리.
     * 전투 조작 체계는 이 전환에서도 건드리지 않는다. */
    /* 필드에 남은 전투 요소를 모두 걷어낸다 — 재도전·로비 복귀 공통 */
    _teardownBattle() {
      this._clearOverlay();
      this.overlay.alpha = 1;
      // 2.5D 디버그 박스는 판을 넘기지 않는다
      this.debugBoxes = false;
      this.debugT = 0;
      if (this.debugG) this.debugG.clear();
      if (this.debugText) this.debugText.visible = false;
      // 협동 연출·게이지 정리 (Step 4-3)
      if (this.coopShield) { this.coopShield.obj.destroy({ children: true }); this.coopShield = null; }
      if (this.coopLia && this.coopLia.obj) { this.coopLia.obj.destroy({ children: true }); this.coopLia = null; }
      if (this.coopCutin) { this.coopCutin.destroy({ children: true }); this.coopCutin = null; }
      this.coopActive = 0;
      this.coopCd = 0;
      this.coopGauge = 0;
      this.coopCutT = 0;
      this.coopUses = 0;          // 판마다 집계를 새로 센다 (재도전 시 이전 횟수가 남지 않게)
      this.coopLog.length = 0;
      this._coopFollowT = -9;
      this.enemies.forEach((e) => { if (e.obj) e.obj.destroy({ children: true }); });
      this.enemies = [];
      if (this.boss && this.boss.obj) this.boss.obj.destroy({ children: true });
      // 보스 예고 그래픽은 actorLayer 밖에 있으므로 별도로 정리한다.
      for (const tele of this.bossTeleLayer.removeChildren()) tele.destroy();
      this.boss = null;
      this.bossSpawned = false;
      this.projectiles.forEach((p) => p.spr.destroy());
      this.projectiles = [];
      this.fx.clear();
      this.actorLayer.removeChildren();
      this.stats = { damage: 0, maxCombo: 0, kills: 0 };
      this.feelLog.length = 0;
      this._skillFeelT = -9;
      this.cooldowns = { skill1: 0, skill2: 0 };
      this.timers.length = 0;
      if (this.cutin) { this.cutin.destroy({ children: true }); this.cutin = null; }
      if (this.bossCutin) { this.bossCutin.destroy({ children: true }); this.bossCutin = null; this.bossCutPor = null; }
      this.bossCutCD = 0;
      this.bossCutT = 0;
      if (this.support) this.support.reset();
      this.comboStep = 0; this.comboWindow = 0; this.attackBuffer = 0;
      this.combo = 0; this.comboT = 0;
      this.kael = null; this.lia = null;
      this._initActors();
      this.kaelSkillActive = 0;
      this.perfectWindow = false;
      this.perfectCounter = false;
      this._perfectHintShown = false;
      this.hitStop = 0;
      this.queuedAttack = this.queuedSkill1 = this.queuedSkill2 = this.queuedDodge = this.queuedPotion = this.queuedJump = this.queuedCoop = false;
      // 이전 판의 일회성 입력(공격/스킬/점프)과 잡고 있던 조이스틱이 따라오지 않게 비운다.
      if (this.hud) {
        for (const key of ['attack', 'skill1', 'skill2', 'dodge', 'potion', 'jump', 'auto', 'pause', 'mute', 'coop']) {
          this.hud.input[key] = false;
        }
        const j = this.hud.joy;
        if (j) { j.active = false; j.id = null; j.vx = 0; j.vy = 0; }
      }
      this.potions = 3; this.buffTime = 0; this.potionPulse = 0;
      this.slowT = 0;
      this.timeLeft = 60;
      this.time = 0;
      this.waveIndex = -1;
      this.waveQueue = [];
      this.nextWaveDelay = 0.8;
      this.zoneIndex = 0;
      this.promptT = 0;
      this.phaseBanner = 0;
      this.phaseMsg = '';
      this.paused = false;
    }

    /* 성문 대기실(로비)로 들어간다 — 타이틀 / 결과 화면 [로비로] */
    enterLobby() {
      this._teardownBattle();
      this.phase = 'lobby';
      this.phaseT = 0;
      this.kael.hp = this.kael.hpMax;
      this.hud.root.visible = false;
      this.vignette.visible = false;
      // 전투 카메라 줌이 남아 있으면 다음 출격이 어긋난다
      this.scene.zoom = 1;
      this.scene._zoomDur = 0;
      this.scene.focus = 0;
      this.scene._focusTarget = 0;
      G.Sfx.resume();
      this.lobby.enter();
    }

    /* 로비 [전투 출격] → 웨이브 1부터 */
    sortie() {
      if (this.phase !== 'lobby') return;
      this.lobby.exit();
      this.hud.root.visible = true;
      this.vignette.visible = true;
      if (this.hud) { this.hud.hpGhost = 1; this.hud.mpGhost = 1; this.hud._bossGhostP = 1; }
      this.kael.hp = this.kael.hpMax;
      this.phase = 'wave';
      this.phaseT = 0;
      this.start();
    }

    sortieWithFade() { if (this.phase === 'lobby') this._fadeTransition(() => this.sortie()); }
    enterLobbyWithFade() { if (this.phase !== 'lobby') this._fadeTransition(() => this.enterLobby()); }

    /* 로비 [출격] — 고른 캐릭터·스킨으로 전투 메인을 다시 세우고 바로 출격한다 (Step 7) */
    async deployFromLobby(key, skin) {
      if (this.phase !== 'lobby') return false;
      this.deployChar = (key && G.CHARS[key]) ? key : 'kael';
      this.deploySkin = G.CHARS.skins.indexOf(skin) >= 0 ? skin : 'basic';
      if (this.lobby) this.lobby.deployLock = true;
      try { await G.Rigs.load(G.CHARS.rigKey(this.deployChar, this.deploySkin)); } catch (e) { /* 리그가 없으면 기존 스프라이트로 */ }
      try { await Promise.all(['scout', 'elite', 'arcanon'].map((k) => G.Rigs.load(k).catch(() => {}))); } catch (e) { /* 무시 */ }
      this.lobby.exit();
      this._teardownBattle();
      this.hud.root.visible = true;
      this.vignette.visible = true;
      this.kael.hp = this.kael.hpMax;
      this.phase = 'wave';
      this.phaseT = 0;
      this.start();
      this.showPrompt('WAVE 1', 0xbfe0ff, 1.2);
      if (this.lobby) this.lobby.deployLock = false;
      return true;
    }

    /* 짧은 암전으로 화면을 바꿔 전환의 이질감을 없앤다.
     * 페이드인이 끝나기 전에 다음 화면 버튼을 눌러도 입력이 먹히지 않게(묻히지 않게)
     * '밝아지는 중'일 때는 새 전환을 받아들인다. 목적지 함수들은 스스로 중복 호출을 막는다. */
    _fadeTransition(fn, dur = 0.3) {
      if (this._fade && this._fade.stage === 'out') return;
      this._fade = { t: 0, dur, fn, stage: 'out' };
      this.fadeG2.visible = true;
      this.fadeG2.alpha = 0;
    }

    _updateFade(dt) {
      const f = this._fade;
      if (!f) return;
      f.t += dt;
      if (f.stage === 'out') {
        const p = Math.min(1, f.t / f.dur);
        this.fadeG2.alpha = p;
        if (p >= 1) {
          f.stage = 'in';
          f.t = 0;
          try { f.fn(); } catch (e) { console.error('fade', e); }
        }
      } else {
        const p = Math.min(1, f.t / (f.dur * 1.15));
        this.fadeG2.alpha = 1 - p;
        if (p >= 1) { this.fadeG2.visible = false; this.fadeG2.alpha = 0; this._fade = null; }
      }
    }

    _buildWaves() {
      const built = G.buildStageWaves(this.stage);
      this.waves = built.waves;
      this.zones = built.zones;
    }

    /* 구역 배너 문구 — 지금 몇 구역 몇 웨이브인지 */
    _waveLabel() {
      const z = this.zones[this.zoneIndex] || null;
      return (z ? z.short + ' · ' : '') + 'WAVE ' + (this.waveIndex + 1);
    }

    /* HUD 미니맵·진행 표시용 현재 위치 */
    zoneInfo() {
      const z = this.zones[this.zoneIndex] || null;
      const boss = this.phase === 'boss' || this.phase === 'bossIntro' || this.phase === 'victory';
      return {
        stage: this.stage.key,
        stageName: this.stage.name,
        order: this.stage.order,
        zoneIndex: this.zoneIndex,
        zoneCount: this.zones.length,
        zoneName: boss ? '결전' : (z ? z.short : '1구역'),
        zoneFull: boss ? this.stage.bossArea : (z ? z.name : ''),
        area: boss ? this.stage.bossArea : this.stage.area,
        waveIndex: this.waveIndex,
        waveCount: this.waves.length,
      };
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
        text: 'THE LAST GATEKEEPER   ·   ' + G.VERSION.split('-')[0],
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
        text: '시작하면 성문 대기실에서 동료를 만납니다 · 가로 화면 권장',
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
      if (this.phase === 'lobby') {
        this.lobby.pointerDown(x, y, id);
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
      // 첫 제스처에서 오디오 잠금을 풀고 체험음(UI)을 바로 울린다
      G.Sfx.resume();
      G.Sfx.ui(true);
      const c = this.introC;
      this.introC = null;
      if (this.introBtn) this.introBtn = null;
      this.introT = 0;
      this.introFade = c;          // 타이틀이 걷히듯 로비로 넘어간다
      this.enterLobby();
    }

    handlePointerMove(x, y, id) {
      if (this.phase === 'lobby') return;
      this.hud.pointerMove(x, y, id);
    }
    handlePointerUp(x, y, id) {
      if (this.phase === 'lobby') return;
      this.hud.pointerUp(x, y, id);
    }

    togglePause() {
      if (this.phase === 'lobby') return;          // 로비에는 일시정지가 없다
      if (this.phase === 'victory' || this.phase === 'defeat') return;
      this.paused = !this.paused;
      if (this.paused) this._buildPauseOverlay();
      else this._clearOverlay();
    }

    cycleAuto() {
      if (this.phase === 'lobby') return;
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
    /* 타격감 적용: G.FEEL(util.js) 기준표의 값을 히트스톱·셰이크에 반영하고 검증용 로그를 남긴다.
       stop 은 상한(cap)을 넘지 않게 잘라 조작감이 끊기지 않도록 한다. */
    _feel(kind, o = {}) {
      const stop = Math.max(0, Math.min(o.stop === undefined ? 0 : o.stop, G.FEEL.cap));
      const shake = o.shake === undefined ? 0 : o.shake;
      if (stop > 0) this.hitStop = Math.max(this.hitStop, stop);
      if (shake > 0) this.scene.shake(shake, o.shakeDur || 0.2);
      const rec = { t: +this.time.toFixed(3), kind, stop: +stop.toFixed(3), shake: +shake.toFixed(1), combo: this.combo };
      this.feelLog.push(rec);
      if (this.feelLog.length > 200) this.feelLog.shift();
      return rec;
    }

    heroStrike(hero, cfg, idx = 0) {
      const near = this._nearestEnemy();
      const reachDist = near ? G.clamp(Math.abs(near.x - hero.x) * 0.55, 110, 260) : 170;
      const cx = hero.x + 78 * hero.facing;
      const cy = hero.centerY;
      const heavy = idx === 2;
      const air = hero.z > 40;                      // 공중 공격은 내려찍는 무게로 따로 튜닝
      const F = air ? G.FEEL.air : (G.FEEL.combo[idx] || G.FEEL.combo[0]);
      const f = hero.facing || 1;
      const COL = (hero.char && hero.char.colors) || null;
      // 검궤적: 바깥 잔광 + 금테 + 백색 코어. 색은 캐릭터(검기 색)를 따른다 (Step 7)
      this.fx.slash(cx, cy, {
        radius: heavy ? 206 : 162, spread: cfg.spread * 0.95, angle: cfg.ang,
        width: heavy ? 27 : 20,
        color: cfg.c1 != null ? cfg.c1 : (COL ? (heavy ? COL.slash : COL.slash2) : (heavy ? 0x2f6bff : 0x3f7dff)),
        color2: cfg.c2 != null ? cfg.c2 : (COL ? COL.slash2 : (heavy ? 0x9fd6ff : 0x8fd0ff)),
        edge: cfg.edge != null ? cfg.edge : (COL ? COL.edge : (heavy ? 0xffd166 : 0xbfe4ff)),
        dur: heavy ? 0.26 : 0.19, scale: 1.0, flip: f < 0,
      });
      this.fx.slash(cx + 10 * f, cy - 4, {
        radius: heavy ? 156 : 126, spread: cfg.spread * 0.72, angle: cfg.ang - 0.07, width: 8,
        color: 0xffffff, color2: 0xffffff, dur: 0.13, scale: 1.0, flip: f < 0,
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
      /* 2.5D 링 타점 (Step 8) — 바라보는 정면 + 무기 리치 + 좁은 깊이 레인.
         등 뒤(G.LANE.back = 6px 허용)나 다른 깊이 레인(±48px 밖)의 적은 절대 맞지 않는다. */
      const reachX = cfg.reach + 40;
      this.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        if (G.inFront(hero.x, e.x, f, reachX) && G.inLane(e.y, hero.y, G.LANE.hero)) {
          hits++;
          if (this._hitEnemy(e, hero, cfg.dmg, cfg, idx, air)) critHit = true;
        }
      });
      let bossDidHit = false;
      if (this.boss && this.boss.alive && !this.boss.dying) {
        // 보스도 같은 정면·레인 기준 — 몸집이 커서 사거리·레인만 조금 넓다
        if (G.inFront(hero.x, this.boss.x, f, cfg.reach + 260) && G.inLane(this.boss.y, hero.y, G.LANE.boss)) {
          hits++;
          bossDidHit = true;
          if (this._hitBoss(hero, cfg.dmg, cfg, idx, air)) critHit = true;
        }
      }
      if (hits > 0) {
        // 콤보·공중·보스·크리티컬별로 히트스톱·셰이크 강도를 구분한다 (G.FEEL 기준표)
        const bossHit = bossDidHit;
        const multi = idx >= 2 && hits > 1 ? G.FEEL.multiFinisher : { stopScale: 1, shakeScale: 1 };
        const sStop = F.stop * (bossHit ? G.FEEL.bossHit.stopScale : critHit ? G.FEEL.crit.stopScale : 1) * multi.stopScale;
        const sShake = F.shake * (bossHit ? G.FEEL.bossHit.shakeScale : critHit ? G.FEEL.crit.shakeScale : 1) * multi.shakeScale;
        this._feel((air ? 'air-' : 'combo-') + (idx + 1), {
          stop: sStop, shake: sShake, shakeDur: F.shakeDur + (bossHit ? 0.04 : 0),
        });
        this.flashImpact(heavy ? 0.55 : air ? 0.2 : 0.07);
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

    _hitEnemy(e, hero, mult, cfg, idx = 0, air = false) {
      const crit = G.chance(0.24);
      const coopMul = this.coopActive > 0 ? G.COOP.atkMul : 1;
      const dmg = Math.round(hero.atk * (this.buffTime > 0 ? 1.1 : 1) * coopMul * mult * (crit ? 1.95 : 1) * G.rand(1.08, 0.94));
      this.stats.damage += dmg;
      this._coopGain(G.COOP.hitGain);
      const knock = air ? G.FEEL.air.knock : ((G.FEEL.combo[idx] || G.FEEL.combo[0]).knock);
      const dir = Math.sign(e.x - hero.x) || (hero.facing || 1);   // 때린 쪽 반대로 밀린다
      e.takeDamage(dmg, { crit, knock, dir });
      if (air) {
        // 공중 공격은 적을 아래로 눌러 찍는 느낌을 더한다
        this.fx.debris(e.x, e.centerY + e.baseH * 0.3, 5, 0xbfe4ff, 0.9);
        this.fx.sparkBurst(e.x, e.centerY + 40, 0xcfeaff, 10, 300, Math.PI / 2);
      }
      if (crit) {
        this.fx.impactFrame(e.x, e.centerY, e);
        if (this.time - (this._critPop || -9) > 0.3) {
          this._critPop = this.time;
          this.fx.popText(e.x, e.centerY - 146, 'CRITICAL', { color: 0xffd166, size: 18, dur: 0.7, stroke: 0x3a1e04, letter: 2 });
        }
        this.fx.debris(e.x, e.centerY, 5, 0xffe0a0, 1.0);
        // 크리티컬 타격음은 공격 1회당 한 번만 — _doAttack()에서 critHit로 울린다.
      }
      // 성광 결계 중이면 리아의 호응타가 따라붙는다
      this._coopFollow(e, hero, false);
      return crit;
    }

    _hitBoss(hero, mult, cfg, idx = 0, air = false) {
      const crit = G.chance(0.24);
      const coopMul = this.coopActive > 0 ? G.COOP.atkMul : 1;
      const dmg = Math.round(hero.atk * (this.buffTime > 0 ? 1.1 : 1) * coopMul * mult * (crit ? 1.95 : 1) * G.rand(1.1, 0.92));
      this.stats.damage += dmg;
      this._coopGain(G.COOP.hitGain);
      const kb = air ? 110 : (idx === 2 ? 90 : 45);
      this.boss.takeDamage(dmg, { crit, kb, dir: Math.sign(this.boss.x - hero.x) || 1 });
      if (crit) {
        this.fx.impactFrame(this.boss.x, this.boss.centerY, this.boss);
        if (this.time - (this._critPop || -9) > 0.3) {
          this._critPop = this.time;
          this.fx.popText(this.boss.x - 40, this.boss.centerY - 165, 'CRITICAL', { color: 0xffd166, size: 18, dur: 0.7, stroke: 0x3a1e04, letter: 2 });
        }
        // 크리티컬 타격음은 _doAttack() 한 곳에서만 (중복 재생 제거)
      }
      this._coopFollow(this.boss, hero, true);
      return crit;
    }

    damageHero(amount, fromX) {
      if (this.phase === 'victory' || this.phase === 'defeat') return;
      const kael = this.kael;
      // 성광 결계 중에는 받는 피해가 줄어든다 (리아가 앞에서 빛을 받아낸다)
      const dealt = this.coopActive > 0 ? Math.max(1, Math.round(amount * G.COOP.dmgTakenMul)) : amount;
      if (kael.hurt(dealt, fromX)) {
        // 피해량에 따라 가벼운 피격 / 강한 피격을 구분한다 (보스 강타는 묵직하게)
        const heavyHurt = dealt >= G.FEEL.hurt.heavyAt;
        const H = heavyHurt ? G.FEEL.hurt.heavy : G.FEEL.hurt.light;
        this._feel(heavyHurt ? 'hurt-heavy' : 'hurt-light', { stop: H.stop, shake: H.shake, shakeDur: H.shakeDur });
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
      // 구역이 바뀌면 구역 배너를 띄운다 (1구역 → 2구역 진입의 신호)
      const zi = cfg.zone || 0;
      if (zi !== this.zoneIndex) {
        this.zoneIndex = zi;
        const z = this.zones[zi];
        if (z) {
          this.phaseBanner = 2.2;
          this.phaseMsg = z.name;
          this.flashImpact(0.10, 0xffe9a8);
          if (this.kael) {
            this.fx.ring(this.kael.x, this.kael.y - 8, 0xffd166, 260, 0.6, 6, 0.4);
            this.fx.sparkBurst(this.kael.x, this.kael.y - 90, 0xffe9a8, 16, 320);
          }
          G.Sfx.ui(true);
        }
      }
      /* 2.5D 링 양방향 스폰 (Step 8) — 오른쪽 편중을 없애고 좌·우를 번갈아 들여보낸다.
         dual 웨이브(구역 마지막)는 첫 두 기가 양쪽에서 동시에 진입한다. */
      for (let i = 0; i < cfg.count; i++) {
        const side = i % 2 === 0 ? 'right' : 'left';
        const delay = (cfg.dual && i < 2) ? G.rand(0.18, 0)
          : i * G.rand(0.28, 0.12) + G.rand(0.2, 0);
        const elite = cfg.elite && i >= cfg.count - cfg.elite ? 'elite' : 'scout';
        this.after(delay, () => {
          if (this.phase !== 'wave') return;
          this._spawnEnemy(cfg, null, elite, side);
        });
      }
    }

    _spawnEnemy(cfg, x, variant, side) {
      const s = side === 'left' ? 'left' : 'right';
      const e = new G.Enemy(this, {
        variant: variant || 'scout',
        hp: cfg.hp + this.waveIndex * 12,
        atk: cfg.atk,
        x: x == null ? G.spawnX(s) : x,
        y: G.GROUND_Y - 2 + G.rand(G.SPAWN.lane, -G.SPAWN.lane),
        facing: s === 'left' ? 1 : -1,        // 링 안쪽(플레이어 쪽)을 본다
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
          this._spawnEnemy({ hp: 200, atk: 12 }, null, 'scout', i % 2 === 0 ? 'left' : 'right');
        });
      }
    }

    enterBossPhase() {
      if (this.phase === 'boss' || this.phase === 'bossIntro') return;
      this.phase = 'bossIntro';
      this.phaseT = 0;
      this.phaseBanner = 2.6;
      this.phaseMsg = 'BOSS · ' + (this.stage.bossTitle || '그림자 군주 아르카논');
      this.zoneIndex = Math.max(0, this.zones.length - 1);
      G.Sfx.bossRoar();
      this.scene.shake(14, 0.9);
      this.scene.zoomTo(1.06, 1.4);
      // 남은 잡몹 정리
      this.enemies.forEach((e) => { if (e.alive && !e.dying) e.die(); });
      this.after(0.7, () => {
        this.boss = new G.Boss(this, { hp: this.stage.bossHp || 24000, x: 820, variant: 'arcanon' });
        this.boss.name = this.stage.bossName || '그림자 군주 아르카논';
        this.actorLayer.addChild(this.boss.obj);
        this.bossSpawned = true;
        if (G.Sfx.playVoice) G.Sfx.playVoice('boss_roar', { priority: 3 });
        this.fx.shockRing(820, G.GROUND_Y - 10, 0xff3355, 300, 0.9);
        this.fx.sparkBurst(820, G.GROUND_Y - 180, 0xff6b4a, 34, 620);
        this.fx.debris(820, G.GROUND_Y - 6, 12, 0xff8a6a, 1.3);
      });
      this.after(2.1, () => {
        this.phase = 'boss';
        this.timeLeft = this.stage.bossTime || 180;
        this.showPrompt('보스 등장!', 0xff8a99, 1.6);
      });
    }

    onEnemyKilled(e) {
      this.stats.kills++;
      this._coopGain(G.COOP.killGain);
      this.combo += 1;
      this.comboT = 2.4;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    }

    onBossKilled() {
      this.stats.kills++;
      this._feel('killBoss', { stop: G.FEEL.killBoss.stop, shake: G.FEEL.killBoss.shake, shakeDur: G.FEEL.killBoss.shakeDur });
      this.scene.zoomTo(1.12, 1.6);
      G.Sfx.counter();
      this.after(1.6, () => this._victory());
    }

    onPerfectCounter(boss) {
      this.perfectCounter = false;
      this.slowT = 0.85;
      this._feel('perfect', { stop: G.FEEL.perfect.stop, shake: G.FEEL.perfect.shake, shakeDur: G.FEEL.perfect.shakeDur });
      this.scene.zoomTo(1.09, 0.4);
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

    /* 캐릭터별 K 스킬 (Step 7) — 무기·이펙트·판정이 캐릭터에 맞게 움직인다 */
    useSkill1() {
      const h = this.kael;
      const C = this.heroChar || G.CHARS.get('kael');
      const sk = C.skill;
      if (this.phase !== 'wave' && this.phase !== 'boss' && this.phase !== 'bossIntro') return false;
      if (this.cooldowns.skill1 > 0 || h.mp < (sk.mp || 25) || h.state === 'dead') return false;
      this._faceForAttack();
      h.mp -= (sk.mp || 25);
      this.skillMax.skill1 = sk.cd || 7;
      this.cooldowns.skill1 = this.skillMax.skill1;
      h.cast();
      h.facing = h.facing || 1;
      G.Sfx.magic();
      if (G.Sfx.playVoice && C.voice.skill) G.Sfx.playVoice(C.voice.skill, { min: 2400, chance: 0.8 });
      this.showPrompt(sk.name, C.colors.slash2, 1.0);
      const f = h.facing || 1;
      const cx = h.x + 70 * f;
      const cy = h.centerY;
      const dmg = Math.round(h.atk * (sk.dmg || 2));
      const kind = sk.kind;
      if (kind === 'cleave') {
        // 카엘 — 성문의 참격: 3초 연속 참격 (update 의 kaelSkillActive 틱)
        this.kaelSkillActive = 3;
        return true;
      }
      if (kind === 'starfall') {
        const target = this._densestTarget();
        const tx = target ? G.clamp(target.x, 220, 1060) : G.clamp(h.x + 380, 220, 1060);
        const ty = target ? target.y : G.GROUND_Y;
        this.fx.rune(tx, ty - 6, C.colors.slash, 150, 0.9);
        this.fx.pillar(tx, ty - 10, C.colors.slash2, 520, 0.8, 160);
        this.fx.ring(tx, ty - 8, C.colors.slash, 320, 0.7, 10);
        this.fx.sparkBurst(tx, ty - 80, C.colors.slash2, 40, 620);
        this.scene.shake(8, 0.35);
        this._skillHit(tx, ty, sk.radius || 320, dmg, { crit: true, color: C.colors.slash2, knock: 260 });
      } else if (kind === 'prayer') {
        this.fx.rune(h.x, h.y - 6, C.colors.slash2, 160, 0.9);
        this.fx.ring(h.x, h.y - 10, C.colors.slash, 300, 0.8, 9);
        this.fx.ring(h.x, h.y - 10, 0xffffff, 200, 0.6, 5);
        this.fx.sparkBurst(h.x, h.y - 90, C.colors.ult2, 34, 460);
        const heal = Math.round(h.hpMax * (sk.heal || 0.2));
        h.hp = Math.min(h.hpMax, h.hp + heal);
        this.fx.damage(h.x, h.y - 150, heal, { color: 0x8effc0, size: 26 });
        this._skillHit(h.x, h.y, sk.radius || 210, dmg, { color: C.colors.slash2, knock: 520 });
      } else if (kind === 'quake') {
        this.fx.shockRing(h.x + 40 * f, h.y - 6, C.colors.slash, 420, 0.6);
        this.fx.groundBurst(h.x + 90 * f, h.y);
        this.fx.sparkBurst(h.x + 90 * f, h.y - 30, C.colors.slash2, 30, 560);
        this.fx.debris(h.x + 90 * f, h.y, 10, 0xffcf9a, 1.1);
        this.scene.shake(12, 0.4);
        this._skillHit(h.x + 60 * f, h.y, sk.radius || 260, dmg, { crit: true, color: C.colors.slash2, knock: 300, stun: sk.stun || 1.5 });
      } else if (kind === 'frost') {
        this.fx.ring(h.x, h.y - 8, C.colors.slash, 300, 0.8, 8);
        this.fx.shockRing(h.x, h.y - 6, C.colors.slash2, 380, 0.5);
        this.fx.sparkBurst(h.x + 60 * f, h.y - 60, C.colors.slash2, 26, 420);
        this._skillHit(h.x + 30 * f, h.y, sk.radius || 250, dmg, { color: C.colors.slash, slow: sk.slow || 2.2 });
      }
      return true;
    }

    /* 스킬 공통 판정 — 적·보스에 한 번에 적용 */
    _skillHit(cx, cy, radius, dmg, opts = {}) {
      let n = 0;
      this.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        if (Math.abs(e.x - cx) < radius && Math.abs(e.y - cy) < radius * 0.75) {
          n++;
          this.stats.damage += dmg;
          const dir = Math.sign(e.x - cx) || 1;
          e.takeDamage(dmg, { crit: !!opts.crit, color: opts.color, knock: opts.knock, dir });
          if (opts.stun && e.stun) e.stun(opts.stun);
          if (opts.slow && e.applySlow) e.applySlow(opts.slow);
          this._coopGain(G.COOP.hitGain);
        }
      });
      if (this.boss && this.boss.alive && !this.boss.dying && Math.abs(this.boss.x - cx) < radius + 40) {
        this.stats.damage += dmg;
        const dir = Math.sign(this.boss.x - cx) || 1;
        this.boss.takeDamage(dmg, { crit: !!opts.crit, kb: opts.knock ? opts.knock * 0.12 : 40, dir });
        n++;
        this._coopGain(G.COOP.hitGain);
      }
      if (n) {
        this.hitStop = Math.max(this.hitStop, 0.05);
        this.scene.shake(9, 0.3);
        this.combo += n;
        this.comboT = 2.6;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      }
      return n;
    }

    /* 캐릭터별 L 궁극기 — 자기 사선 컷인 + 고유 연출 (Step 7) */
    useSkill2() {
      const h = this.kael;
      const C = this.heroChar || G.CHARS.get('kael');
      const u = C.ult;
      if (this.phase !== 'wave' && this.phase !== 'boss' && this.phase !== 'bossIntro') return false;
      if (this.cooldowns.skill2 > 0 || h.mp < (u.mp || 40) || h.state === 'dead') return false;
      if (h.state === 'ult') return false;
      h.mp -= (u.mp || 40);
      this.skillMax.skill2 = u.cd || 13;
      this.cooldowns.skill2 = this.skillMax.skill2;
      h.state = 'ult';
      h.stateT = 0;
      G.Sfx.magic();
      if (G.Sfx.playVoice && C.voice.ult) G.Sfx.playVoice(C.voice.ult, { min: 1200, chance: 1 });

      const target = this._densestTarget();
      const tx = target ? G.clamp(target.x, 260, 1060) : 900;
      const ty = target ? target.y : G.GROUND_Y;
      const dmg = Math.round(h.atk * (u.dmg || 3));
      const kind = u.kind;

      // 1) 사선 컷인 — 고른 캐릭터의 초상·이름·기술명
      this._ultCutIn(C);
      this.flashImpact(0.9, 0xffffff);
      this.fx.cinematicCross();
      this.scene.zoomTo(1.08, 0.20);
      this.after(0.48, () => this.scene.zoomTo(1.0, 0.42));
      if (this.boss && this.boss.alive) {
        this.fx.ring(this.boss.x, this.boss.centerY, C.colors.ult, 470, 0.65, 11);
        this.fx.ring(this.boss.x, this.boss.centerY, 0xffffff, 600, 0.78, 7);
      }
      this.summonActive = true;
      // 2) 소환 마법진 — 카엘의 폭쇄는 리아가 함께 내려찍는다 (기존 연출 유지)
      this.after(0.24, () => {
        if (kind === 'pillar' && C.key === 'kael') {
          this.fx.rune(tx - 60, ty - 20, 0xb98bff, 150, 1.0);
          this._spawnLia(tx - 150, ty - 2);
        } else {
          this.fx.rune(h.x, h.y - 10, C.colors.ult, 140, 0.9);
        }
      });
      // 3) 캐릭터별 궁극 연출
      this.after(0.62, () => {
        if (kind === 'pillar') {
          this.fx.pillar(tx, ty - 10, C.colors.ult2, 680, 1.05, 240);
          this.fx.pillar(tx - 90, ty - 10, C.colors.ult, 520, 0.9, 110);
          this.fx.pillar(tx + 90, ty - 10, C.colors.ult, 520, 0.9, 110);
          this.fx.ring(tx, ty - 10, C.colors.ult, 400, 0.8, 12, 0.42);
          this.fx.sparkBurst(tx, ty - 80, 0xffdfff, 64, 750);
          this.fx.shockRing(tx, ty - 30, 0xffffff, 690, 0.6);
          this.fx.groundBurst(tx, ty);
          this.flashImpact(0.95, 0xffffff);
          this.scene.zoomTo(1.06, 0.11);
          this.after(0.14, () => this.scene.zoomTo(1, 0.34));
          this._feel('ult', { stop: G.FEEL.ult.stop, shake: G.FEEL.ult.shake, shakeDur: G.FEEL.ult.shakeDur });
          this._skillHit(tx, ty, u.radius || 280, dmg, { crit: true, color: C.colors.ult, knock: G.FEEL.ult.knock });
        } else if (kind === 'blessing') {
          this.fx.ring(h.x, h.y - 10, C.colors.ult, 460, 0.9, 14);
          this.fx.pillar(h.x, h.y - 10, C.colors.ult2, 620, 1.0, 220);
          this.fx.sparkBurst(h.x, h.y - 90, 0xfff0c0, 70, 720);
          const heal = Math.round(h.hpMax * (u.heal || 0.4));
          h.hp = Math.min(h.hpMax, h.hp + heal);
          this.fx.damage(h.x, h.y - 170, heal, { color: 0x8effc0, size: 34 });
          this.scene.shake(12, 0.5);
          this._feel('ult', { stop: G.FEEL.ult.stop, shake: G.FEEL.ult.shake, shakeDur: G.FEEL.ult.shakeDur });
          this._skillHit(h.x, h.y, u.radius || 320, dmg, { crit: true, color: C.colors.ult, knock: 560 });
        } else if (kind === 'quake') {
          this.fx.shockRing(h.x, h.y - 6, C.colors.ult, 700, 0.8);
          this.fx.shockRing(h.x, h.y - 6, 0xffffff, 460, 0.55);
          this.fx.groundBurst(h.x, h.y);
          this.fx.debris(h.x, h.y, 16, 0xffcf9a, 1.3);
          this.fx.sparkBurst(h.x, h.y - 40, C.colors.ult2, 60, 800);
          this.scene.shake(20, 0.7);
          this._feel('ult', { stop: G.FEEL.ult.stop, shake: G.FEEL.ult.shake, shakeDur: G.FEEL.ult.shakeDur });
          this._skillHit(h.x, h.y, u.radius || 340, dmg, { crit: true, color: C.colors.ult2, knock: 340, stun: u.stun || 2 });
        } else if (kind === 'hunt') {
          for (let i = 0; i < 5; i++) {
            this.after(i * 0.09, () => {
              const ex = tx + G.rand(90, -90), ey = ty + G.rand(30, -30);
              this.fx.slash(ex - 60, ey - 90, { radius: 220, spread: 1.5, angle: G.rand(0.6, -0.6), width: 20,
                color: C.colors.slash, color2: C.colors.slash2, edge: 0xffffff, dur: 0.18 });
              this.fx.sparkBurst(ex, ey - 90, 0xdff2ff, 20, 520);
            });
          }
          this.scene.shake(14, 0.5);
          this._feel('ult', { stop: G.FEEL.ult.stop, shake: G.FEEL.ult.shake, shakeDur: G.FEEL.ult.shakeDur });
          this._skillHit(tx, ty, u.radius || 250, dmg, { crit: true, color: C.colors.slash2, knock: 420, slow: 2.5 });
        }
        G.Sfx.hit(true);
        this.combo += 3;
        this.comboT = 2.8;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      });
      this.after(1.14, () => {
        this.fx.sparkBurst(tx, ty - 85, C.colors.ult2, 60, 780);
        this.scene.shake(18, 0.42);
      });
      this.after(1.9, () => { this.summonActive = false; });
      return true;
    }

    /* ---------------- 리아 협동 · 성광 협공 (Step 4-3) ----------------
     * 궁극기(L · 빛의 심판)와는 다른 축의 기믹이다.
     *   L : 리아를 잠깐 소환해 한 번 크게 내려찍는 광역 폭딜 (리아 MP 40, 13초 쿨)
     *   R : 게이지를 모아 8초짜리 '성광 결계'를 두르는 지속 협동 (리아가 필드에 합류)
     * 같은 리아의 힘을 쓰지만 자원·연출·지속이 달라서, 둘을 섞어 쓰면 서로를 보완한다.
     * 조작은 R(또는 C) 키와 HUD 협동 버튼 두 길만 추가했고 기존 키는 건드리지 않았다. */
    /* 협동 파트너 — 기본은 리아. 리아가 직접 출전하면 카엘이 호응한다 (Step 7) */
    coopPartner() {
      const key = this.deployChar === 'lia' ? 'kael' : 'lia';
      return (G.CHARS && G.CHARS.get) ? G.CHARS.get(key) : null;
    }

    coopLabel() {
      const P = this.coopPartner();
      if (!P) return '성광 협공';
      return P.name + ' · ' + (P.key === 'lia' ? '성광 협공' : '성광 호응');
    }

    coopState() {
      return {
        gauge: +this.coopGauge.toFixed(1),
        max: this.coopMax,
        pct: +(this.coopGauge / this.coopMax).toFixed(3),
        ready: this.coopGauge >= this.coopMax && this.coopActive <= 0 && this.coopCd <= 0,
        active: +this.coopActive.toFixed(2),
        cd: +this.coopCd.toFixed(2),
        uses: this.coopUses,
        shield: !!this.coopShield,
        companion: !!(this.coopLia && this.coopLia.obj),
        cutin: !!this.coopCutin,
        atkMul: this.coopActive > 0 ? G.COOP.atkMul : 1,
        dmgTakenMul: this.coopActive > 0 ? G.COOP.dmgTakenMul : 1,
        log: this.coopLog.slice(-8),
      };
    }

    _coopGain(n) {
      this.coopGauge = G.clamp(this.coopGauge + n, 0, this.coopMax);
    }

    useCoop() {
      if (this.phase !== 'wave' && this.phase !== 'boss' && this.phase !== 'bossIntro') return false;
      if (!this.kael || this.kael.state === 'dead') return false;
      if (this.coopActive > 0 || this.coopCd > 0) return false;
      if (this.coopGauge < this.coopMax) {
        this.showPrompt('협동 게이지 부족', 0xa9c9e8, 0.8);
        return false;
      }
      this.coopGauge = 0;
      this.coopActive = G.COOP.dur;
      this.coopCd = G.COOP.cd;
      this.coopUses++;
      const kael = this.kael;
      const before = kael.hp;
      const heal = Math.max(1, Math.round(kael.hpMax * G.COOP.healPct));
      kael.hp = Math.min(kael.hpMax, kael.hp + heal);
      this.coopLog.push({ t: +this.time.toFixed(2), kind: 'activate', heal: Math.round(kael.hp - before), dur: G.COOP.dur });

      // 1) 협동 사선 컷인 — 파트너 초상 (리아 또는 카엘)
      const P = this.coopPartner();
      this._liaCoopCutIn(P);
      this.flashImpact(0.6, 0xfff2c8);
      this.fx.cinematicCross();
      this.scene.zoomTo(1.05, 0.22);
      this.after(0.5, () => { if (this.phase === 'wave' || this.phase === 'boss') this.scene.zoomTo(1, 0.45); });
      if (P && P.voice && P.voice.ult && G.Sfx.playVoice) G.Sfx.playVoice(P.voice.ult, { min: 2600, chance: 1 });
      G.Sfx.magic();
      this.showPrompt(this.coopLabel(), 0xffe9a8, 1.5);

      // 2) 발동 순간: 빛기둥 + 성문 빛의 결계
      this.after(0.16, () => {
        if (!this.kael || this.kael.state === 'dead') return;
        this.fx.pillar(kael.x, kael.y - 8, 0xffe9a8, 540, 0.72, 150);
        this.fx.ring(kael.x, kael.y - 8, 0xffd166, 330, 0.72, 8, 0.42);
        this.fx.rune(kael.x, kael.y - 10, 0xffd166, 128, 0.9);
        this.fx.sparkBurst(kael.x, kael.y - 110, 0xffe9a8, 26, 460);
        this.fx.popText(kael.x, kael.y - 168, '성광 결계', { color: 0xffe9a8, size: 26, dur: 1.1, stroke: 0x3a2404 });
        this._spawnCoopPartner();
        this._spawnCoopShield();
      });
      return true;
    }

    /* 결계 종료 — 필드의 리아가 서서히 사라진다 */
    _endCoop() {
      this.coopLog.push({ t: +this.time.toFixed(2), kind: 'end' });
      if (this.coopLia) this.coopLia.ending = 0;
      if (this.kael) this.fx.ring(this.kael.x, this.kael.y - 96, 0xffd166, 250, 0.5, 5, 0.5);
    }

    /* 성광 호응타 — 플레이어가 적을 맞히면 파트너의 빛이 반 박자 늦게 따라 꽂힌다 */
    _coopFollow(target, hero, isBoss) {
      if (this.coopActive <= 0 || !target) return;
      if (this.time - this._coopFollowT < G.COOP.followGap) return;
      this._coopFollowT = this.time;
      const P = this.coopPartner();
      const PC = P ? P.colors : { slash: 0xffd166, slash2: 0xfff2c8 };
      const dmg = Math.max(1, Math.round((hero.atk || 150) * G.COOP.followMul * G.rand(1.08, 0.92)));
      const tx = target.x;
      const ty = target.centerY;
      const dir = Math.sign(target.x - hero.x) || (hero.facing || 1);
      this.after(G.COOP.followDelay, () => {
        // 맞은 적이 그 사이 쓰러졌으면 근처에 남은 적에게 빛이 대신 꽂힌다
        let tgt = target;
        if (!tgt || !tgt.alive || tgt.dying) {
          tgt = null;
          if (this.boss && this.boss.alive && !this.boss.dying && Math.abs(this.boss.x - tx) < 220) tgt = this.boss;
          if (!tgt) tgt = this.enemies.find((e) => e.alive && !e.dying && Math.abs(e.x - tx) < 190) || null;
        }
        if (!tgt) return;
        this.stats.damage += dmg;
        if (tgt === this.boss) tgt.takeDamage(dmg, { crit: false, kb: 12, dir });
        else tgt.takeDamage(dmg, { crit: false, color: 0xffe9a8, knock: 26, dir });
        this.fx.slash(tx, ty - 10, {
          radius: 132, spread: 0.9, angle: -1.15, width: 13,
          color: PC.slash, color2: PC.slash2, edge: 0xffffff, dur: 0.19,
        });
        this.fx.sparkBurst(tx, ty - 30, PC.slash2, 9, 300);
        const L = this.coopLia;
        if (L && L.obj) this.fx.ring(L.obj.x, L.obj.y - 150, 0xffe9a8, 110, 0.32, 3, 0.4);
        this.combo += 1;
        this.comboT = 2.4;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
        this.coopLog.push({ t: +this.time.toFixed(2), kind: 'follow', dmg, boss: !!isBoss });
      });
    }

    /* 필드에 합류한 협동 파트너 — 3/4 관절 리그로 플레이어 옆을 따라다닌다 (Step 7) */
    _spawnCoopPartner() {
      const prev = this.coopLia;
      if (prev && prev.obj) { prev.obj.destroy({ children: true }); this.coopLia = null; }
      const kael = this.kael;
      if (!kael) return;
      const P = this.coopPartner();
      const PC = P ? P.colors : { slash: 0xffd166, slash2: 0xfff2c8, glow: 0xffd166 };
      const o = new PIXI.Container();
      const sh = new PIXI.Sprite(G.Assets.tex.shadow);
      sh.anchor.set(0.5); sh.width = 150; sh.height = 52; sh.alpha = 0.34; sh.tint = 0x000000;
      o.addChild(sh);
      const glow = new PIXI.Sprite(G.Assets.tex.glow);
      glow.anchor.set(0.5); glow.blendMode = 'add'; glow.tint = PC.glow;
      glow.width = 400; glow.height = 400; glow.y = -180; glow.alpha = 0.3;
      o.addChild(glow);
      let spr = null;
      let rig = null;
      const def = P && G.Rigs ? G.Rigs.get(G.CHARS.rigKey(P.key, 'basic')) : null;
      if (def) {
        rig = new G.Rig(def, { artFacing: P.artFacing || 1, mainArm: P.mainArm || 'near' });
        rig.setBodyPx(236);
        rig.setState('cast', 0.6, {});
        rig.update(0.016);
        o.addChild(rig.root);
      } else {
        const sd = G.Assets.sd && G.Assets.sd.lia_sd_idle;
        if (sd && sd.texture) {
          spr = new PIXI.Sprite(sd.texture);
          spr.anchor.set(sd.ax, sd.ay);
          spr.scale.set(236 / (sd.bodyH || sd.h));
          o.addChild(spr);
        }
      }
      // 발밑 성광 문양
      const rune = new PIXI.Graphics();
      rune.y = -6;
      rune.ellipse(0, 0, 96, 30).stroke({ width: 2.4, color: 0xffd166, alpha: 0.8 });
      rune.ellipse(0, 0, 70, 21).stroke({ width: 1.4, color: 0xfff2c8, alpha: 0.6 });
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * G.TAU;
        rune.moveTo(Math.cos(ang) * 70, Math.sin(ang) * 21);
        rune.lineTo(Math.cos(ang) * 96, Math.sin(ang) * 30);
      }
      rune.stroke({ width: 1.2, color: 0xffe9a8, alpha: 0.55 });
      o.addChild(rune);

      const f = kael.facing || 1;
      o.x = G.clamp(kael.x - 150 * f, 120, 1120);
      o.y = kael.y + 6;
      o.zIndex = o.y;
      o.alpha = 0;
      this.actorLayer.addChild(o);
      this.coopLia = { obj: o, spr, rig, glow, rune, alpha: 0, ending: -1, t: 0, facing: -f };
      this.fx.rune(o.x, o.y - 8, 0xffd166, 120, 0.8);
      this.fx.sparkBurst(o.x, o.y - 140, PC.slash2, 20, 380);
    }

    /* 카엘을 감싸는 성문 빛의 결계 (지속이 끝나면 옅어지며 사라진다) */
    _spawnCoopShield() {
      if (this.coopShield) { this.coopShield.obj.destroy({ children: true }); this.coopShield = null; }
      const kael = this.kael;
      if (!kael) return;
      const c = new PIXI.Container();
      const dome = new PIXI.Graphics();
      dome.ellipse(0, 0, 116, 152).fill({ color: 0xffd166, alpha: 0.05 });
      dome.ellipse(0, 0, 116, 152).stroke({ width: 3, color: 0xffd166, alpha: 0.55 });
      dome.ellipse(0, 0, 98, 128).stroke({ width: 1.4, color: 0xfff2c8, alpha: 0.32 });
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i / 6) * Math.PI;
        dome.moveTo(Math.cos(a) * 116, Math.sin(a) * 152);
        dome.lineTo(Math.cos(a) * 116 * 0.84, Math.sin(a) * 152 * 0.84);
      }
      dome.stroke({ width: 1.6, color: 0xffe9a8, alpha: 0.3 });
      dome.blendMode = 'add';
      c.addChild(dome);
      c.x = kael.x;
      c.y = kael.y - 148;         // 반원 결계의 바닥이 카엘 발치에 닿는다
      c.zIndex = kael.y - 1;      // 카엘 뒤에 깔려 검을 가리지 않는다
      c.alpha = 0.8;
      this.actorLayer.addChild(c);
      this.coopShield = { obj: c, dome, t: 0, fade: 1 };
    }

    _updateCoop(dt) {
      const kael = this.kael;
      const S = this.coopShield;
      if (S && kael) {
        S.t += dt;
        const target = this.coopActive > 0 ? 1 : 0;
        S.fade = G.lerp(S.fade, target, 1 - Math.pow(0.02, dt));
        S.obj.x = kael.x;
        S.obj.y = kael.y - 148;
        S.obj.zIndex = kael.y - 1;
        S.obj.alpha = (0.72 + Math.sin(S.t * 6) * 0.14) * S.fade;
        S.dome.rotation = Math.sin(S.t * 0.8) * 0.03;
        if (S.fade < 0.02) { S.obj.destroy({ children: true }); this.coopShield = null; }
      }
      const L = this.coopLia;
      if (L && L.obj && kael) {
        L.t += dt;
        const f = kael.facing || 1;
        const tx = G.clamp(kael.x - 148 * f, 120, 1120);
        const ty = kael.y + 4;
        L.obj.x = G.lerp(L.obj.x, tx, 1 - Math.pow(0.0025, dt));
        L.obj.y = G.lerp(L.obj.y, ty, 1 - Math.pow(0.01, dt)) - Math.sin(L.t * 3.4) * 0.6;
        L.obj.zIndex = L.obj.y;
        L.alpha = Math.min(1, L.alpha + dt * 6);
        if (L.ending >= 0) {
          L.ending += dt;
          L.obj.alpha = Math.max(0, 1 - L.ending / 0.35);
          if (L.ending >= 0.35) { L.obj.destroy({ children: true }); this.coopLia = null; }
        } else {
          L.obj.alpha = L.alpha * (0.92 + Math.sin(L.t * 8) * 0.08);
        }
        if (L.glow) L.glow.alpha = 0.26 + Math.sin(L.t * 9) * 0.08;
        if (L.rune) L.rune.rotation += dt * 1.4;
        if (L.spr && 'rotation' in L.spr) L.spr.rotation = Math.sin(L.t * 7) * 0.02;
        if (L.rig && L.rig.body && !L.rig.body.destroyed) {
          // 플레이어를 바라보며 서 있고, 반 박자마다 성광을 쏘는 자세
          L.rig.setFacing(kael.facing || 1);
          L.rig.setState('cast', 0.35 + 0.3 * Math.sin(L.t * 2.6), {});
          L.rig.update(dt);
        }
        if (this.coopActive > 0 && G.chance(0.3)) {
          this.fx._particle(L.obj.x + G.rand(50, -50), L.obj.y - G.rand(200, 20), {
            color: 0xffe9a8, size: G.rand(14, 5), vx: G.rand(40, -40), vy: G.rand(-10, -90),
            life: 0.5, additive: true,
          });
        }
      }
    }

    /* 협동 전용 사선 컷인 — 파트너(리아/카엘)의 초상과 문구 (Step 7) */
    _liaCoopCutIn(P) {
      if (this.coopCutin) {
        this.coopCutin.destroy({ children: true });
        this.coopCutin = null;
      }
      const c = new PIXI.Container();
      c.zIndex = 15;
      const band = new PIXI.Graphics();
      band.poly([-30, 168, 512, 78, 626, 322, -30, 448]).fill({ color: 0x241703, alpha: 0.88 });
      band.poly([-30, 196, 512, 106, 604, 304, -30, 420]).fill({ color: 0xffb030, alpha: 0.20 });
      band.poly([-30, 438, 210, 348, 252, 362, -30, 466]).fill({ color: 0xffe9a8, alpha: 0.34 });
      band.moveTo(-30, 168).lineTo(512, 78).stroke({ width: 3, color: 0xffd166, alpha: 0.85 });
      band.moveTo(512, 78).lineTo(626, 322).stroke({ width: 1.8, color: 0xffe9a8, alpha: 0.6 });
      c.addChild(band);

      const por = new PIXI.Sprite(P ? this._portraitTex(P, 'basic') : G.Assets.tex.portraitLia);
      por.anchor.set(0.5);
      por.width = 288; por.height = 288;
      por.x = 172; por.y = 276;
      if (por.texture && por.texture !== PIXI.Texture.WHITE) c.addChild(por);

      const g = new PIXI.Sprite(G.Assets.tex.glow);
      g.anchor.set(0.5);
      g.blendMode = 'add';
      g.tint = 0xffd166;
      g.width = 520; g.height = 520;
      g.x = 172; g.y = 286;
      g.alpha = 0.36;
      c.addChild(g);

      const name = new PIXI.Text({
        text: P ? (P.name + ' · ' + (P.key === 'lia' ? '성광 협공' : '성광 호응')) : '리아 · 성광 협공',
        style: G.style({ fontSize: 38, fontWeight: '900', fill: 0xfff6e0, letterSpacing: 3, stroke: { color: 0x3a2404, width: 8 } }),
      });
      name.anchor.set(0, 0.5);
      name.x = 330; name.y = 248;
      c.addChild(name);

      const sub = new PIXI.Text({
        text: 'CO-OP  ·  성문 빛의 결계',
        style: G.style({ fontSize: 17, fill: 0xffd9a0, fontWeight: '800', letterSpacing: 2 }),
      });
      sub.anchor.set(0, 0.5);
      sub.x = 334; sub.y = 296;
      c.addChild(sub);

      c.x = -660;
      c.alpha = 0;
      this.root.addChild(c);
      this.coopCutin = c;
      this.coopCutT = 0;
    }

    /* ---------------- 보스 스킬 컷인 ---------------- */
    /* 보스가 강력 기술을 시전할 때 오른쪽에서 붉은 배너 + 초상화가 밀려 들어온다.
       판정을 바꾸지 않고 "누구의 어떤 기술인지"만 알려 주는 연출이라, 예고가 막 시작되는
       순간에 띄우고 1.2초만 유지한다. 오른쪽 1/3만 덮어 장판·회피 판단을 가리지 않는다. */
    onBossSkill(kind) {
      if (this.bossCutCD > 0) return;
      if (this.phase !== 'boss' && this.phase !== 'bossIntro') return;
      if (!this.boss || !this.boss.alive || this.boss.dying) return;
      const info = BOSS_SKILL_CUTIN[kind];
      if (!info) return;
      this.bossCutCD = 13;
      this.bossCutLog.push({ t: +this.time.toFixed(2), kind });
      this.bossCutKind = kind;
      this._bossCutIn(info);
      this.flashImpact(0.38, 0xff2a3c);
      this.scene.shake(7, 0.3);
      this.scene.zoomTo(1.03, 0.18);
      this.after(0.45, () => { if (this.phase === 'boss') this.scene.zoomTo(1, 0.42); });
      G.Sfx.bossRoar();
      if (G.Sfx.playVoice) G.Sfx.playVoice('boss_roar', { min: 6000, chance: 0.85, priority: 3 });
    }

    _bossCutIn(info) {
      if (this.bossCutin) {
        this.bossCutin.destroy({ children: true });
        this.bossCutin = null;
      }
      const c = new PIXI.Container();
      c.zIndex = 16;

      const band = new PIXI.Graphics();
      band.poly([1310, 176, 792, 104, 676, 340, 1310, 452]).fill({ color: 0x24050a, alpha: 0.9 });
      band.poly([1310, 208, 788, 136, 700, 322, 1310, 428]).fill({ color: 0xa80f1c, alpha: 0.22 });
      band.poly([1310, 444, 1076, 360, 1034, 376, 1310, 470]).fill({ color: 0xff5a3c, alpha: 0.32 });
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

      const por = new PIXI.Sprite(G.Assets.tex.portraitBoss);
      por.anchor.set(0.5);
      por.height = 344;
      por.width = 344 * (441 / 560);
      por.x = 1110; por.y = 286;

      // 같은 실루엣을 살짝 키워 붉게 태운 뒤 가산 블렌드 → 어두운 갑옷이 배너에서 떠 보인다
      const aura = new PIXI.Sprite(G.Assets.tex.portraitBoss);
      aura.anchor.set(0.5);
      aura.height = 358; aura.width = 358 * (441 / 560);
      aura.x = 1108; aura.y = 286;
      aura.tint = 0xff3a1e;
      aura.blendMode = 'add';
      aura.alpha = 0.34;
      c.addChild(aura);
      c.addChild(por);
      this.bossCutPor = por;
      this.bossCutPorBase = por.scale.x;

      const name = new PIXI.Text({
        text: '아르카논',
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
        text: 'SHADOW LORD  ·  ' + info.en,
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

    /* 캐릭터 초상 텍스처 (컷인·HUD 공용) — 배포 시 미리 받아 둔다 */
    _portraitTex(C, skin) {
      const key = 'cutin_' + C.key + '_' + (skin || 'basic');
      if (!G.Assets.tex[key]) {
        G.Assets.tex[key] = PIXI.Texture.WHITE;
        G.Assets._img(G.CHARS.portrait(C.key, skin || 'basic')).then((img) => {
          const t = PIXI.Texture.from(img);
          t.source.scaleMode = 'linear';
          G.Assets.tex[key] = t;
        }).catch(() => {});
      }
      return G.Assets.tex[key];
    }

    /* 궁극기 사선 컷인 — 고른 캐릭터의 초상·이름·기술명 (Step 7) */
    _ultCutIn(C) {
      if (this.cutin) { this.cutin.destroy({ children: true }); this.cutin = null; }
      const c = new PIXI.Container();
      c.zIndex = 15;
      const band = new PIXI.Graphics();
      band.poly([-30, 150, 500, 76, 610, 330, -30, 460]).fill({ color: 0x0e0a1c, alpha: 0.88 });
      band.poly([-30, 180, 500, 106, 590, 310, -30, 430]).fill({ color: C.colors.ult, alpha: 0.22 });
      band.poly([-30, 450, 200, 360, 240, 374, -30, 476]).fill({ color: C.colors.ult2, alpha: 0.35 });
      band.moveTo(-30, 150).lineTo(500, 76).stroke({ width: 3, color: C.colors.ult, alpha: 0.85 });
      band.moveTo(500, 76).lineTo(610, 330).stroke({ width: 1.8, color: C.colors.ult2, alpha: 0.6 });
      c.addChild(band);

      const por = new PIXI.Sprite(this._portraitTex(C, this.deploySkin));
      por.anchor.set(0.5);
      por.width = 300; por.height = 300;
      por.x = 168; por.y = 268;
      if (por.texture && por.texture !== PIXI.Texture.WHITE) c.addChild(por);

      const g = new PIXI.Sprite(G.Assets.tex.glow);
      g.anchor.set(0.5);
      g.blendMode = 'add';
      g.tint = C.colors.ult;
      g.width = 520; g.height = 520;
      g.x = 168; g.y = 278;
      g.alpha = 0.35;
      c.addChild(g);

      const name = new PIXI.Text({
        text: C.name + ' · ' + C.ult.name,
        style: G.style({ fontSize: 38, fontWeight: '900', fill: 0xf8f2ff, letterSpacing: 3, stroke: { color: 0x1a1030, width: 8 } }),
      });
      name.anchor.set(0, 0.5);
      name.x = 322; name.y = 242;
      c.addChild(name);

      const sub = new PIXI.Text({
        text: 'ULTIMATE  ·  ' + C.ult.en,
        style: G.style({ fontSize: 17, fill: C.colors.ult2, fontWeight: '800', letterSpacing: 2 }),
      });
      sub.anchor.set(0, 0.5);
      sub.x = 326; sub.y = 292;
      c.addChild(sub);

      c.x = -640;
      c.alpha = 0;
      this.root.addChild(c);
      this.cutin = c;
      this.cutT = 0;
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

      this._updateFade(realDt);

      // 로비는 전투 연산을 타지 않는다 (장판·웨이브·HUD 모두 쉼)
      if (this.phase === 'lobby') {
        this.lobby.update(realDt);
        return;
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
      if (inp.mute) {
        this.muted = G.Sfx.toggleMute();
        if (!this.muted) G.Sfx.ui(true);   // 소리를 다시 켰을 때 확인음
      }
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
        if (inp.coop) this.queuedCoop = true;
        this.hud.update(realDt, this);
        this.support.update(0, realDt);   // 히트스톱 중에도 컷인 배너는 부드럽게
        return;
      }
      if (this.queuedJump) { inp.jump = true; this.queuedJump = false; }
      if (this.queuedCoop) { inp.coop = true; this.queuedCoop = false; }
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
      if (inp.coop) this.useCoop();
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

      // 협동 게이지 · 결계 지속 (Step 4-3)
      this.coopCd = Math.max(0, this.coopCd - dt);
      if (this.phase === 'wave' || this.phase === 'boss' || this.phase === 'bossIntro') {
        const wasActive = this.coopActive > 0;
        if (wasActive) {
          this.coopActive = Math.max(0, this.coopActive - dt);
          if (this.coopActive <= 0) this._endCoop();
        }
        if (this.kael && this.kael.state !== 'dead') this._coopGain(G.COOP.fill * dt);
      } else if (this.coopActive > 0) {
        this.coopActive = 0;
        this._endCoop();
      }
      this._updateCoop(dt);

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

      // 협동 사선 컷인 (궁극기 컷인과 별개로 움직인다)
      if (this.coopCutin) {
        this.coopCutT += realDt;
        const tin = G.clamp(this.coopCutT / 0.17, 0, 1);
        const tout = G.clamp((this.coopCutT - 0.82) / 0.28, 0, 1);
        this.coopCutin.x = -660 * (1 - G.easeOutCubic(tin)) - 340 * G.easeInCubic(tout);
        this.coopCutin.alpha = (this.coopCutT < 0.82 ? G.clamp(this.coopCutT / 0.11, 0, 1) : 1 - tout);
        if (this.coopCutT > 1.12) {
          this.coopCutin.destroy({ children: true });
          this.coopCutin = null;
        }
      }

      // 보스 스킬 컷인 연출 (오른쪽에서 들어왔다가 오른쪽으로 나간다)
      if (this.bossCutCD > 0) this.bossCutCD = Math.max(0, this.bossCutCD - realDt);
      if (this.bossCutin) {
        this.bossCutT += realDt;
        const tin = G.clamp(this.bossCutT / 0.2, 0, 1);
        const tout = G.clamp((this.bossCutT - 0.92) / 0.3, 0, 1);
        this.bossCutin.x = 760 * (1 - G.easeOutCubic(tin)) + 540 * G.easeInCubic(tout);
        this.bossCutin.alpha = (this.bossCutT < 0.92 ? G.clamp(this.bossCutT / 0.1, 0, 1) : 1 - tout);
        if (this.bossCutPor) {
          const p = G.clamp(this.bossCutT / 0.28, 0, 1);
          this.bossCutPor.scale.set(this.bossCutPorBase * (0.9 + 0.1 * G.easeOutBack(p)));
        }
        if (this.bossCutT > 1.22) {
          this.bossCutin.destroy({ children: true });
          this.bossCutin = null;
          this.bossCutPor = null;
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
              // 구역 배너가 떴으면 덮어쓰지 않는다
              if (this.phaseBanner <= 0) {
                this.phaseBanner = 1.4;
                this.phaseMsg = this._waveLabel();
              }
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
          const hf = h.facing || 1;
          const HC = (h.char && h.char.colors) || { slash: 0x2f7bff, slash2: 0x7fc8ff, edge: 0xffd166 };
          this.fx.slash(h.x + 150 * hf, h.centerY - 20, {
            radius: 160, spread: 1.1, angle: G.rand(-0.15, -0.75), width: 17,
            color: HC.slash, color2: HC.slash2, edge: HC.edge, dur: 0.24,
          });
          this.fx.slash(h.x + 175 * hf, h.centerY, {
            radius: 176, spread: 1.0, angle: G.rand(0.45, 0.05), width: 7,
            color: 0xffffff, color2: 0xffffff, dur: 0.17,
          });
          this.fx.speedLines(h.x + 120 * hf, h.centerY, hf, 4, 1.1);
          let tickHit = false;
          this.enemies.forEach((e) => {
            if (e.alive && !e.dying && G.inFront(h.x, e.x, h.facing || 1, 340)
              && G.inLane(e.y, h.y, G.LANE.hero + 22)) {
              const dmg = Math.round(h.atk * 1.35 * G.rand(1.05, 0.95));
              this.stats.damage += dmg;
              e.takeDamage(dmg, { crit: G.chance(0.3), knock: G.FEEL.skillTick.knock, dir: 1 });
              tickHit = true;
            }
          });
          if (this.boss && this.boss.alive && !this.boss.dying && Math.abs(this.boss.x - h.x) < 470
            && G.inLane(this.boss.y, h.y, G.LANE.boss + 22)) {
            const dmg = Math.round(h.atk * 1.2);
            this.stats.damage += dmg;
            this.boss.takeDamage(dmg, { kb: 30, dir: 1 });
            tickHit = true;
          }
          G.Sfx.slash(1.3);
          // 다단히트(0.11초 간격): 히트스톱은 0.2초에 한 번만 걸어 3초 스킬이 끊겨 보이지 않게 한다
          if (tickHit && this.time - this._skillFeelT >= G.FEEL.skillTick.minGap) {
            this._skillFeelT = this.time;
            this._feel('skill-tick', { stop: G.FEEL.skillTick.stop, shake: G.FEEL.skillTick.shake, shakeDur: G.FEEL.skillTick.shakeDur });
          }
        }
      }

      this.fx.update(dt);
      this.support.update(dt, realDt);
      this.hud.update(realDt, this);
      this.phaseT += realDt;
      this._updateDebugBoxes(realDt);
    }

    /* ---------------- 2.5D 판정 디버그 (H 키) ---------------- */
    /* 발밑 링 좌표·전방 타점 박스·피격 레인을 화면에 잠깐 보여 준다. 기본은 OFF. */
    toggleDebugBoxes(on) {
      this.debugBoxes = on == null ? !this.debugBoxes : !!on;
      this.debugT = this.debugBoxes ? 8 : 0;     // 8초 뒤 저절로 꺼진다
      if (!this.debugBoxes && this.debugG) this.debugG.clear();
      if (this.debugText) this.debugText.visible = this.debugBoxes;
      return this.debugBoxes;
    }

    _updateDebugBoxes(dt) {
      if (!this.debugBoxes) return;
      this.debugT -= dt;
      if (this.debugT <= 0) { this.toggleDebugBoxes(false); return; }
      this._drawDebug();
    }

    _drawDebug() {
      const g = this.debugG, h = this.kael;
      if (!g || !h) return;
      g.clear();
      const f = h.facing || 1;
      const reach = (h.atkCfg && h.atkCfg.reach ? h.atkCfg.reach : 252) + 40;
      // 내 전방 타점 박스(초록) — 정면 + 무기 리치, 이 안의 적만 맞는다
      const x0 = f > 0 ? h.x - 6 : h.x - reach;
      g.rect(x0, h.y - G.LANE.hero, reach + 6, G.LANE.hero * 2).fill({ color: 0x54ffa8, alpha: 0.10 });
      g.rect(x0, h.y - G.LANE.hero, reach + 6, G.LANE.hero * 2).stroke({ color: 0x54ffa8, width: 1.4, alpha: 0.6 });
      // 내 피격 레인(노랑) — 적 공격이 나에게 닿는 깊이
      g.rect(h.x - 22, h.y - G.LANE.enemy, 44, G.LANE.enemy * 2).fill({ color: 0xffe066, alpha: 0.12 });
      g.moveTo(h.x, h.y).lineTo(h.x + 46 * f, h.y).stroke({ color: 0x54ffa8, width: 2, alpha: 0.9 });
      // 적·보스 피격 레인(빨강)
      this.enemies.forEach((e) => { if (e.alive && !e.dying) this._dbgActor(e, 0xff5a7a, G.LANE.hero); });
      if (this.boss && this.boss.alive && !this.boss.dying) this._dbgActor(this.boss, 0xff3b6b, G.LANE.boss);
      const txt = 'X ' + Math.round(h.x) + ' · Y ' + Math.round(h.y)
        + ' · 레인 ±' + G.LANE.hero + ' · ' + (f > 0 ? '오른쪽' : '왼쪽') + ' 보기';
      if (!this.debugText) {
        this.debugText = new PIXI.Text({ text: txt, style: G.style({ fontSize: 15, fontWeight: '800', fill: 0xd8ffe8, stroke: { color: 0x06210f, width: 4 } }) });
        this.scene.fxLayer.addChild(this.debugText);
      }
      this.debugText.text = txt;
      this.debugText.visible = true;
      this.debugText.x = h.x - 96;
      this.debugText.y = h.y + 10;
    }

    _dbgActor(e, color, lane) {
      const g = this.debugG;
      const L = lane || G.LANE.hero;
      g.rect(e.x - 20, e.y - L, 40, L * 2).fill({ color, alpha: 0.10 });
      g.rect(e.x - 20, e.y - L, 40, L * 2).stroke({ color, width: 1.2, alpha: 0.55 });
      g.moveTo(e.x, e.y).lineTo(e.x + 30 * (e.facing || -1), e.y).stroke({ color, width: 1.6, alpha: 0.7 });
    }

    _lateBossSpawn() {}

    /* 공격 직전에 몸을 돌린다 (Step 8) — 뒤돌아 허공에 휘두르는 일을 없앤다.
       수동: 눌린 이동 방향(또는 조이스틱)을 먼저 본다.
       오토: 가장 가까운 적 쪽으로 먼저 돌아 정면을 보고 때린다. */
    _faceForAttack() {
      const h = this.kael;
      if (!h || h.state === 'dead') return;
      let dir = 0;
      if (this.autoMode !== 'manual') {
        const t = this._nearestEnemy();
        if (t) dir = Math.sign(t.x - h.x);
      } else {
        const k = this.keys || {};
        const left = (k['ArrowLeft'] || k['a']) ? 1 : 0;
        const right = (k['ArrowRight'] || k['d']) ? 1 : 0;
        if (left && !right) dir = -1;
        else if (right && !left) dir = 1;
        else {
          const j = this.hud && this.hud.joy;
          if (j && Math.abs(j.vx) > 0.25) dir = Math.sign(j.vx);
        }
      }
      if (dir) h.facing = dir >= 0 ? 1 : -1;
    }

    _tryAttack() {
      if (this.kael.state === 'dead') return;
      if (this.kael.state === 'attack') {
        // 공격 중 입력은 버퍼링해서 콤보로 이어진다
        if (this.kael.stateT > this.kael.atkCfg.dur * 0.55) this.attackBuffer = 0.34;
        return;
      }
      if (this.kael.state === 'dodge' || this.kael.state === 'cast') return;
      this._faceForAttack();
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
      if (closeTarget && this.cooldowns.skill2 <= 0 && this.kael.mp >= 45 && !this.summonActive && this.kael.state !== 'attack') {
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
        if (!this.muted) G.Sfx.ui(true);
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
      // 로비 첫 대사가 직전 전투 결과에 반응한다 (Step 4-3)
      this.lastResult = win ? 'victory' : 'defeat';
      if (this.lobby) this.lobby.resultEcho = this.lastResult;
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
      });      title.anchor.set(0.5); title.x = G.W / 2; title.y = 215;
      c.addChild(title);

      const hName = this.heroChar ? this.heroChar.name : '카엘';
      // 받침에 따라 조사를 고른다 (카엘·보른 → 이 / 리아·아라·세나 → 가)
      const last = hName.charCodeAt(hName.length - 1) - 0xac00;
      const josa = last >= 0 && last <= 11171 && last % 28 > 0 ? '이' : '가';
      const sub = new PIXI.Text({
        text: win ? '아르카논을 쓰러뜨렸습니다' : hName + josa + ' 쓰러졌습니다' + (reason ? ' · ' + reason : ''),
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
      const mkResultBtn = (label, x, w, fill, edgeColor) => {
        const bg2 = new PIXI.Graphics();
        platePath(bg2, x, btnY, w, 56, 12, fill, 0.95);
        plateEdge(bg2, x, btnY, w, 56, 12, edgeColor, 0.85, 2);
        c.addChild(bg2);
        const bt = new PIXI.Text({ text: label, style: G.style({ fontSize: 21, fontWeight: '900', fill: 0xf2f8ff }) });
        bt.anchor.set(0.5); bt.x = x + w / 2; bt.y = btnY + 28;
        c.addChild(bt);
        return { x, y: btnY, w, h: 56 };
      };
      const bRetry = mkResultBtn('다시 도전', G.W / 2 - 286, 268, win ? 0x2a3f1f : 0x14304d, win ? 0xffd166 : 0x7fb8e8);
      bRetry.fn = () => this.restart();
      const bLobby = mkResultBtn('로비로', G.W / 2 + 18, 268, 0x1b2334, 0xc9a86a);
      bLobby.fn = () => this.enterLobbyWithFade();
      this.overlayButtons = [bRetry, bLobby];

      const foot = new PIXI.Text({
        text: '대기실로 돌아가 동료를 만나거나, 다시 도전할 수 있습니다',
        style: G.style({ fontSize: 12, fill: 0x7f9bba }),
      });
      foot.anchor.set(0.5); foot.x = G.W / 2; foot.y = btnY + 74;
      c.addChild(foot);

      this.overlay.addChild(c);
      this.resultActive = true;
      this.overlay.alpha = 1;
    }

    restart() {
      this._teardownBattle();
      this.lobby.exit();
      this.hud.root.visible = true;
      this.vignette.visible = true;
      this.kael.hp = this.kael.hpMax;
      this.scene.zoomTo(1, 0.4);
      this.scene.focus = 0;
      this.scene._focusTarget = 0;
      if (this.hud) { this.hud.hpGhost = 1; this.hud.mpGhost = 1; this.hud._bossGhostP = 1; }
      this.start();
      this.showPrompt('WAVE 1', 0xbfe0ff, 1.2);
    }
  }

  G.Game = Game;
})();
