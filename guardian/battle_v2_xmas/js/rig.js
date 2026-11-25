/* rig.js : 2D 본(뼈대) + 가중치 메쉬 스킨 (Step 8, v5.8.0)
 *
 * Step 7 까지의 "한 장 그림을 보로노이로 잘라 파츠 컨테이너를 각자 돌리는" 방식은 폐기했다.
 * 파츠가 따로 놀고(무기가 손에서 떨어짐) 어깨·허리 이음새가 벌어지는 한계가 있었다.
 *
 * 지금 방식
 *  · body.webp — 잘라 붙이지 않은 **한 장 그대로의 몸 이미지**를 PixiJS v8 Mesh 로 그린다.
 *    이음새가 생길 수 있는 절단선 자체가 없다.
 *  · mesh.json — 뼈대(18본) 계층 + 격자 정점 + 정점별 가중치(최대 3본).
 *    정점은 인접 본에 가중치로 묶여 있어 관절에서 부드럽게 휘어진다(가중치 메쉬 변형).
 *  · 무기 — 손 본(hand bone) 소켓에 붙는 별도 스프라이트(weapon.webp). 손목과 1:1로 움직인다.
 *  · 2본 IK — 발이 땅을 파고들지 않도록 다리 체인을 목표 지점으로 푼다.
 *  · 2차 물리 — 머리(머리카락)·허리 천이 스프링으로 살짝 뒤처진다.
 *  · 방향 전환 — scaleX 즉시 반전 + 0.11초 발 디딤(stepTurn) 자세 (Step 8 2.5D 지시).
 */
