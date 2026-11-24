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
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => setTimeout(fit, 120));

    try {
      await G.Assets.load((p) => { loadbar.style.width = Math.round(p * 100) + '%'; });
    } catch (e) {
      fail('asset load: ' + e.message);
      return;
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
      if (k === 'j' && !e.repeat) game.hud.input.attack = true;
      if (k === ' ' && !e.repeat) game.hud.input.jump = true;
      if (k === 'ArrowUp' && !e.repeat) game.hud.input.jump = true;
      if (k === 'k' && !e.repeat) game.hud.input.skill1 = true;
      if (k === 'l' && !e.repeat) game.hud.input.skill2 = true;
      if (k === 'q' && !e.repeat) game.hud.input.potion = true;
      if (k === 'Shift' && !e.repeat) game.hud.input.dodge = true;
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
      for (const key of ['queuedAttack', 'queuedSkill1', 'queuedSkill2', 'queuedDodge', 'queuedPotion', 'queuedJump']) {
        game[key] = false;
      }
      // 화면 복귀 후 이전 프레임의 일회성 공격/스킬 입력이 실행되지 않도록 제거.
      for (const key of ['attack', 'skill1', 'skill2', 'dodge', 'potion', 'jump', 'auto', 'pause', 'mute']) {
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
        z: game.kael.z, vz: game.kael.vz, groundY: game.kael.y,
        jumping: game.kael.z > 0,
        bossTele: game.boss && game.boss.state === 'windup' ?
          (game.boss.teleTargets || []).map(q=>({kind:game.boss.kind,x:q.x,y:q.y,r:q.r,left:Math.max(0,game.boss.cfg.tele-game.boss.stateT)})) : [],
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
      render: () => app.renderer.render(app.stage),
      setAutoMode: (m) => { game.autoMode = m; },
      press: (k) => { game.hud.input[k] = true; },
      killBoss: () => { if (game.boss) { game.stats.damage += Math.round(game.boss.hp); game.boss.takeDamage(99999, { crit: true }); } },
      forceBoss: () => game.enterBossPhase(),
      setAuto: (m) => { game.autoMode = m; },
      forceSupport: (k, instant) => game.support.fire(k, { instant: !!instant }),
      supportCd: (sec) => { Object.keys(game.support.ally).forEach((k) => { game.support.ally[k].cd = Math.max(0, sec); }); },
      setKaelHp: (ratio) => { game.kael.hp = Math.max(1, Math.round(game.kael.hpMax * ratio)); },
      attack: () => game.hud.input.attack = true,
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
