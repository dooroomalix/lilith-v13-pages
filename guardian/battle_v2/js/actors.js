/* actors.js : 카엘(거리 동기 스프라이트 애니메이션 + 접지 그림자 + 림라이트) / 리아 / 정찰병 / 보스 */
(function () {
  const GROUND_Y = 588;
  const PERSP = 0.0009;            // y(깊이)에 따른 원근 배율

  function approach(cur, target, step) {
    if (cur < target) return Math.min(target, cur + step);
    if (cur > target) return Math.max(target, cur - step);
    return target;
  }

  class Unit {
    constructor(game) {
      this.game = game;
      this.obj = new PIXI.Container();
      this.alive = true;
      this.hitFlash = 0;
      this.dead = false;
      this.contactPulse = 0;
    }

    /* 바닥 접지 그림자: 캐릭터가 땅에 붙어 있는 느낌의 핵심 */
    addShadow(width, alpha = 0.5) {
      const sh = new PIXI.Sprite(G.Assets.tex.shadow);
      sh.anchor.set(0.5);
      sh.width = width;
      sh.height = width * 0.34;
      sh.y = 0;
      sh.alpha = alpha;
      sh.tint = 0xffffff;
      this.obj.addChild(sh);
      this.shadow = sh;
      this.shadowBase = { w: width, a: alpha };
      return sh;
    }

    /* 발밑 환경광: 바닥이 캐릭터의 빛을 받는 느낌 (배경과 이어 붙인다) */
    addHalo(color = 0x6fb8ff, width = 320, alpha = 0.16) {
      const h = new PIXI.Sprite(G.Assets.tex.halo);
      h.anchor.set(0.5);
      h.width = width;
      h.height = width * 0.42;
      h.y = -2;
      h.tint = color;
      h.blendMode = 'add';
      h.alpha = alpha;
      this.obj.addChild(h);
      this.halo = h;
      this.haloBase = { w: width, a: alpha };
      return h;
    }

    updateGroundFx(dt, liftPx, squash = 1, dim = 0) {
      this.contactPulse = Math.max(0, this.contactPulse - dt * 3.4);
      const pulse = 1 + this.contactPulse * 0.16;
      if (this.shadow) {
        const k = G.clamp(1 - liftPx * 0.012, 0.55, 1.25) * squash * pulse;
        this.shadow.width = this.shadowBase.w * k;
        this.shadow.height = this.shadowBase.w * 0.34 * k;
        this.shadow.alpha = G.clamp(this.shadowBase.a * (1 - liftPx * 0.02) * (1 + this.contactPulse * 0.3), 0, 0.75) * (1 - dim);
      }
      if (this.halo) {
        this.halo.width = this.haloBase.w * (1 + 0.04 * Math.sin(this.game.time * 2.2));
        this.halo.alpha = this.haloBase.a * (1 - liftPx * 0.02) * (0.85 + 0.15 * Math.sin(this.game.time * 3.1)) * (1 - dim);
      }
    }

    flash() { this.hitFlash = 0.12; }
  }

  /* ============================ 영웅 ============================ */
  const COMBO = [
    { anim: 'atk1', wind: 0.055, dur: 0.27, hit: 0.095, reach: 252, dmg: 1.00, radius: 132, spread: 1.30, ang: -0.34, lunge: 34, advance: 16, hitStop: 0.035, shake: 5 },
    { anim: 'atk2', wind: 0.050, dur: 0.26, hit: 0.100, reach: 258, dmg: 1.12, radius: 138, spread: 1.24, ang: 0.26, lunge: 42, advance: 20, hitStop: 0.045, shake: 6 },
    { anim: 'atk3', wind: 0.085, dur: 0.44, hit: 0.235, reach: 300, dmg: 1.85, radius: 172, spread: 1.52, ang: -0.08, lunge: 62, advance: 30, hitStop: 0.060, shake: 10 },
  ];

  class Hero extends Unit {
    constructor(game, opts) {
      super(game);
      Object.assign(this, {
        name: opts.name,
        role: opts.role,
        x: opts.x,
        homeX: opts.x,
        y: GROUND_Y,
        bodyPx: opts.bodyPx || 330,
        hpMax: opts.hpMax || 780,
        hp: opts.hpMax || 780,
        mpMax: 100,
        mp: 100,
        level: 1,
        state: 'idle',
        stateT: 0,
        bobT: G.rand(6),
        facing: 1,
        lean: 0,
        comboStep: 0,
        comboIdle: 0,
        invuln: 0,
        dodgeCD: 0,
        hurtT: 0,
        alive: true,
        animName: '',
        lockAnim: false,
        vx: 0,
        vy: 0,
        cycle: 0,
        frameIdx: -1,
        prevX: opts.x,
        prevY: GROUND_Y,
        bobPx: 0,
        stride: 0,
        idleT: 0,
      });
      this.addHalo(opts.haloColor || 0x6fb8ff, 340, 0.15);
      this.addShadow(opts.shadowW || 170, 0.52);

      const meta = G.Assets.animMeta || { bodyH: 410 };
      this.bodyH = meta.bodyH;
      const idle = G.Assets.anim.idle;
      this.sprite = new PIXI.AnimatedSprite(idle.frames);
      this.sprite.anchor.set(idle.ax, idle.ay);
      this.sprite.animationSpeed = idle.fps / 60;
      this.sprite.play();
      this.animName = 'idle';
      this.anim = idle;

      // 림라이트: 같은 프레임을 살짝 어긋나게 뒤에 깔아 가장자리만 빛나게
      this.rim = new PIXI.AnimatedSprite(idle.frames);
      this.rim.anchor.set(idle.ax, idle.ay);
      this.rim.tint = opts.rimColor || 0x8fd6ff;
      this.rim.blendMode = 'add';
      this.rim.alpha = 0.42;
      this.rim.animationSpeed = 0;
      this.rim.gotoAndStop(0);

      this.obj.addChild(this.rim);
      this.obj.addChild(this.sprite);

      this._applyScale();

      this.obj.x = this.x;
      this.obj.y = this.y;
      this.obj.zIndex = this.y;

      this.weaponGlow = new PIXI.Sprite(G.Assets.tex.glow);
      this.weaponGlow.anchor.set(0.5);
      this.weaponGlow.blendMode = 'add';
      this.weaponGlow.tint = opts.glowColor || 0x66aaff;
      this.weaponGlow.width = 130;
      this.weaponGlow.height = 130;
      this.weaponGlow.alpha = 0.0;
      this.weaponGlow.x = 40;
      this.weaponGlow.y = -this.bodyPx * 0.45;
      this.obj.addChild(this.weaponGlow);
    }

    get centerY() { return this.y - this.bodyPx * 0.52; }
    get bodyTop() { return this.y - this.bodyPx; }
    get persp() { return 1 + (this.y - GROUND_Y) * PERSP; }

    _applyScale() {
      const a = this.anim;
      const s = (this.bodyPx / (a && a.pxBodyH ? a.pxBodyH : this.bodyH)) * this.persp;
      this.sprite.scale.set(s * this.facing, s);
      this.rim.scale.set(s * this.facing * 1.015, s * 1.015);
      this.rim.x = this.sprite.x - 6 * this.facing;
      this.rim.y = this.sprite.y - 7;
    }

    _syncRim() {
      if (this.rim.currentFrame !== this.sprite.currentFrame) this.rim.gotoAndStop(this.sprite.currentFrame);
      this.rim.x = this.sprite.x - 6 * this.facing;
      this.rim.y = this.sprite.y - 7;
      this.rim.rotation = this.sprite.rotation;
    }

    _useAnim(name) {
      const a = G.Assets.anim[name] || G.Assets.ensureAnim(name);
      if (!a) return null;
      if (this.animName !== name) {
        this.sprite.textures = a.frames;
        this.rim.textures = a.frames;
        this.sprite.anchor.set(a.ax, a.ay);
        this.rim.anchor.set(a.ax, a.ay);
        this.sprite.animationSpeed = a.fps / 60;
        this.animName = name;
        this.anim = a;
        this.frameIdx = -1;
      }
      return a;
    }

    /* 루프 애니메이션 (대기/달리기) */
    _loopAnim(name, speed = 1) {
      const a = this._useAnim(name);
      if (!a) return;
      this.sprite.loop = true;
      this.sprite.animationSpeed = (a.fps / 60) * speed;
      if (!this.sprite.playing) this.sprite.play();
    }

    /* 진행도에 맞춰 프레임 고정 (공격/회피/피격) */
    _frameAnim(name, p) {
      const a = this._useAnim(name);
      if (!a) return;
      this.sprite.loop = false;
      this.sprite.stop();
      const n = a.frames.length;
      const idx = G.clamp(Math.floor(p * n), 0, n - 1);
      if (this.sprite.currentFrame !== idx) this.sprite.gotoAndStop(idx);
    }

    /* 이동 거리로 사이클을 돌려 발이 미끄러지지 않게 한다 */
    _advanceCycle(a, dist, dt) {
      const n = a.frames.length;
      if (!this.cycleDist) this.cycleDist = 170;
      const rawFps = n * (dist / Math.max(dt, 1e-4)) / this.cycleDist;
      const fps = G.clamp(rawFps, 3.4, 24);
      this.cycle += (fps * dt) / n;
      const idx = ((Math.floor(this.cycle) % n) + n) % n;
      this.sprite.loop = false;
      this.sprite.stop();
      if (this.sprite.currentFrame !== idx) this.sprite.gotoAndStop(idx);
      if (idx !== this.frameIdx) {
        const contacts = a.contacts || [];
        if (contacts.indexOf(idx) >= 0) this._footstep(idx);
        this.frameIdx = idx;
      }
      this.bobPx = (a.bob && a.bob[idx] ? a.bob[idx] : 0) * this.bodyPx;
    }

    _footstep(idx) {
      const dir = Math.sign(this.facing) || 1;
      this.contactPulse = 1;
      const power = G.clamp(Math.abs(this.vx) / 260, 0.35, 1.25);
      this.game.fx.dust(this.x - 6 * dir, this.y, dir, power);
      if (G.chance(0.8)) G.Sfx.step(power);
      if (power > 0.75 && G.chance(0.5)) this.game.fx.speedLines(this.x - dir * 40, this.y - 20, dir, 2, 0.7);
    }

    move(vx, vy, dt) {
      if (this.state === 'cast' || this.state === 'dodge' || this.state === 'dead') return;
      const k = this.state === 'attack' ? 0.5 : 1;
      // 가속/감속: 입력이 갑자기 바뀔 때 미끄러지는 느낌을 줄인다
      const accel = 2600 * dt, brake = 3200 * dt;
      this.vx = approach(this.vx, vx, vx === 0 ? brake : accel);
      this.vy = approach(this.vy, vy, vy === 0 ? brake : accel * 0.8);
      const turn = (vx !== 0 && Math.sign(vx) !== Math.sign(this.vx || vx) && Math.abs(this.vx) > 160);
      if (turn) {
        this.game.fx.dust(this.x, this.y, Math.sign(this.vx), 0.9);
      }
      this.moveSpeed = Math.abs(this.vx);
      this.x = G.clamp(this.x + this.vx * k * dt, 140, 780);
      this.y = G.clamp(this.y + this.vy * k * dt, 540, 640);
      if (vx !== 0 && Math.abs(vx) > 24) this.facing = Math.sign(vx) >= 0 ? 1 : -1;
      const speed = Math.hypot(this.vx, this.vy * 0.6);
      if (speed > 16) {
        this.state = 'move';
        const targetLean = G.clamp(this.vx / 300, -1, 1) * 0.085 + G.clamp(this.vy / 300, -1, 1) * 0.02;
        this.lean = G.lerp(this.lean, targetLean, 1 - Math.pow(0.0015, dt));
      } else {
        this.lean = G.lerp(this.lean, 0, 1 - Math.pow(0.0005, dt));
        if (this.state === 'move') this.state = 'idle';
      }
      this.obj.x = this.x;
      this.obj.y = this.y;
      this.obj.zIndex = this.y;
    }

    /* 3연타 콤보 */
    attack(step) {
      if (this.state === 'attack' || this.state === 'dead' || this.state === 'dodge') return false;
      const idx = step === undefined ? this.comboStep % 3 : step % 3;
      this.atkIdx = idx;
      this.comboStep = (idx + 1) % 3;
      this.state = 'attack';
      this.stateT = 0;
      this.hitDone = false;
      this.atkCfg = COMBO[idx];
      this.weaponGlow.alpha = 0.9;
      this.weaponGlow.tint = idx === 2 ? 0x8fd0ff : 0x66aaff;
      this.facing = 1;
      G.Sfx.slash(1 + idx * 0.09);
      return true;
    }

    cast() {
      if (this.state === 'dead' || this.state === 'dodge') return false;
      this.state = 'cast';
      this.stateT = 0;
      this.castDone = false;
      this.weaponGlow.alpha = 1;
      return true;
    }

    dodge() {
      if (this.state === 'dead' || this.dodgeCD > 0) return false;
      this.state = 'dodge';
      this.stateT = 0;
      this.dodgeCD = 1.85;
      this.invuln = 0.40;
      this.dodgeDir = 1;
      this.dodgeFrom = this.x;
      this.dodgeDist = 172;
      G.Sfx.slash(0.72);
      this.game.fx.dust(this.x, this.y, -Math.sign(this.facing), 1.1);
      return true;
    }

    hurt(amount) {
      if (this.invuln > 0 || this.state === 'dead') return false;
      this.hp = Math.max(0, this.hp - amount);
      this.hurtT = 0.30;
      this.invuln = 0.5;
      this.animName = '';
      this.game.fx.damage(this.x + G.rand(20, -20), this.bodyTop + this.bodyPx * 0.35, amount, {
        color: 0xff6b7a,
        size: 34,
      });
      this.game.scene.shake(9, 0.22);
      this.game.fx.sparkBurst(this.x, this.centerY, 0xff5566, 10, 320);
      this.game.fx.hitSpark(this.x, this.centerY, 0xff9aa8, 0.8, 0.2);
      this.sprite.tint = 0xffb3b3;
      if (this.hp <= 0) {
        this.state = 'dead';
        this.stateT = 0;
      }
      return true;
    }

    update(dt, time) {
      this.bobT += dt;
      this.idleT += dt;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.dodgeCD > 0) this.dodgeCD -= dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.hurtT > 0) {
        this.hurtT -= dt;
        if (this.hurtT <= 0 && this.state !== 'dead') this.sprite.tint = 0xffffff;
      }

      this.stateT += dt;
      const prevX = this.obj.x, prevY = this.obj.y;
      let rot = this.lean;
      let dx = 0, dy = 0;
      let bob = 0;
      this.bobPx = G.lerp(this.bobPx, 0, 1 - Math.pow(0.02, dt));

      if (this.hurtT > 0 && this.state !== 'attack' && this.state !== 'dodge' && this.state !== 'dead') {
        this._frameAnim('hurt', 1 - this.hurtT / 0.30);
        this.sprite.tint = this.hurtT > 0.1 ? 0xffb3b3 : 0xffffff;
      } else if (this.state === 'attack') {
        const a = this.atkCfg;
        const hitAt = a.hit;
        const p = G.clamp(this.stateT / a.dur, 0, 1);
        this._frameAnim(a.anim, p);
        const lunge = this.stateT < a.wind
          ? G.easeInQuad(this.stateT / a.wind) * -12
          : this.stateT < hitAt + 0.08
            ? G.lerp(-12, a.lunge, G.easeOutCubic((this.stateT - a.wind) / 0.13))
            : G.lerp(a.lunge, 0, G.easeInOutQuad(G.clamp((this.stateT - hitAt - 0.08) / (a.dur - hitAt - 0.08), 0, 1)));
        dx = lunge * this.facing;
        rot = G.lerp(rot, -0.05 * this.facing + Math.sin(p * Math.PI) * 0.04 * this.facing, 0.35);
        if (!this.hitDone && this.stateT >= hitAt) {
          this.hitDone = true;
          this.game.heroStrike(this, a, this.atkIdx || 0);
        }
        if (p >= 1) {
          this.state = 'idle';
          this.weaponGlow.alpha = 0;
        }
      } else if (this.state === 'cast') {
        const p = G.clamp(this.stateT / 0.62, 0, 1);
        this._frameAnim('atk2', 0.55 + p * 0.45);
        rot = Math.sin(p * Math.PI) * -0.04;
        bob += Math.sin(p * Math.PI) * 4;
        if (p >= 1) {
          this.state = 'idle';
          this.weaponGlow.alpha = 0;
        }
      } else if (this.state === 'dodge') {
        const p = G.clamp(this.stateT / 0.30, 0, 1);
        const e = G.easeOutCubic(p);
        dx = -this.dodgeDir * this.dodgeDist * e;
        this._frameAnim('dodge', p);
        rot = -0.16 * this.facing * Math.sin(p * Math.PI);
        this.obj.alpha = 0.62 + 0.38 * Math.abs(Math.cos(p * Math.PI));
        if (p >= 1) {
          this.state = 'idle';
          this.obj.alpha = 1;
          this.x = G.clamp(this.dodgeFrom - this.dodgeDist, 140, 800);
          dx = 0;
        }
      } else if (this.state === 'dead') {
        const p = G.clamp(this.stateT / 0.9, 0, 1);
        this._frameAnim('hurt', 1);
        rot = G.lerp(0, -1.25, G.easeOutCubic(p));
        this.obj.alpha = 1 - 0.7 * p;
        dy = 6 * p;
      } else {
        if (this.weaponGlow.alpha > 0) this.weaponGlow.alpha = Math.max(0, this.weaponGlow.alpha - dt * 4);
        this.obj.alpha = G.lerp(this.obj.alpha || 1, 1, 0.2);
        if (this.state === 'move') {
          const speed = Math.hypot(this.vx, this.vy * 0.6);
          const a = this._useAnim(speed < 150 ? 'walk' : 'run');
          if (a) {
            this.cycleDist = speed < 150 ? 116 : 172;
            this._advanceCycle(a, speed * dt, dt);
            rot = this.lean * 1.15 + (a.contacts && a.contacts.indexOf(this.frameIdx) >= 0 ? 0.01 : 0);
          }
          this.rim.alpha = 0.5;
        } else {
          this.vx = 0; this.vy = 0;
          this._loopAnim('idle');
          this.bobPx = 0;
          bob = Math.sin(this.bobT * 1.5) * 1.6;
          rot = this.lean + Math.sin(this.bobT * 0.9) * 0.006;
          this.rim.alpha = G.lerp(this.rim.alpha, 0.34, 0.1);
        }
      }

      // 스프라이트 배치
      if (this.state !== 'dead') {
        this.sprite.y = bob + this.bobPx;
        this.sprite.rotation = rot;
        this.rim.rotation = rot;
        this.sprite.x = dx;
        this.weaponGlow.y = -this.bodyPx * 0.45 + bob * 0.4 + this.bobPx;
        this.weaponGlow.x = 40 * this.facing;
      } else {
        this.obj.rotation = rot;
        this.obj.y = this.y + dy;
      }
      this._applyScale();
      this._syncRim();
      this.obj.x = this.x;
      this.obj.zIndex = this.y;

      // 이동 거리(초당) → 먼지/그림자
      const moved = Math.hypot(this.x - prevX, this.y - prevY);
      const lift = Math.max(0, -this.bobPx);
      this.updateGroundFx(dt, lift, 1, this.state === 'dodge' ? 0.4 : 0);
      if (moved > 3.2 && this.state === 'move') {
        this.stride += moved;
        if (this.stride > 130) {
          this.stride = 0;
          if (G.chance(0.35)) this.game.fx.dust(this.x - 10 * this.facing, this.y, this.facing, 0.5);
        }
      }
      this.game.scene.setFocus(this.x);

      this.mp = Math.min(this.mpMax, this.mp + dt * 7.5);
    }
  }

  /* ============================ 리아 (소환 연출) ============================ */
  class LiaSummon {
    constructor(game) {
      this.game = game;
      this.mpMax = 100;
      this.mp = 100;
      this.atk = 96;
      this.active = false;
      this.obj = null;
      this.t = 0;
      this.dur = 1.5;
    }

    get centerY() { return (this.y || GROUND_Y) - 150; }

    update(dt) {
      if (!this.active) {
        this.mp = Math.min(this.mpMax, this.mp + dt * 9);
        return;
      }
      this.t += dt;
      const o = this.obj;
      if (!o) return;
      const p = G.clamp(this.t / this.dur, 0, 1);
      const enter = G.clamp(this.t / 0.26, 0, 1);
      const exit = G.clamp((this.t - (this.dur - 0.34)) / 0.34, 0, 1);
      o.alpha = enter * (1 - exit);
      o.y = this.y - (1 - G.easeOutCubic(enter)) * 90 - G.easeInCubic(exit) * 70;
      const spr = this.sprite;
      if (spr) {
        const a = G.Assets.anim.lia;
        if (a) {
          const n = a.frames.length;
          const idx = G.clamp(Math.floor((this.t / 0.34) % n), 0, n - 1);
          if (spr.currentFrame !== idx && spr.gotoAndStop) spr.gotoAndStop(idx);
        }
        spr.rotation = Math.sin(this.t * 9) * 0.03;
      }
      if (this.glow) this.glow.alpha = 0.35 + Math.sin(this.t * 14) * 0.12;
      if (this.rune) {
        this.rune.rotation += dt * 2.4;
        this.rune.alpha = (0.9 - p * 0.5) * enter * (1 - exit);
      }
      if (this.shadow) {
        this.shadow.alpha = 0.34 * enter * (1 - exit);
        this.shadow.width = 160 * enter;
      }
      if (this.t >= this.dur) {
        o.destroy({ children: true });
        this.obj = null;
        this.sprite = null;
        this.active = false;
        return;
      }
      if (exit > 0 && G.chance(0.6)) {
        this.game.fx._particle(this.x + G.rand(60, -60), this.y - G.rand(230, 40), {
          color: 0xd9c8ff, size: G.rand(16, 6), vx: G.rand(50, -50), vy: G.rand(-30, -140),
          life: 0.5, additive: true,
        });
      }
    }
  }

  /* ============================ 잡몹 ============================ */
  class Enemy extends Unit {
    constructor(game, opts = {}) {
      super(game);
      this.hpMax = opts.hp || 190;
      this.hp = this.hpMax;
      this.lv = opts.lv || 2;
      this.atk = opts.atk || 16;
      this.speed = opts.speed || G.rand(190, 148);
      this.x = opts.x || G.rand(1360, 1180);
      this.y = opts.y || GROUND_Y + G.rand(30, -26);
      this.scale = opts.scale || G.rand(0.6, 0.46);
      this.state = 'spawn';
      this.stateT = 0;
      this.bobT = G.rand(6);
      this.alive = true;
      this.dying = false;
      this.attackCD = G.rand(1.4, 0.4);
      this.stopDist = G.rand(225, 150);
      this.dead = false;
      this.kb = 0;
      this.kbV = 0;
      this.flashT = 0;
      this.walkT = G.rand(3);

      this.addHalo(0xa06bff, 220, 0.13);
      this.addShadow(110, 0.44);
      this.sprite = new PIXI.Sprite(G.Assets.tex.scout);
      this.sprite.anchor.set(0.5, 1);
      this.sprite.scale.set(-this.scale, this.scale);
      this.obj.addChild(this.sprite);
      this.rim = new PIXI.Sprite(G.Assets.tex.scout);
      this.rim.anchor.set(0.5, 1);
      this.rim.scale.set(-this.scale * 1.02, this.scale * 1.02);
      this.rim.tint = 0xc79bff;
      this.rim.blendMode = 'add';
      this.rim.alpha = 0.3;
      this.rim.y = -6;
      this.obj.addChildAt(this.rim, this.obj.getChildIndex(this.sprite));
      this.flashSpr = new PIXI.Sprite(G.Assets.tex.scout);
      this.flashSpr.anchor.set(0.5, 1);
      this.flashSpr.scale.set(-this.scale, this.scale);
      this.flashSpr.tint = 0xffffff;
      this.flashSpr.blendMode = 'add';
      this.flashSpr.alpha = 0;
      this.obj.addChild(this.flashSpr);
      this.baseH = this.sprite.height;
      this.obj.x = this.x;
      this.obj.y = this.y;
      this.obj.zIndex = this.y;
      this.obj.alpha = 0;

      // 체력바 (머리 위)
      this.bar = new PIXI.Container();
      const bg = new PIXI.Graphics();
      bg.roundRect(-48, -6, 96, 9, 4).fill({ color: 0x140a12, alpha: 0.85 });
      bg.roundRect(-48, -6, 96, 9, 4).stroke({ width: 1, color: 0x8a5bff, alpha: 0.5 });
      this.barBg = bg;
      const fill = new PIXI.Graphics();
      this.barFill = fill;
      this.bar.addChild(bg, fill);
      this.bar.y = -this.baseH - 26;
      this.lvText = new PIXI.Text({
        text: 'Lv.' + this.lv,
        style: { fontFamily: G.FONT, fontSize: 11, fontWeight: '900', fill: 0xffd6dc, stroke: { color: 0x1a0308, width: 3 } },
      });
      this.lvText.anchor.set(1, 1);
      this.lvText.x = 44; this.lvText.y = -6;
      this.bar.addChild(this.lvText);
      this.obj.addChild(this.bar);
      this._drawBar();

      this.riftT = 0;
      this.game.fx.ring(this.x, this.y - 10, 0xa06bff, 90, 0.5, 4, 0.4);
      this.game.fx.sparkBurst(this.x, this.y - 60, 0x9a6bff, 12, 260);
    }

    _drawBar() {
      const w = 96 * G.clamp(this.hp / this.hpMax, 0, 1);
      this.barFill.clear();
      if (w > 1) this.barFill.roundRect(-47, -5, w - 2, 7, 3).fill({ color: 0xff3b52, alpha: 0.95 });
    }

    get centerY() { return this.y - this.baseH * 0.55; }

    _setAttackTex(on) {
      const atk = G.Assets.anim.scout_atk;
      const tex = on && atk ? atk.frames[0] : G.Assets.tex.scout;
      if (this.sprite.texture === tex) return;
      const sc = this.baseH / tex.height;
      this.sprite.texture = tex;
      this.sprite.scale.set(-sc, sc);
      this.rim.texture = tex;
      this.rim.scale.set(-sc * 1.02, sc * 1.02);
      this.flashSpr.texture = tex;
      this.flashSpr.scale.set(-sc, sc);
      this._texScale = sc;
    }

    knockback(power, dir = 1) {
      this.kbV = Math.max(this.kbV, power);
      this.kbDir = -dir;
    }

    takeDamage(amount, opts = {}) {
      if (this.dying || !this.alive) return;
      this.hp -= amount;
      this.hitFlash = 0.1;
      this.flashT = 0.14;
      this.sprite.tint = 0xffffff;
      this._drawBar();
      this.game.fx.sparkBurst(this.x, this.centerY, opts.color || 0xffd9a0, opts.crit ? 16 : 10, opts.crit ? 460 : 320);
      this.game.fx.hitSpark(this.x + G.rand(20, -20), this.centerY, opts.crit ? 0xfff0b0 : 0xdff0ff, opts.crit ? 1.1 : 0.75, 0.2);
      this.game.fx.damage(this.x, this.centerY - 30, amount, { crit: opts.crit });
      if (opts.knock) this.knockback(opts.knock);
      if (this.hp <= 0) this.die();
    }

    die() {
      this.dying = true;
      this.state = 'dying';
      this.stateT = 0;
      this.game.onEnemyKilled(this);
      this.game.fx.sparkBurst(this.x, this.centerY, 0xb98bff, 18, 380);
      this.game.fx.ring(this.x, this.y - 30, 0x8a5bff, 110, 0.45, 3, 0.5);
      this.game.fx.debris(this.x, this.y - 20, 6, 0xb98bff, 0.8);
    }

    update(dt, time, target) {
      this.stateT += dt;
      this.bobT += dt;
      if (this.hitFlash > 0) {
        this.hitFlash -= dt;
        this.sprite.tint = 0xffffff;
      } else if (this.sprite.tint !== 0xdddddd) {
        this.sprite.tint = 0xdddddd;
      }

      if (this.kbV > 0.5) {
        this.x += this.kbV * dt;
        this.kbV *= Math.pow(0.0006, dt);
        if (this.kbV < 2) this.kbV = 0;
      }

      const bob = Math.sin(this.bobT * 3.4) * 3;
      if (this.flashT > 0) {
        this.flashT -= dt;
        this.flashSpr.alpha = Math.max(0, this.flashT / 0.14) * 0.7;
        this.flashSpr.y = this.sprite.y;
        this.flashSpr.scale.set(this.sprite.scale.x, this.sprite.scale.y);
      } else if (this.flashSpr) this.flashSpr.alpha = 0;

      if (this.state === 'spawn') {
        const p = G.clamp(this.stateT / 0.5, 0, 1);
        this.obj.alpha = p;
        this.sprite.y = bob - 10 + 10 * p;
        this.rim.y = this.sprite.y - 6;
        if (p >= 1) this.state = 'walk';
      } else if (this.state === 'walk') {
        this._setAttackTex(false);
        const dist = this.x - target.x;
        if (dist > (this.stopDist || 172)) {
          this.x -= this.speed * dt;
          this.sprite.y = bob;
          this.rim.y = bob - 6;
          this.walkT += dt;
          if (this.walkT > 0.42 / (this.speed / 190)) {
            this.walkT = 0;
            this.contactPulse = 0.8;
            this.game.fx.dust(this.x + 12, this.y, -1, 0.4);
          }
        } else {
          this.state = 'windup';
          this.stateT = 0;
          this.telegraph = true;
        }
        this.obj.x = this.x;
      } else if (this.state === 'windup') {
        const p = G.clamp(this.stateT / 0.52, 0, 1);
        this._setAttackTex(true);
        this.sprite.y = bob + Math.sin(p * Math.PI) * -7;
        this.sprite.tint = G.lerp(0, 1, p) > 0.5 ? 0xffaaaa : 0xdddddd;
        const s = this._texScale || this.scale;
        this.sprite.scale.set(-s * (1 + 0.05 * p), s * (1 - 0.03 * p));
        this.rim.scale.set(-s * 1.02 * (1 + 0.05 * p), s * 1.02 * (1 - 0.03 * p));
        this.rim.y = this.sprite.y - 6;
        if (!this.teleMark) {
          this.teleMark = new PIXI.Sprite(G.Assets.tex.ring);
          this.teleMark.anchor.set(0.5);
          this.teleMark.tint = 0xb45bff;
          this.teleMark.blendMode = 'add';
          this.teleMark.y = -this.baseH * 0.9;
          this.teleMark.width = 46; this.teleMark.height = 46;
          this.obj.addChild(this.teleMark);
        }
        this.teleMark.alpha = 0.5 + 0.5 * Math.sin(p * 24);
        this.teleMark.width = 40 + 22 * p;
        this.teleMark.height = 40 + 22 * p;
        if (p >= 1) {
          this.state = 'strike';
          this.stateT = 0;
          this.sprite.scale.set(-s, s);
          if (Math.abs(this.x - target.x) < 210 && Math.abs(this.y - target.y) < 120) {
            this.game.damageHero(this.atk, this.x);
          }
          this.game.fx.slash(this.x - 60, this.centerY, {
            radius: 80, spread: 1.4, angle: Math.PI * 0.85, width: 10,
            color: 0x8a3bff, color2: 0xc9a8ff, dur: 0.2, scale: 0.9,
          });
          this.game.fx.burst(target.x, target.centerY, { color: 0xb45bff, core: 0xf0e0ff, rays: 10, length: 90, width: 6 });
        }
      } else if (this.state === 'strike') {
        this.sprite.y = bob + 8;
        this.rim.y = this.sprite.y - 6;
        if (this.stateT > 0.26) {
          this.state = 'recover';
          this.stateT = 0;
        }
      } else if (this.state === 'recover') {
        if (this.stateT > 0.7) {
          this.state = 'walk';
          this.stateT = 0;
          this._setAttackTex(false);
        }
      } else if (this.state === 'dying') {
        const p = G.clamp(this.stateT / 0.62, 0, 1);
        this.obj.alpha = 1 - p;
        this.sprite.y = bob + 14 * p;
        this.sprite.rotation = G.lerp(0, 0.9, p);
        this.sprite.scale.set(-this.scale * (1 - 0.2 * p), this.scale * (1 - 0.45 * p));
        this.rim.alpha = 0.3 * (1 - p);
        this.bar.alpha = 0;
        if (this.teleMark) this.teleMark.alpha = 0;
        if (p >= 1) {
          this.alive = false;
          this.dead = true;
          this.obj.destroy({ children: true });
        }
      }

      if (this.state !== 'dying') {
        this.obj.zIndex = this.y;
        this.updateGroundFx(dt, 0, 1, 0);
      }
    }
  }

  /* ============================ 보스 ============================ */
  class Boss extends Unit {
    constructor(game, opts = {}) {
      super(game);
      this.hpMax = opts.hp || 30000;
      this.hp = this.hpMax;
      this.name = '그림자 군주 · 아르카논';
      this.x = opts.x || 820;
      this.y = GROUND_Y - 4;
      this.scale = 0.64;
      this.state = 'enter';
      this.stateT = 0;
      this.bobT = 0;
      this.atkTimer = 2.0;
      this.stagger = 0;
      this.alive = true;
      this.dead = false;
      this.dying = false;
      this.facing = -1;
      this.lv = 8;
      this.kbV = 0;
      this.flashT = 0;

      this.addHalo(0xff5a3c, 620, 0.16);
      this.addShadow(320, 0.58);
      this.sprite = new PIXI.Sprite(G.Assets.tex.boss);
      this.sprite.anchor.set(0.5, 1);
      this.sprite.scale.set(this.scale);
      this.rim = new PIXI.Sprite(G.Assets.tex.boss);
      this.rim.anchor.set(0.5, 1);
      this.rim.scale.set(this.scale * 1.015);
      this.rim.tint = 0xff8a6a;
      this.rim.blendMode = 'add';
      this.rim.alpha = 0.34;
      this.rim.y = -8;
      this.obj.addChild(this.rim);
      this.obj.addChild(this.sprite);
      this.baseH = this.sprite.height;
      this.flashSpr = new PIXI.Sprite(G.Assets.tex.boss);
      this.flashSpr.anchor.set(0.5, 1);
      this.flashSpr.scale.set(this.scale);
      this.flashSpr.tint = 0xffffff;
      this.flashSpr.blendMode = 'add';
      this.flashSpr.alpha = 0;
      this.obj.addChild(this.flashSpr);
      this.obj.x = this.x;
      this.obj.y = this.y;
      this.obj.zIndex = this.y;
      this.obj.alpha = 0;

      this.aura = new PIXI.Sprite(G.Assets.tex.glow);
      this.aura.anchor.set(0.5);
      this.aura.blendMode = 'add';
      this.aura.tint = 0xff2a3c;
      this.aura.width = 460;
      this.aura.height = 460;
      this.aura.y = -this.baseH * 0.45;
      this.aura.alpha = 0.18;
      this.obj.addChildAt(this.aura, 1);

      this.tele = new PIXI.Graphics();
      this.tele.x = 0;
      this.tele.y = 0;
      this.tele.alpha = 0;
      this.obj.addChild(this.tele);
    }

    get headY() { return this.y - this.baseH; }

    _setAttackTex(on) {
      const atk = G.Assets.anim.boss_atk;
      const tex = on && atk ? atk.frames[0] : G.Assets.tex.boss;
      if (this.sprite.texture === tex) return;
      const sc = this.baseH / tex.height;
      this.sprite.texture = tex;
      this.sprite.scale.set(sc, sc);
      this.rim.texture = tex;
      this.rim.scale.set(sc * 1.015, sc * 1.015);
      this.flashSpr.texture = tex;
      this.flashSpr.scale.set(sc, sc);
    }

    takeDamage(amount, opts = {}) {
      if (this.dying) return;
      this.hp = Math.max(0, this.hp - amount);
      this.hitFlash = 0.1;
      this.flashT = 0.1;
      this.kbV = Math.max(this.kbV, opts.kb || 60);
      this.game.fx.sparkBurst(
        this.x + G.rand(50, -50),
        this.y - G.rand(this.baseH * 0.8, 80),
        0xffc27a, opts.crit ? 20 : 12, opts.crit ? 480 : 300
      );
      this.game.fx.hitSpark(
        this.x + G.rand(40, -40),
        this.y - this.baseH * 0.6,
        opts.crit ? 0xfff0b0 : 0xffd9c0,
        opts.crit ? 1.5 : 1.0, 0.24
      );
      this.game.fx.damage(this.x + G.rand(60, -60), this.y - this.baseH * 0.62, amount, {
        crit: opts.crit,
        size: opts.crit ? 60 : 40,
      });
      if (this.hp <= 0) this.die();
    }

    die() {
      this.dying = true;
      this.state = 'dying';
      this.stateT = 0;
      this.game.onBossKilled();
    }

    get teleX() { return this.x - 170; }

    _drawTelegraph(progress, color) {
      this.tele.clear();
      const r = this.cfg.radius * 0.92;
      const ry = r * 0.3;
      const cx = -170;
      const pulse = 0.55 + 0.45 * Math.sin(progress * 26);
      this.tele.ellipse(cx, 0, r, ry).fill({ color, alpha: 0.12 + 0.16 * progress });
      this.tele.ellipse(cx, 0, r, ry).stroke({ width: 2.4, color, alpha: 0.35 + 0.45 * progress });
      this.tele.ellipse(cx, 0, r * (0.15 + 0.85 * progress), ry * (0.15 + 0.85 * progress))
        .fill({ color, alpha: 0.16 + 0.24 * progress });
      const ringR = r * (0.2 + 0.8 * progress);
      this.tele.ellipse(cx, 0, ringR, ry * (0.2 + 0.8 * progress))
        .stroke({ width: 6, color: 0xffffff, alpha: 0.45 * pulse });
      this.tele.alpha = 1;
    }

    startAttack(kind) {
      this.kind = kind;
      this.state = 'windup';
      this.stateT = 0;
      const cfg = {
        slam: { tele: 1.05, color: 0xff3355, dmg: 50, radius: 250 },
        combo: { tele: 0.95, color: 0xffcc33, dmg: 34, radius: 230 },
        perfect: { tele: 1.5, color: 0xffffff, dmg: 105, radius: 230 },
        summon: { tele: 1.15, color: 0xa855f7, dmg: 0, radius: 0 },
      }[kind];
      this.cfg = cfg;
      if (kind === 'perfect') this.game.showPrompt('회피 타이밍!', 0xffffff);
      if (kind === 'summon') {
        this.game.fx.ring(this.x, this.y - 10, 0xa855f7, 150, 0.7, 4);
        this.game.spawnAdds(2);
      }
    }

    update(dt, time, target) {
      this.stateT += dt;
      this.bobT += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.flashT > 0) {
        this.flashT -= dt;
        this.flashSpr.alpha = Math.max(0, this.flashT / 0.1) * 0.55;
        this.flashSpr.y = this.sprite.y;
        this.flashSpr.rotation = this.sprite.rotation;
      } else if (this.flashSpr) this.flashSpr.alpha = 0;

      if (this.dying) {
        const p = G.clamp(this.stateT / 1.6, 0, 1);
        this.obj.alpha = 1 - p;
        this.sprite.rotation = G.lerp(0, 0.35, p);
        this.sprite.y = 12 * p;
        this.rim.alpha = 0.34 * (1 - p);
        this.tele.alpha = 0;
        if (G.chance(0.35)) {
          this.game.fx._particle(this.x + G.rand(120, -120), this.y - G.rand(this.baseH, 40), {
            color: 0xff7a4a, size: G.rand(26, 10), vx: G.rand(60, -60), vy: -G.rand(180, 40),
            life: 0.8, additive: true,
          });
        }
        if (p >= 1) {
          this.alive = false;
          this.dead = true;
          this.obj.destroy({ children: true });
        }
        return;
      }

      if (this.kbV > 1) {
        this.x += this.kbV * dt;
        this.kbV *= Math.pow(0.002, dt);
        if (this.kbV < 3) this.kbV = 0;
      }

      const breathe = Math.sin(this.bobT * 1.5) * 3;
      let tintFlash = 0xffffff;
      if (this.hitFlash > 0) tintFlash = 0xffd0d0;

      if (this.state === 'enter') {
        const p = G.clamp(this.stateT / 1.4, 0, 1);
        this.obj.alpha = p;
        this.obj.y = this.y + 40 * (1 - p);
        this.sprite.y = breathe;
        this.rim.y = breathe - 8;
        if (p >= 1) {
          this.state = 'idle';
          this.stateT = 0;
        }
        this.updateGroundFx(dt, 0, 1, 1 - p);
        return;
      }

      if (this.stagger > 0) {
        this.stagger -= dt;
        this.sprite.rotation = Math.sin(time * 22) * 0.05;
        this.sprite.y = breathe + 8;
        this.rim.y = this.sprite.y - 8;
        this.rim.alpha = 0.5;
        this.sprite.tint = 0x9fb8ff;
        this.tele.alpha = Math.max(0, this.tele.alpha - dt * 6);
        if (this.stagger <= 0) {
          this.sprite.tint = 0xffffff;
          this.sprite.rotation = 0;
          this.rim.alpha = 0.34;
        }
        this.updateGroundFx(dt, 0, 1.05);
        return;
      }

      this.sprite.tint = tintFlash;

      if (this.state === 'idle') {
        this._setAttackTex(false);
        this.sprite.y = breathe;
        this.rim.y = breathe - 8;
        this.rim.rotation = 0;
        this.obj.y = this.y;
        this.atkTimer -= dt;
        const want = 715;
        if (this.x > want + 10) this.x -= 24 * dt;
        this.obj.x = this.x;
        if (this.atkTimer <= 0) {
          const pool = this.hp / this.hpMax < 0.55 ? ['slam', 'combo', 'perfect', 'perfect', 'summon'] : ['slam', 'combo', 'perfect'];
          this.startAttack(G.choice(pool));
          this.atkTimer = G.rand(2.3, 1.55);
        }
      } else if (this.state === 'windup') {
        this._setAttackTex(true);
        const p = G.clamp(this.stateT / this.cfg.tele, 0, 1);
        this._drawTelegraph(p, this.cfg.color);
        this.sprite.rotation = -0.05 * Math.sin(p * Math.PI);
        this.sprite.y = breathe - 6 * Math.sin(p * Math.PI);
        this.rim.y = this.sprite.y - 8;
        this.rim.rotation = this.sprite.rotation;
        this.aura.alpha = 0.18 + 0.25 * p;
        if (p >= 1) {
          this.state = 'strike';
          this.stateT = 0;
          this._strike(target);
        }
      } else if (this.state === 'strike') {
        this.tele.alpha = Math.max(0, this.tele.alpha - dt * 5);
        this.sprite.rotation = G.lerp(this.sprite.rotation, 0.06, 0.3);
        this.sprite.y = breathe + 10;
        this.rim.y = this.sprite.y - 8;
        this.rim.rotation = this.sprite.rotation;
        if (this.stateT > 0.45) {
          this.state = 'idle';
          this.aura.alpha = 0.18;
          this.sprite.rotation = 0;
          this._setAttackTex(false);
        }
      }
      this.obj.x = this.x;
      this.obj.zIndex = this.y;
      this.updateGroundFx(dt, 0, 1, 0);
    }

    _strike(target) {
      const kind = this.kind;
      const dist = Math.hypot(target.x - this.teleX, target.y - this.y);
      if (kind !== 'summon') {
        this.game.fx.shockRing(this.x - 40, this.y - 6, this.cfg.color, this.cfg.radius, 0.55);
        this.game.scene.shake(kind === 'perfect' ? 16 : 12, 0.4);
        this.game.fx.sparkBurst(this.x - 120, this.y - 20, this.cfg.color, 26, 620, Math.PI);
        this.game.fx.debris(this.x - 60, this.y, 8, 0xff9a7a, 1.1);
        G.Sfx.hit(true);
        if (dist < this.cfg.radius && kind !== 'perfect') this.game.damageHero(this.cfg.dmg, this.x);
        if (kind === 'perfect') {
          if (this.game.perfectCounter) {
            this.stagger = 2.2;
            this.game.onPerfectCounter(this);
          } else if (dist < this.cfg.radius) {
            this.game.damageHero(this.cfg.dmg, this.x);
          }
        }
        this.game.perfectCounter = false;
        if (kind === 'combo') {
          for (let i = 1; i <= 2; i++) {
            this.game.after(i * 0.19, () => {
              if (this.dying) return;
              this.game.fx.slash(this.x - 120, this.y - 160 + i * 30, {
                radius: 220, spread: 2.2, angle: Math.PI + 0.4 * i, width: 16,
                color: 0xffb03a, color2: 0xffd166, edge: 0xfff3c4, dur: 0.24,
              });
              if (Math.hypot(target.x - this.x, target.y - this.y) < this.cfg.radius) {
                this.game.damageHero(this.cfg.dmg * 0.6, this.x);
              }
              this.game.scene.shake(8, 0.2);
            });
          }
        }
      }
    }
  }

  G.Hero = Hero;
  G.Enemy = Enemy;
  G.Boss = Boss;
  G.LiaSummon = LiaSummon;
  G.GROUND_Y = GROUND_Y;
})();
