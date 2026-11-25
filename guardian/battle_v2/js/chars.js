/* chars.js : 본편 5인 플레이어블 정의 (Step 7)
 * - 로비에서 고른 캐릭터·스킨이 그대로 전투 메인으로 출전한다 (카엘 고정 해제)
 * - 캐릭터마다 체력·공격·3연타·K 스킬·L 궁극기·무기·검기 색·대사·보이스가 다르다
 * - 스킨은 파츠 세트를 통째로 갈아입는다: 성문 전투복 / 다크 레드 연회복 / 정예 정복
 * - 적(척후병·정예)과 보스(아르카논)의 3/4 리그 수치도 여기서 한 표로 관리한다
 */
(function () {
  const SKIN_LABEL = {
    basic: { name: '성문 전투복', tag: '기본' },
    gala: { name: '다크 레드 연회복', tag: '연회' },
    elite: { name: '정예 정복', tag: '정예' },
  };

  const C = {
    kael: {
      key: 'kael', name: '카엘', role: '성문기사', en: 'THE GATEKEEPER', artFacing: 1,
      bodyPx: 332, hpMax: 780, atk: 152, mainArm: 'far', weapon: 'greatsword',
      skinNames: { basic: '성문 전투복', gala: '다크 레드 연회복', elite: '정예 기사 갑주' },
      colors: { slash: 0x2f6bff, slash2: 0x9fd6ff, edge: 0xffd166, glow: 0x5fb0ff, ult: 0xb98bff, ult2: 0xe8f2ff },
      voice: { atk: 'kael_atk', skill: 'kael_skill', ult: 'kael_skill' },
      combo: [
        { dmg: 1.00, reach: 252, ang: -0.34, spread: 1.30 },
        { dmg: 1.12, reach: 258, ang: 0.26, spread: 1.24 },
        { dmg: 1.85, reach: 300, ang: -0.08, spread: 1.52 },
      ],
      skill: { name: '성문의 참격', en: 'GATE CLEAVE', mp: 25, cd: 7, dmg: 2.75, radius: 300, kind: 'cleave' },
      ult: { name: '성광 폭쇄', en: 'LUMEN BURST', mp: 40, cd: 13, dmg: 3.4, radius: 280, kind: 'pillar' },
      lines: [
        '문은 아직 서 있어. 오늘 밤도 내가 지킨다.',
        '이름은… 카엘. 방금 물었나? 미안해, 요즘 자꾸 잊어서.',
        '리아가 적어 두니까 괜찮아. 나는 검만 쥐면 돼.',
        '출격하기 전엔 숨 한 번 크게 쉬어. 그게 제일 중요해.',
        '네가 여기 서 있다는 것만으로도, 이 문은 조금 단단해진다.',
      ],
      resultLines: {
        victory: '문이 아직 서 있어. 이건 네가 있어서야. 고맙다고 말해 두고 싶었어.',
        defeat: '미안해, 이번엔 내가 물러났어. 다음엔 문 앞에서 한 발도 안 물러나.',
      },
    },
    lia: {
      key: 'lia', name: '리아', role: '성광 마도사', en: "LIGHT'S VERDICT", artFacing: 1,
      bodyPx: 320, hpMax: 690, atk: 140, mainArm: 'near', weapon: 'orb',
      skinNames: { basic: '성광 마도복', gala: '다크 레드 연회복', elite: '대마도사 정복' },
      colors: { slash: 0xb98bff, slash2: 0xe8dcff, edge: 0xffffff, glow: 0xb98bff, ult: 0xd7c2ff, ult2: 0xe8f2ff },
      voice: { atk: null, skill: 'lia_ult', ult: 'lia_ult' },
      combo: [
        { dmg: 0.92, reach: 236, ang: -0.10, spread: 1.45 },
        { dmg: 1.00, reach: 244, ang: 0.10, spread: 1.40 },
        { dmg: 1.70, reach: 286, ang: 0.00, spread: 1.65 },
      ],
      skill: { name: '서리 별빛', en: 'FROST STAR', mp: 25, cd: 7, dmg: 2.2, radius: 320, kind: 'starfall' },
      ult: { name: '성광의 심판', en: 'LUMEN JUDGEMENT', mp: 40, cd: 13, dmg: 3.2, radius: 300, kind: 'pillar' },
      lines: [
        '기록은 제가 해요. 당신은 잊어도 괜찮아요.',
        '오늘 아침까지 열아홉 장째예요. 스무 장이 되기 전에 한 번 봐 주실래요?',
        '문 앞에서 서성대는 건 좋아요. 다만 너무 오래는 하지 마요.',
        '빛은 아껴 쓰는 거예요. 넘치게 쓰면 그 틈으로 어둠이 들어와요.',
        '제가 앞에 서면 카엘이 뒤를 봐 줘요. 그게 제일 편해요.',
      ],
      resultLines: {
        victory: '오늘 일은 다 적어 뒀어요. 마지막 줄에 당신 이름을 제일 크게 썼고요.',
        defeat: '이번 건 연필로 적었어요. 지우고 다시 쓰면 되니까, 너무 상심 마요.',
      },
    },
    ara: {
      key: 'ara', name: '아라', role: '등불지기', en: "LAMPBEARER'S WARMTH", artFacing: 1,
      bodyPx: 300, hpMax: 720, atk: 132, mainArm: 'near', weapon: 'bowl',
      skinNames: { basic: '순례자의 외투', gala: '다크 레드 연회복', elite: '성당 예복' },
      colors: { slash: 0xffb066, slash2: 0xffe7c4, edge: 0xfff6e0, glow: 0xffb066, ult: 0xffd166, ult2: 0xfff3c4 },
      voice: { atk: null, skill: 'ara_support', ult: 'ara_support' },
      combo: [
        { dmg: 0.86, reach: 224, ang: -0.18, spread: 1.35 },
        { dmg: 0.94, reach: 232, ang: 0.18, spread: 1.30 },
        { dmg: 1.55, reach: 268, ang: 0.00, spread: 1.55 },
      ],
      skill: { name: '온기의 기도', en: 'WARM PRAYER', mp: 25, cd: 8, dmg: 1.4, radius: 210, kind: 'prayer', heal: 0.22 },
      ult: { name: '축복의 성문', en: 'BLESSED GATE', mp: 40, cd: 14, dmg: 2.4, radius: 320, kind: 'blessing', heal: 0.45 },
      lines: [
        '이 등불, 꺼지지 않게 제가 들고 있을게요.',
        '어두운 건 무섭지 않아요. 아무도 돌아오지 않는 게 무서운 거예요.',
        '왕관이 아니라 등불이래요. 그래도 이게 제일 자랑이에요.',
        '싸울 때는 제 뒤에 있으면 따뜻할 거예요.',
        '조금만 쉬었다 가요. 등불은 그동안 제가 지키고 있을게요.',
      ],
      resultLines: {
        victory: '등불이 아직 환해요. 오늘은 아무도 길을 잃지 않았네요.',
        defeat: '불을 조금 낮춰 뒀어요. 다시 나가실 때 제가 밝혀 드릴게요.',
      },
    },
    born: {
      key: 'born', name: '보른', role: '대장장이', en: 'IRON VERDICT', artFacing: 1,
      bodyPx: 322, hpMax: 880, atk: 160, mainArm: 'near', weapon: 'hammer',
      skinNames: { basic: '대장간 앞치마', gala: '다크 레드 연회복', elite: '대장간 정복' },
      colors: { slash: 0xff8a4a, slash2: 0xffd9a0, edge: 0xfff0d0, glow: 0xff8a4a, ult: 0xffb066, ult2: 0xfff3c4 },
      voice: { atk: null, skill: 'born_support', ult: 'born_support' },
      combo: [
        { dmg: 1.15, reach: 244, ang: -0.22, spread: 1.25 },
        { dmg: 1.20, reach: 250, ang: 0.20, spread: 1.22 },
        { dmg: 2.05, reach: 292, ang: 0.00, spread: 1.45 },
      ],
      skill: { name: '강철의 일격', en: 'IRON STRIKE', mp: 25, cd: 8, dmg: 2.4, radius: 260, kind: 'quake', stun: 1.6 },
      ult: { name: '대지의 종소리', en: 'EARTHEN BELL', mp: 40, cd: 14, dmg: 3.0, radius: 340, kind: 'quake', stun: 2.2 },
      lines: [
        '검은 직접 벼린 놈이 써야 쓸 만한 법이지.',
        '맞을 놈은 내가 다 맞아 줄 테니, 뒤에서 함부로 나오지 마라.',
        '화로는 아직 뜨겁다. 쇠는 식으면 다시 벼리면 되지만 사람은 다르지.',
        '돌아오면 어깨 좀 주무르게. 나보다 맞은 놈이 더 많아 보이니까.',
        '이 쇠소리 들리나? 저게 아직 살아 있다는 소리다.',
      ],
      resultLines: {
        victory: '검 상태 좋다. 손 볼 데 없어. 오늘은 앉아서 한 잔 하지.',
        defeat: '쇠는 다시 벼리면 된다고 했지. 앉아 봐, 어깨부터 풀자.',
      },
    },
    sena: {
      key: 'sena', name: '세나', role: '기록관', en: 'SEAL OF RECORDS', artFacing: 1,
      bodyPx: 316, hpMax: 660, atk: 148, mainArm: 'near', weapon: 'dagger',
      skinNames: { basic: '밤그늘 사냥복', gala: '다크 레드 연회복', elite: '야간 수호 정복' },
      colors: { slash: 0x8fd6ff, slash2: 0xe8f6ff, edge: 0xffffff, glow: 0x8fd6ff, ult: 0x9fd6ff, ult2: 0xffffff },
      voice: { atk: null, skill: 'sena_support', ult: 'sena_support' },
      combo: [
        { dmg: 0.88, reach: 240, ang: -0.40, spread: 1.15 },
        { dmg: 0.98, reach: 246, ang: 0.36, spread: 1.12 },
        { dmg: 1.68, reach: 280, ang: 0.00, spread: 1.40 },
      ],
      skill: { name: '서리 발자국', en: 'FROST TRAIL', mp: 25, cd: 7, dmg: 1.9, radius: 250, kind: 'frost', slow: 2.4 },
      ult: { name: '한밤의 사냥', en: 'MIDNIGHT HUNT', mp: 40, cd: 13, dmg: 3.6, radius: 240, kind: 'hunt' },
      lines: [
        '성문 앞에서 일어난 일은 전부 기록에 남아. 손대지 마.',
        '느리게 움직이면 적기 편해. 그런데 네 속도가 나을 때가 많더라.',
        '이름은 한 번만 말해. 두 번 들으면 나도 헷갈려.',
        '잊는 건 기록이 없어서야. 그래서 나는 절대 안 지워.',
        '지금 이 순간도 적고 있어. 나중에 웃을 일이 하나쯤은 생기겠지.',
      ],
      resultLines: {
        victory: '승리는 짧게 적어. 대신 날짜는 정확하게.',
        defeat: '패배도 기록이야. 지우진 않아. 다음 줄이 기다리고 있을 뿐이지.',
      },
    },
  };

  C.order = ['kael', 'lia', 'ara', 'born', 'sena'];
  C.skins = ['basic', 'gala', 'elite'];
  C.skinLabel = SKIN_LABEL;

  C.get = (k) => C[k] || C.kael;
  C.rigKey = (k, skin) => k + '_' + (skin || 'basic');
  C.portrait = (k, skin) => 'assets/rig/portrait/' + k + '_' + (skin || 'basic') + '.webp';
  C.skinName = (k, skin) => (C[k] && C[k].skinNames[skin]) || (SKIN_LABEL[skin] || SKIN_LABEL.basic).name;

  /* ---------------------------------------------------------------- 본편 적
   * 척후병(scout)은 기존 판정·수치를 그대로 두고 3/4 리그만 입힌다.
   * 정예(elite)는 2스테이지·2구역부터 섞이는 중갑. 느리고 단단하고 크다. */
  C.enemies = {
    scout: {
      key: 'scout', label: '그림자 척후병', rig: 'scout', bodyPx: 186,
      hpMul: 1.0, atkMul: 1.0, speedMul: 1.0, stopMul: 1.0,
      halo: 0xa06bff, tele: 0xb45bff, windup: 0.52, rest: 0.7, lv: 2,
    },
    elite: {
      key: 'elite', label: '그림자 정예 기사', rig: 'elite', bodyPx: 250,
      hpMul: 1.9, atkMul: 1.25, speedMul: 0.72, stopMul: 1.12,
      halo: 0x8a5bff, tele: 0xd24a6a, windup: 0.66, rest: 0.85, lv: 4,
    },
  };

  /* ---------------------------------------------------------------- 본편 보스 */
  C.boss = {
    key: 'arcanon', label: '그림자 군주 아르카논', rig: 'arcanon', bodyPx: 430, sd: 'boss_sd',
    halo: 0xff5a3c, tele: 0xff3355, aura: 0xff2a3c,
  };

  G.CHARS = C;
})();
