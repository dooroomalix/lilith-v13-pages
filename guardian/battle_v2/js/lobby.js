/* lobby.js : 성문 대기실 로비 — 캐릭터 전시 · 터치 대사 · 지원 편성 · 조작 안내 · 출격
 *
 *  v5.5.0-build450 (Step 4-2)
 *   - 화면 흐름: 타이틀 → **로비** → 전투 → (승리/패배) → 로비 … 의 허브가 된다.
 *     전투 조작 체계(←/→·A/D, W/S, ↑/Space, J/K/L/Shift/Q/P)는 그대로 둔다.
 *   - 배경은 bg_gate.webp 한 장. 전투보다 어둡고 따뜻한 대기 조명(잔불·옅은 안개·성문 빛줄기)만 더해
 *     '성문 앞 대기실'의 차분한 분위기를 만든다. 성문 아치가 화면 가운데 오도록 배치해
 *     수호자가 문 앞에 서 있는 그림이 되게 했다.
 *   - 카엘·리아·아라·보른·세나 5인을 초상화(크게) + 전신 1:1 SD(보조 연출)로 전시한다.
 *     캐릭터를 누르면 한국어 구어체 대사가 말풍선으로 한 줄씩 순환하고, SD가 가볍게 튀며
 *     해당 성우 보이스(audio/ 보유 파일)가 재생된다. 보이스가 없는 캐릭터는 UI 효과음으로 대신한다.
 *   - 왼쪽: 지원 편성(아라·보른·세나) / 접이식 조작 안내, 오른쪽: 5인 선택 레일,
 *     아래: [전투 출격], 위: 사운드 켜기·끄기.
 */
