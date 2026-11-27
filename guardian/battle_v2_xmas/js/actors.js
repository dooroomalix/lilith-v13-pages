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
      // 소프트 타원 그라디언트를 어둡게 깔아 접지감을 준다
      // (multiply는 일부 WebGL 환경에서 그려지지 않아 normal로 고정)
      sh.blendMode = 'normal';
      sh.tint = 0x000000;
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
        const k = G.clamp(1 - liftPx * 0.014, 0.42, 1.25) * squash * pulse;
        this.shadow.width = this.shadowBase.w * k;
        this.shadow.height = this.shadowBase.w * 0.29 * k;
        this.shadow.alpha = G.clamp(Math.min(0.72, this.shadowBase.a * 1.28) * (1 - liftPx * 0.024) * (1 + this.contactPulse * 0.3), 0, 0.75) * (1 - dim);
      }
      if (this.halo) {
        this.halo.width = this.haloBase.w * (1 + 0.04 * Math.sin(this.game.time * 2.2));
        this.halo.alpha = this.haloBase.a * (1 - liftPx * 0.02) * (0.85 + 0.15 * Math.sin(this.game.time * 3.1)) * (1 - dim);
      }
    }

    flash() { this.hitFlash = 0.20; }

    /* 보른의 '강철의 일격' — 방어력 감소(받는 피해 +25%) 표시 */
    applyDefDown(sec) {
      this.defDown = Math.max(this.defDown || 0, sec);
      if (!this.defSpr) {
        const t = new PIXI.Text({
          text: '방어▼',
          style: { fontFamily: G.FONT, fontSize: 12, fontWeight: '900', fill: 0xffb27a, stroke: { color: 0x2a1404, width: 3 } },
        });
        t.anchor.set(0.5, 1);
        t.y = -(this.baseH || 120) - 40;
        this.obj.addChild(t);
        this.defSpr = t;
      }
      this.defSpr.visible = true;
    }

    tickDefDown(dt) {
      if (this.defDown > 0) {
        this.defDown = Math.max(0, this.defDown - dt);
        if (this.defDown <= 0 && this.defSpr) this.defSpr.visible = false;
      }
    }
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
        y: GROUND_Y, z: 0, vz: 0, jumpAttack: false, landT: 0, sdBodyPx: 232,
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
        dodgeDir: 1,        // 첫 회피가 공격 캔슬로 나가도 NaN이 되지 않도록 초기값을 둥다
        dodgeFrom: opts.x,
        dodgeY: GROUND_Y,
        dodgeYDir: 0,
        dodgeDist: 172,
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
      this.addHalo(opts.haloColor || 0x6fb8ff, 360, 0.18);
      this.addShadow(opts.shadowW || 196, 0.58);

      // Step 6: 파츠 리그 — 고른 캐릭터/스킨이 그대로 전투 메인으로
      this.char = opts.char || null;
      this.skin = opts.skin || 'basic';
      this.rig = null;
      if (this.char && G.Rigs && G.CHARS) {
        const def = G.Rigs.get(G.CHARS.rigKey(this.char.key, this.skin));
        if (def) {
          this.rig = new G.Rig(def, { artFacing: this.char.artFacing, mainArm: this.char.mainArm });
          this.rig.setBodyPx(opts.bodyPx || this.char.bodyPx || 330);
          this.obj.addChild(this.rig.root);
          this.stepPhase = 0;
        }
      }

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
      this.sdSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
      this.sdSprite.visible = false;
      this.obj.addChild(this.sdSprite);

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

      // 외전: 카엘 겨울 코스튬 — 붉은 목도리 오버레이 (SD 위에 얹는다)
      this.scarf = null;
      if (G.Xmas && G.Xmas.ON && !this.rig) this._buildScarf();
    }

    /* 붉은 목도리 + 흰 털 장식 — SD 몸 위에 붙어 흐느적거린다 */
    _buildScarf() {
      const g = new PIXI.Graphics();
      // 목도리 몸통(목을 한 바퀴 감는 부분)
      g.roundRect(-24, -9, 48, 16, 8).fill({ color: 0xc21f36, alpha: 1 });
      g.roundRect(-24, -9, 48, 7, 6).fill({ color: 0xe8506a, alpha: 0.88 });
      // 뒤로 흘러내리는 자락 두 갈래
      g.poly([-24, 5, -8, 7, -18, 52, -34, 45]).fill({ color: 0xb0182f, alpha: 0.97 });
      g.poly([-34, 43, -18, 50, -25, 74, -40, 66]).fill({ color: 0xd8293f, alpha: 0.95 });
      // 흰 털 장식
      for (let i = 0; i < 5; i++) g.circle(-21 + i * 10.5, -10, 3.8).fill({ color: 0xf6fbff, alpha: 0.92 });
      this.scarf = g;
      this.obj.addChild(g);
    }

    get centerY() { return this.y - this.bodyPx * 0.52; }
    get bodyTop() { return this.y - this.bodyPx; }
    get persp() { return G.clamp(1 + (this.y - GROUND_Y) * 0.0011, 0.92, 1.08); }

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
      if (this.state === 'dodge' || this.state === 'dead') return;
      const k = (this.state === 'attack' || this.state === 'cast' ? 0.4 : 1) * (this.z > 0 ? 0.8 : 1);
      // 가속/감속: 입력이 갑자기 바뀔 때 미끄러지는 느낌을 줄인다
      const accel = 2600 * dt, brake = 3200 * dt;
      this.vx = approach(this.vx, vx, vx === 0 ? brake : accel);
      this.vy = approach(this.vy, vy, vy === 0 ? brake : accel * 0.8);
      const turn = (vx !== 0 && Math.sign(vx) !== Math.sign(this.vx || vx) && Math.abs(this.vx) > 160);
      if (turn) {
        this.game.fx.dust(this.x, this.y, Math.sign(this.vx), 0.9);
      }
      this.moveSpeed = Math.abs(this.vx);
      this.x = G.clamp(this.x + this.vx * k * dt, 120, 1040);
      this.y = G.clamp(this.y + this.vy * k * dt, 492, 664);
      if (vx !== 0 && Math.abs(vx) > 24) this.facing = Math.sign(vx) >= 0 ? 1 : -1;
      const speed = Math.hypot(this.vx, this.vy * 0.6);
      if (speed > 16) {
        if (this.state !== 'attack' && this.state !== 'cast') this.state = 'move';
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
      const base = COMBO[idx];
      const own = this.char && this.char.combo ? this.char.combo[idx] : null;
      this.atkCfg = own ? Object.assign({}, base, own) : base;
      const col = this.char ? this.char.colors : null;
      if (col) { this.atkCfg.c1 = col.slash; this.atkCfg.c2 = col.slash2; this.atkCfg.edge = col.edge; }
      this.weaponGlow.alpha = 0.9;
      this.weaponGlow.tint = idx === 2 ? 0x8fd0ff : 0x66aaff;
      this.facing = this.facing || 1;
      if (this.z > 0) this.jumpAttack = true;
      if (G.Sfx.playVoice) G.Sfx.playVoice('kael_atk', { min: 3400, chance: 0.5 });
      G.Sfx.slash(1 + idx * 0.09);
      return true;
    }

    cast() {
      if (this.state === 'dead' || this.state === 'dodge') return false;
      if (G.Sfx.playVoice) G.Sfx.playVoice('kael_skill', { min: 2500, chance: 0.75 });
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
      this.dodgeDir = this.facing;
      this.dodgeY = this.y;
      this.dodgeYDir = Math.sign(this.vy || 0);
      this.dodgeFrom = this.x;
      this.dodgeDist = 172;
      G.Sfx.slash(0.72);
      this.game.fx.dust(this.x, this.y, -Math.sign(this.facing), 1.1);
      return true;
    }

    jump() {
      if (this.state === 'dead' || this.z > 0 || this.vz > 0) return false;
      this.z = 0.1; this.vz = 980; this.jumpAttack = false;
      this.game.fx.dust(this.x, this.y, this.facing, 1.1);
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

      const oldZ = this.z;
      if (this.z > 0 || this.vz > 0) {
        this.z = Math.max(0, this.z + this.vz * dt - 1300 * dt * dt);
        this.vz -= 2600 * dt;
        if (this.z === 0) {
          this.vz = 0;
          this.landT = 0.16;
          this.contactPulse = 1;
          this.game.fx.dust(this.x, this.y, this.facing, 1.8);
          if (this.jumpAttack) {
            this.game.fx.shockRing(this.x, this.y - 4, 0x8fd6ff, 180, 0.4);
            this.game.fx.sparkBurst(this.x, this.y - 25, 0xc8e9ff, 22, 400);
            this.jumpAttack = false;
          }
        }
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
      } else if (this.state === 'ult') {
        // 궁극기 자세 — 0.9초 뒤 복귀 (리그는 ult 포즈로 그동안 유지)
        if (this.stateT > 0.9) this.state = 'idle';
        bob += Math.sin(G.clamp(this.stateT / 0.9, 0, 1) * Math.PI) * 5;
      } else if (this.state === 'dodge') {
        const p = G.clamp(this.stateT / 0.30, 0, 1);
        const e = G.easeOutCubic(p);
        dx = -this.dodgeDir * this.dodgeDist * e;
        this.y = G.clamp(this.dodgeY + this.dodgeYDir * 95 * e, 492, 664);
        this._frameAnim('dodge', p);
        rot = -0.16 * this.facing * Math.sin(p * Math.PI);
        this.obj.alpha = 0.62 + 0.38 * Math.abs(Math.cos(p * Math.PI));
        if (p >= 1) {
          this.state = 'idle';
          this.obj.alpha = 1;
          this.x = G.clamp(this.dodgeFrom - this.dodgeDir * this.dodgeDist, 120, 1040);
          this.y = G.clamp(this.dodgeY + this.dodgeYDir * 95, 492, 664);
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
        if (!this.rig) this.obj.rotation = rot;
        this.obj.y = this.y + dy;
      }
      // Counter-rotating squash/stretch and velocity lean preserve foot placement.
      const moving = this.state === 'move';
      const anticipation = this.state === 'attack' && this.stateT < this.atkCfg.wind;
      const strike = this.state === 'attack' && this.stateT >= this.atkCfg.wind && this.stateT < this.atkCfg.hit + .055;
      const stretch = anticipation ? -.075 : strike ? .10 : moving ? Math.sin(this.bobT * 12) * .025 : 0;
      this._applyScale();
      this.sprite.scale.x *= 1 - stretch;
      this.sprite.scale.y *= 1 + stretch;
      this.rim.scale.x *= 1 - stretch;
      this.rim.scale.y *= 1 + stretch;
      if (moving) {
        const lean = G.clamp((this.vx || 0) / 1600, -.12, .12);
        this.sprite.rotation += lean;
        this.rim.rotation += lean;
        this.sprite.y += Math.sin(this.bobT * 15) * 2.8;
      }
      this._syncRim();
      if (this.landT > 0) this.landT = Math.max(0, this.landT - dt);
      const sdName = this.z > 0 ? 'kael_sd_jump' : this.state === 'attack' ? 'kael_sd_atk' : 'kael_sd_idle';
      if (G.Assets.sd && G.Assets.sd[sdName]) {
        const sd = G.Assets.sd[sdName];
        if (this.sdSprite.texture !== sd.texture) this.sdSprite.texture = sd.texture;
        this.sdSprite.anchor.set(sd.ax, sd.ay);
        const k = (this.sdBodyPx / (sd.bodyH || sd.h)) * this.persp;
        // 착지 스쿼시: 가로로 퍼지고 세로로 눌린다
        const sq = this.landT > 0 ? this.landT / 0.16 : 0;
        const sy = k * (1 - 0.16 * sq);
        const sx = k * (1 + 0.12 * sq);
        this.sdSprite.scale.set(this.facing * sx, sy);
        // 공중: 살짝 뜬 자세, 지상: 호흡 바운스
        const air = this.z > 0 ? Math.sin(this.bobT * 7) * 0.02 * this.facing : 0;
        this.sdSprite.y = -this.z + (this.z > 0 ? 0 : Math.sin(this.bobT * 2.4) * 1.8);
        this.sdSprite.rotation = this.sprite.rotation + air;
        this.sdSprite.visible = true; this.sprite.visible = false; this.rim.visible = false;
        // 공중 잔상
        this._airTrail = (this._airTrail || 0) + dt;
      } else { this.sdSprite.visible = false; this.sprite.visible = true; this.rim.visible = true; }
      // 겨울 목도리 — SD 몸의 목 위치를 따라가며 자락이 흔들린다
      if (this.scarf) {
        const k = 1.0;
        const sdv = this.sdSprite.visible;
        const baseY = sdv ? this.sdSprite.y : this.sprite.y;
        const rot = sdv ? this.sdSprite.rotation : this.sprite.rotation;
        this.scarf.scale.set(this.facing * k, k);
        // SD 원화의 앵커가 좌우 비대칭이라 몸통 중심을 보정한다
        const bodyOff = (0.5 - this.sdSprite.anchor.x) * this.sdSprite.scale.x * this.sdSprite.texture.width;
        this.scarf.x = bodyOff + 2 * this.facing;
        this.scarf.y = -this.sdSprite.height * 0.300 + baseY;
        this.scarf.rotation = rot * 0.5 + Math.sin(this.bobT * 3.1) * 0.07;
        this.scarf.alpha = this.obj.alpha || 1;
      }
      this.obj.x = this.x;
      this.obj.zIndex = this.y;
      this.obj.y = this.y;
      if (!this.sdSprite.visible) { this.sprite.y -= this.z; this.rim.y -= this.z; }
      // 그림자는 바닥에 남고, 뜬 높이만큼 작고 옅어진다 (호버링처럼 보이지 않게)

      // 이동 거리(초당) → 먼지/그림자
      const moved = Math.hypot(this.x - prevX, this.y - prevY);
      const lift = Math.max(0, -this.bobPx);
      this.updateGroundFx(dt, Math.min(46, Math.max(lift, this.z * 0.12)), 1, this.state === 'dodge' ? 0.4 : 0);
      if (moved > 3.2 && this.state === 'move') {
        this.stride += moved;
        if (this.stride > 130) {
          this.stride = 0;
          if (G.chance(0.35)) this.game.fx.dust(this.x - 10 * this.facing, this.y, this.facing, 0.5);
        }
      }
      this.game.scene.setFocus(this.x);

      this.mp = Math.min(this.mpMax, this.mp + dt * 7.5);
      if (this.rig) this._driveRig(dt);
    }

    /* 파츠 리그 구동 — 상태·진행도·방향을 관절 포즈로 옮긴다 */
    _driveRig(dt) {
      const r = this.rig;
      this.sprite.visible = false;
      this.rim.visible = false;
      this.sdSprite.visible = false;
      let st = 'idle', p = 0;
      const cfg = { mainArm: this.char.mainArm };
      if (this.hurtT > 0 && this.state !== 'attack' && this.state !== 'dodge' && this.state !== 'dead') {
        st = 'hurt'; p = 1 - this.hurtT / 0.30;
      } else if (this.state === 'attack') {
        st = 'atk' + ((this.atkIdx || 0) + 1); p = G.clamp(this.stateT / this.atkCfg.dur, 0, 1);
      } else if (this.state === 'cast') {
        st = 'cast'; p = G.clamp(this.stateT / 0.62, 0, 1);
      } else if (this.state === 'dodge') {
        st = 'dodge'; p = G.clamp(this.stateT / 0.30, 0, 1);
      } else if (this.state === 'ult') {
        st = 'ult'; p = G.clamp(this.stateT / 0.85, 0, 1);
      } else if (this.state === 'dead') {
        st = 'dead'; p = G.clamp(this.stateT / 0.9, 0, 1);
      } else if (this.state === 'kneel') {
        st = 'kneel'; p = 1;
      } else if (this.state === 'reach') {
        st = 'reach'; p = G.clamp(this.stateT / 0.5, 0, 1);
      } else if (this.z > 0 || this.vz > 0) {
        st = 'jump'; p = G.clamp(this.z / 190, 0, 1);
      } else if (this.landT > 0) {
        st = 'land'; p = 1 - this.landT / 0.16;
      } else if (this.state === 'move') {
        st = 'move';
        const sp = Math.hypot(this.vx, this.vy * 0.6);
        this.stepPhase = (this.stepPhase + (sp * dt) / 26) % (Math.PI * 2);
        cfg.stepPhase = this.stepPhase; cfg.speed = sp;
      }
      r.setFacing(this.facing);
      r.setState(st, p, cfg);
      r.root.y = -this.z;
      r.update(dt);
      if (this.hurtT > 0.1) r.hitFlash(0xffc0c8);
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
      // 외전(크리스마스) 적: variant 키로 스노우볼·미믹·루돌프를 고른다
      const V = (G.Xmas && opts.variant && G.Xmas.enemies[opts.variant]) || null;
      this.variant = V ? V.key : 'scout';
      this.cfg = V;
      this.hpMax = opts.hp || (V ? V.hp : 190);
      this.hp = this.hpMax;
      this.lv = opts.lv || 2;
      this.atk = opts.atk || (V ? V.atk : 16);
      this.speed = opts.speed || (V ? V.speed : G.rand(190, 148));
      this.x = opts.x || G.rand(1360, 1180);
      this.y = opts.y || GROUND_Y + G.rand(30, -26);
      this.scale = opts.scale || (V ? 0.5 : G.rand(0.6, 0.46));
      this.state = 'spawn';
      this.stateT = 0;
      this.bobT = G.rand(6);
      this.alive = true;
      this.dying = false;
      this.attackCD = G.rand(1.4, 0.4);
      this.stopDist = V ? V.stopDist : G.rand(225, 150);
      this.facing = opts.facing || -1;   // 왼쪽 스폰은 1, 오른쪽 스폰은 -1 (링 안쪽을 본다)
      this.atkDir = this.facing;
      this.atkY = this.y;
      this.dead = false;
      this.kb = 0;
      this.kbV = 0;
      this.flashT = 0;
      this.walkT = G.rand(3);
      this.stunT = 0;      // 보른 — 기절
      this.defDown = 0;    // 보른 — 방어력 감소
      this.defSpr = null;
      this.stunSpr = null;
      this.windupT = V ? V.windup : 0.52;
      this.stumbleDur = V ? V.rest : 0.7;

      const sdInfo = V
        ? ((G.Assets.sd && G.Assets.sd[V.sd]) || null)
        : ((G.Assets.sd && G.Assets.sd.scout_sd) || null);
      const baseTex = sdInfo ? sdInfo.texture : (V ? PIXI.Texture.WHITE : G.Assets.tex.scout);
      const origTex = V ? baseTex : G.Assets.tex.scout;

      this.addHalo(V ? V.halo : 0xa06bff, V ? 300 : 240, V ? 0.18 : 0.16);
      this.addShadow(V ? 152 : 132, 0.5);
      this.sprite = new PIXI.Sprite(baseTex);
      this.sprite.anchor.set(sdInfo ? sdInfo.ax : 0.5, sdInfo ? sdInfo.ay : 1);
      if (V && sdInfo) this.scale = V.bodyPx / (sdInfo.bodyH || sdInfo.h);
      else if (sdInfo) this.scale = 186 / (sdInfo.bodyH || sdInfo.h);
      this.sprite.scale.set(-this.scale, this.scale);
      this.obj.addChild(this.sprite);
      this.rim = new PIXI.Sprite(baseTex);
      this.rim.anchor.set(sdInfo ? sdInfo.ax : 0.5, sdInfo ? sdInfo.ay : 1);
      this.rim.scale.set(-this.scale * 1.02, this.scale * 1.02);
      this.rim.tint = V ? V.halo : 0xc79bff;
      this.rim.blendMode = 'add';
      this.rim.alpha = V ? 0.28 : 0.42;
      this.rim.y = -6;
      this.obj.addChildAt(this.rim, this.obj.getChildIndex(this.sprite));
      this.flashSpr = new PIXI.Sprite(origTex);
      this.flashSpr.anchor.set(0.5, 1);
      this.flashSpr.scale.set(-this.scale, this.scale);
      this.flashSpr.tint = 0xffffff;
      this.flashSpr.blendMode = 'add';
      this.flashSpr.alpha = 0;
      this.obj.addChild(this.flashSpr);
      this.baseH = this.sprite.height;

      // Step 6: 적도 관절 리그 (정면 통이미지 미끄러짐 제거)
      this.rig = null;
      if (V && G.Rigs) {
        const rdef = G.Rigs.get(this.variant);
        if (rdef) {
          this.rig = new G.Rig(rdef, { artFacing: -1, mainArm: 'near' });
          this.rig.setBodyPx(V.bodyPx || 200);
          this.obj.addChildAt(this.rig.root, this.obj.getChildIndex(this.sprite));
        }
      }

      this.obj.x = this.x;
      this.obj.y = this.y;
      this.obj.zIndex = this.y;
      this.obj.alpha = 0;

      // 체력바 (머리 위)
      this.bar = new PIXI.Container();
      const bg = new PIXI.Graphics();
      bg.roundRect(-48, -6, 96, 9, 4).fill({ color: 0x140a12, alpha: 0.85 });
      bg.roundRect(-48, -6, 96, 9, 4).stroke({ width: 1, color: V ? V.tele : 0x8a5bff, alpha: 0.5 });
      this.barBg = bg;
      const fill = new PIXI.Graphics();
      this.barFill = fill;
      this.bar.addChild(bg, fill);
      this.bar.y = -this.baseH - 14;
      this.lvText = new PIXI.Text({
        text: 'Lv.' + this.lv,
        style: { fontFamily: G.FONT, fontSize: 11, fontWeight: '900', fill: 0xffd6dc, stroke: { color: 0x1a0308, width: 3 } },
      });
      this.lvText.anchor.set(1, 1);
      this.lvText.x = 44; this.lvText.y = -6;
      this.bar.addChild(this.lvText);
      this.obj.addChild(this.bar);
      this._drawBar();

      // 바닥 예고 (외전 적 전용) — 월드 좌표, 캐릭터 아래
      if (V) {
        this.tele = new PIXI.Graphics();
        this.tele.alpha = 0;
        this.game.bossTeleLayer.addChild(this.tele);
      }

      this.riftT = 0;
      this.game.fx.ring(this.x, this.y - 10, V ? V.tele : 0xa06bff, 90, 0.5, 4, 0.4);
      this.game.fx.sparkBurst(this.x, this.y - 60, V ? V.halo : 0x9a6bff, 12, 260);
    }

    _drawBar() {
      const w = 96 * G.clamp(this.hp / this.hpMax, 0, 1);
      this.barFill.clear();
      if (w > 1) this.barFill.roundRect(-47, -5, w - 2, 7, 3).fill({ color: 0xff3b52, alpha: 0.95 });
    }

    get centerY() { return this.y - this.baseH * 0.55; }

    _setAttackTex(on) {
      // 외전 적은 공격 전용 원화가 없다 → 텍스처 교체 없이 몸짓으로 예고한다
      if (this.cfg) { if (this._texScale == null) this._texScale = this.scale; return; }
      const atk = G.Assets.anim.scout_atk;
      const tex = on && atk ? atk.frames[0] : G.Assets.tex.scout;
      if (this.sprite.texture === tex) return;
      const k = on && atk ? (atk.atkScale || 1) : 1;
      const sc = (this.baseH / tex.height) * k;
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

    /* 세나의 서리 — 이동이 느려진다 */
    applySlow(sec) {
      if (this.dying || !this.alive) return;
      this.slowT = Math.max(this.slowT || 0, sec);
      if (!this.slowSpr) {
        const t = new PIXI.Text({
          text: '서리▼',
          style: { fontFamily: G.FONT, fontSize: 12, fontWeight: '900', fill: 0x9fe6ff, stroke: { color: 0x08202c, width: 3 } },
        });
        t.anchor.set(0.5, 1);
        t.y = -this.baseH - 40;
        this.obj.addChild(t);
        this.slowSpr = t;
      }
      this.slowSpr.visible = true;
    }

    tickSlow(dt) {
      if (this.slowT > 0) {
        this.slowT = Math.max(0, this.slowT - dt);
        if (this.slowT <= 0 && this.slowSpr) this.slowSpr.visible = false;
      }
    }

    /* 기절: 예고·공격을 끊고 1.8초 동안 별이 도는 상태로 멈춘다 */
    stun(sec) {
      if (this.dying || !this.alive) return;
      this.stunT = Math.max(this.stunT, sec);
      if (this.state === 'windup' || this.state === 'strike') {
        this.state = 'recover';
        this.stateT = 0;
      }
      this._setAttackTex(false);
      if (this.teleMark) this.teleMark.alpha = 0;
      if (!this.stunSpr) {
        const c = new PIXI.Container();
        const g = new PIXI.Graphics();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * G.TAU;
          g.circle(Math.cos(a) * 20, Math.sin(a) * 7, 3.4).fill({ color: 0xffe9a8, alpha: 0.95 });
        }
        c.addChild(g);
        c.y = -this.baseH - 20;
        this.obj.addChild(c);
        this.stunSpr = c;
        this.stunSpin = g;
      }
      this.stunSpr.visible = true;
    }

    takeDamage(amount, opts = {}) {
      if (this.dying || !this.alive) return;
      if (this.defDown > 0) amount = Math.round(amount * 1.25);   // 보른의 방어력 감소
      this.hp -= amount;
      this.hitFlash = 0.18;
      this.flashT = 0.22;
      this.sprite.tint = 0xffffff;
      this._drawBar();
      this.game.fx.sparkBurst(this.x, this.centerY, opts.color || 0xffd9a0, opts.crit ? 16 : 10, opts.crit ? 460 : 320);
      this.game.fx.hitSpark(this.x + G.rand(20, -20), this.centerY, opts.crit ? 0xfff0b0 : 0xdff0ff, opts.crit ? 1.1 : 0.75, 0.2);
      this.game.fx.damage(this.x, this.centerY - 30, amount, { crit: opts.crit });
      if (opts.knock) this.knockback(opts.knock * 1.2);
      // 외전 몬스터 피격 보이스 (쿨다운은 audio.js VOICE 표)
      if (this.cfg && G.Sfx.playVoice && (opts.crit || G.chance(0.32))) {
        G.Sfx.playVoice(this.variant + '_hit');
      }
      if (this.hp <= 0) this.die();
    }

    die() {
      this.dying = true;
      this.state = 'dying';
      this.stateT = 0;
      this.game.onEnemyKilled(this);
      this.game.fx.sparkBurst(this.x, this.centerY, this.cfg ? this.cfg.halo : 0xb98bff, 18, 380);
      this.game.fx.ring(this.x, this.y - 30, this.cfg ? this.cfg.tele : 0x8a5bff, 110, 0.45, 3, 0.5);
      this.game.fx.debris(this.x, this.y - 20, 6, this.cfg ? 0xffe6b0 : 0xb98bff, 0.8);
      if (this.tele) this.tele.alpha = 0;
    }

    /* ---- 외전 적 전용 상태 흐름 (스노우볼·미믹·루돌프) ---- */
    _updateXmas(dt, target, bob) {
      const cfg = this.cfg;
      this.obj.x = this.x;
      this.obj.zIndex = this.y;

      if (this.state === 'dying') {
        const p = G.clamp(this.stateT / 0.66, 0, 1);
        this.obj.alpha = 1 - p;
        this.sprite.y = bob + 16 * p;
        this.sprite.rotation = G.lerp(0, 0.95, p);
        this.sprite.scale.set(-this.scale * (1 - 0.15 * p), this.scale * (1 - 0.4 * p));
        this.bar.alpha = 0;
        if (this.tele) this.tele.alpha = 0;
        if (p >= 1) {
          this.alive = false;
          this.dead = true;
          if (this.tele) { this.tele.destroy(); this.tele = null; }
          this.obj.destroy({ children: true });
        }
        return;
      }

      if (this.state === 'walk') {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dir = Math.sign(dx) || this.facing || -1;
        this.facing = dir;
        // 2.5D 링 — 플레이어의 깊이(Y) 레인으로 내려온다
        if (Math.abs(dy) > 12) {
          this.y = G.clamp(this.y + Math.sign(dy) * this.speed * 0.5 * dt, 500, 664);
        }
        if (Math.abs(dx) > this.stopDist) {
          this.x = G.clamp(this.x + dir * this.speed * (this.slowT > 0 ? 0.55 : 1) * dt, 110, 1080);
          this.sprite.y = bob;
          this.walkT += dt;
          if (this.walkT > 0.30) { this.walkT = 0; this.contactPulse = 0.9; }
          const bobS = 1 + Math.sin(this.bobT * 7.4) * 0.02;
          this.sprite.scale.set(-this.scale, this.scale * bobS);
        } else if (Math.abs(dy) <= 16) {
          this.state = 'windup';
          this.stateT = 0;
          this.sprite.scale.set(-this.scale, this.scale);
          this.atkDir = this.facing;
          this.atkY = this.y;
          this.game.fx.ring(this.x, this.y - 6, cfg.tele, 70, 0.3, 2, 0.4);
        }
        return;
      }

      if (this.state === 'windup') {
        const p = G.clamp(this.stateT / this.windupT, 0, 1);
        this.sprite.y = bob + Math.sin(p * Math.PI) * -9;
        this.sprite.rotation = -0.07 * p * (this.x > target.x ? 1 : -1);
        this.sprite.scale.set(-this.scale * (1 + 0.06 * p), this.scale * (1 - 0.05 * p));
        this._drawTele(p, target);
        if (p >= 1) {
          this.state = 'strike';
          this.stateT = 0;
          this._startStrike(target);
        }
        return;
      }

      if (this.state === 'strike') {
        this._strikeStep(dt, target);
        return;
      }

      if (this.state === 'stumble') {
        const p = G.clamp(this.stateT / Math.max(0.1, this.stumbleDur), 0, 1);
        this.sprite.rotation = Math.sin(this.stateT * 19) * 0.13;
        this.sprite.y = bob + 6;
        const sq = 1 + 0.06 * Math.sin(this.stateT * 15);
        this.sprite.scale.set(-this.scale * sq, this.scale / sq);
        if (this.dizzy) this.dizzy.rotation += dt * 7;
        if (p >= 1) {
          this.state = 'recover';
          this.stateT = 0;
          this.sprite.rotation = 0;
          this.sprite.scale.set(-this.scale, this.scale);
          if (this.dizzy) this.dizzy.visible = false;
        }
        return;
      }

      if (this.state === 'recover') {
        if (this.stateT > 0.4) {
          this.state = 'walk';
          this.stateT = 0;
        }
        return;
      }
    }

    _drawTele(p, target) {
      const g = this.tele;
      if (!g) return;
      const cfg = this.cfg;
      g.clear();
      g.alpha = 1;
      if (cfg.move === 'bell') {
        const r = (cfg.teleR || 200) * (0.3 + 0.7 * p);
        const blink = p > 0.9 ? 0.55 + 0.45 * Math.sin(this.stateT * 40) : 1;
        g.ellipse(this.x, this.y, r, r * 0.4).fill({ color: 0x2a0a12, alpha: 0.26 * blink });
        g.ellipse(this.x, this.y, r, r * 0.4).fill({ color: cfg.tele, alpha: 0.10 + 0.16 * p });
        g.ellipse(this.x, this.y, r, r * 0.4).stroke({ color: cfg.tele, width: 6, alpha: 0.55 * blink });
        g.ellipse(this.x, this.y, r * 0.62, r * 0.25).stroke({ color: 0xffffff, width: 2, alpha: 0.28 * p });
      } else {
        const dir = Math.sign(target.x - this.x) || -1;
        const L = cfg.move === 'charge' ? 430 : 330;
        const w = cfg.move === 'charge' ? 96 : 82;
        const x = this.x, y = this.y;
        const tipX = x + dir * L, tipY = y - 34;
        g.poly([x - w * 0.28, y, tipX, tipY - w, tipX, tipY + w, x + w * 0.28, y])
          .fill({ color: cfg.tele, alpha: 0.10 + 0.18 * p });
        g.poly([x, y, x + dir * L * p, tipY - w * p, x + dir * L * p, tipY + w * p])
          .fill({ color: 0xffffff, alpha: 0.05 + 0.13 * p });
        g.moveTo(x, y).lineTo(tipX, tipY - w).stroke({ color: cfg.tele, width: 3, alpha: 0.85 });
        g.moveTo(x, y).lineTo(tipX, tipY + w).stroke({ color: cfg.tele, width: 3, alpha: 0.85 });
        g.moveTo(tipX, tipY - w).lineTo(tipX, tipY + w).stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
      }
    }

    _startStrike(target) {
      const cfg = this.cfg;
      if (cfg && G.Sfx.playVoice) G.Sfx.playVoice(this.variant + '_atk', { chance: 0.85 });
      this.strikeFromX = this.x;
      this.strikeDir = Math.sign(target.x - this.x) || -1;
      this.strikeHit = false;
      if (cfg.move === 'bell') {
        this.game.fx.shockRing(this.x, this.y - 6, cfg.tele, (cfg.teleR || 200) * 1.15, 0.55);
        this.game.fx.ring(this.x, this.y - this.baseH * 0.5, 0xffe0e0, 170, 0.5, 7, 0.65);
        this.game.fx.sparkBurst(this.x, this.y - this.baseH * 0.45, 0xffc9c0, 20, 420);
        this.game.scene.shake(9, 0.28);
        G.Sfx.magic();
        if (target.z <= 40 && Math.hypot(target.x - this.x, (target.y - this.y) * 1.7) < (cfg.teleR || 200)) {
          this.game.damageHero(this.atk, this.x);
        }
        this.enterStumble(cfg.rest, false);
        return;
      }
      this.game.fx.shockRing(this.x, this.y - 6, cfg.tele, 110, 0.35);
    }

    _strikeStep(dt, target) {
      const cfg = this.cfg;
      const dur = cfg.move === 'charge' ? 0.30 : 0.34;
      const p = G.clamp(this.stateT / dur, 0, 1);
      if (cfg.move === 'roll') {
        const e = G.easeOutCubic(p);
        this.x = this.strikeFromX + this.strikeDir * cfg.dash * e;
        this.sprite.rotation = this.strikeDir * p * 0.6;
        if (!this.strikeHit && Math.abs(target.x - this.x) < 98 && Math.abs(target.y - this.y) < 48) {
          this.strikeHit = true;
          this.game.damageHero(this.atk, this.x);
          this.game.fx.sparkBurst(this.x, this.y - 90, 0xdfefff, 16, 380);
        }
        if (p >= 1) {
          this.sprite.rotation = 0;
          this.game.fx.debris(this.x, this.y - 8, 6, 0xe6f6ff, 1.0);
          this.game.fx.dust(this.x, this.y, this.strikeDir, 1.3);
          this.enterStumble(cfg.rest, true);
        }
      } else if (cfg.move === 'charge') {
        const e = G.easeInQuad(p);
        this.x = this.strikeFromX + this.strikeDir * cfg.dash * e;
        this.sprite.rotation = this.strikeDir * 0.08;
        if (!this.strikeHit && Math.abs(target.x - this.x) < 92 && Math.abs(target.y - this.y) < 48) {
          this.strikeHit = true;
          this.game.damageHero(this.atk, this.x);
          this.game.fx.sparkBurst(this.x, this.y - 80, 0xe6c8ff, 16, 400);
        }
        // 전장 끝까지 돌진해 박으면 훔친 선물을 쏟고 경직
        if (p >= 1 || this.x < 155 || this.x > 1055) {
          this.x = G.clamp(this.x, 155, 1055);
          this.game.fx.sparkBurst(this.x, this.y - 70, 0xffd7a0, 18, 420);
          this.game.fx.debris(this.x, this.y - 26, 9, 0xffcf6a, 1.1);
          this.game.fx.ring(this.x, this.y - 40, 0xffd7a0, 120, 0.5, 5, 0.6);
          this.game.scene.shake(6, 0.2);
          this.enterStumble(cfg.rest, true);
        }
      }
      this.obj.x = this.x;
      this.obj.zIndex = this.y;
    }

    /* 무방비 상태: 머리 위에 별이 돌고 몸이 흔들린다 */
    enterStumble(sec, weak) {
      this.state = 'stumble';
      this.stateT = 0;
      this.stumbleDur = sec;
      if (this.tele) this.tele.alpha = 0;
      if (!weak) return;
      if (!this.dizzy) {
        const c = new PIXI.Container();
        const g = new PIXI.Graphics();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * G.TAU;
          g.circle(Math.cos(a) * 22, Math.sin(a) * 8, 3.6).fill({ color: 0xffe9a8, alpha: 0.95 });
        }
        c.addChild(g);
        c.y = -this.baseH - 22;
        this.obj.addChild(c);
        this.dizzy = c;
      }
      this.dizzy.visible = true;
      this.game.fx.popText(this.x, this.y - this.baseH - 34, '무방비!', {
        color: 0xffe9a8, size: 17, dur: 0.85, stroke: 0x3a2404, letter: 1,
      });
    }

    update(dt, time, target) {
      if (this.dead) return;
      this._updateCore(dt, time, target);
      if (this.rig && !this.dead) this._driveRig(dt, target);
    }

    _driveRig(dt, target) {
      const r = this.rig;
      if (!r || !r.body || r.body.destroyed) return;
      this.sprite.visible = false;
      if (this.rim) this.rim.visible = false;
      if (this.flashSpr) this.flashSpr.visible = false;
      let st = 'idle', p = 0;
      const S = this.state;
      if (this.stunT > 0 && S !== 'dying') { st = 'stumble'; p = 0.5; }
      else if (S === 'spawn') { st = 'spawn'; p = G.clamp(this.stateT / 0.5, 0, 1); }
      else if (S === 'walk') { st = 'walk'; this.stepPhase = (this.stepPhase || 0) + dt * 7.4; }
      else if (S === 'windup') { st = 'windup'; p = G.clamp(this.stateT / Math.max(0.1, this.windupT), 0, 1); }
      else if (S === 'strike') { st = 'strike'; p = G.clamp(this.stateT / 0.34, 0, 1); }
      else if (S === 'stumble') { st = 'stumble'; p = G.clamp(this.stateT / Math.max(0.1, this.stumbleDur), 0, 1); }
      else if (S === 'dying') { st = 'dead'; p = G.clamp(this.stateT / 0.62, 0, 1); }
      const dir = target ? Math.sign(target.x - this.x) || -1 : -1;
      r.setFacing(dir);
      r.setState(st, p, { stepPhase: this.stepPhase || 0 });
      r.update(dt);
      if (this.flashT > 0.1) r.hitFlash(0xffd9d9);
    }

    _updateCore(dt, time, target) {
      this.stateT += dt;
      this.bobT += dt;
      this.tickDefDown(dt);
      this.tickSlow(dt);
      if (this.hitFlash > 0) {
        this.hitFlash -= dt;
        this.sprite.tint = 0xffffff;
      } else if (this.sprite.tint !== 0xdddddd) {
        this.sprite.tint = 0xdddddd;
      }

      // 기절 중에는 행동·예고를 멈추고 제자리에서 흔들린다
      if (this.stunT > 0 && this.state !== 'dying') {
        this.stunT = Math.max(0, this.stunT - dt);
        const bobS = Math.sin(this.bobT * 3.4) * 3;
        this.sprite.y = bobS + 4;
        if (this.rim) this.rim.y = bobS - 6;
        this.obj.x = this.x;
        if (this.stunSpin) this.stunSpin.rotation += dt * 7;
        if (this.stunT <= 0 && this.stunSpr) this.stunSpr.visible = false;
        this.updateGroundFx(dt, 0, 1, 0);
        return;
      }

      if (this.kbV > 0.5) {
        this.x += this.kbV * dt;
        this.kbV *= Math.pow(0.0006, dt);
        if (this.kbV < 2) this.kbV = 0;
      }

      const bob = Math.sin(this.bobT * 3.4) * 3;
      if (this.flashT > 0) {
        this.flashT -= dt;
        this.flashSpr.alpha = Math.max(0, this.flashT / 0.22) * (this.cfg ? 0.38 : 0.7);
        this.flashSpr.y = this.sprite.y;
        this.flashSpr.scale.set(this.sprite.scale.x, this.sprite.scale.y);
      } else if (this.flashSpr) this.flashSpr.alpha = 0;

      if (this.state === 'spawn') {
        const p = G.clamp(this.stateT / 0.5, 0, 1);
        this.obj.alpha = p;
        this.sprite.y = bob - 10 + 10 * p;
        this.rim.y = this.sprite.y - 6;
        if (p >= 1) this.state = 'walk';
      } else if (this.cfg) {
        this._updateXmas(dt, target, bob);
      } else if (this.state === 'walk') {
        this._setAttackTex(false);
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const stopDist = this.stopDist || 172;
        this.facing = Math.sign(dx) || this.facing || -1;
        // 2.5D 링 — 어느 쪽에서 왔든 플레이어의 깊이(Y) 레인까지 따라 내려온다
        if (Math.abs(dy) > 12) {
          this.y = G.clamp(this.y + Math.sign(dy) * this.speed * 0.55 * dt, 500, 664);
        }
        if (Math.abs(dx) > stopDist) {
          this.x = G.clamp(this.x + Math.sign(dx) * this.speed * dt, 60, 1240);
          this.sprite.y = bob;
          this.rim.y = bob - 6;
          this.walkT += dt;
          if (this.walkT > 0.42 / (this.speed / 190)) {
            this.walkT = 0;
            this.contactPulse = 0.8;
            this.game.fx.dust(this.x - 12 * this.facing, this.y, -this.facing, 0.4);
          }
        } else if (Math.abs(dy) <= 16) {
          this.state = 'windup';
          this.stateT = 0;
          this.telegraph = true;
          this.atkDir = this.facing;
          this.atkY = this.y;
        }
        this.obj.x = this.x;
        this.obj.y = this.y;
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
          /* 2.5D 판정 — 예고 때 잠근 정면 + 좁은 깊이 레인(±44). */
          if (G.inFront(this.x, target.x, this.atkDir || this.facing || -1, 210)
            && G.inLane(target.y, this.atkY == null ? this.y : this.atkY, G.LANE.enemy)) {
            this.game.damageHero(this.atk, this.x);
          }
          this.game.fx.slash(this.x + 60 * (this.facing || -1), this.centerY, {
            radius: 80, spread: 1.4, angle: (this.facing || -1) > 0 ? Math.PI * 0.15 : Math.PI * 0.85, width: 10,
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
      // 다크 산타 노엘 (외전 보스)
      const NOEL = (G.Xmas && opts.variant === 'noel') ? G.Xmas.boss : null;
      this.noel = !!NOEL;
      this.sdKey = NOEL ? NOEL.sd : 'boss_sd';
      this.bodyPx = NOEL ? NOEL.bodyPx : 382;
      this.hpMax = opts.hp || (NOEL ? NOEL.hp : 30000);
      this.hp = this.hpMax;
      this.name = NOEL ? NOEL.label : '그림자 군주 · 아르카논';
      this.x = opts.x || 820;
      this.y = GROUND_Y - 4;
      this.scale = 0.64;
      this.state = 'enter';
      this.stateT = 0;
      this.bobT = 0;
      this.atkTimer = 2.0;
      this.firstAttack = true;
      this.stagger = 0;
      this.alive = true;
      this.dead = false;
      this.dying = false;
      this.facing = -1;
      this.lv = 8;
      this.kbV = 0;
      this.flashT = 0;
      this.defDown = 0;
      this.defSpr = null;
      // 노엘 3페이즈 상태 (HP 구간에 따라 P1→P2→P3)
      this.phaseIdx = 0;
      this.phaseCfg = NOEL ? G.Xmas.boss.phases[0] : null;
      this.phaseKey = NOEL ? G.Xmas.boss.phases[0].key : 'P1';
      this.phaseLock = 0;
      this.atkLog = [];
      // Step 11-2 — 1차 중파 / 각성 / 광폭화
      this.form = 'base';        // base → damaged → awakening → berserk
      this.formLog = [];         // 전환 기록(검증용)
      this.selfBleed = 0;        // 광폭화 자해 누적
      this.selfBleedLog = [];    // 자해 기록(검증용)
      this.rigKey = NOEL ? 'noel' : null;
      this.rigIndex = -1;
      this.displayName = this.name;
      this.baseHpMax = this.hpMax;
      // Step 11-1 — 표정·전용 이동·스킬 모션 상태
      this.expr = 'normal';
      this.exprLock = null;      // 검증용 강제 표정(없으면 상태가 정한다)
      this.tripT = 0;            // 자루에 걸려 휘청이는 시간
      this.flusteredT = 0;       // 당황 표정 유지 시간
      this.moodClock = 0;
      this.moving = 0;           // 이번 프레임 이동량(px)
      this.stepPhase = 0;
      this.snowT = 0;            // 발끝 눈가루 누적
      this.trailT = 0;
      this.skillLog = [];        // 스킬 모션 발동 기록(검증용)

      this.addHalo(NOEL ? 0x8fb4ff : 0xff5a3c, NOEL ? 560 : 620, 0.16);
      this.addShadow(NOEL ? 340 : 370, 0.56);
      const bsd = G.Assets.sd && G.Assets.sd[this.sdKey];
      this.bossTex = bsd ? bsd.texture : G.Assets.tex.boss;
      this.sprite = new PIXI.Sprite(this.bossTex);
      this.sprite.anchor.set(bsd ? bsd.ax : 0.5, bsd ? bsd.ay : 1);
      this.sprite.scale.set(this.scale);
      this.rim = new PIXI.Sprite(this.bossTex);
      this.rim.anchor.set(0.5, 1);
      this.rim.scale.set(this.scale * 1.015);
      this.rim.tint = NOEL ? 0xffb0c4 : 0xff8a6a;
      this.rim.blendMode = 'add';
      this.rim.alpha = NOEL ? 0.30 : 0.34;
      this.rim.y = -8;
      this.obj.addChild(this.rim);
      this.obj.addChild(this.sprite);
      if (bsd) this.scale = this.bodyPx / (bsd.bodyH || bsd.h);
      this.sprite.scale.set(this.scale);
      this.rim.scale.set(this.scale * 1.015);
      this.baseH = this.sprite.height;
      this.flashSpr = new PIXI.Sprite(NOEL ? this.bossTex : G.Assets.tex.boss);
      this.flashSpr.anchor.set(0.5, 1);
      this.flashSpr.scale.set(this.scale);
      this.flashSpr.tint = 0xffffff;
      this.flashSpr.blendMode = 'add';
      this.flashSpr.alpha = 0;
      this.obj.addChild(this.flashSpr);
      // Step 6: 보스(노엘)도 관절 리그
      this.rig = null;
      if (NOEL && G.Rigs) {
        const rdef = G.Rigs.get('noel');
        if (rdef) {
          this.rig = new G.Rig(rdef, { artFacing: -1, mainArm: 'near', face: true });
          this.rig.setBodyPx(this.bodyPx);
          this.rigIndex = this.obj.getChildIndex(this.sprite);
          this.obj.addChildAt(this.rig.root, this.rigIndex);
        }
      }

      this.obj.x = this.x;
      this.obj.y = this.y;
      this.obj.zIndex = this.y;
      this.obj.alpha = 0;

      this.aura = new PIXI.Sprite(G.Assets.tex.glow);
      this.aura.anchor.set(0.5);
      this.aura.blendMode = 'add';
      this.aura.tint = NOEL ? 0xa8264a : 0xff2a3c;
      this.aura.width = 460;
      this.aura.height = 460;
      this.aura.y = -this.baseH * 0.45;
      this.aura.alpha = 0.18;
      this.auraBase = 0.18;      // 중파·각성·광폭화에서 오라 기준값이 올라간다
      this.obj.addChildAt(this.aura, 1);

      this.tele = new PIXI.Graphics();
      this.tele.x = 0;
      this.tele.y = 0;
      this.tele.alpha = 0;
      this.game.bossTeleLayer.addChild(this.tele);
    }

    get headY() { return this.y - this.baseH; }

    _setAttackTex(on) {
      // 노엘은 공격 전용 프레임 원화가 없다 → 몸짓·오라로 예고한다
      if (this.noel) return;
      const atk = G.Assets.anim.boss_atk;
      const tex = on && atk ? atk.frames[0] : G.Assets.tex.boss;
      if (this.sprite.texture === tex) return;
      const k = on && atk ? (atk.atkScale || 1) : 1;
      const sc = (this.baseH / tex.height) * k;
      this.sprite.texture = tex;
      this.sprite.scale.set(sc, sc);
      this.rim.texture = tex;
      this.rim.scale.set(sc * 1.015, sc * 1.015);
      this.flashSpr.texture = tex;
      this.flashSpr.scale.set(sc, sc);
    }

    takeDamage(amount, opts = {}) {
      if (this.dying) return;
      if (this.defDown > 0) amount = Math.round(amount * 1.25);   // 보른의 방어력 감소
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
      if (this.hp <= 0) {
        // 본전(중파 포함) 격파 → 승리가 아니라 각성 페이즈로 이어진다
        if (this.noel && this.form !== 'awakening' && this.form !== 'berserk') this.awaken();
        else this.die();
      } else if (this.noel) {
        this._checkPhase();
        // 중파 이후에는 피격도 중파 목소리로 낸다
        if (this.form !== 'base' && G.Sfx.playVoice && G.chance(0.3)) {
          G.Sfx.playVoice(G.Xmas.boss.forms.damaged.voices.hit, { min: 5200 });
        }
      }
      if (this.noel && this.hp > 0) this._checkBerserk();
    }

    /* ---- Step 11-2: 중파 · 각성 · 광폭화 ---- */
    get formCfg() {
      const F = (G.Xmas && G.Xmas.boss && G.Xmas.boss.forms) || null;
      if (!F || !this.noel) return null;
      return F[this.form] || null;
    }

    /* 피해 배율 — 각성 3배 × 광폭화 1.15배 (광폭화에서도 각성의 3배가 유지된다) */
    _formDmgMul() {
      if (!this.noel) return 1;
      const F = G.Xmas.boss.forms;
      let m = 1;
      if (this.form === 'awakening' || this.form === 'berserk') m *= F.awakening.dmgMul;
      if (this.form === 'berserk') m *= F.berserk.dmgMul;
      return m;
    }

    /* 본전 HP 30% 이하 → 1차 중파 (중파 리그·오라·보이스 세트로 교체) */
    _checkDamaged() {
      if (!this.noel || this.form !== 'base') return false;
      const D = G.Xmas.boss.forms.damaged;
      if (this.hp / this.hpMax > D.hpThreshold) return false;
      // 페이즈 전환 연출과 겹치지 않게 잠금이 풀린 뒤에 적용한다
      if (this.phaseLock > 0) return false;
      this._applyDamaged();
      return true;
    }

    _applyDamaged() {
      const D = G.Xmas.boss.forms.damaged;
      this.form = 'damaged';
      this.phaseLock = 1.9;
      this.state = 'idle';
      this.stateT = 0;
      this.atkTimer = 1.7;
      this.sprite.rotation = 0;
      this.tele.clear();
      this.tele.alpha = 0;
      this.tripT = 0;
      this._applyDamagedRig();
      this.aura.tint = D.aura;
      this.aura.alpha = D.auraAlpha;
      this.auraBase = D.auraAlpha;
      this.rim.tint = D.rim;
      this.formLog.push({ t: +this.game.time.toFixed(2), form: 'damaged', hp: Math.round(this.hp), ratio: +(this.hp / this.hpMax).toFixed(3) });
      if (this.game.onBossDamaged) this.game.onBossDamaged(this);
    }

    /* 폼별 일러스트 리그로 교체 (Step 11-4 — 중파/광폭화 두 벌) */
    _applyFormRig(formKey) {
      if (!this.noel || !G.Rigs) return false;
      const F = (G.Xmas.boss.forms && G.Xmas.boss.forms[formKey]) || null;
      const key = (F && F.rig) || G.Xmas.boss.forms.damaged.rig;
      if (this.rigKey === key && this.rig) return true;
      const def = G.Rigs.get(key);
      if (!def) {
        G.Rigs.load(key).catch(() => {});
        this._rigPending = key;
        return false;
      }
      const idx = this.rigIndex >= 0 ? this.rigIndex : this.obj.getChildIndex(this.sprite);
      if (this.rig && this.rig.root && !this.rig.root.destroyed) {
        this.obj.removeChild(this.rig.root);
        this.rig.root.destroy({ children: true });
      }
      // 중파 원화는 표정이 이미 그려져 있어 오버레이를 덧그리지 않는다
      this.rig = new G.Rig(def, { artFacing: -1, mainArm: 'near', face: false });
      this.rig.setBodyPx(this.bodyPx);
      this.obj.addChildAt(this.rig.root, idx);
      this.rigIndex = idx;
      this.rigKey = key;
      this._rigPending = null;
      return true;
    }

    /* 1차 중파 리그 (기존 호출부·검증 스크립트 호환) */
    _applyDamagedRig() { return this._applyFormRig('damaged'); }

    /* 늦게 받은 폼 리그를 적용한다 — 어느 폼의 리그인지 rig 키로 되짚는다 */
    _applyPendingRig() {
      const key = this._rigPending;
      if (!key || !G.Rigs || !G.Rigs.get(key)) return false;
      const forms = (G.Xmas && G.Xmas.boss && G.Xmas.boss.forms) || {};
      const fk = Object.keys(forms).find((k) => forms[k].rig === key) || 'damaged';
      return this._applyFormRig(fk);
    }

    /* 본전 격파 → 바로 죽지 않고 각성 준비 (연출 뒤 finishAwaken) */
    awaken() {
      if (this.dying || this.awakenPending || this.form === 'awakening' || this.form === 'berserk') return;
      this.hp = 1;
      this.awakenPending = true;
      this.state = 'idle';
      this.stateT = 0;
      this.atkTimer = 999;
      this.phaseLock = 2.8;
      this.stagger = 0;
      this.tripT = 0;
      this.tele.clear();
      this.tele.alpha = 0;
      this.sprite.rotation = 0;
      this._applyDamagedRig();
      this.formLog.push({ t: +this.game.time.toFixed(2), form: 'awakening-begin', from: this.form });
      if (this.game.onBossAwakening) this.game.onBossAwakening(this);
    }

    /* 각성 완료 — 체력 4배(중파 체력 +300%)로 다시 일어난다 */
    finishAwaken() {
      if (this.dying || !this.awakenPending) return;
      const A = G.Xmas.boss.forms.awakening;
      this.awakenPending = false;
      this.form = 'awakening';
      this.hpMax = Math.round(this.hpMax * A.hpMul);
      this.hp = this.hpMax;
      this.name = A.name;
      this.displayName = A.name;
      const PH = G.Xmas.boss.phases;
      this.phaseIdx = PH.length - 1;
      this.phaseCfg = PH[PH.length - 1];
      this.phaseKey = PH[PH.length - 1].key;
      this.phaseLock = 1.1;
      this.atkTimer = 1.4;
      this.aura.tint = A.aura;
      this.aura.alpha = A.auraAlpha;
      this.auraBase = A.auraAlpha;
      this.rim.tint = A.rim;
      this.formLog.push({ t: +this.game.time.toFixed(2), form: 'awakening', hp: Math.round(this.hp), hpMax: this.hpMax });
      if (this.game.onBossAwakened) this.game.onBossAwakened(this);
    }

    /* 각성 보스 HP 30% 이하 → 광폭화 (공격할 때마다 자해 + 공속 3배) */
    _checkBerserk() {
      if (!this.noel || this.form !== 'awakening') return false;
      const B = G.Xmas.boss.forms.berserk;
      if (this.hp / this.hpMax > B.hpThreshold) return false;
      if (this.phaseLock > 0) return false;
      this._applyBerserk();
      return true;
    }

    _applyBerserk() {
      const B = G.Xmas.boss.forms.berserk;
      this.form = 'berserk';
      this.phaseLock = 2.0;
      this.state = 'idle';
      this.stateT = 0;
      this.atkTimer = 1.2;
      this.tele.clear();
      this.tele.alpha = 0;
      this.aura.tint = B.aura;
      this.aura.alpha = B.auraAlpha;
      this.auraBase = B.auraAlpha;
      this.rim.tint = B.rim;
      // Step 11-4 — 광폭화는 1차 중파와 다른 2차 중파 일러스트로 바뀐다
      this._applyFormRig('berserk');
      this.formLog.push({ t: +this.game.time.toFixed(2), form: 'berserk', rig: this.rigKey, hp: Math.round(this.hp), ratio: +(this.hp / this.hpMax).toFixed(3) });
      if (this.game.onBossBerserk) this.game.onBossBerserk(this);
    }

    /* 광폭화 자해 — 공격할 때마다 자기 체력이 깎이고, 그 피해로도 정상 처치된다 */
    _selfBleed() {
      if (this.form !== 'berserk' || this.dying) return 0;
      const B = G.Xmas.boss.forms.berserk;
      const dmg = Math.max(1, Math.round(this.hpMax * B.selfDmg));
      this.selfBleed += dmg;
      this.hp = Math.max(0, this.hp - dmg);
      this.hitFlash = 0.1;
      this.flashT = 0.08;
      const rec = { t: +this.game.time.toFixed(2), dmg, hp: Math.round(this.hp), kind: this.kind };
      this.selfBleedLog.push(rec);
      if (this.selfBleedLog.length > 40) this.selfBleedLog.shift();
      this.atkLog.push({ t: rec.t, kind: 'selfBleed', phase: this.phaseKey, form: this.form, dmg, hp: rec.hp });
      if (this.atkLog.length > 60) this.atkLog.shift();
      const fx = this.game.fx;
      if (fx) {
        fx.damage(this.x + G.rand(50, -50), this.y - this.baseH * 0.66, dmg, { color: 0xc9a8ff, size: 34 });
        fx.sparkBurst(this.x, this.y - this.baseH * 0.6, 0xb02a4a, 16, 420);
        fx.ring(this.x, this.y - this.baseH * 0.5, 0xc21f36, 190, 0.4, 5, 0.6);
      }
      if (this.hp <= 0) this.die();
      return dmg;
    }

    /* HP 구간을 넘었으면 페이즈를 올리고 연출을 요청한다 */
    _checkPhase() {
      const PH = G.Xmas.boss.phases;
      const ratio = this.hp / this.hpMax;
      let idx = 0;
      for (let i = 1; i < PH.length; i++) if (ratio < PH[i - 1].min) idx = i;
      if (idx <= this.phaseIdx) return;
      this.phaseIdx = idx;
      this.phaseCfg = PH[idx];
      this.phaseKey = PH[idx].key;
      this.phaseLock = 1.7;
      this.state = 'idle';
      this.stateT = 0;
      this.atkTimer = 1.5;
      this.sprite.rotation = 0;
      this.tele.clear();
      this.tele.alpha = 0;
      if (this.game.onBossPhaseTransition) this.game.onBossPhaseTransition(this, idx);
    }

    die() {
      this.dying = true;
      this.state = 'dying';
      this.stateT = 0;
      this.game.onBossKilled();
    }

    get teleX() { return this.teleTarget ? this.teleTarget.x : this.x - 170; }

    _drawTelegraph(progress, color) {
      const g = this.tele; g.clear();
      if (!this.cfg || this.kind === 'summon') return;
      const left = this.cfg.tele - this.stateT;
      const blink = left < 0.22 && Math.floor(left * 26) % 2 === 0;
      const base = blink ? 0xfff0f0 : color;
      const targets = this.teleTargets || [this.teleTarget];
      for (const q of targets) {
        if (!q) continue;
        const p = this.kind === 'multi'
          ? G.clamp((this.stateT - q.at) / q.dur, 0, 1)
          : G.clamp(this.stateT / this.cfg.tele, 0, 1);
        if (this.kind === 'line') {
          const a = q.angle || 0, dx = Math.cos(a), dy = Math.sin(a);
          const half = 62, L = 940;
          const nx = -dy * half, ny = dx * half;
          const x = this.x, y = this.y;
          const quad = (l) => [x + nx, y + ny, x + dx * l + nx, y + dy * l + ny,
            x + dx * l - nx, y + dy * l - ny, x - nx, y - ny];
          g.poly(quad(L)).fill({ color: 0x3d0006, alpha: 0.55 });
          g.poly(quad(L)).fill({ color: base, alpha: 0.10 + 0.22 * p });
          g.poly([x + nx * 0.5, y + ny * 0.5, x + dx * L * p + nx * 0.5, y + dy * L * p + ny * 0.5,
            x + dx * L * p - nx * 0.5, y + dy * L * p - ny * 0.5, x - nx * 0.5, y - ny * 0.5])
            .fill({ color: 0xffffff, alpha: 0.06 + 0.16 * p });
          g.moveTo(x + nx, y + ny).lineTo(x + dx * L + nx, y + dy * L + ny).stroke({ color: base, width: 3, alpha: 0.9 });
          g.moveTo(x - nx, y - ny).lineTo(x + dx * L - nx, y + dy * L - ny).stroke({ color: base, width: 3, alpha: 0.9 });
          const ex = x + dx * L * p, ey = y + dy * L * p;
          g.poly([ex + dx * 46, ey + dy * 46, ex + nx * 1.15, ey + ny * 1.15, ex - nx * 1.15, ey - ny * 1.15])
            .fill({ color: 0xffffff, alpha: 0.2 + 0.45 * p });
        } else {
          const r = q.r, ry = r * 0.40;
          g.ellipse(q.x, q.y, r, ry).fill({ color: 0x3d0006, alpha: 0.34 });
          g.ellipse(q.x, q.y, r, ry).fill({ color: base, alpha: 0.18 + 0.30 * p });
          g.ellipse(q.x, q.y, r * (0.12 + 0.88 * p), ry * (0.12 + 0.88 * p))
            .fill({ color: 0xffffff, alpha: 0.07 + 0.15 * p });
          g.ellipse(q.x, q.y, r, ry).stroke({ color: base, width: 13, alpha: 0.22 });
          g.ellipse(q.x, q.y, r, ry).stroke({ color: base, width: 5.5, alpha: 0.95 });
          g.ellipse(q.x, q.y, r * p, ry * p).stroke({ color: 0xffe8e8, width: 5, alpha: 0.45 + 0.45 * p });
          g.moveTo(q.x - r * 0.16, q.y).lineTo(q.x + r * 0.16, q.y).stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
          g.moveTo(q.x, q.y - ry * 0.46).lineTo(q.x, q.y + ry * 0.46).stroke({ color: 0xffffff, width: 2, alpha: 0.35 });
        }
      }
      g.alpha = 1;
    }

    startAttack(kind) {
      if (G.Sfx.playVoice && kind === 'perfect') G.Sfx.playVoice('boss_roar');
      this.kind = kind;
      this._windupFxDone = false;
      this.trailT = 0;
      // 외전 노엘은 페이즈별 전용 대사로 예고한다
      const sv = this._skillVoice(kind);
      if (sv && G.Sfx.playVoice) G.Sfx.playVoice(sv, { chance: 0.92 });
      this.state = 'windup';
      this.stateT = 0;
      const cfg = {
        slam: { tele: 1.1, color: 0xff3355, dmg: 50, radius: 230 },
        line: { tele: 0.9, color: 0xff3355, dmg: 46, radius: 120 },
        multi: { tele: 1.5, color: 0xff3355, dmg: 32, radius: 140 },
        combo: { tele: 0.95, color: 0xffcc33, dmg: 34, radius: 230 },
        perfect: { tele: 1.5, color: 0xffffff, dmg: 105, radius: 230 },
        summon: { tele: 1.15, color: 0xa855f7, dmg: 0, radius: 0 },
      }[kind];
      // 노엘: 눈보라(푸른빛) · 썰매(검붉음) · 종스리(흰빛) 색 구분
      if (this.noel && G.Xmas.boss.teleColors[kind]) cfg.color = G.Xmas.boss.teleColors[kind];
      // 페이즈 강화 — 예고 단축 · 피해·범위 증가
      const PH = this.noel ? this.phaseCfg : null;
      if (PH) {
        cfg.tele *= PH.tele;
        cfg.dmg = Math.round(cfg.dmg * PH.dmg);
        cfg.radius *= PH.radius;
      }
      // Step 11-2 — 각성(데미지 3배) · 광폭화(추가 피해 + 공속 3배)
      // 멀티플라이는 중첩된다 — 광폭화는 각성의 3배 위에 1.15배를 더한다
      const dmgMul = this._formDmgMul();
      if (dmgMul > 1) cfg.dmg = Math.round(cfg.dmg * dmgMul);
      const F = this.formCfg;
      // 광폭화 — 예고(시전) 시간도 같은 배율로 줄이고, 하한만 지킨다
      const aspd = this._aspdMul();
      if (F && F.teleMin) cfg.tele = Math.max(F.teleMin, cfg.tele / aspd);
      this.cfg = cfg;
      if (this.atkLog) {
        this.atkLog.push({ t: +this.game.time.toFixed(2), kind, phase: this.phaseKey, form: this.form, tele: +cfg.tele.toFixed(2), dmg: cfg.dmg, radius: Math.round(cfg.radius) });
        if (this.atkLog.length > 60) this.atkLog.shift();
      }
      // 강력 기술(장판·3연속·심판)은 스킬 컷인으로 알린다 (게임 쪽에서 쿨다운 관리)
      if (this.game && this.game.onBossSkill) this.game.onBossSkill(kind);
      const h = this.game.kael;
      const angle = Math.atan2(h.y-this.y,h.x-this.x);
      this.teleTarget = {x:h.x,y:h.y,r:cfg.radius,angle};
      this.teleTargets = kind === 'multi'
        ? [0, 1, 2].map((i) => ({ x: G.clamp(h.x + (i - 1) * 215, 150, 1090), y: G.clamp(h.y + (i - 1) * 52, 520, 660), r: 140 * (PH ? PH.radius : 1), at: i * 0.45, dur: 0.6 }))
        : [this.teleTarget];
      this.lineDir = this.teleTarget.angle;
      this.dashT = 0;
      // 노엘의 공격이 광장을 휩쓸면 등불이 하나 꺼진다 (소등)
      if (this.noel && this.game.lanterns) {
        const chance = kind === 'summon' ? 0.8 : (kind === 'line' || kind === 'slam') ? 0.34 : 0;
        if (chance && G.chance(chance)) this.game.lanterns.extinguishNear(this.teleTarget.x, this.teleTarget.y);
      }
      if (kind === 'perfect') this.game.showPrompt('회피 타이밍!', 0xffffff);
      if (kind === 'summon') {
        this.game.fx.ring(this.x, this.y - 10, 0xa855f7, 150, 0.7, 4);
        this.game.spawnAdds(PH ? PH.adds : 2);
      }
    }

    update(dt, time, target) {
      if (this.dead) return;
      this._updateCore(dt, time, target);
      if (this.rig && !this.dead) this._driveRig(dt, target);
    }

    _driveRig(dt, target) {
      const r = this.rig;
      if (!r || !r.body || r.body.destroyed) return;
      this.sprite.visible = false;
      if (this.rim) this.rim.visible = false;
      if (this.flashSpr) this.flashSpr.visible = false;
      let st = 'idle', p = 0;
      const S = this.state;
      const kind = this.kind;
      const throwKind = kind === 'multi' || kind === 'summon' || kind === 'combo';
      if (S === 'enter') { st = 'spawn'; p = G.clamp(this.stateT / 1.4, 0, 1); }
      else if (this.tripT > 0) { st = 'sackTrip'; p = 0.5; }
      else if (S === 'windup') {
        p = G.clamp(this.stateT / Math.max(0.15, this.cfg ? this.cfg.tele : 1), 0, 1);
        st = kind === 'perfect' ? 'bellAbsorb' : (throwKind ? 'giftWind' : 'sackWind');
      } else if (S === 'strike') {
        p = G.clamp(this.stateT / 0.45, 0, 1);
        st = kind === 'perfect' ? 'bellRelease' : (throwKind ? 'giftThrow' : 'sackSwing');
      } else if (this.stagger > 0) { st = 'stumble'; p = 0.5; }
      else if (this.dying) { st = 'dead'; p = G.clamp(this.stateT / 1.6, 0, 1); }
      else if (this.moving > 0.05) {
        // 전용 활공 보행 — 벨벳 코트·선물 자루가 흔들리고 발끝에서 눈가루
        st = 'glide';
        this.stepPhase += dt * 7.4 * G.clamp(this.moving / 26, 0.6, 1.5);
        this.snowT -= dt;
        if (this.snowT <= 0) {
          this.snowT = 0.10;
          this.game.fx.snowPuff(this.x - this.facing * 26, this.y - 2, this.facing, 0.7 + Math.min(0.8, this.moving / 40));
        }
      } else {
        this.stepPhase += dt * 1.4;
      }
      const dir = target ? Math.sign(target.x - this.x) || -1 : -1;
      r.setFacing(dir);
      r.setState(st, p, { stepPhase: this.stepPhase, speed: Math.max(120, this.moving * 60 / Math.max(dt, 0.001)) });
      r.update(dt);
      if (this.flashT > 0.06) r.hitFlash(0xffe0e6);
      // 표정 — 대기/스킬/피격/넘어짐에 따라 실시간 전환
      const ex = this._exprName();
      if (ex !== this.expr) {
        this.expr = ex;
        r.setExpression(ex);
      }
    }

    /* 표정 결정 — 자루에 걸림(휘청)·HP 낮음은 당황, 피격은 찡그림, 스킬은 집중 */
    _exprName() {
      if (this.exprLock) return this.exprLock;
      // 중파·각성·광폭화는 웃는 표정이 없다 — 항상 치열하게
      if (this.form && this.form !== 'base') {
        if (this.tripT > 0) return 'flustered';
        if (this.stagger > 0 || this.hitFlash > 0) return 'hit';
        return 'focus';
      }
      if (this.tripT > 0 || this.flusteredT > 0) return 'flustered';
      if (this.stagger > 0) return 'hit';
      if (this.hitFlash > 0) return 'hit';
      if (this.state === 'windup' || this.state === 'strike') return 'focus';
      return 'normal';
    }

    /* 스킬 종류·페이즈에 맞는 전용 보이스 (중파 이후에는 중파 보이스 세트) */
    _skillVoice(kind) {
      if (!this.noel) return null;
      if (this.form === 'damaged' || this.form === 'awakening' || this.form === 'berserk') {
        const V = G.Xmas.boss.forms.damaged.voices;
        if (kind === 'perfect' || kind === 'multi' || kind === 'summon' || kind === 'combo') return V.skill2;
        return V.skill1;
      }
      if (kind === 'perfect') return 'noel_skill3';
      if (kind === 'multi' || kind === 'summon' || kind === 'combo') return 'noel_skill2';
      if (kind === 'slam' || kind === 'line') return 'noel_skill1';
      return null;
    }

    /* 페이즈별 스킬 이펙트 — 1페이즈 눈보라·2페이즈 선물·3페이즈 종소리 */
    _skillFxWindup(kind) {
      const fx = this.game.fx;
      if (!fx) return;
      const rec = { t: +this.game.time.toFixed(2), kind, phase: this.phaseKey };
      if (kind === 'perfect') {
        // 등불의 푸른빛을 광장에서 빨아들인다
        const L = this.game.lanterns;
        if (L && L.items) {
          L.items.forEach((it) => {
            if (!it.lit) return;
            fx.lanternDrain(it.x, it.y, this.x, this.y - 140, { color: 0x8fd0ff, dur: 0.8, delay: G.rand(0.12, 0) });
          });
        }
        fx.ring(this.x, this.y - 150, 0x8fd0ff, 190, 0.7, 6, 0.7);
        fx.iceCrystal(this.x + G.rand(90, -90), this.y - 30, { color: 0x9fd8ff, scale: 0.8 });
        rec.drain = !!L;
      } else if (kind === 'summon') {
        fx.giftBox(this.x, this.y - 210, this.x + G.rand(150, -150), this.y - 10, { size: 1.1, dur: 0.5 });
        fx.ribbonBurst(this.x, this.y - 200, 6);
        rec.gift = true;
      } else if (kind === 'multi') {
        (this.teleTargets || []).forEach((q, i) => {
          fx.giftBox(this.x - 40, this.y - 200, q.x, q.y - 6,
            { size: 0.85, dur: 0.5 + i * 0.12, delay: 0.08 * i });
        });
        rec.gifts = (this.teleTargets || []).length;
      } else if (kind === 'slam') {
        fx.iceCrystal(this.x + 70, this.y - 20, { color: 0xbfe6ff, scale: 0.9 });
        for (let i = 0; i < 10; i++) {
          fx.snowPuff(this.x + G.rand(70, -70), this.y - G.rand(150, 20), 1, 0.5);
        }
        rec.snow = true;
      } else if (kind === 'line') {
        fx.ring(this.x, this.y - 120, 0xff9ab0, 170, 0.5, 5, 0.8);
        rec.rush = true;
      }
      this.skillLog.push(rec);
      if (this.skillLog.length > 40) this.skillLog.shift();
    }

    /* 스킬 착탄 이펙트 */
    _skillFxStrike(kind) {
      const fx = this.game.fx;
      if (!fx) return;
      const q = this.teleTarget || { x: this.x, y: this.y };
      const r = this.cfg ? this.cfg.radius : 200;
      if (kind === 'perfect') {
        fx.bellShock(this.x, this.y, { color: 0x7fc4ff, r: Math.max(380, r * 1.9), dur: 1.05 });
        fx.sparkBurst(this.x, this.y - 100, 0xbfe4ff, 30, 720);
      } else if (kind === 'multi') {
        (this.teleTargets || []).forEach((t) => fx.giftBlast(t.x, t.y - 8, { r: t.r * 0.9 }));
      } else if (kind === 'summon') {
        fx.giftBlast(this.x + G.rand(80, -80), this.y - 10, { r: 150 });
      } else if (kind === 'slam') {
        fx.blizzardBomb(q.x, q.y, { r });
      } else if (kind === 'line') {
        fx.blizzardBomb(q.x, q.y, { r: r * 0.8 });
        fx.sackTrail(this.x, this.y, Math.sign(Math.cos(this.lineDir || 0)) || -1, 1.2);
      } else {
        fx.shockRing(q.x, q.y, 0xffb0c0, r, 0.5);
      }
    }

    _updateCore(dt, time, target) {
      this.stateT += dt;
      this.bobT += dt;
      this.moving = 0;
      // Step 11-2 — 중파 리그를 뒤늦게 받았으면 여기서 교체하고,
      // HP 구간을 넘으면 중파·광폭화로 넘어간다 (페이즈 잠금이 풀린 뒤)
      if (this.noel && !this.dying) {
        if (this._rigPending) this._applyPendingRig();
        if (this.form === 'base') this._checkDamaged();
        else if (this.form === 'awakening') this._checkBerserk();
      }
      if (this.tripT > 0) this.tripT = Math.max(0, this.tripT - dt);
      if (this.flusteredT > 0) this.flusteredT = Math.max(0, this.flusteredT - dt);
      if (this.phaseLock > 0) this.phaseLock = Math.max(0, this.phaseLock - dt);
      this.tickDefDown(dt);
      // 보스도 항상 플레이어를 바라본다 — 등 뒤 판정이 생기지 않는다
      if (!this.dying && target) this.facing = Math.sign(target.x - this.x) || this.facing || -1;
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
          this.tele.destroy();
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
        if (this.x > want + 10) {
          const dx = Math.min(24 * dt, this.x - want);
          this.x -= dx;
          this.moving = dx;
        }
        // HP 가 낮아지면 가끔 자루에 걸린 듯 당황한 표정이 스친다
        const hpRatio = this.hp / this.hpMax;
        if (this.noel && hpRatio < 0.36 && this.phaseLock <= 0) {
          this.moodClock += dt;
          if (this.moodClock > 3.6) { this.moodClock = 0; this.flusteredT = 1.3; }
        }
        this.obj.x = this.x;
        if (this.atkTimer <= 0 && this.phaseLock <= 0) {
          const pool = (this.noel && this.phaseCfg)
            ? this.phaseCfg.pool
            : (this.hp / this.hpMax < 0.55 ? ['slam', 'line', 'multi', 'perfect', 'summon'] : ['slam', 'line', 'multi', 'perfect']);
          // 첫 공격은 항상 장판(slam) — 등장 직후 보스 컷인이 확실히 한 번 뜬다
          const kind = this.firstAttack ? 'slam' : G.choice(pool);
          this.firstAttack = false;
          this.startAttack(kind);
          this.atkTimer = this._nextAtkDelay(this.phaseCfg ? this.phaseCfg.atk : [2.3, 1.55]);
        }
      } else if (this.state === 'windup') {
        this._setAttackTex(true);
        if (!this._windupFxDone) { this._windupFxDone = true; this._skillFxWindup(this.kind); }
        const p = G.clamp(this.stateT / this.cfg.tele, 0, 1);
        // Last 0.6s: the boss crouches, raises the weapon and fills the danger ring.
        const warnP = G.clamp((this.stateT - Math.max(0, this.cfg.tele - 0.6)) / 0.6, 0, 1);
        if (this.kind === 'multi') {
          (this.teleTargets || []).forEach((q) => {
            if (!q.done && this.stateT >= q.at + q.dur) { q.done = true; this._burstCircle(q, target); }
          });
        }
        this._drawTelegraph(warnP, 0xff3851);
        this.sprite.rotation = -0.05 - 0.16 * warnP;
        this.sprite.y = breathe + 11 * warnP - 8 * Math.sin(p * Math.PI);
        this.rim.y = this.sprite.y - 8;
        this.rim.rotation = this.sprite.rotation;
        this.aura.alpha = this.auraBase + 0.25 * p;
        if (p >= 1) {
          this.state = 'strike';
          this.stateT = 0;
          this._strike(target);
        }
      } else if (this.state === 'strike') {
        this.tele.alpha = Math.max(0, this.tele.alpha - dt * 5);
        if (this.kind === 'line' && this.stateT < 0.34) {
          const sp = 1650 * (1 - this.stateT / 0.34);
          const beforeX = this.x, beforeY = this.y;
          this.x = G.clamp(this.x + Math.cos(this.lineDir) * sp * dt, 150, 1090);
          this.y = G.clamp(this.y + Math.sin(this.lineDir) * sp * dt * 0.5, 516, 664);
          this.moving = Math.abs(this.x - beforeX) + Math.abs(this.y - beforeY);
          this.trailT -= dt;
          if (this.trailT <= 0) {
            this.trailT = 0.05;
            this.game.fx.sackTrail(this.x, this.y, Math.cos(this.lineDir) >= 0 ? 1 : -1, 1.0);
          }
          this.obj.x = this.x; this.obj.y = this.y; this.obj.zIndex = this.y;
          if (G.chance(0.8)) {
            this.game.fx._particle(this.x + G.rand(40, -40), this.y - G.rand(this.baseH * 0.7, 40), {
              color: 0xff5566, size: G.rand(22, 8), vx: G.rand(-40, -160), vy: G.rand(20, -40),
              life: 0.4, additive: true,
            });
          }
        }
        this.sprite.rotation = G.lerp(this.sprite.rotation, 0.06, 0.3);
        this.sprite.y = breathe + 10;
        this.rim.y = this.sprite.y - 8;
        this.rim.rotation = this.sprite.rotation;
        if (this.stateT > 0.45 / this._aspdMul()) {
          this.state = 'idle';
          this.aura.alpha = this.auraBase;
          this.sprite.rotation = 0;
          this._setAttackTex(false);
          // 페이즈가 오를수록 곧바로 이어 치는 연속 패턴이 섞인다
          const B = this.formCfg;
          const aspd = (B && B.aspdMul) ? B.aspdMul : 1;
          if (this.phaseCfg && this.phaseCfg.chain && G.chance(Math.min(0.9, this.phaseCfg.chain * (aspd > 1 ? 1.6 : 1)))) {
            this.atkTimer = Math.min(this.atkTimer, aspd > 1 ? 0.14 : 0.42);
          }
        }
      }
      this.obj.x = this.x;
      this.obj.zIndex = this.y;
      const bsd = G.Assets.sd && G.Assets.sd[this.sdKey];
      if (bsd) {
        this.sprite.texture = bsd.texture;
        this.sprite.anchor.set(bsd.ax, bsd.ay);
        this.sprite.scale.set(this.bodyPx / (bsd.bodyH || bsd.h));
        this.rim.visible = false;
        this.flashSpr.visible = false;
      }
      this.updateGroundFx(dt, 0, 1, 0);
    }

    /* multi 패턴: 원 하나가 예고를 마치면 그 자리에서 터진다 */
    _burstCircle(q, target) {
      const g = this.game;
      if (this.noel) g.fx.ribbonBurst(q.x, q.y - 20, 7);
      g.fx.shockRing(q.x, q.y, 0xff5a6e, q.r * 1.5, 0.4);
      g.fx.sparkBurst(q.x, q.y - 20, 0xff8a7a, 18, 460);
      g.fx.debris(q.x, q.y + 4, 6, 0xffb0a0, 0.9);
      g.scene.shake(9, 0.24);
      G.Sfx.hit(true);
      if (Boss.insideEllipse(target.x, target.y, q.x, q.y, q.r) && target.z <= 40) g.damageHero(this.cfg.dmg, q.x);
    }

    /* 바닥 장판은 타원이다: 가로 r, 세로 0.4r — 그린 모양과 판정이 같아야 한다 */
    static insideEllipse(px, py, qx, qy, r) {
      return Math.hypot(px - qx, (py - qy) / 0.4) < r;
    }

    /* 다음 공격까지 대기 — 광폭화는 공격 속도 3배(대기 시간 ÷3) */
    _aspdMul() {
      const F = this.formCfg;
      return (F && F.aspdMul) ? F.aspdMul : 1;
    }

    _nextAtkDelay(range) {
      const k = this._aspdMul();
      return G.rand(range[0] / k, range[1] / k);
    }

    _strike(target) {
      const kind = this.kind;
      // 광폭화 — 공격할 때마다 자기 체력이 깎인다(자해로도 정상 처치)
      if (this.form === 'berserk') {
        this._selfBleed();
        if (this.dying) return;
      }
      if (this.noel) this._skillFxStrike(kind);
      const q0 = this.teleTarget || { x: this.teleX, y: this.y, r: this.cfg.radius };
      const dist = Boss.insideEllipse(target.x, target.y, q0.x, q0.y, this.cfg.radius) ? 0 : 1e9;
      const airborne = target.z > 40;
      const lineHit = this.kind === 'line' && this.teleTarget && (() => {
        const a = this.teleTarget.angle, dx = target.x-this.x, dy=target.y-this.y;
        const along=dx*Math.cos(a)+dy*Math.sin(a), across=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a));
        return along>=0 && along<=900 && across<=60;
      })();
      const multiHit = this.kind === 'multi' && this.teleTargets.some((q) => Boss.insideEllipse(target.x, target.y, q.x, q.y, q.r));
      const groundHit = this.kind === 'multi' ? false : this.kind === 'line' ? lineHit : dist < this.cfg.radius;
      if (kind !== 'summon') {
        if (this.noel && (kind === 'slam' || kind === 'line') && !groundHit) {
          // 빗나가면 자루에 걸려 휘청인다 — 당황 표정 + 모션
          this.tripT = 1.05;
          this.flusteredT = 1.05;
          this.skillLog.push({ t: +this.game.time.toFixed(2), kind: 'trip', miss: true });
          this.game.fx.debris(this.x, this.y, 6, 0xffe2ea, 0.9);
          this.game.fx.snowPuff(this.x, this.y - 6, 1, 1.2);
        }
        if (kind !== 'multi' || !this._multiFxFired) {
          this.game.fx.shockRing(this.kind === 'line' ? this.x : this.x - 40, this.y - 6, this.cfg.color, this.cfg.radius, 0.55);
          this.game.scene.shake(kind === 'perfect' ? 16 : 12, 0.4);
        }
        this.game.fx.sparkBurst(this.x - 120, this.y - 20, this.cfg.color, 26, 620, Math.PI);
        this.game.fx.debris(this.x - 60, this.y, 8, 0xff9a7a, 1.1);
        G.Sfx.hit(true);
        if (groundHit && !airborne && kind !== 'perfect') this.game.damageHero(this.cfg.dmg, this.x);
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
