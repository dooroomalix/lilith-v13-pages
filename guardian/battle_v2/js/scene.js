/* scene.js : 배경(황혼 폐허) 입체 레이어 — 원경 안개 · 성문 빛줄기 · 바닥 안개 · 전경 안개 · 부유 입자 · 카메라
 *            + 스테이지별 공기(look) — 3스테이지 '그림자 성채'는 자줏빛 어둠·왕좌·봉인진을 덧입는다 (Step 9-3) */
(function () {
  function gradTexture(w, h, stops) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h);
    stops.forEach(([p, col]) => g.addColorStop(p, col));
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    return PIXI.Texture.from(c);
  }

  // All generated textures are local Canvas2D assets; no remote fetches.
  function paintedSky() {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 720);
    [[0,'#080e2b'],[0.4,'#262044'],[0.72,'#65405e'],[1,'#dc7751']].forEach(v=>g.addColorStop(...v));
    x.fillStyle=g; x.fillRect(0,0,1280,720);
    const halo=x.createRadialGradient(1010,132,10,1010,132,210);
    halo.addColorStop(0,'rgba(200,214,255,.45)'); halo.addColorStop(.35,'rgba(142,147,242,.13)'); halo.addColorStop(1,'rgba(142,147,242,0)');
    x.fillStyle=halo; x.fillRect(790,0,450,360);
    x.beginPath(); x.arc(1010,132,54,0,Math.PI*2); x.fillStyle='#d9dfff';x.fill();
    let seed=2197; const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<140;i++){x.fillStyle=`rgba(222,230,255,${.2+rand()*.65})`;x.fillRect(rand()*1280,rand()*370,1+rand()*2,1+rand()*2);}
    for(let i=0;i<9;i++){const xx=rand()*1280, yy=70+rand()*300;
      const cloud=x.createRadialGradient(xx,yy,10,xx,yy,190);cloud.addColorStop(0,'rgba(148,120,176,.18)');cloud.addColorStop(1,'rgba(148,120,176,0)');x.fillStyle=cloud;x.fillRect(xx-200,yy-130,400,260);}
    return PIXI.Texture.from(c);
  }
  // Broken medieval architecture, not rectangular skyline blocks.
  function ruinLayer(color, offset, height) {
    const g = new PIXI.Graphics();
    const y = 495 + offset * 0.11;
    const dark = color;
    const rim = 0xd68a5a;
    const wall = (x, w, top, jag) => {
      const pts = [x, 720, x, top + 18];
      for (let k = 0; k <= 10; k++) {
        const px = x + w * k / 10;
        const chip = ((k * 17 + jag * 11) % 7) * 3;
        pts.push(px, top + chip + (k % 3 === 0 ? 11 : 0));
      }
      pts.push(x + w, 720);
      g.poly(pts).fill({color: dark, alpha: 0.46});
      for (let k = 0; k < 10; k++) {
        const x1 = x + w * k / 10;
        const y1 = top + ((k * 17 + jag * 11) % 7) * 3 + (k % 3 === 0 ? 11 : 0);
        const x2 = x + w * (k + 1) / 10;
        const y2 = top + (((k + 1) * 17 + jag * 11) % 7) * 3 + ((k + 1) % 3 === 0 ? 11 : 0);
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({color: rim, width: 1.2, alpha: 0.14});
      }
    };
    wall(-130 + offset * .22, 330, y - 12 - height * .14, 2);
    wall(1000 + offset * .14, 410, y - 3 - height * .18, 5);
    // Ruined towers with chipped pointed caps, arched openings and broken pillars.
    for (const [x, w, h] of [[105 + offset*.3, 77, 87], [1090 - offset*.2, 91, 103]]) {
      const top = y - h;
      g.poly([x, y+90, x, top+35, x+9, top+20, x+21, top+23,
        x+w*.43, top-18, x+w*.57, top-11, x+w*.74, top+19,
        x+w-10, top+15, x+w, top+36, x+w, y+90]).fill({color:dark,alpha:.55});
      g.moveTo(x+9,top+20).lineTo(x+21,top+23).lineTo(x+w*.43,top-18)
        .lineTo(x+w*.57,top-11).stroke({color:rim,width:1.5,alpha:.19});
      g.poly([x+w*.3,y+20,x+w*.3,top+67,x+w*.5,top+48,x+w*.7,top+67,x+w*.7,y+20])
        .fill({color:0x100f20,alpha:.42});
    }
    // A broken stone arch on the far left, with its open interior.
    g.moveTo(-55,y+80).lineTo(-55,y-22).quadraticCurveTo(55,y-124,157,y-32)
      .lineTo(157,y+75).stroke({color:dark,width:27,alpha:.55});
    g.moveTo(-47,y-27).quadraticCurveTo(55,y-117,151,y-32)
      .stroke({color:rim,width:2,alpha:.20});
    return g;
  }
  function floorPerspective() {
    const g = new PIXI.Graphics();
    const vanX=640, vanY=470, bottom=735;
    g.poly([0,720,1280,720,790,vanY,490,vanY]).fill({color:0x343849,alpha:.20});
    // Staggered stone slabs: horizontal courses and short offset joints.
    const rows=9;
    const bounds=[];
    for(let r=0;r<=rows;r++) {
      const t=r/rows;
      bounds.push(vanY+Math.pow(t,1.65)*(bottom-vanY));
    }
    for(let r=0;r<rows;r++) {
      const y0=bounds[r], y1=bounds[r+1];
      const t0=(y0-vanY)/(bottom-vanY),t1=(y1-vanY)/(bottom-vanY);
      const width0=150+1150*t0, width1=150+1150*t1;
      const count=7;
      const offset=(r%2)*.5;
      for(let k=-count;k<=count;k++) {
        const xx0=vanX+(k+offset)*width0/count;
        const xx1=vanX+(k+offset)*width1/count;
        g.moveTo(xx0,y0+1).lineTo(xx1,y1-1).stroke({color:0x9a9ca5,width:1.2,alpha:.12+.09*t1});
      }
      g.moveTo(0,y1).lineTo(1280,y1).stroke({color:0x9c9c9e,width:1.2,alpha:.12+.08*t1});
      if(r>3) {
        const x=vanX+((r*127)%630)-310;
        g.moveTo(x,y1-7).lineTo(x+16,y1-11).lineTo(x+23,y1-4)
          .stroke({color:0x161c2d,width:1.4,alpha:.23});
        g.moveTo(x+48,y1-2).lineTo(x+59,y1-5).stroke({color:0x66815f,width:3,alpha:.20});
      }
    }
    return g;
  }

  /* 2.5D 사각 링 바닥 (Step 8) — 플레이어가 X/Y(깊이) 좌표를 눈으로 읽는 기준면.
     앞(near)일수록 넓고 뒤(far)일수록 좌우가 좁아지는 사다리꼴 링 + 코너 마커 +
     깊이선·레인선. 캐릭터 뒤(near 레이어)에 깔리되 시차 이동은 받지 않는다. */
  function ringFloor() {
    const g = new PIXI.Graphics();
    const R = G.RING || { left: 104, right: 1056, far: 470, near: 690, centerX: 580, centerY: 588 };
    const cx = R.centerX;
    const halfAt = (y) => {
      const t = G.clamp((y - R.far) / (R.near - R.far), 0, 1);
      return G.lerp((R.right - R.left) * 0.5 - 24, (R.right - R.left) * 0.5, t);
    };
    const quad = (inset) => {
      const hf = halfAt(R.far) - inset, hn = halfAt(R.near) - inset;
      return [cx - hf, R.far + inset * 0.5, cx + hf, R.far + inset * 0.5,
        cx + hn, R.near - inset * 0.5, cx - hn, R.near - inset * 0.5];
    };
    // 링 바닥면 — 아주 옅은 빛을 깔아 무대임을 알린다
    g.poly(quad(0)).fill({ color: 0x9fd0ff, alpha: 0.030 });
    g.poly(quad(0)).stroke({ color: 0xbfe0ff, width: 3.2, alpha: 0.26 });
    g.poly(quad(9)).stroke({ color: 0xe8c27a, width: 1.3, alpha: 0.20 });

    // 깊이선(가로) — 뒤에서 앞으로 4단
    [0.22, 0.46, 0.72, 0.92].forEach((t, i) => {
      const y = G.lerp(R.far, R.near, t);
      const h = halfAt(y);
      g.moveTo(cx - h, y).lineTo(cx + h, y)
        .stroke({ color: 0xbfe0ff, width: i === 1 || i === 2 ? 1.6 : 1.1, alpha: 0.11 + 0.05 * t });
    });

    // 주 타점 레인(588 ± 48) — 이 두 선 사이가 근접 공격이 통하는 깊이다
    (R.laneY || [540, 636]).forEach((y) => {
      const h = halfAt(y);
      g.moveTo(cx - h * 0.94, y).lineTo(cx + h * 0.94, y)
        .stroke({ color: 0xffd166, width: 1.8, alpha: 0.17 });
    });

    // 원근 세로선(레일) — 뒤로 갈수록 가운데로 모인다
    [-0.72, -0.36, 0, 0.36, 0.72].forEach((k) => {
      const hf = halfAt(R.far), hn = halfAt(R.near);
      g.moveTo(cx + hf * k, R.far).lineTo(cx + hn * k, R.near)
        .stroke({ color: 0xbfe0ff, width: 1, alpha: 0.09 });
    });

    // 코너 마커 — 네 모서리의 다이아몬드
    const corners = [
      [cx - halfAt(R.far), R.far], [cx + halfAt(R.far), R.far],
      [cx - halfAt(R.near), R.near], [cx + halfAt(R.near), R.near],
    ];
    corners.forEach(([x, y]) => {
      const r = 7;
      g.poly([x, y - r, x + r * 0.78, y, x, y + r, x - r * 0.78, y])
        .fill({ color: 0xffd166, alpha: 0.30 });
      g.poly([x, y - r * 1.9, x + r * 1.45, y, x, y + r * 1.9, x - r * 1.45, y])
        .stroke({ color: 0xffe9a8, width: 1.2, alpha: 0.22 });
    });

    // 중앙 표식 — 링의 중심(588)을 잡아 주는 타원
    const cy = R.centerY;
    g.ellipse(cx, cy, 64, 21).stroke({ color: 0xbfe0ff, width: 1.4, alpha: 0.16 });
    g.ellipse(cx, cy, 30, 10).fill({ color: 0xffd166, alpha: 0.05 });
    g.moveTo(cx - 82, cy).lineTo(cx - 70, cy).stroke({ color: 0xffe9a8, width: 1.4, alpha: 0.18 });
    g.moveTo(cx + 70, cy).lineTo(cx + 82, cy).stroke({ color: 0xffe9a8, width: 1.4, alpha: 0.18 });
    return g;
  }

  /* ---- 3스테이지 '그림자 성채' 전용 오버레이 (Step 9-3) -----------------
   * 1·2스테이지(성문 외곽·최전선)는 이 레이어를 끈 채 지금까지와 똑같이 보인다.
   * 성채에서는 (1) 자줏빛 암막 (2) 성채 기둥·왕좌 실루엣 (3) 바닥 봉인진
   * (4) 자줏빛 안개·부유 입자 를 얹어 한눈에 다른 구역임을 알린다.
   * 레이어 순서: 바닥(near) 위, 2.5D 링 가이드 아래 → 링·캐릭터는 그대로 읽힌다. */
  function citadelLook() {
    const c = new PIXI.Container();
    const W = 1280, H = 720;

    // (1) 암막 — 위쪽은 짙게, 발밑은 옅게 깔아 시야를 성채 안으로 모은다
    const veil = new PIXI.Graphics();
    veil.rect(0, 0, W, H).fill({ color: 0x140628, alpha: 0.34 });
    veil.rect(0, 0, W, 300).fill({ color: 0x0a0218, alpha: 0.42 });
    veil.rect(0, H - 250, W, 250).fill({ color: 0x0b0318, alpha: 0.30 });
    c.addChild(veil);

    // (2) 성채 실루엣 — 좌·우 거대 기둥과 그 사이로 이어진 성벽·첨탑
    const wall = new PIXI.Graphics();
    const rimColor = 0xb49cff;
    const stone = 0x0d041e;
    // 좌 기둥
    wall.poly([0, 0, 108, 0, 138, 96, 112, 210, 150, 318, 104, 430, 128, 720, 0, 720])
      .fill({ color: stone, alpha: 0.9 });
    wall.moveTo(108, 0).lineTo(138, 96).lineTo(112, 210).lineTo(150, 318).lineTo(104, 430).lineTo(128, 720)
      .stroke({ color: rimColor, width: 2, alpha: 0.22 });
    // 우 기둥
    wall.poly([1280, 0, 1176, 0, 1146, 104, 1178, 224, 1140, 340, 1186, 452, 1162, 720, 1280, 720])
      .fill({ color: stone, alpha: 0.9 });
    wall.moveTo(1176, 0).lineTo(1146, 104).lineTo(1178, 224).lineTo(1140, 340).lineTo(1186, 452).lineTo(1162, 720)
      .stroke({ color: rimColor, width: 2, alpha: 0.22 });
    // 성벽 — 톱니 같은 첨탑 능선. 아래 끝은 링 뒤쪽(원경 지평선 470)에 맞춰
    // 무대 바닥을 덮지 않는다 (캐릭터·판정선이 그대로 읽혀야 한다)
    const ridge = [110, 470];
    const top = (x) => 196 + Math.sin(x * 0.021) * 26 + ((x / 64) % 2 < 1 ? 0 : 34);
    for (let x = 110; x <= 1170; x += 62) ridge.push(x, top(x));
    ridge.push(1170, 470);
    wall.poly(ridge).fill({ color: 0x0a0320, alpha: 0.72 });
    // 첨탑 5개
    [[250, 96, 150], [430, 74, 120], [880, 118, 210], [1040, 86, 168], [640, 66, 108]].forEach(([x, w, h], i) => {
      const t0 = top(x + w / 2);
      wall.poly([x, t0 + 6, x + w * 0.5, t0 - h, x + w, t0 + 6])
        .fill({ color: 0x0c0322, alpha: 0.82 });
      wall.moveTo(x, t0 + 6).lineTo(x + w * 0.5, t0 - h).lineTo(x + w, t0 + 6)
        .stroke({ color: rimColor, width: 1.4, alpha: i === 2 ? 0.30 : 0.18 });
    });
    c.addChild(wall);

    // (3) 어둠의 왕좌 — 보스가 서는 자리 뒤의 아치
    const throne = new PIXI.Graphics();
    const tx = 880, ty = 470;
    throne.poly([tx - 132, ty, tx - 132, ty - 168, tx - 96, ty - 210, tx, ty - 236,
      tx + 96, ty - 210, tx + 132, ty - 168, tx + 132, ty]).fill({ color: 0x12042a, alpha: 0.78 });
    throne.moveTo(tx - 132, ty).lineTo(tx - 132, ty - 168).lineTo(tx - 96, ty - 210)
      .lineTo(tx, ty - 236).lineTo(tx + 96, ty - 210).lineTo(tx + 132, ty - 168).lineTo(tx + 132, ty)
      .stroke({ color: 0xc9a8ff, width: 2.4, alpha: 0.34 });
    throne.moveTo(tx - 96, ty).lineTo(tx - 96, ty - 158).lineTo(tx, ty - 196)
      .lineTo(tx + 96, ty - 158).lineTo(tx + 96, ty).stroke({ color: 0x8f7dff, width: 1.2, alpha: 0.20 });
    // 왕좌 앞 계단
    for (let i = 0; i < 3; i++) {
      throne.poly([tx - 168 - i * 22, ty + 6 + i * 12, tx + 168 + i * 22, ty + 6 + i * 12,
        tx + 168 + i * 22, ty + 14 + i * 12, tx - 168 - i * 22, ty + 14 + i * 12])
        .fill({ color: 0x1a0734, alpha: 0.34 - i * 0.08 });
    }
    c.addChild(throne);

    // (4) 바닥 봉인진 — 링 중심을 도는 자줏빛 마법진
    const runesC = new PIXI.Container();
    runesC.position.set(580, 588);
    const runes = new PIXI.Graphics();
    runes.ellipse(0, 0, 330, 104).stroke({ color: 0xb49cff, width: 2.2, alpha: 0.26 });
    runes.ellipse(0, 0, 240, 76).stroke({ color: 0xc9a8ff, width: 1.4, alpha: 0.18 });
    runes.ellipse(0, 0, 120, 38).stroke({ color: 0x8f7dff, width: 1.2, alpha: 0.14 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * G.TAU;
      const x = Math.cos(a) * 330, y = Math.sin(a) * 104;
      runes.poly([x, y - 9, x + 6, y, x, y + 9, x - 6, y]).fill({ color: 0xd6c4ff, alpha: 0.30 });
      const x2 = Math.cos(a + 0.26) * 240, y2 = Math.sin(a + 0.26) * 76;
      runes.moveTo(x, y).lineTo(x2, y2).stroke({ color: 0xb49cff, width: 1, alpha: 0.13 });
    }
    runesC.addChild(runes);
    c.addChild(runesC);

    // (5) 자줏빛 안개 · 부유 입자
    const fogC = new PIXI.Container();
    c.addChild(fogC);
    const fogs = [];
    for (let i = 0; i < 3; i++) {
      const s = new PIXI.Sprite(G.Assets.tex.mist);
      s.anchor.set(0.5);
      s.width = 1500 + i * 180; s.height = 300 - i * 40;
      s.x = 640 + i * 90; s.y = 520 + i * 46;
      s.alpha = 0.16 - i * 0.04;
      s.tint = i % 2 ? 0x8a5cff : 0xb49cff;
      s.blendMode = 'add';
      fogC.addChild(s);
      fogs.push({ s, ph: G.rand(G.TAU), sp: G.rand(0.13, 0.05), amp: G.rand(110, 40) });
    }
    const moteC = new PIXI.Container();
    c.addChild(moteC);
    const motes = [];
    for (let i = 0; i < 26; i++) {
      const s = new PIXI.Sprite(G.Assets.tex.soft);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      const sz = G.rand(9, 3);
      s.width = sz; s.height = sz;
      s.x = G.rand(1240, 40); s.y = G.rand(640, 60);
      s.tint = G.chance(0.6) ? 0xc9a8ff : 0x8f7dff;
      s.alpha = G.rand(0.55, 0.18);
      moteC.addChild(s);
      motes.push({ s, vy: G.rand(26, 7), vx: G.rand(10, -10), ph: G.rand(G.TAU) });
    }

    // 왕좌 발광 (보스 자리 표시)
    const throneGlow = new PIXI.Sprite(G.Assets.tex.glow);
    throneGlow.anchor.set(0.5);
    throneGlow.x = 880; throneGlow.y = 380;
    throneGlow.width = 620; throneGlow.height = 520;
    throneGlow.tint = 0x8a5cff;
    throneGlow.alpha = 0.16;
    throneGlow.blendMode = 'add';
    c.addChild(throneGlow);

    return { c, runesC, runes, fogs, motes, throneGlow };
  }

  class Scene {
    constructor(app) {
      this.app = app;
      this.root = new PIXI.Container();
      this.world = new PIXI.Container();
      this.world.pivot.set(G.W / 2, G.H / 2);
      this.world.position.set(G.W / 2, G.H / 2);
      this.root.addChild(this.world);

      this.skyLayer = new PIXI.Container();     // 하늘·성문·빛줄기
      this.farLayer = new PIXI.Container();     // 원경 안개
      this.midLayer = new PIXI.Container();     // 바닥·바닥 안개 (캐릭터 뒤)
      this.nearLayer = new PIXI.Container();    // 원근 바닥·잔해
      this.lookLayer = new PIXI.Container();    // 스테이지별 공기 (3스테이지 성채)
      this.ringLayer = new PIXI.Container();    // 2.5D 사각 링 바닥 가이드 (시차 없음)
      this.actorLayer = new PIXI.Container();   // 캐릭터 (battle.js가 채운다)
      this.fxLayer = new PIXI.Container();      // 이펙트·데미지
      this.frontLayer = new PIXI.Container();   // 전경 안개·근경 입자 (캐릭터 앞)
      this.world.addChild(this.skyLayer, this.farLayer, this.midLayer,
        this.nearLayer, this.lookLayer, this.ringLayer, this.actorLayer, this.fxLayer, this.frontLayer);
      this.actorLayer.sortableChildren = true;

      this.zoom = 1;
      this.shakeAmp = 0;
      this.shakeT = 0;
      this.shakeDur = 0;
      /* Step 10-5 — 방향 킥 · 줌 펀치 상태 (정지·로비·결과에서 resetShake() 로 0 복구) */
      this.kickX = 0;
      this.kickY = 0;
      this.kickT = 0;
      this.kickDur = 0;
      this.punchAmp = 0;
      this.punchT = 0;
      this.punchDur = 0;
      this.punchZ = 1;
      this.shakeOff = { x: 0, y: 0 };
      this.time = 0;
      this.embers = [];
      this.motes = [];
      this.focus = 0;       // 캐릭터 x 기준 시차 오프셋
      this._focusTarget = 0;
      this._build();
    }

    _build() {
      const tex = G.Assets.tex;
      this.bgW = 1672;
      this.bgH = 941;
      this.bgScale = Math.max(G.W / 1672, G.H / 941) * 1.06;

      this.bg = new PIXI.Sprite(tex.bg);
      this.bg.anchor.set(0.5);
      this.bg.scale.set(this.bgScale);
      this.bg.x = G.W / 2;
      this.bg.y = G.H / 2;
      const sky = new PIXI.Sprite(paintedSky());
      sky.width=G.W; sky.height=G.H;
      this.bg.alpha = 1;
      this.skyLayer.addChild(this.bg);
      // Extremely subtle atmospheric glaze; the original golden gate painting remains dominant.
      sky.alpha = 0.075;
      this.skyLayer.addChild(sky);
      this.farLayer.addChild(ruinLayer(0x1a1630, 0, 80));
      this.farLayer.addChild(ruinLayer(0x241d3a, 31, 48));
      this.midLayer.addChild(ruinLayer(0x29253c, 67, 14));
      this.nearLayer.addChild(floorPerspective());
      // 2.5D 사각 링 — 바닥 위에 무대 기준선을 얹는다 (시차 없음)
      this.ringG = ringFloor();
      this.ringLayer.addChild(this.ringG);
      const fore=new PIXI.Graphics();
      fore.poly([0,0,58,0,46,460,0,540]).fill({color:0x080d1d,alpha:.53});
      fore.poly([1280,0,1238,0,1244,490,1280,600]).fill({color:0x080d1d,alpha:.6});
      fore.poly([0,720,0,665,260,720]).fill({color:0x0a1020,alpha:.5});
      this.frontLayer.addChild(fore);

      // 성문 쪽 따뜻한 발광 (노을) — 호흡하듯 천천히 밝아졌다 어두워진다
      const warm = new PIXI.Sprite(tex.glow);
      warm.anchor.set(0.5);
      warm.x = 880; warm.y = 350;
      warm.width = 1000; warm.height = 620;
      warm.tint = 0xff9a5a;
      warm.alpha = 0.2;
      warm.blendMode = 'add';
      this.skyLayer.addChild(warm);
      this.warmGlow = warm;

      // 성문 빛줄기 (God rays) — 성문 안쪽에서 바닥으로 내려오는 빛
      this.beams = new PIXI.Container();
      this.beamList = [];
      const beamCfgs = [
        { x: 760, y: -60, w: 300, h: 760, rot: 0.20, a: 0.20, sp: 0.55, ph: 0.0 },
        { x: 900, y: -80, w: 210, h: 800, rot: 0.10, a: 0.16, sp: 0.42, ph: 1.7 },
        { x: 1006, y: -60, w: 170, h: 720, rot: 0.02, a: 0.12, sp: 0.63, ph: 3.1 },
        { x: 1128, y: -40, w: 240, h: 700, rot: -0.12, a: 0.14, sp: 0.37, ph: 4.4 },
      ];
      beamCfgs.forEach((c) => {
        const s = new PIXI.Sprite(tex.beam);
        s.anchor.set(0.5, 0);
        s.x = c.x; s.y = c.y;
        s.width = c.w; s.height = c.h;
        s.rotation = c.rot;
        s.blendMode = 'add';
        s.alpha = c.a;
        s.tint = 0xffe0b8;
        this.beams.addChild(s);
        this.beamList.push({ s, cfg: c });
      });
      this.skyLayer.addChild(this.beams);

      // 빛줄기 속으로 내려오는 먼지 (원경 입자)
      for (let i = 0; i < 26; i++) {
        const s = new PIXI.Sprite(tex.soft);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = G.chance(0.6) ? 0xffd9a8 : 0xbfe0ff;
        const size = G.rand(6, 2);
        s.width = size; s.height = size;
        s.x = G.rand(1180, 640);
        s.y = G.rand(620, 40);
        s.alpha = G.rand(0.5, 0.15);
        const m = { s, vy: G.rand(26, 6), vx: G.rand(10, -10), wob: G.rand(G.TAU), size };
        this.motes.push(m);
        this.skyLayer.addChild(s);
      }

      // 원경 안개
      this.fogA = new PIXI.Sprite(tex.fog);
      this.fogA.anchor.set(0.5);
      this.fogA.width = 1900; this.fogA.height = 520;
      this.fogA.x = 640; this.fogA.y = 520;
      this.fogA.alpha = 0.22;
      this.fogA.tint = 0x9fb6e8;
      this.farLayer.addChild(this.fogA);

      // 지면 어둡게 + 접지감
      const groundGrad = gradTexture(8, 300, [
        [0, 'rgba(4,8,18,0)'],
        [0.45, 'rgba(4,8,18,0.30)'],
        [0.75, 'rgba(4,8,18,0.62)'],
        [1, 'rgba(3,6,14,0.88)'],
      ]);
      this.ground = new PIXI.Sprite(groundGrad);
      this.ground.width = G.W; this.ground.height = 340;
      this.ground.x = 0; this.ground.y = G.H - 340;
      this.midLayer.addChild(this.ground);

      // 전투 영역 바닥 은은한 빛 (캐릭터가 서는 자리를 밝혀 배경과 붙인다)
      const floorGlow = new PIXI.Sprite(tex.glow);
      floorGlow.anchor.set(0.5);
      floorGlow.x = 700; floorGlow.y = 612;
      floorGlow.width = 1200; floorGlow.height = 260;
      floorGlow.tint = 0x5a86d8;
      floorGlow.alpha = 0.16;
      floorGlow.blendMode = 'add';
      this.midLayer.addChild(floorGlow);
      this.floorGlow = floorGlow;

      // 바닥 반사광 (수평 띠)
      const sheen = gradTexture(8, 120, [
        [0, 'rgba(120,170,255,0)'],
        [0.42, 'rgba(130,180,255,0.16)'],
        [0.62, 'rgba(160,200,255,0.08)'],
        [1, 'rgba(120,170,255,0)'],
      ]);
      this.sheen = new PIXI.Sprite(sheen);
      this.sheen.width = G.W; this.sheen.height = 120;
      this.sheen.x = 0; this.sheen.y = 560;
      this.sheen.blendMode = 'add';
      this.sheen.alpha = 0.5;
      this.midLayer.addChild(this.sheen);

      // 바닥 안개 (캐릭터 발등 높이) — 캐릭터가 바닥에 '잠기는' 느낌
      this.floorMist = [];
      for (let i = 0; i < 3; i++) {
        const s = new PIXI.Sprite(tex.mist);
        s.anchor.set(0.5);
        s.width = 1500 + i * 220;
        s.height = 260 - i * 40;
        s.x = 620 + i * 60;
        s.y = 610 + i * 26;
        s.alpha = 0.20 - i * 0.045;
        s.tint = i % 2 ? 0x9fb6e8 : 0xbfd4ff;
        this.midLayer.addChild(s);
        this.floorMist.push({ s, ph: G.rand(G.TAU), sp: G.rand(0.10, 0.03), amp: G.rand(70, 20) });
      }

      // 전경 안개 (캐릭터 앞) — 깊이 분리
      this.frontMist = [];
      for (let i = 0; i < 2; i++) {
        const s = new PIXI.Sprite(tex.mist);
        s.anchor.set(0.5);
        s.width = 1700; s.height = 320 - i * 40;
        s.x = 640; s.y = 700 + i * 10;
        s.alpha = 0.13 - i * 0.04;
        s.tint = 0x8fa8d8;
        this.frontLayer.addChild(s);
        this.frontMist.push({ s, ph: G.rand(G.TAU), sp: G.rand(0.16, 0.05) });
      }

      // 근경 부유 입자 (캐릭터 앞을 지나가는 큰 먼지)
      for (let i = 0; i < 10; i++) {
        const s = new PIXI.Sprite(tex.soft);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = 0xa8c8ff;
        const size = G.rand(26, 10);
        s.width = size; s.height = size;
        s.x = G.rand(1300, 0);
        s.y = G.rand(700, 380);
        s.alpha = G.rand(0.16, 0.05);
        this.motes.push({ s, vy: G.rand(-6, -22), vx: G.rand(18, -6), wob: G.rand(G.TAU), size, fore: true });
        this.frontLayer.addChild(s);
      }

      // 불티
      for (let i = 0; i < 40; i++) this._makeEmber(true);

      // 스테이지별 공기 — 3스테이지(그림자 성채) 전용. 기본은 꺼 둔다.
      const look = citadelLook();
      this.citadelC = look.c;
      this.citadelC.visible = false;
      this.lookRunes = look.runes;
      this.lookRunesC = look.runesC;
      this.lookFogs = look.fogs;
      this.lookMotes = look.motes;
      this.lookThroneGlow = look.throneGlow;
      this.lookLayer.addChild(this.citadelC);
      this.stageLook = 'gate';
      this.warmBase = 0.16;
    }

    /* ---- 스테이지별 공기 적용 (Step 9-3) ----
     * 1·2스테이지는 지금까지의 색 그대로. 3스테이지 '그림자 성채'만
     * 배경 tint·성문 발광·바닥 반사광·링 가이드·안개를 자줏빛으로 식힌다. */
    applyStageLook(stage) {
      const key = (stage && (stage.look || stage.key)) || 'gate';
      this.stageLook = key;
      const cit = key === 'citadel';
      if (this.bg) this.bg.tint = (stage && stage.bgTint != null) ? stage.bgTint : 0xffffff;
      if (this.citadelC) this.citadelC.visible = cit;
      if (this.warmGlow) {
        this.warmGlow.tint = cit ? 0x8a5cff : 0xff9a5a;
        this.warmBase = cit ? 0.22 : 0.16;
      }
      if (this.floorGlow) {
        this.floorGlow.tint = cit ? 0x7d5cff : 0x5a86d8;
        this.floorGlow.alpha = cit ? 0.20 : 0.16;
      }
      if (this.beamList) this.beamList.forEach((b) => { b.s.tint = cit ? 0xb49cff : 0xffe0b8; });
      if (this.sheen) this.sheen.tint = cit ? 0xb9a6ff : 0xffffff;
      if (this.ringG) this.ringG.tint = cit ? 0xd6c4ff : 0xffffff;
      if (this.fogA) this.fogA.tint = cit ? 0xa88cff : 0x9fb6e8;
      return key;
    }

    _makeEmber(initial = false) {
      const s = new PIXI.Sprite(G.Assets.tex.soft);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      const warm = G.chance(0.65);
      s.tint = warm ? (G.chance(0.5) ? 0xffb066 : 0xff7a3c) : 0x86c8ff;
      const size = G.rand(10, 3);
      s.width = size; s.height = size;
      s.x = G.rand(1300, -20);
      s.y = initial ? G.rand(680, 120) : G.rand(720, 620);
      const ember = {
        s,
        vx: G.rand(22, -14),
        vy: G.rand(-30, -78),
        life: G.rand(6, 3),
        t: initial ? G.rand(3, 0) : 0,
        baseA: G.rand(0.85, 0.32),
        wob: G.rand(G.TAU),
        size,
      };
      this.embers.push(ember);
      this.fxLayer.addChild(s);
    }

    /* ----------------------------------------------------------------
       카메라 흔들림 (Step 4-1 → Step 10-5 강화)
         shake(진폭px, 시간초, { dirX, dirY })
       · 랜덤 진동은 기존 그대로 두고, dirX/dirY 를 주면 그 방향으로 한 번 크게
         밀렸다가 감쇠 코사인으로 튕기며 돌아오는 "방향 킥"을 함께 건다.
       · 흔들림은 배경이 덮는 여유(coverPad) 안으로 클램프해 가장자리 검은 빈틈이
         생기지 않는다. 세로 화면에서는 보이는 카메라 창의 여백이 그 한계가 된다.
       · 시간이 끝나면 진폭·킥을 정확히 0 으로 되돌려 잔류 흔들림이 남지 않는다. */
    shake(amp, dur = 0.25, opts = null) {
      const o = opts || {};
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeT = Math.max(this.shakeT, dur);
      this.shakeDur = Math.max(this.shakeDur || 0, dur);
      if (o.dirX || o.dirY) {
        const kDur = Math.max(0.14, dur * 0.9);
        this.kickX = (o.dirX || 0) * amp * G.SHAKE.dir;
        this.kickY = (o.dirY || 0) * amp * G.SHAKE.dirY;
        this.kickT = kDur;
        this.kickDur = kDur;
      }
    }

    /* 줌 펀치 (Step 10-5) — 임팩트 순간 화면이 살짝 확대됐다가 곧바로 돌아온다.
       zoomTo() 와 별개로 곱해지므로 큰 연출(궁극기·보스 킬)의 줌을 끊지 않는다.
       1 미만으로는 내려가지 않아 축소로 인한 빈틈이 생기지 않는다. */
    punch(amp = 0.03, dur = 0.16) {
      const a = Math.min(Math.abs(amp), G.SHAKE.maxPunch);
      if (!(a > 0)) return;
      this.punchAmp = Math.max(this.punchAmp, a);
      this.punchT = Math.max(this.punchT, dur);
      this.punchDur = Math.max(this.punchDur || 0, dur);
    }

    /* 카메라가 움직인 뒤 흔들림을 새 여백에 맞춰 다시 잠근다 (Step 10-5).
       세로 추적 카메라는 흔들림 이후에 위치가 바뀌므로, 그대로 두면 창이 월드 밖으로
       몇 px 나가 빈틈이 생길 수 있다. 매 프레임 카메라 적용 끝에서 한 번 더 잠근다. */
    reclampShake() {
      const o = this.shakeOff;
      if (!o || (!o.x && !o.y)) return;
      const lim = this._shakeLimit();
      const x = G.clamp(o.x, -lim.x, lim.x);
      const y = G.clamp(o.y, -lim.y, lim.y);
      if (x === o.x && y === o.y) return;
      o.x = x; o.y = y;
      const c = this._camCenter();
      this.world.pivot.set(c.x, c.y);
      this.world.position.set(c.x + x, c.y + y);
    }

    /* 흔들림·펀치를 즉시 0 으로 되돌린다 — 정지·로비·결과·재도전 */
    resetShake() {
      this.shakeAmp = 0; this.shakeT = 0; this.shakeDur = 0;
      this.kickX = 0; this.kickY = 0; this.kickT = 0; this.kickDur = 0;
      this.punchAmp = 0; this.punchT = 0; this.punchDur = 0; this.punchZ = 1;
      this.shakeOff.x = 0; this.shakeOff.y = 0;
      const c = this._camCenter();
      this.world.pivot.set(c.x, c.y);
      this.world.position.set(c.x, c.y);
      this.world.scale.set(this.zoom);
    }

    /* 지금 화면이 보는 월드 창의 중심 — 세로 추적 카메라면 그 창, 가로면 월드 중심.
       줌 펀치·줌 연출을 이 점을 축으로 걸어야 세로에서도 히어로가 화면 밖으로 밀리지 않는다. */
    _camCenter() {
      const c = G.VIEW && G.VIEW.cam;
      if (c && c.active) return { x: c.x + c.visW / 2, y: c.y + c.visH / 2 };
      return { x: G.W / 2, y: G.H / 2 };
    }

    /* 흔들림이 드러내도 되는 최대 이동량(월드 px) — 이만큼만 움직여야 빈틈이 없다 */
    _shakeLimit() {
      const c = G.VIEW && G.VIEW.cam;
      if (c && c.active) {
        const x = Math.min(c.x, Math.max(0, G.W - c.x - c.visW));
        const y = Math.min(c.y, Math.max(0, G.H - c.y - c.visH));
        return { x: Math.max(0, x), y: Math.max(0, y) };
      }
      const pad = (G.SHAKE && G.SHAKE.coverPad) || 2;
      const bx = this.bg ? (this.bg.width - G.W) / 2 : 38;      // Sprite.width 는 배율이 곱해진 화면 크기다
      const by = this.bg ? (this.bg.height - G.H) / 2 : 21;
      return { x: Math.max(0, bx - pad), y: Math.max(0, by - pad) };
    }

    zoomTo(z, dur) {
      this._zoomFrom = this.zoom;
      this._zoomTo = z;
      this._zoomT = 0;
      this._zoomDur = dur;
    }

    /* 카메라 초점 (캐릭터 x) — 레이어별 시차 */
    setFocus(x) {
      this._focusTarget = G.clamp((x - 460) * 0.5, -180, 180);
    }

    update(dt) {
      this.time += dt;
      const t = this.time;

      const shakeFade = this.shakeT > 0 ? Math.pow(G.clamp(this.shakeT / Math.max(0.001, this.shakeDur), 0, 1), 1.7) : 0;
      let shakeX = this.shakeT > 0 ? G.rand(1, -1) * this.shakeAmp * shakeFade : 0;
      let shakeY = this.shakeT > 0 ? G.rand(1, -1) * this.shakeAmp * shakeFade * G.SHAKE.yFactor : 0;
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        if (this.shakeT <= 0) { this.shakeT = 0; this.shakeAmp = 0; this.shakeDur = 0; }
      }
      /* 방향 킥 — 맞은 쪽으로 밀렸다가 감쇠 코사인으로 튕겨 돌아온다 */
      if (this.kickT > 0) {
        const kp = 1 - this.kickT / Math.max(0.001, this.kickDur);
        const damp = Math.exp(-G.SHAKE.kickDecay * kp);
        const osc = Math.cos(kp * Math.PI * G.SHAKE.kickFreq);
        shakeX += this.kickX * damp * osc;
        shakeY += this.kickY * damp * osc;
        this.kickT -= dt;
        if (this.kickT <= 0) { this.kickT = 0; this.kickX = 0; this.kickY = 0; this.kickDur = 0; }
      }
      if (shakeX || shakeY) {
        const lim = this._shakeLimit();
        shakeX = G.clamp(shakeX, -lim.x, lim.x);
        shakeY = G.clamp(shakeY, -lim.y, lim.y);
      }
      this.shakeOff.x = shakeX;
      this.shakeOff.y = shakeY;

      /* 줌 펀치 — 0프레임에 최대로 확대됐다가 2차 곡선으로 돌아온다 (1 미만 없음) */
      let punchZ = 1;
      if (this.punchT > 0) {
        const pp = 1 - this.punchT / Math.max(0.001, this.punchDur);
        punchZ = 1 + this.punchAmp * (1 - pp) * (1 - pp);
        this.punchT -= dt;
        if (this.punchT <= 0) { this.punchT = 0; this.punchAmp = 0; this.punchDur = 0; punchZ = 1; }
      }
      this.punchZ = punchZ;

      if (this._zoomDur) {
        this._zoomT += dt;
        const p = G.clamp(this._zoomT / this._zoomDur, 0, 1);
        this.zoom = G.lerp(this._zoomFrom, this._zoomTo, G.easeOutCubic(p));
        if (p >= 1) this._zoomDur = 0;
      }

      this.focus = G.lerp(this.focus, this._focusTarget, 1 - Math.pow(0.001, dt));

      /* 카메라: 줌(연출×펀치) + 흔들림 — 축은 세로 추적 카메라의 보이는 창 중심 */
      const center = this._camCenter();
      this.world.pivot.set(center.x, center.y);
      this.world.scale.set(this.zoom * punchZ);
      this.world.position.set(center.x + shakeX, center.y + shakeY);

      // 레이어 시차
      this.skyLayer.x = -this.focus * 0.05 + Math.sin(t * 0.16) * 4;
      this.farLayer.x = -this.focus * 0.18 + Math.sin(t * 0.11) * 6;
      this.midLayer.x = -this.focus * 0.4;
      this.nearLayer.x = -this.focus * 0.7;
      this.frontLayer.x = -this.focus * 1.3;
      this.skyLayer.y = Math.sin(t * 0.11) * 2;
      this.farLayer.y = Math.sin(t * 0.09 + 1) * 3;

      // 하늘 호흡
      this.bg.scale.set(this.bgScale * (1 + Math.sin(t * 0.21) * 0.004));
      this.warmGlow.alpha = (this.warmBase == null ? 0.16 : this.warmBase) + Math.sin(t * 0.7) * 0.035;
      this.floorGlow.alpha = 0.14 + Math.sin(t * 0.9 + 1) * 0.02;
      this.sheen.alpha = 0.42 + Math.sin(t * 0.6) * 0.1;

      // 빛줄기 — 천천히 흔들리고 숨쉬듯 밝아진다
      for (let i = 0; i < this.beamList.length; i++) {
        const b = this.beamList[i];
        const c = b.cfg;
        b.s.rotation = c.rot + Math.sin(t * 0.12 * c.sp + c.ph) * 0.035;
        b.s.alpha = c.a * (0.72 + 0.34 * (0.5 + 0.5 * Math.sin(t * 0.5 * c.sp + c.ph)));
        b.s.width = c.w * (1 + 0.04 * Math.sin(t * 0.3 + c.ph));
      }
      this.beams.alpha = 0.9 + Math.sin(t * 0.5) * 0.1;

      // 원경 안개 드리프트
      this.fogA.x = 640 + Math.sin(t * 0.12) * 90;
      this.fogA.y = 520 + Math.sin(t * 0.23) * 8;
      this.fogA.alpha = 0.20 + Math.sin(t * 0.3) * 0.03;

      // 바닥 안개 / 전경 안개 흐름
      this.floorMist.forEach((m, i) => {
        m.s.x = 620 + i * 60 + Math.sin(t * m.sp + m.ph) * m.amp;
        m.s.alpha = (0.19 - i * 0.045) * (0.75 + 0.25 * Math.sin(t * 0.4 + m.ph));
      });
      this.frontMist.forEach((m, i) => {
        m.s.x = 640 + Math.sin(t * m.sp + m.ph) * 120;
        m.s.alpha = (0.12 - i * 0.04) * (0.8 + 0.2 * Math.sin(t * 0.35 + m.ph));
      });

      // 입자
      for (let i = this.motes.length - 1; i >= 0; i--) {
        const m = this.motes[i];
        m.s.y += m.vy * dt;
        m.s.x += (m.vx + Math.sin(t * 0.8 + m.wob) * 8) * dt;
        if (m.s.y > 760 || m.s.y < -30) {
          m.s.y = m.vy < 0 ? 760 : -20;
          m.s.x = G.rand(1300, 400);
        }
        if (m.s.x < -40) m.s.x = 1320;
        if (m.s.x > 1320) m.s.x = -40;
      }

      // 3스테이지 성채 — 봉인진이 천천히 돌고, 자줏빛 안개·입자가 흐른다
      if (this.citadelC && this.citadelC.visible) {
        if (this.lookRunesC) {
          this.lookRunesC.rotation = Math.sin(t * 0.10) * 0.04;
          if (this.lookRunes) this.lookRunes.alpha = 0.72 + Math.sin(t * 0.9) * 0.2;
        }
        this.lookFogs.forEach((f, i) => {
          f.s.x = 640 + i * 90 + Math.sin(t * f.sp + f.ph) * f.amp;
          f.s.alpha = (0.15 - i * 0.038) * (0.78 + 0.22 * Math.sin(t * 0.45 + f.ph));
        });
        this.lookMotes.forEach((m) => {
          m.s.y -= m.vy * dt;
          m.s.x += (m.vx + Math.sin(t * 0.9 + m.ph) * 10) * dt;
          if (m.s.y < 20) { m.s.y = 660; m.s.x = G.rand(1240, 40); }
          if (m.s.x < 20) m.s.x = 1250;
          if (m.s.x > 1250) m.s.x = 20;
        });
        if (this.lookThroneGlow) this.lookThroneGlow.alpha = 0.14 + Math.sin(t * 0.8 + 1) * 0.045;
      }

      // 불티
      for (let i = this.embers.length - 1; i >= 0; i--) {
        const e = this.embers[i];
        e.t += dt;
        e.s.x += (e.vx + Math.sin(t * 1.4 + e.wob) * 16) * dt;
        e.s.y += e.vy * dt;
        if (e.t > e.life || e.s.y < 60) {
          e.s.destroy();
          this.embers.splice(i, 1);
          this._makeEmber(false);
          continue;
        }
        const p = e.t / e.life;
        e.s.alpha = e.baseA * Math.sin(Math.PI * G.clamp(p, 0, 1)) * (0.7 + 0.3 * Math.sin(t * 6 + e.wob));
      }
    }
  }

  G.Scene = Scene;
})();