(function () {
  const COL = {
    gold: 0xe8c27a,
    goldSoft: 0xffe7b8,
    goldDim: 0x8a6f3e,
    plate: 0x07121e,
    plate2: 0x0c1d2f,
    edge: 0x9fd0ff,
    txt: 0xeef6ff,
    sub: 0x9fc0e0,
    dim: 0x6f8fb0,
    warm: 0xffc247,
    red: 0xff8091,
    green: 0x7fe0a0,
  };

  /* ---------------------------------------------------------------- 5인 전시 데이터
   * lines 는 세계관에 맞춘 구어체 대사 — 번역투·기계적 말투 없이 사람이 말하듯 짧게.
   * voice 는 audio/ 에 실제로 있는 한국어 보이스만 매핑한다. */
  const CAST = [
    {
      key: 'kael', name: '카엘', role: '성문기사', en: 'THE GATEKEEPER',
      portrait: 'portraitKael', sd: 'kael_sd_idle', voice: 'kael_skill',
      color: 0x8ec7ff, accent: 0xd8ecff,
      lines: [
        '문은 아직 서 있어. 오늘 밤도 내가 지킨다.',
        '이름은… 카엘. 방금 물었나? 미안해, 요즘 자꾸 잊어서.',
        '리아가 적어 두니까 괜찮아. 나는 검만 쥐면 돼.',
        '출격하기 전엔 숨 한 번 크게 쉬어. 그게 제일 중요해.',
        '네가 여기 서 있다는 것만으로도, 이 문은 조금 단단해진다.',
      ],
    },
    {
      key: 'lia', name: '리아', role: '마도사', en: "LIGHT'S VERDICT",
      portrait: 'portraitLia', sd: 'lia_sd_idle', voice: 'lia_ult',
      color: 0xb98bff, accent: 0xe6dcff,
      lines: [
        '기록은 제가 해요. 당신은 잊어도 괜찮아요.',
        '오늘 아침까지 열아홉 장째예요. 스무 장이 되기 전에 한 번 봐 주실래요?',
        '문 앞에서 서성대는 건 좋아요. 다만 너무 오래는 하지 마요.',
        '빛은 아껴 쓰는 거예요. 넘치게 쓰면 그 틈으로 어둠이 들어와요.',
        '당신이 잊은 걸 제가 기억하고 있으니, 두 사람 몫을 하면 되잖아요.',
      ],
    },
    {
      key: 'ara', name: '아라', role: '등불지기', en: "LAMPBEARER'S WARMTH",
      portrait: 'portraitAra', sd: 'ara_sd_idle', voice: 'ara_support',
      color: 0xffc247, accent: 0xffe9a8,
      lines: [
        '이 등불, 꺼지지 않게 제가 들고 있을게요.',
        '어두운 건 무섭지 않아요. 아무도 돌아오지 않는 게 무서운 거예요.',
        '왕관이 아니라 등불이래요. 그래도 이게 제일 자랑이에요.',
        '싸울 때는 제 뒤에 있으면 따뜻할 거예요.',
        '조금만 쉬었다 가요. 등불은 그동안 제가 지키고 있을게요.',
      ],
    },
    {
      key: 'born', name: '보른', role: '대장장이', en: 'IRON VERDICT',
      portrait: 'portraitBorn', sd: 'born_sd_idle', voice: 'born_support',
      color: 0xff8a3c, accent: 0xffc98c,
      lines: [
        '검은 직접 벼린 놈이 써야 쓸 만한 법이지.',
        '맞을 놈은 내가 다 맞아 줄 테니, 뒤에서 함부로 나오지 마라.',
        '화로는 아직 뜨겁다. 쇠는 식으면 다시 벼리면 되지만 사람은 다르지.',
        '돌아오면 어깨 좀 주무르게. 나보다 맞은 놈이 더 많아 보이니까.',
        '이 쇠소리 들리나? 저게 아직 살아 있다는 소리다.',
      ],
    },
    {
      key: 'sena', name: '세나', role: '기록관', en: 'SEAL OF RECORDS',
      portrait: 'portraitSena', sd: 'sena_sd_idle', voice: 'sena_support',
      color: 0xb98bff, accent: 0xe6dcff,
      lines: [
        '성문 앞에서 일어난 일은 전부 기록에 남아. 손대지 마.',
        '느리게 움직이면 적기 편해. 그런데 네 속도가 나을 때가 많더라.',
        '이름은 한 번만 말해. 두 번 들으면 나도 헷갈려.',
        '잊는 건 기록이 없어서야. 그래서 나는 절대 안 지워.',
        '지금 이 순간도 적고 있어. 나중에 웃을 일이 하나쯤은 생기겠지.',
      ],
    },
  ];

  /* 지원 편성 — 실제 전투 효과(support.js CARDS)와 같은 내용으로 적는다 */
  const SUPPORT = [
    { key: 'ara', name: '아라', role: '등불지기', portrait: 'portraitAra', color: 0xffc247,
      caption: '체력 18% 회복 · 주변 적 밀어내기' },
    { key: 'born', name: '보른', role: '대장장이', portrait: 'portraitBorn', color: 0xff8a3c,
      caption: '전방 강타 · 기절 1.8초 · 방어력 -25%' },
    { key: 'sena', name: '세나', role: '기록관', portrait: 'portraitSena', color: 0xb98bff,
      caption: '적 이동 -35% · 아군 쿨타임 -2.5초' },
  ];

  /* 조작 안내 — 전투 조작은 절대 바뀌지 않는다 */
  const KEYS = [
    ['← →   /   A D', '좌우 이동'],
    ['W   /   S', '안쪽 · 바깥쪽(깊이) 이동'],
    ['↑   /   Space', '점프'],
    ['J', '공격 (3연타)'],
    ['K   /   L', '스킬 · 궁극기'],
    ['Shift', '회피 (퍼펙트 반격)'],
    ['Q   /   P', '물약 · 일시정지'],
    ['M', '소리 켜기 · 끄기'],
  ];

  /* ---------------------------------------------------------------- 배치(1280×720) */
  const P = {
    headerH: 56,
    sound: { x: 1148, y: 11, w: 110, h: 38 },
    infoX: 20,
    infoW: 390,
    support: { x: 20, y: 60, w: 390, h: 252 },
    keys: { x: 20, y: 324, w: 390, h: 276 },
    keyToggle: { x: 232, y: 332, w: 124, h: 30 },
    stage: { x: 566, y: 62, w: 340, h: 340 },
    name: { x: 566, y: 342, w: 340, h: 60 },
    sdX: 498, sdFoot: 408, sdBody: 230,
    bubble: { x: 466, y: 440, w: 540, h: 92 },
    stageHit: { x: 424, y: 96, w: 622, h: 452 },
    hintY: 550,
    sortie: { x: 570, y: 566, w: 320, h: 86 },
    rail: { x: 1138, y: 62, w: 126, h: 540, cy0: 118, step: 100, r: 38 },
  };

  /* 판타지 패널 헬퍼 */
  function platePath(g, x, y, w, h, cut) {
    return [x + cut, y, x + w - cut, y, x + w, y + cut, x + w, y + h - cut,
      x + w - cut, y + h, x + cut, y + h, x, y + h - cut, x, y + cut];
  }
  function plate(g, x, y, w, h, cut, fill, alpha) {
    g.poly(platePath(g, x, y, w, h, cut)).fill({ color: fill, alpha });
  }
  function edge(g, x, y, w, h, cut, color, alpha, width) {
    g.poly(platePath(g, x, y, w, h, cut)).stroke({ width: width || 1.5, color, alpha });
  }
  function gem(g, x, y, r, color, alpha) {
    g.poly([x, y - r, x + r * 0.72, y, x, y + r, x - r * 0.72, y]).fill({ color, alpha });
  }

  class Lobby {
    constructor(game) {
      this.game = game;
      this.root = new PIXI.Container();
      this.root.zIndex = 15;
      this.root.visible = false;

      this.sel = 0;
      this.lineIdx = 0;
      this.t = 0;
      this.pressT = 0;         // 캐릭터를 눌렀을 때의 튀는 모션 타이머
      this.portraitFade = 1;   // 캐릭터 전환 페이드
      this.bubbleT = 0;        // 말풍선 등장 애니메이션
      this.controlsOpen = true;
      this.tips = 0;           // 말풍선 힌트를 몇 번 눌렀는지
      this.embers = [];
      this.mists = [];
      this.playLog = [];       // 검증용: 대사·보이스 재생 기록

      this._build();
      game.root.addChild(this.root);
    }

    /* ================================================================ 빌드 */
    _build() {
      this._buildBackdrop();
      this._buildHeader();
      this._buildSupportPanel();
      this._buildKeyPanel();
      this._buildStage();
      this._buildRail();
      this._buildSortie();
    }

    /* ---- 배경 · 대기 조명 ---- */
    _buildBackdrop() {
      const c = new PIXI.Container();
      this.bgC = c;
      this.root.addChild(c);

      const tex = G.Assets.tex.bg;
      const bg = new PIXI.Sprite(tex);
      bg.anchor.set(0.5);
      const s = Math.max(G.W / bg.width, G.H / bg.height) * 1.04;
      bg.scale.set(s);
      bg.x = G.W / 2; bg.y = G.H / 2;
      bg.tint = 0xa8b6cc;           // 전투보다 한 톤 가라앉힌 조명
      this.bgSpr = bg;
      c.addChild(bg);

      // 화면을 어둡게 눌러 UI 가독성 확보
      const dark = new PIXI.Graphics();
      dark.rect(0, 0, G.W, G.H).fill({ color: 0x03060c, alpha: 0.44 });
      dark.rect(0, 0, G.W, 120).fill({ color: 0x02040a, alpha: 0.5 });
      dark.rect(0, G.H - 120, G.W, 120).fill({ color: 0x02040a, alpha: 0.45 });
      c.addChild(dark);

      // 성문에서 흘러내리는 빛줄기 (가운데 = 전시 위치)
      const beam = new PIXI.Sprite(G.Assets.tex.beam);
      beam.anchor.set(0.5, 0);
      beam.x = 730; beam.y = 46;
      beam.width = 340; beam.height = 470;
      beam.alpha = 0.16;
      beam.tint = 0xffe6bd;
      beam.blendMode = 'add';
      this.beam = beam;
      c.addChild(beam);

      // 캐릭터 뒤 따뜻한 조명
      const glow = new PIXI.Sprite(G.Assets.tex.glow);
      glow.anchor.set(0.5);
      glow.x = 730; glow.y = 250;
      glow.width = 900; glow.height = 760;
      glow.tint = 0xffcf8f;
      glow.alpha = 0.2;
      glow.blendMode = 'add';
      this.warmGlow = glow;
      c.addChild(glow);

      // 바닥 안개 띠
      for (let i = 0; i < 4; i++) {
        const m = new PIXI.Sprite(G.Assets.tex.mist);
        m.anchor.set(0.5);
        m.width = 1400 + i * 120;
        m.height = 220;
        m.x = 300 + i * 260;
        m.y = 470 + i * 22;
        m.alpha = 0.16 - i * 0.025;
        m.tint = 0x9fc6ff;
        m.blendMode = 'add';
        m._vx = 6 + i * 3;
        c.addChild(m);
        this.mists.push(m);
      }

      // 떠다니는 잔불(파티클)
      this.emberC = new PIXI.Container();
      c.addChild(this.emberC);
      for (let i = 0; i < 40; i++) this.embers.push(this._makeEmber(true));

      // 좌우 가장자리 비네트 (UI 뒤로 살짝 어둡게)
      const vg = new PIXI.Sprite(G.Assets.tex.vignette);
      vg.width = G.W; vg.height = G.H;
      vg.alpha = 0.55;
      c.addChild(vg);
    }

    _makeEmber(randomY) {
      const s = new PIXI.Sprite(G.Assets.tex.softDot);
      s.anchor.set(0.5);
      s.x = G.rand(G.W + 40, -40);
      s.y = randomY ? G.rand(G.H + 30, -30) : G.H + G.rand(30, 10);
      const sz = G.rand(11, 3.5);
      s.width = sz; s.height = sz;
      const warm = G.chance(0.72);
      s.tint = warm ? 0xffc98a : 0x9fd0ff;
      s.alpha = G.rand(0.5, 0.14);
      s.blendMode = 'add';
      s._vy = G.rand(26, 8);
      s._vx = G.rand(9, -9);
      s._ph = G.rand(G.TAU, 0);
      this.emberC.addChild(s);
      return s;
    }

    /* ---- 상단 헤더 · 사운드 토글 ---- */
    _buildHeader() {
      const c = new PIXI.Container();
      this.headerC = c;
      this.root.addChild(c);

      const bar = new PIXI.Graphics();
      bar.rect(0, 0, G.W, P.headerH).fill({ color: 0x03080f, alpha: 0.62 });
      bar.moveTo(0, P.headerH).lineTo(G.W, P.headerH).stroke({ width: 1, color: COL.goldDim, alpha: 0.5 });
      c.addChild(bar);

      const title = new PIXI.Text({
        text: '마지막 성문의 수호자',
        style: G.style({ fontSize: 21, fontWeight: '900', fill: 0xf3e9d2, letterSpacing: 2 }),
      });
      title.x = 26; title.y = 8;
      c.addChild(title);

      const sub = new PIXI.Text({
        text: 'THE LAST GATEKEEPER  ·  성문 대기실  ·  ' + G.VERSION.split('-')[0],
        style: G.style({ fontSize: 10.5, fill: COL.dim, letterSpacing: 1.2 }),
      });
      sub.x = 27; sub.y = 34;
      c.addChild(sub);

      // 사운드 토글 (로비에서도 동작)
      const b = P.sound;
      const g = new PIXI.Graphics();
      g.roundRect(b.x, b.y, b.w, b.h, 19).fill({ color: 0x0a1a2a, alpha: 0.82 });
      g.roundRect(b.x, b.y, b.w, b.h, 19).stroke({ width: 1.4, color: COL.edge, alpha: 0.45 });
      c.addChild(g);
      this.soundBg = g;

      this.soundIcon = new PIXI.Graphics();
      c.addChild(this.soundIcon);

      this.soundText = new PIXI.Text({
        text: '켜짐',
        style: G.style({ fontSize: 14, fontWeight: '800', fill: 0xdff0ff }),
      });
      this.soundText.anchor.set(0, 0.5);
      this.soundText.x = b.x + 52; this.soundText.y = b.y + b.h / 2;
      c.addChild(this.soundText);

      this._drawSound();
    }

    _drawSound() {
      const b = P.sound;
      const g = this.soundIcon;
      const on = !this.game.muted;
      g.clear();
      const cx = b.x + 26, cy = b.y + b.h / 2;
      // 스피커
      g.poly([cx - 10, cy - 5, cx - 5, cy - 5, cx + 1, cy - 11, cx + 1, cy + 11, cx - 5, cy + 5, cx - 10, cy + 5])
        .fill({ color: on ? 0xffffff : 0xa8b8c8, alpha: 0.92 });
      if (on) {
        g.arc(cx + 2, cy, 8, -0.9, 0.9).stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
        g.arc(cx + 2, cy, 12, -0.8, 0.8).stroke({ width: 2, color: 0xffffff, alpha: 0.45 });
      } else {
        g.moveTo(cx + 6, cy - 7).lineTo(cx + 15, cy + 7).stroke({ width: 2.4, color: COL.red, alpha: 0.95 });
        g.moveTo(cx + 15, cy - 7).lineTo(cx + 6, cy + 7).stroke({ width: 2.4, color: COL.red, alpha: 0.95 });
      }
      this.soundText.text = on ? '켜짐' : '꺼짐';
      this.soundText.style.fill = on ? 0xdff0ff : 0xff9aa6;
      // 꺼진 상태를 한눈에: pill 테두리도 붉게
      this.soundBg.clear();
      this.soundBg.roundRect(b.x, b.y, b.w, b.h, 19)
        .fill({ color: on ? 0x0a1a2a : 0x201016, alpha: 0.85 });
      this.soundBg.roundRect(b.x, b.y, b.w, b.h, 19)
        .stroke({ width: 1.4, color: on ? COL.edge : COL.red, alpha: on ? 0.45 : 0.7 });
    }

    /* ---- 지원 편성 ---- */
    _buildSupportPanel() {
      const R = P.support;
      const c = new PIXI.Container();
      this.root.addChild(c);

      const g = new PIXI.Graphics();
      plate(g, R.x, R.y, R.w, R.h, 14, COL.plate, 0.72);
      edge(g, R.x, R.y, R.w, R.h, 14, COL.gold, 0.4);
      gem(g, R.x + 12, R.y + 24, 5.5, COL.gold, 0.9);
      g.moveTo(R.x + 24, R.y + 40).lineTo(R.x + R.w - 14, R.y + 40).stroke({ width: 1, color: COL.edge, alpha: 0.16 });
      c.addChild(g);

      const t = new PIXI.Text({ text: '지원 편성', style: G.style({ fontSize: 18, fontWeight: '900', fill: COL.goldSoft, letterSpacing: 2 }) });
      t.x = R.x + 26; t.y = R.y + 13;
      c.addChild(t);

      const sub = new PIXI.Text({ text: 'SUPPORT  ·  쿨타임이 차면 달려옵니다', style: G.style({ fontSize: 10, fill: COL.dim, letterSpacing: 0.6 }) });
      sub.anchor.set(1, 0);
      sub.x = R.x + R.w - 18; sub.y = R.y + 22;
      c.addChild(sub);

      SUPPORT.forEach((s, i) => {
        const y = R.y + 46 + i * 66;
        const row = new PIXI.Container();
        c.addChild(row);

        // 초상화 원형
        const ring = new PIXI.Graphics();
        ring.circle(R.x + 48, y + 28, 22).fill({ color: 0x061019, alpha: 0.9 });
        ring.circle(R.x + 48, y + 28, 22).stroke({ width: 1.6, color: s.color, alpha: 0.8 });
        row.addChild(ring);

        const tex = G.Assets.tex[s.portrait];
        if (tex) {
          const spr = new PIXI.Sprite(tex);
          spr.anchor.set(0.5);
          const sc = 40 / Math.min(tex.width, tex.height);
          spr.scale.set(sc);
          spr.x = R.x + 48; spr.y = y + 28;
          const m = new PIXI.Graphics();
          m.circle(R.x + 48, y + 28, 19).fill({ color: 0xffffff });
          row.addChild(m);
          spr.mask = m;
          row.addChild(spr);
        }

        const nm = new PIXI.Text({ text: s.name, style: G.style({ fontSize: 16, fontWeight: '900', fill: COL.txt }) });
        nm.x = R.x + 82; nm.y = y + 6;
        row.addChild(nm);

        const role = new PIXI.Text({ text: s.role, style: G.style({ fontSize: 10, fill: s.color === 0xb98bff ? 0xc9a8ff : s.color, fontWeight: '800', letterSpacing: 1 }) });
        role.x = nm.x + nm.width + 9; role.y = y + 11;
        row.addChild(role);

        const cap = new PIXI.Text({
          text: s.caption,
          style: G.style({ fontSize: 11, fill: 0xa8c2d8, wordWrap: true, wordWrapWidth: R.w - 112, lineHeight: 15 }),
        });
        cap.x = R.x + 82; cap.y = y + 29;
        row.addChild(cap);
      });
    }

    /* ---- 조작 안내 (접기/펼치기) ---- */
    _buildKeyPanel() {
      const R = P.keys;
      const c = new PIXI.Container();
      this.root.addChild(c);

      // 접기/펼치기에 따라 높이가 바뀌므로 패널 배경은 따로 그린다
      this.keyPanelG = new PIXI.Graphics();
      c.addChild(this.keyPanelG);

      const t = new PIXI.Text({ text: '조작 안내', style: G.style({ fontSize: 18, fontWeight: '900', fill: 0xd8ecff, letterSpacing: 2 }) });
      t.x = R.x + 26; t.y = R.y + 13;
      c.addChild(t);

      // 토글 버튼
      const b = P.keyToggle;
      const tg = new PIXI.Graphics();
      tg.roundRect(b.x, b.y, b.w, b.h, 8).fill({ color: 0x12293d, alpha: 0.9 });
      tg.roundRect(b.x, b.y, b.w, b.h, 8).stroke({ width: 1.2, color: COL.edge, alpha: 0.5 });
      c.addChild(tg);
      this.keyToggleBg = tg;

      this.keyToggleText = new PIXI.Text({
        text: '접기', style: G.style({ fontSize: 12, fontWeight: '800', fill: 0xdff0ff }),
      });
      this.keyToggleText.anchor.set(0.5);
      this.keyToggleText.x = b.x + b.w / 2; this.keyToggleText.y = b.y + b.h / 2;
      c.addChild(this.keyToggleText);

      this.keyRows = new PIXI.Container();
      c.addChild(this.keyRows);
      KEYS.forEach(([key, desc], i) => {
        const y = R.y + 52 + i * 27;
        if (i % 2 === 0) {
          const band = new PIXI.Graphics();
          band.roundRect(R.x + 14, y - 3, R.w - 28, 25, 6).fill({ color: 0x0e2033, alpha: 0.4 });
          this.keyRows.addChild(band);
        }
        const kt = new PIXI.Text({
          text: key,
          style: G.style({ fontSize: 12.5, fontWeight: '900', fill: 0xffe4b0, letterSpacing: 0.4 }),
        });
        kt.x = R.x + 26; kt.y = y;
        this.keyRows.addChild(kt);

        const dt2 = new PIXI.Text({ text: desc, style: G.style({ fontSize: 12, fill: 0xbcd6ec }) });
        dt2.anchor.set(1, 0);
        dt2.x = R.x + R.w - 26; dt2.y = y + 0.5;
        this.keyRows.addChild(dt2);
      });

      this.keyHint = new PIXI.Text({
        text: '버튼을 누르면 조작 키가 펼쳐집니다',
        style: G.style({ fontSize: 12, fill: COL.dim }),
      });
      this.keyHint.anchor.set(0.5, 0);
      this.keyHint.x = R.x + R.w / 2; this.keyHint.y = R.y + 96;
      c.addChild(this.keyHint);

      this._applyControls();
    }

    _applyControls() {
      const R = P.keys;
      const h = this.controlsOpen ? R.h : 108;
      const g = this.keyPanelG;
      g.clear();
      plate(g, R.x, R.y, R.w, h, 14, COL.plate, 0.72);
      edge(g, R.x, R.y, R.w, h, 14, COL.edge, 0.3);
      gem(g, R.x + 12, R.y + 24, 5.5, COL.edge, 0.8);
      g.moveTo(R.x + 24, R.y + 40).lineTo(R.x + R.w - 14, R.y + 40).stroke({ width: 1, color: COL.edge, alpha: 0.16 });
      this.keyRows.visible = this.controlsOpen;
      this.keyHint.visible = !this.controlsOpen;
      this.keyHint.y = R.y + 56;
      this.keyToggleText.text = this.controlsOpen ? '접기' : '펼치기';
    }

    /* ---- 캐릭터 전시(초상화 + SD) ---- */
    _buildStage() {
      const S = P.stage;
      const c = new PIXI.Container();
      this.root.addChild(c);

      // 전시 프레임
      const g = new PIXI.Graphics();
      plate(g, S.x - 10, S.y - 10, S.w + 20, S.h + 20, 18, 0x050c15, 0.82);
      edge(g, S.x - 10, S.y - 10, S.w + 20, S.h + 20, 18, COL.gold, 0.55, 1.8);
      edge(g, S.x - 5, S.y - 5, S.w + 10, S.h + 10, 15, COL.edge, 0.18, 1);
      gem(g, S.x + S.w / 2, S.y - 10, 7, COL.gold, 0.95);
      gem(g, S.x + S.w / 2, S.y - 4, 3.5, 0xffffff, 0.8);
      c.addChild(g);

      // 초상화 (프레임 안쪽에 꽉 차게 크롭)
      const maskG = new PIXI.Graphics();
      maskG.roundRect(S.x, S.y, S.w, S.h, 12).fill({ color: 0xffffff });
      c.addChild(maskG);

      this.portraitSpr = new PIXI.Sprite(PIXI.Texture.WHITE);
      this.portraitSpr.x = S.x + S.w / 2;
      this.portraitSpr.y = S.y + S.h / 2;
      this.portraitSpr.anchor.set(0.5);
      this.portraitSpr.mask = maskG;
      c.addChild(this.portraitSpr);

      // 초상화 위 은은한 어둡기 + 아래쪽 그라데이션 (이름판 가독성)
      const shade = new PIXI.Graphics();
      shade.rect(S.x, S.y, S.w, S.h).fill({ color: 0x02070f, alpha: 0.16 });
      for (let i = 0; i < 10; i++) {
        shade.rect(S.x, S.y + S.h - 120 + i * 12, S.w, 12).fill({ color: 0x02060e, alpha: 0.05 + i * 0.035 });
      }
      c.addChild(shade);
      this.portraitShade = shade;

      // 이름판
      const N = P.name;
      const np = new PIXI.Graphics();
      np.roundRect(N.x, N.y, N.w, N.h, 10).fill({ color: 0x050d16, alpha: 0.86 });
      np.roundRect(N.x, N.y, N.w, N.h, 10).stroke({ width: 1.2, color: COL.gold, alpha: 0.35 });
      c.addChild(np);

      this.nameText = new PIXI.Text({ text: '', style: G.style({ fontSize: 25, fontWeight: '900', fill: 0xf6ecdc, letterSpacing: 3 }) });
      this.nameText.anchor.set(0.5, 0.5);
      this.nameText.x = N.x + N.w / 2; this.nameText.y = N.y + 22;
      c.addChild(this.nameText);

      this.roleText = new PIXI.Text({ text: '', style: G.style({ fontSize: 11, fill: COL.sub, letterSpacing: 1.6 }) });
      this.roleText.anchor.set(0.5, 0.5);
      this.roleText.x = N.x + N.w / 2; this.roleText.y = N.y + 44;
      c.addChild(this.roleText);

      // 전신 SD (보조 연출) — 발밑 그림자 + 접지
      const sdC = new PIXI.Container();
      this.sdC = sdC;
      c.addChild(sdC);

      this.sdShadow = new PIXI.Sprite(G.Assets.tex.shadow);
      this.sdShadow.anchor.set(0.5);
      this.sdShadow.width = 210; this.sdShadow.height = 62;
      this.sdShadow.x = P.sdX; this.sdShadow.y = P.sdFoot - 4;
      this.sdShadow.alpha = 0.5;
      sdC.addChild(this.sdShadow);

      this.sdGlow = new PIXI.Sprite(G.Assets.tex.glow);
      this.sdGlow.anchor.set(0.5);
      this.sdGlow.width = 300; this.sdGlow.height = 300;
      this.sdGlow.x = P.sdX; this.sdGlow.y = P.sdFoot - 110;
      this.sdGlow.alpha = 0.14;
      this.sdGlow.blendMode = 'add';
      sdC.addChild(this.sdGlow);

      this.sdSpr = new PIXI.Sprite(PIXI.Texture.WHITE);
      this.sdSpr.anchor.set(0.5, 0.8);
      this.sdSpr.x = P.sdX; this.sdSpr.y = P.sdFoot;
      sdC.addChild(this.sdSpr);

      // 말풍선
      const B = P.bubble;
      this.bubbleC = new PIXI.Container();
      // pivot 을 가운데로 두고 scale·alpha 로 등장 애니메이션을 준다
      this.bubbleC.pivot.set(B.w / 2, B.h / 2);
      this.bubbleC.position.set(B.x + B.w / 2, B.y + B.h / 2);
      c.addChild(this.bubbleC);

      const bg2 = new PIXI.Graphics();
      plate(bg2, 0, 0, B.w, B.h, 16, 0x061019, 0.88);
      edge(bg2, 0, 0, B.w, B.h, 16, COL.goldSoft, 0.5, 1.5);
      // 꼬리 (왼쪽 위 → 캐릭터 쪽)
      bg2.poly([86, 0, 122, 0, 92, -18]).fill({ color: 0x061019, alpha: 0.88 });
      bg2.moveTo(86, 0).lineTo(92, -18).lineTo(122, 0).stroke({ width: 1.5, color: COL.goldSoft, alpha: 0.5 });
      this.bubbleC.addChild(bg2);

      this.bubbleText = new PIXI.Text({
        text: '',
        style: G.style({ fontSize: 20, fill: 0xf2f8ff, wordWrap: true, wordWrapWidth: B.w - 64, lineHeight: 29, align: 'center' }),
      });
      this.bubbleText.anchor.set(0.5);
      this.bubbleText.x = B.w / 2; this.bubbleText.y = B.h / 2 + 2;
      this.bubbleC.addChild(this.bubbleText);

      // 힌트 문구
      this.hintText = new PIXI.Text({
        text: '캐릭터를 누르면 대사가 바뀝니다',
        style: G.style({ fontSize: 11.5, fill: COL.dim, letterSpacing: 0.6 }),
      });
      this.hintText.anchor.set(0.5);
      this.hintText.x = 730; this.hintText.y = P.hintY;
      c.addChild(this.hintText);

      this.stageC = c;
    }

    /* ---- 5인 선택 레일 ---- */
    _buildRail() {
      const R = P.rail;
      const c = new PIXI.Container();
      this.root.addChild(c);

      const g = new PIXI.Graphics();
      plate(g, R.x, R.y, R.w, R.h, 16, COL.plate, 0.6);
      edge(g, R.x, R.y, R.w, R.h, 16, COL.gold, 0.28);
      c.addChild(g);

      const t = new PIXI.Text({ text: '동료', style: G.style({ fontSize: 12, fontWeight: '900', fill: COL.dim, letterSpacing: 3 }) });
      t.anchor.set(0.5, 0);
      t.x = R.x + R.w / 2; t.y = R.y + 12;
      c.addChild(t);

      this.thumbs = [];
      CAST.forEach((cast, i) => {
        const cx = R.x + R.w / 2;
        const cy = R.cy0 + i * R.step + 22;
        const holder = new PIXI.Container();
        c.addChild(holder);

        const ring = new PIXI.Graphics();
        ring.circle(cx, cy, R.r).fill({ color: 0x050d16, alpha: 0.95 });
        ring.circle(cx, cy, R.r).stroke({ width: 1.6, color: cast.color, alpha: 0.55 });
        holder.addChild(ring);

        const tex = G.Assets.tex[cast.portrait];
        if (tex) {
          const spr = new PIXI.Sprite(tex);
          spr.anchor.set(0.5);
          const sc = (R.r * 2) / Math.min(tex.width, tex.height);
          spr.scale.set(sc);
          spr.x = cx; spr.y = cy;
          const m = new PIXI.Graphics();
          m.circle(cx, cy, R.r - 2).fill({ color: 0xffffff });
          holder.addChild(m);
          spr.mask = m;
          holder.addChild(spr);
        }

        const selG = new PIXI.Graphics();
        selG.circle(cx, cy, R.r + 5).stroke({ width: 2.6, color: COL.goldSoft, alpha: 0.95 });
        selG.circle(cx, cy, R.r + 10).stroke({ width: 1, color: COL.gold, alpha: 0.4 });
        selG.visible = i === this.sel;
        holder.addChild(selG);

        const nm = new PIXI.Text({ text: cast.name, style: G.style({ fontSize: 11, fontWeight: '800', fill: COL.sub }) });
        nm.anchor.set(0.5, 0);
        nm.x = cx; nm.y = cy + R.r + 3;
        holder.addChild(nm);

        this.thumbs.push({ holder, sel: selG, nm, cast, cx, cy });
      });
    }

    /* ---- 출격 버튼 ---- */
    _buildSortie() {
      const B = P.sortie;
      const c = new PIXI.Container();
      this.root.addChild(c);

      const g = new PIXI.Graphics();
      plate(g, B.x - 4, B.y - 4, B.w + 8, B.h + 8, 18, 0x1a1206, 0.9);
      plate(g, B.x, B.y, B.w, B.h, 16, 0x2a2010, 0.96);
      edge(g, B.x, B.y, B.w, B.h, 16, COL.gold, 0.92, 2.4);
      edge(g, B.x + 5, B.y + 5, B.w - 10, B.h - 10, 13, COL.goldSoft, 0.3, 1);
      gem(g, B.x + 14, B.y + B.h / 2, 6, COL.goldSoft, 0.9);
      gem(g, B.x + B.w - 14, B.y + B.h / 2, 6, COL.goldSoft, 0.9);
      c.addChild(g);
      this.sortieBg = g;

      const t = new PIXI.Text({
        text: '전  투  출  격',
        style: G.style({ fontSize: 30, fontWeight: '900', fill: 0xfff4dc, letterSpacing: 2, stroke: { color: 0x3a2408, width: 5 } }),
      });
      t.anchor.set(0.5);
      t.x = B.x + B.w / 2; t.y = B.y + B.h / 2 - 2;
      c.addChild(t);
      this.sortieText = t;

      const s = new PIXI.Text({
        text: '성문 앞 · 아르카논까지',
        style: G.style({ fontSize: 11, fill: 0xcbb489, letterSpacing: 1 }),
      });
      s.anchor.set(0.5, 0);
      s.x = B.x + B.w / 2; s.y = B.y + B.h + 6;
      c.addChild(s);
    }

    /* ================================================================ 상태 전환 */
    enter() {
      this.root.visible = true;
      this.t = 0;
      this.pressT = 0;
      this.portraitFade = 1;
      this.bubbleT = 0.001;
      this.tips = 0;
      this.lineIdx = 0;
      this._applyChar(true);
      this._drawSound();
      this._applyControls();
      // 로비는 전투보다 조용하게 — BGM 을 낮춰 깔고, 출격하면 원래대로 올린다
      G.Sfx.bgmVolume = 0.22;
      if (G.Sfx.bgm && !G.Sfx.muted) G.Sfx.bgm.volume = 0.22;
    }

    exit() {
      this.root.visible = false;
      G.Sfx.bgmVolume = 0.38;
      if (G.Sfx.bgm && !G.Sfx.muted) G.Sfx.bgm.volume = 0.38;
    }

    /* ================================================================ 캐릭터 · 대사 */
    _applyChar(resetLine) {
      const cast = CAST[this.sel];
      if (resetLine) this.lineIdx = 0;

      // 초상화 — 프레임을 꽉 채우도록 크롭
      const tex = G.Assets.tex[cast.portrait] || PIXI.Texture.WHITE;
      this.portraitSpr.texture = tex;
      const S = P.stage;
      const sc = Math.max(S.w / tex.width, S.h / tex.height);
      this.portraitSpr.scale.set(sc);
      this.portraitSpr.alpha = 1;

      // 전신 SD
      const sd = G.Assets.sd[cast.sd];
      if (sd && sd.texture) {
        this.sdSpr.texture = sd.texture;
        this.sdSpr.anchor.set(sd.ax, sd.ay);
        this.sdSpr._bodyH = sd.bodyH || sd.h;
      }
      this.sdGlow.tint = cast.color;
      this.sdShadow.tint = 0x000000;

      // 이름판
      this.nameText.text = cast.name;
      this.nameText.style.fill = cast.accent;
      this.roleText.text = cast.role + '  ·  ' + cast.en;

      // 레일 선택 표시
      this.thumbs.forEach((th, i) => { th.sel.visible = i === this.sel; });

      this._showLine(false);
      this.bubbleT = 0.001;
      this.portraitFade = 0;
    }

    _showLine(withVoice) {
      const cast = CAST[this.sel];
      const line = cast.lines[this.lineIdx % cast.lines.length];
      this.bubbleText.text = line;
      this.bubbleT = 0.001;
      this.playLog.push({ t: +this.game.time.toFixed(2), char: cast.key, line: this.lineIdx, text: line, voice: !!withVoice });
      if (this.playLog.length > 40) this.playLog.shift();
      if (withVoice) {
        // audio/ 에 있는 그 캐릭터의 한국어 보이스. 없으면 UI 효과음으로 대신한다.
        const played = G.Sfx.playVoice(cast.voice, { priority: 2, min: 1400 });
        if (!played) G.Sfx.ui(true);
      }
    }

    tapCharacter() {
      const cast = CAST[this.sel];
      this.lineIdx = (this.lineIdx + 1) % cast.lines.length;
      this.pressT = 0.44;
      this._showLine(true);
      this.tips++;
      G.Sfx.ui(true);
    }

    select(i) {
      if (i === this.sel) { this.tapCharacter(); return; }
      this.sel = i;
      this._applyChar(true);
      G.Sfx.ui(true);
    }

    toggleSound() {
      this.game.muted = G.Sfx.toggleMute();
      this._drawSound();
      if (!this.game.muted) G.Sfx.ui(true);
    }

    toggleControls() {
      this.controlsOpen = !this.controlsOpen;
      this._applyControls();
      G.Sfx.ui(true);
    }

    /* ================================================================ 입력 */
    pointerDown(x, y, id) {
      const inRect = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (inRect(P.sound)) { this.toggleSound(); return true; }
      if (inRect(P.keyToggle)) { this.toggleControls(); return true; }
      if (inRect(P.sortie)) { this.game.sortieWithFade(); return true; }
      const R = P.rail;
      for (let i = 0; i < this.thumbs.length; i++) {
        const th = this.thumbs[i];
        if (G.dist(x, y, th.cx, th.cy) <= R.r + 4) { this.select(i); return true; }
      }
      if (inRect(P.stageHit)) { this.tapCharacter(); return true; }
      return false;
    }

    /* ================================================================ 프레임 */
    update(dt) {
      this.t += dt;
      const t = this.t;

      // 배경 호흡
      if (this.bgSpr) {
        this.bgSpr.x = G.W / 2 + Math.sin(t * 0.09) * 7;
        this.bgSpr.y = G.H / 2 + Math.sin(t * 0.07 + 1) * 4;
      }
      this.beam.alpha = 0.14 + Math.sin(t * 0.6) * 0.035;
      this.warmGlow.alpha = 0.18 + Math.sin(t * 0.5 + 0.6) * 0.04;

      for (const m of this.mists) {
        m.x += m._vx * dt;
        if (m.x - m.width / 2 > G.W + 60) m.x = -m.width / 2 - 60;
      }

      for (const s of this.embers) {
        s.y -= s._vy * dt;
        s.x += Math.sin(t * 0.7 + s._ph) * 9 * dt + s._vx * dt;
        if (s.y < -24) {
          s.y = G.H + G.rand(24, 6);
          s.x = G.rand(G.W + 40, -40);
        }
      }

      // 캐릭터 전환 페이드
      if (this.portraitFade < 1) {
        this.portraitFade = Math.min(1, this.portraitFade + dt * 4.2);
        const f = G.easeOutCubic(this.portraitFade);
        this.portraitSpr.alpha = 0.25 + 0.75 * f;
        this.portraitSpr.scale.set(
          Math.max(P.stage.w / this.portraitSpr.texture.width, P.stage.h / this.portraitSpr.texture.height) * (0.98 + 0.02 * f),
          Math.max(P.stage.w / this.portraitSpr.texture.width, P.stage.h / this.portraitSpr.texture.height) * (1.0 + 0.01 * f)
        );
      } else {
        // 아주 미세한 호흡 (살아 있는 느낌)
        const tex = this.portraitSpr.texture;
        const base = Math.max(P.stage.w / tex.width, P.stage.h / tex.height);
        this.portraitSpr.scale.set(base * (1 + Math.sin(t * 0.9) * 0.004), base * (1 + Math.sin(t * 0.9 + 0.6) * 0.004));
      }

      // SD 대기 모션 + 눌렀을 때 튀기
      if (this.pressT > 0) this.pressT = Math.max(0, this.pressT - dt);
      const press = this.pressT > 0 ? this.pressT / 0.44 : 0;
      const hop = press > 0 ? Math.sin((1 - press) * Math.PI) * 30 : 0;
      const breath = Math.sin(t * 2.1) * 2.2;
      const bodyH = this.sdSpr._bodyH || 470;
      const baseSc = (P.sdBody / bodyH);
      const squash = press > 0 ? 1 + Math.sin((1 - press) * Math.PI * 2) * 0.05 : 1;
      this.sdSpr.scale.set(baseSc * (2 - squash), baseSc * squash);
      this.sdSpr.y = P.sdFoot - breath - hop;
      this.sdSpr.rotation = Math.sin(t * 1.6) * 0.012;
      this.sdShadow.width = 210 - hop * 1.4;
      this.sdShadow.alpha = 0.5 - hop * 0.004;
      this.sdGlow.alpha = 0.12 + Math.sin(t * 2.4) * 0.03 + press * 0.16;

      // 말풍선 등장
      if (this.bubbleT > 0) {
        this.bubbleT = Math.min(1, this.bubbleT + dt * 5.5);
        const p = G.easeOutCubic(this.bubbleT);
        this.bubbleC.alpha = p;
        this.bubbleC.scale.set(0.97 + 0.03 * p, 0.97 + 0.03 * p);
        this.bubbleC.position.set(P.bubble.x + P.bubble.w / 2, P.bubble.y + P.bubble.h / 2 + (1 - p) * 12);
      }

      // 힌트 깜빡임
      if (this.hintText) this.hintText.alpha = 0.5 + Math.sin(t * 2.6) * 0.25;

      // 출격 버튼 숨쉬기
      if (this.sortieText) {
        const p = 1 + Math.sin(t * 2.2) * 0.012;
        this.sortieText.scale.set(p, p);
      }
      // 선택 레일 링 회전감
      this.thumbs.forEach((th, i) => {
        if (!th.sel.visible) return;
        th.sel.alpha = 0.75 + Math.sin(t * 3 + i) * 0.22;
      });
    }

    /* ================================================================ 검증용 */
    state() {
      const cast = CAST[this.sel];
      return {
        active: this.root.visible,
        phase: this.game.phase,
        char: cast.key,
        charName: cast.name,
        role: cast.role,
        voice: cast.voice,
        lineIndex: this.lineIdx,
        lineCount: cast.lines.length,
        line: cast.lines[this.lineIdx % cast.lines.length],
        text: this.bubbleText.text,
        soundOn: !this.game.muted,
        controlsOpen: this.controlsOpen,
        keyRowsVisible: this.keyRows.visible,
        bubbleAlpha: +this.bubbleC.alpha.toFixed(3),
        pressT: +this.pressT.toFixed(2),
        sdFootY: +this.sdSpr.y.toFixed(1),
        portraits: CAST.map((c) => c.portrait),
        log: this.playLog.slice(-6),
      };
    }

    hits() {
      const R = P.rail;
      return {
        sound: { ...P.sound },
        controls: { ...P.keyToggle },
        sortie: { ...P.sortie },
        stage: { ...P.stageHit },
        chars: this.thumbs.map((th) => ({
          key: th.cast.key, x: th.cx - R.r, y: th.cy - R.r, w: R.r * 2, h: R.r * 2,
        })),
      };
    }
  }

  Lobby.CAST = CAST;
  G.Lobby = Lobby;
})();
