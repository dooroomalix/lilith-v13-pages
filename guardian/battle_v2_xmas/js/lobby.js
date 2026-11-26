/* lobby.js : 크리스마스 외전 로비 (Step 6)
 * - 성문 광장 대기실: 5인 캐릭터 카드 + 스킨(기본/산타/연회) + 파츠 리그 실시간 미리보기
 * - 고른 캐릭터·스킨이 그대로 전투 메인으로 출전한다
 */
(function () {
  /* 화면 배치 (Step 9-1) — 가로 1280×720 은 종전 그대로,
     세로는 화면 픽셀 기준으로 다시 짠다. W/H 는 지금 배치의 화면 크기다. */
  let W = 1280, H = 720;
  let LY = null;

  function layoutLandscape() {
    W = 1280; H = 720;
    return {
      mode: 'landscape', w: W, h: H,
      headH: 104, t1: { x: 48, y: 30, size: 30 }, t2: { x: 50, y: 68, size: 15 },
      stageC: { x: W * 0.34, y: H - 196, rx: 190, ry: 42 },
      rig: { x: W * 0.34, foot: H - 188, body: 330 },
      info: { x: 760, y: 150, w: 470, h: 300 },
      name: { x: 792, y: 172, size: 34 }, role: { x: 794, y: 216, size: 15 },
      stat: { x: 794, y: 248, size: 14, lh: 24 }, line: { x: 794, y: 366, size: 15, lh: 22, wrap: 410 },
      skinLabel: { x: 792, y: 462, size: 14 },
      skins: { x: 760, y: 486, w: 146, h: 48, gap: 12, size: 14 },
      cards: { x: 40, y: H - 172, w: 142, h: 150, gap: 8, name: 15 },
      deploy: { x: 800, y: H - 134, w: 420, h: 84 }, deployText: { x: 1010, y: H - 92, size: 26 },
      hint: { x: 46, y: H - 20, size: 12 },
    };
  }

  /* 세로 — 제목 → 정보 → 리그 무대 → 카드 5장 → 스킨 3칸 → 출격 */
  function layoutPortrait(w, h) {
    W = w; H = h;
    const m = 8, W1 = w - m * 2;
    const cardGap = 6;
    const cardW = Math.floor((W1 - 4 * cardGap) / 5);
    const cardH = 112;
    const cardY = h - 330;
    return {
      mode: 'portrait', w, h,
      headH: 76, t1: { x: 14, y: 12, size: 21 }, t2: { x: 15, y: 44, size: 11.5 },
      stageC: { x: w / 2, y: cardY - 8, rx: 150, ry: 24 },
      rig: { x: w / 2, foot: cardY - 12, body: 200 },
      info: { x: m, y: 82, w: W1, h: 152 },
      name: { x: m + 16, y: 94, size: 24 }, role: { x: m + 17, y: 126, size: 12 },
      stat: { x: m + 17, y: 146, size: 11, lh: 15 }, line: { x: m + 17, y: 194, size: 12, lh: 16, wrap: W1 - 34 },
      skinLabel: { x: m + 4, y: h - 210, size: 12 },
      skins: { x: m, y: h - 192, w: (W1 - 12) / 3, h: 40, gap: 6, size: 12 },
      cards: { x: m, y: cardY, w: cardW, h: cardH, gap: cardGap, name: 11 },
      deploy: { x: m, y: h - 104, w: W1, h: 66 }, deployText: { x: w / 2, y: h - 71, size: 22 },
      hint: { x: m + 4, y: h - 16, size: 9.5 },
      hintText: '← → 이동 · J 공격 · K 스킬 · L 궁극기 · Shift 회피 · Q 물약',
    };
  }

  LY = layoutLandscape();

  function plate(g, x, y, w, h, cut, fill, alpha) {
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

  class Lobby {
    constructor(game) {
      this.game = game;
      this.root = new PIXI.Container();
      this.root.visible = false;
      this.root.zIndex = 110;
      this.charKey = 'kael';
      this.skin = 'basic';
      this.hover = -1;
      this.t = 0;
      this.lineT = 0;
      this.rig = null;
      this.rigKey = null;
      this.cards = [];
      this.skinBtns = [];
      this.loaded = {};
      this.deployLock = false;
      this.log = [];
      // 부팅 시점의 화면 방향으로 바로 짓는다 (세로면 처음부터 세로 배치)
      LY = (G.VIEW && G.VIEW.mode === 'portrait')
        ? layoutPortrait(G.VIEW.w, G.VIEW.h) : layoutLandscape();
      this.mode = LY.mode;
      this.bw = LY.w;
      this.bh = LY.h;
      this._build();
      this.built = true;
    }

    /* ================================================================ 화면 배치 (Step 9-1) */
    applyLayout(mode, w, h) {
      const same = this.built && this.mode === mode && this.bw === w && this.bh === h;
      this.mode = mode;
      this.bw = w;
      this.bh = h;
      LY = (mode === 'portrait') ? layoutPortrait(w, h) : layoutLandscape();
      if (same) return false;
      const keep = { charKey: this.charKey, skin: this.skin };
      const vis = this.root.visible;
      const kids = this.root.removeChildren();
      kids.forEach((c) => { try { c.destroy({ children: true }); } catch (e) { /* 이미 없어진 것 */ } });
      this.cards = [];
      this.skinBtns = [];
      this.flakes = [];
      this.rig = null;
      this.rigKey = null;
      Object.assign(this, keep);
      this._build();
      this.built = true;
      this.root.visible = vis;
      return true;
    }

    /* 검증용: 지금 배치된 로비 요소의 화면 좌표 */
    layoutInfo() {
      const r = (o) => ({ x: +o.x.toFixed(1), y: +o.y.toFixed(1), w: +o.w.toFixed(1), h: +o.h.toFixed(1) });
      return {
        mode: LY.mode, vw: LY.w, vh: LY.h,
        title: { x: LY.t1.x, y: LY.t1.y, size: LY.t1.size },
        info: r(LY.info),
        skins: this.skinBtns.map((b) => Object.assign(r(b), { skin: b.skin })),
        cards: this.cards.map((c) => Object.assign(r(c), { key: c.key })),
        deploy: r(this.depBtn),
        hint: { x: LY.hint.x, y: LY.hint.y },
        rig: { x: LY.rig.x, foot: LY.rig.foot, body: LY.rig.body },
      };
    }

    /* ---------------- 화면 ---------------- */
    _build() {
      const c = this.root;
      // 배경: 눈 내리는 성문 광장
      const bg = new PIXI.Sprite(G.Assets.tex.bgXmas || G.Assets.tex.bg);
      bg.anchor.set(0.5);
      const sc = Math.max(W / bg.width, H / bg.height) * 1.06;
      bg.scale.set(sc);
      bg.x = W / 2; bg.y = H / 2;
      c.addChild(bg);
      const shade = new PIXI.Graphics();
      shade.rect(0, 0, W, H).fill({ color: 0x04080f, alpha: 0.46 });
      shade.rect(0, H - 210, W, 210).fill({ color: 0x03060c, alpha: 0.72 });
      c.addChild(shade);

      // 눈
      this.snow = new PIXI.Graphics();
      c.addChild(this.snow);
      this.flakes = [];
      for (let i = 0; i < 90; i++) {
        this.flakes.push({ x: Math.random() * W, y: Math.random() * H, r: G.rand(2.4, 0.8), s: G.rand(34, 12), d: G.rand(1, -1) });
      }

      // 상단 타이틀
      const head = new PIXI.Graphics();
      head.rect(0, 0, W, LY.headH).fill({ color: 0x030812, alpha: 0.55 });
      head.rect(0, LY.headH, W, 26).fill({ color: 0x030812, alpha: 0.22 });
      c.addChild(head);

      const t1 = new PIXI.Text({
        text: '메리 크리스마스! 성문을 지켜라',
        style: { fontFamily: G.FONT, fontSize: LY.t1.size, fontWeight: '900', fill: 0xf6fbff, letterSpacing: 3,
          stroke: { color: 0x0a1c38, width: 6 }, dropShadow: { color: 0x5fa8ff, blur: 10, distance: 0, alpha: 0.45 } },
      });
      t1.x = LY.t1.x; t1.y = LY.t1.y;
      c.addChild(t1);
      const t2 = new PIXI.Text({
        text: '축제 대기실  ·  출전할 수호자를 고르세요',
        style: { fontFamily: G.FONT, fontSize: LY.t2.size, fill: 0xa8c8e8, letterSpacing: 1 },
      });
      t2.x = LY.t2.x; t2.y = LY.t2.y;
      c.addChild(t2);

      // 왼쪽: 리그 미리보기 무대
      this.stageG = new PIXI.Graphics();
      this.stageG.ellipse(LY.stageC.x, LY.stageC.y, LY.stageC.rx, LY.stageC.ry).fill({ color: 0x2a4a78, alpha: 0.30 });
      this.stageG.ellipse(LY.stageC.x, LY.stageC.y, LY.stageC.rx * 0.68, LY.stageC.ry * 0.66).fill({ color: 0x8fd6ff, alpha: 0.16 });
      c.addChild(this.stageG);
      this.rigLayer = new PIXI.Container();
      c.addChild(this.rigLayer);

      // 오른쪽: 정보 패널
      this.info = new PIXI.Container();
      c.addChild(this.info);
      const ig = new PIXI.Graphics();
      plate(ig, LY.info.x, LY.info.y, LY.info.w, LY.info.h, 18, 0x0a1626, 0.82);
      plateEdge(ig, LY.info.x, LY.info.y, LY.info.w, LY.info.h, 18, 0x6fa8e0, 0.45, 1.6);
      this.info.addChild(ig);
      this.nameT = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: LY.name.size, fontWeight: '900', fill: 0xf6fbff, letterSpacing: 2 } });
      this.nameT.x = LY.name.x; this.nameT.y = LY.name.y;
      this.info.addChild(this.nameT);
      this.roleT = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: LY.role.size, fill: 0x9fd6ff, letterSpacing: 1 } });
      this.roleT.x = LY.role.x; this.roleT.y = LY.role.y;
      this.info.addChild(this.roleT);
      this.statT = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: LY.stat.size, fill: 0xc8dcf0, lineHeight: LY.stat.lh } });
      this.statT.x = LY.stat.x; this.statT.y = LY.stat.y;
      this.info.addChild(this.statT);
      this.lineT2 = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: LY.line.size, fill: 0xffe6b8, lineHeight: LY.line.lh, wordWrap: true, wordWrapWidth: LY.line.wrap } });
      this.lineT2.x = LY.line.x; this.lineT2.y = LY.line.y;
      this.info.addChild(this.lineT2);

      // 스킨 선택
      const sk = new PIXI.Text({ text: '스킨', style: { fontFamily: G.FONT, fontSize: LY.skinLabel.size, fontWeight: '900', fill: 0x9fd6ff, letterSpacing: 2 } });
      sk.x = LY.skinLabel.x; sk.y = LY.skinLabel.y;
      c.addChild(sk);
      for (let i = 0; i < 3; i++) {
        const g = new PIXI.Graphics();
        const bx = LY.skins.x + i * (LY.skins.w + LY.skins.gap);
        const by = LY.skins.y, bw = LY.skins.w, bh = LY.skins.h;
        const t = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: LY.skins.size, fontWeight: '800', fill: 0xdfeaf7, align: 'center' } });
        t.anchor.set(0.5); t.x = bx + bw / 2; t.y = by + bh / 2;
        c.addChild(g, t);
        this.skinBtns.push({ g, t, x: bx, y: by, w: bw, h: bh, skin: G.CHARS.skins[i] });
      }

      // 캐릭터 카드 5장 (하단)
      for (let i = 0; i < 5; i++) {
        const key = G.CHARS.order[i];
        const cd = new PIXI.Container();
        const bw = LY.cards.w, bh = LY.cards.h;
        const bx = LY.cards.x + i * (bw + LY.cards.gap), by = LY.cards.y;
        const g = new PIXI.Graphics();
        const frame = new PIXI.Container();
        const img = new PIXI.Sprite(PIXI.Texture.WHITE);
        img.width = bw - 12; img.height = bh - 40;
        img.x = 6; img.y = 6;
        frame.addChild(img);
        const nm = new PIXI.Text({ text: G.CHARS[key].name, style: { fontFamily: G.FONT, fontSize: LY.cards.name, fontWeight: '900', fill: 0xf6fbff } });
        nm.anchor.set(0.5); nm.x = bw / 2; nm.y = bh - 16;
        cd.addChild(g, frame, nm);
        cd.x = bx; cd.y = by;
        c.addChild(cd);
        this.cards.push({ cd, g, img, nm, x: bx, y: by, w: bw, h: bh, key });
      }

      // 출격 버튼
      this.depG = new PIXI.Graphics();
      this.depT = new PIXI.Text({ text: '전투 출격', style: { fontFamily: G.FONT, fontSize: LY.deployText.size, fontWeight: '900', fill: 0xfff3d0, letterSpacing: 4 } });
      this.depT.anchor.set(0.5);
      this.depT.x = LY.deployText.x; this.depT.y = LY.deployText.y;
      c.addChild(this.depG, this.depT);
      this.depBtn = { x: LY.deploy.x, y: LY.deploy.y, w: LY.deploy.w, h: LY.deploy.h };

      // 하단 안내
      const hint = new PIXI.Text({
        text: LY.hintText || '← → 이동 · W S 깊이 · Space 점프 · J 공격 · K 스킬 · L 궁극기 · Shift 회피 · Q 물약 · P 일시정지 · T 오토',
        style: { fontFamily: G.FONT, fontSize: LY.hint.size, fill: 0x7f9dbb, letterSpacing: 0.5 },
      });
      hint.x = LY.hint.x; hint.y = LY.hint.y;
      c.addChild(hint);

      this._refreshCards();
      this._applySelection();
    }

    _portraitTex(key, skin) {
      const path = G.CHARS.portrait(key, skin);
      if (!this._pTex) this._pTex = {};
      if (this._pTex[path]) return this._pTex[path];
      return null;
    }

    async _loadPortrait(key, skin) {
      const path = G.CHARS.portrait(key, skin);
      if (!this._pTex) this._pTex = {};
      if (this._pTex[path]) return this._pTex[path];
      try {
        const img = await G.Assets._img(path);
        const t = PIXI.Texture.from(img);
        t.source.scaleMode = 'linear';
        this._pTex[path] = t;
        return t;
      } catch (e) { return null; }
    }

    async _refreshCards() {
      for (const card of this.cards) {
        const tex = await this._loadPortrait(card.key, 'basic');
        if (tex) { card.img.texture = tex; }
        card.img.anchor.set(0.5);
        card.img.width = card.w - 12; card.img.height = card.h - 40;
        card.img.x = card.w / 2; card.img.y = 6 + (card.h - 40) / 2;
      }
    }

    /* 선택 상태 반영 */
    _applySelection() {
      const C = G.CHARS.get(this.charKey);
      const skinLabel = G.CHARS.skinName(this.charKey, this.skin);
      for (const card of this.cards) {
        const on = card.key === this.charKey;
        const g = card.g;
        g.clear();
        plate(g, 0, 0, card.w, card.h, 12, on ? 0x1b3b60 : 0x0a1522, on ? 0.92 : 0.66);
        plateEdge(g, 0, 0, card.w, card.h, 12, on ? 0xffd166 : 0x5f86ad, on ? 0.95 : 0.4, on ? 2.4 : 1.2);
        if (on) g.rect(10, card.h - 30, card.w - 20, 3).fill({ color: 0xffd166, alpha: 0.8 });
        card.nm.style.fill = on ? 0xffe9b0 : 0xcfe0f2;
      }
      for (const b of this.skinBtns) {
        const on = b.skin === this.skin;
        b.g.clear();
        plate(b.g, b.x, b.y, b.w, b.h, 10, on ? 0x2a1a24 : 0x0a1522, on ? 0.95 : 0.6);
        plateEdge(b.g, b.x, b.y, b.w, b.h, 10, on ? 0xe2a24a : 0x5f86ad, on ? 0.95 : 0.35, on ? 2.2 : 1.1);
        b.t.text = G.CHARS.skinName(this.charKey, b.skin);
        b.t.style.fill = on ? 0xffe9b0 : 0x9fb8d0;
      }
      this.nameT.text = C.name;
      this.roleT.text = C.role + '  ·  ' + skinLabel;
      this.statT.text = `체력 ${C.hpMax}   공격 ${C.atk}\n스킬 K · ${C.skill.name}\n궁극기 L · ${C.ult.name}`;
      this.lineT2.text = '“' + G.choice(C.lines) + '”';
      // 출격 버튼
      const d = this.depBtn;
      this.depG.clear();
      plate(this.depG, d.x, d.y, d.w, d.h, 16, 0x1d3f5e, 0.92);
      plate(this.depG, d.x + 3, d.y + 3, d.w - 6, d.h - 6, 14, 0x2a5a86, 0.35);
      plateEdge(this.depG, d.x, d.y, d.w, d.h, 16, 0xffd166, 0.85, 2);
      this.depT.text = this.deployLock ? '준비 중…' : (C.name + ' 출격');
      this._showRig();
      // 고른 캐릭터 카드 초상은 고른 스킨으로 바뀐다 (전체 스킨 교체)
      const card = this.cards.find((c2) => c2.key === this.charKey);
      if (card) {
        this._loadPortrait(this.charKey, this.skin).then((tex) => {
          if (tex && this.charKey === card.key) card.img.texture = tex;
        });
      }
    }

    /* 리그 미리보기 — 고른 캐릭터/스킨 파츠로 */
    async _showRig() {
      const rigKey = G.CHARS.rigKey(this.charKey, this.skin);
      if (this.rigKey === rigKey && this.rig) return;
      const def = await G.Rigs.load(rigKey);
      if (!def) return;
      if (this.rig) { this.rigLayer.removeChild(this.rig.root); this.rig = null; }
      const C = G.CHARS.get(this.charKey);
      const rig = new G.Rig(def, { artFacing: C.artFacing, mainArm: C.mainArm });
      rig.setBodyPx(LY.rig.body);
      rig.root.x = LY.rig.x;
      rig.root.y = LY.rig.foot;
      rig.setState('idle', 0.5, {});
      rig.setState('victory', 0.5, {});
      rig.update(0.016);
      this.rigLayer.addChild(rig.root);
      this.rig = rig;
      this.rigKey = rigKey;
      this.log.push({ t: +this.t.toFixed(2), rig: rigKey });
      if (this.log.length > 20) this.log.shift();
    }

    /* ---------------- 조작 ---------------- */
    open() {
      this.root.visible = true;
      this.deployLock = false;
      G.Sfx.resume();
      this._applySelection();
      // 필요한 리그만 받는다 (모바일 텍스처 메모리 절약)
      //  - 지금 고른 캐릭터의 스킨 3종
      //  - 전투에 바로 쓸 적 3종 + 보스
      // 5인 기본복 + 지금 캐릭터의 나머지 스킨 + 적 3종/보스
      G.CHARS.order.forEach((k) => { G.Rigs.load(G.CHARS.rigKey(k, 'basic')).catch(() => {}); });
      G.CHARS.skins.forEach((sk) => { G.Rigs.load(G.CHARS.rigKey(this.charKey, sk)).catch(() => {}); });
      ['snowball', 'mimic', 'rudolph', 'noel', 'noel_damaged'].forEach((k) => { G.Rigs.load(k).catch(() => {}); });
      if (this.game && this.game.onLobbyOpen) this.game.onLobbyOpen();
    }

    close() {
      this.root.visible = false;
    }

    select(key) {
      if (!G.CHARS[key]) return;
      this.charKey = key;
      this.skin = 'basic';
      // 고른 캐릭터의 스킨 3종만 미리 받아 둔다
      G.CHARS.skins.forEach((sk) => { G.Rigs.load(G.CHARS.rigKey(key, sk)).catch(() => {}); });
      this._applySelection();
    }

    setSkin(skin) {
      if (G.CHARS.skins.indexOf(skin) < 0) return;
      this.skin = skin;
      this._applySelection();
    }

    tap(x, y) {
      for (const card of this.cards) {
        if (x > card.x && x < card.x + card.w && y > card.y && y < card.y + card.h) {
          if (this.charKey === card.key) {
            // 같은 카드를 다시 누르면 대사가 바뀐다
            this.lineT2.text = '“' + G.choice(G.CHARS.get(card.key).lines) + '”';
          } else {
            this.select(card.key);
            G.Sfx.ui(true);
          }
          return { hit: 'card', key: card.key };
        }
      }
      for (const b of this.skinBtns) {
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
          this.setSkin(b.skin);
          G.Sfx.ui(true);
          return { hit: 'skin', skin: b.skin };
        }
      }
      const d = this.depBtn;
      if (x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h) {
        this.deploy();
        return { hit: 'deploy' };
      }
      return { hit: null };
    }

    async deploy() {
      if (this.deployLock) return false;
      this.deployLock = true;
      this.depT.text = '준비 중…';
      await G.Rigs.load(G.CHARS.rigKey(this.charKey, this.skin));
      this.deployLock = false;
      if (this.game && this.game.onDeploy) this.game.onDeploy(this.charKey, this.skin);
      return true;
    }

    state() {
      return {
        open: this.root.visible,
        char: this.charKey,
        skin: this.skin,
        rigKey: this.rigKey,
        skinName: G.CHARS.skinName(this.charKey, this.skin),
        portrait: G.CHARS.portrait(this.charKey, this.skin),
        cards: this.cards.map((c) => c.key),
        skins: this.skinBtns.map((b) => b.skin),
        log: this.log.slice(-6),
        line: this.lineT2 ? this.lineT2.text : '',
      };
    }

    update(dt) {
      this.t += dt;
      if (!this.root.visible) return;
      // 눈
      const g = this.snow;
      g.clear();
      for (const f of this.flakes) {
        f.y += f.s * dt;
        f.x += Math.sin((this.t + f.y * 0.01) * 1.3) * 12 * dt + f.d * 6 * dt;
        if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
        if (f.x < -6) f.x = W + 6; else if (f.x > W + 6) f.x = -6;
        g.circle(f.x, f.y, f.r).fill({ color: 0xffffff, alpha: 0.55 });
      }
      if (this.rig) {
        this.rig.setState('victory', 0.5, {});
        this.rig.update(dt);
      }
    }
  }

  G.Lobby = Lobby;
})();
