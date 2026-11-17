import { Tutorial } from './tutorial.js';
import { HeroRig } from './hero-rig.js';
import { HeroLaser, HeroPunchEffects } from './hero-art.js';
import { CombatArena, COMBAT, DESTRUCTIBLES, TARGETS, HeroPower, HERO_POWER } from './hero-combat.js';
import { CombatArtwork } from './hero-combat-art.js';
import { EnemySystem, ENEMIES, HERO_DAMAGE, REVIVE_GRACE } from './enemy-system.js';
import { EnemyArtwork } from './enemy-art.js';
import { EnemyThrow, GRAB_TIERS, LIFT_SIZES, MAX_GRAB_TIER, MAX_LIFT_SIZE, THROW, weightClass } from './enemy-throw.js';
import { ThrowArtwork } from './enemy-throw-art.js';
import { GamepadInput } from './gamepad-input.js';
import { createTouchControls, viewZoom, altitudeZoomLimit, BOOST_REACH } from './touch-controls.js';
import { sound } from './sound.js';
import { poki } from './poki.js';
import { wipeSave } from './save.js';
import { PerfMeter, FRAME_BUDGET_MS, UPLOAD_BUDGET } from './perf-meter.js';

// HUD text runs every frame: writing an unchanged string still mutates the DOM and restyles it.
export function setHudText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

const Phaser = window.Phaser;
const VIEW_HEIGHT = 360;
// Hold the stick beyond BOOST_REACH this long to boost.
const TOUCH_BOOST_DELAY = 0.25;
const GROUND_Y = 300;
const CRUISE_SPEED = 48;
const BOOST_SPEED = 200;
// Shift flight boost: free, between normal flight and RAM (HERO_POWER.ramSpeed).
const FLIGHT_BOOST_SPEED = 285;
const INPUT_RESPONSE = 5;
const BOOST_RESPONSE = 6;
const COAST_RESPONSE = 2.6;
const CONTROLLER_HOVER_LIMIT = 0.35;
const SIM_STEP = 1 / 120;
const LOW_HEALTH_THRESHOLD = 0.2;
const CRITICAL_HEALTH_THRESHOLD = 0.1;
const DEFEAT_DURATION = 3;
const DEFEAT_TIME_SCALE = 0.2;
// Altitude zoom-out: keep the ground in frame while climbing, down to MIN_ALTITUDE_ZOOM of the base zoom.
const ALTITUDE_GROUND_MARGIN = 40;
export const MIN_ALTITUDE_ZOOM = 0.55;

function punchMovementControl(input, angle) {
  const strength = Math.min(1, Math.hypot(input.x, input.y));
  if (strength === 0) return 0;
  const offset = Math.abs(Math.atan2(Math.sin(angle - Math.atan2(input.y, input.x)),
    Math.cos(angle - Math.atan2(input.y, input.x))));
  // Full assist near the movement direction, fading smoothly to zero at 30°.
  const fade = Math.max(0, Math.min(1, (offset / COMBAT.punch.movementCone - 0.5) * 2));
  return strength * (1 - fade * fade * (3 - 2 * fade));
}

function drawCloud(graphics, x, y, width) {
  graphics.fillStyle(0xd8eff4, 0.68);
  graphics.fillRect(x + 5, y + 3, width - 9, 5);
  graphics.fillRect(x + 10, y, width - 20, 10);
  graphics.fillStyle(0xffffff, 0.55);
  graphics.fillRect(x + 11, y + 1, width - 23, 2);
}

// Sky bands, sun, and parallax clouds for a view { left, top, width, height } in world pixels.
export function drawSky(graphics, view, bands, cameraCenter) {
  const { left, top, width, height } = view;
  const bottom = top + height + 4;
  bands.forEach((color, index) => {
    graphics.fillStyle(color);
    graphics.fillRect(left, top + index * (height + 4) / bands.length,
      width + 4, (height + 4) / bands.length + 1);
  });

  const sunX = left + width * 0.8;
  const sunY = top + height * 0.18;
  graphics.fillStyle(0xffecab);
  graphics.fillCircle(sunX, sunY, 13);
  graphics.fillStyle(0xfff4ca, 0.42);
  graphics.fillCircle(sunX, sunY, 18);
  // Repeating parallax clouds keep the sky populated at any altitude.
  const cloudX = cameraCenter.x * 0.8;
  const cloudY = cameraCenter.y * 0.85;
  for (let y = Math.floor((top - cloudY) / 180) * 180; y < bottom - cloudY; y += 180) {
    for (let x = Math.floor((left - cloudX) / 320) * 320 - 320; x < left + width - cloudX; x += 320) {
      drawCloud(graphics, x + cloudX + 34, y + cloudY + 29, 43);
      drawCloud(graphics, x + cloudX + 121, y + cloudY + 81, 33);
      drawCloud(graphics, x + cloudX + 220, y + cloudY + 135, 50);
    }
  }
}

export class HeroMovement extends Phaser.Scene {
  constructor() {
    super('HeroMovement');
    this.velocity = new Phaser.Math.Vector2();
    this.elapsed = 0;
    this.accumulator = 0;
    this.defeatElapsed = null;
    this.viewHeight = VIEW_HEIGHT;
    this.boostLevel = 2; // Max (RAM), so the hero starts with every power; the dev panel can lower it.
    this.power = new HeroPower();
    this.ramDirection = { x: 1, y: 0 };
    this.controller = new GamepadInput();
    this.controllerFacing = { x: 1, y: 0 };
    this.aimSource = 'mouse';
    this.laserAimSource = 'mouse';
    this.controlsSuspended = false;
    this.spawnX = 160;
    this.altitudeZoom = 1;
    this.engagedPunchTarget = null;
    this.punchEngagedUntil = 0;
    // Grab-and-throw edges { left, right, ceiling }; the open combat lab has none.
    this.throwBounds = null;
    // Every grab weight class is available from the start; lower tiers are dev tuning only.
    this.grabTier = MAX_GRAB_TIER;
    this.blastKills = 0;
    // The largest LIFT_SIZES index the hero lifts off the street and out of the sky. null: the scene
    // has nothing of the kind (liftSources), and its Dev panel shows no Lift size slider.
    this.liftSize = null;
  }

  // Ground surface y at world x; subclasses with terrain override this.
  groundAt() {
    return GROUND_Y;
  }

  // Where the hero's feet stop: the ground, unless a scene lets the hero dive under water.
  floorAt(x) {
    return this.groundAt(x);
  }

  // Whether skimming the floor here follows its slope. Scenes turn it off over water so a hero
  // gliding off a beach skims the surface instead of following the sea bed down.
  glues() {
    return true;
  }

  createArena() {
    // Extra dummy rows extend left of spawn; bot drills continue right beyond the wall.
    const targets = [0, -240, -480].flatMap(offset => TARGETS.map(target => ({
      ...target, x: target.x + offset,
    })));
    const enemies = [0, 800, 1600].flatMap((offset, group) => ENEMIES.map(enemy => ({
      ...enemy, x: enemy.x + offset,
      ...(enemy.swarmGroup ? { swarmGroup: `${enemy.swarmGroup}-${group}` } : {}),
    })));
    this.combat = new CombatArena(targets, x => this.groundAt(x), DESTRUCTIBLES, enemies);
    this.enemies = new EnemySystem(this.combat);
    this.combatArtwork = new CombatArtwork(this, this.combat);
    this.enemyArtwork = new EnemyArtwork(this, this.enemies);
  }

