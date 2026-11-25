/* lobby.js : 크리스마스 외전 로비 (Step 6)
 * - 성문 광장 대기실: 5인 캐릭터 카드 + 스킨(기본/산타/연회) + 파츠 리그 실시간 미리보기
 * - 고른 캐릭터·스킨이 그대로 전투 메인으로 출전한다
 */
(function () {
  const W = 1280, H = 720;

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
      this._build();
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
      head.rect(0, 0, W, 104).fill({ color: 0x030812, alpha: 0.55 });
      head.rect(0, 104, W, 26).fill({ color: 0x030812, alpha: 0.22 });
      c.addChild(head);

      const t1 = new PIXI.Text({
        text: '메리 크리스마스! 성문을 지켜라',
        style: { fontFamily: G.FONT, fontSize: 30, fontWeight: '900', fill: 0xf6fbff, letterSpacing: 3,
          stroke: { color: 0x0a1c38, width: 6 }, dropShadow: { color: 0x5fa8ff, blur: 10, distance: 0, alpha: 0.45 } },
      });
      t1.x = 48; t1.y = 30;
      c.addChild(t1);
      const t2 = new PIXI.Text({
        text: '축제 대기실  ·  출전할 수호자를 고르세요',
        style: { fontFamily: G.FONT, fontSize: 15, fill: 0xa8c8e8, letterSpacing: 1 },
      });
      t2.x = 50; t2.y = 68;
      c.addChild(t2);

      // 왼쪽: 리그 미리보기 무대
      this.stageG = new PIXI.Graphics();
      this.stageG.ellipse(W * 0.34, H - 196, 190, 42).fill({ color: 0x2a4a78, alpha: 0.30 });
      this.stageG.ellipse(W * 0.34, H - 196, 130, 28).fill({ color: 0x8fd6ff, alpha: 0.16 });
      c.addChild(this.stageG);
      this.rigLayer = new PIXI.Container();
      c.addChild(this.rigLayer);

      // 오른쪽: 정보 패널
      this.info = new PIXI.Container();
      c.addChild(this.info);
      const ig = new PIXI.Graphics();
      plate(ig, 760, 150, 470, 300, 18, 0x0a1626, 0.82);
      plateEdge(ig, 760, 150, 470, 300, 18, 0x6fa8e0, 0.45, 1.6);
      this.info.addChild(ig);
      this.nameT = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: 34, fontWeight: '900', fill: 0xf6fbff, letterSpacing: 2 } });
      this.nameT.x = 792; this.nameT.y = 172;
      this.info.addChild(this.nameT);
      this.roleT = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: 15, fill: 0x9fd6ff, letterSpacing: 1 } });
      this.roleT.x = 794; this.roleT.y = 216;
      this.info.addChild(this.roleT);
      this.statT = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: 14, fill: 0xc8dcf0, lineHeight: 24 } });
      this.statT.x = 794; this.statT.y = 248;
      this.info.addChild(this.statT);
      this.lineT2 = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: 15, fill: 0xffe6b8, lineHeight: 22, wordWrap: true, wordWrapWidth: 410 } });
      this.lineT2.x = 794; this.lineT2.y = 366;
      this.info.addChild(this.lineT2);

      // 스킨 선택
      const sk = new PIXI.Text({ text: '스킨', style: { fontFamily: G.FONT, fontSize: 14, fontWeight: '900', fill: 0x9fd6ff, letterSpacing: 2 } });
      sk.x = 792; sk.y = 462;
      c.addChild(sk);
      for (let i = 0; i < 3; i++) {
        const g = new PIXI.Graphics();
        const bx = 760 + i * 158, by = 486, bw = 146, bh = 48;
        const t = new PIXI.Text({ text: '', style: { fontFamily: G.FONT, fontSize: 14, fontWeight: '800', fill: 0xdfeaf7, align: 'center' } });
        t.anchor.set(0.5); t.x = bx + bw / 2; t.y = by + bh / 2;
        c.addChild(g, t);
        this.skinBtns.push({ g, t, x: bx, y: by, w: bw, h: bh, skin: G.CHARS.skins[i] });
      }

      // 캐릭터 카드 5장 (하단)
      for (let i = 0; i < 5; i++) {
        const key = G.CHARS.order[i];
        const cd = new PIXI.Container();
        const bw = 142, bh = 150, bx = 40 + i * 150, by = H - 172;
        const g = new PIXI.Graphics();
        const frame = new PIXI.Container();
        const img = new PIXI.Sprite(PIXI.Texture.WHITE);
        img.width = bw - 12; img.height = bh - 40;
        img.x = 6; img.y = 6;
        frame.addChild(img);
        const nm = new PIXI.Text({ text: G.CHARS[key].name, style: { fontFamily: G.FONT, fontSize: 15, fontWeight: '900', fill: 0xf6fbff } });
        nm.anchor.set(0.5); nm.x = bw / 2; nm.y = bh - 16;
        cd.addChild(g, frame, nm);
        cd.x = bx; cd.y = by;
        c.addChild(cd);
        this.cards.push({ cd, g, img, nm, x: bx, y: by, w: bw, h: bh, key });
      }

      // 출격 버튼
      this.depG = new PIXI.Graphics();
      this.depT = new PIXI.Text({ text: '전투 출격', style: { fontFamily: G.FONT, fontSize: 26, fontWeight: '900', fill: 0xfff3d0, letterSpacing: 4 } });
      this.depT.anchor.set(0.5);
      this.depT.x = 1010; this.depT.y = H - 92;
      c.addChild(this.depG, this.depT);
      this.depBtn = { x: 800, y: H - 134, w: 420, h: 84 };

      // 하단 안내
      const hint = new PIXI.Text({
        text: '← → 이동 · W S 깊이 · Space 점프 · J 공격 · K 스킬 · L 궁극기 · Shift 회피 · Q 물약 · P 일시정지 · T 오토',
        style: { fontFamily: G.FONT, fontSize: 12, fill: 0x7f9dbb, letterSpacing: 0.5 },
      });
      hint.x = 46; hint.y = H - 20;
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
      rig.setBodyPx(330);
      rig.root.x = W * 0.34;
      rig.root.y = H - 188;
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
      ['snowball', 'mimic', 'rudolph', 'noel'].forEach((k) => { G.Rigs.load(k).catch(() => {}); });
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
