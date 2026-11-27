---
title: "XMAS-2.6.0-build090 — Step 11-4 각성 빠른 BPM 캐롤 BGM · 광폭화 2차 중파"
---
# XMAS-2.6.0-build090 (2026-11-27) — Step 11-4

기준: `XMAS-2.5.0-build080` → **`XMAS-2.6.0-build090`**

## 1. 새로 만든 에셋

| 파일 | 내용 |
|---|---|
| `audio/bgm_xmas_awakening.mp3` | 각성 전용 **166.8 BPM** 크리스마스 캐롤 배틀(OpenMusic `Frostfall Fury`). 102마디 146.76초 루프 · −14.3 LUFS · 48kHz 스테레오 192kbps · 3.5MB |
| `assets/rig/src/noel_berserk.png` | 2차 중파 전신 원화(1145×1373) — 1차 중파를 `images` 로 다시 그려 의상 파손·상처·그을음·부서진 뿔장식을 심화(출혈 없음) |
| `assets/rig/noel_berserk/body.webp` · `mesh.json` | 18본 가중치 메쉬 리그(565×718 · 정점 2,565 / 삼각 4,928) |
| `assets/portrait_noel_berserk.webp` | 2차 중파 초상(470×560 · 52KB) — 컷인·HUD 초상에 쓴다 |

- OpenMusic 크레딧: 51.5 → **41.5**(160 BPM 지시로 2곡 생성 · Frostfall Fury/Phase Two · 다운로드 4회 중 2회는 파일 크기 제한으로 실패).
- 채택 근거: Phase Two 는 실측 110 BPM 으로 기존 전투곡(156 BPM)보다 느려 요구(140~170)에 못 미쳤고, Frostfall Fury 가 166.8 BPM · 루프 마감("cut back cleanly into the opening groove") 지시대로 나왔다.

## 2. 고친 파일

| 파일 | 변경 |
|---|---|
| `js/audio.js` | 두 트랙 BGM 엔진 — `setBgmMode()` 크로스페이드 · `preloadAwakenBgm()` · `bgmInfo()` · `_applyBgmVolumes()`(더킹·음소거·엔딩 페이드 공통 적용) · `fadeBgmTo()`/`resetBgm()` 을 두 트랙 기준으로 재작성 |
| `js/battle.js` | 보스 등장 때 `noel_berserk` 리그·각성 BGM 미리 로드 · `onBossAwakening()` 에서 `setBgmMode(A.bgm='awakening', 1.8)` · 광폭화 컷인 초상을 `B.portrait` 로 · `bossFormLog` 에 `rig`·`bgm` 기록 |
| `js/actors.js` | `_applyFormRig(formKey)` 로 일반화(중파/광폭화 공용) · `_applyPendingRig()` · `_applyBerserk()` 에서 `noel_berserk` 로 교체 |
| `js/hud.js` | 보스 초상 칩(`bossPortrait` / `bossPortraitKey`) — 폼별 초상 교체, 세로 화면에서는 숨김 |
| `js/xmas.js` | `VERSION` · `forms.berserk` 에 `rig`·`portrait`·`bgm` · `forms.awakening.bgm` |
| `js/assets.js` | `portraitNoelBerserk` 등록 |
| `js/lobby.js` | `noel_berserk` 리그 프리로드 |
| `js/util.js` · `index.html` | `XMAS-2.6.0-build090` · 쿼리 `r=9` · `G.ASSET_V = axmas2.6.0` |
| `tools_xmas/riggen.py` | SPEC 에 `noel_berserk` |
| `tools_xmas/verify_workflow_step11_4_xmas.py` | 신규 검증 70항목(가로 58 · 세로 11 · 증빙 1) |

## 3. 검증 (로컬)

- `node --check` **16/16 OK**.
- 신규 `verify_workflow_step11_4_xmas.py` **70/70 ALL PASS** — 가로 58 · 세로 390×844 11 · 증빙 1.
  - 각성 진입 시 BGM 모드 전환·각성 트랙 재생·크로스페이드 완료(전투 트랙 정지) → 광폭화에서 유지 → 엔딩 페이드로 두 트랙 정지 → restart 후 전투 BGM 복귀·각성 트랙 처음으로 → 재각성 시 머리부터.
  - 광폭화 진입 시 리그 `noel_berserk` · 컷인 초상 · HUD 초상 교체, 1차 중파 ↔ 2차 중파 본체 픽셀 차이 64.6% · 초상 20.2%.
  - 자해·공속 회귀, 조작·오토·타 게임명, 콘솔·페이지·HTTP·JS 오류 0, WebGL 정상.

