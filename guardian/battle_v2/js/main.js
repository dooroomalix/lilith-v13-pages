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
      if (k === ' ' || k === 'j') game.hud.input.attack = true;
      if (k === 'k') game.hud.input.skill1 = true;
      if (k === 'l') game.hud.input.skill2 = true;
      if (k === 'Shift') game.hud.input.dodge = true;
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
    window.addEventListener('blur', () => { game.keys = {}; });

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
      attack: () => game.hud.input.attack = true,
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
