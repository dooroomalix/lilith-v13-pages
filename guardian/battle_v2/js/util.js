/* 마지막 성문의 수호자 — 전투 v2
 * util.js : 상수, 수학, 이징, 텍스트 스타일
 */
window.G = window.G || {};

G.VERSION = 'v5.14.0-build540';
G.ASSET_V = 'a5.8.0';   // 이미지/시트 캐시 무효화용 (에셋을 갱신하면 올린다)
G.W = 1280;
G.H = 720;

G.TAU = Math.PI * 2;

G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
G.lerp = (a, b, t) => a + (b - a) * t;
G.rand = (a = 1, b = 0) => b + Math.random() * (a - b);
G.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
G.choice = (arr) => arr[(Math.random() * arr.length) | 0];
G.chance = (p) => Math.random() < p;
G.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

G.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
G.easeInCubic = (t) => t * t * t;
G.easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
G.easeInQuad = (t) => t * t;
G.easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
G.easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
G.easeOutElastic = (t) => {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

G.FONT = '"Noto Sans CJK KR", "Noto Sans KR", "Apple SD Gothic Neo", system-ui, sans-serif';
G.FONT_NUM = '"Noto Sans CJK KR", "Noto Sans KR", "Arial Black", system-ui, sans-serif';

G.style = (o) => Object.assign({ fontFamily: G.FONT, fill: 0xffffff, fontWeight: '700' }, o || {});

/* ------------------------------------------------------------------
 * 타격감 규격 (Step 4-1 · Step 10-5 강화)
 * 히트스톱·넉백·카메라 셰이크·줌 펀치의 단일 기준표.
 * 애니메이션 타이밍(COMBO.dur/hit)은 actors.js, "손맛" 수치는 여기서만 관리한다.
 *   stop  : 히트스톱(초). 0.03 = 2프레임 정지, 0.085 = 막타 5프레임 정지
 *   shake : 카메라 셰이크 진폭(px), shakeDur: 흔들림 감쇠 시간
 *   punch : 임팩트 순간의 줌 펀치(배). 0.036 = 화면이 3.6% 확대됐다가 0.2초에 복귀
 *   knock : 적에게 주는 넉백 초기 속도(px/s)
 * 데미지 밸런스(공격력·배율·넉백)는 Step 10-4 그대로 두고, 화면이 느끼는 무게만 올렸다.
 * ------------------------------------------------------------------ */
G.FEEL = {
  cap: 0.17,                       // 히트스톱 상한 — 이 이상은 조작감이 끊긴다
  combo: [
    { stop: 0.030, shake: 6.5, shakeDur: 0.15, punch: 0.018, knock: 220 },   // 1타: 가볍고 빠르게
    { stop: 0.048, shake: 9.0, shakeDur: 0.18, punch: 0.024, knock: 300 },   // 2타: 조금 묵직하게
    { stop: 0.085, shake: 15.0, shakeDur: 0.26, punch: 0.036, knock: 470 },  // 3타(막타): 확실히 무겁게
  ],
  air: { stop: 0.058, shake: 10.5, shakeDur: 0.22, punch: 0.030, knock: 390 },// 공중 공격: 내려찍는 무게
  bossHit: { stopScale: 1.7, shakeScale: 1.55, punchScale: 1.3 },             // 보스를 맞혔을 때
  crit: { stopScale: 1.35, shakeScale: 1.4, punchScale: 1.45 },               // 크리티컬
  multiFinisher: { stopScale: 1.12, shakeScale: 1.15, punchScale: 1.2 },      // 막타 다중 히트
  killBoss: { stop: 0.18, shake: 22, shakeDur: 1.2, punch: 0.05 },
  perfect: { stop: 0.14, shake: 20, shakeDur: 0.6, punch: 0.045 },
  skillTick: { stop: 0.026, shake: 6, shakeDur: 0.16, punch: 0.010, minGap: 0.20, knock: 130 },
  ult: { stop: 0.075, shake: 24, shakeDur: 0.55, punch: 0.048, knock: 520, bossKb: 120 },
  support: {
    ara: { stop: 0.030, shake: 7, shakeDur: 0.2, punch: 0.016, knock: 600 },   // 등불의 온기: 부드러운 파동
    born: { stop: 0.075, shake: 16, shakeDur: 0.32, punch: 0.034, knock: 620 },// 강철의 일격: 가장 묵직
    sena: { stop: 0.040, shake: 8, shakeDur: 0.26, punch: 0.020, knock: 0 },   // 기록의 인장: 마법적
  },
  hurt: {                          // 카엘이 맞았을 때
    heavyAt: 60,                   // 이 피해량 이상이면 강한 피격 연출
    light: { stop: 0.045, shake: 9, shakeDur: 0.20, punch: 0.020 },
    heavy: { stop: 0.085, shake: 15, shakeDur: 0.32, punch: 0.034 },
  },
};

/* ------------------------------------------------------------------
 * 카메라 손맛 (Step 10-5)
 *   셰이크는 "랜덤 진동"만으로는 방향이 안 느껴진다. 맞은 쪽으로 한 번 밀렸다가
 *   감쇠 코사인으로 튕겨 돌아오는 방향 킥을 얹어 강약·방향을 만든다.
 *   진폭은 G.FEEL 항목의 shake(px)를 그대로 쓰고, 여기서는 비중만 정한다.
 *     dir       : 좌우 킥 비중 (진폭 대비) — 공격이 향한 쪽으로 화면이 밀린다
 *     dirY      : 위아래 킥 비중 (공중타·내려찍기)
 *     kickFreq  : 킥이 한 번 튕겼다 돌아오는 주기(감쇠 코사인)
 *     kickDecay : 킥 감쇠 속도(클수록 빨리 잦아든다)
 *     yFactor   : 세로 진동 비중 (가로 흔들림 대비)
 *     maxPunch  : 줌 펀치 상한(배) — 1.055 를 넘으면 화면이 출렁여 보인다
 *     coverPad  : 흔들림이 배경 가장자리를 드러내지 않도록 남기는 여유(px)
 * ------------------------------------------------------------------ */
G.SHAKE = { dir: 0.6, dirY: 0.45, kickFreq: 3.1, kickDecay: 6.2, yFactor: 0.72, maxPunch: 0.055, coverPad: 2 };

/* ------------------------------------------------------------------
 * 리아 협동 — 성광 협공 (Step 4-3)
 *   R / C 키 또는 HUD 협동 버튼으로 발동한다. 궁극기(L · 빛의 심판)와는 별개다.
 *     · 게이지: 전투 중 저절로 차오르고(초당 fill) 타격·처치로 더 빨리 찬다
 *     · 발동: 게이지 100 소모 → dur 초 동안 결계 유지, cd 후 재사용
 *     · 효과: 즉시 회복(healPct) + 받는 피해 감소(dmgTakenMul) + 공격력 증가(atkMul)
 *             + 카엘의 공격에 리아의 성광 호응타(followMul)가 따라붙는다
 * ------------------------------------------------------------------ */
G.COOP = {
  max: 100,
  fill: 5.5,            // 초당 게이지 자연 회복
  hitGain: 1.6,         // 카엘이 적을 맞힐 때마다
  killGain: 6,          // 적을 쓰러뜨릴 때마다
  dur: 8.0,             // 결계 지속(초)
  cd: 10.5,             // 발동 후 재사용 대기(초)
  atkMul: 1.18,         // 결계 중 카엘 공격력 배율
  dmgTakenMul: 0.6,     // 결계 중 받는 피해 배율
  healPct: 0.08,        // 발동 즉시 최대 체력 대비 회복
  followMul: 0.5,       // 성광 호응타 피해 배율(카엘 공격력 기준)
  followDelay: 0.11,    // 호응타가 꽂히는 지연(초)
  followGap: 0.05,      // 호응타 최소 간격(연타 폭주 방지)
  followRange: 470,     // 호응타가 닿는 거리(px)
};

/* ------------------------------------------------------------------
 * 2.5D 사각 링 — 타점·좌표 판정의 단일 기준 (Step 8, v5.8.0)
 *   무대는 X(가로) × Y(깊이) 사각 링이다. 세로 레인 폭을 좁혀
 *   W/S(위아래) 이동과 회피(Shift)가 실제로 공격을 피하게 만든다.
 *     lane.hero  : 내 근접 공격이 적에게 닿는 깊이 반폭
 *     lane.boss  : 보스에게 닿는 깊이 반폭(몸집이 커서 조금 넓다)
 *     lane.enemy : 적 근접 공격이 나에게 닿는 깊이 반폭
 *     back       : 정면 판정의 뒤쪽 허용치 — 등 뒤는 절대 맞지 않는다
 *   inFront(공격자x, 대상x, 바라보는방향, 사거리): 정면 + 사거리 안인가
 *   inLane (a, b, 폭): 두 좌표의 깊이 차가 레인 안인가
 * ------------------------------------------------------------------ */
G.LANE = { hero: 48, boss: 58, enemy: 44, back: 6 };
G.inLane = (a, b, lane) => Math.abs((a || 0) - (b || 0)) <= lane;
G.inFront = (ax, tx, facing, reach, back) => {
  const dx = ((tx || 0) - (ax || 0)) * (facing >= 0 ? 1 : -1);
  return dx >= -(back == null ? G.LANE.back : back) && dx <= reach;
};

/* 무대(사각 링) 좌표 — 바닥 가이드·스폰·검증이 같은 값을 본다 */
G.RING = {
  left: 104, right: 1056,            // 링 좌우 끝(원근 보정 전 기준)
  far: 470, near: 690,               // 링 앞·뒤 끝(화면 y)
  centerX: 580, centerY: 588,
  laneY: [540, 636],                 // 주 타점 레인(588 ± 48)의 깊이선
  heroY: [492, 664],                 // 플레이어가 걸을 수 있는 깊이
};

/* 스폰은 좌·우 양쪽에서 — 한쪽 편중을 없앤다 */
G.SPAWN = { left: [70, 132], right: [1116, 1222], lane: 34 };

/* 몸통 겹침 방지(Pushbox) — Step 10-2 · 10-3
   같은 레인(lane px 이내)에서 히어로와 적·보스가 한 몸처럼 겹쳐 서지 않게
   최소 X 이격을 유지한다. 판정(정면·리치·레인)은 손대지 않고 좌표만 부드럽게 민다.
     enemy      : 히어로 ↔ 적 최소 X 이격
     boss       : 히어로 ↔ 보스 최소 X 이격
     enemyEnemy : 적 ↔ 적 최소 X 이격 (Step 10-3 — 적끼리 한 점에 겹쳐 서지 않게) */
G.PUSHBOX = { lane: 36, enemy: 58, boss: 115, enemyEnemy: 34, speed: 900 };

G.spawnX = (side) => {
  const s = G.SPAWN[side === 'left' ? 'left' : 'right'];
  return G.rand(s[1], s[0]);
};

/* ------------------------------------------------------------------
 * 화면 배치 (Step 9-1) — 모바일 세로 화면 대응
 *   가로(1280×720)는 종전 그대로: 세계·HUD·로비가 모두 1280×720 한 좌표계다.
 *   세로(aspect < 1)는 두 좌표계로 나뉜다.
 *     · 세계(월드)  : 1280×720 캔버스를 화면 폭에 맞춰 축소해 위쪽 띠에 둔다
 *     · UI(HUD·로비) : 화면 픽셀(= CSS px) 좌표계. 폭·높이에 맞춰 다시 배치한다
 *   V.mode / V.w · V.h 는 지금 화면, V.world 는 월드 띠의 배율·위치를 든다.
 * ------------------------------------------------------------------ */
G.VIEW = {
  mode: 'landscape',
  w: G.W,
  h: G.H,
  world: { x: 0, y: 0, scale: 1, w: G.W, h: G.H },
  bandBottom: G.H,
  /* 세로 화면 카메라 (Step 10-1) — 가로에서는 zoom 1 · x/y 0 · active false 로 종전 그대로다.
     x·y 는 지금 보이는 월드 창의 왼쪽 위(월드 좌표), visW·visH 는 그 창의 크기. */
  cam: { active: false, zoom: 1, x: 0, y: 0, visW: G.W, visH: G.H },
};
G.isPortrait = () => G.VIEW.mode === 'portrait';

/* 판정 표시 선 두께 보정 (Step 10-3)
   세로는 월드를 폭 맞춤 띠로 줄이고 카메라 확대를 곱하므로, 화면 배율이 1보다 작아
   2.6px 판정선이 화면에서 1.3px 로 가늘게 보인다. 세로일 때만 배율의 역수를 곱해
   가로와 같은 굵기로 보이게 하고, 가로(1280×720)는 1.0 그대로 둔다.
     portMin·portMax : 보정 배율의 하한·상한 (너무 굵어지지 않게 2.0배에서 멈춘다) */
G.JUDGE = { portMin: 1.5, portMax: 2.0 };

/* ------------------------------------------------------------------
 * 세로 추적 카메라 (Step 10-1)
 *   세로 화면은 1280×720 월드를 폭에 맞춰 줄이면 띠가 390×219 로 납작해져
 *   캐릭터가 작게 보인다. 세로일 때만 월드를 zoom 배(띠 기준)로 키우고
 *   히어로 X 를 부드럽게 따라가되, 창이 월드(0~1280 · 0~720) 밖으로 나가지 않게
 *   클램프한다. 점프·보스처럼 세로로 길어지면 zoom 을 잠깐 낮춰 머리·발이
 *   화면 밖으로 잘리지 않게 한다. 가로(1280×720)는 이 값을 쓰지 않는다.
 *     zoom      : 서 있을 때 확대 배율(띠 높이 기준)
 *     minZoom   : 점프·보스 때 줄어드는 하한
 *     padTop    : 머리 위 여유(월드 px)
 *     padGround : 서 있을 때 발밑 앞쪽 여유(월드 px) / padAir : 공중일 때
 *     followX   : 좌우 추적 속도(초당 지수) / followY : 위아래 추적 속도
 *     zoomOut   : 확대를 풀 때 속도 / zoomIn : 다시 확대할 때 속도
 *     bossBias  : 보스전에서 보스 쪽으로 치우치는 정도(0~0.5)
 * ------------------------------------------------------------------ */
G.CAM = {
  zoom: 1.62,
  minZoom: 1.24,
  padTop: 22,
  padGround: 74,      // 서 있을 때 발밑 앞쪽 여유(월드 px)
  padAir: 18,         // 공중일 때는 앞쪽 여유를 줄여 머리·발을 다 담는다
  followX: 5.2,
  followY: 6.0,
  followYAir: 16.0,
  zoomOut: 10.0,
  zoomIn: 3.2,
  bossBias: 0.45,
};

G.fmtTime = (sec) => {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

G.num = (n) => Math.round(n).toLocaleString('en-US');

/* 간단한 트윈 러너 */
G.Tweens = class {
  constructor() { this.list = []; }
  add(obj, key, to, dur, ease = G.easeOutCubic, onDone = null) {
    const from = obj[key];
    const tw = { obj, key, from, to, dur, t: 0, ease, onDone };
    this.list.push(tw);
    return tw;
  }
  kill(obj) { this.list = this.list.filter((t) => t.obj !== obj); }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const p = G.clamp(tw.t / tw.dur, 0, 1);
      tw.obj[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(p);
      if (p >= 1) {
        this.list.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }
  }
};
