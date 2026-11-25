---
title: "v5.0 SD 개조 — ChatGPT 패치 반영과 로컬 보정 기록"
---

# v5.0 SD 벨트스크롤 — ChatGPT 패치와 로컬 보정

## 1. ChatGPT 쪽에서 받은 것
- 개발 스레드 `https://chatgpt.com/c/6af82867-d3e4-83ee-ac88-90b6876d0793`, 지시 `GUARDIAN-SD-1121`(2026-11-21 09:5x).
- 업로드: 코드 ZIP(`index.html`, `js/` 9개, `assets/anim/meta.json`, `assets/sd/meta.json`, `README.md`), 그림 파일은 첨부하지 않고 이름·앵커만 meta로 전달.
- 회수: `downloads/guardian_sd_v5_build400.patch` (27,681 bytes, 7개 파일, +180/−59).
  - `index.html` 버전 쿼리 `5.0.0-build400`
  - `js/assets.js` SD 텍스처 로더, `js/audio.js` playVoice, `js/hud.js` 점프 버튼,
  - `js/main.js` Space/↑ 점프 입력 + 점프·bossTele 디버그 훅,
  - `js/battle.js` bossTeleLayer, queuedJump, 이동 중 스킬 허용, 오토의 장판 회피 점프,
  - `js/actors.js` z·vz 점프 물리, SD 스프라이트, 보스 패턴(slam/line/multi/perfect) 확장.
- 패치 그대로는 **부팅 실패**: `Cannot set property persp of #<Hero> which has only a getter`
  (`_applyScale()`가 `get persp()` 전용 접근자에 대입; class 본문은 strict mode라 예외). → 아래에서 수정.

## 2. 로컬에서 고친 것 (패치 적용 후)
| 항목 | 내용 |
|---|---|
| 부팅 크래시 | `persp` 대입 제거, 게터를 `clamp(1 + (y-588)*0.0011, 0.92, 1.08)`로 |
| SD 크기 | `250/텍스처높이`(583) → `bodyH` 기준. 카엘 232px, 정찰병 186px, 보스 382px |
| 그림자 | `multiply` 블렌드가 이 WebGL 환경에서 전혀 그려지지 않아 `normal` + 검정 틴트로 교체. 공중에서는 바닥에 남고 `z*0.12`만큼 작아짐 |
| 판정 | 그린 모양과 같은 타원 판정(`hypot(dx, dy/0.4) < r`)으로 통일 — 서 있으면 맞고, 세로로 빠지면 피해짐 |
| 깊이 범위 | y 492 ~ 664(기존 516~664)로 넓혀 세로 회피가 실제로 가능하게 |
| multi | 3개 원이 각자 예고(0.45초 간격)를 마치면 그 자리에서 터지도록 개별 타이머 |
| line | 예고 후 보스가 실제로 0.34초간 돌진(속도 1650→0)하며 잔불 파티클 |
| 예고 가독성 | 바닥판(암적색) + 위험색 + 차오르는 흰 링 + 외곽 글로우 + 십자 표식 + 마지막 0.22초 점멸 |
| 착지 연출 | `landT` 0.16초 스쿼시(가로 +12%, 세로 −16%) + 충격 링 |
| 잔상 | `fx.afterimage`가 숨은 옛 스프라이트 대신 SD 스프라이트를 복사하도록 |
| 보이스 | `playVoice(name, {min, chance})`로 최소 간격·확률. 카엘 공격 3.4초/50%, 스킬 2.5초/75% |
| 키 | ↑·Space = 점프, 깊이 이동은 W/S·조이스틱 (↑가 점프와 겹치지 않게) |

## 3. 검증 결과 (Playwright + 로컬 HTTP)
- 콘솔 오류 0 / 페이지 오류 0 / HTTP 4xx·5xx 0.
- X/Y 이동: 대각선 이동 시 `obj.zIndex = y` 동기화 확인.
- 점프: 정점 z=184px, 착지 z=0. 공중 공격 시 `jumpAttack` 세팅.
- 보스: slam/line/multi/perfect 예고가 월드 좌표에 표시, 순차 폭발 확인.
- 판정(스크립트 고정 시나리오): 서 있으면 50 피해 / 점프로 회피 0 / 타원 밖으로 이동 0 / line 46 피해 / multi 32 피해 / perfect는 점프해도 105 피해.
- 오토 3모드(manual·counter·full) 각 120프레임 무오류.
- 리아 궁극기 컷인 표시, SD 텍스처 6종 로드.
- 스크린샷: `tmp/verify/v5_sd_fight.png`, `v5_sd_jump.png`, `v5_sd_boss.png` (+ `v5_sd_cutin.png`).

## 4. 아직 남은 것
- 실기기(안드로이드 크롬)에서 프레임·터치 반응 확인.
- 후속: 리아 태그/협동 전투, 로비(터치 화면), SD 공격 프레임 2~3종 추가.

## 3. v5.1 보스 스킬 컷인 (2026-11-22, 로컬 작업 — GPT 산출물 아님)

GPT 스레드에서 받은 것이 아니라 이쪽에서 새로 만든 변경입니다.

- `assets/portrait_boss.png`(441×560, webp 동봉) — 아르카논 상반신 컷인 원화. 생성 후 `tools/chroma.py`로 초록 배경 제거 + 하단 페이드.
- `js/battle.js` — `onBossSkill(kind)`(쿨다운 13초·상태 가드), `_bossCutIn(info)`(오른쪽 배너·초상화·문구), `update()`의 컷인 트윈, `restart()` 정리.
- `js/actors.js` — `Boss.startAttack()`에서 `game.onBossSkill(kind)` 호출, 첫 공격을 `slam`으로 고정.
- `js/assets.js` — `portraitBoss` 텍스처 추가. `js/main.js` — `__debug.state()`에 `bossCutin`/`bossCutT`/`bossCutCD` 노출.
- 버그 수정: 첫 회피가 공격 캔슬로 나갈 때 `dodgeDir`/`dodgeY`/`dodgeYDir` 미설정으로 좌표가 NaN이 되던 문제(`Hero` 기본값 + `_tryDodge()` 캔슬 분기).
- 새 도구: `tools_sd/verify_boss_cutin.py`, `tools_sd/record_preview.py`.