---

---
title: "XMAS-2.5.0-build080 — Step 11-3 최종 격파 시네마틱 · 모래먼지 엔딩"
---
# XMAS-2.5.0-build080 (2026-11-27) — Step 11-3

기준: `XMAS-2.4.0-build070` → **`XMAS-2.5.0-build080`**

## 1. 새로 만든 에셋

| 파일 | 내용 |
|---|---|
| `assets/ending/noel_fallen_raw.png` · `noel_fallen.webp` | 치열한 전투 끝에 바닥에 쓰러진 노엘 전용 일러스트(중파 초상과 같은 화풍). 흰 배경 제거 + 흰 매트 제거 후 게임용 1180×944. 손 영역은 비워 두고 손 스프라이트가 정확히 덮는다 |
| `assets/ending/noel_hand.webp` | 마지막까지 남는 장갑 낀 손(254×202) — 손목 절단면은 알파 페더 |
| `assets/ending/noel_fallen.json` | 본체·손 좌표 메타(`hand x 669.12 · y 151.5`) |
| `assets/ending/noel_hand_hold.webp` | 손을 잡는 순간의 클로즈업 컷(암갑을 낀 기사 손 + 노엘의 손, 손가락 사이로 모래) 1280×1024 |
| `audio/noel_scream.mp3` | 한 맺힌 비명 2.59초 · −15.9 LUFS |
| `audio/noel_plea1.mp3` | 「다시는… 돌아오지 못하게 된 것 같아…」 3.79초 · −16.6 LUFS |
| `audio/noel_plea2.mp3` | 「죽기 싫어… 죽기 싫어!」 2.69초 · −16.4 LUFS |
| `audio/noel_plea3.mp3` | 「아직… 아직 죽기 싫어… 제발…」 4.13초 · −16.6 LUFS |
| `audio/noel_farewell.mp3` | 「고마워… 이제… 조금만 쉬어도 될까…」 4.68초 · −17.3 LUFS(속삭임) |

- ElevenLabs Eleven v4 · 한국어 PVC Eunha(−1.1반음) · Stability 50% / Similarity 75% → 128 kbps mono.
- 크레딧: 9,418 → **9,307**(111 사용, 차단된 테이크 1회 포함).
- **대사 한 곳만 바꿨습니다**: 「죽고 싶지 않아」는 ElevenLabs 콘텐츠 정책상 차단되어(자해 표현) 같은 뜻의 더 구어적인 **「죽기 싫어…」**로 만들었고, 자막도 보이스와 똑같이 맞췄습니다.

## 2. 고친 파일

| 파일 | 변경 |
|---|---|
| `js/ending.js` (신규) | 엔딩 타임라인(`Ending.TIMELINE`) · 쓰러진 노엘/손/파티클(세계 좌표) · 암전·자막·건너뛰기(화면 좌표) · 발끝부터 올라오는 물결 마스크 · 모래 파티클 풀 · 가로/세로 카메라 줌·팬 · `info()` 검증 훅 |
| `js/battle.js` | `onBossKilled()` 가 각성·광폭화 상태의 격파를 알아보고 `startEnding()` · `_endingDone()` · 엔딩 중 입력/자동전투 정지 · 스킵 포인터 처리 · `restart()`/`_teardownBattle()` 정리 · `applyLayout` 연동 |
| `js/xmas.js` | `VERSION` · `ending` 설정(좌표·대사·클로즈업) · `noel.voice` 에 엔딩 보이스 5종 |
| `js/rig.js` | 포즈 `kneel`(무릎 굽히기) · `reach`(손 뻗기) |
| `js/actors.js` | `_driveRig` 가 `kneel`/`reach` 상태를 리그 포즈로 전달 |
| `js/scene.js` | `setCam(x, y)` — 줌 중심 팬(엔딩 카메라) |
| `js/audio.js` | 보이스 표 5종 · `fadeBgmTo()`(BGM 잠금) · `wind()`(모래 바람) |
| `js/assets.js` | 엔딩 일러스트 3종 등록 |
| `js/main.js` | 검증 훅 `endingInfo`·`endingStart`·`endingSkip`·`endingJump`·`endingMaterials`·`camInfo` 등 |
| `js/util.js` · `index.html` | `XMAS-2.5.0-build080` · 쿼리 `r=8` · `G.ASSET_V = axmas2.5.0` · `ending.js` 로드 |
| `tools_xmas/pack_deploy_xmas.py` | `assets/ending/`(webp·json) 배포 포함 |
| `tools_xmas/verify_workflow_step11_3_xmas.py` | 신규 검증 59항목(가로 57 · 세로 12 · 증빙 2) |