(function () {
  const R = { meta: null, cache: {}, texCache: {}, ready: {} };

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;

  function texFor(path) {
    if (R.texCache[path]) return R.texCache[path];
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const t = PIXI.Texture.from(img);
        t.source.scaleMode = 'linear';
        t.source.autoGarbageCollect = false;
        resolve(t);
      };
      img.onerror = () => resolve(null);
      img.src = path + (path.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent((G && (G.ASSET_V || G.VERSION)) || 'v0');
    });
    R.texCache[path] = p;
    return p;
  }

  R.loadMeta = async function (url) {
    const res = await fetch(url + '?v=' + encodeURIComponent((G && (G.ASSET_V || G.VERSION)) || 'v0'), { cache: 'no-cache' });
    R.meta = await res.json();
    return R.meta;
  };

  /* 메쉬 정의 + 텍스처 한 벌 */
  R.load = function (key) {
    if (R.ready[key]) return R.ready[key];
    R.ready[key] = (async () => {
      const info = R.meta && R.meta.rigs && R.meta.rigs[key];
      if (!info) return null;
      const meshPath = info.mesh || info.json.replace(/rig\.json$/, 'mesh.json');
      const res = await fetch(meshPath + '?v=' + encodeURIComponent((G && (G.ASSET_V || G.VERSION)) || 'v0'));
      const def = await res.json();
      def.meta = info;
      def.name = def.name || key;
      def.bodyH = def.h;
      def.cx = def.cx;
      def.bodyTex = await texFor(def.body || info.body);
      def.weaponTex = def.weapon ? await texFor(def.weapon.file) : null;
      R.cache[key] = def;
      return def;
    })();
    return R.ready[key];
  };

  R.get = function (key) { return R.cache[key] || null; };
  R.has = function (key) { return !!(R.meta && R.meta.rigs && R.meta.rigs[key]); };

  /* ------------------------------------------------------------------ */
  /*  포즈 라이브러리 (Step 6/7 그대로 — 뼈 회전으로 옮겨 쓴다)          */
  /* ------------------------------------------------------------------ */
  const P0 = () => ({
    rootY: 0, rootRot: 0, rootSX: 1, rootSY: 1, rootX: 0,
    torso: { rot: 0, x: 0, y: 0, sx: 1, sy: 1 },
    head: { rot: 0, x: 0, y: 0 },
    shNear: 0, elNear: 0, shFar: 0, elFar: 0,
    hipNear: 0, kneeNear: 0, hipFar: 0, kneeFar: 0,
    armSwing: 0,
  });

  function pose(state, t, p, cfg) {
    const o = P0();
    const K = cfg || {};
    const br = Math.sin(t * 2.1);
    const step = K.stepPhase || 0;

    switch (state) {
      case 'idle': {
        o.torso.sy = 1 + br * 0.012;
        o.torso.rot = br * 0.012;
        o.head.rot = -br * 0.02 + Math.sin(t * 0.7) * 0.02;
        o.head.y = br * 0.8;
        o.shNear = 0.05 + br * 0.03;
        o.shFar = -0.03 - br * 0.02;
        o.elNear = 0.10;
        o.elFar = 0.08;
        o.rootY = br * 1.2;
        break;
      }
      case 'move': {
        const s = Math.sin(step), c = Math.cos(step);
        const sp = clamp((K.speed || 200) / 240, 0.55, 1.35);
        o.hipNear = s * 0.62 * sp;
        o.hipFar = -s * 0.62 * sp;
        o.kneeNear = Math.max(0, -s) * 0.95 * sp + 0.08;
        o.kneeFar = Math.max(0, s) * 0.95 * sp + 0.08;
        o.shNear = -s * 0.5 * sp;
        o.shFar = s * 0.5 * sp;
        o.elNear = 0.22 + Math.max(0, s) * 0.35;
        o.elFar = 0.22 + Math.max(0, -s) * 0.35;
        o.torso.rot = 0.05 + c * 0.02;
        o.torso.y = -Math.abs(s) * 2.4 * sp;
        o.head.rot = -0.03 - c * 0.02;
        o.rootY = -Math.abs(s) * 3.0 * sp;
        break;
      }
      case 'jump': {
        const up = clamp(K.jumpP != null ? K.jumpP : 0.5, 0, 1);
        o.hipNear = -0.55; o.kneeNear = 1.05;
        o.hipFar = -0.25; o.kneeFar = 0.75;
        o.shNear = -0.9; o.shFar = -0.4;
        o.elNear = 0.5;
        o.torso.rot = -0.06;
        o.rootRot = -0.05 * up;
        o.torso.sy = 1 + 0.05 * up;
        break;
      }
      case 'land': {
        const q = clamp(p, 0, 1);
        o.torso.sy = 1 - 0.14 * (1 - q);
        o.torso.sx = 1 + 0.08 * (1 - q);
        o.hipNear = -0.35 * (1 - q); o.kneeNear = 0.7 * (1 - q);
        o.hipFar = -0.3 * (1 - q); o.kneeFar = 0.6 * (1 - q);
        o.rootY = 6 * (1 - q);
        break;
      }
      case 'atk1':
      case 'atk2':
      case 'atk3': {
        const heavy = state === 'atk3';
        const wind = heavy ? 0.34 : 0.26;
        const q = clamp(p, 0, 1);
        let swing;
        if (q < wind) swing = -easeOut(q / wind);
        else if (q < wind + 0.22) swing = lerp(-1, 1.25, easeIn((q - wind) / 0.22));
        else swing = lerp(1.25, 0, easeOut((q - wind - 0.22) / (1 - wind - 0.22)));
        const dir = state === 'atk2' ? -1 : 1;
        const main = K.mainArm === 'near' ? 'Near' : 'Far';
        const off = main === 'Near' ? 'Far' : 'Near';
        o['sh' + main] = swing * (heavy ? 2.0 : 1.55) * dir;
        o['el' + main] = (heavy ? 0.35 : 0.55) - Math.max(0, swing) * 0.35;
        o['sh' + off] = -swing * 0.35;
        o['el' + off] = 0.25;
        o.torso.rot = swing * (heavy ? 0.30 : 0.22) * dir;
        o.head.rot = swing * 0.10;
        o.hipNear = swing * 0.16;
        o.hipFar = -swing * 0.10;
        o.kneeNear = Math.max(0, swing) * 0.18;
        o.rootX = swing * (heavy ? 7 : 4);
        o.rootY = heavy ? Math.abs(Math.sin(q * Math.PI)) * -3 : 0;
        if (heavy && q > wind) { o.torso.sy = 1 - 0.05 * Math.sin((q - wind) * 6); }
        break;
      }
      case 'cast': {
        const q = clamp(p, 0, 1);
        const raise = Math.sin(clamp(q / 0.45, 0, 1) * Math.PI * 0.5);
        const push = clamp((q - 0.45) / 0.3, 0, 1);
        o.shNear = -1.35 * raise + push * 1.9;
        o.shFar = -1.1 * raise + push * 1.6;
        o.elNear = 0.5 * raise;
        o.elFar = 0.4 * raise;
        o.torso.rot = -0.12 * raise + push * 0.18;
        o.head.rot = -0.06 * raise;
        o.rootY = -raise * 2;
        o.torso.sy = 1 + 0.03 * raise;
        break;
      }
      case 'ult': {
        const q = clamp(p, 0, 1);
        const up = Math.sin(clamp(q / 0.5, 0, 1) * Math.PI * 0.5);
        o.shNear = -1.7 * up; o.shFar = -1.45 * up;
        o.elNear = 0.25 * up; o.elFar = 0.2 * up;
        o.torso.rot = -0.16 * up;
        o.head.rot = -0.22 * up;
        o.rootY = -3 * up;
        o.rootRot = -0.03 * up;
        break;
      }
      case 'dodge': {
        const q = clamp(p, 0, 1);
        o.torso.rot = 0.45 * Math.sin(q * Math.PI);
        o.rootRot = -0.28 * Math.sin(q * Math.PI);
        o.hipNear = -0.5 * Math.sin(q * Math.PI);
        o.kneeNear = 0.9 * Math.sin(q * Math.PI);
        o.hipFar = -0.35 * Math.sin(q * Math.PI);
        o.kneeFar = 0.7 * Math.sin(q * Math.PI);
        o.shNear = 0.6 * Math.sin(q * Math.PI);
        o.shFar = -0.5 * Math.sin(q * Math.PI);
        o.rootY = -4 * Math.sin(q * Math.PI);
        break;
      }
      case 'hurt': {
        const q = clamp(p, 0, 1);
        const hit = Math.sin(q * Math.PI);
        o.torso.rot = -0.26 * hit;
        o.head.rot = -0.3 * hit;
        o.shNear = 0.5 * hit; o.shFar = 0.35 * hit;
        o.hipNear = 0.2 * hit;
        o.rootX = -5 * hit;
        o.torso.sy = 1 - 0.04 * hit;
        break;
      }
      case 'dead': {
        const q = clamp(p, 0, 1);
        o.rootRot = -1.15 * easeOut(q);
        o.rootY = -2 * q;
        o.head.rot = -0.4 * q;
        o.shNear = 0.8 * q; o.shFar = 0.6 * q;
        o.hipNear = -0.5 * q; o.kneeNear = 0.8 * q;
        o.hipFar = -0.3 * q; o.kneeFar = 0.5 * q;
        break;
      }
      case 'victory': {
        const q = Math.sin(t * 2.4);
        o.shNear = -1.9 + q * 0.06;
        o.elNear = 0.3;
        o.shFar = 0.25;
        o.head.rot = -0.1 + q * 0.03;
        o.torso.rot = -0.05;
        o.rootY = q * 1.5;
        break;
      }
      case 'walk': {
        const s = Math.sin(step);
        o.hipNear = s * 0.55; o.hipFar = -s * 0.55;
        o.kneeNear = Math.max(0, -s) * 0.8 + 0.06;
        o.kneeFar = Math.max(0, s) * 0.8 + 0.06;
        o.shNear = -s * 0.45; o.shFar = s * 0.45;
        o.elNear = 0.2; o.elFar = 0.2;
        o.torso.rot = 0.06;
        o.rootY = -Math.abs(s) * 3;
        break;
      }
      case 'windup': {
        const q = clamp(p, 0, 1);
        o.torso.rot = -0.2 - 0.16 * q;
        o.head.rot = -0.12 * q;
        o.shNear = -0.9 * q; o.shFar = -0.5 * q;
        o.elNear = 0.5 * q;
        o.hipNear = -0.2 * q; o.kneeNear = 0.3 * q;
        o.rootY = 3 * q;
        o.torso.sy = 1 + 0.04 * q;
        break;
      }
      case 'strike': {
        const q = clamp(p, 0, 1);
        const sw = q < 0.35 ? lerp(-1, 1.5, easeIn(q / 0.35)) : lerp(1.5, 0.7, (q - 0.35) / 0.65);
        o.shNear = sw * 1.5;
        o.elNear = 0.3;
        o.shFar = -sw * 0.3;
        o.torso.rot = sw * 0.22;
        o.head.rot = sw * 0.08;
        o.rootX = sw * 5;
        break;
      }
      case 'stumble': {
        const s = Math.sin(t * 16);
        o.torso.rot = s * 0.12;
        o.head.rot = -s * 0.16;
        o.shNear = 0.4 + s * 0.2;
        o.shFar = -0.3 - s * 0.2;
        o.rootY = 2 + Math.abs(s) * 1.5;
        o.hipNear = -0.1; o.kneeNear = 0.25;
        break;
      }
      case 'spawn': {
        const q = clamp(p, 0, 1);
        o.rootY = (1 - q) * -14;
        o.torso.sy = 0.9 + 0.1 * q;
        o.shNear = -0.4 * (1 - q);
        break;
      }
      default: {
        o.torso.sy = 1 + br * 0.01;
        break;
      }
    }
    return o;
  }

  /* ------------------------------------------------------------------ */
  /*  Rig — 본 + 가중치 메쉬                                            */
  /* ------------------------------------------------------------------ */
  class Rig {
    constructor(def, opts = {}) {
      this.def = def;
      this.key = def.name;
      this.opts = opts;
      this.artFacing = opts.artFacing || 1;
      this.mainArm = opts.mainArm || 'far';

      this.yaw = 1;
      this.yawTarget = 1;
      this.turnT = 1;
      this.turnDur = opts.turnDur || 0.11;
      this.turnFrom = 1;
      this.stepTurn = 0;
      this.turnLog = [];
      this.t = 0;
      this.state = 'idle';
      this.stateT = 0;
      this.stepPhase = 0;
      this.poseData = P0();
      this.flash = 0;
      this.flashColor = 0xffffff;
      this.scale = 1;

      // ---- 본 준비 (부모 → 자식 순서 보장)
      const src = def.bones || [];
      this.bones = src.slice().sort((a, b) => a.idx - b.idx).map((b) => ({
        name: b.name, parent: b.parentIdx, x: b.x, y: b.y,
        px: b.pa[0], py: b.pa[1], len: b.len, ang: b.ang, kind: b.kind,
        rest: b.ang, idx: b.idx,
        rot: 0, wx: 0, wy: 0, wrot: 0,
      }));
      this.boneByName = {};
      this.bones.forEach((b) => { this.boneByName[b.name] = b; });
      this.nodes = {};
      this.bones.forEach((b) => {
        this.nodes[b.name] = { rotation: 0, x: b.x, y: b.y, z: b.idx };
      });
      this.partNames = this.bones.map((b) => b.name);
      this.order = this.bones;

      // ---- 메쉬 정점/가중치
      const g = def.grid;
      this.cols = g[0]; this.rows = g[1];
      this.rest = Float32Array.from(def.positions);
      this.uvs = Float32Array.from(def.uvs);
      this.weights = def.weights;                  // [ [boneIdx, w], ... ] per influence
      this.vertCount = this.rest.length / 2;
      this.vmask = def.vmask || null;
      this.cmask = def.cmask || null;
      this.pos = new Float32Array(this.rest.length);
      this.pos.set(this.rest);

      const geo = new PIXI.MeshGeometry({
        positions: this.pos,
        uvs: this.uvs,
        indices: new Uint32Array(def.indices),
      });
      this.geo = geo;
      this.mesh = new PIXI.Mesh({ geometry: geo, texture: def.bodyTex || PIXI.Texture.WHITE });
      this.mesh.texture = def.bodyTex;
      this.mesh.roundPixels = false;

      this.body = new PIXI.Container();     // 턴/스쿼시 전용 래퍼 (scale.x = ±scale)
      this.body.sortableChildren = true;
      this.root = new PIXI.Container();
      this.root.sortableChildren = true;
      this.root.addChild(this.body);
      this.body.addChild(this.mesh);

      // ---- 무기 손 소켓
      this.weapon = null;
      if (def.weapon && def.weaponTex) {
        const w = def.weapon;
        this.weapon = new PIXI.Sprite(def.weaponTex);
        this.weapon.anchor.set(w.pivot[0] / w.w, w.pivot[1] / w.h);
        this.weaponSocket = 'hand_' + (w.side || 'near');
        this.body.addChild(this.weapon);
      }

      // ---- 2차 물리(머리카락·천) 스프링
      this.spr = { head: 0, headV: 0, cloth: 0, clothV: 0 };
      this.groundY = def.groundY != null ? def.groundY : 0;

      this.setBodyPx(opts.bodyPx || def.h * 0.5);
    }

    setBodyPx(px) {
      this.scale = px / (this.def.bodyH || this.def.h || 1);
      this.applyScale();
    }

    applyScale() {
      const s = this.scale;
      this.body.scale.set(s * (this.yawTarget >= 0 ? 1 : -1), s);
    }

    /* 방향 전환 — 즉시 반전 + 0.11초 발 디딤 */
    setFacing(worldDir) {
      const target = (worldDir >= 0 ? 1 : -1) * (this.artFacing >= 0 ? 1 : -1);
      if (target === this.yawTarget) return;
      this.turnFrom = this.yaw;
      this.yaw = target;
      this.yawTarget = target;
      this.turnT = 0;
      this.turnLog.push({ t: +this.t.toFixed(3), from: this.turnFrom, to: target, snap: true });
      if (this.turnLog.length > 40) this.turnLog.shift();
    }

    get turning() { return this.turnT < 1; }

    setState(name, p, cfg) {
      this.state = name;
      this.stateP = p;
      this.stateCfg = cfg;
    }

    /* 본 회전 → 정점 스키닝 */
    update(dt) {
      if (!this.body || this.body.destroyed) return;
      this.t += dt;
      this.stateT += dt;
      if (this.turnT < 1) this.turnT = Math.min(1, this.turnT + dt / this.turnDur);
      const stepTurn = this.turnT < 1 ? Math.sin(this.turnT * Math.PI) : 0;
      this.stepTurn = stepTurn;
      this.yaw = this.yawTarget;

      const cfg = Object.assign({ stepPhase: this.stepPhase, mainArm: this.mainArm }, this.stateCfg || {});
      const pd = pose(this.state, this.stateT, this.stateP == null ? 0 : this.stateP, cfg);
      this.poseData = pd;

      // 2차 물리 — 머리카락/천이 반 박자 늦게 따라온다
      const tgtHead = pd.head.rot + stepTurn * 0.10;
      this.spr.headV += (tgtHead - this.spr.head) * 26 * dt - this.spr.headV * 9 * dt;
      this.spr.head += this.spr.headV * dt;
      const tgtCloth = pd.torso.rot * 0.5 + stepTurn * 0.16;
      this.spr.clothV += (tgtCloth - this.spr.cloth) * 18 * dt - this.spr.clothV * 7 * dt;
      this.spr.cloth += this.spr.clothV * dt;

      // ---- 포즈 → 본 로컬 회전
      const tr = pd.torso.rot;
      const set = (name, rot) => { const b = this.boneByName[name]; if (b) b.rot = rot; };
      set('hips', tr * 0.0);
      set('spine', tr * 0.45);
      set('chest', tr * 0.55);
      set('head', pd.head.rot - 1.35 * tr + this.spr.head * 0.35);
      set('shoulder_near', 0); set('shoulder_far', 0);
      set('upperarm_near', pd.shNear);
      set('upperarm_far', pd.shFar);
      set('forearm_near', pd.elNear);
      set('forearm_far', pd.elFar);
      set('thigh_near', pd.hipNear);
      set('thigh_far', pd.hipFar);
      set('shin_near', pd.kneeNear);
      set('shin_far', pd.kneeFar);
      // 발 디딤 — 앞다리를 살짝 딛고 상체가 먼저 돈다
      if (stepTurn > 0.001) {
        const th = this.boneByName.thigh_near, sh = this.boneByName.shin_near;
        if (th) th.rot += -0.20 * stepTurn;
        if (sh) sh.rot += 0.26 * stepTurn;
      }

      this._solveWorld();
      this._footIK();
      this._skin();

      // 몸 전체 변환
      const dirNow = this.yawTarget;
      this.body.x = (pd.rootX - 3.5 * stepTurn) * dirNow;
      this.body.y = pd.rootY + 2.2 * stepTurn;
      this.body.rotation = pd.rootRot * dirNow;
      this.body.scale.set(this.scale * dirNow, this.scale * pd.torso.sy);

      // 무기 — 손 소켓의 월드 변환을 그대로 따른다
      if (this.weapon) {
        const hb = this.boneByName[this.weaponSocket];
        if (hb) {
          this.weapon.x = hb.wx;
          this.weapon.y = hb.wy;
          this.weapon.rotation = hb.wrot;
        }
      }

      // 피격 플래시
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4.2);
      const tint = this.flash > 0 ? this.flashColor : 0xffffff;
      if (this.mesh) this.mesh.tint = tint;
      if (this.weapon) this.weapon.tint = tint;
    }

    /* 본 월드 변환 — 부모 회전을 이어받아 자기 시작점을 축으로 돈다 */
    _solveWorld() {
      const bs = this.order;
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        if (b.parent == null) {
          b.wx = b.px; b.wy = b.py; b.wrot = b.rot;
        } else {
          const p = bs[b.parent];
          const c = Math.cos(p.wrot), s = Math.sin(p.wrot);
          const dx = b.px - p.px, dy = b.py - p.py;
          b.wx = p.wx + dx * c - dy * s;
          b.wy = p.wy + dx * s + dy * c;
          b.wrot = p.wrot + b.rot;
        }
      }
    }

    /* 2본 IK — 발이 땅(로컬 y=groundY)을 파고들면 무릎으로 풀어 세운다 */
    _footIK() {
      const gy = this.groundY;
      for (const side of ['near', 'far']) {
        const th = this.boneByName['thigh_' + side];
        const sh = this.boneByName['shin_' + side];
        if (!th || !sh) continue;
        const c = Math.cos(sh.wrot);
        const footX = sh.wx + Math.cos(sh.wrot) * sh.len;
        const footY = sh.wy + Math.sin(sh.wrot) * sh.len;
        if (footY <= gy + 0.5) continue;                 // 땅 위면 손대지 않는다
        const L1 = th.len, L2 = sh.len;
        const tx = footX, ty = gy;
        let dx = tx - th.wx, dy = ty - th.wy;
        let d = Math.hypot(dx, dy);
        const dmin = Math.abs(L1 - L2) + 1, dmax = L1 + L2 - 1;
        if (d > dmax) d = dmax;
        if (d < dmin) d = dmin;
        const a = Math.atan2(dy, dx);
        const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
        const A = Math.acos(cosA);
        // 무릎이 꺾이는 방향은 rest 자세에서 정한다
        const bendSign = this._bendSign(th, sh);
        const ta = a - bendSign * A;
        const kx = th.wx + Math.cos(ta) * L1, ky = th.wy + Math.sin(ta) * L1;
        const sa = Math.atan2(ty - ky, tx - kx);
        const thDelta = ta - th.rest;
        th.rot = thDelta - (th.parent != null ? this.order[th.parent].wrot : 0);
        const shDelta = sa - sh.rest;
        sh.rot = shDelta - ta;
        // 바뀐 각으로 다시 월드 계산
        this._solveWorld();
      }
    }

    _bendSign(th, sh) {
      const cross = Math.cos(th.rest) * Math.sin(sh.rest) - Math.sin(th.rest) * Math.cos(sh.rest);
      return cross >= 0 ? 1 : -1;
    }

    /* 가중치 메쉬 스키닝 — 정점마다 최대 3본을 섞어 변형 */
    _skin() {
      const pos = this.pos, rest = this.rest, wts = this.weights, bs = this.bones;
      const cache = [];
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i];
        cache.push([b.wx, b.wy, Math.cos(b.wrot), Math.sin(b.wrot), b.px, b.py]);
      }
      const n = this.vertCount;
      for (let v = 0; v < n; v++) {
        const rx = rest[v * 2], ry = rest[v * 2 + 1];
        const inf = wts[v];
        let ox = 0, oy = 0;
        for (let k = 0; k < inf.length; k++) {
          const bi = inf[k][0], w = inf[k][1];
          const c = cache[bi];
          const dx = rx - c[4], dy = ry - c[5];
          ox += w * (c[0] + dx * c[2] - dy * c[3]);
          oy += w * (c[1] + dx * c[3] + dy * c[2]);
        }
        pos[v * 2] = ox;
        pos[v * 2 + 1] = oy;
      }
      const buf = this.geo.getBuffer('aPosition');
      if (buf) buf.update();
    }

    hitFlash(color) { this.flash = 1; this.flashColor = color || 0xffb3b3; }

    /* 검증용 */
    debug() {
      const out = { state: this.state, yaw: +this.yaw.toFixed(3), turnT: +this.turnT.toFixed(3),
        stepTurn: +this.stepTurn.toFixed(3), parts: {}, bones: {}, weapon: null };
      for (const b of this.bones) {
        out.bones[b.name] = { rot: +b.rot.toFixed(4), wx: +b.wx.toFixed(2), wy: +b.wy.toFixed(2) };
        if (this.nodes[b.name]) this.nodes[b.name].rotation = b.rot;
      }
      // 이음새/늘어남 — 화면에 보이는 정점으로만 이루어진 격자칸만 본다
      let maxStretch = 0, worst = null;
      const ratios = [];
      const cols = this.cols, cm = this.cmask, vm = this.vmask;
      let cell = 0;
      for (let r = 0; r < this.rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++, cell++) {
          const visible = cm ? cm[cell] === 1 : true;
          if (!visible) continue;
          const a = r * cols + c, b2 = a + 1, d = a + cols, e = d + 1;
          if (vm && !(vm[a] && vm[b2] && vm[d] && vm[e])) continue;
          const cells = [[a, b2], [a, d], [b2, e], [d, e]];
          for (const [i, j] of cells) {
            const d0 = Math.hypot(this.rest[j * 2] - this.rest[i * 2], this.rest[j * 2 + 1] - this.rest[i * 2 + 1]);
            if (d0 < 4) continue;
            const d1 = Math.hypot(this.pos[j * 2] - this.pos[i * 2], this.pos[j * 2 + 1] - this.pos[i * 2 + 1]);
            const ratio = d1 / d0;
            ratios.push(ratio);
            if (ratio > maxStretch) { maxStretch = ratio; worst = [i, j, +ratio.toFixed(2)]; }
          }
        }
      }
      ratios.sort((x, y) => x - y);
      const pct = (q) => (ratios.length ? +ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * q))].toFixed(2) : 0);
      let moved = 0;
      for (let v = 0; v < this.vertCount; v++) {
        moved = Math.max(moved, Math.hypot(this.pos[v * 2] - this.rest[v * 2], this.pos[v * 2 + 1] - this.rest[v * 2 + 1]));
      }
      out.body = { sx: +this.body.scale.x.toFixed(4), sy: +this.body.scale.y.toFixed(4),
        rot: +this.body.rotation.toFixed(4), y: +this.body.y.toFixed(2) };
      out.maxStretch = +maxStretch.toFixed(3);
      out.stretchP95 = pct(0.95);
      out.stretchP99 = pct(0.99);
      out.maxMove = +moved.toFixed(2);
      out.turnLog = this.turnLog.slice(-4);
      if (this.weapon) {
        const hb = this.boneByName[this.weaponSocket];
        out.weapon = { x: +this.weapon.x.toFixed(2), y: +this.weapon.y.toFixed(2),
          rot: +this.weapon.rotation.toFixed(4), socket: this.weaponSocket,
          hand: hb ? { wx: +hb.wx.toFixed(2), wy: +hb.wy.toFixed(2), wrot: +hb.wrot.toFixed(4) } : null };
      }
      return out;
    }
  }

  R.Rig = Rig;
  R.pose = pose;
  G.Rig = Rig;
  G.Rigs = R;
})();
