/* stages.js : 스테이지 · 구역 · 보스 페이즈 정의 (Step 4-3 → Step 9-3, v5.11.0-build510)
 *
 * 성문 앞 전장을 **구역(zone)** 으로 나눠 횡스크롤 웨이브를 이어 붙인다.
 *   1구역 척후대 돌파  →  2구역 정예 웨이브  →  보스 아르카논 결전
 *
 * 3스테이지(Step 9-3)는 같은 성문 전장을 '그림자 성채'로 옮긴 심층전이다.
 *   배경 tint·전용 오버레이(look: 'citadel')로 자줏빛 어둠을 깔고, 웨이브·보스
 *   체력·제한 시간·보상을 한 단계 더 올린다. 조작·판정 체계는 그대로다.
 *
 * 설계 원칙
 *  - 스테이지 1(기본)의 웨이브 표는 v5.5.0 까지 쓰던 값 그대로다
 *    (4 · 240/14 → 5 · 280/16 → 6 · 320/18 → 6 · 360/20). 그래서 기본 출격 흐름
 *    "바로 적 스폰 → 4웨이브 → 보스 조우"는 회귀 테스트에서 한 톨도 달라지지 않는다.
 *  - v5.8.0(2.5D): 스폰은 좌·우 양방향을 번갈아 쓰고, 각 구역의 마지막 웨이브는
 *    `dual: true` 로 좌·우에서 동시에 들어온다(수치는 그대로).
 *  - 구역은 그 4웨이브를 2+2로 나눠 이름만 붙인 것이므로 판정·수치는 그대로다.
 *  - 스테이지 2는 같은 전장을 더 강한 정예 웨이브로 다시 도는 결전 모드다.
 *    (새 배경을 만들지 않고 배경 색온도·지역명·보스 체력으로 결전의 공기를 낸다)
 */