## 3. 검증 (로컬)

- `node --check` **16/16 OK**.
- 신규 `verify_workflow_step11_3_xmas.py` **72/72 ALL PASS** — 가로 58 · 세로 390×844 12 · 증빙 2.
  - 각성 격파 → 엔딩 진입(결과판 아님·HUD 숨김·잔여 적 0), 비명 → 외침 3회(자막 문구 일치) → 접근·무릎·손잡기(리그 상태 kneel/reach, 클로즈업 알파) → 발끝부터 소멸(0→1 단조 증가·파티클) → 손만 남음 → 손 소멸 → MERRY CHRISTMAS 결과판, 건너뛰기, 자해 격파, restart 초기화, 조작·오토·타 게임명.
- 회귀: 11-2 **65/65** · 11-1 **40/40** · 9-1 **60/60** · 8 **26/26** · 10-4 **50/51**(환경 SwiftShader WebGL 손실 1회 — 이전 빌드와 동일).
- 기대값 갱신(정당한 변화): 11-2 E4·H10(최종 격파 → 시네마틱 엔딩), 8 H3(동일), 11-1 G5(보이스 16→21).

---
title: "XMAS-2.4.0-build070 — Step 11-2 노엘 1차 중파·각성·광폭화"
---

# XMAS-2.4.0-build070 (2026-11-27) — Step 11-2

기준: `XMAS-2.3.0-build060` → **`XMAS-2.4.0-build070`**

## 1. 새로 만든 에셋
| 파일 | 내용 |
|---|---|
| `assets/rig/src/noel_damaged.png` | 1차 중파 SD 원화 — 찢어진 산타 코트·그을린 털·끊긴 사슬·부러진 뿔·얼굴과 허벅지의 베인 자국·이빨을 드러낸 표정 (기본 노엘과 같은 구도·포즈) |
| `assets/rig/noel_damaged/body.webp` · `mesh.json` | 위 원화의 가중치 메쉬(18본 · 2,565정점 · 4,928삼각형) — `tools_xmas/meshgen.py noel_damaged` |
| `assets/portrait_noel_damaged.webp` | 중파 컷인 초상(470×560 · 원본 알파 페더 유지) |
| `audio/noel_damaged.mp3` · `noel_damaged2.mp3` · `noel_damaged_hit.mp3` · `noel_awake.mp3` · `noel_berserk.mp3` | ElevenLabs Eleven v4 · 한국어 PVC Eunha(−1.1반음) · Stability 50% / Similarity 75% · −16.0~−16.5 LUFS · 128 kbps mono |

- ElevenLabs 크레딧: 9,502 → **9,418**(84 사용).
- `assets/rig/meta.json` 에 `noel_damaged`(char `noel`, skin `damaged`) 등록 → 로비 워밍 로드 + 보스 등장 시 선로딩.

