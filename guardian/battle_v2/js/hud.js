/* hud.js : 모바일 가로 HUD (초상화/HP/MP, 지역명/타이머/미니맵, 조이스틱, 스킬 버튼, AUTO) */
(function () {
  const C = {
    panel: 0x0a1626,
    panelA: 0.62,
    edge: 0x8fc6ff,
    edgeA: 0.32,
    txt: 0xeaf4ff,
    sub: 0x9fc0e0,
    hp: 0x3ce06e,
    hpDark: 0x0f3a24,
    mp: 0x3aa4ff,
    mpDark: 0x0e2745,
    gold: 0xffd166,
  };

  function panel(g, x, y, w, h, r = 8, alpha = C.panelA) {
    g.roundRect(x, y, w, h, r).fill({ color: C.panel, alpha });
    g.roundRect(x, y, w, h, r).stroke({ width: 1.4, color: C.edge, alpha: C.edgeA });
    g.roundRect(x + 1.5, y + 1.5, w - 3, h * 0.45, r).fill({ color: 0x9fd0ff, alpha: 0.05 });
  }

  class Hud {
    constructor(app, game) {
      this.app = app;
      this.game = game;
      this.root = new PIXI.Container();
      this.root.zIndex = 100;
      this._textCache = {};
      this.buttons = {
        attack: { x: 1178, y: 604, r: 58, press: 0 },
        skill1: { x: 1072, y: 636, r: 40, press: 0 },
        skill2: { x: 1112, y: 522, r: 40, press: 0 },
        dodge: { x: 992, y: 610, r: 36, press: 0 },
        auto: { x: 1150, y: 446, w: 132, h: 56, press: 0 },
        pause: { x: 1198, y: 30, r: 20, press: 0 },
        mute: { x: 1242, y: 30, r: 20, press: 0 },
      };
      this.joy = { active: false, id: null, bx: 150, by: 596, r: 78, kx: 150, ky: 596, vx: 0, vy: 0 };
      this.input = { moveX: 0, moveY: 0, attack: false, skill1: false, skill2: false, dodge: false, auto: false };
      this.build();
    }

    _text(key, str, style, parent) {
      if (!this._textCache[key]) {
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

      // ---- 상단 그라데이션 (가독성) ----
      const topGrad = new PIXI.Graphics();
      for (let i = 0; i < 14; i++) {
        topGrad.rect(0, (i * 150) / 14, G.W, 150 / 14 + 1).fill({ color: 0x03070f, alpha: 0.30 * (1 - i / 14) });
      }
      root.addChild(topGrad);
      const botGrad = new PIXI.Graphics();
      for (let i = 0; i < 12; i++) {
        botGrad.rect(0, G.H - 160 + (i * 160) / 12, G.W, 160 / 12 + 1).fill({ color: 0x03070f, alpha: 0.26 * (i / 12) });
      }
      root.addChild(botGrad);

      // ---- 좌상단 상태 패널 ----
      this.hpG = new PIXI.Graphics();
      root.addChild(this.hpG);
      panel(this.hpG, 16, 14, 320, 88, 10, 0.55);

      // 초상화 프레임
      this.portraitFrame = new PIXI.Graphics();
      this.portraitFrame.roundRect(26, 24, 68, 68, 8).fill({ color: 0x0b2036, alpha: 0.9 });
      root.addChild(this.portraitFrame);
      this.portrait = new PIXI.Sprite(G.Assets.tex.portraitKael);
      this.portrait.width = 64; this.portrait.height = 64;
      this.portrait.x = 28; this.portrait.y = 26;
      this.portrait.mask = (() => {
        const m = new PIXI.Graphics();
        m.roundRect(28, 26, 64, 64, 7).fill({ color: 0xffffff });
        root.addChild(m);
        return m;
      })();
      root.addChild(this.portrait);
      const pEdge = new PIXI.Graphics();
      pEdge.roundRect(26, 24, 68, 68, 8).stroke({ width: 2, color: 0x9ad0ff, alpha: 0.65 });
      root.addChild(pEdge);

      this.nameText = this._text('name', 'Lv.1 카엘', G.style({ fontSize: 17, fill: 0xeaf4ff, fontWeight: '800' }), root);
      this.nameText.x = 106; this.nameText.y = 19;

      this.hpNum = this._text('hpnum', '520/520', G.style({ fontSize: 13, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x0a3a1c, width: 3.5 } }), root);
      this.hpNum.x = 318;

      this.mpNum = this._text('mpnum', '100/100', G.style({ fontSize: 10, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x06264a, width: 3 } }), root);
      this.mpNum.x = 318;

      // 바 그래픽 (숫자보다 아래에 깔리도록 먼저 추가)
      this.bars = new PIXI.Graphics();
      root.addChildAt(this.bars, root.getChildIndex(this.hpNum));
      root.addChild(this.hpNum, this.mpNum);

      // ---- 우상단 : 지역명 / 타이머 / 일시정지 / 미니맵 ----
      this.rightG = new PIXI.Graphics();
      root.addChild(this.rightG);

      this.areaText = this._text('area', '폐허의 거리', G.style({ fontSize: 18, fill: 0xf2f8ff, fontWeight: '800' }), root);
      this.areaText.anchor.set(0, 0.5);
      this.areaText.x = 934; this.areaText.y = 30;

      this.timerText = this._text('timer', '01:00', G.style({ fontSize: 30, fill: 0xffffff, fontWeight: '900' }), root);
      this.timerText.anchor.set(0, 0.5);
      this.timerText.x = 1098; this.timerText.y = 30;

      // 일시정지 아이콘
      const pg = new PIXI.Graphics();
      pg.roundRect(this.buttons.pause.x - 7, this.buttons.pause.y - 9, 5.5, 18, 2).fill({ color: 0xffffff, alpha: 0.9 });
      pg.roundRect(this.buttons.pause.x + 2, this.buttons.pause.y - 9, 5.5, 18, 2).fill({ color: 0xffffff, alpha: 0.9 });
      root.addChild(pg);

      // 음소거 아이콘
      this.muteG = new PIXI.Graphics();
      root.addChild(this.muteG);
      this._drawMute();

      // 미니맵
      this.minimapG = new PIXI.Graphics();
      root.addChild(this.minimapG);
      this.minimapDots = new PIXI.Graphics();
      root.addChild(this.minimapDots);
      panel(this.minimapG, 1086, 58, 178, 104, 8, 0.5);
      this.minimapG.rect(1086, 58, 178, 104).stroke({ width: 1, color: 0x74b6ff, alpha: 0.25 });
      for (let i = 1; i < 4; i++) {
        this.minimapG.moveTo(1086 + (178 / 4) * i, 58).lineTo(1086 + (178 / 4) * i, 162).stroke({ width: 0.6, color: 0x5b8fc0, alpha: 0.18 });
        this.minimapG.moveTo(1086, 58 + (104 / 4) * i).lineTo(1264, 58 + (104 / 4) * i).stroke({ width: 0.6, color: 0x5b8fc0, alpha: 0.18 });
      }
      this.mapLabel = this._text('maplabel', '폐허 · 1구역', G.style({ fontSize: 11, fill: 0x9fc0e0, fontWeight: '700' }), root);
      this.mapLabel.x = 1094; this.mapLabel.y = 145;

      // ---- 보스 HP 바 (상단 중앙) ----
      this.bossG = new PIXI.Graphics();
      root.addChild(this.bossG);
      this.bossName = this._text('bossname', '', G.style({ fontSize: 17, fill: 0xffe9ec, fontWeight: '900', stroke: { color: 0x2a0408, width: 4 } }), root);
      this.bossName.anchor.set(0.5, 0);
      this.bossName.x = 636; this.bossName.y = 44;
      this.bossHpText = this._text('bosshp', '', G.style({ fontSize: 12, fill: 0xffd7dc, fontWeight: '700' }), root);
      this.bossHpText.anchor.set(1, 0.5);
      this.bossHpText.x = 908; this.bossHpText.y = 92;

      // ---- 조이스틱 ----
      this.joyG = new PIXI.Graphics();
      root.addChild(this.joyG);
      this._drawJoystick();

      // ---- 우하단 버튼들 ----
      this.btnG = new PIXI.Graphics();
      root.addChild(this.btnG);
      this.btnLabels = new PIXI.Container();
      root.addChild(this.btnLabels);
      this.cdTexts = {};
      ['skill1', 'skill2', 'dodge'].forEach((k) => {
        this.cdTexts[k] = this._text('cd_' + k, '', G.style({ fontSize: 15, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x001018, width: 4 } }), root);
        this.cdTexts[k].anchor.set(0.5);
        this.cdTexts[k].visible = false;
      });
      this.autoText = this._text('auto', 'AUTO', G.style({ fontSize: 22, fill: 0xeaf6ff, fontWeight: '900' }), root);
      this.autoText.anchor.set(0.5);
      this.autoModeText = this._text('automode', '반격만 수동', G.style({ fontSize: 13, fill: 0xa9c9e8, fontWeight: '800' }), root);
      this.autoModeText.anchor.set(0.5);

      // ---- 콤보 카운터 / 프롬프트 ----
      this.comboText = this._text('combo', '', G.style({ fontSize: 34, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x1a2a5a, width: 6 } }), root);
      this.comboText.anchor.set(0, 0.5);
      this.comboText.x = 40; this.comboText.y = 470;
      this.comboSub = this._text('combosub', 'HIT', G.style({ fontSize: 16, fill: 0x9fd6ff, fontWeight: '900' }), root);
      this.comboSub.anchor.set(0, 0.5);
      this.comboSub.x = 40; this.comboSub.y = 500;
      this.comboText.alpha = 0;
      this.comboSub.alpha = 0;

      this.promptText = this._text('prompt', '', G.style({ fontSize: 42, fill: 0xffffff, fontWeight: '900', stroke: { color: 0x0a1428, width: 8 } }), root);
      this.promptText.anchor.set(0.5);
      this.promptText.x = 640; this.promptText.y = 210;
      this.promptText.alpha = 0;

      this.phaseText = this._text('phase', '', G.style({ fontSize: 26, fill: 0xffe9a8, fontWeight: '900', stroke: { color: 0x2a1a08, width: 6 }, letterSpacing: 4 }), root);
      this.phaseText.anchor.set(0.5);
      this.phaseText.x = 640; this.phaseText.y = 150;
      this.phaseText.alpha = 0;

      this._drawButtons();
    }

    _drawMute() {
      const g = this.muteG;
      const x = this.buttons.mute.x, y = this.buttons.mute.y;
      g.clear();
      g.poly([x - 9, y - 4, x - 4, y - 4, x + 1, y - 9, x + 1, y + 9, x - 4, y + 4, x - 9, y + 4]).fill({ color: 0xffffff, alpha: 0.85 });
      if (this.game && this.game.muted) {
        g.moveTo(x + 5, y - 6).lineTo(x + 13, y + 6).stroke({ width: 2, color: 0xff7a8a, alpha: 0.95 });
        g.moveTo(x + 13, y - 6).lineTo(x + 5, y + 6).stroke({ width: 2, color: 0xff7a8a, alpha: 0.95 });
      } else {
        g.arc(x + 2, y, 7, -0.9, 0.9).stroke({ width: 2, color: 0xffffff, alpha: 0.75 });
        g.arc(x + 2, y, 11, -0.8, 0.8).stroke({ width: 2, color: 0xffffff, alpha: 0.45 });
      }
    }

    _drawJoystick() {
      const g = this.joyG;
      g.clear();
      const j = this.joy;
      g.circle(j.bx, j.by, j.r).fill({ color: 0x0b1a2e, alpha: 0.28 });
      g.circle(j.bx, j.by, j.r).stroke({ width: 1.6, color: 0x9fd0ff, alpha: 0.3 });
      g.circle(j.bx, j.by, j.r * 0.62).stroke({ width: 1, color: 0x9fd0ff, alpha: 0.16 });
      // 방향 눈금
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * G.TAU;
        const x1 = j.bx + Math.cos(a) * (j.r - 6), y1 = j.by + Math.sin(a) * (j.r - 6);
        const x2 = j.bx + Math.cos(a) * (j.r - 14), y2 = j.by + Math.sin(a) * (j.r - 14);
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 2, color: 0x9fd0ff, alpha: 0.3 });
      }
      g.circle(j.kx, j.ky, j.r * 0.42).fill({ color: 0xbfe2ff, alpha: j.active ? 0.4 : 0.24 });
      g.circle(j.kx, j.ky, j.r * 0.42).stroke({ width: 1.6, color: 0xe6f4ff, alpha: j.active ? 0.8 : 0.45 });
    }

    _drawButtons() {
      const g = this.btnG;
      g.clear();
      const b = this.buttons;

      const ring = (btn, color, inner) => {
        const press = btn.press > 0 ? 1 - btn.press / 0.16 : 0;
        const r = btn.r * (1 - press * 0.07);
        g.circle(btn.x, btn.y, r + 4).fill({ color, alpha: 0.12 });
        g.circle(btn.x, btn.y, r).fill({ color: 0x061424, alpha: 0.55 });
        g.circle(btn.x, btn.y, r).stroke({ width: 2.4, color, alpha: 0.85 });
        g.circle(btn.x, btn.y, r * 0.82).stroke({ width: 1, color, alpha: 0.28 });
        g.circle(btn.x, btn.y - r * 0.35, r * 0.6).fill({ color, alpha: 0.07 });
        this['_icon_' + btn.name] && this['_icon_' + btn.name](btn, r, color);
      };
      b.attack.name = 'attack';
      b.skill1.name = 'skill1';
      b.skill2.name = 'skill2';
      b.dodge.name = 'dodge';

      ring(b.attack, 0xbfe0ff);
      ring(b.skill1, 0x5fb6ff);
      ring(b.skill2, 0xb98bff);
      ring(b.dodge, 0xffffff);

      // 공격 아이콘(검)
      this._icon_attack = (btn, r) => {
        const x = btn.x, y = btn.y;
        const s = r / 58;
        g.poly([
          x - 16 * s, y + 20 * s,
          x + 12 * s, y - 8 * s,
          x + 22 * s, y - 18 * s,
          x + 24 * s, y - 24 * s,
          x + 18 * s, y - 22 * s,
          x + 8 * s, y - 12 * s,
          x - 20 * s, y + 16 * s,
        ]).fill({ color: 0xffffff, alpha: 0.95 });
        g.moveTo(x - 22 * s, y + 8 * s).lineTo(x - 8 * s, y + 22 * s).stroke({ width: 4 * s, color: 0xffffff, alpha: 0.95 });
        g.circle(x - 20 * s, y + 22 * s, 3.2 * s).fill({ color: 0xffffff, alpha: 0.9 });
      };
      this._icon_attack(b.attack, b.attack.r);

      // 스킬1 아이콘(3연 검기)
      this._icon_skill1 = (btn, r) => {
        const x = btn.x, y = btn.y, s = r / 40;
        for (let i = 0; i < 3; i++) {
          const off = (i - 1) * 9 * s;
          g.moveTo(x - 14 * s, y + 10 * s + off).lineTo(x + 14 * s, y - 6 * s + off).stroke({ width: 3.4 * s, color: 0xdff0ff, alpha: 0.95 });
        }
        g.moveTo(x + 10 * s, y - 14 * s).lineTo(x + 16 * s, y - 8 * s).stroke({ width: 2 * s, color: 0x9fd0ff, alpha: 0.7 });
      };
      this._icon_skill1(b.skill1, b.skill1.r);

      // 스킬2 아이콘(마법 별)
      this._icon_skill2 = (btn, r) => {
        const x = btn.x, y = btn.y, s = r / 40;
        const pts = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * G.TAU - Math.PI / 2;
          const rad = i % 2 === 0 ? 15 * s : 6 * s;
          pts.push(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        }
        g.poly(pts).fill({ color: 0xe6d6ff, alpha: 0.95 });
        g.circle(x, y, 3 * s).fill({ color: 0xffffff, alpha: 0.9 });
      };
      this._icon_skill2(b.skill2, b.skill2.r);

      // 회피 아이콘(곡선 화살표)
      this._icon_dodge = (btn, r) => {
        const x = btn.x, y = btn.y, s = r / 36;
        const a0 = Math.PI * 0.25, a1 = Math.PI * 1.55;
        g.beginPath();
        g.moveTo(x + Math.cos(a0) * 11 * s, y + 2 * s + Math.sin(a0) * 11 * s);
        g.arc(x, y + 2 * s, 11 * s, a0, a1);
        g.stroke({ width: 3.2 * s, color: 0xffffff, alpha: 0.9 });
        g.poly([
          x + 9 * s, y - 12 * s,
          x + 16 * s, y - 6 * s,
          x + 6 * s, y - 3 * s,
        ]).fill({ color: 0xffffff, alpha: 0.9 });
      };
      this._icon_dodge(b.dodge, b.dodge.r);

      // AUTO 토글
      const a = b.auto;
      const on = this.game && this.game.autoMode !== 'manual';
      g.roundRect(a.x - a.w / 2, a.y - a.h / 2, a.w, a.h, 16).fill({ color: on ? 0x123a5c : 0x0a1626, alpha: on ? 0.82 : 0.6 });
      g.roundRect(a.x - a.w / 2, a.y - a.h / 2, a.w, a.h, 16).stroke({ width: 2, color: on ? 0x7fd8ff : 0x6a8aa8, alpha: 0.9 });
      // 작은 검 아이콘
      const ix = a.x - a.w / 2 + 22, iy = a.y - 8;
      g.moveTo(ix - 8, iy + 8).lineTo(ix + 8, iy - 8).stroke({ width: 3, color: 0xdff0ff, alpha: 0.9 });
      g.moveTo(ix - 10, iy + 3).lineTo(ix - 2, iy + 11).stroke({ width: 2, color: 0xdff0ff, alpha: 0.7 });
      this.autoText.x = a.x + 16;
      this.autoText.y = a.y - 6;
      this.autoModeText.x = a.x + 16;
      this.autoModeText.y = a.y + 17;

      // 일시정지/음소거 원
      g.circle(b.pause.x, b.pause.y, b.pause.r).fill({ color: 0x08131f, alpha: 0.55 });
      g.circle(b.pause.x, b.pause.y, b.pause.r).stroke({ width: 1.6, color: 0xa8ccef, alpha: 0.55 });
      g.circle(b.mute.x, b.mute.y, b.mute.r).fill({ color: 0x08131f, alpha: 0.55 });
      g.circle(b.mute.x, b.mute.y, b.mute.r).stroke({ width: 1.6, color: 0xa8ccef, alpha: 0.55 });

      // 타이머 pill
      panel(g, 1056, 8, 132, 44, 22, 0.5);
      // 시계 아이콘
      g.circle(1074, 30, 9).stroke({ width: 1.8, color: 0xbfe0ff, alpha: 0.9 });
      g.moveTo(1074, 25).lineTo(1074, 30).lineTo(1078, 32).stroke({ width: 1.6, color: 0xbfe0ff, alpha: 0.9 });
      // 지역명 패널
      panel(g, 920, 8, 128, 44, 22, 0.42);
    }

    /* ---------- 입력 ---------- */
    pointerDown(x, y, id) {
      const b = this.buttons;
      const hit = (btn, pad = 0) => G.dist(x, y, btn.x, btn.y) <= btn.r + pad;
      if (hit(b.pause, 6)) { this.input.pause = true; b.pause.press = 0.16; return; }
      if (hit(b.mute, 6)) { this.input.mute = true; b.mute.press = 0.16; return; }
      const ax = b.auto;
      if (Math.abs(x - ax.x) < ax.w / 2 + 4 && Math.abs(y - ax.y) < ax.h / 2 + 4) {
        this.input.auto = true; ax.press = 0.16; return;
      }
      if (hit(b.attack, 10)) { this.input.attack = true; b.attack.press = 0.16; return; }
      if (hit(b.skill1, 8)) { this.input.skill1 = true; b.skill1.press = 0.16; return; }
      if (hit(b.skill2, 8)) { this.input.skill2 = true; b.skill2.press = 0.16; return; }
      if (hit(b.dodge, 8)) { this.input.dodge = true; b.dodge.press = 0.16; return; }
      // 조이스틱 (좌측 영역)
      if (x < G.W * 0.52 && y > G.H * 0.35) {
        const j = this.joy;
        j.active = true; j.id = id;
        j.bx = G.clamp(x, 90, 300);
        j.by = G.clamp(y, 420, 660);
        j.kx = j.bx; j.ky = j.by;
        this._drawJoystick();
      }
    }

    pointerMove(x, y, id) {
      const j = this.joy;
      if (!j.active || j.id !== id) return;
      const dx = x - j.bx, dy = y - j.by;
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
        auto: i.auto, pause: i.pause, mute: i.mute,
        moveX: this.joy.vx, moveY: this.joy.vy,
      };
      i.attack = i.skill1 = i.skill2 = i.dodge = i.auto = i.pause = i.mute = false;
      return out;
    }

    /* ---------- 갱신 ---------- */
    update(dt, game) {
      const b = this.buttons;
      ['attack', 'skill1', 'skill2', 'dodge', 'auto', 'pause', 'mute'].forEach((k) => {
        if (b[k].press > 0) b[k].press = Math.max(0, b[k].press - dt);
      });

      // HP/MP 바
      const kael = game.kael;
      const g = this.bars;
      g.clear();
      const bx = 106, by = 46, bw = 176, bh = 16;
      g.roundRect(bx, by, bw, bh, 5).fill({ color: C.hpDark, alpha: 0.95 });
      const hpP = G.clamp(kael.hp / kael.hpMax, 0, 1);
      g.roundRect(bx + 1, by + 1, (bw - 2) * hpP, bh - 2, 4).fill({ color: C.hp, alpha: 0.95 });
      g.roundRect(bx + 1, by + 1, (bw - 2) * hpP, (bh - 2) * 0.45, 3).fill({ color: 0xc8ffd8, alpha: 0.35 });
      g.roundRect(bx, by, bw, bh, 5).stroke({ width: 1.2, color: 0x9fe8b8, alpha: 0.5 });
      // 세그먼트
      for (let i = 1; i < 6; i++) {
        g.rect(bx + (bw / 6) * i, by + 1, 1, bh - 2).fill({ color: 0x03140b, alpha: 0.45 });
      }

      const my = 70, mh = 10;
      g.roundRect(bx, my, bw, mh, 4).fill({ color: C.mpDark, alpha: 0.95 });
      const mpP = G.clamp(kael.mp / kael.mpMax, 0, 1);
      g.roundRect(bx + 1, my + 1, (bw - 2) * mpP, mh - 2, 3).fill({ color: C.mp, alpha: 0.95 });
      g.roundRect(bx, my, bw, mh, 4).stroke({ width: 1, color: 0x9fd0ff, alpha: 0.45 });

      // 숫자
      if (this.hpNum.text !== `${Math.ceil(kael.hp)}/${kael.hpMax}`) this.hpNum.text = `${Math.ceil(kael.hp)}/${kael.hpMax}`;
      this.hpNum.x = 330 - this.hpNum.width; this.hpNum.y = by + 1;
      if (this.mpNum.text !== `${Math.floor(kael.mp)}/${kael.mpMax}`) this.mpNum.text = `${Math.floor(kael.mp)}/${kael.mpMax}`;
      this.mpNum.x = 330 - this.mpNum.width; this.mpNum.y = my - 0.5;

      // 타이머
      const tStr = G.fmtTime(game.timeLeft);
      if (this.timerText.text !== tStr) this.timerText.text = tStr;
      this.timerText.style.fill = game.phase === 'boss' ? 0xffd0d6 : 0xffffff;

      // 지역명
      const area = game.phase === 'boss' ? '폐허의 왕좌' : '폐허의 거리';
      if (this.areaText.text !== area) this.areaText.text = area;

      // 보스 HP
      this.bossG.clear();
      if (game.boss && game.boss.alive) {
        panel(this.bossG, 356, 70, 560, 24, 8, 0.55);
        const p = G.clamp(game.boss.hp / game.boss.hpMax, 0, 1);
        this.bossG.roundRect(359, 73, 554, 18, 6).fill({ color: 0x2a0a10, alpha: 0.9 });
        this.bossG.roundRect(360, 74, 552 * p, 16, 5).fill({ color: 0xd8233a, alpha: 0.95 });
        this.bossG.roundRect(360, 74, 552 * p, 7, 4).fill({ color: 0xff9aa6, alpha: 0.35 });
        for (let i = 1; i < 10; i++) {
          this.bossG.rect(360 + (552 / 10) * i, 74, 1, 16).fill({ color: 0x1a0408, alpha: 0.5 });
        }
        this.bossG.roundRect(356, 70, 560, 24, 8).stroke({ width: 1.6, color: 0xff8a99, alpha: 0.5 });
        this.bossName.text = game.boss.name;
        this.bossName.alpha = 1;
        this.bossHpText.text = `${G.num(game.boss.hp)} / ${G.num(game.boss.hpMax)}`;
        this.bossHpText.alpha = 1;
        this.bossHpText.y = 90;
      } else {
        this.bossName.alpha = 0;
        this.bossHpText.alpha = 0;
      }

      // 콤보
      const combo = game.combo;
      if (combo >= 2) {
        this.comboText.text = String(combo);
        this.comboText.alpha = Math.min(1, this.comboT || 1);
        this.comboSub.alpha = this.comboText.alpha;
        this.comboSub.x = 46 + this.comboText.width;
        this.comboText.style.fontSize = 30 + Math.min(18, combo);
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
        this.promptText.scale.set(1 + 0.12 * Math.sin(p * Math.PI * 3));
      } else {
        this.promptText.alpha = 0;
      }

      // 페이즈 배너
      if (game.phaseBanner > 0) {
        game.phaseBanner -= dt;
        this.phaseText.text = game.phaseMsg;
        this.phaseText.alpha = Math.min(1, game.phaseBanner);
      } else this.phaseText.alpha = 0;

      // 쿨다운
      const cd = game.cooldowns;
      const setCd = (key, btn, cur, max) => {
        const t = this.cdTexts[key];
        if (cur > 0) {
          t.visible = true;
          t.text = cur >= 1 ? String(Math.ceil(cur)) : cur.toFixed(1);
          t.x = btn.x; t.y = btn.y;
          const p = G.clamp(cur / max, 0, 1);
          this.btnG.circle(btn.x, btn.y, btn.r * 0.98).fill({ color: 0x02060c, alpha: 0.55 * p });
        } else t.visible = false;
      };
      setCd('skill1', b.skill1, cd.skill1, game.skillMax.skill1);
      setCd('skill2', b.skill2, cd.skill2, game.skillMax.skill2);
      setCd('dodge', b.dodge, kael.dodgeCD, 2.4);

      // 퍼펙트 회피 창: 회피 버튼 발광
      if (game.perfectWindow) {
        const t = performance.now() / 1000;
        const pulse = 0.5 + 0.5 * Math.sin(t * 18);
        const b = this.buttons.dodge;
        this.btnG.circle(b.x, b.y, b.r + 10 + pulse * 8).stroke({ width: 3, color: 0xffffff, alpha: 0.35 + 0.45 * pulse });
        this.btnG.circle(b.x, b.y, b.r + 2).fill({ color: 0xffffff, alpha: 0.08 + 0.12 * pulse });
      }

      // AUTO 상태
      this._drawAuto(game);
      this._drawButtons();
      this._drawMute();

      // 미니맵 점
      const m = this.minimapDots;
      m.clear();
      const mx = 1086, my2 = 58, mw = 178, mh2 = 104;
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
      // 리아는 소환 중일 때만 미니맵에 표시
      if (game.lia && game.lia.active && game.lia.obj) dots.push([game.lia.obj, 0xcf9bff]);
      dots.forEach(([h, col]) => {
        const [px, py] = toMap(h.x, h.y);
        m.circle(px, py, 3.6).fill({ color: col, alpha: 1 });
        m.circle(px, py, 6.5).stroke({ width: 1.2, color: col, alpha: 0.5 });
      });
      // 시야 콘
      const [kx, ky] = toMap(game.kael.x, game.kael.y);
      m.moveTo(kx, ky).lineTo(kx + 22, ky - 10).lineTo(kx + 22, ky + 10).closePath().fill({ color: 0x9fe0ff, alpha: 0.18 });
    }

    _drawAuto(game) {
      const b = this.buttons.auto;
      const label = { full: '완전 오토', counter: '반격만 수동', manual: '완전 수동' }[game.autoMode];
      if (this.autoModeText.text !== label) this.autoModeText.text = label;
      const color = { full: 0x7fe9b0, counter: 0x7fd8ff, manual: 0xffb0a0 }[game.autoMode];
      this.autoText.style.fill = color;
      this.autoModeText.style.fill = color;
    }
  }

  G.Hud = Hud;
})();
