/* chars.js : 크리스마스 외전 5인 플레이어블 정의 (Step 6)
 * - 로비에서 고른 캐릭터가 그대로 전투 메인으로 출전한다
 * - 캐릭터마다 기본 공격 콤보·스킬(K)·궁극기(L)·무기·이펙트 색·대사·보이스가 다르다
 * - 스킨은 파츠 전체를 갈아입는 완전 교체(기본 전투복 / 산타 코트 / 다크 레드 연회복)
 */
(function () {
  const SKIN_LABEL = {
    basic: { name: '기본 전투복', tag: '기본' },
    santa: { name: '산타 코트', tag: '겨울' },
    gala: { name: '다크 레드 연회복', tag: '연회' },
  };

  const C = {
    kael: {
      key: 'kael', name: '카엘', role: '성문기사', artFacing: 1,
      bodyPx: 332, hpMax: 780, atk: 152, mainArm: 'far', weapon: 'greatsword',
      skinNames: { basic: '성문기사 갑주', santa: '산타 코트', gala: '다크 레드 연회복' },
      colors: { slash: 0xc21f36, slash2: 0xffd9a0, edge: 0xfff3c4, glow: 0x5fb0ff, ult: 0xc9a8ff, ult2: 0xfff3c4 },
      voice: { atk: 'kael_atk', skill: 'kael_skill', ult: 'lia_ult' },
      combo: [
        { dmg: 1.00, reach: 252, ang: -0.34, spread: 1.30 },
        { dmg: 1.12, reach: 258, ang: 0.26, spread: 1.24 },
        { dmg: 1.85, reach: 300, ang: -0.08, spread: 1.52 },
      ],
      skill: { name: '성문의 참격', en: 'GATE CLEAVE', mp: 25, cd: 7, dmg: 2.75, radius: 300, kind: 'cleave' },
      ult: { name: '성광 폭쇄', en: 'LUMEN BURST', mp: 40, cd: 13, dmg: 3.4, radius: 260, kind: 'pillar' },
      lines: [
        '성문은 내가 지킨다. 축제도, 사람도.',
        '이 검은 반짝이지. 성탄엔 더 그렇고.',
        '리아, 뒤는 맡길게. 앞은 내가 뚫는다.',
        '눈이 이만큼 쌓였는데… 애들 웃는 소리가 들려.',
        '물러서지 않아. 오늘만큼은.',
      ],
    },
    lia: {
      key: 'lia', name: '리아', role: '성광 마도사', artFacing: 1,
      bodyPx: 320, hpMax: 690, atk: 140, mainArm: 'near', weapon: 'orb',
      skinNames: { basic: '성광 마도복', santa: '산타 코트', gala: '다크 레드 연회복' },
      colors: { slash: 0xb98bff, slash2: 0xe8dcff, edge: 0xffffff, glow: 0xb98bff, ult: 0xd7c2ff, ult2: 0xffffff },
      voice: { atk: 'kael_atk', skill: 'kael_skill', ult: 'lia_ult' },
      combo: [
        { dmg: 0.92, reach: 236, ang: -0.10, spread: 1.45 },
        { dmg: 1.00, reach: 244, ang: 0.10, spread: 1.40 },
        { dmg: 1.70, reach: 286, ang: 0.00, spread: 1.65 },
      ],
      skill: { name: '서리 별빛', en: 'FROST STAR', mp: 25, cd: 7, dmg: 2.2, radius: 320, kind: 'starfall' },
      ult: { name: '성광의 심판', en: 'LUMEN JUDGEMENT', mp: 40, cd: 13, dmg: 3.2, radius: 300, kind: 'pillar' },
      lines: [
        '빛은 꺼지지 않아. 우리가 켜 두는 한은.',
        '별이 이렇게 가까운 밤이었구나.',
        '카엘 옆에 서면 등이 따뜻해져.',
        '등불이 꺼지면 내가 다시 밝힐게.',
        '조금만 기다려. 빛을 모으고 있어.',
      ],
    },
    ara: {
      key: 'ara', name: '아라', role: '온기의 치유사', artFacing: 1,
      bodyPx: 300, hpMax: 720, atk: 132, mainArm: 'near', weapon: 'bowl',
      skinNames: { basic: '순례자의 외투', santa: '산타 코트', gala: '다크 레드 연회복' },
      colors: { slash: 0xffb066, slash2: 0xffe7c4, edge: 0xfff6e0, glow: 0xffb066, ult: 0xffd166, ult2: 0xfff3c4 },
      voice: { atk: 'kael_atk', skill: 'ara_support', ult: 'ara_support' },
      combo: [
        { dmg: 0.86, reach: 224, ang: -0.18, spread: 1.35 },
        { dmg: 0.94, reach: 232, ang: 0.18, spread: 1.30 },
        { dmg: 1.55, reach: 268, ang: 0.00, spread: 1.55 },
      ],
      skill: { name: '온기의 기도', en: 'WARM PRAYER', mp: 25, cd: 8, dmg: 1.4, radius: 210, kind: 'prayer', heal: 0.22 },
      ult: { name: '축복의 성탄', en: 'BLESSED NOEL', mp: 40, cd: 14, dmg: 2.4, radius: 300, kind: 'blessing', heal: 0.45 },
      lines: [
        '이거… 따뜻해요. 나눠 먹을래요?',
        '아픈 데는 없어요? 제가 손 볼게요.',
        '성탄엔 다 같이 웃어야 하는 거래요.',
        '등불 하나만 켜져도 길은 보여요.',
        '제가 뒤에서 불 붙일게요. 가요!',
      ],
    },
    born: {
      key: 'born', name: '보른', role: '강철의 대장장이', artFacing: 1,
      bodyPx: 322, hpMax: 880, atk: 160, mainArm: 'near', weapon: 'hammer',
      skinNames: { basic: '대장간 앞치마', santa: '산타 코트', gala: '다크 레드 연회복' },
      colors: { slash: 0xff8a4a, slash2: 0xffd9a0, edge: 0xfff0d0, glow: 0xff8a4a, ult: 0xffb066, ult2: 0xfff3c4 },
      voice: { atk: 'kael_atk', skill: 'born_support', ult: 'born_support' },
      combo: [
        { dmg: 1.15, reach: 244, ang: -0.22, spread: 1.25 },
        { dmg: 1.20, reach: 250, ang: 0.20, spread: 1.22 },
        { dmg: 2.05, reach: 292, ang: 0.00, spread: 1.45 },
      ],
      skill: { name: '강철의 일격', en: 'IRON STRIKE', mp: 25, cd: 8, dmg: 2.4, radius: 260, kind: 'quake', stun: 1.6 },
      ult: { name: '대지의 종소리', en: 'EARTHEN BELL', mp: 40, cd: 14, dmg: 3.0, radius: 340, kind: 'quake', stun: 2.2 },
      lines: [
        '망치 한 번이면 눈길도 뚫린다.',
        '이 나이에 산타 옷이라니… 뭐, 따뜻하군.',
        '등불은 꺼지면 다시 켜면 돼. 살아 있으면.',
        '애들아, 뒤로 물러나 있어라. 내가 앞을 친다.',
        '강철도 성탄엔 반짝이지. 좋은 밤이야.',
      ],
    },
    sena: {
      key: 'sena', name: '세나', role: '밤그늘 추적자', artFacing: 1,
      bodyPx: 316, hpMax: 660, atk: 148, mainArm: 'near', weapon: 'dagger',
      skinNames: { basic: '밤그늘 사냥복', santa: '산타 코트', gala: '다크 레드 연회복' },
      colors: { slash: 0x8fd6ff, slash2: 0xe8f6ff, edge: 0xffffff, glow: 0x8fd6ff, ult: 0x9fd6ff, ult2: 0xffffff },
      voice: { atk: 'kael_atk', skill: 'sena_support', ult: 'sena_support' },
      combo: [
        { dmg: 0.88, reach: 240, ang: -0.40, spread: 1.15 },
        { dmg: 0.98, reach: 246, ang: 0.36, spread: 1.12 },
        { dmg: 1.68, reach: 280, ang: 0.00, spread: 1.40 },
      ],
      skill: { name: '서리 발자국', en: 'FROST TRAIL', mp: 25, cd: 7, dmg: 1.9, radius: 250, kind: 'frost', slow: 2.4 },
      ult: { name: '한밤의 사냥', en: 'MIDNIGHT HUNT', mp: 40, cd: 13, dmg: 3.6, radius: 240, kind: 'hunt' },
      lines: [
        '발소리 줄여. 저쪽에 뭐가 있어.',
        '눈밭은 흔적이 잘 남아서 좋아.',
        '성탄이라고 방심하지 마. 밤은 그대로야.',
        '네 뒤는 내가 볼게. 앞만 봐.',
        '한 번에 끝낼게. 눈 감고 있어.',
      ],
    },
  };

  C.order = ['kael', 'lia', 'ara', 'born', 'sena'];
  C.skins = ['basic', 'santa', 'gala'];
  C.skinLabel = SKIN_LABEL;

  C.get = (k) => C[k] || C.kael;
  C.rigKey = (k, skin) => k + '_' + (skin || 'basic');
  C.portrait = (k, skin) => 'assets/rig/portrait/' + k + '_' + (skin || 'basic') + '.webp';
  C.skinName = (k, skin) => (C[k] && C[k].skinNames[skin]) || SKIN_LABEL[skin].name;

  G.CHARS = C;
})();
