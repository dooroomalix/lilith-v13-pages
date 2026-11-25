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
