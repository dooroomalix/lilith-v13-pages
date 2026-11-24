/* 마지막 성문의 수호자 — 전투 v2
 * util.js : 상수, 수학, 이징, 텍스트 스타일
 */
window.G = window.G || {};

G.VERSION = 'v5.4.1-build441';
G.ASSET_V = 'a5.4.0';   // 이미지/시트 캐시 무효화용 (에셋을 갱신하면 올린다)
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
