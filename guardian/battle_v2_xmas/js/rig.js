/* rig.js : SD 관절 파츠 리깅 (Step 6)
 * 한 장짜리 통이미지 대신 머리·몸통·팔·다리 파츠를 PixiJS 컨테이너 계층으로 묶어
 * pivot 회전·위치·Z-order로 실제 관절이 움직이게 한다.
 * - 대기(호흡)·이동(보행)·점프·공격 1/2/3타·스킬·궁극기·피격·회피·쓰러짐
 * - 방향 전환은 즉시 scaleX 반전이 아니라 몸통·머리·팔 파츠가 시간차로 돌아가는 다프레임 턴
 * - 스킨은 파츠 텍스처 전체를 교체(같은 리그에 다른 복장 파츠 세트)
 */
(function () {
  const R = {
    meta: null,
    cache: {},
    texCache: {},
    ready: {},
  };

  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /* 파츠 텍스처 로드 — 같은 파츠는 한 번만 */
  function texFor(path) {
    if (R.texCache[path]) return R.texCache[path];
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const t = PIXI.Texture.from(img);
        t.source.scaleMode = 'linear';
        t.source.autoGarbageCollect = false;   // 로비에 오래 머물러도 파츠가 내려가지 않게
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

  /* 리그 정의 + 파츠 텍스처 한 벌 */
  R.load = function (key) {
    if (R.ready[key]) return R.ready[key];
    R.ready[key] = (async () => {
      const info = R.meta && R.meta.rigs && R.meta.rigs[key];
      if (!info) return null;
      const res = await fetch(info.json + '?v=' + encodeURIComponent((G && (G.ASSET_V || G.VERSION)) || 'v0'));
      const def = await res.json();
      const texs = {};
      if (def.atlas) {
        // 파츠 11장 → 아틀라스 1장 (텍스처 수·드로우콜 절감)
        const base = await texFor(def.atlas);
        if (base) {
          def.parts.forEach((p) => {
            if (!p.rect) { texs[p.name] = base; return; }
            const t = new PIXI.Texture({ source: base.source, frame: new PIXI.Rectangle(p.rect[0], p.rect[1], p.rect[2], p.rect[3]) });
            texs[p.name] = t;
          });
        }
      }
      if (!texs.head) {
        await Promise.all(def.parts.map(async (p) => { texs[p.name] = await texFor(p.file); }));
      }
      def.textures = texs;
      def.meta = info;
      R.cache[key] = def;
      return def;
    })();
    return R.ready[key];
  };

  R.get = function (key) { return R.cache[key] || null; };
  R.has = function (key) { return !!(R.meta && R.meta.rigs && R.meta.rigs[key]); };

  /* ------------------------------------------------------------------ */
  /*  포즈 라이브러리                                                    */
  /* ------------------------------------------------------------------ */
  const P0 = () => ({
    rootY: 0, rootRot: 0, rootSX: 1, rootSY: 1, rootX: 0,
    torso: { rot: 0, x: 0, y: 0, sx: 1, sy: 1 },
    head: { rot: 0, x: 0, y: 0 },
    shNear: 0, elNear: 0, shFar: 0, elFar: 0,
    hipNear: 0, kneeNear: 0, hipFar: 0, kneeFar: 0,
    armSwing: 0,
  });

  /* 상태별 포즈. p(0~1)는 동작 진행도, t는 로컬 시간 */
  function pose(state, t, p, cfg) {
    const o = P0();
    const K = cfg || {};
    const br = Math.sin(t * 2.1);          // 호흡
    const step = K.stepPhase || 0;          // 보행 위상

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
        // 무릎은 뒤로 접힌 쪽만 굽힌다
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
        // 3연타: 1타 가로 베기, 2타 되돌아 베기, 3타 내려찍기
        const heavy = state === 'atk3';
        const wind = heavy ? 0.34 : 0.26;
        const dur = heavy ? 1 : 1;
        const q = clamp(p / dur, 0, 1);
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
      /* ---- 적 ---- */
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
  /*  Rig                                                                */
  /* ------------------------------------------------------------------ */
  class Rig {
    constructor(def, opts = {}) {
      this.def = def;
      this.key = def.name;
      this.opts = opts;
      this.artFacing = opts.artFacing || 1;    // 원화가 향한 방향 (+1 오른쪽)
      this.yaw = 1;          // 1 = 원화 방향, -1 = 반대
      this.yawTarget = 1;
      this.turnT = 1;        // 1 = 전환 끝
      this.turnDur = opts.turnDur || 0.30;
      this.turnFrom = 1;
      this.turnLog = [];
      this.t = 0;
      this.state = 'idle';
      this.stateT = 0;
      this.stepPhase = 0;
      this.poseData = P0();
      this.flash = 0;
      this.flashColor = 0xffffff;

      this.root = new PIXI.Container();
      this.root.sortableChildren = true;
      this.body = new PIXI.Container();     // 턴/스쿼시 전용 래퍼
      this.body.sortableChildren = true;
      this.root.sortableChildren = true;
      this.root.addChild(this.body);

      this.nodes = {};
      this.spinners = {};
      this.sprites = {};
      this.defs = {};
      const parts = def.parts.slice().sort((a, b) => a.z - b.z);
      const byName = {};
      parts.forEach((p) => { byName[p.name] = p; this.defs[p.name] = p; });
      const cx = def.cx, H = def.h;

      this.base = {};
      // 파츠 피벗은 자기 크롭 기준 → 원화 좌표로 환산
      const ip = {};
      parts.forEach((p) => { ip[p.name] = [p.pivot[0] + (p.origin ? p.origin[0] : 0), p.pivot[1] + (p.origin ? p.origin[1] : 0)]; });
      this.ip = ip;
      const mk = (p) => {
        const nodeY = p.name;
        const node = new PIXI.Container();
        const parent = p.parent ? this.nodes[p.parent] : this.body;
        node.x = ip[p.name][0] - (p.parent ? ip[p.parent][0] : cx);
        node.y = ip[p.name][1] - (p.parent ? ip[p.parent][1] : H);
        node.zIndex = p.z;
        node.sortableChildren = true;
        (parent || this.body).addChild(node);
        this.base[nodeY] = { x: node.x, y: node.y };
        this.nodes[p.name] = node;

        const tex = def.textures[p.name];
        const spr = new PIXI.Sprite(tex || PIXI.Texture.WHITE);
        spr.anchor.set(p.pivot[0] / p.w, p.pivot[1] / p.h);
        spr.zIndex = 2;
        node.addChild(spr);
        this.sprites[p.name] = spr;

        // 관절 원판 — 회전 시 파츠 사이 틈을 메운다 (팔다리 관절만)
        const jointed = /^(upArm|loArm|thigh|shin)/.test(p.name);
        if (jointed) {
          const disc = new PIXI.Graphics();
          const rad = Math.max(2.2, p.r * 0.28);
          disc.circle(0, 0, rad).fill({ color: p.jointColor, alpha: 0.92 });
          disc.zIndex = 1;
          node.addChild(disc);
          this.spinners[p.name] = disc;
        }
        return node;
      };
      // 부모가 먼저 만들어지도록 z 순서대로 (torso → pelvis → limbs → head)
      const order = ['torso', 'pelvis', 'upArm_far', 'upArm_near', 'loArm_far', 'loArm_near',
        'thigh_far', 'thigh_near', 'shin_far', 'shin_near', 'head'];
      const rest = parts.filter((p) => order.indexOf(p.name) < 0).map((p) => p.name);
      order.concat(rest).forEach((n) => { if (byName[n]) mk(byName[n]); });

      // 파츠별 턴 지연 (머리가 먼저 돌고 다리가 마지막)
      this.turnDelay = {};
      parts.forEach((p) => {
        const n = p.name;
        this.turnDelay[n] = n === 'head' ? 0.0 : n === 'torso' ? 0.12
          : n.indexOf('Arm') >= 0 ? 0.26 : n.indexOf('thigh') >= 0 ? 0.34 : n.indexOf('shin') >= 0 ? 0.42 : 0.2;
      });
      this.partNames = parts.map((p) => p.name);

      this.scale = 1;
    }

    /* 몸 전체 크기(px) — bodyPx / 원화 키 */
    setBodyPx(px) { this.scale = px / this.def.bodyH; this.applyScale(); }

    applyScale() {
      const s = this.scale;
      this.body.scale.set(s, s);
    }

    /* 방향 전환: 즉시 반전이 아니라 다프레임 턴 */
    setFacing(worldDir) {
      const target = (worldDir >= 0 ? 1 : -1) * (this.artFacing >= 0 ? 1 : -1);
      if (target === this.yawTarget) return;
      this.turnFrom = this.yaw;
      this.yawTarget = target;
      this.turnT = 0;
      this.turnLog.push({ t: +this.t.toFixed(3), from: this.turnFrom, to: target });
      if (this.turnLog.length > 40) this.turnLog.shift();
    }

    get turning() { return this.turnT < 1; }

    /* 상태 + 진행도로 포즈를 잡는다 */
    setState(name, p, cfg) {
      this.state = name;
      this.stateP = p;
      this.stateCfg = cfg;
    }

    update(dt) {
      if (!this.body || this.body.destroyed) return;
      this.t += dt;
      this.stateT += dt;
      // 턴 진행
      if (this.turnT < 1) {
        this.turnT = Math.min(1, this.turnT + dt / this.turnDur);
        const e = easeInOut(this.turnT);
        this.yaw = lerp(this.turnFrom, this.yawTarget, e);
        if (this.turnT >= 1) this.yaw = this.yawTarget;
      }
      const st = this.state;
      const cfg = Object.assign({ stepPhase: this.stepPhase, mainArm: this.opts.mainArm || 'far' }, this.stateCfg || {});
      const pd = pose(st, this.stateT, this.stateP == null ? 0 : this.stateP, cfg);
      this.poseData = pd;

      // 턴 중 스쿼시(몸이 돌아가는 동안 폭이 줄었다 돌아온다)
      const turning = this.turnT < 1 ? Math.sin(this.turnT * Math.PI) : 0;
      const dirNow = this.yaw;

      this.body.x = pd.rootX * (dirNow >= 0 ? 1 : -1);
      this.body.y = pd.rootY;
      this.body.rotation = pd.rootRot * (dirNow >= 0 ? 1 : -1);
      const sq = 1 - 0.30 * turning;
      this.body.scale.x = this.scale * dirNow * (1 - 0.14 * turning) * pd.rootSX;
      this.body.scale.y = this.scale * (1 + 0.05 * turning) * pd.rootSY;

      const torso = this.nodes.torso;
      if (torso) {
        torso.rotation = pd.torso.rot;
        torso.x = this.base.torso.x + pd.torso.x;
        torso.y = this.base.torso.y + pd.torso.y;
        torso.scale.set(pd.torso.sx, pd.torso.sy);
      }
      const setN = (n, rot, x, y) => {
        const node = this.nodes[n];
        if (!node) return;
        node.rotation = rot || 0;
        if (x != null) node.x = x;
        if (y != null) node.y = y;
      };
      setN('head', pd.head.rot - pd.torso.rot * 0.35);
      if (this.nodes.head) {
        this.nodes.head.y = this.base.head.y + pd.head.y;
        this.nodes.head.x = this.base.head.x + pd.head.x;
      }
      setN('upArm_near', pd.shNear);
      setN('upArm_far', pd.shFar);
      setN('loArm_near', pd.elNear);
      setN('loArm_far', pd.elFar);
      setN('thigh_near', pd.hipNear);
      setN('thigh_far', pd.hipFar);
      setN('shin_near', pd.kneeNear);
      setN('shin_far', pd.kneeFar);

      // 턴 중 파츠별 시간차 — 머리는 먼저, 다리는 나중에 몸통 쪽으로 접힌다
      if (turning > 0.001) {
        for (const n of this.partNames) {
          const d = this.turnDelay[n] || 0.2;
          const q = clamp((this.turnT - d * 0.55) / (1 - d * 0.55), 0, 1);
          const lag = Math.sin(q * Math.PI) * 0.30;       // 파츠가 뒤처지며 따라 도는 정도
          const node = this.nodes[n];
          if (!node) continue;
          node.rotation += (n === 'head' ? -0.55 : n === 'torso' ? -0.25 : 0.18) * lag * (this.yawTarget >= 0 ? 1 : -1);
          // z 순서 교차: 팔·다리는 턴 중반에 앞뒤가 바뀐다
          if (n.indexOf('far') >= 0) node.zIndex = q > 0.5 ? 70 : 20;
          if (n.indexOf('near') >= 0 && n.indexOf('Arm') >= 0) node.zIndex = q > 0.5 ? 22 : 50;
        }
      } else {
        for (const n of this.partNames) {
          const node = this.nodes[n];
          if (!node) continue;
          node.zIndex = this.defs[n].z;
        }
      }

      // 피격 플래시
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4.2);
      const tint = this.flash > 0 ? this.flashColor : 0xffffff;
      for (const n of this.partNames) {
        const s = this.sprites[n];
        if (s) { s.tint = tint; s.alpha = this.baseAlpha != null ? this.baseAlpha : 1; }
      }
    }

    hitFlash(color) { this.flash = 1; this.flashColor = color || 0xffb3b3; }

    /* 검증용: 파츠 회전/위치/스케일 스냅샷 */
    debug() {
      const out = { state: this.state, yaw: +this.yaw.toFixed(3), turnT: +this.turnT.toFixed(3), parts: {} };
      for (const n of this.partNames) {
        const node = this.nodes[n];
        if (!node) continue;
        out.parts[n] = {
          rot: +node.rotation.toFixed(4),
          x: +node.x.toFixed(2), y: +node.y.toFixed(2),
          z: node.zIndex,
        };
      }
      out.body = { sx: +this.body.scale.x.toFixed(4), sy: +this.body.scale.y.toFixed(4),
        rot: +this.body.rotation.toFixed(4), y: +this.body.y.toFixed(2) };
      out.turnLog = this.turnLog.slice(-4);
      return out;
    }
  }

  R.Rig = Rig;
  R.pose = pose;
  G.Rig = Rig;
  G.Rigs = R;
})();
