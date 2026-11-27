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
    VERSION: 'XMAS-2.5.0-build080',
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

      /* ---- Step 11-2: 1차 중파 → 각성 → 광폭화 ----
       * form 흐름: base → damaged(본전 HP 30% 이하) → awakening(본전 격파) → berserk(각성 HP 30% 이하)
       * hpMul 4.0 = 체력 +300%(4배), dmgMul 3.0 = 데미지 +200%(3배), aspdMul 3.0 = 공격 속도 +200%(3배)
       * 즉사 방지 — 각성 이후 예고 시간 하한(teleMin)과 1회 피해 상한(heroDmgCap)을 함께 둔다.
       */
      forms: {
        damaged: {
          key: 'damaged', label: '중파', badge: '중파',
          hpThreshold: 0.30,
          rig: 'noel_damaged',
          portrait: 'portraitNoelDamaged',
          aura: 0x8a1f3a, auraAlpha: 0.30, rim: 0xff6a7e,
          cut: {
            move: '중파 · 무너진 산타', en: 'DAMAGED  ·  PHASE 1',
            line: '하… 아직이야. 선물도, 이 불빛도, 아직 하나도 안 끝났어.',
          },
          voices: { skill1: 'noel_damaged', skill2: 'noel_damaged2', skill3: 'noel_damaged2', hit: 'noel_damaged_hit' },
        },
        awakening: {
          key: 'awakening', label: '각성', badge: '각성',
          name: '각성 · 노엘',
          hpMul: 4.0,        // 체력 +300%
          dmgMul: 3.0,       // 데미지 +200%
          teleMin: 0.36,     // 예고 시간 하한(즉사 방지)
          heroDmgCap: 0.42,  // 1회 피해 상한 = 히어로 최대 체력의 42%
          aura: 0x5b2bd6, auraAlpha: 0.36, rim: 0x9f7bff,
          cut: {
            move: '각성 · 성문의 흑월', en: 'AWAKENING',
            line: '웃기지 마. 크리스마스는 내가 지키는 거야. 아무도 못 보내.',
          },
          voice: 'noel_awake',
        },
        berserk: {
          key: 'berserk', label: '광폭화', badge: '광폭화',
          hpThreshold: 0.30,
          aspdMul: 3.0,      // 공격 속도 +200% (대기·예고 모두 가속)
          dmgMul: 1.15,      // 광폭화 추가 피해
          selfDmg: 0.045,    // 공격할 때마다 최대 체력의 4.5% 자해
          teleMin: 0.34,
          aura: 0xc21f36, auraAlpha: 0.46, rim: 0xff3b5c,
          cut: {
            move: '광폭화 · 마지막 종', en: 'BERSERK',
            line: '네가, 네가 전부 망쳤어! 이 손 놓을 때까지 안 끝나!',
          },
          voice: 'noel_berserk',
        },
      },

      /* Step 11-1 — 표정 4종과 스킬 모션 이름 (HUD·검증에서 같이 본다) */
      faces: {
        normal: { label: '여유', color: 0xffd9a0 },
        focus: { label: '집중', color: 0xff8fa8 },
        hit: { label: '피격', color: 0xff6a7e },
        flustered: { label: '당황', color: 0x9fd8ff },
      },
      motions: {
        glide: '벨벳 활공 보행',
        sackWind: '자루 끌어올리기', sackSwing: '자루 휘두르기', sackTrip: '자루에 걸려 휘청',
        giftWind: '선물 들어올리기', giftThrow: '선물 투척',
        bellAbsorb: '등불 빛 흡수', bellRelease: '종소리 방출',
      },

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
      /* Step 11-1 — 보스·몬스터 보이스 파일 / Step 11-2 — 중파·각성·광폭화 보이스 */
      voice: {
        intro: 'noel_intro', skill1: 'noel_skill1', skill2: 'noel_skill2',
        skill3: 'noel_skill3', hit: 'noel_hit',
        damaged: 'noel_damaged', damaged2: 'noel_damaged2', damagedHit: 'noel_damaged_hit',
        awake: 'noel_awake', berserk: 'noel_berserk',
        scream: 'noel_scream', plea1: 'noel_plea1', plea2: 'noel_plea2', plea3: 'noel_plea3', farewell: 'noel_farewell',
      },
    },

    /* ---- Step 11-3 : 최종 격파 시네마틱 · 모래먼지 엔딩 ----
     *  격파 → 한 맺힌 비명 → 「다시는 돌아오지 못하게 된 것 같아 / 죽기 싫어」 반복 → 출전 캐릭터가
     *  다가가 손을 잡으면 발끝부터 모래먼지로 사라지고, 잡은 손만 남았다가 그것도 바람에 흩어진다.
     *  대사는 전부 구어체. 보이스는 ElevenLabs 한국어 PVC(Eunha −1.1반음)로 만든 파일을 쓴다.
     */
    ending: {
      fallX: 556, fallY: 664, fallW: 520,   // 쓰러진 노엘 — 화면 좌표(1280×720)
      heroDx: 300, heroY: 702,              // 다가가 무릎 꿇는 자리(오른쪽 아래·앞줄)
      windX: 1.0,                           // 모래가 날리는 방향(오른쪽)
      praise: '으아아아아악—!',
      plea1: '다시는… 돌아오지 못하게 된 것 같아…',
      plea2: '죽기 싫어… 죽기 싫어!',
      plea3: '아직… 아직 죽기 싫어… 제발…',
      farewell: '고마워… 이제… 조금만 쉬어도 될까…',
      heroWalk: '…노엘.',
      heroLine: '…응. 잡았어. 이제 그만 아파해도 돼.',
      handLine: '손끝에서 모래가 흐른다',
      skip: '건너뛰기',
      hand: { x: 669.12, y: 151.5, w: 254, h: 202 },
    },

    /* 몬스터 보이스 — {variant}_atk / {variant}_hit */
    monsterVoice: {
      snowball: { atk: 'snowball_atk', hit: 'snowball_hit' },
      mimic: { atk: 'mimic_atk', hit: 'mimic_hit' },
      rudolph: { atk: 'rudolph_atk', hit: 'rudolph_hit' },
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
