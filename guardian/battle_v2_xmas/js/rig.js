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
      /* ---------- Step 11-3 : 엔딩 — 무릎 꿇고 손을 잡는다 ---------- */
      case 'kneel': {
        const br = Math.sin(t * 1.6);
        o.torso.sy = 0.94 + br * 0.005;
        o.torso.sx = 1.04;
        o.torso.rot = 0.14;
        o.head.rot = 0.10;
        o.hipNear = -0.30; o.kneeNear = 0.62;
        o.hipFar = -0.26; o.kneeFar = 0.54;
        o.shNear = 0.30; o.elNear = 0.34;
        o.shFar = 0.12; o.elFar = 0.26;
        o.rootY = 5 + br * 0.6;
        break;
      }
      case 'reach': {
        const q = clamp(p, 0, 1);
        const br = Math.sin(t * 1.6);
        o.torso.sy = 0.94 + br * 0.005;
        o.torso.sx = 1.04;
        o.torso.rot = 0.12;
        o.head.rot = 0.02;
        o.hipNear = -0.30; o.kneeNear = 0.62;
        o.hipFar = -0.26; o.kneeFar = 0.54;
        o.shNear = 0.30 - 1.25 * q;
        o.elNear = 0.34 - 0.16 * q;
        o.shFar = 0.12; o.elFar = 0.26;
        o.rootY = 5 + br * 0.6;
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
      /* ---------- Step 11-1 : 노엘 전용 ---------- */
      case 'glide': {
        // 벨벳 코트 자락과 선물 자루가 흔들리며 바닥에서 살짝 떠서 미끄러지는 보행
        const s = Math.sin(step), c = Math.cos(step);
        const sp = clamp((K.speed || 220) / 240, 0.7, 1.3);
        o.rootY = -7 - Math.abs(s) * 2.2 * sp;
        o.hipNear = s * 0.20 * sp; o.hipFar = -s * 0.16 * sp;
        o.kneeNear = 0.16 + Math.max(0, -s) * 0.14 * sp;
        o.kneeFar = 0.16 + Math.max(0, s) * 0.12 * sp;
        o.shNear = -0.36 - s * 0.07 * sp;
        o.shFar = 0.24 + s * 0.06 * sp;
        o.elNear = 0.44; o.elFar = 0.30;
        o.torso.rot = -0.04 + c * 0.018;
        o.torso.y = -1.6;
        o.torso.sy = 1 + Math.sin(t * 1.7) * 0.012;
        o.head.rot = 0.02 - c * 0.022;
        o.rootRot = 0.018 * Math.sin(step * 0.5);
        break;
      }
      case 'sackWind': {
        // 1페이즈 — 자루를 뒤로 크게 끌어올린다
        const q = clamp(p, 0, 1);
        o.shNear = -0.28 - 0.62 * q;
        o.elNear = 0.45 * q;
        o.shFar = 0.16 * q; o.elFar = 0.12 * q;
        o.torso.rot = -0.18 * q;
        o.head.rot = -0.12 * q;
        o.hipNear = -0.14 * q; o.kneeNear = 0.24 * q;
        o.hipFar = 0.08 * q; o.kneeFar = 0.16 * q;
        o.rootY = 3.5 * q;
        o.rootX = -4 * q;
      } break;
      case 'sackSwing': {
        const q = clamp(p, 0, 1);
        const sw = q < 0.30 ? lerp(-0.95, 0.85, easeIn(q / 0.30)) : lerp(0.85, 0.45, (q - 0.30) / 0.70);
        o.shNear = sw * 1.35;
        o.elNear = 0.34;
        o.shFar = -sw * 0.30; o.elFar = 0.2;
        o.torso.rot = sw * 0.17;
        o.head.rot = sw * 0.07;
        o.rootX = sw * 6.5;
        o.hipNear = sw * 0.14; o.kneeNear = Math.max(0, sw) * 0.2;
        o.hipFar = -sw * 0.09;
        o.rootY = -Math.abs(Math.sin(q * Math.PI)) * 4;
      } break;
      case 'giftWind': {
        // 2페이즈 — 선물 상자를 머리 위로 들어 올린다
        const q = clamp(p, 0, 1);
        o.shNear = -0.72 * q; o.elNear = 0.42 * q;
        o.shFar = -0.3 * q; o.elFar = 0.24 * q;
        o.torso.rot = -0.15 * q;
        o.head.rot = -0.09 * q;
        o.rootY = 2.2 * q;
        o.hipNear = -0.1 * q; o.kneeNear = 0.18 * q;
        o.torso.sy = 1 + 0.03 * q;
      } break;
      case 'giftThrow': {
        const q = clamp(p, 0, 1);
        const push = q < 0.32 ? easeIn(q / 0.32) : 1 - (q - 0.32) / 0.68 * 0.35;
        o.shNear = -0.72 + 1.35 * push;
        o.elNear = 0.42 - 0.3 * push;
        o.shFar = -0.3 + 0.5 * push; o.elFar = 0.2;
        o.torso.rot = -0.15 + 0.36 * push;
        o.head.rot = -0.09 + 0.16 * push;
        o.rootX = 9 * push;
        o.hipNear = 0.16 * push; o.kneeNear = 0.14 * push;
        o.hipFar = -0.12 * push;
      } break;
      case 'bellAbsorb': {
        // 3페이즈 — 양팔을 활짝 벌려 푸른빛을 모은다
        const q = clamp(p, 0, 1);
        const gather = Math.sin(clamp(q / 0.75, 0, 1) * Math.PI * 0.5);
        o.shNear = -0.5 * gather; o.shFar = -0.46 * gather;
        o.elNear = 0.3 * gather; o.elFar = 0.28 * gather;
        o.torso.rot = -0.18 * gather;
        o.head.rot = -0.2 * gather;
        o.rootY = -5.5 * gather;
        o.rootRot = -0.022 * gather;
        o.torso.sy = 1 + 0.045 * gather;
        o.kneeNear = 0.12 * gather; o.kneeFar = 0.12 * gather;
      } break;
      case 'bellRelease': {
        const q = clamp(p, 0, 1);
        const rel = easeOut(clamp(q / 0.28, 0, 1));
        o.shNear = -0.5 + 1.05 * rel; o.shFar = -0.46 + 1.0 * rel;
        o.elNear = 0.3 - 0.22 * rel; o.elFar = 0.28 - 0.2 * rel;
        o.torso.rot = -0.26 + 0.42 * rel;
        o.head.rot = -0.32 + 0.36 * rel;
        o.rootY = -5.5 * (1 - rel);
        o.rootX = 5 * rel;
        o.torso.sy = 1.045 - 0.03 * rel;
      } break;
      case 'sackTrip': {
        // 빗나간 뒤 자루에 걸려 휘청이는 모습 (당황)
        const s = Math.sin(t * 13);
        o.torso.rot = 0.46 + s * 0.06;
        o.head.rot = -0.22 + s * 0.12;
        o.shNear = 1.15 + s * 0.28;
        o.shFar = -1.0 - s * 0.22;
        o.elNear = 0.3; o.elFar = 0.35;
        o.hipNear = 0.52; o.kneeNear = 0.92;
        o.hipFar = -0.44; o.kneeFar = 0.48;
        o.rootY = 6 + Math.abs(s) * 2;
        o.rootX = 7;
        o.rootRot = 0.05 + s * 0.02;
      } break;
      default: {
        o.torso.sy = 1 + br * 0.01;
        break;
      }
    }
    return o;
  }

  /* ------------------------------------------------------------------ */
  /*  표정 오버레이 (Step 11-1) — 노엘 얼굴 위에 눈꺼풀·눈썹·입·볼을     */
  /*  덧그려 여유(normal)·집중(focus)·피격(hit)·당황(flustered)을 만든다. */
  /*  좌표는 머리뼈 축(눈썹·눈·입) 기준이고 body 높이 비율로 따라간다.    */
  /* ------------------------------------------------------------------ */
  const EXPR = {
    normal: { lid: 0.10, lidLow: 0.08, mouthW: 0.58, mouthOpen: 0, mouthCurve: 0.6,
      blush: 0.18, sweat: 0, glint: 0.22, tear: 0, wave: 0 },
    focus: { lid: 0.34, lidLow: 0.05, mouthW: 0.34, mouthOpen: 0.02, mouthCurve: -0.15,
      blush: 0.10, sweat: 0, glint: 0.95, tear: 0, wave: 0 },
    hit: { lid: 0.52, lidLow: 0.30, mouthW: 0.32, mouthOpen: 0.44, mouthCurve: -0.5,
      blush: 0.34, sweat: 0, glint: 0, tear: 1, wave: 0 },
    flustered: { lid: 0.0, lidLow: 0.0, mouthW: 0.46, mouthOpen: 0.14, mouthCurve: -0.6,
      blush: 0.95, sweat: 1, glint: 0.28, tear: 0, wave: 1 },
  };
  const EXPR_KEYS = ['lid', 'lidLow', 'mouthW', 'mouthOpen', 'mouthCurve', 'blush', 'sweat', 'glint', 'tear', 'wave'];
  const FACE0 = { x: 0, y: -409.3 };          // 머리뼈 축(body 좌표) — noel mesh.json
  const FACE_K = 1 / 718;                      // body 높이 718 기준 비율

  class Face {
    constructor(rig) {
      this.rig = rig;
      const k = (rig.def && rig.def.bodyH) || 718;
      this.k = k * FACE_K;                     // 다른 크기 아트에도 좌표가 맞도록
      this.g = new PIXI.Graphics();
      this.g.zIndex = 9;
      rig.body.addChild(this.g);
      this.name = 'normal';
      this.target = EXPR.normal;
      this.p = Object.assign({}, EXPR.normal);
      this.blend = 1;
      this.t = 0;
      this.drawT = 99;
      this.stateLog = [];
      this._apply();
    }

    set(name, force) {
      const n = EXPR[name] ? name : 'normal';
      if (n === this.name && !force) return;
      this.name = n;
      this.target = EXPR[n];
      this.blend = 0;
      this.stateLog.push({ t: +this.t.toFixed(2), name: n });
      if (this.stateLog.length > 30) this.stateLog.shift();
    }

    update(dt) {
      this.t += dt;
      const k = Math.min(1, dt * 13);
      for (const key of EXPR_KEYS) {
        this.p[key] += (this.target[key] - this.p[key]) * k;
      }
      this.blend = Math.min(1, this.blend + dt / 0.16);
      // 머리뼈를 그대로 따라간다 — 머리를 돌려도 표정이 얼굴 위에 남는다
      const hb = this.rig.boneByName.head;
      if (hb) {
        this.g.x = hb.wx;
        this.g.y = hb.wy;
        this.g.rotation = hb.wrot;
      }
      this.g.scale.set(this.k, this.k);
      this.drawT += dt;
      if (this.drawT > 0.05 || this.blend < 1) {
        this.drawT = 0;
        this._apply();
      }
    }

    _apply() {
      const g = this.g, p = this.p;
      g.clear();
      const SKIN = 0xf6e2d8;
      const EYES = [[-90, -46], [-4, -46]];
      const RW = 27, RH = 29;

      // ---- 눈꺼풀 + 속눈썹 (두꺼운 눈꺼풀은 눈을 「가늘게 뜨거나 찡그린」 모양으로)
      for (const [ex, ey] of EYES) {
        if (p.lid > 0.04) {
          const chord = ey - RH + 2 * RH * p.lid;
          if (p.lid > 0.14) {
            const pts = [];
            for (let i = 0; i <= 16; i++) {
              const a = Math.PI + (i / 16) * Math.PI;
              const x = ex + Math.cos(a) * RW, y = ey + Math.sin(a) * RH;
              if (y <= chord) pts.push([x, y]);
            }
            if (pts.length > 1) {
              g.poly(pts.concat([[ex + RW + 2, chord + 3], [ex - RW - 2, chord + 3]]))
                .fill({ color: SKIN, alpha: 0.97 });
            }
          }
          g.moveTo(ex - RW - 2, chord + 2)
            .quadraticCurveTo(ex, chord - 3, ex + RW + 3, chord)
            .stroke({ color: 0x2f1a20, width: 2.6, alpha: 0.9 });
          // 바깥 눈꼬리
          g.moveTo(ex + RW + 2, chord).lineTo(ex + RW + 9, chord - 5)
            .stroke({ color: 0x2f1a20, width: 2.2, alpha: 0.75 });
        }
        if (p.lidLow > 0.05) {
          const chord2 = ey + RH - 2 * RH * p.lidLow;
          const pts = [];
          for (let i = 0; i <= 16; i++) {
            const a = (i / 16) * Math.PI;
            const x = ex + Math.cos(a) * RW, y = ey + Math.sin(a) * RH;
            if (y >= chord2) pts.push([x, y]);
          }
          if (pts.length > 1) {
            g.poly(pts.concat([[ex + RW, chord2 - 3], [ex - RW, chord2 - 3]]))
              .fill({ color: SKIN, alpha: 0.94 });
          }
        }
      }

      // ---- 볼
      if (p.blush > 0.05) {
        for (const bx of [-101, -1]) {
          g.ellipse(bx, -12, 21, 11).fill({ color: 0xff9aa2, alpha: 0.34 * p.blush });
          if (p.blush > 0.5) {
            for (let i = -1; i <= 1; i++) {
              g.moveTo(bx + i * 9 - 4, -18).lineTo(bx + i * 9 + 2, -6)
                .stroke({ color: 0xe06a76, width: 1.6, alpha: 0.5 * p.blush });
            }
          }
        }
      }

      // ---- 입 — 원화의 입을 피부색으로 덮고 표정 입을 그린다
      const mx = -53, my = 3;
      const mw = 26 * p.mouthW;
      g.ellipse(mx, my, 17, 10).fill({ color: SKIN, alpha: 0.95 });
      if (p.wave > 0.4) {
        g.moveTo(mx - mw, my)
          .quadraticCurveTo(mx - mw * 0.5, my + 7, mx, my)
          .quadraticCurveTo(mx + mw * 0.5, my - 7, mx + mw, my)
          .stroke({ color: 0xa83a4a, width: 3, alpha: 0.9 });
      } else if (p.mouthOpen > 0.08) {
        const oh = 4 + 13 * p.mouthOpen;
        g.ellipse(mx, my + oh * 0.35, mw * 0.62, oh).fill({ color: 0x6d1b2a, alpha: 0.94 });
        g.ellipse(mx, my + oh * 0.6, mw * 0.42, oh * 0.45).fill({ color: 0xc9526a, alpha: 0.9 });
        g.ellipse(mx, my - oh * 0.25, mw * 0.5, oh * 0.3).fill({ color: 0xffffff, alpha: 0.3 });
      } else {
        const dip = 6 * p.mouthCurve;
        g.moveTo(mx - mw, my).quadraticCurveTo(mx, my + dip * 1.4, mx + mw, my)
          .stroke({ color: 0xa83a4a, width: 3.1, alpha: 0.92 });
      }

      // ---- 눈 반짝임 / 눈물 / 식은땀
      if (p.glint > 0.05) {
        // 오른쪽 눈동자 위의 날카로운 반짝임
        g.ellipse(-4, -55, 11, 3.4).fill({ color: 0xffffff, alpha: 0.55 * p.glint });
        const gx = 18, gy = -68;
        g.moveTo(gx, gy - 9).lineTo(gx + 3, gy - 3).lineTo(gx + 9, gy).lineTo(gx + 3, gy + 3)
          .lineTo(gx, gy + 9).lineTo(gx - 3, gy + 3).lineTo(gx - 9, gy).lineTo(gx - 3, gy - 3)
          .closePath().fill({ color: 0xffffff, alpha: 0.85 * p.glint });
      }
      if (p.tear > 0.1) {
        const ty = -8 + Math.sin(this.t * 8) * 2;
        g.moveTo(-6, ty - 10).lineTo(-1, ty).lineTo(-6, ty + 10).lineTo(-11, ty).closePath()
          .fill({ color: 0xbfe4ff, alpha: 0.85 * p.tear });
        g.circle(-6, ty + 3, 2.6).fill({ color: 0xffffff, alpha: 0.75 * p.tear });
      }
      if (p.sweat > 0.05) {
        const sy = -26 + Math.sin(this.t * 6) * 4;
        g.moveTo(58, sy - 24)
          .quadraticCurveTo(71, sy + 4, 58, sy + 17)
          .quadraticCurveTo(45, sy + 4, 58, sy - 24)
          .closePath().fill({ color: 0x2f7fc4, alpha: 0.95 * p.sweat });
        g.moveTo(58, sy - 13)
          .quadraticCurveTo(64, sy + 4, 58, sy + 11)
          .quadraticCurveTo(52, sy + 4, 58, sy - 13)
          .closePath().fill({ color: 0xe8f6ff, alpha: 0.98 * p.sweat });
      }
    }

    info() {
      const out = { name: this.name, blend: +this.blend.toFixed(2), states: this.stateLog.slice(-6) };
      for (const k of EXPR_KEYS) out[k] = +this.p[k].toFixed(3);
      out.pos = { x: +this.g.x.toFixed(1), y: +this.g.y.toFixed(1), rot: +this.g.rotation.toFixed(3) };
      return out;
    }
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

      // ---- 표정 오버레이 (노엘처럼 opts.face 를 준 리그만)
      this.face = null;
      if (opts.face) this.face = new Face(this);
    }

    /* 표정 4종 전환 — normal / focus / hit / flustered */
    setExpression(name, force) {
      if (this.face) this.face.set(name, force);
      return this.face ? this.face.name : null;
    }

    expressionInfo() { return this.face ? this.face.info() : null; }

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
      if (this.face) this.face.update(dt);

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
      if (this.face) out.face = this.face.info();
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
  R.Face = Face;
  R.EXPR = EXPR;
  R.pose = pose;
  G.Rig = Rig;
  G.Rigs = R;
})();