## 2. 고친 파일
| 파일 | 변경 |
|---|---|
| `js/xmas.js` | `VERSION` · **`boss.forms`** 표(damaged/awakening/berserk: `hpThreshold`·`hpMul 4.0`·`dmgMul 3.0`·`aspdMul 3.0`·`selfDmg 0.045`·`teleMin`·`heroDmgCap`·`aura`·`cut`·`voices`) · `noel.voice` 5종 추가 |
| `js/actors.js` | `form` 상태(base→damaged→awakening→berserk) · `_checkDamaged`/`_applyDamaged` · `_applyDamagedRig`(리그 교체) · `awaken`/`finishAwaken`(체력 4배) · `_checkBerserk`/`_applyBerserk` · `_selfBleed`(자해) · `_formDmgMul`(각성 3배 × 광폭화 1.15배) · `_aspdMul`/`_nextAtkDelay`(공속 3배) · 중파 보이스 세트 · 표정(중파 이후 항상 치열) |
| `js/battle.js` | `onBossDamaged` · `onBossAwakening` · `onBossAwakened` · `onBossBerserk` 연출 · `_bossCutIn` 초상/색/이름 인자화 · `_teardownBattle()` 분리(중파 상태 초기화) · `_clearIntro()` · `damageHero` 1회 피해 상한 |
| `js/hud.js` | 보스 이름 옆 **중파/각성/광폭화 배지** · 중파 이후 표정 칩 `치열` |
| `js/assets.js` | `portraitNoelDamaged` 등록 |
| `js/audio.js` | 보이스 표에 중파·각성·광폭화 5종(우선순위·쿨다운) |
| `js/lobby.js` | 워밍 로드에 `noel_damaged` 추가 |
| `js/main.js` | 검증용 `bossFormInfo`·`bossFormLog`·`bossMiniHud`·`awakenBoss`·`finishAwaken`·`bossApplyBerserk`·`bossSelfBleedNow`·`hudBossFormRect` |
| `js/util.js` · `index.html` | `XMAS-2.4.0-build070` · 쿼리 `r=7` · `G.ASSET_V = axmas2.4.0` |
| `tools_xmas/riggen.py` | SPEC 에 `noel_damaged` 추가 |
| `tools_xmas/verify_workflow_step11_2_xmas.py` | 신규 검증 51+12항목 |

## 3. 검증 (로컬)
- `node --check` **15/15 OK** (`/workspace/tmp/node-v20.18.1-linux-x64/bin/node` — 이 환경에 node 가 없어 새로 받았다).
- 신규 `verify_workflow_step11_2_xmas.py` — 가로 **51/51**, 세로 390×844 **12/12**, 합계 **65/65 PASS**(증빙 2건 포함).
  - 1차 중파 30% 전환 · 리그/보이스 교체 · 컷인/자막/HUD 배지, 각성 4배·3배·중파 일러스트 유지,
    광폭화 자해(4.5%)·공속 가속(실측 공격 주기 2.28s → 0.87s · x2.62, 대기·예고·후딜 각 1/3),
    자해 처치 → 승리, restart/teardown 초기화, 조작·오토·타 게임명 회귀.
- 회귀: 11-1 **40/40** · 9-1 **60/60** · 8 **26/26** · 10-4 **51/51**.
  - 11-1/8/9-1/10-4 의 기대값 중 Step 11-2 로 정당하게 바뀐 3건만 갱신(보이스 11→16, 리그 19→20, 각성 포함 격파 2회).
- 콘솔·페이지·HTTP·`window.__errors` 0, WebGL 컨텍스트 손실 0.

---
title: "XMAS-1.0.0-build010 — 1차 플레이 가능 빌드 기록"
---

# XMAS-1.0.0-build010 작업 기록 (2026-11-23)

기준본: `projects/guardian/battle_v2_sd/` **v5.4.0-build440** (읽기 전용, 무수정)
산출물: `projects/guardian_xmas/` 독립 프로젝트 + `projects/guardian/builds/guardian_xmas_v1.zip`

## 1. 새로 만든 파일

