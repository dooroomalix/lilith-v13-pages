/* battle.js : 전투 진행, 웨이브/보스 페이즈, AUTO AI, 데미지 판정, 오버레이 */
(function () {
  const AUTO_CYCLE = ['counter', 'full', 'manual'];

  class Game {
    constructor(app) {
      this.app = app;
      this.scene = new G.Scene(app);
      this.actorLayer = new PIXI.Container();
      this.actorLayer.sortableChildren = true;
      this.scene.root.addChildAt(this.actorLayer, 2);
      this.fx = new G.Fx(this.scene.fxLayer);

      this.root = new PIXI.Container();
      this.root.sortableChildren = true;
      this.scene.root.zIndex = 0;
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
      this.liaCD = 1.0;
      this.bossSpawned = false;
      this.overlayButtons = [];
      this.time = 0;
      this.timers = [];

      this._initActors();
      this._buildIntro();
    }

    _initActors() {
      this.kael = new G.Hero(this, {
        name: '카엘', role: '성문기사', texKey: 'kael', x: 380, scale: 0.70, hpMax: 780, shadowW: 160, glowColor: 0x5fb0ff,
      });
      this.lia = new G.Hero(this, {
        name: '리아', role: '기록관', texKey: 'lia', x: 262, scale: 0.64, hpMax: 780, shadowW: 140, glowColor: 0xa07bff,
      });
      this.kael.atk = 122;
      this.lia.atk = 96;
      this.lia.y = G.GROUND_Y - 14;
      this.actorLayer.addChild(this.lia.obj, this.kael.obj);
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
      const bg = new PIXI.Graphics();
      bg.rect(0, 0, G.W, G.H).fill({ color: 0x03060d, alpha: 1 });
      c.addChild(bg);
      const t = new PIXI.Text({
        text: '마지막 성문의 수호자',
        style: { fontFamily: G.FONT, fontSize: 58, fontWeight: '900', fill: 0xeaf4ff, letterSpacing: 8, stroke: { color: 0x0a1c38, width: 8 } },
      });
      t.anchor.set(0.5);
      t.x = G.W / 2; t.y = G.H / 2 - 34;
      c.addChild(t);
      const sub = new PIXI.Text({
        text: 'THE LAST GATEKEEPER   ·   전투 프로토타입 v2',
        style: { fontFamily: G.FONT, fontSize: 18, fontWeight: '700', fill: 0x8fb8e0, letterSpacing: 3 },
      });
      sub.anchor.set(0.5);
      sub.x = G.W / 2; sub.y = G.H / 2 + 30;
      c.addChild(sub);
      const hint = new PIXI.Text({
        text: '터치하면 시작 · BGM이 함께 재생됩니다',
        style: { fontFamily: G.FONT, fontSize: 14, fill: 0x6f8fb0, letterSpacing: 1 },
      });
      hint.anchor.set(0.5);
      hint.x = G.W / 2; hint.y = G.H / 2 + 90;
      c.addChild(hint);
      this.overlay.addChild(c);
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
    heroStrike(hero, cfg) {
      const dir = 1;
      const near = this._nearestEnemy();
      const reachDist = near ? G.clamp(Math.abs(near.x - hero.x) * 0.55, 110, 260) : 170;
      const cx = hero.x + 70;
      const cy = hero.centerY;
      // 카엘의 검 궤적 (몸 앞)
      this.fx.slash(cx, cy, {
        radius: 152, spread: cfg.spread * 0.9, angle: cfg.ang, width: 18,
        color: 0x3f7dff, dur: 0.2, scale: 1.0,
      });
      // 타격 지점 섬광
      this.fx.burst(cx + reachDist - 30, cy, {
        color: 0x9fd6ff, core: 0xffffff, rays: 16, length: 150, width: 7, dur: 0.19, angle: cfg.ang * 0.3,
      });

      let hits = 0;
      this.enemies.forEach((e) => {
        if (!e.alive || e.dying) return;
        const inFront = e.x > hero.x - 30;
        const inRange = Math.abs(e.x - hero.x) < cfg.reach + 40 && Math.abs(e.y - hero.y) < 150;
        if (inFront && inRange) {
          hits++;
          this._hitEnemy(e, hero, cfg.dmg);
        }
      });
      if (this.boss && this.boss.alive && !this.boss.dying) {
        if (Math.abs(this.boss.x - hero.x) < cfg.reach + 260 && Math.abs(this.boss.y - hero.y) < 200) {
          if (this.boss.x > hero.x - 60) {
            hits++;
            this._hitBoss(hero, cfg.dmg);
          }
        }
      }
      if (hits > 0) {
        this.hitStop = 0.05;
        this.scene.shake(cfg.push > 30 ? 8 : 5, 0.16);
        G.Sfx.hit(false);
        this.combo += hits;
        this.comboT = 2.4;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      }
    }

    _hitEnemy(e, hero, mult) {
      const crit = G.chance(0.24);
      const dmg = Math.round(hero.atk * mult * (crit ? 1.95 : 1) * G.rand(1.08, 0.94));
      this.stats.damage += dmg;
      e.takeDamage(dmg, { crit });
      if (crit && G.chance(0.5)) G.Sfx.hit(true);
    }

    _hitBoss(hero, mult) {
      const crit = G.chance(0.24);
      const dmg = Math.round(hero.atk * mult * (crit ? 1.95 : 1) * G.rand(1.1, 0.92));
      this.stats.damage += dmg;
      this.boss.takeDamage(dmg, { crit });
      this.boss.obj.x = this.boss.x + 6;
      this.after(0.06, () => { if (this.boss && this.boss.obj) this.boss.obj.x = this.boss.x; });
    }

    damageHero(amount, fromX) {
      if (this.phase === 'victory' || this.phase === 'defeat') return;
      const kael = this.kael;
      // 리아가 함께 맞는 연출은 생략, 카엘이 피해를 받는다
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
        this.boss = new G.Boss(this, { hp: 30000, x: 820 });
        this.actorLayer.addChild(this.boss.obj);
        this.bossSpawned = true;
        this.fx.ring(820, G.GROUND_Y - 10, 0xff3355, 260, 0.9, 8);
        this.fx.sparkBurst(820, G.GROUND_Y - 180, 0xff6b4a, 34, 620);
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
      this.fx.popText(640, 300, 'PERFECT COUNTER', { color: 0xffe9a8, size: 52, dur: 1.4 });
      this.fx.ring(kax = kaelX(this), this.kael.centerY, 0xfff2c0, 300, 0.6, 8);
      this.fx.ring(boss.x - 60, boss.y - 40, 0xffe9a8, 260, 0.55, 9);
      this.fx.burst(boss.x - 70, boss.centerY, { color: 0xffd166, core: 0xffffff, rays: 18, length: 200, width: 9, dur: 0.3 });
      this.fx.sparkBurst(this.kael.x + 120, this.kael.centerY, 0xfff0b0, 30, 700);
      this.fx.sparkBurst(boss.x - 60, boss.centerY, 0xfff0b0, 26, 640);
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
      const h = this.lia;
      if (this.cooldowns.skill2 > 0 || h.mp < 40) return false;
      h.mp -= 40;
      this.cooldowns.skill2 = this.skillMax.skill2;
      h.cast();
      G.Sfx.magic();
      this.showPrompt('빛의 심판', 0xc9a8ff, 0.9);
      const target = this._densestTarget();
      const tx = target ? target.x : 900;
      const ty = target ? target.y : G.GROUND_Y;
      this.fx.rune(tx, ty - 60, 0xb98bff, 110, 0.9);
      this.after(0.42, () => {
        this.fx.pillar(tx, ty - 10, 0xcfe4ff, 520, 0.8, 150);
        this.fx.ring(tx, ty - 10, 0xd7c2ff, 190, 0.6, 6);
        this.fx.sparkBurst(tx, ty - 90, 0xd9c8ff, 26, 520);
        this.scene.shake(9, 0.35);
        this.enemies.forEach((e) => {
          if (e.alive && !e.dying && Math.abs(e.x - tx) < 220) {
            const dmg = Math.round(h.atk * 3.4 * G.rand(1.05, 0.95));
            this.stats.damage += dmg;
            e.takeDamage(dmg, { crit: true, color: 0xd9c8ff });
          }
        });
        if (this.boss && this.boss.alive && Math.abs(this.boss.x - tx) < 300) {
          const dmg = Math.round(h.atk * 3.2);
          this.stats.damage += dmg;
          this.boss.takeDamage(dmg, { crit: true });
        }
        G.Sfx.hit(true);
      });
      return true;
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
      if (this.hitStop > 0) { this.hitStop -= realDt; dt = realDt * 0.08; }
      if (this.slowT > 0) { this.slowT -= realDt; dt *= 0.35; }

      this._processTimers(dt);
      this.scene.update(dt);
      this.actorLayer.x = this.scene.fxLayer.x;
      this.actorLayer.y = this.scene.fxLayer.y;

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
        this.kael.move(mx * sp, my * sp * 0.6, dt);
        this.lia.move(mx * sp * 0.9, my * sp * 0.6, dt);
      } else if (this.autoMode !== 'manual') {
        this._autoMove(dt);
      }
      // 리아는 카엘을 따라온다
      if (!manualMove) {
        const targetX = this.kael.x - 128;
        const targetY = Math.max(this.kael.y - 18, G.GROUND_Y - 16);
        this.lia.x = G.lerp(this.lia.x, targetX, Math.min(1, dt * 3));
        this.lia.y = G.lerp(this.lia.y, targetY, Math.min(1, dt * 2));
        this.lia.obj.x = this.lia.x;
        this.lia.obj.y = this.lia.y;
      }

      // 공격 쿨다운
      this.atkCD -= dt;
      if (this.atkCD <= 0.42) this.atkCD = Math.max(this.atkCD, 0);

      this.kael.update(dt, this.time);
      this.lia.update(dt, this.time);

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
            radius: 155, spread: 1.1, angle: G.rand(-0.15, -0.75), width: 16, color: 0x3f9bff, dur: 0.22,
          });
          this.fx.slash(h.x + 175, h.centerY, {
            radius: 170, spread: 1.0, angle: G.rand(0.45, 0.05), width: 7, color: 0xffffff, dur: 0.17,
          });
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
      if (this.atkCD > 0.16 || this.kael.state === 'attack' || this.kael.state === 'dodge') {
        this.attackBuffer = 0.3; // 다음 타이밍에 자동 발동 (입력 버퍼링)
        return;
      }
      if (this.kael.attack()) {
        this.atkCD = 0.30;
        this.attackBuffer = 0;
      }
    }

    _tryDodge() {
      if (this.kael.state === 'dead') return;
      // 퍼펙트 윈도우 판정
      if (this.perfectWindow && this.boss && this.boss.state === 'windup' && this.boss.kind === 'perfect') {
        this.perfectWindow = false;
        this.perfectCounter = true;
        G.Sfx.counter();
      }
      if (this.kael.dodgeCD > 0 || this.kael.state === 'attack') {
        // 쿨다운 중에도 퍼펙트 카운터는 성립한다
        this.kael.state = 'dodge';
        this.kael.stateT = 0;
        this.kael.invuln = 0.42;
      } else {
        this.kael.dodge();
      }
      // 회피 이펙트
      this.fx.sparkBurst(this.kael.x - 20, this.kael.centerY, 0x9fd6ff, 8, 220, Math.PI);
      this.fx.ring(this.kael.x, this.kael.y - 6, 0x9fd6ff, 70, 0.35, 3);
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
      this.cooldowns.skill1 = Math.max(0, this.cooldowns.skill1 - dt);
      this.cooldowns.skill2 = Math.max(0, this.cooldowns.skill2 - dt);

      // 스킬 사용 (적이 전투 사거리 안에 들어왔을 때만)
      const closeTarget = target && Math.abs(target.x - this.kael.x) < 330;
      if (closeTarget && this.cooldowns.skill1 <= 0 && this.kael.mp >= 30 && this.kael.state !== 'attack') {
        this.useSkill1();
      }
      if (closeTarget && this.cooldowns.skill2 <= 0 && this.lia.mp >= 45) {
        this.useSkill2();
      }

      // 기본 공격
      if (target && this.atkCD <= 0 && this.kael.state !== 'attack' && this.kael.state !== 'cast') {
        const reach = target === this.boss ? 430 : 340;
        if (Math.abs(target.x - this.kael.x) < reach) {
          this._tryAttack();
        }
      }
      // 리아 마법
      this.liaCD -= dt;
      if (this.liaCD <= 0 && target && Math.abs(target.x - this.kael.x) < 380) {
        this.liaCD = 1.7;
        this._liaBolt(target);
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
      if (Math.abs(mx) > 0.01) this.kael.move(mx * 210, 0, dt);
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

    _liaBolt(target) {
      if (this.lia.state === 'dead') return;
      const s = new PIXI.Sprite(G.Assets.tex.glow);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = 0xc9a8ff;
      s.width = 46; s.height = 46;
      s.x = this.lia.x + 40;
      s.y = this.lia.centerY - 30;
      this.scene.fxLayer.addChild(s);
      this.fx.rune(this.lia.x + 30, this.lia.y - 40, 0xb98bff, 44, 0.4);
      const proj = {
        spr: s, t: 0, dur: G.clamp(G.dist(s.x, s.y, target.x, target.y - 90) / 1400, 0.18, 0.5),
        from: { x: s.x, y: s.y },
        to: { x: target.x, y: target.y - 90 },
        target,
        trailT: 0,
      };
      this.projectiles.push(proj);
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
      g.roundRect(G.W / 2 - 220, 190, 440, 330, 16).fill({ color: 0x0a1626, alpha: 0.95 });
      g.roundRect(G.W / 2 - 220, 190, 440, 330, 16).stroke({ width: 2, color: 0x8fc6ff, alpha: 0.5 });
      c.addChild(g);
      const t = new PIXI.Text({ text: '일시정지', style: G.style({ fontSize: 36, fontWeight: '900', fill: 0xeaf4ff, letterSpacing: 4 }) });
      t.anchor.set(0.5); t.x = G.W / 2; t.y = 250;
      c.addChild(t);

      const mkBtn = (label, y, fn) => {
        const bg2 = new PIXI.Graphics();
        bg2.roundRect(G.W / 2 - 150, y, 300, 54, 10).fill({ color: 0x14304d, alpha: 0.9 });
        bg2.roundRect(G.W / 2 - 150, y, 300, 54, 10).stroke({ width: 1.6, color: 0x7fb8e8, alpha: 0.7 });
        c.addChild(bg2);
        const lt = new PIXI.Text({ text: label, style: G.style({ fontSize: 20, fontWeight: '800', fill: 0xeaf4ff }) });
        lt.anchor.set(0.5); lt.x = G.W / 2; lt.y = y + 27;
        c.addChild(lt);
        this.overlayButtons.push({ x: G.W / 2 - 150, y, w: 300, h: 54, fn });
      };
      mkBtn('계속하기', 300, () => this.togglePause());
      mkBtn(this.muted ? '소리 켜기' : '소리 끄기', 366, () => {
        this.muted = G.Sfx.toggleMute();
        this._buildPauseOverlay();
      });
      mkBtn('처음부터', 432, () => { this.togglePause(); this._defeat('처음부터'); });
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
      g.roundRect(G.W / 2 - 280, 150, 560, 420, 18).fill({ color: 0x081422, alpha: 0.96 });
      g.roundRect(G.W / 2 - 280, 150, 560, 420, 18).stroke({ width: 2, color: win ? 0xffd166 : 0xff6b7a, alpha: 0.7 });
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

      const btnY = 486;
      const bg2 = new PIXI.Graphics();
      bg2.roundRect(G.W / 2 - 150, btnY, 300, 56, 10).fill({ color: win ? 0x2a3f1f : 0x14304d, alpha: 0.95 });
      bg2.roundRect(G.W / 2 - 150, btnY, 300, 56, 10).stroke({ width: 1.8, color: win ? 0xffd166 : 0x7fb8e8, alpha: 0.8 });
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
      this.kael = null; this.lia = null;
      this._initActors();
      this.kael.hp = this.kael.hpMax;
      this.lia.hp = this.lia.hpMax;
      this.phase = 'wave';
      this.phaseT = 0;
      this.timeLeft = 60;
      this.scene.zoomTo(1, 0.4);
      this.start();
      this.showPrompt('WAVE 1', 0xbfe0ff, 1.2);
    }
  }

  function kaelX(g) { return g.kael.x + 40; }
  let kax = 0;

  G.Game = Game;
})();