  create() {
    this.world = this.add.graphics();
    this.createArena();
    this.throwing = new EnemyThrow(this.combat, this.throwBounds);
    this.throwing.tier = this.grabTier;
    if (this.liftSize !== null) {
      this.throwing.size = this.liftSize;
      // Whichever source has the nearest thing in reach.
      this.throwing.objects = (hero, reach, size) => {
        let best = null;
        for (const source of this.liftSources()) {
          const body = source?.liftable?.(hero, reach, size, this.streetAt);
          if (body && !(best?.distance <= body.distance)) best = body;
        }
        return best;
      };
    }
    this.throwArtwork = new ThrowArtwork(this, this.throwing);
    this.traceCombatLaser = (from, to) => this.combat.traceLaser(from, to);
    this.rig = new HeroRig(this);
    this.laser = new HeroLaser(this.add.graphics().setDepth(11), x => this.groundAt(x));
    this.punchEffects = new HeroPunchEffects(this.add.graphics().setDepth(12));
    this.aimFeedback = this.add.graphics().setDepth(9);
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.position = new Phaser.Math.Vector2(this.spawnX, this.groundAt(this.spawnX) - 90);
    this.cameraCenter = this.position.clone();
    this.tutorial = new Tutorial(document.getElementById('tutorial'));
    this.throwing.showLocked = !this.tutorial.liftTipSeen;
    // The grab step needs someone in reach; hero mode has nothing else to lift.
    this.tutorial.onStep = step => { if (step.stat === 'thrown') this.spawnTutorialTarget?.(); };
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,F,Q,E');
    this.input.keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE', 'SHIFT']);
    this.input.keyboard.on('keydown-SPACE', this.handleKeyboardPunch, this);
    this.input.keyboard.on('keydown-F', this.handleKeyboardLaser, this);
    this.input.keyboard.on('keydown-Q', this.handleKeyboardRam, this);
    this.input.keyboard.on('keyup-Q', this.handleKeyboardRamUp, this);
    this.input.keyboard.on('keydown-E', this.handleKeyboardGrab, this);
    this.game.events.on('blur', this.handleControlBlur, this);
    this.game.events.on('hidden', this.handleControlBlur, this);
    this.game.events.on('focus', this.handleControlFocus, this);
    this.game.events.on('visible', this.handleControlFocus, this);
    this.resetButton = document.getElementById('reset-arena');
    this.combatProgress = document.getElementById('combat-progress');
    this.destructionProgress = document.getElementById('destruction-progress');
    this.heroHealth = document.getElementById('hero-health');
    this.heroHealthText = document.getElementById('hero-health-text');
    this.heroPower = document.getElementById('hero-power');
    this.heroPowerText = document.getElementById('hero-power-text');
    this.enemyProgress = document.getElementById('enemy-progress');
    this.grabProgress = document.getElementById('grab-progress');
    this.encounterStatus = document.getElementById('encounter-status');
    this.defeatPanel = document.getElementById('defeat-panel');
    this.healthWarning = document.createElement('div');
    this.healthWarning.className = 'health-warning';
    this.healthWarning.setAttribute('aria-hidden', 'true');
    (document.querySelector('.stage-frame') ?? document.body).append(this.healthWarning);
    this.controllerStatus = document.getElementById('controller-status');
    this.controllerControls = document.getElementById('controller-controls');
    this.keyboardControls = document.getElementById('keyboard-controls');
    this.resetKey = document.getElementById('reset-key');
    this.handleResetClick = () => this.resetCombat();
    this.resetButton?.addEventListener('click', this.handleResetClick);
    // Hero down: Revive (free for now) keeps the run going; Retry restarts the level.
    this.retryButton = document.getElementById('defeat-retry');
    this.reviveButton = document.getElementById('defeat-revive');
    const perk = this.reviveButton?.querySelector('.defeat-perk');
    if (perk) perk.textContent = `${REVIVE_GRACE}s invincible`;
    this.handleRevive = () => this.reviveHero();
    // Retry after defeat is a natural break: a midgame ad may play first.
    this.handleRetry = () => {
      if (this.adPending || this.enemies?.defeated && !this.defeatReady) return;
      this.adPending = true;
      poki.midgame(() => { this.adPending = false; this.resetCombat(); });
    };
    this.retryButton?.addEventListener('click', this.handleRetry);
    this.reviveButton?.addEventListener('click', this.handleRevive);
    this.createDevPanel();
    this.touchMove = createTouchControls(this);
    if (this.touchMove) this.devPanel.open = false;
    if (!this.deferTutorial) this.tutorial.start(this);
    this.cameras.main.setRoundPixels(true);
    this.resizeView(this.scale.gameSize);
    this.scale.on('resize', this.resizeView, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.resizeView, this);
      this.input.off('pointerdown', this.handlePointerDown, this);
      this.input.off('pointermove', this.handlePointerMove, this);
      this.input.keyboard.off('keydown-SPACE', this.handleKeyboardPunch, this);
      this.input.keyboard.off('keydown-F', this.handleKeyboardPunch, this);
      this.input.keyboard.off('keydown-Q', this.handleKeyboardRam, this);
      this.input.keyboard.off('keyup-Q', this.handleKeyboardRamUp, this);
      this.input.keyboard.off('keydown-E', this.handleKeyboardGrab, this);
      this.game.events.off('blur', this.handleControlBlur, this);
      this.game.events.off('hidden', this.handleControlBlur, this);
      this.game.events.off('focus', this.handleControlFocus, this);
      this.game.events.off('visible', this.handleControlFocus, this);
      this.resetButton?.removeEventListener('click', this.handleResetClick);
      this.retryButton?.removeEventListener('click', this.handleRetry);
      this.reviveButton?.removeEventListener('click', this.handleRevive);
      this.healthWarning?.remove();
      this.devPanel?.remove();
    });
    this.rig.update(0, this.position, this.velocity, new Phaser.Math.Vector2(),
      this.input.activePointer, this.elapsed);
    this.rig.render();
    this.drawWorld();
    this.combatArtwork.draw(this.elapsed, this.position, this.velocity);
    this.syncCombatHud();
  }

  createDevPanel() {
    this.devPanel = document.createElement('details');
    this.devPanel.className = 'dev-panel';
    this.devPanel.open = true;
    // Players never see it; ?debug brings it back for tuning.
    this.devPanel.hidden = !new URLSearchParams(window.location.search).has('debug');
    this.devPanel.innerHTML = `<summary>Dev panel</summary>
      <div class="dev-panel-content">
        <label for="boost-upgrade">Boost upgrade <output id="boost-upgrade-value" for="boost-upgrade"></output></label>
        <input id="boost-upgrade" type="range" min="1" max="2" step="1" value="${this.boostLevel}" aria-describedby="boost-upgrade-description">
        <div class="dev-slider-levels"><span>1 · Flight</span><span>2 · RAM</span></div>
        <p id="boost-upgrade-description"></p>
        <span class="dev-panel-note">Y / △ or Q · ${HERO_POWER.ramSpeed} px/s</span>
        <label for="grab-upgrade">Grab upgrade <output id="grab-upgrade-value" for="grab-upgrade"></output></label>
        <input id="grab-upgrade" type="range" min="0" max="${MAX_GRAB_TIER}" step="1" value="${this.grabTier}" aria-describedby="grab-upgrade-description">
        <div class="dev-slider-levels">${GRAB_TIERS.map((_, level) => `<span>${level}</span>`).join('')}</div>
        <p id="grab-upgrade-description"></p>
        <span class="dev-panel-note">G / middle click or RB · blast kills also unlock tiers</span>
        <label for="dev-mute">Mute sound <input id="dev-mute" type="checkbox"${sound.muted ? ' checked' : ''}></label>
        <label for="dev-power">Unlimited hero power <input id="dev-power" type="checkbox"></label>
        <button id="dev-complete-tutorial" type="button">Complete tutorial</button>
        <button id="dev-wipe-save" type="button">Wipe save</button>
        <span id="perf-readout" class="dev-panel-note perf-readout" role="status" title="CPU time per frame (update + render) and GPU texture uploads per frame, over the last second">Frame —</span>
      </div>`;
    (document.querySelector('.stage-wrap') ?? document.body).append(this.devPanel);
    this.boostSlider = this.devPanel.querySelector('#boost-upgrade');
    this.boostOutput = this.devPanel.querySelector('#boost-upgrade-value');
    this.boostDescription = this.devPanel.querySelector('#boost-upgrade-description');
    this.boostSlider.addEventListener('input', () => this.setBoostLevel(this.boostSlider.value));
    this.grabSlider = this.devPanel.querySelector('#grab-upgrade');
    this.grabOutput = this.devPanel.querySelector('#grab-upgrade-value');
    this.grabDescription = this.devPanel.querySelector('#grab-upgrade-description');
    this.grabSlider.addEventListener('input', () => this.setGrabTier(this.grabSlider.value));
    this.devPanel.querySelector('#dev-mute').addEventListener('change', event => sound.setMuted(event.target.checked));
    // While on, the power meter is topped up every step, so RAM and the laser never run dry.
    this.unlimitedPower = false;
    this.devPanel.querySelector('#dev-power').addEventListener('change', event => { this.unlimitedPower = event.target.checked; });
    this.devPanel.querySelector('#dev-complete-tutorial').addEventListener('click', () => this.tutorial?.complete());
    // Clears campaign, objectives, records and settings, then reloads into a fresh game.
    this.devPanel.querySelector('#dev-wipe-save').addEventListener('click', () => {
      if (!window.confirm('Wipe all saved progress?')) return;
      wipeSave();
      window.location.reload();
    });
    this.perfReadout = this.devPanel.querySelector('#perf-readout');
    this.perfReadoutAt = 0;
    // Native slider keys must not move the hero or trigger powers.
    this.devPanel.addEventListener('keydown', event => event.stopPropagation());
    this.devPanel.addEventListener('pointerdown', event => event.stopPropagation());
    // A control that keeps the focus would swallow the game's keys (the listener above), so hand
    // the focus back as soon as it has been used: a slider released, a box ticked, an option
    // picked, a button or the panel's title clicked. A text box keeps it while being typed in, and
    // gives it up on Escape or on a click in the game.
    const release = () => { if (this.devPanel.contains(document.activeElement)) document.activeElement.blur(); };
    const typing = element => element.matches('input:not([type=range]):not([type=checkbox])');
    this.devPanel.addEventListener('change', event => { if (!typing(event.target)) release(); });
    // Not a dropdown: its click is what opens the list. It lets go once an option is picked.
    this.devPanel.addEventListener('click', event => { if (!typing(event.target) && !event.target.closest('select')) release(); });
    this.devPanel.addEventListener('keydown', event => { if (event.key === 'Escape') release(); });
    this.input.on('pointerdown', release);
    this.syncBoostUpgrade();
    this.syncGrabUpgrade();
    if (this.liftSize === null) return;
    this.grabDescription.nextElementSibling.insertAdjacentHTML('afterend',
      `<label for="lift-size">Lift size <output id="lift-size-value" for="lift-size"></output></label>
        <input id="lift-size" type="range" min="0" max="${MAX_LIFT_SIZE}" step="1" value="${this.liftSize}" aria-describedby="lift-size-description">
        <div class="dev-slider-levels">${LIFT_SIZES.map((_, level) => `<span>${level}</span>`).join('')}</div>
        <p id="lift-size-description"></p>`);
    const slider = this.devPanel.querySelector('#lift-size');
    slider.addEventListener('input', () => this.setLiftSize(slider.value));
    this.setLiftSize(this.liftSize);
  }

  // Where liftable objects come from: things with liftable(hero, reach, size, streetAt) => body or
  // null, the body carrying its `distance` from the hero. Scenes with street life override this.
  liftSources() { return []; }

  // What the hero lifts, from nothing up to the largest things there are. Something held that is
  // now too big slips free.
  setLiftSize(level) {
    this.liftSize = Math.max(0, Math.min(MAX_LIFT_SIZE, Math.round(Number(level)) || 0));
    const held = this.throwing?.held;
    if (this.throwing) this.throwing.size = this.liftSize;
    if (held && !held.windup && held.enemy.object && held.enemy.size > this.liftSize) this.throwing.drop();
    const name = LIFT_SIZES[this.liftSize].name;
    this.devPanel.querySelector('#lift-size').setAttribute('aria-valuetext', `Level ${this.liftSize}: ${name}`);
    this.devPanel.querySelector('#lift-size-value').textContent = `Level ${this.liftSize} · ${name}`;
    this.devPanel.querySelector('#lift-size-description').textContent = this.liftSize === 0 ? 'Nothing can be lifted.'
      : `Lift ${LIFT_SIZES.slice(1, this.liftSize + 1).map(size => size.unlocks).join(', ')}.`;
  }

  // Picking a tier by hand restarts the blast-kill count toward the next one.
  setGrabTier(level) {
    const next = Math.max(0, Math.min(MAX_GRAB_TIER, Math.round(Number(level)) || 0));
    if (this.grabTier !== next) {
      this.grabTier = next;
      this.blastKills = 0;
      if (this.throwing) {
        this.throwing.tier = next;
        // A bot held beyond the new lift slips free.
        if (this.throwing.held && !this.throwing.held.windup
          && !this.throwing.held.enemy.object
          && weightClass(this.throwing.held.enemy) > this.throwing.liftClass) this.throwing.drop();
      }
    }
    this.syncGrabUpgrade();
  }

  syncGrabUpgrade() {
    const tier = GRAB_TIERS[this.grabTier];
    if (this.grabSlider) {
      this.grabSlider.value = this.grabTier;
      this.grabSlider.setAttribute('aria-valuetext', `Level ${this.grabTier}: ${tier.name}`);
    }
    if (this.grabOutput) this.grabOutput.textContent = `Level ${this.grabTier} · ${tier.name}`;
    if (this.grabDescription) {
      this.grabDescription.textContent = this.grabTier === 0 ? 'Grabbing locked. Weakened bots show no grab marker.'
        : `Grab ${GRAB_TIERS.slice(1, this.grabTier + 1).map(level => level.unlocks).join(', ')}.`;
    }
  }

  setBoostLevel(level) {
    const next = Number(level) >= 2 ? 2 : 1;
    if (this.boostLevel !== next) {
      this.boostLevel = next;
      this.combat?.ramContacts.clear();
    }
    this.syncBoostUpgrade();
  }

  syncBoostUpgrade() {
    if (this.boostSlider) {
      this.boostSlider.value = this.boostLevel;
      this.boostSlider.setAttribute('aria-valuetext', this.boostLevel === 1 ? 'Level 1: Flight, no collision damage' : 'Level 2: RAM, collision damage');
    }
    if (this.boostOutput) this.boostOutput.textContent = `Level ${this.boostLevel}`;
    if (this.boostDescription) this.boostDescription.textContent = this.boostLevel === 1
      ? 'RAM flight and steering. No collision damage or ground-pound. Uses hero power.'
      : 'Same flight, with collision damage and ground-pound. Uses hero power.';
  }

  resetCombat(event) {
    if (event?.repeat) return;
    this.defeatElapsed = null;
    this.combat.reset();
    this.enemies?.reset();
    this.throwing?.reset();
    this.throwArtwork?.reset();
    this.combatArtwork.reset();
    this.power.reset();
    this.position.x = this.cameraCenter.x = this.spawnX;
    this.position.y = this.cameraCenter.y = this.groundAt(this.spawnX) - 90;
    this.cameraGround = undefined;
    this.groundPoundKick = null;
    this.velocity.x = this.velocity.y = 0;
    Object.assign(this.rig.punch, {
      active: false, queued: false, grace: 0, stance: 0, hitPause: 0, queuedAimSource: null,
      target: null, targetAssigned: false, queuedTarget: undefined,
    });
    this.engagedPunchTarget = null;
    this.punchEngagedUntil = 0;
    this.rig.landing = 0;
    this.rig.resetRenderPose?.();
    this.lastPunchSample = null;
    this.laser.pulse = 0;
    this.laser.beam = null;
    sound.laser(false);
    sound.ram(false);
    this.laser.sparks.length = 0;
    this.punchEffects?.reset();
    this.rig.image.setRotation?.(0);
    this.rig.image.setAlpha?.(1);
    this.rig.image.clearTint?.();
    this.enemyArtwork?.graphics.clear();
    this.accumulator = 0;
    this.controller.requireNeutral();
    this.controllerFacing = { x: 1, y: 0 };
    this.aimFeedback?.clear();
    this.syncCombatHud();
  }

  handleControlBlur() {
    this.controlsSuspended = true;
    this.controller.suspend();
    this.touchMove?.reset();
    this.stopHeroCombat();
    this.accumulator = 0;
  }

  handleControlFocus() {
    this.controlsSuspended = !!this.policeWon || !!this.levelMapOpen;
    this.controller.resume();
    this.accumulator = 0;
  }

  pollController() {
    const previous = this.controller.state;
    const state = this.controller.poll();
    const replaced = previous.connected && state.connected
      && (previous.index !== state.index || previous.id !== state.id);
    if (previous.connected && (!state.connected || replaced || (previous.ready && !state.ready))) {
      const controllerCombat = this.power.ramSource === 'gamepad'
        || this.rig.punch?.aimSource === 'gamepad' && this.rig.punch.active
        || this.laserAimSource === 'gamepad' && (this.laser.pulse > 0 || this.laser.beam);
      if (this.aimSource === 'gamepad' || controllerCombat) this.stopHeroCombat();
      this.aimSource = this.laserAimSource = 'mouse';
    }
    if (state.connected && (!previous.connected || replaced || state.active) && this.aimSource !== 'gamepad') {
      const facing = this.rig.gazeTarget ?? 0;
      this.controllerFacing = { x: Math.cos(facing), y: Math.sin(facing) };
      this.aimSource = 'gamepad';
    }
    if (!state.ready) return;
    if (previous.ram && !state.ram) this.power.releaseRam('gamepad');
    this.controllerDirection();
    if (state.resetPressed) {
      if (this.enemies?.defeated && !this.defeatReady) return;
      this.resetCombat();
      return;
    }
    if (this.enemies?.defeated || this.policeWon) return;
    if (state.ramPressed) this.tryRam('gamepad');
    if (state.laserPressed) {
      this.laserAimSource = 'gamepad';
      this.laser.fire();
    }
    if (state.grabPressed) this.grabOrThrow('gamepad');
    // While carrying a bot, the punch button throws it instead.
    else if (state.punchPressed && this.throwing?.held) this.grabOrThrow('gamepad');
    else if (state.punchPressed) {
      const aim = this.getPunchAim('gamepad');
      this.rig.requestPunch(this.position, this.velocity,
        { worldX: aim.x, worldY: aim.y, target: aim.target ?? null }, 'gamepad');
    }
  }

  get ramActive() {
    // A throw breaks the RAM for its stance; held, it picks up again when the hero stretches out.
    return !this.enemies?.defeated && this.power.ramActive && !(this.throwStance > 0);
  }

  get ramDamageActive() { return this.ramActive && this.boostLevel >= 2; }

  tryRam(source) {
    if (this.controlsSuspended || this.enemies?.defeated || !this.power.activateRam(source)) return false;
    const input = this.movementInput();
    const length = Math.hypot(input.x, input.y);
    const facing = source === 'touch' ? this.touchDirection() : source === 'gamepad' ? this.controllerDirection()
      : { x: Math.cos(this.rig.gazeTarget), y: Math.sin(this.rig.gazeTarget) };
    this.ramDirection = length > 0 ? { x: input.x / length, y: input.y / length } : { ...facing };
    // A new hold may strike a target again, even if the previous hold ended in contact.
    this.combat?.ramContacts.clear();
    this.syncCombatHud();
    return true;
  }

  handleKeyboardRam(event) {
    if (event?.repeat) return;
    this.tryRam('keyboard');
  }

  handleKeyboardRamUp() {
    this.power.releaseRam('keyboard');
  }

  movementInput(keyboardOnly = false) {
    const x = Number(this.keys.D.isDown || this.keys.RIGHT.isDown)
      - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
    const y = Number(this.keys.S.isDown || this.keys.DOWN.isDown)
      - Number(this.keys.W.isDown || this.keys.UP.isDown);
    const keyboardMoving = keyboardOnly || x !== 0 || y !== 0;
    // The touch stick counts as an analog stick: light tilts hover, a full push flies.
    const touch = this.touchMove?.x || this.touchMove?.y ? this.touchMove : null;
    return new Phaser.Math.Vector2(keyboardMoving ? x : touch ? touch.x : this.controller.state.moveX,
      keyboardMoving ? y : touch ? touch.y : this.controller.state.moveY).limit(1);
  }

  controllerDirection() {
    const input = this.movementInput();
    const length = Math.hypot(input.x, input.y);
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (length > 0) this.controllerFacing = { x: input.x / length, y: input.y / length };
    else if (speed > 8) this.controllerFacing = { x: this.velocity.x / speed, y: this.velocity.y / speed };
    else if (this.controller.state.aiming) this.controllerFacing = { ...this.controller.aim };
    return this.controller.state.aiming ? this.controller.aim : this.controllerFacing;
  }

  touchDirection() {
    const touch = this.touchMove;
    if (touch?.throwAim) return touch.throwAim;
    if (touch?.aiming) return touch.aim;
    const length = Math.hypot(touch?.x ?? 0, touch?.y ?? 0);
    return length > 0.1 ? { x: touch.x / length, y: touch.y / length }
      : { x: Math.cos(this.rig.gazeTarget), y: Math.sin(this.rig.gazeTarget) };
  }

  handleTouchAction(kind, down) {
    if (!down) {
      // A Grab pressed while carrying throws on release, toward where it was dragged.
      if (kind === 'grab' && this.touchThrowArmed) {
        this.touchThrowArmed = false;
        if (this.throwing?.held && !this.controlsSuspended) this.grabOrThrow('touch');
        this.touchMove.throwAim = null;
      }
      if (kind === 'ram') this.power.releaseRam('touch');
      if (kind === 'punch' && this.rig.punch?.queuedAimSource === 'touch') this.rig.punch.queued = false;
      return;
    }
    if (this.controlsSuspended || this.enemies?.defeated) return;
    this.aimSource = 'touch';
    if (kind === 'ram') this.tryRam('touch');
    if (kind === 'laser') { this.laserAimSource = 'touch'; this.laser.fire(); }
    if (kind === 'grab' && this.throwing?.held) this.touchThrowArmed = true;
    else if (kind === 'grab' || kind === 'punch' && this.throwing?.held) this.grabOrThrow('touch');
    else if (kind === 'punch') {
      const aim = this.getPunchAim('touch');
      this.rig.requestPunch(this.position, this.velocity,
        { worldX: aim.x, worldY: aim.y, target: aim.target ?? null }, 'touch');
    }
  }

  // Keyboard-and-mouse punches follow the hero's travel, not the pointer: steer to aim.
  travelDirection() {
    const input = this.movementInput();
    const length = Math.hypot(input.x, input.y);
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (length > 0) this.travelFacing = { x: input.x / length, y: input.y / length };
    else if (speed > 8) this.travelFacing = { x: this.velocity.x / speed, y: this.velocity.y / speed };
    return this.travelFacing ?? { x: Math.cos(this.rig.gazeTarget ?? 0), y: Math.sin(this.rig.gazeTarget ?? 0) };
  }

  getAim(source, origin) {
    if (source === 'gamepad' || source === 'touch' || source === 'travel') {
      if (!origin) {
        const [x, y] = this.rig.headPoint(1, -2);
        origin = { x: this.position.x + x, y: this.position.y + y };
      }
      const direction = source === 'touch' ? this.touchDirection()
        : source === 'travel' ? this.travelDirection() : this.controllerDirection();
      return { x: origin.x + direction.x * 1000, y: origin.y + direction.y * 1000 };
    }
    const pointer = this.input.mousePointer ?? this.input.activePointer;
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  getPunchAim(source) {
    if (source === 'mouse') source = 'travel';
    const aim = this.getAim(source);
    const [eyeX, eyeY] = this.rig.headPoint(1, -2);
    const angle = Math.atan2(aim.y - this.position.y - eyeY, aim.x - this.position.x - eyeX);
    const target = this.combat?.findPunchTarget(this.position,
      { x: Math.cos(angle), y: Math.sin(angle) }, {
        preferredTarget: this.rig.punch?.active && this.rig.punch.target ? this.rig.punch.target
          : this.elapsed < this.punchEngagedUntil ? this.engagedPunchTarget : null,
        explicitAim: source === 'touch' ? this.touchMove?.aiming : source === 'gamepad' && this.controller.state.aiming,
      });
    return target ? { x: target.x, y: target.y, target } : aim;
  }

  preparePunchAim(moving) {
    const punch = this.rig.punch;
    const source = punch.aimSource === 'gamepad' || punch.aimSource === 'touch' ? punch.aimSource : 'travel';
    const intent = this.getAim(source);
    if (!punch.targetAssigned) {
      punch.target = this.getPunchAim(source).target ?? null;
      punch.targetAssigned = true;
    }
    const previousTarget = punch.target;
    if (!this.combat?.isPunchTargetValid(this.position, punch.target)) punch.target = null;
    if (punch.target) {
      const intendedAngle = this.rig.aimAngle(this.position, { worldX: intent.x, worldY: intent.y });
      const targetAngle = this.rig.aimAngle(this.position, { worldX: punch.target.x, worldY: punch.target.y });
      const offset = Math.atan2(Math.sin(targetAngle - intendedAngle), Math.cos(targetAngle - intendedAngle));
      // Recheck saved targets against current intent, including at the start of a buffered hit.
      // Passing an opponent releases pursuit; deliberately aiming back still permits a backhand.
      if (Math.abs(offset) > COMBAT.punch.retentionCone) punch.target = null;
    }
    if (previousTarget && !punch.target) {
      punch.stopDash();
      if (this.engagedPunchTarget === previousTarget) {
        this.engagedPunchTarget = null;
        this.punchEngagedUntil = 0;
      }
    }
    const target = punch.target;
    if (punch.time < punch.hit.windup) {
      const input = this.movementInput();
      const angle = target ? this.rig.aimAngle(this.position, { worldX: target.x, worldY: target.y })
        : this.rig.aimAngle(this.position, { worldX: intent.x, worldY: intent.y });
      // Fists may aim across a crowd; body assistance belongs to movement intent.
      punch.dashControl = punchMovementControl(input, angle);
      const limit = target?.radius <= COMBAT.punch.smallTargetRadius
        ? COMBAT.punch.smallTargetDistance : COMBAT.punch.maxDistance;
      const distance = target
        ? Math.min(limit, Math.max(0,
          Math.hypot(target.x - this.position.x, target.y - this.position.y)
          - target.radius - COMBAT.punch.standOff))
        : COMBAT.punch.missDistance;
      punch.dashDistance = moving ? distance * punch.dashControl : 0;
    }
    return { worldX: target?.x ?? intent.x, worldY: target?.y ?? intent.y };
  }

  drawControllerAim() {
    if (!this.aimFeedback) return;
    const controller = this.controller.state;
    const visible = controller.ready && controller.aiming && this.aimSource === 'gamepad'
      && !controller.laser && !controller.punch && !controller.ram && !this.ramActive
      && !this.keys.SPACE?.isDown && !this.keys.F?.isDown && !this.keys.Q?.isDown
      && !this.input.activePointer.isDown && !this.rig.punch.active
      && this.laser.pulse <= 0 && !this.laser.beam && !this.controlsSuspended && !this.enemies?.defeated;
    const graphics = this.aimFeedback;
    graphics.clear();
    graphics.setVisible(visible);
    if (!visible) return;
    const angle = Math.atan2(this.controller.aim.y, this.controller.aim.x);
    const x = this.rig.image.x;
    const y = this.rig.image.y - 2;
    graphics.lineStyle(1, 0xe3f4ff, 0.22);
    graphics.beginPath();
    graphics.arc(x, y, 20, angle - Math.PI / 2, angle + Math.PI / 2);
    graphics.strokePath();
    graphics.lineStyle(1, 0xe3f4ff, 0.45);
    graphics.beginPath();
    graphics.arc(x, y, 20, angle - Math.PI / 8, angle + Math.PI / 8);
    graphics.strokePath();
  }

  syncControllerHud() {
    const state = this.controller.state;
    const usingController = state.connected && this.aimSource === 'gamepad';
    if (this.controllerStatus) {
      const message = this.controller.status === 'unavailable' ? 'Controller unavailable · use keyboard + mouse'
        : this.controller.status === 'unmapped' ? 'Controller layout unsupported · use a standard gamepad'
          : !state.connected ? 'Controller: connect + press any button'
            : !state.ready ? 'Controller connected · release controls to play'
              : 'Controller connected · tilt to hover / fly';
      if (this.controllerStatus.textContent !== message) this.controllerStatus.textContent = message;
    }
    if (this.controllerControls) this.controllerControls.hidden = !usingController;
    if (this.keyboardControls) this.keyboardControls.hidden = usingController;
    if (this.resetKey) this.resetKey.hidden = !usingController;
    setHudText(this.resetKey, 'MENU / OPTIONS');
  }

  syncCombatHud() {
    this.syncControllerHud();
    const lowHealth = Boolean(this.enemies
      && this.enemies.hero.health <= HERO_DAMAGE.maxHealth * LOW_HEALTH_THRESHOLD);
    const criticalHealth = lowHealth && this.enemies.hero.health < HERO_DAMAGE.maxHealth * CRITICAL_HEALTH_THRESHOLD;
    sound.setMusicDucked(lowHealth);
    if (this.lowHealthWarning !== lowHealth) {
      this.lowHealthWarning = lowHealth;
      this.healthWarning?.classList.toggle('is-active', lowHealth);
    }
    if (this.criticalHealthWarning !== criticalHealth) {
      this.criticalHealthWarning = criticalHealth;
      this.healthWarning?.classList.toggle('is-critical', criticalHealth);
    }
    if (this.heroPower) {
      if (this.heroPower.max !== HERO_POWER.max) this.heroPower.max = HERO_POWER.max;
      this.heroPower.value = this.power.meter;
      this.heroPower.classList.toggle('is-drained', this.power.drained);
    }
    setHudText(this.heroPowerText, `${Math.floor(this.power.meter)} / ${HERO_POWER.max}`);
    if (this.enemies) {
      const health = this.enemies.hero.health;
      if (this.heroHealth) {
        if (this.heroHealth.max !== HERO_DAMAGE.maxHealth) this.heroHealth.max = HERO_DAMAGE.maxHealth;
        this.heroHealth.value = health;
      }
      setHudText(this.heroHealthText, `${Math.ceil(health)} / ${HERO_DAMAGE.maxHealth}`);
      setHudText(this.enemyProgress, `${this.combat.enemiesDefeated} / ${this.combat.enemies.length} bots down`);
      if (this.encounterStatus) {
        const cleared = this.combat.enemiesDefeated === this.combat.enemies.length;
        const engaged = this.combat.enemies.some(enemy => enemy.health > 0
          && enemy.state !== 'idle' && enemy.state !== 'down');
        const usingController = this.controller.state.connected && this.aimSource === 'gamepad';
        const retry = usingController ? 'Press Menu / Options' : 'Choose Retry level';
        const reset = usingController ? 'Menu / Options' : 'Reset arena';
        setHudText(this.encounterStatus, this.enemies.defeated ? this.defeatReady ? `HERO DOWN · ${retry}` : 'HERO DOWN'
          : cleared ? this.enemies.projectiles.length > 0 ? 'BOTS DOWN · Bolts still active'
            : `BOTS CLEARED · ${reset} to run it again`
            : engaged ? 'BOTS ENGAGED · Watch the warnings' : 'BOT DRILL → Beyond the wall');
      }
      if (this.defeatPanel && this.defeatPanel.hidden === this.defeatReady) {
        this.defeatPanel.hidden = !this.defeatReady;
        if (this.defeatReady) this.reviveButton?.focus({ preventScroll: true });
        else this.game.canvas.focus({ preventScroll: true });
      }
    }
    if (this.grabProgress && this.throwing) {
      const tier = GRAB_TIERS[this.grabTier];
      const next = GRAB_TIERS[this.grabTier + 1];
      const message = `GRAB · ${tier.name}${next
        ? ` · ${this.blastKills} / ${next.kills} blast kills to ${next.name}` : ' · lifts everything'}`;
      if (this.grabProgress.textContent !== message) this.grabProgress.textContent = message;
    }
    if (this.destructionProgress) {
      const message = `${this.combat.destroyedProps} / ${this.combat.props.length} props broken`;
      if (this.destructionProgress.textContent !== message) this.destructionProgress.textContent = message;
    }
    if (this.combatProgress) {
      const defeated = this.combat.defeated;
      const total = this.combat.targets.length;
      const message = defeated === total
        ? 'All targets down! Reset to go again.' : `${defeated} / ${total} targets down`;
      if (this.combatProgress.textContent !== message) this.combatProgress.textContent = message;
    }
  }

  handlePointerDown(pointer) {
    if (pointer.wasTouch) return;
    if (this.controlsSuspended || this.enemies?.defeated) return;
    this.aimSource = 'mouse';
    this.mouseAiming = true;
    if (pointer.button === 0) {
      this.laserAimSource = 'mouse';
      this.laser.fire();
    }
    if (pointer.button === 1 || pointer.button === 2 && this.throwing?.held) {
      this.grabOrThrow('mouse');
      return;
    }
    if (pointer.button === 2) {
      const aim = this.getPunchAim('mouse');
      this.rig.requestPunch(this.position, this.velocity,
        { worldX: aim.x, worldY: aim.y, target: aim.target ?? null });
    }
  }

  handlePointerMove(pointer) {
    if (pointer?.wasTouch) return;
    if (!this.controlsSuspended) {
      this.aimSource = 'mouse';
      this.mouseAiming = true;
    }
  }

  handleKeyboardLaser(event) {
    if (event?.repeat || this.controlsSuspended || this.enemies?.defeated) return;
    this.aimSource = 'mouse';
    this.laserAimSource = this.mouseAiming ? 'mouse' : 'travel';
    this.laser.fire();
  }

  handleKeyboardPunch(event) {
    if (event?.repeat || this.controlsSuspended || this.enemies?.defeated) return;
    this.aimSource = 'mouse';
    if (this.throwing?.held) {
      this.grabOrThrow('mouse');
      return;
    }
    const aim = this.getPunchAim('mouse');
    this.rig.requestPunch(this.position, this.velocity,
      { worldX: aim.x, worldY: aim.y, target: aim.target ?? null }, 'keyboard');
  }

  handleKeyboardGrab(event) {
    if (event?.repeat) return;
    this.aimSource = 'mouse';
    this.grabOrThrow('mouse');
  }

  // One button grabs a liftable weakened bot in reach, and throws the held one toward the aim.
  grabOrThrow(source) {
    if (!this.throwing || this.controlsSuspended || this.enemies?.defeated) return false;
    if (!this.throwing.held) {
      const grabbed = Boolean(this.throwing.grab(this.position));
      let heavy;
      if (grabbed) {
        this.power.spend(HERO_POWER.grabCost);
        this.tutorial?.did('grabbed');
      }
      // Too heavy yet: once, point the player at the Shop, then stop marking heavy things.
      else if ((heavy = this.throwing.locked(this.position))) {
        const camera = this.cameras.main;
        const scale = camera.zoom * (this.scale.zoom ?? 1);
        const pad = 6;
        this.tutorial?.liftTip(this, {
          left: (heavy.x - heavy.width / 2 - camera.worldView.x) * scale - pad,
          top: (heavy.y - heavy.height / 2 - camera.worldView.y) * scale - pad,
          width: heavy.width * scale + pad * 2, height: heavy.height * scale + pad * 2 });
        this.throwing.showLocked = false;
      }
      // Lost the tutorial's officer (punched out, say)? Pressing E brings another.
      else if (this.tutorial?.current?.stat === 'thrown'
        && !this.throwing.arena.enemies.some(enemy => enemy.health > 0)) this.spawnTutorialTarget?.();
      return grabbed;
    }
    const thrown = this.throwing.throw(this.throwAim(source), this.velocity);
    if (thrown) this.tutorial?.did('thrown');
    return thrown;
  }

  // Unit direction from the hero toward the mouse pointer or controller aim.
  // Throws and the F laser use the last aim input: a moved or clicked mouse, or a fresh WASD steer.
  throwAim(source) {
    if (source === 'touch') return this.touchDirection();
    if (source === 'gamepad') return this.controllerDirection();
    if (!this.mouseAiming) return this.travelDirection();
    const aim = this.getAim('mouse');
    const dx = aim.x - this.position.x;
    const dy = aim.y - this.position.y;
    const length = Math.hypot(dx, dy);
    return length > 1 ? { x: dx / length, y: dy / length } : this.travelDirection();
  }

  updateThrowing(dt) {
    if (!this.throwing) return;
    // The load rides the drawn hero: it bobs with the hover and grows with the altitude zoom.
    const hero = this.rig.image;
    const size = this.rig.size ?? 1;
    // Upright, the load sits overhead on the raised hands. Stretched out in flight it lies along
    // the hero's back and points where the body points: level, climbing, or nose-down in a dive.
    const posture = this.rig.pose?.posture ?? 0;
    const spine = this.rig.pose?.spine ?? -Math.PI / 2;
    // The load rests where both 6 px arms reach it: `spread` px either side of the shoulders, which
    // sit 2 px up the spine from the hero's centre. No gap between the hands and the load.
    const load = this.throwing.held?.enemy;
    const spread = load?.object ? 3 : 2;
    // armSide eases through zero in a turn, so the load swings over the head to the other side.
    const back = spine - Math.max(-1, Math.min(1, this.rig.pose?.armSide ?? 1)) * Math.PI / 2;
    const out = -Math.PI / 2 + Math.atan2(Math.sin(back + Math.PI / 2), Math.cos(back + Math.PI / 2)) * posture;
    this.throwing.up = { x: Math.cos(out), y: Math.sin(out) };
    this.throwing.grip = (Math.sqrt(36 - spread * spread) - 0.3 + Math.cos(spine - out) * 2) * size;
    this.throwing.lean = out + Math.PI / 2;
    this.throwing.rock = 1 - (1 - THROW.flightRock) * posture;
    // A thrown car a full screen width from the hero is well off camera: take it away.
    this.throwing.range = this.cameras.main.worldView?.width || Infinity;
    this.throwing.update(dt, hero, Math.cos(this.rig.gazeTarget ?? 0) >= 0 ? 1 : -1);
    this.throwFeedback();
    // Both hands go up under whatever is held, then follow a throw through along its line.
    const held = this.throwing.held?.enemy;
    this.rig.carrying = Boolean(held);
    // The hero looks down a throw through its windup and the stance after it.
    const swing = this.throwing.held?.windup;
    // Lying flat in a RAM, the hero stands up first, then swings. Already upright, it throws at once.
    if (!swing) this.throwing.settle = THROW.settle * (this.rig.flight ?? 0);
    if (swing) {
      this.rig.throwAim = Math.atan2(swing.direction.y, swing.direction.x);
      this.throwStance = THROW.stance;
    } else {
      // A punch ends the stance at once, so a flying punch chain is never held upright.
      this.throwStance = this.rig.punch?.active ? 0 : Math.max(0, (this.throwStance ?? 0) - dt);
    }
    // The throw is made standing: upright through the windup and for a while after, still flying on.
    this.rig.upright = this.throwStance > 0;
    if (!this.rig.upright) this.rig.throwAim = null;
    this.throwFollow = Math.max(0, (this.throwFollow ?? 0) - dt);
    if (held) {
      // The hands take the load `reach` px out from the shoulders, spread along its underside.
      const reach = Math.sqrt(36 - spread * spread) - 0.3;
      this.rig.hold = this.throwing.held.windup || !held.object
        ? { x: (held.x - hero.x) / size, y: (held.y + (held.hold ?? held.half ?? held.radius) - hero.y) / size, spread, angle: 0 }
        : { x: Math.cos(spine) * 2 + Math.cos(out) * reach, y: Math.sin(spine) * 2 + Math.sin(out) * reach,
          spread, angle: out + Math.PI / 2 };
    } else if (this.throwFollow <= 0) this.rig.hold = null;
  }

  // Throw events become sound (the camera never shakes); blast kills advance the grab upgrade path.
  throwFeedback() {
    for (const event of this.throwing.events) {
      if (event.type === 'grab') {
        sound.grab();
        this.punchEffects?.contact?.(event, Math.atan2(event.y - this.position.y, event.x - this.position.x));
      } else if (event.type === 'throw') {
        sound.hurl();
        this.onThrow?.(event);
        // The heave pushes the hero back a little.
        this.velocity.x -= event.direction.x * THROW.recoil;
        this.velocity.y -= event.direction.y * THROW.recoil;
        this.throwFollow = 0.16;
        this.rig.hold = { x: event.direction.x * 7, y: event.direction.y * 7 - 1, spread: 1 };
      } else if (event.type === 'blast') {
        sound.blast(event.power);
        // A car hitting home lands like a punch: the world holds for a beat.
        if (event.object && this.rig.punch) this.rig.punch.hitPause = Math.max(this.rig.punch.hitPause ?? 0, 0.06);
      } else if (event.type === 'thud') {
        sound.punchImpact();
      } else if (event.type === 'kill') {
        this.awardBlastKill();
        this.onThrowKill?.(event);
      } else if (event.type === 'drop') {
        sound.punchSwing();
      }
    }
    this.throwing.events.length = 0;
  }

  awardBlastKill() {
    if (this.grabTier >= MAX_GRAB_TIER) return;
    this.blastKills++;
    const next = GRAB_TIERS[this.grabTier + 1];
    if (this.blastKills < next.kills) return;
    this.blastKills = 0;
    this.grabTier++;
    this.throwing.tier = this.grabTier;
    if (this.devPanel && !this.devPanel.hidden) this.throwArtwork?.announce(next);
    this.syncGrabUpgrade();
    sound.unlock();
  }

  resizeView(size) {
    // Phaser only resizes a camera that still matched the previous size, so one missed step (iOS
    // Safari toggling full screen, its toolbar sliding) left the view short with the clear colour
    // showing as a light-blue strip below. Always match the game size.
    this.cameras.main.setSize?.(size.width, size.height);
    // Desktop fits the wide view; touch keeps the short edge readable in either orientation.
    this.baseZoom = viewZoom(size.width, size.height, this.viewHeight, Boolean(this.touchMove));
    this.updateCamera(0);
    this.drawWorld();
  }

  updateCamera(dt) {
    const camera = this.cameras.main;
    const blend = 1 - Math.exp(-4 * dt);
    // Match tiny-hero's easing and velocity look-ahead.
    this.cameraCenter.x += (this.position.x + this.velocity.x * 0.4 - this.cameraCenter.x) * blend;
    this.cameraCenter.y += (this.position.y + this.velocity.y * 0.3 - this.cameraCenter.y) * blend;
    // Ease the ground limit so the camera glides over terrain instead of tracing every bump.
    const ground = this.groundAt(this.position.x);
    this.cameraGround = this.cameraGround === undefined ? ground
      : this.cameraGround + (ground - this.cameraGround) * (1 - Math.exp(-3 * dt));
    // Widen the view just enough that the ground stays below the hero as they climb.
    const altitude = this.cameraGround - this.position.y;
    const targetZoom = Math.max(altitudeZoomLimit(MIN_ALTITUDE_ZOOM, Boolean(this.touchMove)),
      Math.min(1, camera.height / this.baseZoom / (2 * (altitude + ALTITUDE_GROUND_MARGIN))));
    this.altitudeZoom += (targetZoom - this.altitudeZoom) * (1 - Math.exp(-2.5 * dt));
    camera.setZoom(this.baseZoom * this.altitudeZoom);
    this.cameraCenter.y = Math.min(this.cameraCenter.y,
      this.cameraGround - camera.height / camera.zoom * 0.3);
    // A brief vertical contact impulse, measured in screen pixels. Never alters the follow centre,
    // gameplay time or input, and never adds random shake to aiming.
    let kick = 0;
    if (this.groundPoundKick) {
      const impact = this.groundPoundKick;
      kick = (2 + impact.power * 2) / camera.zoom * Math.cos(impact.age * 28) * Math.exp(-impact.age * 22);
      impact.age += dt;
      if (impact.age > 0.18) this.groundPoundKick = null;
    }
    camera.centerOn(this.cameraCenter.x, this.cameraCenter.y - kick);
  }

  drawWorld() {
    const graphics = this.world;
    const camera = this.cameras.main;
    const width = camera.width / camera.zoom;
    const height = camera.height / camera.zoom;
    const left = this.cameraCenter.x - width / 2 - 2;
    const top = this.cameraCenter.y - height / 2 - 2;
    const bottom = top + height + 4;
    graphics.clear();
    drawSky(graphics, { left, top, width, height },
      [0x77b8dc, 0x7fc2e0, 0x89c9e3, 0x95d1e5, 0xa5d9e5], this.cameraCenter);

    for (let x = Math.floor(left / 320) * 320 - 320; x < left + width + 4; x += 320) {
      graphics.fillStyle(0x91c9ce);
      graphics.fillTriangle(x, GROUND_Y, x + 52, GROUND_Y - 37, x + 108, GROUND_Y);
      graphics.fillTriangle(x + 90, GROUND_Y, x + 162, GROUND_Y - 30, x + 237, GROUND_Y);
      graphics.fillTriangle(x + 202, GROUND_Y, x + 270, GROUND_Y - 39, x + 320, GROUND_Y);
      graphics.fillStyle(0x79b7bd);
      graphics.fillTriangle(x + 10, GROUND_Y, x + 64, GROUND_Y - 23, x + 122, GROUND_Y);
      graphics.fillTriangle(x + 160, GROUND_Y, x + 218, GROUND_Y - 17, x + 273, GROUND_Y);
    }

    if (bottom <= GROUND_Y) return;
    graphics.fillStyle(0x487963);
    graphics.fillRect(left, GROUND_Y, width + 4, bottom - GROUND_Y);
    graphics.fillStyle(0x8fc782);
    graphics.fillRect(left, GROUND_Y, width + 4, 4);
    graphics.fillStyle(0x61946b);
    graphics.fillRect(left, GROUND_Y + 4, width + 4, 3);
    graphics.fillStyle(0x355c53);
    graphics.fillRect(left, GROUND_Y + 21, width + 4, 10);
    graphics.fillStyle(0x6da579);
    for (let x = Math.floor(left / 29) * 29; x < left + width + 4; x += 29) {
      graphics.fillRect(x, GROUND_Y + 11 + ((x % 3 + 3) % 3), 9, 2);
    }
    graphics.fillStyle(0xb6d995);
    for (let x = Math.floor(left / 37) * 37; x < left + width + 4; x += 37) {
      graphics.fillRect(x, GROUND_Y - 2, 2, 2);
      graphics.fillRect(x + 5, GROUND_Y - 1, 1, 1);
    }
  }

  update(_time, delta) {
    this.pollController();
    // simSpeed: below 1 for slow motion (the boss's fall, enemy-response.js).
    this.accumulator = Math.min(this.accumulator + delta / 1000 * (this.simSpeed ?? 1), 0.05);
    while (this.accumulator >= SIM_STEP) {
      this.step(SIM_STEP);
      this.accumulator -= SIM_STEP;
    }
    this.rig.render();
    this.drawWorld();
    this.drawControllerAim();
    const visualEye = this.rig.renderHeadPoint?.(2, -2);
    this.laser.draw(visualEye ? { x: this.rig.image.x + visualEye[0] * this.rig.size,
      y: this.rig.image.y + visualEye[1] * this.rig.size } : undefined);
    this.punchEffects.draw();
    this.combatArtwork.draw(this.elapsed, this.position, this.velocity);
    this.enemyArtwork?.draw(this.elapsed, this.position, this.rig.image);
    if (this.throwArtwork) {
      const gamepad = this.aimSource === 'gamepad' && this.controller.state.connected;
      this.throwArtwork.draw(this.elapsed, this.position, this.velocity,
        this.throwAim(this.aimSource === 'touch' ? 'touch' : gamepad ? 'gamepad' : 'mouse'));
    }
    this.syncCombatHud();
    this.syncPerfReadout();
  }

  // Twice a second: the readout itself must not become per-frame DOM work.
  syncPerfReadout() {
    const meter = this.game?.perf;
    const now = performance.now();
    if (!meter || !this.perfReadout || now - this.perfReadoutAt < 500) return;
    this.perfReadoutAt = now;
    const { mean, worst, uploadsPerFrame } = meter.report(60);
    this.perfReadout.textContent = `Frame ${mean.toFixed(1)} ms avg · ${worst.toFixed(1)} worst · ${uploadsPerFrame.toFixed(1)} uploads/frame`;
    this.perfReadout.classList.toggle('perf-readout--over', worst > FRAME_BUDGET_MS || uploadsPerFrame > UPLOAD_BUDGET);
  }

  step(dt) {
    if (this.controlsSuspended) return 0;
    // Freeze both sides of the blow, its effects, and the world clock together.
    // Consume only the paused portion so the remaining time resumes normally.
    const paused = Math.min(dt, this.rig.punch?.hitPause ?? 0);
    if (paused > 0) {
      this.rig.punch.update(paused);
      dt -= paused;
      if (dt <= 1e-9) return 0;
    }
    if (this.enemies?.defeated) {
      this.beginDefeat();
      // The presentation lasts three real-time seconds; only the world uses slow motion.
      const remaining = Math.max(0, DEFEAT_DURATION - this.defeatElapsed);
      const elapsed = this.defeatElapsed + dt;
      this.defeatElapsed = elapsed >= DEFEAT_DURATION - 1e-9 ? DEFEAT_DURATION : elapsed;
      dt = Math.min(dt, remaining) * DEFEAT_TIME_SCALE;
      if (dt <= 1e-9) return 0;
      this.combat?.update(dt);
      this.elapsed += dt;
      this.stepDefeated(dt);
      return dt;
    }
    const previousPosition = { x: this.position.x, y: this.position.y };
    this.combat?.update(dt);
    this.elapsed += dt;
    const controller = this.controller.state;
    if (this.touchMove?.punch && !this.rig.punch?.queued && !this.throwing?.held) this.handleTouchAction('punch', true);
    this.touchMove?.showThrow?.(this.throwing?.held ? this.touchDirection() : null);
    // Through a throw's stance a broken RAM flies on as a plain boost, the way it was going.
    const ramPaused = this.power.ramActive && this.throwStance > 0;
    let input = this.movementInput();
    // A new WASD direction takes aim back from the mouse (see throwAim).
    const keys = this.movementInput(true);
    if ((keys.x || keys.y) && (keys.x !== this.steerKeys?.x || keys.y !== this.steerKeys?.y)) this.mouseAiming = false;
    this.steerKeys = { x: keys.x, y: keys.y };
    if (ramPaused && input.lengthSq() === 0) input = new Phaser.Math.Vector2(this.ramDirection.x, this.ramDirection.y);
    const strength = Math.sqrt(input.lengthSq());
    const moving = strength > 0;
    const punch = this.rig.punch;
    if (!moving && punch?.active && punch.dashDistance > 0 && punch.time >= punch.hit.windup) {
      punch.stopDash();
    }
    const controllerMovement = moving && this.movementInput(true).lengthSq() === 0;
    const ram = this.ramActive;
    // Keys always fly at boost speed; analog sticks keep a hover range below full flight.
    const boosting = moving && (!controllerMovement || ram || ramPaused
      || strength > CONTROLLER_HOVER_LIMIT);
    // Touch boost: hold the stick at its rim briefly (no extra button on a crowded screen).
    const rim = this.touchMove?.reach > BOOST_REACH;
    this.touchRimTime = rim ? (this.touchRimTime ?? 0) + dt : 0;
    const flightBoost = this.flightBoost = moving && !ram && !ramPaused
      && (Boolean(this.keys.SHIFT?.isDown) || this.touchRimTime > TOUCH_BOOST_DELAY);
    this.tutorial?.track(dt, moving, flightBoost, ram);
    const maxSpeed = flightBoost ? FLIGHT_BOOST_SPEED : boosting ? BOOST_SPEED : CRUISE_SPEED;
    let targetSpeed = strength * maxSpeed;
    if (controllerMovement && !ram && !flightBoost) {
      // A continuous speed curve gives light tilts a useful hover range, then opens into flight.
      targetSpeed = strength <= CONTROLLER_HOVER_LIMIT
        ? CRUISE_SPEED * strength / CONTROLLER_HOVER_LIMIT
        : CRUISE_SPEED + (BOOST_SPEED - CRUISE_SPEED)
          * (strength - CONTROLLER_HOVER_LIMIT) / (1 - CONTROLLER_HOVER_LIMIT);
    }
    const response = moving ? (boosting ? BOOST_RESPONSE : INPUT_RESPONSE) : COAST_RESPONSE;
    const blend = 1 - Math.exp(-response * dt);
    const speedScale = moving ? targetSpeed / strength : 0;
    if (!(this.rig.punch?.hitPause > 0)) {
      if (ram) {
        if (moving) {
          const angle = Math.atan2(this.ramDirection.y, this.ramDirection.x);
          const desired = Math.atan2(input.y, input.x);
          const turn = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
          const next = angle + Math.max(-10 * dt, Math.min(10 * dt, turn));
          this.ramDirection = { x: Math.cos(next), y: Math.sin(next) };
        }
        this.velocity.x = this.ramDirection.x * HERO_POWER.ramSpeed;
        this.velocity.y = this.ramDirection.y * HERO_POWER.ramSpeed;
      } else {
        this.velocity.x += (input.x * speedScale - this.velocity.x) * blend;
        this.velocity.y += (input.y * speedScale - this.velocity.y) * blend;
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        if (ramPaused && speed > 1) this.ramDirection = { x: this.velocity.x / speed, y: this.velocity.y / speed };
      }
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
    }
    const floor = this.floorAt(this.position.x) - 11;
    // Skimming the ground follows its slope, so the body lines up with hills instead of staying
    // level. Running down a hill stays glued unless the player steers up and away; past a drop
    // (steeper than mountain flanks, about 31 degrees) the hero flies on level instead.
    const wasGrounded = previousPosition.y >= this.floorAt(previousPosition.x) - 11.5;
    if (!ram && wasGrounded && this.glues(this.position.x)) {
      const slope = (this.floorAt(this.position.x + 4) - this.floorAt(this.position.x - 4)) / 8;
      const length = Math.hypot(slope, 1);
      const into = (this.velocity.x * slope - this.velocity.y) / length;
      if (into < 0 || input.y >= 0 && Math.abs(slope) <= 0.6) {
        this.velocity.x -= into * slope / length;
        this.velocity.y += into / length;
        this.position.y = floor;
      }
    }
    if (this.position.y > floor) {
      const landingSpeed = this.velocity.y;
      this.position.y = floor;
      this.velocity.y = Math.min(0, this.velocity.y);
      const canPound = this.ramDamageActive && previousPosition.y < this.floorAt(previousPosition.x) - 11;
      const pounded = this.combat?.groundPound(this.position.x, landingSpeed, canPound);
      if (pounded) {
        const wave = this.combat.groundPounds.at(-1);
        this.rig.land?.();
        // Plant the impact. Steering resumes normally on the very next simulation step.
        if (!this.rig.punch?.active) this.velocity.x = 0;
        this.groundPoundKick = { age: 0, power: wave.power };
      }
      // Scenes with water hear about every landing (free roam splashes instead of thudding).
      this.onLanding?.(landingSpeed, pounded);
      if (pounded) {
        const wave = this.combat.groundPounds.at(-1);
        const surface = this.groundPoundSurface?.(wave.x);
        if (!wave.water && !surface?.water) sound.groundPound(wave.power);
      }
    }

    this.updateCamera(dt);
    // Refresh world coordinates even when a held pointer has not moved.
    const pointer = this.input.mousePointer ?? this.input.activePointer;
    // Only a press that began on the canvas fires: Phaser also tracks presses on DOM buttons
    // (pause, HUD), which would otherwise fire the laser for the frames before the click lands.
    const mouseLaser = !pointer.wasTouch && pointer.leftButtonDown() && pointer.downElement === this.game.canvas;
    const touchLaser = Boolean(this.touchMove?.laser);
    const keyboardLaser = Boolean(this.keys.F?.isDown);
    if (mouseLaser) this.laserAimSource = 'mouse';
    else if (keyboardLaser) this.laserAimSource = this.mouseAiming ? 'mouse' : 'travel';
    else if (touchLaser) this.laserAimSource = 'touch';
    else if (controller.laser) this.laserAimSource = 'gamepad';
    const firing = mouseLaser || keyboardLaser || touchLaser || controller.laser || this.laser.pulse > 0;
    // The pointer steers the hero only while a mouse button fires the laser; otherwise
    // keyboard-and-mouse play looks, punches and fires down the line of travel.
    const aimSource = firing ? this.laserAimSource : this.aimSource === 'mouse' ? 'travel' : this.aimSource;
    const aim = this.getAim(aimSource);
    // A held load leaves the gaze alone: the hero looks down the throw only as it throws
    // (HeroRig.throwAim), as it looks down the laser only while firing.
    const rigPointer = { isDown: (aimSource === 'mouse' ? !pointer.wasTouch && pointer.isDown : aimSource === 'touch' ? this.touchMove?.aiming : aimSource === 'gamepad' && controller.aiming) || firing,
      worldX: aim.x, worldY: aim.y };
    if (this.rig.punch?.active) {
      rigPointer.refreshPunchAim = () => this.preparePunchAim(moving);
      const punchAim = rigPointer.refreshPunchAim();
      rigPointer.punchWorldX = punchAim.worldX;
      rigPointer.punchWorldY = punchAim.worldY;
    }
    const rigInput = ram ? new Phaser.Math.Vector2(this.ramDirection.x, this.ramDirection.y) : input;
    this.rig.update(dt, this.position, this.velocity, rigInput,
      rigPointer, this.elapsed, boosting || ram, ram);
    if (this.rig.punch?.active && this.lastPunchSoundId !== this.rig.punch.attackId) {
      this.lastPunchSoundId = this.rig.punch.attackId;
      sound.punchSwing();
      this.power.spend(HERO_POWER.punchCost);
      this.tutorial?.did('punched');
    }
    this.applyPunchMotion();
    this.resolveCombat(previousPosition, this.ramDamageActive);
    this.punchEffects?.update(dt, this.rig);
    if (this.combat) {
      const desired = { x: this.position.x, y: this.position.y };
      if (this.combat.resolveSolids(previousPosition, this.position, this.velocity)) {
        this.rig.punch?.stopDash?.();
      }
      const dx = this.position.x - desired.x;
      const dy = this.position.y - desired.y;
      this.rig.image.x += dx;
      this.rig.image.y += dy;
      if (this.lastPunchSample) {
        this.lastPunchSample.x += dx;
        this.lastPunchSample.y += dy;
      }
    }
    const [eyeX, eyeY] = this.rig.headPoint(2, -2);
    const eye = { x: this.rig.image.x + eyeX * this.rig.size, y: this.rig.image.y + eyeY * this.rig.size };
    const camera = this.cameras.main;
    const laserRange = Math.hypot(camera.width, camera.height) / camera.zoom + 64;
    const laserAim = aimSource === 'mouse' ? aim : this.getAim(aimSource, eye);
    // An empty meter cuts the beam until the laser is released, so it never flickers on recharge.
    const laserDown = mouseLaser || keyboardLaser || touchLaser || controller.laser;
    if (!laserDown) this.laserEmpty = false;
    else if (this.power.meter <= 0 || this.power.drained) this.laserEmpty = true;
    if (this.laserEmpty) this.laser.pulse = 0;
    this.laser.update(dt, laserDown && !this.laserEmpty, eye, laserAim, laserRange, this.traceCombatLaser);
    if (this.laser.beam) this.power.spend(HERO_POWER.laserDrainRate * dt, true);
    if (this.laser.beam) this.tutorial?.did('lasered', dt);
    this.combat?.laser(dt, this.laser.beam);
    // Beam heat follows focus: 0 on a fresh target, 1 once fully focused.
    if (this.combat) this.laser.heat = (this.combat.laserFocus.multiplier - 1) / (COMBAT.laserRampMax - 1);
    sound.laser(Boolean(this.laser.beam));
    sound.laserHeat(this.laser.heat ?? 0);
    sound.ram(this.ramActive && this.velocity.lengthSq() > 1, Math.min(1, Math.hypot(this.velocity.x, this.velocity.y) / HERO_POWER.ramSpeed));
    if (this.enemies) {
      const hits = this.enemies.hero.hits;
      this.enemies.update(dt, this.position, previousPosition);
      if (this.enemies.hero.hits !== hits) {
        if (this.enemies.defeated) {
          this.beginDefeat();
        }
      }
    }
    this.updateThrowing(dt);
    this.power.update(dt);
    if (this.unlimitedPower) Object.assign(this.power, { meter: HERO_POWER.max, exhausted: false, drained: false });
    this.combatArtwork?.wake?.update(dt, this.position, this.velocity,
      // The Shift boost wears the same white wake as a level-1 flight.
      this.ramActive || this.flightBoost, this.ramDamageActive);
    return dt;
  }

  stopHeroCombat() {
    this.touchMove?.reset();
    this.aimFeedback?.clear();
    this.power.cancelRam();
    this.rig.resetRenderPose?.();
    this.velocity.x = this.velocity.y = 0;
    Object.assign(this.rig.punch, { active: false, queued: false, grace: 0,
      stance: 0, hitPause: 0, queuedAimSource: null,
      target: null, targetAssigned: false, queuedTarget: undefined });
    this.engagedPunchTarget = null;
    this.punchEngagedUntil = 0;
    this.lastPunchSample = null;
    this.laser.pulse = 0;
    this.laser.beam = null;
    this.laser.sparks.length = 0;
    this.punchEffects?.reset();
    this.combatArtwork?.wake?.reset();
  }

  get defeatReady() {
    return Boolean(this.enemies?.defeated) && this.defeatElapsed !== null && this.defeatElapsed >= DEFEAT_DURATION;
  }

  beginDefeat() {
    if (this.defeatElapsed !== null) return;
    this.defeatElapsed = 0;
    this.combat?.combo?.reset(false);
    const vx = this.velocity.x, vy = this.velocity.y;
    this.stopHeroCombat();
    this.throwing?.drop();
    // Carry a little momentum into the fall; the player no longer steers the body.
    this.velocity.x = vx * 0.6;
    this.velocity.y = Math.min(vy, -35);
    this.defeatSpin = (Math.sign(vx) || 1) * 1.3;
  }

  // Revive: undo stepDefeated's fallen pose (tilt, fade) and hand control back.
  reviveHero() {
    if (!this.defeatReady) return;
    this.enemies.revive();
    this.combat?.combo?.reset();
    this.defeatElapsed = null;
    this.velocity.x = this.velocity.y = 0;
    this.rig.resetRenderPose?.();
    this.rig.image.setRotation(0);
    this.rig.image.setAlpha(1);
    this.controller.requireNeutral();
  }

  stepDefeated(dt) {
    sound.ram(false);
    const previous = { x: this.position.x, y: this.position.y };
    this.velocity.x *= Math.exp(-2 * dt);
    this.velocity.y = Math.min(150, this.velocity.y + 180 * dt);
    this.position.y = Math.min(this.floorAt(this.position.x) - 11, this.position.y + this.velocity.y * dt);
    this.combat.resolveSolids(previous, this.position, this.velocity);
    this.updateCamera(dt);
    this.rig.update(dt, this.position, this.velocity, new Phaser.Math.Vector2(),
      { isDown: false, worldX: this.position.x + 10, worldY: this.position.y }, this.elapsed, false);
    const fall = 1 - (1 - this.defeatElapsed / DEFEAT_DURATION) ** 3;
    this.rig.image.setRotation(this.defeatSpin * fall);
    this.rig.image.setAlpha(1 - 0.45 * fall);
    this.laser.update(dt, false, this.position, this.position, 1, this.traceCombatLaser);
    this.punchEffects?.update(dt, this.rig);
    this.enemies.update(dt, this.position, previous);
    // Throws already in the air still land and chain after the hero falls.
    this.updateThrowing(dt);
  }

  resolveCombat(previousPosition, ramDamage) {
    if (!this.combat) return;
    this.combat.ram(previousPosition, this.position, this.velocity, ramDamage);
    const punch = this.rig.punch;
    const hand = this.rig.getJoints()[punch.armIndex].hand;
    const sample = { id: punch.attackId, x: this.rig.image.x + hand[0], y: this.rig.image.y + hand[1] };
    if (punch.canHit) {
      const contact = this.combat.punch({ id: punch.attackId, combo: punch.combo, angle: punch.angle, aimed: punch.target,
        from: this.lastPunchSample?.id === sample.id ? this.lastPunchSample : sample, to: sample });
      if (contact) {
        this.engagedPunchTarget = !contact.target.destructible && contact.target.health > 0 ? contact.target : null;
        this.punchEngagedUntil = this.elapsed + COMBAT.punch.engagementTime;
        punch.contact();
        this.rig.pendingDraw = this.elapsed; // Show the contact pose this frame.
        this.punchEffects?.contact?.(contact.point, punch.angle);
        sound.punchImpact();
      }
    }
    this.lastPunchSample = sample;
  }

  applyPunchMotion() {
    const punch = this.rig.punch;
    if (!punch) return;
    if (punch.active && Math.hypot(punch.motion.x, punch.motion.y) > 0) {
      const input = this.movementInput();
      // Check the committed strike, not the target's changing position. Steering
      // away cancels the remaining assist without cancelling the fist or combo.
      const control = punchMovementControl(input, punch.angle);
      if (control === 0) punch.stopDash();
      else {
        // Easing the stick back must also ease an already committed lunge.
        const scale = Math.min(1, control / (punch.dashControl || 1));
        punch.motion.x *= scale;
        punch.motion.y *= scale;
      }
    }
    const oldY = this.position.y;
    this.position.x += punch.motion.x;
    this.position.y = Math.min(this.floorAt(this.position.x) - 11, this.position.y + punch.motion.y);
    this.rig.image.x += punch.motion.x;
    this.rig.image.y += this.position.y - oldY;
  }
}