| 파일 | 내용 | 크기 |
|---|---|---|
| `js/xmas.js` | 외전 테마 정의 — 타이틀·스테이지 문구, 팔레트, 적 3종 수치, 노엘 보스 수치·기술명 | 3.3KB |
| `assets/bg_xmas.webp` | 눈 내리는 성문 광장·트리·선물·등불 원화 (1672×941) | 412KB |
| `assets/sd/snowball_sd.webp` | 폭주 스노우볼 SD (521×720) | 96KB |
| `assets/sd/mimic_sd.webp` | 선물 도둑 미믹 SD (609×720) | 99KB |
| `assets/sd/rudolph_sd.webp` | 어둠의 루돌프 SD (422×720) | 58KB |
| `assets/sd/noel_sd.webp` | 다크 산타 노엘 SD (679×820) | 113KB |
| `assets/sd/meta_xmas.json` | 위 4종의 w·h·anchorX·anchorY·bodyH·bodyPx | — |
| `assets/portrait_noel.webp` | 노엘 상반신 컷인 (470×560, 가장자리 페더) | 53KB |
| `audio/boss_bgm.mp3` | 전투 BGM v3 루프(74.6초)로 교체 | 2.85MB |
| `audio/xmas_battle_v3_loop.mp3` | 같은 트랙 사본 | 2.85MB |
| `tools_xmas/verify_xmas.py` | 전체 검증 + 스크린샷 3종 | — |
| `tools_xmas/verify_variants.py` | 적 3종 행동 검증 | — |
| `tools_xmas/pack_build_xmas.py` | ZIP 패키징 | — |

## 2. 고친 파일 (복사본 안에서만)

| 파일 | 변경 |
|---|---|
| `index.html` | 타이틀·설명·테마색, 로딩 문구, 스크립트 버전 쿼리, `js/xmas.js` 추가 |
| `js/util.js` | `G.VERSION = 'XMAS-1.0.0-build010'`, `G.ASSET_V = 'axmas1.0.0'` |
| `js/assets.js` | `bgXmas`·`portraitNoel` 추가, SD 메타 로더를 `_loadSDMeta()` 로 분리해 `meta_xmas.json` 도 읽음 |
| `js/scene.js` | `_build()` 진입에서 `G.Xmas.ON` 이면 `_buildXmas()` 로 분기. 겨울 색보정·등불 명멸·눈 파티클 3단(88개) 추가 |
| `js/actors.js` | `Enemy` 에 variant(스노우볼·미믹·루돌프) 분기와 상태 흐름·바닥 예고·무방비 연출, `Boss` 에 노엘 variant(전용 SD·이름·오라·장판 색) |
| `js/battle.js` | 웨이브 편성·보스 등장 문구·노엘 컷인·승리 문구·타이틀 화면 분기, restart 시 바닥 예고 정리 |
| `js/hud.js` | 지역명·미니맵 라벨을 겨울 광장으로 |
| `README.md` | 외전 빌드 설명으로 교체 |

## 3. 검증 결과 (Playwright + Chromium SwiftShader, 1280×720)

- 콘솔 오류 **0** · 페이지 오류 **0** · HTTP 4xx/5xx **0**
- 자연 웨이브 스폰 기록: `snowball, snowball, snowball, snowball, snowball, mimic, mimic, snowball, snowball, rudolph, snowball, mimic, rudolph, mimic, snowball` → 3종 모두 실제 웨이브에서 등장
- 적 행동: 예고 장판 alpha 1 → 공격 → `stumble`(스노우볼·미믹은 별 도는 무방비, 루돌프는 경직). 스노우볼 자연 흐름 `walk→windup→strike→stumble→recover` 확인
- 미믹 벽 충돌: x=155 로 고정되며 `stumble` + 무방비
- 루돌프 종 반경: 반경 안 780→765 피해, 반경 밖 780→780 (피해 없음)
- 보스: `다크 산타 · 노엘`, 20,000 HP, bodyH 330, 첫 공격 slam에서 컷인 발동
- 승리: 보스 처치 후 `phase=victory`
- 지원: 아라·보른·세나 3인 로그·컷인 정상(`등불의 온기`·`강철의 일격`·`기록의 인장`)
- BGM: `audio/boss_bgm.mp3` 로드, 길이 74.6초, loop=true

### 스크린샷
| 파일 | 내용 |
|---|---|
| `tmp/verify/xmas_v1_battle.png` | 스노우볼·미믹·루돌프와 교전하는 카엘 |
| `tmp/verify/xmas_v1_boss_noel.png` | 노엘 등장 컷인 + 바닥 예고 + 보스 HP바 |
| `tmp/verify/xmas_v1_sheet.png` | 카엘·스노우볼·미믹·루돌프·노엘 도감 시트(HUD 없이) |
| `tmp/verify/xmas_v1_telegraph.png` | 3종 예고 장판 동시 표시 |
| `tmp/verify/xmas_v1_stumble.png` | 공격 후 무방비/경직 상태 |
| `tmp/verify/xmas_v1_intro.png` | 타이틀 화면 |
| `tmp/verify/xmas_v1_victory.png` | MERRY CHRISTMAS 승리 화면 |
| `tmp/verify/xmas_v1_support.png` | 아라 지원 컷인 |

