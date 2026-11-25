/* scene.js : 배경(황혼 폐허) 입체 레이어 — 원경 안개 · 성문 빛줄기 · 바닥 안개 · 전경 안개 · 부유 입자 · 카메라 */
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
      this.ringLayer = new PIXI.Container();    // 2.5D 사각 링 바닥 가이드 (시차 없음)
      this.lanternLayer = new PIXI.Container(); // 외전 등불 (캐릭터 뒤·바닥 앞)
      this.actorLayer = new PIXI.Container();   // 캐릭터 (battle.js가 채운다)
      this.fxLayer = new PIXI.Container();      // 이펙트·데미지
      this.frontLayer = new PIXI.Container();   // 전경 안개·근경 입자 (캐릭터 앞)
      this.world.addChild(this.skyLayer, this.farLayer, this.midLayer,
        this.nearLayer, this.ringLayer, this.lanternLayer, this.actorLayer, this.fxLayer, this.frontLayer);
      this.actorLayer.sortableChildren = true;
      this.lanternLayer.sortableChildren = true;

      this.zoom = 1;
      this.shakeAmp = 0;
      this.shakeT = 0;
      this.time = 0;
      this.embers = [];
      this.motes = [];
      this.focus = 0;       // 캐릭터 x 기준 시차 오프셋
      this._focusTarget = 0;
      this._build();
      // 2.5D 사각 링 — 어느 배경(광장/성문)이든 같은 무대 기준선을 얹는다
      this.ringG = ringFloor();
      this.ringLayer.addChild(this.ringG);
    }

    _build() {
      if (G.Xmas && G.Xmas.ON) { this._buildXmas(); return; }
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
    }

    /* ================= 외전: 눈 내리는 성문 광장 ================= */
    _buildXmas() {
      const tex = G.Assets.tex;
      this.bgW = 1672;
      this.bgH = 941;
      this.bgScale = Math.max(G.W / 1672, G.H / 941) * 1.06;

      // 겨울 성문 광장 원화 (트리·선물·푸른/노란 등불 포함)
      this.bg = new PIXI.Sprite(tex.bgXmas || tex.bg);
      this.bg.anchor.set(0.5);
      this.bg.scale.set(this.bgScale);
      this.bg.x = G.W / 2;
      this.bg.y = G.H / 2;
      this.skyLayer.addChild(this.bg);

      // 색보정: 위는 남색 밤, 아래는 눈빛을 살짝 눌러 캐릭터가 떠 보이게
      const grade = gradTexture(8, 720, [
        [0, 'rgba(10,24,56,0.26)'],
        [0.42, 'rgba(9,20,44,0.06)'],
        [0.70, 'rgba(7,14,32,0.10)'],
        [1, 'rgba(3,6,14,0.40)'],
      ]);
      this.grade = new PIXI.Sprite(grade);
      this.grade.width = G.W; this.grade.height = G.H;
      this.skyLayer.addChild(this.grade);

      // 성문 안쪽의 푸른 빛
      this.coolGlow = new PIXI.Sprite(tex.glow);
      this.coolGlow.anchor.set(0.5);
      this.coolGlow.x = 830; this.coolGlow.y = 320;
      this.coolGlow.width = 1040; this.coolGlow.height = 660;
      this.coolGlow.tint = 0x6fa8ff;
      this.coolGlow.alpha = 0.20;
      this.coolGlow.blendMode = 'add';
      this.skyLayer.addChild(this.coolGlow);

      // 크리스마스트리의 호박색 온기
      this.warmGlow = new PIXI.Sprite(tex.glow);
      this.warmGlow.anchor.set(0.5);
      this.warmGlow.x = 208; this.warmGlow.y = 330;
      this.warmGlow.width = 820; this.warmGlow.height = 600;
      this.warmGlow.tint = 0xffb45a;
      this.warmGlow.alpha = 0.20;
      this.warmGlow.blendMode = 'add';
      this.skyLayer.addChild(this.warmGlow);

      // 등불·트리 전구의 명멸 (원화의 빛 자리에 얹는다)
      this.lights = [];
      const lampSpots = [
        [232, 138, 0xffd27a, 24], [150, 330, 0xffc46a, 13], [300, 420, 0xffb45a, 12],
        [1100, 282, 0x7fc4ff, 13], [1262, 372, 0xffc46a, 15], [952, 250, 0x8fd0ff, 11],
        [640, 246, 0x9fd8ff, 10], [506, 330, 0x8fd0ff, 8],
      ];
      for (const [x, y, col, r] of lampSpots) {
        const s = new PIXI.Sprite(tex.glow);
        s.anchor.set(0.5);
        s.x = x; s.y = y;
        s.width = r * 6; s.height = r * 6;
        s.tint = col;
        s.blendMode = 'add';
        s.alpha = 0.26;
        this.skyLayer.addChild(s);
        this.lights.push({ s, ph: G.rand(G.TAU), sp: G.rand(1.4, 0.55), base: 0.16 + r * 0.008 });
      }

      // 성문에서 내려오는 창백한 빛줄기
      this.beams = new PIXI.Container();
      this.beamList = [];
      const beamCfgs = [
        { x: 800, y: -60, w: 300, h: 760, rot: 0.18, a: 0.13, sp: 0.52, ph: 0.0 },
        { x: 930, y: -80, w: 230, h: 800, rot: 0.08, a: 0.10, sp: 0.44, ph: 1.7 },
        { x: 1046, y: -60, w: 190, h: 720, rot: -0.02, a: 0.09, sp: 0.61, ph: 3.1 },
      ];
      beamCfgs.forEach((c) => {
        const s = new PIXI.Sprite(tex.beam);
        s.anchor.set(0.5, 0);
        s.x = c.x; s.y = c.y;
        s.width = c.w; s.height = c.h;
        s.rotation = c.rot;
        s.blendMode = 'add';
        s.alpha = c.a;
        s.tint = 0xcfe4ff;
        this.beams.addChild(s);
        this.beamList.push({ s, cfg: c });
      });
      this.skyLayer.addChild(this.beams);

      for (let i = 0; i < 20; i++) {
        const s = new PIXI.Sprite(tex.soft);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = G.chance(0.6) ? 0xdfefff : 0x9fc8ff;
        const size = G.rand(6, 2);
        s.width = size; s.height = size;
        s.x = G.rand(1260, 20);
        s.y = G.rand(620, 20);
        s.alpha = G.rand(0.45, 0.12);
        this.motes.push({ s, vy: G.rand(24, 6), vx: G.rand(8, -8), wob: G.rand(G.TAU), size });
        this.skyLayer.addChild(s);
      }

      // 원경 안개 (푸른 눈보라 haze)
      this.fogA = new PIXI.Sprite(tex.fog);
      this.fogA.anchor.set(0.5);
      this.fogA.width = 1900; this.fogA.height = 520;
      this.fogA.x = 640; this.fogA.y = 520;
      this.fogA.alpha = 0.24;
      this.fogA.tint = 0xa8c8f0;
      this.farLayer.addChild(this.fogA);

      const groundGrad = gradTexture(8, 300, [
        [0, 'rgba(6,12,26,0)'],
        [0.45, 'rgba(6,12,26,0.16)'],
        [0.75, 'rgba(5,10,22,0.36)'],
        [1, 'rgba(3,7,16,0.60)'],
      ]);
      this.ground = new PIXI.Sprite(groundGrad);
      this.ground.width = G.W; this.ground.height = 340;
      this.ground.x = 0; this.ground.y = G.H - 340;
      this.midLayer.addChild(this.ground);

      const floorGlow = new PIXI.Sprite(tex.glow);
      floorGlow.anchor.set(0.5);
      floorGlow.x = 660; floorGlow.y = 618;
      floorGlow.width = 1240; floorGlow.height = 250;
      floorGlow.tint = 0x8fc0ff;
      floorGlow.alpha = 0.15;
      floorGlow.blendMode = 'add';
      this.midLayer.addChild(floorGlow);
      this.floorGlow = floorGlow;

      const sheen = gradTexture(8, 120, [
        [0, 'rgba(150,200,255,0)'],
        [0.42, 'rgba(160,210,255,0.14)'],
        [0.62, 'rgba(200,230,255,0.07)'],
        [1, 'rgba(150,200,255,0)'],
      ]);
      this.sheen = new PIXI.Sprite(sheen);
      this.sheen.width = G.W; this.sheen.height = 120;
      this.sheen.x = 0; this.sheen.y = 566;
      this.sheen.blendMode = 'add';
      this.sheen.alpha = 0.5;
      this.midLayer.addChild(this.sheen);

      this.floorMist = [];
      for (let i = 0; i < 3; i++) {
        const s = new PIXI.Sprite(tex.mist);
        s.anchor.set(0.5);
        s.width = 1500 + i * 220;
        s.height = 260 - i * 40;
        s.x = 620 + i * 60;
        s.y = 612 + i * 26;
        s.alpha = 0.19 - i * 0.045;
        s.tint = i % 2 ? 0xa8c6ee : 0xd6e8ff;
        this.midLayer.addChild(s);
        this.floorMist.push({ s, ph: G.rand(G.TAU), sp: G.rand(0.10, 0.03), amp: G.rand(70, 20) });
      }

      this.frontMist = [];
      for (let i = 0; i < 2; i++) {
        const s = new PIXI.Sprite(tex.mist);
        s.anchor.set(0.5);
        s.width = 1700; s.height = 320 - i * 40;
        s.x = 640; s.y = 704 + i * 10;
        s.alpha = 0.12 - i * 0.04;
        s.tint = 0xb8d2f4;
        this.frontLayer.addChild(s);
        this.frontMist.push({ s, ph: G.rand(G.TAU), sp: G.rand(0.16, 0.05) });
      }

      for (let i = 0; i < 8; i++) {
        const s = new PIXI.Sprite(tex.soft);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        s.tint = 0xd8ecff;
        const size = G.rand(24, 10);
        s.width = size; s.height = size;
        s.x = G.rand(1300, 0);
        s.y = G.rand(700, 380);
        s.alpha = G.rand(0.14, 0.04);
        this.motes.push({ s, vy: G.rand(-6, -22), vx: G.rand(16, -6), wob: G.rand(G.TAU), size, fore: true });
        this.frontLayer.addChild(s);
      }

      // 등불 불티 (축제의 온기) — 본편 불티보다 적고 금빛
      for (let i = 0; i < 14; i++) this._makeEmber(true);

      this._buildSnow();
    }

    /* 눈 파티클 3단 — 원거리 40 / 중거리 32 / 전경 16 */
    _buildSnow() {
      const tex = G.Assets.tex;
      this.snow = [];
      const layers = [
        { n: 40, size: [2, 4], vy: [18, 34], a: [0.20, 0.40], sway: [6, 16], to: this.skyLayer, par: 0.02 },
        { n: 32, size: [4, 7], vy: [38, 66], a: [0.26, 0.50], sway: [10, 26], to: this.farLayer, par: 0.12 },
        { n: 16, size: [8, 14], vy: [76, 128], a: [0.16, 0.30], sway: [18, 44], to: this.frontLayer, par: 1.0 },
      ];
      for (const L of layers) {
        for (let i = 0; i < L.n; i++) {
          const s = new PIXI.Sprite(tex.soft);
          s.anchor.set(0.5);
          s.blendMode = 'add';
          s.tint = G.chance(0.5) ? 0xffffff : 0xd6e8ff;
          const size = G.rand(L.size[1], L.size[0]);
          s.width = size; s.height = size;
          s.x = G.rand(1320, -40);
          s.y = G.rand(760, -40);
          s.alpha = G.rand(L.a[1], L.a[0]);
          L.to.addChild(s);
          this.snow.push({
            s, size, par: L.par,
            vy: G.rand(L.vy[1], L.vy[0]),
            vx: G.rand(8, -14),
            sway: G.rand(L.sway[1], L.sway[0]),
            ph: G.rand(G.TAU), sp: G.rand(1.2, 0.35),
          });
        }
      }
    }

    _updateSnow(dt, t) {
      for (const f of this.snow) {
        f.s.y += f.vy * dt;
        f.s.x += (f.vx + Math.sin(t * f.sp + f.ph) * f.sway) * dt;
        if (f.s.y > 770) { f.s.y = -30; f.s.x = G.rand(1330, -40); }
        if (f.s.x < -60) f.s.x = 1330;
        if (f.s.x > 1340) f.s.x = -60;
      }
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

    shake(amp, dur = 0.25) {
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeT = Math.max(this.shakeT, dur);
      this.shakeDur = Math.max(this.shakeDur || 0, dur);
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
      const shakeX = this.shakeT > 0 ? G.rand(1, -1) * this.shakeAmp * shakeFade : 0;
      const shakeY = this.shakeT > 0 ? G.rand(1, -1) * this.shakeAmp * shakeFade * 0.7 : 0;
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        if (this.shakeT <= 0) { this.shakeAmp = 0; this.shakeDur = 0; }
      }

      if (this._zoomDur) {
        this._zoomT += dt;
        const p = G.clamp(this._zoomT / this._zoomDur, 0, 1);
        this.zoom = G.lerp(this._zoomFrom, this._zoomTo, G.easeOutCubic(p));
        if (p >= 1) this._zoomDur = 0;
      }

      this.focus = G.lerp(this.focus, this._focusTarget, 1 - Math.pow(0.001, dt));

      // 카메라: 줌 + 흔들림 (월드 전체)
      this.world.scale.set(this.zoom);
      this.world.position.set(G.W / 2 + shakeX, G.H / 2 + shakeY);

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
      this.warmGlow.alpha = (G.Xmas && G.Xmas.ON ? 0.18 : 0.16) + Math.sin(t * 0.7) * 0.035;
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

      // 외전: 눈 + 등불 명멸
      if (this.snow) this._updateSnow(dt, t);
      if (this.lights) {
        for (const L of this.lights) {
          L.s.alpha = L.base * (0.62 + 0.38 * Math.sin(t * L.sp + L.ph));
        }
      }
      if (this.coolGlow) this.coolGlow.alpha = 0.18 + Math.sin(t * 0.42) * 0.035;
    }
  }

  G.Scene = Scene;
})();
