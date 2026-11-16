/* scene.js : 배경(황혼 폐허) 패럴랙스, 안개, 불티, 빛줄기, 카메라 셰이크 */
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
      this.bgLayer = new PIXI.Container();
      this.midLayer = new PIXI.Container();
      this.fxLayer = new PIXI.Container();
      this.root.addChild(this.bgLayer, this.midLayer, this.fxLayer);

      this.zoom = 1;
      this.shakeAmp = 0;
      this.shakeT = 0;
      this.time = 0;
      this.embers = [];
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
      this.bgLayer.addChild(this.bg);

      // 게이트 쪽 따뜻한 발광 (노을)
      const warm = new PIXI.Sprite(tex.glow);
      warm.anchor.set(0.5);
      warm.x = 880; warm.y = 360;
      warm.width = 900; warm.height = 560;
      warm.tint = 0xff9a5a;
      warm.alpha = 0.2;
      warm.blendMode = 'add';
      this.bgLayer.addChild(warm);
      this.warmGlow = warm;

      // 원경 안개
      this.fogA = new PIXI.Sprite(tex.fog);
      this.fogA.anchor.set(0.5);
      this.fogA.width = 1900; this.fogA.height = 560;
      this.fogA.x = 640; this.fogA.y = 560;
      this.fogA.alpha = 0.24;
      this.fogA.tint = 0x9fb6e8;
      this.midLayer.addChild(this.fogA);

      this.fogB = new PIXI.Sprite(tex.fog);
      this.fogB.anchor.set(0.5);
      this.fogB.width = 2300; this.fogB.height = 420;
      this.fogB.x = 600; this.fogB.y = 660;
      this.fogB.alpha = 0.22;
      this.fogB.tint = 0x7f8fc4;
      this.midLayer.addChild(this.fogB);

      // 빛줄기
      this.beams = new PIXI.Container();
      const beamCfgs = [
        { x: 470, y: 60, w: 250, h: 640, rot: 0.16, a: 0.13 },
        { x: 690, y: 40, w: 160, h: 600, rot: 0.06, a: 0.1 },
        { x: 1050, y: 40, w: 210, h: 620, rot: -0.12, a: 0.09 },
      ];
      beamCfgs.forEach((c) => {
        const s = new PIXI.Sprite(tex.streak);
        s.anchor.set(0.5, 0);
        s.x = c.x; s.y = c.y;
        s.width = c.w; s.height = c.h;
        s.rotation = c.rot;
        s.blendMode = 'add';
        s.alpha = c.a;
        s.tint = 0xbfd8ff;
        this.beams.addChild(s);
      });
      this.bgLayer.addChild(this.beams);

      // 지면 어둡게 + 접지감
      const groundGrad = gradTexture(8, 260, [
        [0, 'rgba(4,8,18,0)'],
        [0.55, 'rgba(4,8,18,0.42)'],
        [1, 'rgba(3,6,14,0.82)'],
      ]);
      this.ground = new PIXI.Sprite(groundGrad);
      this.ground.width = G.W; this.ground.height = 300;
      this.ground.x = 0; this.ground.y = G.H - 300;
      this.midLayer.addChild(this.ground);

      // 전투 영역 바닥 은은한 빛
      const floorGlow = new PIXI.Sprite(tex.glow);
      floorGlow.anchor.set(0.5);
      floorGlow.x = 700; floorGlow.y = 620;
      floorGlow.width = 1150; floorGlow.height = 240;
      floorGlow.tint = 0x4a74c8;
      floorGlow.alpha = 0.14;
      floorGlow.blendMode = 'add';
      this.midLayer.addChild(floorGlow);

      // 불티
      for (let i = 0; i < 44; i++) this._makeEmber(true);
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

    update(dt) {
      this.time += dt;
      const t = this.time;

      // 배경 미세 드리프트 + 원근
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

      this.bg.x = G.W / 2 + Math.sin(t * 0.16) * 10 + shakeX * 0.6;
      this.bg.y = G.H / 2 + Math.sin(t * 0.11) * 5 + shakeY * 0.6;
      this.bg.scale.set(this.bgScale * (1 + Math.sin(t * 0.21) * 0.004) * this.zoom);

      this.warmGlow.alpha = 0.13 + Math.sin(t * 0.7) * 0.03;
      this.beams.alpha = 0.75 + Math.sin(t * 0.5) * 0.16;

      this.fogA.x = 640 + Math.sin(t * 0.12) * 90;
      this.fogA.y = 560 + Math.sin(t * 0.23) * 10;
      this.fogB.x = 600 + Math.sin(t * 0.09 + 2) * 140;

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

      this.midLayer.x = shakeX * 0.35;
      this.midLayer.y = shakeY * 0.35;
      this.bgLayer.x = shakeX * 0.5;
      this.bgLayer.y = shakeY * 0.5;
      this.fxLayer.x = shakeX;
      this.fxLayer.y = shakeY;
    }
  }

  G.Scene = Scene;
})();