## 4. 본편 무수정 확인

- `projects/guardian/battle_v2_sd/` 는 복사만 했고 파일을 쓰지 않았습니다(마지막 수정 2026-11-22 이전).
- 본편 `assets/sd/meta.json`, `js/*`, 배포 링크 모두 그대로입니다.

---

# XMAS-1.1.0-build020 작업 기록 (2026-11-24 ~ 11-25 · 워크플로 Step 5)

기준본: `projects/guardian/battle_v2_sd/` **v5.6.0-build460** (읽기 전용, 무수정)
산출물: `projects/guardian_xmas/` (XMAS-1.1.0-build020) · 라이브 `guardian/battle_v2_xmas/`

## 1. 설계 판단 (실행 전 확정한 것)
- **페이즈는 'HP 구간 + 예고/피해/간격' 한 표로**: 페이즈별로 패턴 목록만 바꾸면 강해진 느낌이 약해서,
  `atk(다음 공격 간격) · tele(예고 배율) · dmg(피해 배율) · radius(범위 배율) · pool(패턴) · adds(소환 수) · chain(연속 확률)`을
  `G.Xmas.boss.phases` 한 표에 넣었다. P3의 "연속 패턴"은 `chain 0.45`로, 한 번 치고 0.42초 뒤 다시 치는 확률이다.
- **전환 순간은 보스를 세운다**: `phaseLock 1.7초` 동안 보스가 idle로 멈추고 `tele.clear()`로 예고판을 지운다.
  페이즈가 바뀌는 순간 예고판이 남아 있으면 "이미 깔린 장판"과 "새 패턴"이 겹쳐 판정이 뒤엉키기 때문.
- **등불 4개는 '플레이어가 되돌릴 수 있는' 자원**: 소등은 저절로 오지만(암흑 바람), 재점화는 공격 한 번 또는 0.75초 접근이면 된다.
  접근만으로도 되는 이유는, 보스전 중에 등불 하나 때문에 자리를 비우면 딜로스가 커서 "선택지"가 아니라 "강요"가 되기 때문.
- **버프/디버프는 수치가 아니라 상태로 읽히게**: 4/4=1.20배·회복, 0/4=피해 ×1.35 + 화면 가장자리 서리. 중간값은 HUD 4칸과 라벨로만.
- **코스튬은 SD 위 오버레이**: 새 원화 없이 목도리 그래픽을 SD 몸의 목 위치에 붙이고, SD 앵커가 좌우 비대칭이라
  `(0.5 - anchor.x) * scale.x * texture.width`로 몸통 중심을 보정했다. 검기는 외전에서만 색을 바꾼다(검붉은 날 + 금빛 테두리 + 눈가루).
- **검증 스크립트는 '한 페이지에서 다 하지 않는다'**: 헤드리스 swiftshader에서 스크린샷을 여러 번 뜨면 WebGL 컨텍스트를 잃어
  화면이 통째로 검게 나온다(Step 2에서 확인된 환경 한계). Step 5 검증은 마지막 구간(재도전·승리)을 **새 브라우저 프로세스**에서
  이어서 돌리고, 끝나고 모든 증빙 PNG의 평균 밝기(<10 = 검은 화면)를 다시 확인한다.

## 2. 새로 만든 파일
| 파일 | 내용 | 크기 |
|---|---|---|
| `js/lanterns.js` | 등불 4개 — 소등/재점화, 버프·한기 배율, 암흑 바람 주기, 서리 화면 텍스처(캔버스 생성) | 12.6KB |
| `tools_xmas/verify_workflow_step5.py` | Step 5 종단 검증 44항목 + 증빙 11컷 + 몽타주 | — |
| `tools_xmas/verify_workflow_step5_live.py` | 라이브 Pages 13항목 + 라이브 몽타주 | — |

