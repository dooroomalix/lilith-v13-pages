/* ending.js : 최종 격파 시네마틱 — 한 맺힌 비명 · 반복 외침 · 손잡기 · 모래먼지 소멸 (Step 11-3)
 *
 * 김석중님 2026-11-26 직접 설계:
 *   「최종 격파시 한 맺힌 비명소리를 내고 쓰러지는 일러스트를 적용, 다시는 돌아오지 못하게 된 것
 *    같다며 죽고 싶지 않다고 여러 번 외치고, 마지막으로 캐릭터가 다가가 손을 잡으면 모래 먼지가
 *    바람에 날아가듯이 발끝부터 서서히 사라지면서 마지막에 잡은 손만 남았다가 그 손도 모래먼지처럼
 *    사라지는 연출」
 *
 * 구성
 *   세계 좌표(worldC) : 쓰러진 노엘 본체 · 마지막까지 남는 손 · 모래 파티클 · 바람 자국
 *   화면 좌표(screen) : 암전 · 하단 자막 · 건너뛰기 버튼
 *   카메라 : 두 사람을 비추도록 줌 + 팬(scene.setCam)
 *   보이스 : noel_scream → noel_plea1~3 → noel_farewell (ElevenLabs, audio/audio.js 표에 등록)
 */
(function () {
  /* 타임라인(초) — 검증 스크립트가 이 표를 그대로 읽는다 */
  const T = {
    scream: 0.15,     // ① 한 맺힌 비명 + 섬광·슬로우
    fallIn: 0.45,     // 쓰러진 일러스트 페이드 인
    plea1: 1.80,      // ② 반복 외침 — 다시는 돌아오지 못하게 된 것 같아
    plea2: 5.90,      //    죽기 싫어… 죽기 싫어!
    plea3: 8.90,      //    아직… 아직 죽기 싫어… 제발…
    walk: 9.20,       // ③ 출전 캐릭터가 다가간다
    kneel: 11.00,     //    무릎 굽히고
    reach: 11.55,     //    손을 뻗어
    hold: 11.85,      //    손을 잡는다
    heroLine: 11.95,
    closeIn: 12.05,   // 손을 잡는 순간의 클로즈업 컷
    closeOut: 14.05,
    farewell: 13.60,  //    마지막 속삭임
    dissolve: 15.20,  // ④ 발끝부터 모래먼지로 사라진다
    dissolveDur: 3.60,
    handAlone: 18.80, //    잡은 손만 남는다
    handFade: 19.80,  //    손마저 모래먼지가 되어 바람에 흩어진다
    handFadeDur: 1.30,
    afterglow: 21.10, // ⑤ 여운
    finish: 22.20,    //    승리 결과판
  };

  const STAGES = [
    ['scream', T.plea1], ['plea', T.walk], ['approach', T.kneel], ['hold', T.dissolve],
    ['dissolve', T.handAlone], ['hand-alone', T.handFade], ['hand-gone', T.afterglow],
    ['afterglow', T.finish],
  ];

  const SAND = [0xe8d6b4, 0xd2bb95, 0xbfa583, 0xf6ead0];

  class Ending {
    constructor(game, boss) {
      const cfg = (G.Xmas && G.Xmas.ending) || {};
      this.game = game;
      this.boss = boss || null;
      this.cfg = cfg;
      this.active = true;
      this.finished = false;
      this.t = 0;
      this.stage = 'start';
      this.stageLog = [];
      this.voiceLog = [];
      this.cueLog = [];
      this.dissolve = 0;         // 0 → 1 (발끝부터)
      this.handAlpha = 1;
      this.handStage = 'attached';
      this.parts = [];
      this.partLog = [];
      this.skipReady = false;
      this.skipAt = 0;
      this._cues = [];
      this._step = 0;

      this.fallX = cfg.fallX != null ? cfg.fallX : 590;
      this.fallY = cfg.fallY != null ? cfg.fallY : 668;
      this.fallW = cfg.fallW != null ? cfg.fallW : 580;
      this.heroX = this.fallX + (cfg.heroDx != null ? cfg.heroDx : 112);
      this.heroY = cfg.heroY != null ? cfg.heroY : 672;

      this.img = { w: 1180, h: 944 };
      this.hand = (cfg.hand) || { x: 669.12, y: 151.5, w: 254, h: 202 };

      this._build();
    }

    /* ---------------- 화면 만들기 ---------------- */
    _build() {
      const g = this.game;
      const tex = G.Assets.tex || {};
      const fall = tex.noelFallen || null;
      const hand = tex.noelHand || null;
      if (fall) { this.img.w = fall.width; this.img.h = fall.height; }

      // ---- 세계 좌표: 쓰러진 노엘 ----
      this.fall = new PIXI.Container();
      this.fall.x = this.fallX;
      this.fall.y = this.fallY;
      this.fall.zIndex = this.fallY;
      const k = this.fallW / this.img.w;
      this.k = k;
      this.fall.scale.set(k);
      g.scene.actorLayer.addChild(this.fall);

      this.body = new PIXI.Sprite(fall || PIXI.Texture.WHITE);
      this.body.anchor.set(0.5, 1);
      this.body.alpha = 0;
      if (!fall) { this.body.tint = 0x30202a; this.body.width = this.img.w; this.body.height = this.img.h; }
      this.fall.addChild(this.body);

      this.maskG = new PIXI.Graphics();
      this.fall.addChild(this.maskG);
      this.body.mask = this.maskG;
      this._drawMask();

      this.handSpr = new PIXI.Sprite(hand || PIXI.Texture.WHITE);
      this.handSpr.anchor.set(0, 0);
      this.handSpr.x = this.hand.x - this.img.w / 2;
      this.handSpr.y = this.hand.y - this.img.h;
      this.handSpr.alpha = 0;
      this.fall.addChild(this.handSpr);
      this.handLocal = {
        x: this.hand.x + this.hand.w / 2 - this.img.w / 2,
        y: this.hand.y + this.hand.h / 2 - this.img.h,
      };
      this.handWorld = { x: this.fallX + this.handLocal.x * k, y: this.fallY + this.handLocal.y * k };

      // 손을 잡는 순간의 빛무리
      this.glow = new PIXI.Sprite(G.Assets.tex.glow);
      this.glow.anchor.set(0.5);
      this.glow.blendMode = 'add';
      this.glow.tint = 0xffe2b0;
      this.glow.width = 220;
      this.glow.height = 220;
      this.glow.x = this.handWorld.x;
      this.glow.y = this.handWorld.y;
      this.glow.alpha = 0;
      this.glow.zIndex = this.fallY + 4;
      g.scene.actorLayer.addChild(this.glow);

      // ---- 세계 좌표: 모래 파티클 ----
      this.sandC = new PIXI.Container();
      this.sandC.zIndex = this.fallY + 6;
      g.scene.actorLayer.addChild(this.sandC);
      this._pool = [];

      // ---- 화면 좌표: 암전·자막·건너뛰기 ----
      this.screen = new PIXI.Container();
      this.screen.zIndex = 26;
      g.root.addChild(this.screen);

      this.dim = new PIXI.Graphics();
      this.dim.alpha = 0;
      this.screen.addChild(this.dim);

      this.subC = new PIXI.Container();
      this.subC.alpha = 0;
      this.screen.addChild(this.subC);
      this.subT = 0;
      this.subDur = 0;

      // 손잡기 클로즈업 컷 (화면을 가득 채우는 한 장)
      this.closeC = new PIXI.Container();
      this.closeC.alpha = 0;
      this.closeC.visible = false;
      this.screen.addChildAt(this.closeC, 0);
      const holdTex = tex.noelHandHold || null;
      this.closeSpr = new PIXI.Sprite(holdTex || PIXI.Texture.WHITE);
      this.closeSpr.anchor.set(0.5);
      if (!holdTex) this.closeSpr.tint = 0x101820;
      this.closeC.addChild(this.closeSpr);
      this.closeVig = new PIXI.Graphics();
      this.closeC.addChild(this.closeVig);

      this.skipC = new PIXI.Container();
      this.skipC.alpha = 0.92;
      this.screen.addChild(this.skipC);
      this.skipBg = new PIXI.Graphics();
      this.skipC.addChild(this.skipBg);
      this.skipText = new PIXI.Text({
        text: '건너뛰기 ›',
        style: G.style({ fontSize: 16, fontWeight: '800', fill: 0xdfe9f6, letterSpacing: 0.5 }),
      });
      this.skipText.anchor.set(0.5);
      this.skipC.addChild(this.skipText);

      this.applyLayout();
      this._drawDim();
    }

    /* 모래 소멸 마스크 — 아래(발끝)에서 위로 올라오는 물결 경계 */
    _drawMask() {
      const W = this.img.w, H = this.img.h;
      const p = this.dissolve;
      const front = -H * p;              // 경계선 y (이미지 좌표, 위가 -H · 아래가 0) — p=0 이면 전부 보인다
      const g = this.maskG;
      g.clear();
      const x0 = -W / 2 - 40, x1 = W / 2 + 40;
      const steps = 26;
      const flat = [x0, -H - 40, x1, -H - 40];   // 위 모서리 (좌 → 우)
      for (let i = steps; i >= 0; i--) {          // 물결 경계 (우 → 좌)
        const x = x0 + (x1 - x0) * (i / steps);
        const wob = Math.sin(i * 0.9 + this.t * 5.2) * 9 + Math.sin(i * 2.3 - this.t * 3.1) * 4;
        flat.push(x, front + wob);
      }
      g.poly(flat).fill({ color: 0xffffff, alpha: 1 });
    }

    _drawDim() {
      const w = G.VIEW.w, h = G.VIEW.h;
      const g = this.dim;
      g.clear();
      g.rect(0, 0, w, h).fill({ color: 0x02060d, alpha: 1 });
      // 아래쪽은 더 짙게 — 자막이 뜨는 자리를 어둡게 (월드 띠 경계가 보이지 않게 그라데이션)
      const band = G.isPortrait() ? (G.VIEW.bandBottom || h * 0.26) : h * 0.52;
      const strips = 10;
      for (let i = 0; i < strips; i++) {
        const y0 = band + (h - band) * (i / strips);
        const hh = (h - band) / strips + 1;
        g.rect(0, y0, w, hh).fill({ color: 0x01040a, alpha: 0.04 + 0.50 * Math.pow(i / (strips - 1), 1.7) });
      }
    }

    /* 화면 배치 — 가로/세로 */
    applyLayout() {
      if (!this.screen) return;
      const w = G.VIEW.w, h = G.VIEW.h;
      const portrait = G.isPortrait();
      this._drawDim();

      // 세로 화면: HUD 가 숨겨진 동안이라 월드를 위쪽으로 키워 쓴다 (끝나면 원래 띠로 되돌린다)
      this.stripBottom = null;
      if (portrait && this.game && this.game.scene) {
        const sc = Math.min((h * 0.46) / G.H, 0.62);
        const top = Math.max(10, h * 0.02);
        this.game.scene.root.scale.set(sc);
        this.game.scene.root.position.set(w / 2 - (G.W / 2) * sc, top);
        this.stripBottom = top + G.H * sc;
        this._worldOverridden = true;
      } else {
        this.stripBottom = G.VIEW.bandBottom || h * 0.62;
      }

      // 건너뛰기 버튼 (오른쪽 위)
      const sw = portrait ? 104 : 132, sh = portrait ? 32 : 36;
      const sx = w - sw - (portrait ? 12 : 22), sy = portrait ? 12 : 20;
      this.skipRect = { x: sx, y: sy, w: sw, h: sh };
      this.skipBg.clear();
      this.skipBg.roundRect(sx, sy, sw, sh, 8).fill({ color: 0x0b1826, alpha: 0.72 });
      this.skipBg.roundRect(sx, sy, sw, sh, 8).stroke({ color: 0x9fc4e8, alpha: 0.5, width: 1.2 });
      this.skipText.style.fontSize = portrait ? 14 : 16;
      this.skipText.x = sx + sw / 2;
      this.skipText.y = sy + sh / 2;

      // 클로즈업 컷 — 화면을 덮게(cover) 중앙 크롭
      if (this.closeSpr && this.closeSpr.texture) {
        const tw = this.closeSpr.texture.width || 1, th = this.closeSpr.texture.height || 1;
        const sc = Math.max(w / tw, h / th) * 1.04;
        this.closeBase = sc;
        this.closeSpr.scale.set(sc);
        this.closeSpr.x = w / 2;
        this.closeSpr.y = h / 2;
        const vg = this.closeVig;
        vg.clear();
        vg.rect(0, 0, w, h).fill({ color: 0x02060d, alpha: 0.10 });
        vg.rect(0, h * 0.58, w, h * 0.42).fill({ color: 0x01040a, alpha: 0.34 });
      }

      // 자막 자리
      this.subBox = portrait
        ? { x: 12, y: Math.min(h - 120, (this.stripBottom || G.VIEW.bandBottom || h * 0.26) + 12), w: w - 24, h: 96 }
        : { x: 300, y: h - 128, w: 680, h: 92 };
      if (this._subData) this._drawSub();
    }

    _drawSub() {
      const d = this._subData;
      if (!d) return;
      const b = this.subBox;
      this.subC.removeChildren().forEach((c) => c.destroy({ children: true }));
      const g = new PIXI.Graphics();
      g.roundRect(b.x, b.y, b.w, b.h, 10).fill({ color: 0x04080f, alpha: 0.82 });
      g.roundRect(b.x, b.y, b.w, b.h, 10).stroke({ color: 0xe8c27a, alpha: 0.42, width: 1.2 });
      this.subC.addChild(g);
      if (d.name) {
        const nm = new PIXI.Text({
          text: d.name,
          style: G.style({ fontSize: G.isPortrait() ? 12 : 14, fontWeight: '900', fill: 0xffd9a0, letterSpacing: 2 }),
        });
        nm.x = b.x + 14; nm.y = b.y + 8;
        this.subC.addChild(nm);
      }
      const tx = new PIXI.Text({
        text: d.text,
        style: G.style({
          fontSize: G.isPortrait() ? 16 : 21, fontWeight: '700', fill: 0xf2f8ff,
          wordWrap: true, wordWrapWidth: b.w - 28, lineHeight: G.isPortrait() ? 22 : 28,
        }),
      });
      tx.x = b.x + 14; tx.y = b.y + (d.name ? (G.isPortrait() ? 24 : 28) : 12);
      if (tx.height > b.h - (d.name ? 30 : 18)) {
        tx.style.fontSize = G.isPortrait() ? 14 : 18;
        tx.style.lineHeight = G.isPortrait() ? 19 : 24;
      }
      this.subC.addChild(tx);
    }

    /* ---------------- 시작 ---------------- */
    start() {
      const g = this.game;
      this.active = true;
      g.phase = 'ending';
      g.autoMode = 'manual';
      g.hitStop = 0;
      g.slowT = 0;
      g.paused = false;
      g.resultActive = false;
      g._clearOverlay();
      if (g.hud && g.hud.root) g.hud.root.visible = false;
      if (g.hud && g.hud.releaseInputs) g.hud.releaseInputs();
      g.keys = {};
      if (g.support && g.support.reset) g.support.reset();
      if (g.dialogueC) { g.dialogueC.destroy({ children: true }); g.dialogueC = null; }
      if (g.bossCutin) { g.bossCutin.destroy({ children: true }); g.bossCutin = null; g.bossCutT = 0; }
      if (g.bossTeleLayer) g.bossTeleLayer.removeChildren();
      g.enemies.forEach((e) => { if (e.alive && !e.dying) e.die(); });
      if (g.lanterns && g.lanterns.items) g.lanterns.items.forEach((it) => { it.wind = 0; });
      // 남은 예고판·적 정리
      if (g.boss && g.boss.tele) { g.boss.tele.clear(); g.boss.tele.alpha = 0; }
      // BGM 서서히 잠잠해진다
      if (G.Sfx.fadeBgmTo) G.Sfx.fadeBgmTo(0.0, 1.8);
      if (G.Sfx.stopAllVoices) G.Sfx.stopAllVoices();

      // ① 격파의 충격
      g.flashImpact(0.95, 0xffffff);
      if (g.scene) {
        g.scene.shake(22, 1.1);
        g.scene.zoomTo(this._zMain(), 1.6);
        if (g.scene.setCam) g.scene.setCam(this._camX(), this._camY());
      }
      if (G.Sfx.wind) G.Sfx.wind(1.0);
      if (this.body) this._burst(this.fallX, this.fallY - 120, 26, 1.2);
      this._stage('scream');
    }

    _camX() { return this.handWorld.x - 30; }
    _camY() { return G.isPortrait() ? 486 : 432; }
    _zMain() { return G.isPortrait() ? 1.50 : 1.20; }
    _zHold() { return G.isPortrait() ? 1.62 : 1.26; }
    _zHand() { return G.isPortrait() ? 1.85 : 1.34; }
    _zEnd() { return G.isPortrait() ? 1.22 : 1.06; }

    /* ---------------- 자막 · 보이스 ---------------- */
    say(name, text, dur) {
      this._subData = { name, text };
      this._drawSub();
      this.subT = 0;
      this.subDur = dur || Math.max(1.8, text.length * 0.14);
    }

    voice(name, text, dur, vol) {
      const ok = G.Sfx && G.Sfx.playVoice ? G.Sfx.playVoice(name, { min: 0, chance: 1, pri: 8, maxCh: 3, vol: vol }) : false;
      if (text) this.say('노엘', text, dur);
      this.voiceLog.push({ t: +this.t.toFixed(2), name, ok: !!ok });
      return ok;
    }

    _stage(name) {
      if (this.stage === name) return;
      this.stage = name;
      this.stageLog.push({ t: +this.t.toFixed(2), stage: name });
    }

    /* ---------------- 매 프레임 ---------------- */
    update(dt) {
      if (!this.active) return;
      this.t += dt;

      // ---- 컷 시각 ----
      if (this._step === 0 && this.t >= T.scream) {
        this._step = 1;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'scream' });
        this.voice('noel_scream', '으아아아아악—!', 1.35, 0.95);
        this.game.flashImpact(0.55, 0xffffff);
        this.game.slowT = 0.9;
        this.game.scene.shake(18, 0.8);
      }
      if (this._step === 1 && this.t >= T.fallIn) {
        this._step = 2;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'fall-in' });
        this.bodyT = 0;
      }
      if (this._step === 2 && this.t >= T.plea1) {
        this._step = 3;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'plea1' });
        this.voice('noel_plea1', this.cfg.plea1, 3.8, 0.92);
      }
      if (this._step === 3 && this.t >= T.plea2) {
        this._step = 4;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'plea2' });
        this.voice('noel_plea2', this.cfg.plea2, 2.9, 0.94);
        this.game.scene.shake(6, 0.5);
      }
      if (this._step === 4 && this.t >= T.plea3) {
        this._step = 5;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'plea3' });
        this.voice('noel_plea3', this.cfg.plea3, 4.2, 0.94);
        this.game.scene.shake(5, 0.5);
      }
      if (this._step === 5 && this.t >= T.walk) {
        this._step = 6;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'walk' });
      }
      if (this._step === 6 && this.t >= T.kneel) {
        this._step = 7;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'kneel' });
      }
      if (this._step === 7 && this.t >= T.hold) {
        this._step = 8;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'hold' });
        this.holdT = 0;
        this.game.flashImpact(0.22, 0xfff0c8);
        if (G.Sfx.magic) G.Sfx.magic();
      }
      if (this._step === 8 && this.t >= T.heroLine) {
        this._step = 9;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'hero-line' });
        this.say(this.game.kael ? this.game.kael.name : '카엘', this.cfg.heroLine, 2.4);
      }
      if (this._step === 9 && this.t >= T.farewell) {
        this._step = 10;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'farewell' });
        this.voice('noel_farewell', this.cfg.farewell, 4.4, 0.86);
        this.game.scene.zoomTo(this._zHold(), 1.4);
      }
      if (this._step === 10 && this.t >= T.dissolve) {
        this._step = 11;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'dissolve' });
        if (G.Sfx.wind) G.Sfx.wind(0.9);
      }
      if (this._step === 11 && this.t >= T.handAlone) {
        this._step = 12;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'hand-alone' });
        this.handStage = 'alone';
        this.body.visible = false;
        this.game.scene.zoomTo(this._zHand(), 1.2);
        if (this.game.scene.setCam) this.game.scene.setCam(this.handWorld.x, this.handWorld.y + 40);
        this.say(null, this.cfg.handLine, 2.2);
      }
      if (this._step === 12 && this.t >= T.handFade) {
        this._step = 13;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'hand-fade' });
        this.handStage = 'gone';
        if (G.Sfx.wind) G.Sfx.wind(0.7);
        this._burst(this.handWorld.x, this.handWorld.y, 30, 1.0);
      }
      if (this._step === 13 && this.t >= T.afterglow) {
        this._step = 14;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'afterglow' });
        this.game.scene.zoomTo(this._zEnd(), 1.6);
        if (this.game.scene.setCam) this.game.scene.setCam(this._camX(), this._camY());
      }
      if (this._step === 14 && this.t >= T.finish) {
        this._step = 15;
        this.cueLog.push({ t: +this.t.toFixed(2), cue: 'finish' });
        this.finish();
        return;
      }

      // ---- 단계 이름 ----
      for (let i = 0; i < STAGES.length; i++) {
        if (this.t < STAGES[i][1]) { this._stage(STAGES[i][0]); break; }
      }

      // ---- 일러스트 페이드 인 ----
      if (this.bodyT != null) {
        this.bodyT += dt;
        const p = G.clamp(this.bodyT / 0.9, 0, 1);
        this.body.alpha = p;
        this.handSpr.alpha = p;
      }

      // ---- 손 잡는 순간 ----
      if (this.holdT != null) {
        this.holdT += dt;
        const p = G.clamp(this.holdT / 0.55, 0, 1);
        this.glow.alpha = 0.35 + Math.sin(this.t * 3.4) * 0.12;
        this.glow.width = 200 + 60 * p;
        this.glow.height = 200 + 60 * p;
      } else if (this.handStage === 'attached') {
        this.glow.alpha = 0;
      }

      // ---- 모래 소멸 ----
      if (this.t >= T.dissolve && this.dissolve < 1) {
        this.dissolve = G.clamp((this.t - T.dissolve) / T.dissolveDur, 0, 1);
        this._drawMask();
        this._spawnSand(7 + Math.round(9 * (1 - this.dissolve)));
      }
      if (this.t >= T.handFade) {
        this.handAlpha = 1 - G.clamp((this.t - T.handFade) / T.handFadeDur, 0, 1);
        this.handSpr.alpha = this.handAlpha;
        if (this.handAlpha > 0.02) this._spawnSand(3, this.handWorld.x, this.handWorld.y, 90);
        this.glow.alpha = Math.max(0, this.glow.alpha - dt * 0.8);
      }

      // ---- 자막 페이드 ----
      if (this.subC) {
        this.subT += dt;
        const tin = this.subDur > 0 ? G.clamp(this.subT / 0.22, 0, 1) : 0;
        const left = this.subDur - this.subT;
        const out = left < 0.35 ? G.clamp(left / 0.35, 0, 1) : 1;
        const a = this.subDur > 0 ? Math.min(tin, out) : Math.max(0, this.subC.alpha - dt * 2);
        this.subC.alpha = a;
        if (this.subDur > 0 && this.subT >= this.subDur) { this.subDur = 0; this._subData = null; }
      }

      // ---- 손잡기 클로즈업 ----
      if (this.closeC) {
        const tin = G.clamp((this.t - T.closeIn) / 0.28, 0, 1);
        const tout = G.clamp((this.t - (T.closeOut - 0.55)) / 0.55, 0, 1);
        const a = Math.min(tin, 1 - tout);
        this.closeC.alpha = a;
        this.closeC.visible = a > 0.001;
        if (a > 0) {
          const z = 1 + 0.05 * G.clamp((this.t - T.closeIn) / (T.closeOut - T.closeIn), 0, 1);
          const base = this.closeBase || this.closeSpr.scale.x;
          this.closeSpr.scale.set(base * z);
        }
      }

      // ---- 암전·화면 ----
      const closeA = this.closeC ? this.closeC.alpha : 0;
      this.dim.alpha = G.clamp((this.t - 2.2) / 2.4, 0, 1) * (0.34 + 0.34 * closeA);
      this.skipC.alpha = 0.92;
      if (!this.skipReady && this.t > 0.6) { this.skipReady = true; }

      this._hero(dt);
      this._particles(dt);
    }

    /* 출전 캐릭터 — 다가가 무릎 굽히고 손을 잡는다 */
    _hero(dt) {
      const g = this.game, h = g.kael;
      if (!h) return;
      if (this.t >= T.walk) {
        const target = this.heroX;
        const dx = target - h.x;
        h.y = G.lerp(h.y, this.heroY, Math.min(1, dt * 3));
        if (Math.abs(dx) > 8 && this.t < T.kneel + 1.4) {
          const sp = Math.min(340, Math.abs(dx) / Math.max(dt, 1e-3));
          h.move(Math.sign(dx) * sp, 0, dt);
          h.facing = Math.sign(dx) || 1;
        } else {
          h.vx = 0; h.vy = 0;
          h.facing = -1;                    // 쓰러진 노엘 쪽
          h.state = this.t >= T.reach ? 'reach' : 'kneel';
          h.stateT += dt;
        }
      }
    }

    /* ---------------- 모래 파티클 ---------------- */
    _spawnSand(n, x, y, spread) {
      const k = this.k;
      const front = this.fallY - this.img.h * k * (1 - this.dissolve);
      for (let i = 0; i < n; i++) {
        const wx = x != null ? x + G.rand(spread || 120, -(spread || 120))
          : this.fallX + G.rand(this.fallW * 0.46, -this.fallW * 0.46);
        const wy = y != null ? y + G.rand(60, -60)
          : front + G.rand(26, -26);
        const s = this._getPart();
        s.x = wx; s.y = wy;
        s.tint = G.choice(SAND);
        s.alpha = G.rand(0.85, 0.35);
        s.width = G.rand(13, 4);
        s.height = s.width;
        s.rotation = G.rand(G.TAU);
        this.parts.push({
          spr: s, t: 0, life: G.rand(1.9, 0.9),
          vx: G.rand(150, 40) * (this.cfg.windX != null ? this.cfg.windX : 1),
          vy: G.rand(-16, -78), spin: G.rand(2.2, -2.2),
        });
      }
    }

    _getPart() {
      if (this._pool.length) return this._pool.pop();
      const s = new PIXI.Sprite(G.Assets.tex.softDot);
      s.anchor.set(0.5);
      s.blendMode = 'normal';
      this.sandC.addChild(s);
      return s;
    }

    _burst(x, y, n, power) {
      for (let i = 0; i < n; i++) {
        const s = this._getPart();
        s.x = x + G.rand(150, -150);
        s.y = y + G.rand(120, -60);
        s.tint = G.choice(SAND);
        s.alpha = G.rand(0.9, 0.4);
        s.width = G.rand(16, 5);
        s.height = s.width;
        this.parts.push({
          spr: s, t: 0, life: G.rand(2.2, 1.0),
          vx: G.rand(220, 40) * power, vy: G.rand(-40, -140) * power, spin: G.rand(3, -3),
        });
      }
    }

    _particles(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        const q = p.t / p.life;
        if (q >= 1 || p.spr.destroyed) {
          if (!p.spr.destroyed) { p.spr.alpha = 0; p.spr.visible = false; this._pool.push(p.spr); }
          this.parts.splice(i, 1);
          continue;
        }
        p.spr.visible = true;
        p.spr.x += p.vx * dt;
        p.spr.y += p.vy * dt + Math.sin((p.t + p.spin) * 3) * 6 * dt;
        p.spr.rotation += p.spin * dt;
        p.spr.alpha = (1 - q) * (0.35 + 0.65 * Math.min(1, p.t / 0.25)) * 0.9;
      }
      if (this.parts.length > 420) {
        const drop = this.parts.splice(0, this.parts.length - 420);
        drop.forEach((p) => { if (!p.spr.destroyed) { p.spr.alpha = 0; p.spr.visible = false; this._pool.push(p.spr); } });
      }
      this.partLog = [{ t: +this.t.toFixed(2), n: this.parts.length }];
    }

    /* ---------------- 건너뛰기 ---------------- */
    skipHit(x, y) {
      const r = this.skipRect;
      if (!r) return false;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    }

    skip() {
      if (this.finished) return false;
      this.skipped = true;
      this.cueLog.push({ t: +this.t.toFixed(2), cue: 'skip' });
      this.finish();
      return true;
    }

    finish() {
      if (this.finished) return;
      this.finished = true;
      this.active = false;
      const g = this.game;
      if (G.Sfx.stopAllVoices) G.Sfx.stopAllVoices();
      if (G.Sfx.fadeBgmTo) G.Sfx.fadeBgmTo(0, 0.6);
      this._clearVisuals();
      if (g && g._endingDone) g._endingDone(this);
    }

    /* 화면·파티클 정리 (결과판으로 넘어가기 전) */
    _restoreWorld() {
      const g = this.game;
      if (!g || !g.scene) return;
      if (g.scene.setCam) g.scene.setCam(null, null);
      if (!this._worldOverridden) return;
      const band = (G.VIEW && G.VIEW.world) || { x: 0, y: 0, scale: 1 };
      g.scene.root.scale.set(band.scale);
      g.scene.root.position.set(band.x, band.y);
      this._worldOverridden = false;
    }

    _clearVisuals() {
      this._restoreWorld();
      this.parts.forEach((p) => { if (!p.spr.destroyed) p.spr.destroy(); });
      this.parts = [];
      if (this.sandC && !this.sandC.destroyed) this.sandC.destroy({ children: true });
      this.sandC = null;
      if (this.screen && !this.screen.destroyed) this.screen.destroy({ children: true });
      this.screen = null;
      if (this.subC && !this.subC.destroyed) { this.subC.destroy({ children: true }); }
      this.subC = null;
      if (this.fall && !this.fall.destroyed) this.fall.destroy({ children: true });
      this.fall = null;
      this.body = null;
      this.handSpr = null;
      if (this.glow && !this.glow.destroyed) this.glow.destroy();
      this.glow = null;
      this._pool = [];
    }

    /* restart()·_teardownBattle() 에서 호출 */
    teardown() {
      this.active = false;
      this.finished = true;
      this._clearVisuals();
      if (G.Sfx.stopAllVoices) G.Sfx.stopAllVoices();
      if (G.Sfx.bgmHold != null) {
        if (G.Sfx.fadeBgmTo) G.Sfx.fadeBgmTo(G.Sfx.bgmVolume || 0.38, 0.6);
        G.Sfx.bgmHold = null;
      }
    }

    info() {
      return {
        active: this.active, finished: this.finished, t: +this.t.toFixed(2), stage: this.stage,
        stageLog: this.stageLog.slice(-12), cueLog: this.cueLog.slice(-16), voiceLog: this.voiceLog.slice(-8),
        dissolve: +this.dissolve.toFixed(3), handAlpha: +this.handAlpha.toFixed(3), handStage: this.handStage,
        handWorld: { x: +this.handWorld.x.toFixed(1), y: +this.handWorld.y.toFixed(1) },
        fall: { x: this.fallX, y: this.fallY, w: this.fallW, k: +this.k.toFixed(3) },
        bodyAlpha: this.body ? +this.body.alpha.toFixed(3) : null,
        bodyVisible: this.body ? this.body.visible : null,
        maskFront: +(this.img.h * this.dissolve).toFixed(1),
        particles: this.parts.length,
        closeup: this.closeC ? +this.closeC.alpha.toFixed(3) : 0,
        skipRect: this.skipRect, skipped: !!this.skipped,
        hero: this.game && this.game.kael ? {
          x: Math.round(this.game.kael.x), y: Math.round(this.game.kael.y),
          state: this.game.kael.state, rigState: this.game.kael.rig ? this.game.kael.rig.state : null,
          char: this.game.deployChar,
        } : null,
        sub: this.subC ? this.subC.alpha : null, subText: this._subData ? this._subData.text : null,
        phase: this.game.phase, hudHidden: !(this.game.hud && this.game.hud.root.visible),
        cam: G.VIEW ? { zoom: this.game.scene ? +this.game.scene.zoom.toFixed(2) : null } : null,
        timeline: T,
      };
    }
  }

  Ending.TIMELINE = T;
  G.Ending = Ending;
})();