export function startGame(scene) {
  // Render at device pixels, not CSS pixels: otherwise a fractional devicePixelRatio (e.g. 1.5) makes
  // the browser stretch every frame with nearest-neighbour, doubling uneven pixel rows that shimmer.
  const ratio = () => window.devicePixelRatio || 1;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: Math.round(window.innerWidth * ratio()),
    height: Math.round(window.innerHeight * ratio()),
    backgroundColor: '#77b8dc',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / ratio() },
    scene,
  });
  // The renderer exists once the game boots; the meter needs its GL context.
  game.events?.once('ready', () => { game.perf = window.__perf = new PerfMeter(game); });
  const resize = () => {
    // iOS Safari can leave the page scrolled after a rotation; the game never scrolls.
    if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
    game.scale.zoom = 1 / ratio();
    game.scale.resize(Math.round(window.innerWidth * ratio()), Math.round(window.innerHeight * ratio()));
    // resize() skips the CSS size when it already matches; set it so ratio changes never leave it stale.
    Object.assign(game.canvas.style, { width: `${window.innerWidth}px`, height: `${window.innerHeight}px` });
    game.scale.refresh();
  };
  // iOS Safari fires resize before innerHeight settles when its toolbar collapses or expands, which
  // left the canvas short with the page background showing below it. Resize again once it settles,
  // and on the visual viewport's own resize.
  let settle = 0;
  const onResize = () => {
    resize();
    clearTimeout(settle);
    settle = setTimeout(resize, 300);
  };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  game.events.once('destroy', () => {
    clearTimeout(settle);
    window.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
  });
  return game;
}