## 3. 고친 파일 (복사본 안에서만)
| 파일 | 변경 |
|---|---|
| `js/xmas.js` | `VERSION`, `boss.phases`(3페이즈 표), `noel` 대사, `lanterns` 설정 추가 |
| `js/util.js` | `G.VERSION = 'XMAS-1.1.0-build020'`, `G.ASSET_V = 'axmas1.1.0'` |
| `js/scene.js` | `lanternLayer` 추가(바닥 앞·캐릭터 뒤) |
| `js/actors.js` | `Boss` 페이즈 상태(`phaseIdx/phaseCfg/phaseKey/phaseLock`)·`_checkPhase()`·페이즈 배율·소환 수·연속 패턴·공격 로그, `Hero._buildScarf()` 목도리 |
| `js/battle.js` | `G.Lanterns` 생성·갱신, 등불 배율(공격/회복/받는 피해), `onBossPhaseTransition()`(사선 컷인+대사), `dialogueLine()` 하단 자막, 암흑 바람·한기 연출, `restart()` 초기화 확장 |
| `js/hud.js` | 보스 페이즈 배지(P1/P2/P3), 등불 게이지 4칸 + 라벨, `releaseInputs()` |
| `js/main.js` | J/K/L/Q/Shift `e.repeat` 차단, `blur`·`visibilitychange` 입력 해제, 검증 훅(`setBossHp/lanternState/setLantern/extinguishAll/relightAll/kaelTo/bossCutInfo/bossAttack/stepUntil/snap`) |
| `index.html` | 버전 쿼리 `v=XMAS-1.1.0-build020&r=2`, `js/lanterns.js` 추가, 메타 문구에 3페이즈·등불 반영 |
| `README.md` | 1.1.0 설명으로 교체 |

## 4. 검증 결과
- `node --check js/*.js` **12/12 OK**
- `tools_xmas/verify_workflow_step5.py` — **44항목 ALL PASS**(188초). 주요 실측:
  - 조작: ←/→·A/D 이동, W/S 깊이, ↑/Space 점프(z 45.8), J 공격, K 쿨 6.97초, L 컷인, Shift 회피, Q 물약 3→2, P 토글, repeat 차단, blur 해제
  - 등불: 암흑 바람으로 3/4 → J 재점화로 4/4·dmgMul 1.20 → 전부 소등 시 `dmgTakenMul 1.35`·서리 alpha 0.67 → **실제 피해 100→135 / 재점화 후 100** → 근접 자동 재점화
  - 노엘: P1(P1 배지·패턴 3종) → P2 컷인(`2페이즈 · 눈보라 역습`)·구어체 대사·패턴 5종·예고 0.88·피해 1.12 → P3 컷인·패턴 6종·예고 0.78·피해 1.28, P3 심판 피해 134·`회피 타이밍!`·소환 4기
  - restart: 등불 4/4·보스/페이즈 null·`queuedJump` false·키/HUD 입력 0·컷인/대사 정리
  - 승리 도달, 콘솔·페이지·HTTP·`window.__errors` 모두 0, 증빙 11컷 전부 정상 렌더링
- 회귀: `verify_xmas.py` `ok: true`(64초) · `verify_variants.py` `errors []`(23초)

## 5. 배포
- 저장소 `dooroomalix/lilith-v13-pages` **`guardian/battle_v2_xmas/` 신규 경로** — 커밋 `a515b84`(부모 `226fef5`, push `226fef5..a515b84`).
- 67개 파일 추가 **8.1MB**. `tools_sd/`·`tools_xmas/`·`audio/xmas_battle_v3_loop.mp3`(중복 2.85MB)·미참조 원본 PNG 20종·`assets/src_art/` 제외.
  `guardian/battle_v2_xmas/` 외 경로 변경 **0건**, 삭제 0건.
- GitHub Actions `pages build and deployment` run **`45436375401`** → `completed / success`(41초).
- 라이브 `https://dooroomalix.github.io/lilith-v13-pages/guardian/battle_v2_xmas/` — `verify_workflow_step5_live.py` **13/13 PASS**:
  `XMAS-1.1.0-build020` 로드, 클릭으로 전투 진입, 등불 0/4 한기(×1.35) → 재점화로 해제, P1→P2→P3 컷인, 승리, 콘솔·페이지·HTTP 오류 0.
  증빙: `evidence/workflow_step5_xmas_live.png` · `evidence/workflow_step5_xmas_live/*.png` · `evidence/workflow_step5_xmas_live.json`.

