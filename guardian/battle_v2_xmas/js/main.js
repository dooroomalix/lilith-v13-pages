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

  function fit() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / G.W, vh / G.H);
    canvas.style.width = Math.round(G.W * s) + 'px';
    canvas.style.height = Math.round(G.H * s) + 'px';
  }

  async function boot() {
    const res = Math.min(window.devicePixelRatio || 1, 2);
    const app = new PIXI.Application();
    await app.init({
      canvas,
      width: G.W,
      height: G.H,
      resolution: res,
      autoDensity: false,
      antialias: true,
      background: 0x05070d,
      powerPreference: 'high-performance',
    });
    // WebGL 컨텍스트 손실 감지 — 복구 가능하도록 기본 동작을 막는다
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      window.__ctxLost = (window.__ctxLost || 0) + 1;
      window.__ctxLostAt = Date.now();
      const g = window.__GAME;
      window.__ctxLostInfo = { t: g ? +g.time.toFixed(2) : null, phase: g ? g.phase : null,
        char: g ? g.deployChar : null, enemies: g ? g.enemies.length : null };
      fail('webglcontextlost');
      // 4초 안에 복구되지 않으면(검은 화면) 한 번만 새로고침해 플레이를 되살린다
      clearTimeout(window.__ctxReloadT);
      window.__ctxReloadT = setTimeout(() => {
        if (window.__ctxRestoredNow) return;
        let last = 0;
        try { last = +(sessionStorage.getItem('xmas_ctx_reload') || 0); } catch (_) {}
        if (Date.now() - last < 15000) return;   // 연속 새로고침 방지
        try { sessionStorage.setItem('xmas_ctx_reload', String(Date.now())); } catch (_) {}
        location.reload();
      }, 4000);
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      window.__ctxRestored = (window.__ctxRestored || 0) + 1;
      window.__ctxRestoredNow = true;
      clearTimeout(window.__ctxReloadT);
    }, false);

    // Pixi v8 텍스처 GC — 오래 화면에 안 쓰인 텍스처를 내려서
    // 로비에 오래 머문 뒤 전투에 들어가면 배경·캐릭터가 사라지는 문제를 막는다
    try {
      if (app.renderer.textureGC) { app.renderer.textureGC.active = false; app.renderer.textureGC.maxUnusedTime = 1e9; }
      if (PIXI.TextureSource && PIXI.TextureSource.defaultOptions) PIXI.TextureSource.defaultOptions.autoGarbageCollect = false;
    } catch (_) {}

    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 120));

    try {
      await G.Assets.load((p) => { loadbar.style.width = Math.round(p * 100) + '%'; });
    } catch (e) {
      fail('asset load: ' + e.message);
      return;
    }

    // Step 6: 관절 파츠 리그 메타 + 궁극기 컷인 초상
    try {
      await G.Rigs.loadMeta('assets/rig/meta.json');
      G.CHARS.order.forEach((k) => {
        G.Assets._img(G.CHARS.portrait(k, 'basic')).then((img) => {
          const t = PIXI.Texture.from(img);
          t.source.scaleMode = 'linear';
          G.Assets.tex['cutin_' + k] = t;
        }).catch(() => {});
      });
    } catch (e) {
      fail('rig meta: ' + e.message);
    }

    const game = new G.Game(app);
    window.__GAME = game;
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
      return { x: ((e.clientX - r.left) / r.width) * G.W, y: ((e.clientY - r.top) / r.height) * G.H };
    }
    const active = new Map();
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = localPos(e);
      active.set(e.pointerId, p);
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
    canvas.addEventListener('pointerleave', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      game.keys[k] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      G.Sfx.resume();
      if (k === 'j' && !e.repeat) game.hud.input.attack = true;
      if (k === ' ' && !e.repeat) game.hud.input.jump = true;
      if (k === 'ArrowUp' && !e.repeat) game.hud.input.jump = true;
      if (k === 'k' && !e.repeat) game.hud.input.skill1 = true;
      if (k === 'l' && !e.repeat) game.hud.input.skill2 = true;
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
    // 화면을 떠나거나 포커스를 잃으면 눌린 키/버튼을 모두 놓는다
    window.addEventListener('blur', () => {
      game.keys = {};
      if (game.hud && game.hud.releaseInputs) game.hud.releaseInputs();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        game.keys = {};
        if (game.hud && game.hud.releaseInputs) game.hud.releaseInputs();
      }
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
        bossPhaseLog: game.bossPhaseLog.slice(-6),
        bossAtkLog: game.boss ? game.boss.atkLog.slice(-12) : [],
        lanterns: game.lanterns ? game.lanterns.state() : null,
        chill: !!(game.lanterns && game.lanterns.chill),
        lastLine: game.lastLine,
        dialogue: !!game.dialogueC,
        scarf: !!(game.kael && game.kael.scarf),
        keysHeld: Object.keys(game.keys).filter((k) => game.keys[k]),
        hudInput: Object.fromEntries(Object.entries(game.hud.input).filter(([k, v]) => v)),
        queuedJump: game.queuedJump,
        bossCutDur: game.bossCutDur,
        z: game.kael.z, vz: game.kael.vz, groundY: game.kael.y,
        jumping: game.kael.z > 0,
        bossTele: game.boss && game.boss.state === 'windup' ?
          (game.boss.teleTargets || []).map(q=>({kind:game.boss.kind,x:q.x,y:q.y,r:q.r,left:Math.max(0,game.boss.cfg.tele-game.boss.stateT)})) : [],
        char: game.deployChar, skin: game.deploySkin,
        rig: !!(game.kael && game.kael.rig),
        lobby: !!(game.lobby && game.lobby.root.visible),
        support: game.support.state(),
        supportLog: game.support.log.slice(-8),
        stun: game.enemies.filter((e) => e.alive && e.stunT > 0).length,
        defDown: game.enemies.filter((e) => e.alive && e.defDown > 0).length +
          (game.boss && game.boss.defDown > 0 ? 1 : 0),
      }),
      animInfo: () => Object.fromEntries(Object.entries(G.Assets.anim).map(([k, v]) => [k, { n: v.frames.length, fw: v.fw, fh: v.fh }])),
      dismissIntro: () => game._dismissIntro(),
      stopTicker: () => app.ticker.stop(),
      startTicker: () => app.ticker.start(),
      freeze: () => { game.frozen = true; },
      unfreeze: () => { game.frozen = false; },
      step: (n = 60, dt = 1 / 60) => { for (let i = 0; i < n; i++) game.update(dt); },
      /* 조건이 참이 될 때까지 페이지 안에서 프레임을 진행 (검증 스크립트 왕복 비용 제거) */
      stepUntil: (expr, maxN = 90, dt = 1 / 60) => {
        const fn = new Function('return (' + expr + ')');
        for (let i = 0; i < maxN; i++) {
          if (fn()) return i;
          game.update(dt);
        }
        return -1;
      },
      render: () => app.renderer.render(app.stage),
      /* 증빙 스크린샷용: 잠시 티커를 돌려 실제 프레임을 그린 뒤(캔버스 보존) 다시 멈춘다 */
      snap: async () => {
        const wasFrozen = !!game.frozen;
        game.frozen = false;
        await new Promise((r) => {
          let n = 0;
          const tick = () => { n += 1; if (n >= 4) r(); else requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        });
        return {wasFrozen: wasFrozen};
      },
      setAutoMode: (m) => { game.autoMode = m; },
      press: (k) => { game.hud.input[k] = true; },
      killBoss: () => { if (game.boss) { game.stats.damage += Math.round(game.boss.hp); game.boss.takeDamage(99999, { crit: true }); } },
      forceBoss: () => game.enterBossPhase(),
      setAuto: (m) => { game.autoMode = m; },
      forceSupport: (k, instant) => game.support.fire(k, { instant: !!instant }),
      supportCd: (sec) => { Object.keys(game.support.ally).forEach((k) => { game.support.ally[k].cd = Math.max(0, sec); }); },
      setKaelHp: (ratio) => { game.kael.hp = Math.max(1, Math.round(game.kael.hpMax * ratio)); },
      /* ---- Step 5 검증용 ---- */
      setBossHp: (ratio) => {
        if (!game.boss) return null;
        game.boss.hp = Math.max(1, Math.round(game.boss.hpMax * ratio));
        if (game.boss._checkPhase) game.boss._checkPhase();
        return { hp: Math.round(game.boss.hp), phase: game.boss.phaseKey, idx: game.boss.phaseIdx };
      },
      lanternState: () => (game.lanterns ? game.lanterns.state() : null),
      lanternLog: () => (game.lanterns ? game.lanterns.log.slice(-10) : []),
      setLantern: (i, lit) => {
        if (!game.lanterns) return null;
        if (lit) game.lanterns.relight(i); else game.lanterns.extinguish(i, 'debug');
        return game.lanterns.state();
      },
      extinguishAll: () => {
        if (!game.lanterns) return null;
        game.lanterns.items.forEach((it, i) => { if (it.lit) game.lanterns.extinguish(i, 'debug'); });
        return game.lanterns.state();
      },
      relightAll: () => {
        if (!game.lanterns) return null;
        game.lanterns.relightAll();
        return game.lanterns.state();
      },
      lanternWind: (sec) => { if (game.lanterns) game.lanterns.windClock = Math.max(0.05, sec); },
      kaelTo: (x, y) => {
        game.kael.x = G.clamp(x, 120, 1040);
        if (y != null) game.kael.y = G.clamp(y, 492, 664);
        game.kael.obj.x = game.kael.x; game.kael.obj.y = game.kael.y;
        return { x: game.kael.x, y: game.kael.y };
      },
      dialogue: (name, text, dur) => { game.dialogueLine(name, text, dur || 3); return game.lastLine; },
      bossCutInfo: () => (game.bossCutin ? {
        dur: game.bossCutDur, kinds: game.bossCutKind,
        texts: game.bossCutin.children.filter((c) => c.text !== undefined).map((c) => c.text),
      } : null),
      bossAttack: (kind) => {
        if (!game.boss || !game.boss.alive || game.boss.dying) return null;
        game.boss.atkTimer = 99;
        game.boss.state = 'idle';
        game.boss.phaseLock = 0;
        game.boss.startAttack(kind);
        return { kind: game.boss.kind, tele: game.boss.cfg.tele, dmg: game.boss.cfg.dmg, radius: Math.round(game.boss.cfg.radius) };
      },
      /* ---- Step 6 : 로비·리그 검증용 ---- */
      lobbyState: () => (game.lobby ? game.lobby.state() : null),
      lobbySelect: (k) => { game.lobby.select(k); return game.lobby.state(); },
      lobbySkin: (s) => { game.lobby.setSkin(s); return game.lobby.state(); },
      lobbyTap: (x, y) => game.lobby.tap(x, y),
      openLobby: () => game._openLobby(),
      deploy: async (k, s) => {
        if (k) game.lobby.select(k);
        if (s) game.lobby.setSkin(s);
        const ok = await game.lobby.deploy();
        return { ok, char: game.deployChar, skin: game.deploySkin };
      },
      rigInfo: () => {
        const r = game.kael && game.kael.rig;
        return r ? Object.assign({ key: r.key, parts: r.partNames, artFacing: r.artFacing }, r.debug()) : null;
      },
      rigTurnLog: () => (game.kael && game.kael.rig ? game.kael.rig.turnLog.slice(-8) : []),
      rigTurnNow: (dir) => {
        const r = game.kael && game.kael.rig;
        if (!r) return null;
        game.kael.facing = dir;
        r.setFacing(dir);
        return r.debug();
      },
      rigPartSnapshot: () => {
        const r = game.kael && game.kael.rig;
        if (!r) return null;
        return { state: r.state, yaw: +r.yaw.toFixed(3), turnT: +r.turnT.toFixed(3),
          body: { sx: +r.body.scale.x.toFixed(4), sy: +r.body.scale.y.toFixed(4), rot: +r.body.rotation.toFixed(4) },
          parts: Object.fromEntries(r.partNames.map((n) => [n, { rot: +r.nodes[n].rotation.toFixed(4), x: +r.nodes[n].x.toFixed(2), y: +r.nodes[n].y.toFixed(2), z: r.nodes[n].zIndex }])) };
      },
      enemyRigs: () => game.enemies.filter((e) => e.alive).map((e) => ({
        variant: e.variant, rig: !!e.rig, state: e.rig ? e.rig.state : null,
        yaw: e.rig ? +e.rig.yaw.toFixed(2) : null,
        parts: e.rig ? Object.fromEntries(e.rig.partNames.slice(0, 4).map((n) => [n, +e.rig.nodes[n].rotation.toFixed(3)])) : null,
      })),
      bossRig: () => (game.boss && game.boss.rig ? { state: game.boss.rig.state, yaw: +game.boss.rig.yaw.toFixed(2),
        parts: Object.fromEntries(game.boss.rig.partNames.map((n) => [n, +game.boss.rig.nodes[n].rotation.toFixed(3)])) } : null),
      forceIdle: () => { if (game.kael) { game.kael.state = 'idle'; game.kael.stateT = 0; } },
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
      probeStrike: (opts) => {
        const h = game.kael;
        const o = opts || {};
        const before = game.stats.damage;
        if (o.facing) h.facing = o.facing;
        if (o.heroY != null) { h.y = o.heroY; h.obj.y = h.y; }
        if (o.enemyX != null && game.enemies[0]) { game.enemies[0].x = o.enemyX; game.enemies[0].obj.x = o.enemyX; }
        if (o.enemyY != null && game.enemies[0]) { game.enemies[0].y = o.enemyY; game.enemies[0].obj.y = o.enemyY; }
        game.heroStrike(h, h.atkCfg || { reach: 252, dmg: 1, spread: 1.3, ang: -0.3 }, 0);
        return Math.round(game.stats.damage - before);
      },
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
    };
  }

  boot().catch((e) => fail('boot: ' + (e && e.message ? e.message : e)));
})();
