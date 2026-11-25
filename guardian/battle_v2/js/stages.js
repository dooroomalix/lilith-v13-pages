/* stages.js : 스테이지 · 구역 정의 (Step 4-3, v5.6.0-build460)
 *
 * 성문 앞 전장을 **구역(zone)** 으로 나눠 횡스크롤 웨이브를 이어 붙인다.
 *   1구역 척후대 돌파  →  2구역 정예 웨이브  →  보스 아르카논 결전
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

  G.stageByKey = function (key) {
    for (let i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i];
    return STAGES[0];
  };

  G.STAGES = STAGES;
})();