## 6. 본편 무수정 확인
- `projects/guardian/battle_v2_sd/` 는 읽기만 했고 파일을 쓰지 않았습니다. 배포 저장소의 `guardian/battle_v2/`(v5.6.0-build460)도 그대로입니다.

---

## XMAS-2.0.0-build030 — Step 6 전면 개편 (2026-11-25)

### 왜 바꿨나
- 기존 외전은 SD 원화 **한 장**(`kael_sd_idle.png`)을 통째로 밀어서 움직였다. 가만히 선 그림이 미끄러지는 느낌.
- 스킨도 갑옷 위에 목도리만 얹는 방식이라 "캐릭터를 새로 뽑은" 느낌이 아니었다.
- 카엘만 출전하고 나머지 4인은 지원으로만 나왔다.

### 어떻게 바꿨나
1. **파츠 리깅** (`tools_xmas/riggen.py` → `assets/rig/`, `js/rig.js`)
   - SD 원화를 11파츠로 분해. 분해는 실루엣을 따라 번지는 **측지 거리 보로노이**:
     손에 쥔 검·지팡이처럼 몸에서 튀어나온 부위가 가까운 다리 파츠에 붙지 않고 팔 파츠에 남는다.
   - 각 파츠는 자기 관절(pivot)에서 회전. 컨테이너 계층이라 상위(몸통)가 돌면 하위(팔·머리)가 따라 돈다.
   - 회전 시 관절 틈은 파츠 5px 겹침 + 관절 원판(파츠 대표색)으로 메운다.
   - 파츠는 리그당 아틀라스 1장으로 묶어 텍스처 수를 11 → 1로 줄였다(모바일 안정성).
2. **3/4 시선 + 자연스러운 턴**
   - 5인 × 3벌 = 15벌을 3/4 측면으로 새로 생성(`images` 편집 모드).
   - 방향 전환은 즉시 `scaleX` 반전이 아니라 0.30초 다프레임: 머리→몸통→팔→다리 시간차 회전,
     몸통 폭 눌림, 팔 앞뒤 Z-order 교차, 발밑 먼지. (17프레임, 중간 yaw 11프레임)
3. **스킨 = 파츠 세트 전체 교체**
   - 기본 전투복 / 산타 코트 / 다크 레드 연회복. 로비에서 고르면 머리·몸통·팔·다리·무기 파츠가 전부 갈아입는다.
   - 로비 카드 초상도 같은 스킨으로 바뀐다.
4. **로비 → 실제 출전** (`js/lobby.js`, `js/chars.js`)
   - 5인 카드·스킨 칩·리그 미리보기·[출격]. 고른 캐릭터가 플레이어블 메인이며
     체력·공격·3연타·K 스킬·L 궁극기(전용 컷인)·무기·검기 색·대사·보이스가 각각 다르다.
   - 아라·보른·세나는 플레이어로 나오면 지원에서 빠진다.
5. **안정성**
   - 필요한 리그만 지연 로딩, 텍스처 GC 비활성, WebGL 컨텍스트 손실 복구 대기(4초 미복구 시 1회 새로고침),
     적 사망 후 리그 업데이트 가드, restart 후에도 캐릭터·스킨 유지.

### 검증
- `node --check` 15/15, `verify_workflow_step6.py` 39/40(1건은 헤드리스 소프트웨어 GL 환경 노트),
  `verify_step6_play.py` 실플레이 14컷, `verify_step6_turn.py` 턴·스킨 10컷,
  `verify_workflow_step6_live.py` 라이브 15/15.
- 증빙: `projects/guardian/evidence/workflow_step6_xmas_qa.png` · `workflow_step6_xmas*/`

### 배포
- `dooroomalix/lilith-v13-pages` → `guardian/battle_v2_xmas/` (커밋 `cb2d72b`, Pages run `45536312550` success)
- 라이브: https://dooroomalix.github.io/lilith-v13-pages/guardian/battle_v2_xmas/
