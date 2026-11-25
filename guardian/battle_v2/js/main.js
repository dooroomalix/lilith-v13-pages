/* main.js : 부팅, 화면 스케일, 입력 연결, 메인 루프 */
(function () {
  const errBox = document.getElementById('err');
  window.__errors = [];
  function fail(msg) {
    window.__errors.push(String(msg));
    errBox.style.display = 'block';
    errBox.textContent = window.__errors.slice(-4).join('\n');
  }
  window.addEventListener('error', (e) => fail((e.message || 'error') + ' @ ' + (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', (e) => fail('promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));

  const canvas = document.getElementById('game');
  const loading = document.getElementById('loading');
  const loadbar = document.getElementById('loadbar');

  let app = null;
  let game = null;
  let curW = G.W, curH = G.H;

  /* 화면 배치 (Step 9-1)
     가로(1280×720): 지금까지 그대로 — 16:9 판을 화면 안에 맞춰 가운데 둔다.
     세로: 캔버스가 화면을 꽉 채우고, 월드는 폭에 맞춰 축소한 띠로 위쪽에 놓는다.
           HUD·로비는 화면 픽셀 좌표로 다시 배치된다 (hud.relayout / lobby). */
  function measure() {
    const vw = Math.max(240, Math.round(window.innerWidth || 0) || 240);
    const vh = Math.max(240, Math.round(window.innerHeight || 0) || 240);
    const portrait = vw < vh;
    return { vw, vh, portrait, mode: portrait ? 'portrait' : 'landscape' };
  }

  function fit() {
    const m = measure();
    const tw = m.portrait ? m.vw : G.W;
    const th = m.portrait ? m.vh : G.H;
    if (!m.portrait) {
      const s = Math.min(m.vw / G.W, m.vh / G.H);
      canvas.style.width = Math.round(G.W * s) + 'px';
      canvas.style.height = Math.round(G.H * s) + 'px';
    }
    if (app && (tw !== curW || th !== curH)) {
      app.renderer.resize(tw, th);
      curW = tw; curH = th;
    }
    if (m.portrait) {
      canvas.style.width = m.vw + 'px';
      canvas.style.height = m.vh + 'px';
    }
    G.VIEW.mode = m.mode;
    G.VIEW.w = curW;
    G.VIEW.h = curH;
    if (game && game.applyLayout) game.applyLayout(m.mode, curW, curH);
    return m;
  }

  async function boot() {
    const res = Math.min(window.devicePixelRatio || 1, 2);
    const m0 = measure();
    curW = m0.portrait ? m0.vw : G.W;
    curH = m0.portrait ? m0.vh : G.H;
    G.VIEW.mode = m0.mode;
    G.VIEW.w = curW;
    G.VIEW.h = curH;
    app = new PIXI.Application();
    // 검증(스크린샷) 세션에서만 프레임 버퍼를 보존한다 — ?capture=1
    const capture = typeof location !== 'undefined' && /[?&]capture=1/.test(location.search);
    await app.init({
      canvas,
      width: curW,
      height: curH,
      resolution: res,
      autoDensity: false,
      antialias: true,
      background: 0x05070d,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: capture,
    });
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 120));

    try {
      await G.Assets.load((p) => { loadbar.style.width = Math.round(p * 100) + '%'; });
    } catch (e) {
      fail('asset load: ' + e.message);
      return;
    }

    // 파츠 리그 목차(rig meta) — 로비 미리보기·전투 출전이 같은 표를 본다
    try { await G.Rigs.loadMeta('assets/rig/meta.json'); } catch (e) { fail('rig meta: ' + e.message); }

    const game2 = new G.Game(app);
    game = game2;
    window.__GAME = game;
    if (game.applyLayout) game.applyLayout(G.VIEW.mode, G.VIEW.w, G.VIEW.h);
    app.ticker.add(() => {
      const dt = Math.min(app.ticker.deltaMS / 1000, 0.05);
      if (game.frozen) return;
      try {
        game.update(dt);
      } catch (e) {
        fail('update: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]);
        app.ticker.stop();
      }
    });

    // ---- 입력 ----
    function localPos(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / Math.max(1, r.width)) * G.VIEW.w,
        y: ((e.clientY - r.top) / Math.max(1, r.height)) * G.VIEW.h,
      };
    }
    const active = new Map();
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = localPos(e);
      active.set(e.pointerId, p);
      // 화면 가장자리 밖으로 손가락이 이동해도 드래그/해제 이벤트를 받는다.
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      game.handlePointerDown(p.x, p.y, e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = localPos(e);
      if (active.has(e.pointerId)) game.handlePointerMove(p.x, p.y, e.pointerId);
    });
    const up = (e) => {
      const p = localPos(e);
      if (active.has(e.pointerId)) {
        active.delete(e.pointerId);
        game.handlePointerUp(p.x, p.y, e.pointerId);
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    // 캡처가 외부 요인으로 사라진 경우에도 입력이 붙잡히지 않도록 정리한다.
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      game.keys[k] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      G.Sfx.resume();
      // 로비에서는 전투 키가 먹지 않는다 — 소리 토글과 Enter(출격), 1/2(스테이지 선택)만
      if (game.phase === 'lobby') {
        if (!e.repeat) {
          if (k === 'm') game.lobby.toggleSound();
          else if (k === 'Enter') { const ch = game.lobby.chosen(); game.deployFromLobby(ch.key, ch.skin); }
          else if (/^[1-9]$/.test(k) && Number(k) <= G.STAGES.length) game.lobby.selectStage(Number(k) - 1);
        }
        return;
      }
      if (k === 'j' && !e.repeat) game.hud.input.attack = true;
      if (k === ' ' && !e.repeat) game.hud.input.jump = true;
      if (k === 'ArrowUp' && !e.repeat) game.hud.input.jump = true;
      if (k === 'k' && !e.repeat) game.hud.input.skill1 = true;
      if (k === 'l' && !e.repeat) game.hud.input.skill2 = true;
      if ((k === 'r' || k === 'c') && !e.repeat) game.hud.input.coop = true;   // 리아 협동 (Step 4-3)
      if (k === 'q' && !e.repeat) game.hud.input.potion = true;
      if (k === 'Shift' && !e.repeat) game.hud.input.dodge = true;
      if (k === 'h' && !e.repeat) game.toggleDebugBoxes();      // 2.5D 판정 박스 (기본 OFF)
      // 길게 누르는 동안 keydown 반복으로 토글이 여러 번 실행되지 않도록 제한
      if (!e.repeat) {
        if (k === 'Escape' || k === 'p') game.togglePause();
        if (k === 'm') { game.muted = G.Sfx.toggleMute(); }
        if (k === 't') game.cycleAuto();
      }
      if (game.introC) game._dismissIntro();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      game.keys[k] = false;
    });
    // 앱 전환·전화 수신 중 pointerup이 누락되면 조이스틱이 계속 움직이는 문제 방지.
    function releaseHeldInputs() {
      game.keys = {};
      for (const [id, pos] of active) game.handlePointerUp(pos.x, pos.y, id);
      active.clear();
      // 히트스톱에 보관된 공격/스킬도 화면 복귀 후 뒤늦게 발동하지 않도록 비운다.
      for (const key of ['queuedAttack', 'queuedSkill1', 'queuedSkill2', 'queuedDodge', 'queuedPotion', 'queuedJump', 'queuedCoop']) {
        game[key] = false;
      }
      // 화면 복귀 후 이전 프레임의 일회성 공격/스킬 입력이 실행되지 않도록 제거.
      for (const key of ['attack', 'skill1', 'skill2', 'dodge', 'potion', 'jump', 'auto', 'pause', 'mute', 'coop']) {
        game.hud.input[key] = false;
      }
    }
    window.addEventListener('blur', releaseHeldInputs);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseHeldInputs();
    });

    loading.classList.add('hide');
    setTimeout(() => loading.remove(), 600);
    // 보스/몬스터 추가 프레임은 첫 화면을 막지 않고 뒤에서 받는다
    setTimeout(() => { G.Assets.loadLazy(); }, 900);

    // ---- 디버그/검증 훅 ----
    window.__debug = {
      state: () => ({
        phase: game.phase,
        timeLeft: Math.round(game.timeLeft),
        hp: Math.round(game.kael.hp),
        enemies: game.enemies.filter((e) => e.alive && !e.dying).length,
        bossHp: game.boss ? Math.round(game.boss.hp) : null,
        autoMode: game.autoMode,
        combo: game.combo,
        errors: window.__errors,
        lobbyActive: !!(game.lobby && game.lobby.root.visible),
        lobbyChar: game.lobby ? game.lobby.state().char : null,
        fading: !!game._fade,
        kaelState: game.kael.state,
        anim: game.kael.animName,
        frame: game.kael.sprite.currentFrame,
        comboStep: game.comboStep,
        liaMp: Math.round(game.lia.mp),
        liaActive: !!(game.lia && game.lia.active),
        cutin: !!game.cutin,
        bossCutin: !!game.bossCutin,
        bossCutT: +game.bossCutT.toFixed(2),
        bossCutCD: +game.bossCutCD.toFixed(2),
        bossCutKind: game.boss && game.boss.kind || null,
        bossPhase: game.boss ? (game.boss.phaseKey || null) : null,
        bossPhaseIdx: game.boss ? game.boss.phaseIdx : null,
        bossPhaseLock: game.boss ? +game.boss.phaseLock.toFixed(2) : null,
        bossPhaseLog: game.bossPhaseLog.slice(-6),
        bossAtkLog: game.boss && game.boss.atkLog ? game.boss.atkLog.slice(-12) : [],
        dialogue: game.dialogueC ? game.lastLine : null,
        bossAura: game.boss && game.boss.aura ? game.boss.aura.alpha : null,
        z: game.kael.z, vz: game.kael.vz, groundY: game.kael.y,
        jumping: game.kael.z > 0,
        bossTele: game.boss && game.boss.state === 'windup' ?
          (game.boss.teleTargets || []).map(q=>({kind:game.boss.kind,x:q.x,y:q.y,r:q.r,left:Math.max(0,game.boss.cfg.tele-game.boss.stateT)})) : [],
        support: game.support.state(),
        supportLog: game.support.log.slice(-8),
        stun: game.enemies.filter((e) => e.alive && e.stunT > 0).length,
        defDown: game.enemies.filter((e) => e.alive && e.defDown > 0).length +
          (game.boss && game.boss.defDown > 0 ? 1 : 0),
        feel: game.feelLog.slice(-8),
        hitStop: +game.hitStop.toFixed(3),
        shakeAmp: +(game.scene.shakeAmp || 0).toFixed(1),
        audio: G.Sfx.mixState ? G.Sfx.mixState() : null,
        stage: game.stage ? { key: game.stage.key, order: game.stage.order, name: game.stage.name } : null,
        zone: game.zoneInfo ? game.zoneInfo() : null,
        coop: game.coopState ? game.coopState() : null,
      }),
      animInfo: () => Object.fromEntries(Object.entries(G.Assets.anim).map(([k, v]) => [k, { n: v.frames.length, fw: v.fw, fh: v.fh }])),
      dismissIntro: () => game._dismissIntro(),
      stopTicker: () => app.ticker.stop(),
      startTicker: () => app.ticker.start(),
      freeze: () => { game.frozen = true; },
      unfreeze: () => { game.frozen = false; },
      step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) game.update(dt); },
      render: () => app.renderer.render(app.stage),
      setAutoMode: (m) => { game.autoMode = m; },
      press: (k) => { game.hud.input[k] = true; },
      killBoss: () => { if (game.boss) { game.stats.damage += Math.round(game.boss.hp); game.boss.takeDamage(99999, { crit: true }); } },
      forceBoss: () => game.enterBossPhase(),
      // ---- Step 9-2 : 보스 2페이즈 ----
      setBossHp: (ratio) => {
        if (!game.boss) return null;
        game.boss.hp = G.clamp(Math.round(game.boss.hpMax * ratio), 1, game.boss.hpMax);
        return Math.round(game.boss.hp);
      },
      damageBoss: (n) => {
        if (!game.boss) return null;
        game.boss.takeDamage(n, {});
        return Math.round(game.boss.hp);
      },
      bossPhaseInfo: () => (game.boss ? {
        key: game.boss.phaseKey, idx: game.boss.phaseIdx, lock: +game.boss.phaseLock.toFixed(2),
        hp: Math.round(game.boss.hp), hpMax: game.boss.hpMax,
        atk: game.boss.phaseCfg ? game.boss.phaseCfg.atk : null,
        tele: game.boss.phaseCfg ? game.boss.phaseCfg.tele : null,
        dmg: game.boss.phaseCfg ? game.boss.phaseCfg.dmg : null,
        pool: game.boss.phaseCfg ? game.boss.phaseCfg.pool : null,
        chain: game.boss.phaseCfg ? game.boss.phaseCfg.chain : 0,
        teleDrawn: game.boss.tele ? game.boss.tele.alpha : null,
      } : null),
      bossAtkLog: () => (game.boss && game.boss.atkLog ? game.boss.atkLog.slice() : []),
      phaseLog: () => game.bossPhaseLog.slice(),
      dialogueTexts: () => {
        const out = [];
        const walk = (n) => { if (!n) return; if (typeof n.text === 'string') out.push(n.text); if (n.children) n.children.forEach(walk); };
        walk(game.dialogueC);
        return out;
      },
      setAuto: (m) => { game.autoMode = m; },
      forceSupport: (k, instant) => game.support.fire(k, { instant: !!instant }),
      feelLog: () => game.feelLog.slice(),
      clearFeelLog: () => { game.feelLog.length = 0; },
      audioState: () => G.Sfx.mixState(),
      supportCd: (sec) => { Object.keys(game.support.ally).forEach((k) => { game.support.ally[k].cd = Math.max(0, sec); }); },
      setKaelHp: (ratio) => { game.kael.hp = Math.max(1, Math.round(game.kael.hpMax * ratio)); },
      attack: () => game.hud.input.attack = true,
      // ---- Step 8 : 2.5D 사각 링 판정 ----
      toggleBoxes: (on) => game.toggleDebugBoxes(on),
      laneInfo: () => ({
        lane: G.LANE, ring: G.RING, spawn: G.SPAWN,
        hero: { x: Math.round(game.kael.x), y: Math.round(game.kael.y), facing: game.kael.facing },
        enemies: game.enemies.filter((e) => e.alive && !e.dying).map((e) => ({
          x: Math.round(e.x), y: Math.round(e.y), facing: e.facing,
          state: e.state, atkDir: e.atkDir, atkY: Math.round(e.atkY == null ? e.y : e.atkY),
        })),
        boss: game.boss ? { x: Math.round(game.boss.x), y: Math.round(game.boss.y), facing: game.boss.facing } : null,
        debugOn: !!game.debugBoxes,
      }),
      // 검증용: 지금 위치의 적에게 정면 공격을 한 번 넣고 데미지 변화를 돌려받는다
      probeStrike: (opts) => {
        const h = game.kael;
        const o = opts || {};
        const before = game.stats.damage;
        if (o.facing) h.facing = o.facing;
        if (o.heroY != null) { h.y = o.heroY; h.obj.y = h.y; }
        if (o.enemyX != null && game.enemies[0]) {
          game.enemies[0].x = o.enemyX; game.enemies[0].obj.x = o.enemyX;
        }
        if (o.enemyY != null && game.enemies[0]) {
          game.enemies[0].y = o.enemyY; game.enemies[0].obj.y = o.enemyY;
        }
        game.heroStrike(h, h.atkCfg || { reach: 252, dmg: 1, spread: 1.3, ang: -0.3 }, 0);
        return Math.round(game.stats.damage - before);
      },
      // ---- 로비(성문 대기실) ----
      lobbyInfo: () => game.lobby.state(),
      lobbyHits: () => game.lobby.hits(),
      sortie: () => { if (game.phase === 'lobby') game.sortie(); },
      enterLobby: () => game.enterLobby(),
      // ---- Step 7 : 캐릭터·스킨 출전 / 관절 리그 ----
      deploy: (key, skin) => game.deployFromLobby(key, skin),
      lobbySelect: (key) => {
        const i = G.CHARS.order.indexOf(key);
        if (i >= 0) game.lobby.select(i);
        return game.lobby.state();
      },
      lobbySkin: (skin) => { game.lobby.setSkin(skin); return game.lobby.state(); },
      heroInfo: () => {
        const h = game.kael;
        if (!h) return null;
        return {
          char: h.char ? h.char.key : null, skin: h.skin,
          name: h.name, hp: Math.round(h.hp), hpMax: h.hpMax, atk: h.atk,
          rig: !!h.rig, rigKey: h.rig ? h.rig.key : null,
          parts: h.rig ? h.rig.partNames.length : 0,
          state: h.state, facing: h.facing,
          pose: h.rig ? h.rig.debug() : null,
          skill: h.char ? h.char.skill.name : null,
          ult: h.char ? h.char.ult.name : null,
        };
      },
      enemyInfo: () => game.enemies.filter((e) => e.alive && !e.dying).map((e) => ({
        variant: e.variant, hp: Math.round(e.hp), state: e.state,
        rig: !!e.rig, parts: e.rig ? e.rig.partNames.length : 0,
        pose: e.rig ? e.rig.debug() : null,
      })),
      bossInfo: () => (game.boss ? {
        name: game.boss.name, hp: Math.round(game.boss.hp), state: game.boss.state,
        rig: !!game.boss.rig, parts: game.boss.rig ? game.boss.rig.partNames.length : 0,
        pose: game.boss.rig ? game.boss.rig.debug() : null,
      } : null),
      rigTurn: (which) => {
        const t = which === 'boss' ? game.boss : which === 'enemy' ? game.enemies.find((e) => e.alive) : game.kael;
        return t && t.rig ? t.rig.turnLog.slice(-6) : null;
      },
      spawnElite: () => { const e = game._spawnEnemy({ hp: 360, atk: 20 }, 980, 'elite'); return e ? e.variant : null; },
      // ---- 스테이지 · 구역 (Step 4-3) ----
      setStage: (i) => { game.setStage(i); if (game.lobby) game.lobby.syncStage(); return game.stage.key; },
      stages: () => G.STAGES.map((s) => ({ key: s.key, order: s.order, name: s.name, zones: s.zones.map((z) => z.name) })),
      // ---- Step 9-3 : 3스테이지 확장 ----
      stageLoad: () => G.STAGES.map((s) => G.stageLoad(s)),
      stageLookInfo: () => ({
        stage: game.stage ? game.stage.key : null,
        order: game.stage ? game.stage.order : null,
        look: game.scene ? game.scene.stageLook : null,
        bgTint: game.scene && game.scene.bg ? game.scene.bg.tint : null,
        citadel: !!(game.scene && game.scene.citadelC && game.scene.citadelC.visible),
        warmTint: game.scene && game.scene.warmGlow ? game.scene.warmGlow.tint : null,
        ringTint: game.scene && game.scene.ringG ? game.scene.ringG.tint : null,
        floorTint: game.scene && game.scene.floorGlow ? game.scene.floorGlow.tint : null,
        beamTint: game.scene && game.scene.beamList && game.scene.beamList[0] ? game.scene.beamList[0].s.tint : null,
        lookChildren: game.scene && game.scene.citadelC ? game.scene.citadelC.children.length : 0,
        area: game.zoneInfo ? game.zoneInfo().area : null,
        bossArea: game.stage ? game.stage.bossArea : null,
        reward: game.stage ? game.stage.reward : null,
        bossHp: game.stage ? game.stage.bossHp : null,
        bossTime: game.stage ? game.stage.bossTime : null,
        timeLimit: game.stage ? game.stage.timeLimit : null,
      }),
      resultTexts: () => {
        const out = [];
        const walk = (n) => { if (!n) return; if (typeof n.text === 'string' && n.text) out.push(n.text); if (n.children) n.children.forEach(walk); };
        walk(game.overlay);
        return out;
      },
      rewardText: () => (game.rewardText && !game.rewardText.destroyed ? game.rewardText.text : null),
      stageFlow: () => ({ stage: game.stage ? game.stage.key : null, order: game.stage ? game.stage.order : null,
        phase: game.phase, waveIndex: game.waveIndex, waveCount: game.waves.length,
        zoneIndex: game.zoneIndex, zoneCount: game.zones.length, zoneInfo: game.zoneInfo ? game.zoneInfo() : null,
        banner: game.phaseMsg }),
      zoneInfo: () => game.zoneInfo(),
      forceZone: (zi) => {
        // 검증용: n번째 구역의 첫 웨이브로 건너뛴다
        const z = game.zones[zi];
        if (!z) return false;
        game.enemies.forEach((e) => { if (e.alive) e.die(); });
        game.waveIndex = z.from - 1;
        game.zoneIndex = zi;
        game.phaseT = 2.0;
        game.nextWaveDelay = 0;
        return true;
      },
      clearWave: () => { game.enemies.forEach((e) => { if (e.alive && !e.dying) e.die(); }); game.phaseT = 2.0; game.nextWaveDelay = 0; },
      // ---- 리아 협동 (Step 4-3) ----
      coopState: () => game.coopState(),
      setCoopGauge: (v) => { game.coopGauge = G.clamp(v, 0, game.coopMax); return game.coopGauge; },
      fillCoop: () => { game.coopGauge = game.coopMax; game.coopCd = 0; return game.coopState(); },
      useCoop: () => game.useCoop(),
      coopCutInTexts: () => {
        const out = [];
        const walk = (n) => { if (!n) return; if (typeof n.text === 'string') out.push(n.text); if (n.children) n.children.forEach(walk); };
        walk(game.coopCutin);
        return out;
      },
      hudTexts: () => {
        const out = [];
        const walk = (n) => { if (!n) return; if (typeof n.text === 'string' && n.visible) out.push(n.text); if (n.children) n.children.forEach(walk); };
        walk(game.hud.root);
        return out;
      },
      hudHits: () => ({ coop: { ...game.hud.buttons.coop } }),
      result: (win) => { if (win) game._victory(); else game._defeat('검증'); },
      jump: () => game.kael.jump(),
      summon: () => game.useSkill2(),
      skill1: () => game.useSkill1(),
      damageBurst: () => {
        const e = game.enemies.find((x) => x.alive);
        if (e) {
          e.takeDamage(142, { crit: false });
          game.fx.slash(e.x - 60, e.centerY, { radius: 170, spread: 2.2, angle: -0.3, width: 44, color: 0x3f7dff });
          game.scene.shake(8, 0.2);
        }
      },
      // ---- Step 9-1 : 화면 배치(가로/세로) ----
      viewInfo: () => ({
        mode: G.VIEW.mode, w: G.VIEW.w, h: G.VIEW.h,
        world: { ...G.VIEW.world }, bandBottom: G.VIEW.bandBottom,
        cam: { ...G.VIEW.cam },
        canvas: { w: canvas.width, h: canvas.height, css: { w: canvas.clientWidth, h: canvas.clientHeight } },
      }),
      /* ---- Step 10-1 : 세로 추적 카메라 ----
         히어로·보스의 화면(캔버스) 좌표 바운딩과 카메라 창을 그대로 돌려준다.
         가로에서는 cam.active=false · scale=1 · 창 = 1280×720 이다. */
      camInfo: () => {
        const v = G.VIEW, c = v.cam, band = v.world;
        const rect = (a) => {
          if (!a) return null;
          try {
            const o = (a.rig && a.rig.body && !a.rig.body.destroyed) ? a.rig.body : a.sprite;
            if (!o) return null;
            const b = o.getBounds();
            return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
          } catch (e) { return null; }
        };
        return {
          active: !!c.active, zoom: +c.zoom.toFixed(4), x: +c.x.toFixed(2), y: +c.y.toFixed(2),
          visW: +c.visW.toFixed(2), visH: +c.visH.toFixed(2), scale: +(c.scale || band.scale).toFixed(4),
          band: { x: band.x, y: band.y, w: band.w, h: band.h, scale: band.scale },
          root: { sx: +game.scene.root.scale.x.toFixed(4), px: +game.scene.root.x.toFixed(2), py: +game.scene.root.y.toFixed(2) },
          hero: rect(game.kael),
          boss: rect(game.boss),
          heroWorld: game.kael ? { x: Math.round(game.kael.x), y: Math.round(game.kael.y), z: +game.kael.z.toFixed(1) } : null,
          clamp: { minX: 0, maxX: +Math.max(0, G.W - c.visW).toFixed(2), minY: 0, maxY: +Math.max(0, G.H - c.visH).toFixed(2) },
        };
      },
      /* 결과판 — 보상 줄과 통계 줄의 바운딩(캔버스 좌표)을 그대로 준다 */
      resultLayout: () => {
        const box = (t) => {
          if (!t || t.destroyed) return null;
          const b = t.getBounds();
          return { t: t.text, x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
        };
        return {
          reward: box(game.rewardText),
          stats: (game.resultStatTexts || []).map(box).filter(Boolean),
          buttons: (game.overlayButtons || []).map((b) => {
            const s = game.overlay.scale.x || 1;
            return { x: +(game.overlay.x + b.x * s).toFixed(1), y: +(game.overlay.y + b.y * s).toFixed(1),
              w: +(b.w * s).toFixed(1), h: +(b.h * s).toFixed(1) };
          }),
          overlay: { x: +game.overlay.x.toFixed(1), y: +game.overlay.y.toFixed(1), s: +game.overlay.scale.x.toFixed(3) },
          texts: window.__debug.resultTexts(),
        };
      },
      hudLayout: () => (game.hud && game.hud.layoutInfo ? game.hud.layoutInfo() : null),
      lobbyLayout: () => (game.lobby && game.lobby.layoutInfo ? game.lobby.layoutInfo() : null),
      hitAt: (x, y) => ({ hud: game.hud && game.hud.ownerAt ? game.hud.ownerAt(x, y) : null }),
    };
  }

  boot().catch((e) => fail('boot: ' + (e && e.message ? e.message : e)));
})();