(function () {
  const STAGES = [
    {
      key: 'gate',
      order: 1,
      name: '성문 외곽 수비전',
      short: '성문 외곽',
      en: 'GATE OUTSKIRTS',
      tag: '척후대를 밀어내고 성문 앞을 지켜라',
      area: '폐허의 거리',
      bossArea: '폐허의 왕좌',
      bossName: '그림자 군주 아르카논',
      bossTitle: '그림자 군주 아르카논',
      bossHp: 24000,
      timeLimit: 60,
      bossTime: 180,
      bgTint: 0xffffff,            // 기본(푸른 밤) 그대로
      accent: 0x9fd0ff,
      look: 'gate',
      reward: { name: '성문의 파편', count: 1 },
      zones: [
        {
          name: '1구역 · 척후대 돌파',
          short: '1구역',
          waves: [
            { count: 4, hp: 240, atk: 14 },
            { count: 5, hp: 280, atk: 16, dual: true },   // 구역 마지막 웨이브는 좌·우 동시 진입
          ],
        },
        {
          name: '2구역 · 정예 웨이브',
          short: '2구역',
          waves: [
            { count: 6, hp: 320, atk: 18, elite: 1 },
            { count: 6, hp: 360, atk: 20, elite: 2, dual: true },
          ],
        },
      ],
    },
    {
      key: 'frontline',
      order: 2,
      name: '최전선 결전',
      short: '최전선',
      en: 'THE FRONTLINE',
      tag: '아르카논이 직접 나선다 — 정예만 남았다',
      area: '최전선 황야',
      bossArea: '아르카논의 진지',
      bossName: '그림자 군주 아르카논 · 결전',
      bossTitle: '그림자 군주 아르카논 · 결전',
      bossHp: 32000,
      timeLimit: 70,
      bossTime: 210,
      bgTint: 0xffb08a,            // 노을·핏빛으로 물든 결전의 전장
      accent: 0xffc247,
      look: 'frontline',
      reward: { name: '결전의 증표', count: 2 },
      zones: [
        {
          name: '1구역 · 정예 선봉',
          short: '1구역',
          waves: [
            { count: 5, hp: 330, atk: 20, elite: 1 },
            { count: 6, hp: 380, atk: 22, elite: 2, dual: true },
          ],
        },
        {
          name: '2구역 · 결전의 문턱',
          short: '2구역',
          waves: [
            { count: 7, hp: 430, atk: 24, elite: 3 },
            { count: 6, hp: 470, atk: 26, elite: 3, dual: true },
          ],
        },
      ],
    },
    {
      key: 'citadel',
      order: 3,
      name: '그림자 성채',
      short: '성채',
      en: 'SHADOW CITADEL',
      tag: '성채 깊은 곳 — 아르카논의 본체가 기다린다',
      area: '성채 회랑',
      bossArea: '어둠의 왕좌',
      bossName: '그림자 군주 아르카논 · 본체',
      bossTitle: '아르카논 · 어둠의 본체',
      bossHp: 40000,
      timeLimit: 78,
      bossTime: 240,
      bgTint: 0x8f7dff,            // 자줏빛 어둠 — 성채의 공기
      accent: 0xc9a8ff,
      look: 'citadel',
      reward: { name: '성채의 봉인 조각', count: 3 },
      zones: [
        {
          name: '1구역 · 성채 외벽',
          short: '1구역',
          waves: [
            { count: 6, hp: 470, atk: 27, elite: 2 },
            { count: 7, hp: 520, atk: 29, elite: 3, dual: true },
          ],
        },
        {
          name: '2구역 · 어둠의 회랑',
          short: '2구역',
          waves: [
            { count: 7, hp: 580, atk: 31, elite: 4 },
            { count: 8, hp: 640, atk: 34, elite: 4, dual: true },
          ],
        },
      ],
    },
  ];

  /* 스테이지 하나를 전투가 쓰는 평평한 웨이브 목록 + 구역 경계로 펼친다.
     waves[i] = { count, hp, atk, zone }   zones[z] = { name, short, from, to } */
  G.buildStageWaves = function (stage) {
    const st = stage || STAGES[0];
    const waves = [];
    const zones = [];
    (st.zones || []).forEach((z, zi) => {
      const from = waves.length;
      (z.waves || []).forEach((w) => waves.push({
        count: w.count, hp: w.hp, atk: w.atk, elite: w.elite || 0, dual: !!w.dual, zone: zi,
      }));
      zones.push({ name: z.name, short: z.short, from, to: waves.length });
    });
    return { waves, zones };
  };

  /* ---- 보스 아르카논 2페이즈 (Step 9-2) ----------------------------------
   * HP 비율이 `min` 이상이면 그 페이즈. 1스테이지(24000)·2스테이지(32000) 보스가
   * 같은 표를 쓴다 — 스테이지별 체력·피해·시간은 STAGES 쪽에서 이미 다르다.
   *   atk   : 다음 공격까지 대기(최소, 최대) — 낮을수록 자주 친다
   *   tele  : 바닥 예고 시간 배율 (낮을수록 회피가 빡빡하다)
   *   dmg   : 피해 배율       radius: 장판·충격파 범위 배율
   *   pool  : 쓰는 패턴        adds: 'summon' 소환수 수    chain: 이어 치기 확률
   * 1페이즈는 v5.9.0 까지의 보스 리듬(예고 배율 1.0 · 간격 1.55~2.3초 · 4패턴)을
   * 그대로 두고, 2페이즈에서 간격·예고·피해를 조이고 연속(chain)과 combo 를 더한다.
   * 즉사 방지는 피해 배율 1.12 로 묶어 두고, 예고는 0.86배까지만 줄인다.
   * ---------------------------------------------------------------------- */
  const BOSS_PHASES = [
    {
      key: 'P1', label: '1페이즈', min: 0.51,
      atk: [2.30, 1.55], tele: 1.0, dmg: 1.0, radius: 1.0,
      pool: ['slam', 'line', 'multi', 'perfect'], adds: 2, chain: 0,
      cut: null,
    },
    {
      key: 'P2', label: '2페이즈', min: 0.0,
      atk: [1.80, 1.15], tele: 0.86, dmg: 1.12, radius: 1.06,
      pool: ['slam', 'line', 'multi', 'combo', 'perfect', 'summon'], adds: 3, chain: 0.28,
      cut: {
        move: '2페이즈 · 어둠의 침식',
        en: 'PHASE 2',
        line: '제법 버티는군. 그럼 이제 성문의 빛부터 꺼 볼까.',
      },
    },
  ];

  /* HP 비율 → 페이즈 번호 */
  G.bossPhaseAt = function (ratio) {
    let idx = 0;
    for (let i = 1; i < BOSS_PHASES.length; i++) if (ratio < BOSS_PHASES[i - 1].min) idx = i;
    return idx;
  };

  G.BOSS_PHASES = BOSS_PHASES;

  G.stageByKey = function (key) {
    for (let i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i];
    return STAGES[0];
  };

  /* 스테이지 난이도 요약 — 로비 카드·검증이 같은 숫자를 본다 */
  G.stageLoad = function (stage) {
    const st = stage || STAGES[0];
    const built = G.buildStageWaves(st);
    let enemies = 0, hp = 0, elite = 0;
    built.waves.forEach((w) => { enemies += w.count; hp += w.hp * w.count; elite += w.elite; });
    return {
      key: st.key, order: st.order, zones: built.zones.length, waves: built.waves.length,
      enemies, hp, elite, bossHp: st.bossHp, bossTime: st.bossTime, timeLimit: st.timeLimit,
      reward: st.reward || null,
    };
  };

  G.STAGES = STAGES;
})();
