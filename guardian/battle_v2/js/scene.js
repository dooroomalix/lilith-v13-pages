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
      this.actorLayer = new PIXI.Container();   // 캐릭터 (battle.js가 채운다)
      this.fxLayer = new PIXI.Container();      // 이펙트·데미지
      this.frontLayer = new PIXI.Container();   // 전경 안개·근경 입자 (캐릭터 앞)
      this.world.addChild(this.skyLayer, this.farLayer, this.midLayer,
        this.actorLayer, this.fxLayer, this.frontLayer);
      this.actorLayer.sortableChildren = true;

      this.zoom = 1;
      this.shakeAmp = 0;
      this.shakeT = 0;
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
      this.bgScale = Math.max(G.W / this.bgW, G.H / this.bgH) * 1.06;

      this.bg = new PIXI.Sprite(tex.bg);
      this.bg.anchor.set(0.5);
      this.bg.scale.set(this.bgScale);
      this.bg.x = G.W / 2;
      this.bg.y = G.H / 2;
      this.skyLayer.addChild(this.bg);

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
      this.shakeDur = dur;
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

      const shakeX = this.shakeT > 0 ? G.rand(1, -1) * this.shakeAmp : 0;
      const shakeY = this.shakeT > 0 ? G.rand(1, -1) * this.shakeAmp * 0.7 : 0;
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        if (this.shakeT <= 0) this.shakeAmp = 0;
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
      this.skyLayer.x = -this.focus * 0.10 + Math.sin(t * 0.16) * 4;
      this.farLayer.x = -this.focus * 0.26 + Math.sin(t * 0.11) * 6;
      this.midLayer.x = -this.focus * 0.45;
      this.frontLayer.x = -this.focus * 0.85;
      this.skyLayer.y = Math.sin(t * 0.11) * 2;
      this.farLayer.y = Math.sin(t * 0.09 + 1) * 3;

      // 하늘 호흡
      this.bg.scale.set(this.bgScale * (1 + Math.sin(t * 0.21) * 0.004));
      this.warmGlow.alpha = 0.16 + Math.sin(t * 0.7) * 0.035;
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
    }
  }

  G.Scene = Scene;
})();
