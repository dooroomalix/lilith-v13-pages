/* hud.js : 모바일 가로 HUD — 애니 판타지 프레임 (초상화/HP·MP, 지역·타이머·미니맵, 스킬 버튼, AUTO) */
(function () {
  const C = {
    plate: 0x0a1424,
    plate2: 0x102238,
    edge: 0x9fd0ff,
    gold: 0xe8c27a,
    goldDim: 0x8a6f3e,
    txt: 0xeaf4ff,
    sub: 0x9fc0e0,
    hp: 0x46e07a,
    hpTop: 0xc8ffe0,
    hpDark: 0x08251a,
    mp: 0x46a8ff,
    mpDark: 0x081c33,
    red: 0xe23a4a,
  };

  /* 모서리가 잘린 판타지 패널 경로 */
  function plate(g, x, y, w, h, cut = 10, fill = C.plate, alpha = 0.72) {
    const p = [
      x + cut, y, x + w - cut, y, x + w, y + cut, x + w, y + h - cut,
      x + w - cut, y + h, x + cut, y + h, x, y + h - cut, x, y + cut,
    ];
    g.poly(p).fill({ color: fill, alpha });
    return p;
  }

  function outline(g, x, y, w, h, cut, color, alpha, width = 1.4) {
    const p = [
      x + cut, y, x + w - cut, y, x + w, y + cut, x + w, y + h - cut,
      x + w - cut, y + h, x + cut, y + h, x, y + h - cut, x, y + cut,
    ];
    g.poly(p).stroke({ width, color, alpha });
  }

  function diamond(g, x, y, r, color, alpha = 1) {
    g.poly([x, y - r, x + r * 0.72, y, x, y + r, x - r * 0.72, y]).fill({ color, alpha });
  }

  class Hud {
    constructor(app, game) {
      this.app = app;
      this.game = game;
      this.root = new PIXI.Container();
      this.root.zIndex = 100;
      this._textCache = {};
      this.buttons = {
        attack: { x: 1178, y: 602, r: 58, press: 0 },
        skill1: { x: 1070, y: 636, r: 41, press: 0 },
        skill2: { x: 1112, y: 520, r: 41, press: 0 },
        dodge: { x: 990, y: 612, r: 37, press: 0 },
        auto: { x: 1148, y: 446, w: 138, h: 54, press: 0 },
        judge: { x: 1000, y: 74, w: 96, h: 30, press: 0 },   // Step 10-2 : 판정 표시 토글
        pause: { x: 1204, y: 30, r: 20, press: 0 },
        mute: { x: 1248, y: 30, r: 20, press: 0 },
        potion: { x: 916, y: 630, r: 32, press: 0 },
        jump: { x: 850, y: 602, r: 32, press: 0 },
        coop: { x: 826, y: 512, r: 40, press: 0 },
      };
      this.joy = { active: false, id: null, bx: 150, by: 600, r: 80, kx: 150, ky: 600, vx: 0, vy: 0 };
      this.input = { moveX: 0, moveY: 0, attack: false, skill1: false, skill2: false, dodge: false, auto: false, potion: false, jump: false, coop: false, judge: false };

      /* ---- 좌표계 그룹 (Step 9-1) ----
         가로(1280×720)에서는 모두 항등 변환이라 지금까지와 픽셀 단윈로 같고,
         세로 화면에서는 그룹마다 자리·배율을 따로 주어 화면 픽셀 좌표로 다시 배치한다. */
      this.gStatus = new PIXI.Container();   // 초상·HP/MP 판
      this.gArea = new PIXI.Container();     // 지역명·타이머·일시정지/음소거
      this.gMap = new PIXI.Container();      // 미니맵·구역 진행
      this.gBoss = new PIXI.Container();     // 보스 HP
      this.gJoy = new PIXI.Container();      // 조이스틱
      this.gCombo = new PIXI.Container();
      this.gPrompt = new PIXI.Container();   // 스킬명·구역 배너
      this.gBuff = new PIXI.Container();
      this.gBtn = {};                        // 버튼 하나당 한 그룹 (세로에서 자유롭게 배치)
      this.btnGfx = {};
      this.btnFxGfx = {};
      [this.gStatus, this.gArea, this.gMap, this.gBoss, this.gJoy, this.gCombo, this.gPrompt, this.gBuff]
        .forEach((g) => this.root.addChild(g));
      ['attack', 'skill1', 'skill2', 'dodge', 'jump', 'potion', 'coop', 'auto', 'judge'].forEach((k) => {
        const c = new PIXI.Container();
        this.gBtn[k] = c;
        this.btnFxGfx[k] = new PIXI.Graphics();
        this.btnGfx[k] = new PIXI.Graphics();
        c.addChild(this.btnFxGfx[k], this.btnGfx[k]);
        this.root.addChild(c);
      });
      this.muteG = new PIXI.Graphics();      // 음소거 아이콘 (지역·타이머 그룹에 속한다)
      this.gArea.addChild(this.muteG);

      this.potionLabel = new PIXI.Text({ text: '3', style: G.style({ fontSize: 15, fill: 0xffffff, fontWeight: '900' }) });
      this.potionLabel.zIndex = 8;
      this.gBuff.addChild(this.buffG = new PIXI.Graphics());
      this.hpGhost = 1;
      this.mpGhost = 1;
      this.build();
      this._groupify();
      this.mode = 'landscape';
      this.vw = G.W; this.vh = G.H;
      this.relayout('landscape', G.W, G.H);
    }

    /* build() 가 root 에 만든 것들을 좌표계 그룹으로 옮긴다 */
    _groupify() {
      const put = (g, list) => list.forEach((o) => { if (o && o.parent !== g) g.addChild(o); });
      put(this.gStatus, [this.panelG, this.bars, this.portraitMask, this.portrait,
        this.nameText, this.classText, this.hpNum, this.mpNum]);
      put(this.gArea, [this.rightG, this.areaText, this.timerText]);
      put(this.gMap, [this.minimapG, this.minimapDots, this.mapLabel]);
      put(this.gBoss, [this.bossG, this.bossName, this.bossHpText, this.bossPhaseText]);
      put(this.gJoy, [this.joyG]);
      put(this.gPrompt, [this.promptText, this.phaseText]);
      put(this.gCombo, [this.comboText, this.comboSub]);
      put(this.gBtn.potion, [this.potionLabel]);
      put(this.gBtn.coop, [this.coopGlyph, this.coopLabel]);
      put(this.gBtn.auto, [this.autoText, this.autoModeText]);
      const jg = this._textCache['jumpGlyph'];
      if (jg) this.gBtn.jump.addChild(jg);
      Object.keys(this.cdTexts || {}).forEach((k) => {
        if (this.gBtn[k]) this.gBtn[k].addChild(this.cdTexts[k]);
      });
    }

    _text(key, str, style, parent) {      if (!this._textCache[key]) {
        const t = new PIXI.Text({ text: str, style });
        this._textCache[key] = t;
        parent.addChild(t);
      }
      const t = this._textCache[key];
      if (t.text !== str) t.text = str;
      return t;
    }

    build() {
      const root = this.root;

      // ---- 상·하단 가독성 그라데이션 (화면 크기가 바뀌면 다시 그린다) ----
      this.topGrad = new PIXI.Graphics();
      this.botGrad = new PIXI.Graphics();
      root.addChild(this.topGrad, this.botGrad);
      this._drawGradients(G.W, G.H);

      // ---- 좌상단 상태 패널 ----
      this.panelG = new PIXI.Graphics();
      root.addChild(this.panelG);
      this.bars = new PIXI.Graphics();
      root.addChild(this.bars);

      this.portrait = new PIXI.Sprite(G.Assets.tex.portraitKael);
      this.portrait.width = 68; this.portrait.height = 68;
      this.portrait.x = 24; this.portrait.y = 25;
      this.portrait.mask = (() => {
        const m = new PIXI.Graphics();
        m.roundRect(24, 25, 68, 68, 8).fill({ color: 0xffffff });
        root.addChild(m);
        this.portraitMask = m;
        return m;
      })();
      root.addChild(this.portrait);

      this.nameText = this._text('name', 'Lv.1 카엘', G.style({ fontSize: 17, fill: 0xf2f8ff, fontWeight: '900' }), root);
      this.nameText.x = 104; this.nameText.y = 19;
      this.classText = this._text('class', '성문기사 · GUARDIAN', G.style({ fontSize: 10, fill: 0x9fc0e0, fontWeight: '800', letterSpacing: 1 }), root);
      this.classText.x = 186; this.classText.y = 25;

      this.hpNum = this._text('hpnum', '520/520', G.style({ fontSize: 13, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x073a1c, width: 3.5 } }), root);
      this.mpNum = this._text('mpnum', '100/100', G.style({ fontSize: 10, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x06264a, width: 3 } }), root);

      // ---- 우상단 : 지역명 / 타이머 / 미니맵 ----
      this.rightG = new PIXI.Graphics();
      root.addChild(this.rightG);

      this.areaText = this._text('area', '폐허의 거리', G.style({ fontSize: 17, fill: 0xf2f8ff, fontWeight: '900', letterSpacing: 1 }), root);
      this.areaText.anchor.set(0.5, 0.5);
      this.areaText.x = 966; this.areaText.y = 30;

      this.timerText = this._text('timer', '01:00', G.style({ fontSize: 30, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x061428, width: 5 } }), root);
      this.timerText.anchor.set(0.5, 0.5);
      this.timerText.x = 1108; this.timerText.y = 29;

      this.mapLabel = this._text('maplabel', '폐허 · 1구역', G.style({ fontSize: 11, fill: 0x9fc0e0, fontWeight: '700' }), root);
      this.mapLabel.anchor.set(0, 1);
      this.mapLabel.x = 1094; this.mapLabel.y = 158;

      this.minimapG = new PIXI.Graphics();
      root.addChild(this.minimapG);
      this.minimapDots = new PIXI.Graphics();
      root.addChild(this.minimapDots);

      // ---- 보스 HP ----
      this.bossG = new PIXI.Graphics();
      root.addChild(this.bossG);
      this.bossName = this._text('bossname', '', G.style({ fontSize: 18, fill: 0xffe9ec, fontWeight: '900', letterSpacing: 2, stroke: { color: 0x2a0408, width: 5 } }), root);
      this.bossName.anchor.set(0.5, 0);
      this.bossName.x = 636; this.bossName.y = 42;
      this.bossHpText = this._text('bosshp', '', G.style({ fontSize: 12, fill: 0xffd7dc, fontWeight: '800', stroke: { color: 0x2a0408, width: 3 } }), root);
      this.bossHpText.anchor.set(1, 0.5);
      this.bossHpText.x = 908; this.bossHpText.y = 92;
      // Step 9-2: 보스 페이즈 배지 (P1 / P2) — 보스 바 안쪽 왼쪽에 붙는다
      this.bossPhaseText = this._text('bossphase', 'P1', G.style({ fontSize: 17, fill: 0xffe9a8, fontWeight: '900', letterSpacing: 1, stroke: { color: 0x2a0408, width: 4 } }), root);
      this.bossPhaseText.anchor.set(0, 0.5);
      this.bossPhaseText.x = 374; this.bossPhaseText.y = 81;
      this.bossPhaseText.alpha = 0;

      // ---- 조이스틱 ----
      this.joyG = new PIXI.Graphics();
      root.addChild(this.joyG);

      // ---- 우하단 버튼 ----
      this.btnG = new PIXI.Graphics();
      root.addChild(this.btnG);
      this.btnFx = new PIXI.Graphics();
      root.addChild(this.btnFx);
      this.cdTexts = {};
      ['skill1', 'skill2', 'dodge'].forEach((k) => {
        this.cdTexts[k] = this._text('cd_' + k, '', G.style({ fontSize: 16, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x001018, width: 4 } }), root);
        this.cdTexts[k].anchor.set(0.5);
        this.cdTexts[k].visible = false;
      });
      this.autoText = this._text('auto', 'AUTO', G.style({ fontSize: 20, fill: 0xeaf6ff, fontWeight: '900', letterSpacing: 1 }), root);
      this.autoText.anchor.set(0.5);
      this.autoModeText = this._text('automode', '반격만 수동', G.style({ fontSize: 12, fill: 0xa9c9e8, fontWeight: '800' }), root);
      this.autoModeText.anchor.set(0.5);

      // ---- 리아 협동 버튼 (R / C · 터치) — 게이지 링 ----
      this.coopGlyph = this._text('coopglyph', 'R', G.style({ fontSize: 20, fill: 0xfff2c8, fontWeight: '900', stroke: { color: 0x3a2404, width: 4 } }), root);
      this.coopGlyph.anchor.set(0.5);
      this.coopGlyph.x = this.buttons.coop.x;
      this.coopGlyph.y = this.buttons.coop.y - 3;
      this.coopLabel = this._text('cooplabel', '협동', G.style({ fontSize: 11, fill: 0xa9c9e8, fontWeight: '800', letterSpacing: 0.5 }), root);
      this.coopLabel.anchor.set(0.5, 0);
      this.coopLabel.x = this.buttons.coop.x;
      this.coopLabel.y = this.buttons.coop.y + this.buttons.coop.r + 2;

      // ---- 콤보 / 프롬프트 / 페이즈 ----
      this.comboText = this._text('combo', '', G.style({ fontSize: 40, fill: 0xffe9a8, fontWeight: '900', stroke: { color: 0x2a1a04, width: 7 } }), root);
      this.comboText.anchor.set(0, 0.5);
      this.comboText.x = 40; this.comboText.y = 462;
      this.comboSub = this._text('combosub', 'HIT', G.style({ fontSize: 17, fill: 0xffd166, fontWeight: '900', letterSpacing: 2 }), root);
      this.comboSub.anchor.set(0, 0.5);
      this.comboSub.x = 40; this.comboSub.y = 496;
      this.comboText.alpha = 0;
      this.comboSub.alpha = 0;

      this.promptText = this._text('prompt', '', G.style({ fontSize: 42, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x0a1428, width: 8 }, letterSpacing: 2 }), root);
      this.promptText.anchor.set(0.5);
      this.promptText.x = 640; this.promptText.y = 208;
      this.promptText.alpha = 0;

      this.phaseText = this._text('phase', '', G.style({ fontSize: 27, fill: 0xffe9a8, fontWeight: '900', stroke: { color: 0x2a1a08, width: 6 }, letterSpacing: 5 }), root);
      this.phaseText.anchor.set(0.5);
      this.phaseText.x = 640; this.phaseText.y = 150;
      this.phaseText.alpha = 0;

      this._drawStatic();
      this._drawButtons();
      this._drawJoystick();
    }

    /* 매 프레임 다시 그리지 않는 정적 프레임 */
    _drawStatic() {
      const g = this.panelG;
      g.clear();
      // 상태 패널
      plate(g, 14, 12, 340, 96, 12, C.plate, 0.74);
      outline(g, 14, 12, 340, 96, 12, C.gold, 0.55, 1.6);
      outline(g, 18, 16, 332, 88, 10, C.edge, 0.18, 1);
      diamond(g, 14, 60, 5, C.gold, 0.9);
      diamond(g, 354, 60, 5, C.gold, 0.9);
      // 초상화 프레임
      g.roundRect(22, 23, 72, 72, 9).fill({ color: 0x0b2036, alpha: 0.95 });
      g.roundRect(22, 23, 72, 72, 9).stroke({ width: 2, color: C.edge, alpha: 0.55 });
      g.roundRect(25, 26, 66, 22, 7).fill({ color: 0x9fd6ff, alpha: 0.10 });

      const r = this.rightG;
      r.clear();
      // 지역명 판
      plate(r, 892, 10, 148, 40, 10, C.plate, 0.62);
      outline(r, 892, 10, 148, 40, 10, C.edge, 0.35, 1.2);
      // 타이머 판
      plate(r, 1046, 8, 124, 44, 12, C.plate2, 0.78);
      outline(r, 1046, 8, 124, 44, 12, C.gold, 0.5, 1.4);
      r.circle(1066, 30, 9).stroke({ width: 1.8, color: 0xbfe0ff, alpha: 0.9 });
      r.moveTo(1066, 25).lineTo(1066, 30).lineTo(1070, 32).stroke({ width: 1.6, color: 0xbfe0ff, alpha: 0.9 });
      // 일시정지 / 음소거
      const b = this.buttons;
      [b.pause, b.mute].forEach((btn) => {
        r.circle(btn.x, btn.y, btn.r).fill({ color: 0x08131f, alpha: 0.66 });
        r.circle(btn.x, btn.y, btn.r).stroke({ width: 1.4, color: 0xa8ccef, alpha: 0.5 });
      });
      r.roundRect(b.pause.x - 6.5, b.pause.y - 9, 5, 18, 2).fill({ color: 0xffffff, alpha: 0.92 });
      r.roundRect(b.pause.x + 1.5, b.pause.y - 9, 5, 18, 2).fill({ color: 0xffffff, alpha: 0.92 });
      this._drawMuteIcon();

      // 미니맵
      const m = this.minimapG;
      m.clear();
      plate(m, 1086, 56, 178, 108, 10, C.plate, 0.66);
      outline(m, 1086, 56, 178, 108, 10, C.gold, 0.45, 1.3);
      for (let i = 1; i < 4; i++) {
        m.moveTo(1086 + (178 / 4) * i, 58).lineTo(1086 + (178 / 4) * i, 162).stroke({ width: 0.6, color: 0x5b8fc0, alpha: 0.20 });
        m.moveTo(1088, 56 + (108 / 4) * i).lineTo(1262, 56 + (108 / 4) * i).stroke({ width: 0.6, color: 0x5b8fc0, alpha: 0.20 });
      }
      m.circle(1175, 110, 46).stroke({ width: 1, color: 0x74b6ff, alpha: 0.14 });
      diamond(m, 1175, 56, 4, C.gold, 0.7);
    }

    _drawMuteIcon() {
      const b = this.buttons.mute;
      const g = this.btnFx;
      // 아이콘은 버튼 다시 그릴 때 함께 그린다
      this._muteAt = { x: b.x, y: b.y };
    }

    /* ================================================================ 화면 배치 (Step 9-1) */
    /* 전체 화면 그라데이션 — 화면 크기가 바뀌면 다시 그린다 */
    _drawGradients(w, h) {
      const tg = this.topGrad, bg = this.botGrad;
      if (!tg || !bg) return;
      tg.clear(); bg.clear();
      const topH = Math.min(h * 0.24, Math.max(140, h * 0.22));
      for (let i = 0; i < 16; i++) {
        tg.rect(0, (i * topH) / 16, w, topH / 16 + 1).fill({ color: 0x03070f, alpha: 0.34 * (1 - i / 16) });
      }
      const botH = Math.min(h * 0.34, 180 * (w / G.W) + 120);
      for (let i = 0; i < 14; i++) {
        bg.rect(0, h - botH + (i * botH) / 14, w, botH / 14 + 1).fill({ color: 0x03070f, alpha: 0.30 * (i / 14) });
      }
    }

    /* 내용 좌표(px,py)가 화면 좌표(vx,vy)에 오도록 그룹 변환을 만든다 */
    _at(vx, vy, s, px, py) { return { x: vx - (px || 0) * s, y: vy - (py || 0) * s, s }; }

    _landscapeLayout() {
      const id = { x: 0, y: 0, s: 1 };
      const out = {
        viewW: G.W, viewH: G.H,
        band: { x: 0, y: 0, w: G.W, h: G.H, scale: 1 },
        status: id, area: id, map: id, boss: id, joy: id, combo: id, prompt: id, buff: id,
        btn: {},
      };
      Object.keys(this.gBtn).forEach((k) => { out.btn[k] = id; });
      return out;
    }

    /* 세로 화면(예: 390×844) — 월드는 폭에 맞춰 위로, HUD 는 화면 픽셀 좌표로 다시 배치 */
    _portraitLayout(w, h) {
      const k = G.clamp(w / 390, 0.8, 1.3);      // 폭 기준 배율
      const ky = G.clamp(h / 844, 0.85, 1.2);    // 높이 기준 배율
      const padY = 10;
      let st = G.clamp((w * 0.94) / 340, 0.7, 1.3);    // 상태 판
      let st2 = G.clamp((w * 0.96) / 376, 0.6, 1.3);   // 지역명·타이머
      let sm = G.clamp((w * 0.36) / 178, 0.5, 1.05);   // 미니맵
      const bandScale = w / G.W;
      const bandH = G.H * bandScale;
      let sb = G.clamp((w - 16) / 560, 0.5, 1.1);      // 보스 HP
      const deckMin = 300 * ky;
      // 화면이 짧으면 상단 정보 블록을 통째로 줄여 월드 띠·조작부 자리를 지킨다
      const need = () => 96 * st + 44 * st2 + 108 * sm + 12;
      const avail = h - (bandH + 62 * sb + deckMin + padY);
      if (avail > 60 && need() > avail) {
        const f = avail / need();
        st *= f; st2 *= f; sm *= f;
      }
      // 상단: 상태 판 → 지역·타이머 → 미니맵
      const statusTop = padY;
      const status = this._at(2, statusTop, st, 14, 12);
      const areaX0 = w - 4 - 376 * st2;
      const areaY0 = statusTop + 96 * st + 6;
      const area = this._at(areaX0, areaY0, st2, 892, 8);
      const mapX0 = w - 4 - 178 * sm;
      const mapY0 = areaY0 + 44 * st2 + 10;
      const map = this._at(mapX0, mapY0, sm, 1086, 56);
      // 월드 띠
      const bandY = Math.round(mapY0 + 118 * sm + 6);
      const band = { x: 0, y: bandY, w, h: bandH, scale: bandScale };
      // 보스 HP — 월드 띠 바로 아래
      const bossX0 = (w - 560 * sb) / 2;
      const bossY0 = bandY + bandH + 4;
      const boss = this._at(bossX0, bossY0, sb, 356, 42);
      // 중앙 안내(스킬명·구역 배너) — 월드 띠 안쪽 아래에 자막처럼 걸어 둔다
      const sp = G.clamp(w / 620, 0.58, 1);
      const promptY = bandY + bandH - 6;
      const prompt = this._at(w / 2, promptY, sp, 640, 208);
      // 콤보 — 왼쪽 위(조이스틱 위)
      const sc = G.clamp(w / 560, 0.62, 1);
      const combo = this._at(10, h - 234 * ky, sc, 40, 462);
      // 물약 버프 게이지 바
      const buff = this._at(16, h - 300 * ky, G.clamp(k, 0.8, 1.2), 862, 671);
      // 조이스틱 — 왼쪽 아래
      const sj = 56 * k / 80;
      const joy = this._at(76 * k, h - 78 * ky, sj, 150, 600);
      // 액션 버튼 — 손이 닿는 자리마다 개별 배치
      const btn = {};
      const place = (key, vx, vy, rView, rContent) => { btn[key] = this._at(vx, vy, rView / rContent, this.buttons[key].x, this.buttons[key].y); };
      place('attack', w - 64 * k, h - 76 * ky, 46 * k, 58);
      place('skill1', w - 158 * k, h - 56 * ky, 34 * k, 41);
      place('dodge', w - 228 * k, h - 156 * ky, 31 * k, 37);
      place('jump', w - 134 * k, h - 160 * ky, 28 * k, 32);
      place('potion', w - 44 * k, h - 156 * ky, 28 * k, 32);
      place('skill2', w - 204 * k, h - 234 * ky, 34 * k, 41);
      place('coop', w - 88 * k, h - 240 * ky, 32 * k, 40);
      place('auto', w - 314 * k, h - 286 * ky, 0.8 * k, 1);
      place('judge', w - 135 * k, h - 300 * ky, Math.min(1, k * 1.02), 1);
      return { viewW: w, viewH: h, band, status, area, map, boss, joy, combo, prompt, buff, btn, box: { st, st2, sm, sb, k, ky } };
    }

    /* 가로/세로 배치 적용 — 월드 띠 사각형을 돌려준다 (Battle.applyLayout 이 쓴다) */
    relayout(mode, w, h) {
      this.mode = mode;
      this.vw = w; this.vh = h;
      const L = (mode === 'portrait') ? this._portraitLayout(w, h) : this._landscapeLayout(w, h);
      this.L = L;
      const put = (g, t) => {
        if (!g || !t) return;
        g.position.set(t.x, t.y);
        g.scale.set(t.s, t.s);
      };
      put(this.gStatus, L.status);
      put(this.gArea, L.area);
      put(this.gMap, L.map);
      put(this.gBoss, L.boss);
      put(this.gJoy, L.joy);
      put(this.gCombo, L.combo);
      put(this.gPrompt, L.prompt);
      put(this.gBuff, L.buff);
      Object.keys(this.gBtn).forEach((key) => put(this.gBtn[key], L.btn[key]));
      this._drawGradients(L.viewW, L.viewH);
      this._drawStatic();
      this._drawButtons();
      this._drawJoystick();
      return L.band;
    }

    /* 화면 좌표 → 그룹 내용 좌표 */
    _local(group, x, y) {
      const s = (group && group.scale.x) || 1;
      return { x: (x - (group ? group.x : 0)) / s, y: (y - (group ? group.y : 0)) / s };
    }

    _hitCircle(key, x, y, pad) {
      const b = this.buttons[key];
      const g = this.gBtn[key];
      if (!b || !g) return false;
      const p = this._local(g, x, y);
      return G.dist(p.x, p.y, b.x, b.y) <= b.r + (pad || 0);
    }

    /* 검증용: 지금 배치된 버튼·판의 화면 좌표 */
    layoutInfo() {
      const L = this.L || this._landscapeLayout();
      const toView = (key) => {
        const b = this.buttons[key];
        const t = L.btn[key];
        if (!b || !t) return null;
        const cx = t.x + b.x * t.s;
        const cy = t.y + b.y * t.s;
        const out = { x: +cx.toFixed(1), y: +cy.toFixed(1), s: +t.s.toFixed(3) };
        if (b.r) {
          out.r = +(b.r * t.s).toFixed(1);
        } else {
          // 사각 버튼(AUTO)은 화면 좌상단 기준으로 돌려준다 — 검증이 겹침을 재기 좋게
          out.w = +(b.w * t.s).toFixed(1);
          out.h = +(b.h * t.s).toFixed(1);
          out.x = +(cx - out.w / 2).toFixed(1);
          out.y = +(cy - out.h / 2).toFixed(1);
        }
        return out;
      };
      const out = { mode: this.mode, vw: this.vw, vh: this.vh, band: L.band, buttons: {}, joy: {} };
      Object.keys(this.gBtn).forEach((key) => { out.buttons[key] = toView(key) || null; });
      const j = this.joy, jt = L.joy;
      out.joy = {
        x: +(jt.x + (j.bx) * jt.s).toFixed(1), y: +(jt.y + (j.by) * jt.s).toFixed(1),
        r: +(j.r * jt.s).toFixed(1), scale: +jt.s.toFixed(3),
      };
      const pa = this.buttons.pause, ma = this.buttons.mute, at = L.area;
      out.pause = { x: +(at.x + pa.x * at.s).toFixed(1), y: +(at.y + pa.y * at.s).toFixed(1), r: +(pa.r * at.s).toFixed(1) };
      out.mute = { x: +(at.x + ma.x * at.s).toFixed(1), y: +(at.y + ma.y * at.s).toFixed(1), r: +(ma.r * at.s).toFixed(1) };
      return out;
    }

    _drawJoystick() {
      const g = this.joyG;
      g.clear();
      const j = this.joy;
      const t = performance.now() / 1000;
      g.circle(j.bx, j.by, j.r).fill({ color: 0x08182c, alpha: j.active ? 0.34 : 0.20 });
      g.circle(j.bx, j.by, j.r).stroke({ width: 1.6, color: 0x9fd0ff, alpha: j.active ? 0.55 : 0.28 });
      g.circle(j.bx, j.by, j.r * 0.74).stroke({ width: 1, color: 0x9fd0ff, alpha: 0.14 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * G.TAU;
        const r1 = j.r - 5, r2 = j.r - (i % 2 ? 9 : 14);
        g.moveTo(j.bx + Math.cos(a) * r1, j.by + Math.sin(a) * r1);
        g.lineTo(j.bx + Math.cos(a) * r2, j.by + Math.sin(a) * r2);
        g.stroke({ width: 1.8, color: 0x9fd0ff, alpha: 0.22 });
      }
      const kr = j.r * 0.44;
      g.circle(j.kx, j.ky, kr).fill({ color: 0x9fd0ff, alpha: j.active ? 0.26 : 0.14 });
      g.circle(j.kx, j.ky, kr).stroke({ width: 1.8, color: 0xe6f4ff, alpha: j.active ? 0.85 : 0.45 });
      g.circle(j.kx, j.ky - kr * 0.3, kr * 0.62).fill({ color: 0xffffff, alpha: j.active ? 0.16 : 0.07 });
      if (j.active) {
        g.circle(j.bx, j.by, j.r + 4 + Math.sin(t * 6) * 2).stroke({ width: 1.4, color: 0x9fd0ff, alpha: 0.25 });
      }
    }

    _drawButtons() {
      const b = this.buttons;
      const t = performance.now() / 1000;
      Object.keys(this.btnGfx || {}).forEach((k) => this.btnGfx[k].clear());

      const ring = (btn, key, color, icon) => {
        const g = this.btnGfx[key];
        const press = btn.press > 0 ? 1 - btn.press / 0.16 : 0;
        const r = btn.r * (1 - press * 0.06);
        g.circle(btn.x, btn.y, r + 7).fill({ color, alpha: 0.10 });
        g.circle(btn.x, btn.y, r + 3).stroke({ width: 1.2, color, alpha: 0.35 });
        g.circle(btn.x, btn.y, r).fill({ color: 0x061424, alpha: 0.82 });
        g.circle(btn.x, btn.y, r*.74).fill({ color, alpha: press*.22 });
        g.circle(btn.x, btn.y, r).stroke({ width: 2.4, color, alpha: 0.9 });
        g.circle(btn.x, btn.y, r * 0.84).stroke({ width: 1, color, alpha: 0.22 });
        g.circle(btn.x, btn.y - r * 0.42, r * 0.72).fill({ color, alpha: 0.06 + press * 0.08 });
        icon(btn, r, g);
      };

      ring(b.attack, 'attack', 0xbfe0ff, (btn, r, g) => {
        const x = btn.x, y = btn.y, s = r / 58;
        g.moveTo(x-19*s,y-16*s).lineTo(x+18*s,y+18*s).stroke({width:5*s,color:0x8ed6ff,alpha:.8});
        g.poly([
          x - 16 * s, y + 20 * s, x + 12 * s, y - 8 * s, x + 22 * s, y - 18 * s,
          x + 24 * s, y - 24 * s, x + 18 * s, y - 22 * s, x + 8 * s, y - 12 * s,
          x - 20 * s, y + 16 * s,
        ]).fill({ color: 0xffffff, alpha: 0.96 });
        g.moveTo(x - 22 * s, y + 8 * s).lineTo(x - 8 * s, y + 22 * s).stroke({ width: 4 * s, color: 0xffffff, alpha: 0.96 });
        g.circle(x - 20 * s, y + 22 * s, 3.2 * s).fill({ color: 0xffffff, alpha: 0.9 });
      });
      ring(b.skill1, 'skill1', 0x5fb6ff, (btn, r, g) => {
        const x = btn.x, y = btn.y, s = r / 41;
        for (let i = 0; i < 3; i++) {
          const off = (i - 1) * 9 * s;
          g.moveTo(x - 15 * s, y + 10 * s + off).lineTo(x + 15 * s, y - 6 * s + off)
            .stroke({ width: 3.4 * s, color: 0xdff0ff, alpha: 0.95 });
        }
        g.moveTo(x + 10 * s, y - 14 * s).lineTo(x + 17 * s, y - 7 * s).stroke({ width: 2 * s, color: 0x9fd0ff, alpha: 0.75 });
      });
      ring(b.skill2, 'skill2', 0xb98bff, (btn, r, g) => {
        const x = btn.x, y = btn.y, s = r / 41;
        const pts = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * G.TAU - Math.PI / 2;
          const rad = (i % 2 === 0 ? 15 : 6) * s;
          pts.push(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        }
        g.poly(pts).fill({ color: 0xe6d6ff, alpha: 0.96 });
        g.circle(x, y, 3 * s).fill({ color: 0xffffff, alpha: 0.95 });
        g.moveTo(x-20*s,y+8*s).lineTo(x-20*s,y-10*s).lineTo(x-8*s,y-20*s).stroke({width:2.3*s,color:0xd8baff,alpha:.8});
        g.moveTo(x+20*s,y+8*s).lineTo(x+20*s,y-10*s).lineTo(x+8*s,y-20*s).stroke({width:2.3*s,color:0xd8baff,alpha:.8});
      });
      ring(b.jump, 'jump', 0x91caff, (btn, r, g) => {
        this._text('jumpGlyph', '↑', G.style({fontSize:32,fill:0xe2f2ff,fontWeight:'900'}), this.gBtn.jump).position.set(btn.x-12,btn.y-23);
      });
      ring(b.potion, 'potion', 0x7df1aa, (btn, r, g) => {
        g.roundRect(btn.x - 10, btn.y - 12, 20, 25, 5).fill({color:0x9fffe0,alpha:.85});
        g.roundRect(btn.x - 8, btn.y - 3, 16, 13, 3).fill({color:0x19b987,alpha:.95});
        g.rect(btn.x - 6, btn.y - 18, 12, 7).fill({color:0xd9fff1});
        g.moveTo(btn.x - 5,btn.y - 8).lineTo(btn.x - 5,btn.y + 6).stroke({width:2,color:0xffffff,alpha:.75});
      });
      ring(b.dodge, 'dodge', 0xffffff, (btn, r, g) => {
        const x = btn.x, y = btn.y, s = r / 37;
        const a0 = Math.PI * 0.25, a1 = Math.PI * 1.55;
        g.beginPath();
        g.moveTo(x + Math.cos(a0) * 11 * s, y + 2 * s + Math.sin(a0) * 11 * s);
        g.arc(x, y + 2 * s, 11 * s, a0, a1);
        g.stroke({ width: 3.2 * s, color: 0xffffff, alpha: 0.92 });
        g.poly([x + 9 * s, y - 12 * s, x + 16 * s, y - 6 * s, x + 6 * s, y - 3 * s])
          .fill({ color: 0xffffff, alpha: 0.92 });
      });

      // 협동(리아 · 성광 협공) — 게이지 링은 btnFx 에서 매 프레임 그린다
      const g = this.btnGfx.coop;
      const cb = b.coop;
      const cpress = cb.press > 0 ? 1 - cb.press / 0.16 : 0;
      g.circle(cb.x, cb.y, cb.r + 8).fill({ color: 0xffd166, alpha: 0.08 });
      g.circle(cb.x, cb.y, cb.r).fill({ color: 0x140f04, alpha: 0.86 });
      g.circle(cb.x, cb.y, cb.r).stroke({ width: 2.4, color: 0xc9a86a, alpha: 0.85 });
      g.circle(cb.x, cb.y, cb.r * 0.84).stroke({ width: 1, color: 0xffe9a8, alpha: 0.2 });
      g.circle(cb.x, cb.y - cb.r * 0.42, cb.r * 0.7).fill({ color: 0xffe9a8, alpha: 0.05 + cpress * 0.12 });
      g.poly([cb.x, cb.y - cb.r - 6, cb.x + 4, cb.y - cb.r - 12, cb.x, cb.y - cb.r - 18, cb.x - 4, cb.y - cb.r - 12])
        .fill({ color: 0xffd166, alpha: 0.85 });

      // AUTO 토글
      const ag = this.btnGfx.auto;
      const a = b.auto;
      const on = this.game && this.game.autoMode !== 'manual';
      ag.roundRect(a.x - a.w / 2, a.y - a.h / 2, a.w, a.h, 14)
        .fill({ color: on ? 0x14395c : 0x0a1626, alpha: on ? 0.88 : 0.66 });
      ag.roundRect(a.x - a.w / 2, a.y - a.h / 2, a.w, a.h, 14)
        .stroke({ width: 2, color: on ? 0x7fd8ff : 0x6a8aa8, alpha: 0.9 });
      ag.roundRect(a.x - a.w / 2 + 3, a.y - a.h / 2 + 2.5, a.w - 6, a.h * 0.38, 10)
        .fill({ color: 0xbfe8ff, alpha: on ? 0.10 : 0.04 });
      const ix = a.x - a.w / 2 + 22, iy = a.y - 6;
      ag.moveTo(ix - 8, iy + 8).lineTo(ix + 8, iy - 8).stroke({ width: 3, color: 0xdff0ff, alpha: 0.92 });
      ag.moveTo(ix - 10, iy + 3).lineTo(ix - 2, iy + 11).stroke({ width: 2, color: 0xdff0ff, alpha: 0.7 });
      this.autoText.x = a.x + 16;
      this.autoText.y = a.y - 6;
      this.autoModeText.x = a.x + 16;
      this.autoModeText.y = a.y + 17;

      // 판정 표시 토글 (Step 10-2) — 2.5D 히트박스·피격 박스를 화면에 그린다. H 키와 같은 상태
      const jg = this.btnGfx.judge;
      const jj = b.judge;
      const jOn = !!(this.game && this.game.debugBoxes);
      const jpress = jj.press > 0 ? 1 - jj.press / 0.16 : 0;
      const jw = jj.w * (1 - jpress * 0.05);
      const jh = jj.h * (1 - jpress * 0.05);
      jg.roundRect(jj.x - jw / 2, jj.y - jh / 2, jw, jh, 11)
        .fill({ color: jOn ? 0x0f3a2a : 0x0a1626, alpha: jOn ? 0.92 : 0.62 });
      jg.roundRect(jj.x - jw / 2, jj.y - jh / 2, jw, jh, 11)
        .stroke({ width: 1.6, color: jOn ? 0x54ffa8 : 0x8aa6c0, alpha: jOn ? 0.95 : 0.55 });
      jg.circle(jj.x - jw / 2 + 15, jj.y, 4.2).fill({ color: jOn ? 0x54ffa8 : 0x5a708a, alpha: 0.95 });
      const jt = this._text('judge', '판정', G.style({ fontSize: 13, fontWeight: '900', fill: 0xd8ffe8 }), this.gBtn.judge);
      jt.anchor.set(0.5); jt.x = jj.x - 2; jt.y = jj.y;
      jt.style.fill = jOn ? 0xd8ffe8 : 0xc2d4e6;
      const jsb = this._text('judgeSub', 'ON', G.style({ fontSize: 9, fontWeight: '800', fill: 0x9fe8b8 }), this.gBtn.judge);
      jsb.anchor.set(0.5); jsb.x = jj.x + jw / 2 - 14; jsb.y = jj.y + 1;
      if (jsb.text !== (jOn ? 'ON' : 'OFF')) jsb.text = jOn ? 'ON' : 'OFF';
      jsb.style.fill = jOn ? 0x9fe8b8 : 0x7d93ab;

      // 음소거 아이콘 (지역·타이머 그룹 위)
      const mg = this.muteG;
      if (mg) mg.clear();
      const mx = b.mute.x, my = b.mute.y;
      if (mg) {
        mg.poly([mx - 9, my - 4, mx - 4, my - 4, mx + 1, my - 9, mx + 1, my + 9, mx - 4, my + 4, mx - 9, my + 4])
          .fill({ color: 0xffffff, alpha: 0.85 });
        if (this.game && this.game.muted) {
          mg.moveTo(mx + 5, my - 6).lineTo(mx + 13, my + 6).stroke({ width: 2, color: 0xff7a8a, alpha: 0.95 });
          mg.moveTo(mx + 13, my - 6).lineTo(mx + 5, my + 6).stroke({ width: 2, color: 0xff7a8a, alpha: 0.95 });
        } else {
          mg.arc(mx + 2, my, 7, -0.9, 0.9).stroke({ width: 2, color: 0xffffff, alpha: 0.75 });
          mg.arc(mx + 2, my, 11, -0.8, 0.8).stroke({ width: 2, color: 0xffffff, alpha: 0.45 });
        }
      }
      // 퍼펙트 회피 창: 회피 버튼 발광
      if (this.game && this.game.perfectWindow) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 18);
        const db = b.dodge;
        const dg = this.btnFxGfx.dodge;
        dg.circle(db.x, db.y, db.r + 10 + pulse * 8).stroke({ width: 3, color: 0xffffff, alpha: 0.35 + 0.45 * pulse });
        dg.circle(db.x, db.y, db.r + 2).fill({ color: 0xffffff, alpha: 0.08 + 0.12 * pulse });
      }
    }

    /* ---------- 입력 ---------- */
    pointerDown(x, y, id) {
      const b = this.buttons;
      const hit = (key, pad = 0) => this._hitCircle(key, x, y, pad);
      const pa = this._local(this.gArea, x, y);
      if (G.dist(pa.x, pa.y, b.pause.x, b.pause.y) <= b.pause.r + 6) { this.input.pause = true; b.pause.press = 0.16; return; }
      if (G.dist(pa.x, pa.y, b.mute.x, b.mute.y) <= b.mute.r + 6) { this.input.mute = true; b.mute.press = 0.16; return; }
      // 판정 표시 토글 (Step 10-2) — 일시정지·사운드 옆 상단 HUD
      const jd = this.buttons.judge;
      const ju = this._local(this.gBtn.judge, x, y);
      if (Math.abs(ju.x - jd.x) < jd.w / 2 + 6 && Math.abs(ju.y - jd.y) < jd.h / 2 + 8) {
        this.input.judge = true; jd.press = 0.16; return;
      }
      const ax = b.auto;
      const au = this._local(this.gBtn.auto, x, y);
      if (Math.abs(au.x - ax.x) < ax.w / 2 + 4 && Math.abs(au.y - ax.y) < ax.h / 2 + 4) {
        this.input.auto = true; ax.press = 0.16; return;
      }
      if (hit('attack', 10)) { this.input.attack = true; b.attack.press = 0.16; return; }
      if (hit('coop', 10)) { this.input.coop = true; b.coop.press = 0.16; return; }
      if (hit('jump', 8)) { this.input.jump = true; b.jump.press = 0.16; return; }
      if (hit('potion', 8)) { this.input.potion = true; b.potion.press = 0.16; return; }
      if (hit('skill1', 8)) { this.input.skill1 = true; b.skill1.press = 0.16; return; }
      if (hit('skill2', 8)) { this.input.skill2 = true; b.skill2.press = 0.16; return; }
      if (hit('dodge', 8)) { this.input.dodge = true; b.dodge.press = 0.16; return; }
      // 조이스틱 — 가로: 왼쪽 아래, 세로: 월드 띠 아래 왼쪽 절반
      const band = (this.L && this.L.band) || { y: 0, h: G.H };
      const reg = this.mode === 'portrait'
        ? { x0: 0, x1: this.vw * 0.56, y0: band.y + band.h + 16, y1: this.vh }
        : { x0: 0, x1: G.W * 0.52, y0: G.H * 0.35, y1: G.H };
      if (x >= reg.x0 && x <= reg.x1 && y >= reg.y0 && y <= reg.y1) {
        const p = this._local(this.gJoy, x, y);
        const j = this.joy;
        j.active = true; j.id = id;
        j.bx = G.clamp(p.x, 92, 300);
        j.by = G.clamp(p.y, 430, 660);
        j.kx = j.bx; j.ky = j.by;
        this._drawJoystick();
      }
    }

    pointerMove(x, y, id) {
      const j = this.joy;
      if (!j.active || j.id !== id) return;
      const p = this._local(this.gJoy, x, y);
      const dx = p.x - j.bx, dy = p.y - j.by;
      const d = Math.hypot(dx, dy);
      const max = j.r * 0.72;
      const k = d > max ? max / d : 1;
      j.kx = j.bx + dx * k;
      j.ky = j.by + dy * k;
      j.vx = d > 6 ? (dx * k) / max : 0;
      j.vy = d > 6 ? (dy * k) / max : 0;
      this._drawJoystick();
    }

    pointerUp(x, y, id) {
      const j = this.joy;
      if (j.active && j.id === id) {
        j.active = false; j.id = null;
        j.kx = j.bx; j.ky = j.by;
        j.vx = 0; j.vy = 0;
        this._drawJoystick();
      }
    }

    consume() {
      const i = this.input;
      const out = {
        attack: i.attack, skill1: i.skill1, skill2: i.skill2, dodge: i.dodge,
        auto: i.auto, pause: i.pause, mute: i.mute, potion: i.potion, jump: i.jump, coop: i.coop, judge: i.judge,
        moveX: this.joy.vx, moveY: this.joy.vy,
      };
      i.attack = i.skill1 = i.skill2 = i.dodge = i.auto = i.pause = i.mute = i.potion = i.jump = i.coop = i.judge = false;
      return out;
    }

    /* 출전 캐릭터·스킨을 HUD 이름판·초상에 반영한다 (Step 7) */
    setHero(C, skin) {
      if (!C) return;
      if (this.nameText) this.nameText.text = 'Lv.1 ' + C.name;
      if (this.classText) this.classText.text = C.role + ' · GUARDIAN';
      const path = (G.CHARS && G.CHARS.portrait) ? G.CHARS.portrait(C.key, skin || 'basic') : null;
      if (!path) return;
      G.Assets._img(path).then((img) => {
        const t = PIXI.Texture.from(img);
        t.source.scaleMode = 'linear';
        this.portrait.texture = t;
        this.portrait.width = 68;
        this.portrait.height = 68;
      }).catch(() => {});
    }

    /* ---------- 갱신 ---------- */
    update(dt, game) {
      const b = this.buttons;
      ['attack', 'skill1', 'skill2', 'dodge', 'auto', 'pause', 'mute', 'potion', 'jump', 'coop', 'judge'].forEach((k) => {
        if (b[k].press > 0) b[k].press = Math.max(0, b[k].press - dt);
      });

      const kael = game.kael;
      const g = this.bars;
      g.clear();
      const bx = 104, bw = 224;
      const by = 46, bh = 15;

      // HP: 늦게 따라오는 잔상(피해량) 위에 실제 HP
      const hpP = G.clamp(kael.hp / kael.hpMax, 0, 1);
      this.hpGhost = Math.max(hpP, this.hpGhost - dt * 0.55);
      g.roundRect(bx, by, bw, bh, 5).fill({ color: C.hpDark, alpha: 0.95 });
      g.roundRect(bx + 1, by + 1, (bw - 2) * this.hpGhost, bh - 2, 4).fill({ color: 0xff8fa0, alpha: 0.55 });
      g.roundRect(bx + 1, by + 1, (bw - 2) * hpP, bh - 2, 4).fill({ color: C.hp, alpha: 0.98 });
      g.roundRect(bx + 1, by + 1, (bw - 2) * hpP, (bh - 2) * 0.46, 3).fill({ color: C.hpTop, alpha: 0.45 });
      g.roundRect(bx + 1, by + bh - 5, (bw - 2) * hpP, 3, 2).fill({ color: 0x0a5b2c, alpha: 0.5 });
      g.roundRect(bx, by, bw, bh, 5).stroke({ width: 1.2, color: 0x9fe8b8, alpha: 0.55 });
      for (let i = 1; i < 6; i++) {
        g.rect(bx + (bw / 6) * i, by + 1, 1, bh - 2).fill({ color: 0x03140b, alpha: 0.5 });
      }
      // 저체력 경고
      if (hpP < 0.3) {
        const pulse = 0.5 + 0.5 * Math.sin(game.time * 9);
        g.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 6).stroke({ width: 2, color: 0xff5b6e, alpha: 0.25 + 0.5 * pulse });
      }

      // MP
      const my = 70, mh = 9;
      const mpP = G.clamp(kael.mp / kael.mpMax, 0, 1);
      this.mpGhost = G.lerp(this.mpGhost, mpP, 1 - Math.pow(0.002, dt));
      g.roundRect(bx, my, bw, mh, 4).fill({ color: C.mpDark, alpha: 0.95 });
      g.roundRect(bx + 1, my + 1, (bw - 2) * mpP, mh - 2, 3).fill({ color: C.mp, alpha: 0.95 });
      g.roundRect(bx + 1, my + 1, (bw - 2) * mpP, (mh - 2) * 0.45, 2).fill({ color: 0xbfe3ff, alpha: 0.5 });
      g.roundRect(bx, my, bw, mh, 4).stroke({ width: 1, color: 0x9fd0ff, alpha: 0.5 });
      // 흐르는 빛
      const sweep = ((game.time * 0.35) % 1) * bw;
      g.rect(bx + sweep, my + 1, 12, mh - 2).fill({ color: 0xffffff, alpha: 0.10 });

      if (this.hpNum.text !== `${Math.ceil(kael.hp)}/${kael.hpMax}`) this.hpNum.text = `${Math.ceil(kael.hp)}/${kael.hpMax}`;
      this.hpNum.x = bx + bw - this.hpNum.width - 6; this.hpNum.y = by - 1;
      if (this.mpNum.text !== `${Math.floor(kael.mp)}/${kael.mpMax}`) this.mpNum.text = `${Math.floor(kael.mp)}/${kael.mpMax}`;
      this.mpNum.x = bx + bw - this.mpNum.width - 6; this.mpNum.y = my - 2;

      // 타이머
      const tStr = G.fmtTime(game.timeLeft);
      if (this.timerText.text !== tStr) this.timerText.text = tStr;
      this.timerText.style.fill = game.phase === 'boss' ? 0xffc2ca : (game.timeLeft < 11 ? 0xffd166 : 0xffffff);

      // 지역명
      const zi = game.zoneInfo ? game.zoneInfo() : null;
      const area = zi ? zi.area : ((game.phase === 'boss' || game.phase === 'bossIntro' || game.phase === 'victory') ? '폐허의 왕좌' : '폐허의 거리');
      if (this.areaText.text !== area) this.areaText.text = area;
      if (zi) {
        const lbl = zi.order + '스테이지 · ' + zi.zoneName;
        if (this.mapLabel.text !== lbl) this.mapLabel.text = lbl;
      }

      // 보스 HP
      this.bossG.clear();
      if (game.boss && game.boss.alive) {
        const p = G.clamp(game.boss.hp / game.boss.hpMax, 0, 1);
        const bx2 = 356, by2 = 68, bw2 = 560, bh2 = 26;
        plate(this.bossG, bx2, by2, bw2, bh2, 9, C.plate, 0.66);
        this.bossG.roundRect(bx2 + 3, by2 + 3, bw2 - 6, bh2 - 6, 6).fill({ color: 0x2a0a10, alpha: 0.92 });
        this.bossG.roundRect(bx2 + 4, by2 + 4, (bw2 - 8) * this.bossGhost(), bh2 - 8, 5).fill({ color: 0xff9aa6, alpha: 0.4 });
        this.bossG.roundRect(bx2 + 4, by2 + 4, (bw2 - 8) * p, bh2 - 8, 5).fill({ color: C.red, alpha: 0.96 });
        this.bossG.roundRect(bx2 + 4, by2 + 4, (bw2 - 8) * p, (bh2 - 8) * 0.45, 4).fill({ color: 0xff9aa6, alpha: 0.45 });
        for (let i = 1; i < 10; i++) {
          this.bossG.rect(bx2 + 4 + ((bw2 - 8) / 10) * i, by2 + 4, 1, bh2 - 8).fill({ color: 0x1a0408, alpha: 0.45 });
        }
        outline(this.bossG, bx2, by2, bw2, bh2, 9, 0xff8a99, 0.55, 1.6);
        diamond(this.bossG, bx2, by2 + bh2 / 2, 7, C.gold, 0.9);
        diamond(this.bossG, bx2 + bw2, by2 + bh2 / 2, 7, C.gold, 0.9);
        this.bossName.text = game.boss.name;
        this.bossName.alpha = 1;
        this.bossHpText.text = `${G.num(game.boss.hp)} / ${G.num(game.boss.hpMax)}`;
        this.bossHpText.alpha = 1;
        this.bossHpText.y = 92;
        // 페이즈 배지 — 2페이즈는 붉게, 살아 있는 동안만
        const ph = game.boss.phaseKey || 'P1';
        if (this.bossPhaseText.text !== ph) this.bossPhaseText.text = ph;
        this.bossPhaseText.style.fill = ph === 'P2' ? 0xff8a99 : 0xffe9a8;
        this.bossPhaseText.alpha = 1;
      } else {
        this.bossName.alpha = 0;
        this.bossHpText.alpha = 0;
        this.bossPhaseText.alpha = 0;
        this._bossGhostP = 1;
      }

      // 콤보
      const combo = game.combo;
      if (combo >= 2) {
        this.comboText.text = String(combo);
        const a = Math.min(1, (game.comboT || 1) * 1.6);
        this.comboText.alpha = a;
        this.comboSub.alpha = a * 0.9;
        this.comboSub.x = 42 + this.comboText.width;
        this.comboText.style.fontSize = 34 + Math.min(20, combo * 1.2);
        this.comboText.style.fill = combo >= 20 ? 0xfff2b0 : 0xffe9a8;
      } else {
        this.comboText.alpha = 0;
        this.comboSub.alpha = 0;
      }

      // 프롬프트
      if (game.promptT > 0) {
        game.promptT -= dt;
        this.promptText.text = game.promptMsg;
        const p = 1 - game.promptT / game.promptMax;
        this.promptText.alpha = p < 0.15 ? p / 0.15 : p > 0.7 ? (1 - p) / 0.3 : 1;
        this.promptText.scale.set(1 + 0.1 * Math.sin(p * Math.PI * 3));
      } else {
        this.promptText.alpha = 0;
      }

      // 페이즈 배너
      if (game.phaseBanner > 0) {
        game.phaseBanner -= dt;
        this.phaseText.text = game.phaseMsg;
        this.phaseText.alpha = Math.min(1, game.phaseBanner);
      } else this.phaseText.alpha = 0;

      // 쿨다운 (부채꼴 스윕)
      const cd = game.cooldowns;
      Object.keys(this.btnFxGfx || {}).forEach((k) => this.btnFxGfx[k].clear());
      const sweepCd = (key, btn, cur, max) => {
        const t2 = this.cdTexts[key];
        const fx = this.btnFxGfx[key];
        if (cur > 0) {
          const p = G.clamp(cur / max, 0, 1);
          t2.visible = cur >= 0.1;
          t2.text = cur.toFixed(1) + "s";
          t2.x = btn.x; t2.y = btn.y;
          fx.moveTo(btn.x, btn.y);
          fx.arc(btn.x, btn.y, btn.r * 0.98, -Math.PI / 2, -Math.PI / 2 + G.TAU * p);
          fx.closePath();
          fx.fill({ color: 0x02060c, alpha: 0.55 });
        } else t2.visible = false;
      };
      sweepCd('skill1', b.skill1, cd.skill1, game.skillMax.skill1);
      sweepCd('skill2', b.skill2, cd.skill2, game.skillMax.skill2);
      sweepCd('dodge', b.dodge, kael.dodgeCD, 2.4);
      this._drawCoop(game);

      // 물약 수량 및 버프 잔여시간 게이지
      this.potionLabel.text = String(game.potions);
      this.potionLabel.x = b.potion.x + 17; this.potionLabel.y = b.potion.y + 9;
      this.buffG.clear();
      if (game.buffTime > 0) {
        this.buffG.roundRect(862, 671, 104, 5, 2).fill({ color: 0x17452c, alpha: 0.9 });
        this.buffG.roundRect(862, 671, 104 * game.buffTime / 8, 5, 2).fill({ color: 0x71ffac });
      }
      this._drawAuto(game);
      this._drawButtons();
      this._drawJoystick();

      // 미니맵 점
      const m = this.minimapDots;
      m.clear();
      const mx = 1086, my2 = 56, mw = 178, mh2 = 108;
      const toMap = (wx, wy) => [mx + G.clamp((wx - 100) / 1250, 0, 1) * (mw - 16) + 8, my2 + G.clamp((wy - 480) / 190, 0, 1) * (mh2 - 26) + 16];
      game.enemies.forEach((e) => {
        if (!e.alive) return;
        const [px, py] = toMap(e.x, e.y);
        m.circle(px, py, 3).fill({ color: 0xff5566, alpha: 0.95 });
      });
      if (game.boss && game.boss.alive) {
        const [px, py] = toMap(game.boss.x, game.boss.y);
        m.circle(px, py, 5.5).fill({ color: 0xffb03a, alpha: 1 });
        m.circle(px, py, 9).stroke({ width: 1.5, color: 0xffb03a, alpha: 0.6 });
      }
      const dots = [[game.kael, 0x6fdcff]];
      if (game.lia && game.lia.active && game.lia.obj) dots.push([game.lia.obj, 0xcf9bff]);
      dots.forEach(([h, col]) => {
        const [px, py] = toMap(h.x, h.y);
        m.circle(px, py, 3.6).fill({ color: col, alpha: 1 });
        m.circle(px, py, 6.5).stroke({ width: 1.2, color: col, alpha: 0.5 });
      });
      const [kx, ky] = toMap(game.kael.x, game.kael.y);
      m.moveTo(kx, ky).lineTo(kx + 22, ky - 10).lineTo(kx + 22, ky + 10).closePath().fill({ color: 0x9fe0ff, alpha: 0.18 });

      // 구역 진행 바 — 몇 구역 · 몇 웨이브를 지나고 있는지 한눈에
      if (zi) {
        const px = 1090, py = 168, pw = 170, ph = 6;
        m.roundRect(px, py, pw, ph, 3).fill({ color: 0x0a1626, alpha: 0.9 });
        const done = zi.waveCount ? G.clamp((zi.waveIndex + 1) / zi.waveCount, 0, 1) : 0;
        if (done > 0) m.roundRect(px, py, Math.max(5, pw * done), ph, 3).fill({ color: 0xffd166, alpha: 0.9 });
        (game.zones || []).forEach((z) => {
          if (!z.from || !zi.waveCount) return;
          const tx = px + pw * (z.from / zi.waveCount);
          m.rect(tx - 0.7, py - 2, 1.4, ph + 4).fill({ color: 0xdfeaff, alpha: 0.55 });
        });
        m.roundRect(px, py, pw, ph, 3).stroke({ width: 1, color: 0x9fc0e0, alpha: 0.35 });
      }
    }

    bossGhost() {
      const game = this.game;
      if (!game || !game.boss) return 1;
      const p = G.clamp(game.boss.hp / game.boss.hpMax, 0, 1);
      this._bossGhostP = Math.max(p, (this._bossGhostP === undefined ? p : this._bossGhostP) - 0.006);
      return this._bossGhostP;
    }

    /* 협동 게이지 링 · 준비/지속/대기 상태 (매 프레임) */
    _drawCoop(game) {
      const b = this.buttons.coop;
      const g = this.btnFxGfx.coop;
      const max = game.coopMax || G.COOP.max;
      const p = G.clamp((game.coopGauge || 0) / max, 0, 1);
      const active = (game.coopActive || 0) > 0;
      const cooling = (game.coopCd || 0) > 0;
      const ready = p >= 0.999 && !active && !cooling;
      const t = performance.now() / 1000;
      const col = active ? 0xffe9a8 : ready ? 0xffd166 : 0x94a8c4;

      // 테두리 링(게이지) — 지속 중에는 남은 시간을 보여 준다
      const pp = active ? G.clamp(game.coopActive / G.COOP.dur, 0, 1) : p;
      if (pp > 0.002) {
        g.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + G.TAU * pp)
          .stroke({ width: 5, color: col, alpha: ready || active ? 0.95 : 0.7 });
      }
      if (ready) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 7);
        g.circle(b.x, b.y, b.r + 9 + pulse * 7).stroke({ width: 2.4, color: 0xffe9a8, alpha: 0.2 + 0.4 * pulse });
        g.circle(b.x, b.y, b.r).fill({ color: 0xffd166, alpha: 0.08 + 0.1 * pulse });
      }
      if (active) {
        g.circle(b.x, b.y, b.r + 7).stroke({ width: 2, color: 0xffe9a8, alpha: 0.55 });
      }

      const label = active ? String(Math.ceil(game.coopActive))
        : ready ? 'R'
          : (cooling ? String(Math.ceil(game.coopCd)) : 'R');
      if (this.coopGlyph.text !== label) this.coopGlyph.text = label;
      this.coopGlyph.style.fill = active ? 0xfff6e0 : ready ? 0xfff2c8 : 0xbcd0e8;
      const sub = active ? '협동 중' : ready ? '준비' : (cooling ? '대기' : Math.round(p * 95) + '%');
      if (this.coopLabel.text !== sub) this.coopLabel.text = sub;
      this.coopLabel.style.fill = active ? 0xffe9a8 : ready ? 0xffd166 : 0x8fa8c4;
    }

    _drawAuto(game) {
      const label = { full: '완전 오토', counter: '반격만 수동', manual: '완전 수동' }[game.autoMode];
      if (this.autoModeText.text !== label) this.autoModeText.text = label;
      const color = { full: 0x7fe9b0, counter: 0x7fd8ff, manual: 0xffb0a0 }[game.autoMode];
      this.autoText.style.fill = color;
      this.autoModeText.style.fill = color;
    }
  }

  G.Hud = Hud;
})();
