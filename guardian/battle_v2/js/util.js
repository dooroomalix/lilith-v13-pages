/* 마지막 성문의 수호자 — 전투 v2
 * util.js : 상수, 수학, 이징, 텍스트 스타일
 */
window.G = window.G || {};

G.VERSION = 'v5.8.1-build481';
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
 * 타격감 규격 (Step 4-1) — 히트스톱·넉백·카메라 셰이크의 단일 기준표.
 * 애니메이션 타이밍(COMBO.dur/hit)은 actors.js, "손맛" 수치는 여기서만 관리한다.
 *   stop : 히트스톱(초). 0.03 = 2프레임 정지, 0.085 = 막타 5프레임 정지
 *   shake: 카메라 셰이크 진폭(px), shakeDur: 흔들림 감쇠 시간
 *   knock: 적에게 주는 넉백 초기 속도(px/s)
 * ------------------------------------------------------------------ */
G.FEEL = {
  cap: 0.17,                       // 히트스톱 상한 — 이 이상은 조작감이 끊긴다
  combo: [
    { stop: 0.030, shake: 4.5, shakeDur: 0.14, knock: 220 },   // 1타: 가볍고 빠르게
    { stop: 0.048, shake: 6.5, shakeDur: 0.17, knock: 300 },   // 2타: 조금 묵직하게
    { stop: 0.085, shake: 11.0, shakeDur: 0.24, knock: 470 },  // 3타(막타): 확실히 무겁게
  ],
  air: { stop: 0.058, shake: 7.5, shakeDur: 0.20, knock: 390 },// 공중 공격: 내려찍는 무게
  bossHit: { stopScale: 1.7, shakeScale: 1.5 },                // 보스를 맞혔을 때
  crit: { stopScale: 1.35, shakeScale: 1.3 },                  // 크리티컬
  multiFinisher: { stopScale: 1.12, shakeScale: 1.12 },         // 막타 다중 히트
  killBoss: { stop: 0.18, shake: 18, shakeDur: 1.2 },
  perfect: { stop: 0.14, shake: 18, shakeDur: 0.6 },
  skillTick: { stop: 0.026, shake: 5, shakeDur: 0.16, minGap: 0.20, knock: 130 },
  ult: { stop: 0.075, shake: 20, shakeDur: 0.55, knock: 520, bossKb: 120 },
  support: {
    ara: { stop: 0.030, shake: 5, shakeDur: 0.2, knock: 600 },   // 등불의 온기: 부드러운 파동
    born: { stop: 0.075, shake: 13, shakeDur: 0.32, knock: 620 },// 강철의 일격: 가장 묵직
    sena: { stop: 0.040, shake: 6, shakeDur: 0.26, knock: 0 },   // 기록의 인장: 마법적
  },
  hurt: {                          // 카엘이 맞았을 때
    heavyAt: 60,                   // 이 피해량 이상이면 강한 피격 연출
    light: { stop: 0.045, shake: 7, shakeDur: 0.20 },
    heavy: { stop: 0.085, shake: 12, shakeDur: 0.30 },
  },
};

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
G.spawnX = (side) => {
  const s = G.SPAWN[side === 'left' ? 'left' : 'right'];
  return G.rand(s[1], s[0]);
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
