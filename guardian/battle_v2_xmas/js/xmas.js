/* xmas.js : 《메리 크리스마스! 성문을 지켜라》 외전 테마 정의
 * - 타이틀/스테이지 문구, 겨울 팔레트
 * - 외전 적 3종(스노우볼·미믹·루돌프)과 보스 노엘의 전투 수치·연출 파라미터
 * - 노엘 3페이즈(HP 구간별 패턴·공격 속도·연출)와 성문 광장 등불 기믹 정의
 * 본편(battle_v2_sd)과 분리된 독립 프로젝트라 본편 코드·에셋은 읽지 않는다.
 */
(function () {
  const X = {
    ON: true,
    TITLE: '메리 크리스마스! 성문을 지켜라',
    TITLE_EN: 'MERRY CHRISTMAS · GUARD THE GATE',
    SERIES: '마지막 성문의 수호자 외전',
    VERSION: 'XMAS-2.0.0-build030',
    STAGE_NAME: '성문 광장',
    BOSS_STAGE_NAME: '눈보라 왕좌',
    STAGE_MSG: 'XMAS · 눈 내리는 성문 광장',
    BOSS_MSG: 'BOSS · 다크 산타 노엘',
    START_TEXT: '터치하여 축제 시작',
    LOADING_TEXT: '축제의 성문을 여는 중…',
    INTRO_HINT: '음악은 시작한 뒤 잠시 후 흐릅니다 · 가로 화면 권장',

    palette: {
      night: 0x0a1428,
      snow: 0xe8f4ff,
      blue: 0x6fb4ff,
      cool: 0x9fd8ff,
      amber: 0xffc36a,
      crimson: 0xc21f36,
      gold: 0xf2d48a,
    },

    /* 웨이브 적 — 체급(bodyPx)과 예고 시간은 2026-11-22 설계안 수치를 따른다 */
    enemies: {
      snowball: {
        key: 'snowball', label: '폭주 스노우볼', sd: 'snowball_sd',
        hp: 340, atk: 15, speed: 158, bodyPx: 205, stopDist: 275,
        windup: 0.55, rest: 1.55, move: 'roll', dash: 310,
        halo: 0x8fd0ff, tele: 0x7fc4ff,
      },
      mimic: {
        key: 'mimic', label: '선물 도둑 미믹', sd: 'mimic_sd',
        hp: 420, atk: 17, speed: 172, bodyPx: 200, stopDist: 300,
        windup: 0.70, rest: 1.50, move: 'charge', dash: 560,
        halo: 0xc79bff, tele: 0xc9a8ff,
      },
      rudolph: {
        key: 'rudolph', label: '어둠의 루돌프', sd: 'rudolph_sd',
        hp: 520, atk: 19, speed: 142, bodyPx: 218, stopDist: 215,
        windup: 0.90, rest: 0.95, move: 'bell', dash: 0, teleR: 205,
        halo: 0xff9a8a, tele: 0xff8080,
      },
    },

    boss: {
      label: '다크 산타 · 노엘',
      sd: 'noel_sd',
      bodyPx: 330,
      hp: 20000,
      /* 페이즈별 장판 색 — 푸른 등불의 빛과 검붉은 코트를 함께 쓴다 */
      teleColors: {
        slam: 0x7fb4ff, line: 0xff5a6e, multi: 0x9fd8ff,
        combo: 0xffcc66, perfect: 0xffffff, summon: 0xb98bff,
      },
      skills: {
        slam: { move: '눈보라 배달', en: 'BLIZZARD DELIVERY' },
        line: { move: '썰매 돌진', en: 'SLEIGH RUSH' },
        multi: { move: '삼중 눈덩이', en: 'TRIPLE SNOWBALL' },
        perfect: { move: '마지막 종소리', en: 'THE LAST BELL' },
        summon: { move: '선물 소동', en: 'GIFT TROUBLE' },
      },
      sub: 'DARK SANTA QUEEN',

      /* ---- 3페이즈: HP 비율 min 이상이면 그 페이즈 ----
       * atk   : 다음 공격까지 대기(최소, 최대) — 페이즈가 오를수록 짧아진다
       * tele  : 바닥 예고 시간 배율(짧을수록 회피가 빡빡하다)
       * dmg   : 피해 배율
       * radius: 장판·충격파 범위 배율
       * pool  : 사용하는 패턴 목록
       * adds  : '선물 소동' 소환 수
       * chain : 공격 뒤 곧바로 이어 치는 확률(연속 패턴)
       */
      phases: [
        {
          key: 'P1', label: '1페이즈', min: 0.71,
          atk: [2.35, 1.60], tele: 1.0, dmg: 1.0, radius: 1.0,
          pool: ['slam', 'line', 'multi'], adds: 2, chain: 0,
          cut: null,
        },
        {
          key: 'P2', label: '2페이즈', min: 0.36,
          atk: [1.95, 1.28], tele: 0.88, dmg: 1.12, radius: 1.08,
          pool: ['slam', 'line', 'multi', 'summon', 'combo'], adds: 3, chain: 0.22,
          cut: {
            move: '2페이즈 · 눈보라 역습', en: 'PHASE 2',
            line: '쳇, 제법이네. 그래도 눈보라는 이제부터 진짜야.',
          },
        },
        {
          key: 'P3', label: '3페이즈', min: 0.0,
          atk: [1.55, 1.00], tele: 0.78, dmg: 1.28, radius: 1.16,
          pool: ['slam', 'line', 'multi', 'perfect', 'summon', 'combo'], adds: 4, chain: 0.45,
          cut: {
            move: '3페이즈 · 마지막 종소리', en: 'PHASE 3',
            line: '마지막 종이 울린다. 성문의 불빛, 오늘로 끝내 줄게.',
          },
        },
      ],
    },

    /* ---- 노엘 대사 — 자연스러운 구어체로만 쓴다 ---- */
    noel: {
      appear: '메리 크리스마스. 인사는 여기까지, 선물은 내가 챙겨 갈게.',
      lanternOut: '불빛이 하나 줄었네. 어둠이 참 잘 어울려.',
      allOut: '봐, 이제 광장이 내 색이야. 손이 시리지 않아?',
      relight: '쳇… 불을 다시 붙였다고?',
      defeat: '알겠어… 올해는 네가 이긴 걸로 해 두지.',
      taunts: [
        '선물은 이미 다 내 썰매에 실렸어. 이제 성문까지 가져갈 뿐이야.',
        '그 불빛, 언제까지 버틸 수 있을까?',
        '손이 시려우면 그만두는 게 어때?',
      ],
    },

    /* ---- 성문 광장 등불: 소등 & 재점화 ---- */
    lanterns: {
      spots: [
        { x: 214, y: 522 }, { x: 468, y: 638 },
        { x: 756, y: 528 }, { x: 1014, y: 640 },
      ],
      relightRadius: 96,      // 카엘 x 거리
      relightDepth: 84,       // 카엘 y 거리
      proximityTime: 0.75,    // 꺼진 등불 옆에 머물면 자동 재점화
      windInterval: [10.5, 7.0],  // 주기적 암흑 바람 (최대, 최소)
      windPhaseStep: 0.78,    // 페이즈가 오를 때마다 주기 단축 배율
      buffPerLantern: 0.05,   // 켜진 등불 1개당 공격력 +5%
      regenPerLantern: 1.6,   // 켜진 등불 1개당 초당 회복 (2개 이상부터)
      chillDmgTaken: 1.35,    // 전부 소등됐을 때 받는 피해 배율
    },

    /* 화면 연출 문구 */
    waveMsg: (i) => `XMAS WAVE ${i}`,
  };
  G.Xmas = X;
})();
