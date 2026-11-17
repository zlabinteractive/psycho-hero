// Sound design, all synthesized with WebAudio: no asset files.
// ponytail: procedural placeholder audio; swap for recorded assets before release (the mix stays).
//
// The mix is seven families, each on its own bus, so they never pile up into mud:
//   music        ambient drone, crossfaded to a driving boss track while a boss is up (bossMusic)
//   punch        swing, impact, grab, throw, ground pound: the hero's rhythm, always on top
//   laser        one continuous beam voice (laser, laserHeat)
//   ram          one continuous rushing-wind voice (ram) plus its contact slam (ramHit)
//   fire         enemy weapons, three types only: gun (gunshot), rocket/missile, cannon (launch)
//   destruction  carves, collapses, blasts, crunches, splashes
// Each family has a voice budget (VOICES): past it, new sounds are dropped rather than stacked.
// A punch impact briefly ducks destruction and fire, and big destruction ducks the music.
const browser = typeof window !== 'undefined';
const AudioCtx = browser && (window.AudioContext || window.webkitAudioContext);

const VOLUME = 0.7;
const MUTE_KEY = 'tiny-hero-muted';
const MUSIC_VOLUME_KEY = 'tiny-hero-music-volume';
const SFX_VOLUME_KEY = 'tiny-hero-sfx-volume';
const clampVolume = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
// Bus levels: the hero's own sounds lead, enemy fire sits under them.
const LEVELS = Object.freeze({ music: 0.22, punch: 1, laser: 1, ram: 1, fire: 0.5, destruction: 1.8 });
// How many sounds of a family may ring at once.
const VOICES = Object.freeze({ punch: 4, ram: 2, fire: 3, destruction: 4 });
// Recorded music (public/audio, Flow Music tracks trimmed and loudness-matched to -16 LUFS), played in
// turn with a CROSSFADE s overlap. TRACK_LEVEL is relative to the music bus.
const TRACKS = Object.freeze({
  music: ['music-1.mp3', 'music-2.mp3'],
  boss: ['boss-1.mp3', 'boss-2.mp3'],
});
const TRACK_LEVEL = 3;
const CROSSFADE = 4;
// Building carves and collapses (hit, crash), relative to the rest of the destruction bus.
const BUILDING = 0.25;
// Boss track tempo: one bar of four beats.
const BOSS_BAR = 60 / 138 * 4;

class Sound {
  constructor() {
    this.ctx = null;
    this.last = {};
    this.voices = {};
    this.muted = false;
    this.musicVolume = 1;
    this.sfxVolume = 1;
    this.musicDucked = false;
    this.musicMenu = false;
    if (!browser) return;
    try { this.muted = Boolean(localStorage.getItem(MUTE_KEY)); } catch {}
    try {
      const music = localStorage.getItem(MUSIC_VOLUME_KEY);
      const sfx = localStorage.getItem(SFX_VOLUME_KEY);
      if (music !== null) this.musicVolume = clampVolume(Number(music));
      if (sfx !== null) this.sfxVolume = clampVolume(Number(sfx));
    } catch {}
    // The first input starts audio. Every later tap or key also resumes a context the browser
    // suspended (iOS after a call or the app switcher): resume only works inside a user gesture.
    const unlock = () => this.resumeAudio();
    for (const type of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(type, unlock);
    window.addEventListener('gamepadconnected', unlock, { once: true });
  }

  resumeAudio() {
    if (document.hidden) return;
    this.start();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') this.ctx.resume().catch(() => {});
    // A browser may pause a media element independently of its AudioContext.
    // Retry active music inside the input gesture as well, without rewinding it.
    for (const list of [this.musicList, this.bossList]) {
      if (list?.voice) this.playVoice(list, list.voice);
    }
  }

  // Silences everything (the dev panel's mute). Remembered across reloads.
  setMuted(on) {
    this.muted = on;
    try { localStorage.setItem(MUTE_KEY, on ? '1' : ''); } catch {}
    this.applyVolume();
  }

  setMusicVolume(value) {
    this.musicVolume = clampVolume(value);
    try { localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume)); } catch {}
    this.applyMixVolumes();
  }

  setSfxVolume(value) {
    this.sfxVolume = clampVolume(value);
    try { localStorage.setItem(SFX_VOLUME_KEY, String(this.sfxVolume)); } catch {}
    this.applyMixVolumes();
  }

  applyMixVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [node, value] of [[this.musicOutput, this.musicVolume * (this.musicDucked ? 0.4 : 1)],
      [this.sfxOutput, this.sfxVolume]]) {
      if (!node) continue;
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(value, t, 0.08);
    }
  }

  // Critical health and death push only the music into the distance, like being under water.
  // Independent of underwater(): surfacing cannot clear the health effect, or vice versa.
  setMusicDucked(on) {
    if (this.musicDucked === on) return;
    this.musicDucked = on;
    this.applyMusicTone();
    this.applyMixVolumes();
  }

  // Menus (pause, level map) muffle only the music, with the same low-pass as under water.
  setMusicMenu(on) {
    if (this.musicMenu === on) return;
    this.musicMenu = on;
    this.applyMusicTone();
  }

  applyMusicTone() {
    if (!this.musicMuffle) return;
    const t = this.ctx.currentTime;
    this.musicMuffle.frequency.cancelScheduledValues(t);
    const muffled = this.musicDucked || this.musicMenu;
    this.musicMuffle.frequency.setTargetAtTime(muffled ? 450 : 20000, t, muffled ? 0.04 : 0.12);
  }

  // Silent while a video ad plays.
  setAdMuted(on) {
    this.adMuted = on;
    this.applyVolume();
  }

  applyVolume() {
    if (this.master) this.master.gain.value = this.muted || this.adMuted ? 0 : VOLUME;
  }

  start() {
    if (this.ctx || !AudioCtx) return;
    const ctx = this.ctx = new AudioCtx();
    this.master = ctx.createGain();
    this.applyVolume();
    // Limiter: stacked collapses would otherwise clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 12;
    // Everything passes a low-pass that closes while the hero is under water (underwater()).
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = this.under ? 450 : 20000;
    this.master.connect(this.muffle).connect(limiter).connect(ctx.destination);
    this.musicOutput = ctx.createGain();
    this.sfxOutput = ctx.createGain();
    this.musicMuffle = ctx.createBiquadFilter();
    this.musicMuffle.type = 'lowpass';
    this.musicMuffle.frequency.value = this.musicDucked || this.musicMenu ? 450 : 20000;
    this.musicOutput.gain.value = this.musicVolume * (this.musicDucked ? 0.4 : 1);
    this.sfxOutput.gain.value = this.sfxVolume;
    this.musicOutput.connect(this.musicMuffle).connect(this.master);
    this.sfxOutput.connect(this.master);
    this.bus = {};
    for (const [name, level] of Object.entries(LEVELS)) {
      const g = this.bus[name] = ctx.createGain();
      g.gain.value = level;
      g.connect(name === 'music' ? this.musicOutput : this.sfxOutput);
    }
    this.dest = this.bus.destruction;
    const seconds = 6;
    this.noise = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.startMusic();
    this.startLaser();
    this.startRam();
  }

  // Claims a voice in `family` for `length` s, and points sub()/burst() at its bus. False when the
  // family is at its budget, or the last sound of this `key` was under `gap` s ago.
  open(family, length, key = family, gap = 0) {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    if (now - (this.last[key] ?? -1) < gap) return false;
    const ringing = this.voices[family] ??= [];
    // Prune finished voices in place: this runs for every gunshot and punch.
    for (let i = ringing.length - 1; i >= 0; i--) if (ringing[i] <= now) ringing.splice(i, 1);
    if (ringing.length >= (VOICES[family] ?? Infinity)) return false;
    ringing.push(now + length);
    this.last[key] = now;
    this.dest = this.bus[family];
    return true;
  }

  // Dips a bus to `depth` of its level, recovering over `time` s.
  duck(name, depth, time) {
    const g = this.bus[name].gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.min(g.value, LEVELS[name] * depth), t);
    g.setTargetAtTime(LEVELS[name], t + 0.02, time / 3);
  }

  noiseSource(loop = false) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = loop;
    return source;
  }

  // Bars are scheduled on the audio clock up to two bars ahead; the timer only tops the queue up,
  // so a late or throttled timer (busy frame, backgrounded window) never leaves a gap.
  schedule(bar, playBar, running = () => true) {
    let next = this.ctx.currentTime + 0.05;
    const play = () => {
      if (!this.ctx || !running()) return;
      if (next < this.ctx.currentTime) next = this.ctx.currentTime + 0.05; // Fell behind: restart, don't burst.
      while (next < this.ctx.currentTime + bar * 2) {
        playBar(next);
        next += bar;
      }
      setTimeout(play, bar * 500);
    };
    play();
  }

  // Background and boss music buses; bossMusic() crossfades between them.
  startMusic() {
    const { ctx } = this;
    this.ambient = ctx.createGain();
    this.bossTrack = ctx.createGain();
    this.bossTrack.gain.value = 0;
    this.bossTrack.connect(this.bus.music);
    this.ambient.connect(this.bus.music);
    // Recorded tracks stream from <audio>; if one fails to load, the synth music plays instead.
    this.musicList = this.playlist(TRACKS.music, this.ambient, () => this.startSynthMusic());
    this.bossList = this.playlist(TRACKS.boss, this.bossTrack, () => {});
    this.advance(this.musicList, 2);
    // Pause in the background, resuming where the music left off.
    document.addEventListener('visibilitychange', () => this.setHidden(document.hidden));
  }

  setHidden(hidden) {
    if (!this.ctx) return;
    if (!hidden) {
      this.resumeAudio();
      return;
    }
    this.ctx.suspend().catch(() => {});
    for (const list of [this.musicList, this.bossList]) {
      list?.voice?.el.pause();
    }
  }

  playVoice(list, player) {
    const { el } = player;
    if (document.hidden || list.failed || list.voice !== player || player.pending || !el.paused) return;
    player.pending = true;
    el.play().then(() => {
      // A delayed play may finish after the track was stopped or the tab hidden.
      if (list.voice !== player || document.hidden) el.pause();
    }).catch(() => {
      player.retryAt = Date.now() + 1000;
    }).finally(() => { player.pending = false; });
  }

  // Fallback dark ambient: a low drone, a slow minor pad and a sparse bell, through a feedback delay.
  startSynthMusic() {
    const { ctx } = this;
    const bus = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.45;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 1400;
    bus.connect(dark).connect(this.ambient);
    bus.connect(delay).connect(feedback).connect(delay);
    feedback.connect(dark);

    for (const [freq, type, level] of [[36.71, 'sawtooth', 0.35], [36.9, 'sawtooth', 0.35], [73.42, 'triangle', 0.3]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq; // D1/D2 drone, slightly detuned
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(lp).connect(g).connect(bus);
      osc.start();
    }

    // D minor, B♭, G minor, A: four slow chords.
    const chords = [[146.83, 174.61, 220], [116.54, 146.83, 174.61], [98, 116.54, 146.83], [110, 138.59, 164.81]];
    const bells = [587.33, 698.46, 880, 523.25, 466.16, 659.25];
    const bar = 6;
    let step = 0;
    this.schedule(bar, t => {
      for (const freq of chords[step % chords.length]) {
        for (const detune of [-6, 6]) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          osc.detune.value = detune;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 600;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.05, t + 2);
          g.gain.linearRampToValueAtTime(0, t + bar + 1);
          osc.connect(lp).connect(g).connect(bus);
          osc.start(t);
          osc.stop(t + bar + 1.1);
        }
      }
      if (Math.random() < 0.7) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = bells[Math.floor(Math.random() * bells.length)];
        const g = ctx.createGain();
        const at = t + Math.random() * 3;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.08, at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0005, at + 3);
        osc.connect(g).connect(bus);
        osc.start(at);
        osc.stop(at + 3.1);
      }
      step++;
    });
  }

  // Boss fight on/off: the ambient fades out and a driving track in the same key fades in, and back.
  bossMusic(on) {
    if (!this.ctx || this.boss === on) return;
    this.boss = on;
    const t = this.ctx.currentTime;
    this.ambient.gain.setTargetAtTime(on ? 0 : 1, t, on ? 0.4 : 1.2);
    this.bossTrack.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.3 : 1.2);
    if (!this.bossList.failed) {
      // Each fight starts the next boss track from the top; the fight's end fades it out.
      if (on) this.advance(this.bossList, 0.3);
      else this.stopList(this.bossList, 2.5);
    } else if (on && !this.bossPlaying) this.startBossTrack();
  }

  // A playlist on `out`: two <audio> players that take turns, so one can fade in while the other
  // fades out. Streaming keeps no decoded copy in memory. Both are made (and unlocked by a muted
  // play) inside the first input gesture, so mobile browsers let them play later.
  // `fallback` runs once if a track fails to load, and the list is marked failed.
  playlist(urls, out, fallback) {
    const list = { urls, out, index: 0, voice: null, timer: 0, failed: false };
    list.players = [0, 1].map(i => {
      const el = new Audio();
      el.preload = 'auto';
      el.src = urls[i % urls.length];
      // The unlock: silent, as the player's gain is 0. advance() keeps the one it picks playing.
      el.play().then(() => { if (list.voice?.el !== el) el.pause(); }).catch(() => {});
      const g = this.ctx.createGain();
      g.gain.value = 0;
      this.ctx.createMediaElementSource(el).connect(g).connect(out);
      // Safety net: a track that ends without having crossfaded (a stalled timer) moves on.
      el.addEventListener('ended', () => { if (list.voice?.el === el) this.advance(list, 0.5); });
      el.addEventListener('error', () => {
        if (!el.getAttribute('src') || list.failed) return;
        list.failed = true;
        this.stopList(list, 0.1);
        fallback();
      });
      return { el, g };
    });
    return list;
  }

  // Starts the playlist's next track from the top, fading it in over `fade` s while the current
  // one fades out. A 250 ms check starts the crossfade into the one after, CROSSFADE s before the end.
  advance(list, fade = CROSSFADE) {
    if (list.failed) return;
    const url = list.urls[list.index++ % list.urls.length];
    this.fadeOut(list, fade);
    const player = list.players.find(p => p !== list.last) ?? list.players[0];
    list.last = list.voice = player;
    const { el, g } = player;
    clearTimeout(player.stop);
    if (!el.src.endsWith(url)) el.src = url;
    el.currentTime = 0;
    this.playVoice(list, player);
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(TRACK_LEVEL, t + fade);
    clearInterval(list.timer);
    list.timer = setInterval(() => {
      if (document.hidden || this.ctx.state !== 'running') return;
      if (el.paused && !el.ended) {
        if (Date.now() >= (player.retryAt ?? 0)) this.playVoice(list, player);
        return;
      }
      if (el.ended) { this.advance(list, 0.5); return; }
      if (el.duration && !el.paused && el.currentTime >= el.duration - CROSSFADE) this.advance(list);
    }, 250);
  }

  stopList(list, fade) {
    clearInterval(list.timer);
    this.fadeOut(list, fade);
  }

  fadeOut(list, fade) {
    if (!list.voice) return;
    const { el, g } = list.voice;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
    g.gain.linearRampToValueAtTime(0, t + fade);
    list.voice.stop = setTimeout(() => el.pause(), fade * 1000 + 100);
    list.voice = null;
  }

  // 138 bpm in D minor: kick on the beat, an offbeat hat, a pulsing eighth-note bass and a
  // tense minor arpeggio over it. Scheduled only while the boss is up (and its fade-out).
  startBossTrack() {
    const { ctx } = this;
    const out = this.bossTrack;
    const beat = BOSS_BAR / 4;
    const roots = [73.42, 73.42, 58.27, 55]; // D, D, B♭, A
    const arps = [[293.66, 349.23, 440, 349.23], [293.66, 349.23, 440, 523.25],
      [233.08, 293.66, 349.23, 293.66], [220, 277.18, 329.63, 277.18]];
    let step = 0;
    this.bossPlaying = true;
    this.schedule(BOSS_BAR, t => {
      const bar = step++ % 4;
      for (let i = 0; i < 8; i++) {
        const at = t + i * beat / 2;
        // Bass: a plucked, filtered saw on every eighth.
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = roots[bar] * (i % 4 === 3 ? 2 : 1);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, at);
        lp.frequency.exponentialRampToValueAtTime(160, at + beat * 0.45);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.13, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + beat * 0.48);
        osc.connect(lp).connect(g).connect(out);
        osc.start(at);
        osc.stop(at + beat * 0.5);
        // Arpeggio: a soft square, one note per eighth.
        const lead = ctx.createOscillator();
        lead.type = 'square';
        lead.frequency.value = arps[bar][i % 4] * (step % 8 >= 4 ? 2 : 1);
        const lf = ctx.createBiquadFilter();
        lf.type = 'lowpass';
        lf.frequency.value = 1600;
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0.022, at);
        lg.gain.exponentialRampToValueAtTime(0.001, at + beat * 0.4);
        lead.connect(lf).connect(lg).connect(out);
        lead.start(at);
        lead.stop(at + beat * 0.45);
        // Hat on the offbeats.
        if (i % 2) this.layer(out, 'noise', 7000, 0.04, 0.035, 'highpass', at);
      }
      // Kick on every beat, snare on 2 and 4.
      for (let i = 0; i < 4; i++) {
        this.layer(out, 'sine', 130, 0.22, 0.5, 42, t + i * beat);
        if (i % 2) this.layer(out, 'noise', 1800, 0.14, 0.12, 'bandpass', t + i * beat);
      }
    }, () => {
      if (this.boss || this.bossTrack.gain.value > 0.01) return true;
      this.bossPlaying = false;
      return false;
    });
  }

  // One music hit straight onto `out`: a sine sliding from `freq` to `to` Hz (a kick), or a filtered
  // noise of `to` type. Used only by the boss track, which bypasses the voice budgets.
  layer(out, kind, freq, length, level, to, at) {
    const { ctx } = this;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + length);
    g.connect(out);
    if (kind === 'sine') {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.6);
      osc.connect(g);
      osc.start(at);
      osc.stop(at + length + 0.02);
      return;
    }
    const src = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = to;
    f.frequency.value = freq;
    src.connect(f).connect(g);
    src.start(at, Math.random() * 0.5, length + 0.02);
  }

  // The beam is one continuous voice whose gain follows the trigger: a soft high tone
  // chopped ~90 times a second into a "bzz", filtered gently so it never gets shrill.
  startLaser() {
    const { ctx } = this;
    this.laserGain = ctx.createGain();
    this.laserGain.gain.value = 0;
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const rate = ctx.createOscillator();
    rate.type = 'triangle';
    rate.frequency.value = 90;
    this.laserRate = rate;
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    rate.connect(depth).connect(chop.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 0.5;
    this.laserFilter = lp;
    this.laserHeatLevel = 0;
    const tones = [];
    for (const [freq, type] of [[1100, 'triangle'], [1104, 'sawtooth']]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = type === 'sawtooth' ? 0.25 : 0.7;
      osc.connect(g).connect(chop);
      tones.push(osc);
    }
    chop.connect(lp).connect(this.laserGain).connect(this.bus.laser);
    for (const osc of [rate, ...tones]) osc.start();
    this.laserOn = false;
  }

  laser(active) {
    if (!this.ctx || active === this.laserOn) return;
    this.laserOn = active;
    const t = this.ctx.currentTime;
    const g = this.laserGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(active ? 0.048 : 0, t, active ? 0.01 : 0.05);
    if (active) this.zap();
  }

  // Laser focus (0..1): the hum chops faster and brightens as one beam builds damage.
  laserHeat(heat) {
    if (!this.ctx || Math.abs(heat - this.laserHeatLevel) < 0.02) return;
    this.laserHeatLevel = heat;
    const t = this.ctx.currentTime;
    this.laserRate.frequency.setTargetAtTime(90 + heat * 70, t, 0.03);
    this.laserFilter.frequency.setTargetAtTime(2600 + heat * 2000, t, 0.03);
  }

  zap() {
    const { ctx } = this;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g).connect(this.bus.laser);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // RAM is one continuous voice: looped noise through a band-pass, a rushing wind whose pitch and
  // level follow speed (0..1), under a low sub hum. Off, it fades in a beat.
  startRam() {
    const { ctx } = this;
    this.ramGain = ctx.createGain();
    this.ramGain.gain.value = 0;
    const wind = this.noiseSource(true);
    this.ramFilter = ctx.createBiquadFilter();
    this.ramFilter.type = 'bandpass';
    this.ramFilter.frequency.value = 500;
    this.ramFilter.Q.value = 1.2;
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 55;
    this.ramHum = hum;
    const humLp = ctx.createBiquadFilter();
    humLp.type = 'lowpass';
    humLp.frequency.value = 160;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.5;
    wind.connect(this.ramFilter).connect(this.ramGain);
    hum.connect(humLp).connect(humGain).connect(this.ramGain);
    this.ramGain.connect(this.bus.ram);
    wind.start();
    hum.start();
    this.ramOn = false;
    this.ramSpeed = 0;
  }

  ram(active, speed = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (active !== this.ramOn) {
      this.ramOn = active;
      this.ramGain.gain.cancelScheduledValues(t);
      this.ramGain.gain.setTargetAtTime(active ? 0.035 : 0, t, active ? 0.15 : 0.12);
      // Kicking off: a soft rising whoomph, at most once every 2 s.
      if (active && this.open('ram', 0.35, 'whoomph', 2)) {
        this.sub(70, 160, 0.1, 0.3, 0.05);
        this.burst(700, 0.3, 0.035, 'bandpass', t, 0.08);
      }
    }
    if (!active || Math.abs(speed - this.ramSpeed) < 0.03) return;
    this.ramSpeed = speed;
    this.ramFilter.frequency.setTargetAtTime(450 + speed * 900, t, 0.08);
    this.ramHum.frequency.setTargetAtTime(50 + speed * 25, t, 0.08);
  }

  // RAM striking a body: heavier and lower than a punch, so it reads as the whole hero hitting.
  ramHit() {
    if (!this.open('ram', 0.4, 'ramHit', 0.06)) return;
    this.sub(110, 34, 0.6, 0.38, 0.003, 0.03);
    this.burst(700, 0.09, 0.2, 'highpass');
    this.burst(260, 0.25, 0.22, 'lowpass');
    this.duck('destruction', 0.8, 0.25);
    this.duck('fire', 0.5, 0.25);
  }

  punchSwing() {
    if (!this.open('punch', 0.09, 'swing', 0.03)) return;
    this.burst(650, 0.085, 0.065, 'highpass', this.ctx.currentTime, 0.008);
  }

  punchImpact() {
    if (!this.open('punch', 0.2, 'impact', 0.03)) return;
    // A sharp crack and short body thud, distinct from a building's long rumble.
    this.sub(145, 52, 0.48, 0.19, 0.004, 0.012);
    this.burst(1100, 0.065, 0.16, 'highpass');
    this.burst(360, 0.12, 0.18, 'lowpass');
    // The punch rhythm stays readable through any chaos.
    this.duck('destruction', 0.8, 0.18);
    this.duck('fire', 0.55, 0.18);
  }

  // Grab and throw (enemy-throw.js): a clamp and a heave.
  grab() {
    if (!this.open('punch', 0.14, 'grab')) return;
    this.sub(180, 110, 0.3, 0.1, 0.003);
    this.burst(1400, 0.08, 0.14, 'bandpass');
  }

  hurl() {
    if (!this.open('punch', 0.22, 'hurl')) return;
    this.burst(900, 0.22, 0.16, 'bandpass', this.ctx.currentTime, 0.04);
    this.sub(90, 240, 0.12, 0.18, 0.02);
  }

  // A brighter arpeggio: a new grab tier unlocked.
  unlock() {
    if (!this.ctx) return;
    this.tones([523, 659, 784, 1047], 0.07, 0.3, 0.06, this.bus.punch);
  }

  // A Villainium gem collected: a bright two-note chime.
  gem() {
    if (!this.ctx) return;
    this.tones([1319, 1976], 0.05, 0.14, 0.035, this.bus.punch);
  }

  // A missile lock: a short run of beeps, the warning before the launch.
  lockTone() {
    if (!this.open('fire', 1.1, 'lock', 1)) return;
    this.tones([1400, 1400, 1400, 1400], 0.25, 0.12, 0.04, this.bus.fire);
  }

  tones(freqs, gap, length, level, out) {
    const { ctx } = this;
    freqs.forEach((freq, i) => {
      const t = ctx.currentTime + i * gap;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + length);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + length + 0.05);
    });
  }

  // Enemy gunfire: a dry crack, with more body for rifles and heavier guns.
  gunshot(heavy = false) {
    if (!this.open('fire', 0.12, 'gun', 0.035)) return;
    this.burst(2600 + Math.random() * 600, 0.05, heavy ? 0.16 : 0.11, 'highpass');
    this.burst(heavy ? 300 : 520, heavy ? 0.12 : 0.07, heavy ? 0.22 : 0.12, 'lowpass');
  }

  // Ordnance leaving the launcher. 'shell': a cannon's deep boom; anything else (rocket, missile,
  // grenade): a rising hiss of a motor lighting.
  launch(kind) {
    if (kind === 'shell') {
      if (!this.open('fire', 0.6, 'cannon', 0.12)) return;
      this.sub(90, 32, 0.55, 0.55, 0.003, 0.04);
      this.burst(500, 0.4, 0.22, 'lowpass');
      this.burst(2200, 0.06, 0.1, 'highpass');
      return;
    }
    if (!this.open('fire', 0.45, 'rocket', 0.08)) return;
    const t = this.ctx.currentTime;
    this.burst(1200, 0.45, 0.14, 'bandpass', t, 0.06, 0.08);
    this.sub(140, 70, 0.14, 0.2, 0.004);
  }

  // power: 0..~1.4, the blast's strength (chained blasts are weaker).
  blast(power = 1) {
    if (!this.open('destruction', 0.5 + power * 0.6, 'blast', 0.04)) return;
    const now = this.ctx.currentTime;
    this.sub(140, 30, 0.45 + power * 0.35, 0.5 + power * 0.4, 0.004, 0.04);
    this.burst(2400, 0.5 + power * 0.6, 0.3 + power * 0.2, 'lowpass', now, 0, 0.05);
    this.burst(4000, 0.08, 0.16, 'highpass');
    if (power >= 0.6) this.duck('music', 0.45, 1);
  }

  // Deep thud for a carve: held briefly before it decays so the first blow lands. size: 0..1.
  hit(kind, size = 0.5) {
    if (kind === 'laser') {
      if (!this.open('destruction', 0.15, 'hit', 0.09)) return;
      this.burst(1800, 0.06 + size * 0.1, (0.08 + size * 0.06) * 1.5 * BUILDING, 'highpass');
      return;
    }
    const length = 0.9 + size * 1.4;
    if (!this.open('destruction', length * 0.5, 'hit', 0.05)) return;
    const now = this.ctx.currentTime;
    const hold = 0.15 + size * 0.25;
    const v = BUILDING;
    this.sub(90, 50, (0.25 + size * 0.2) * v, length * 0.7, 0.02, hold);
    // Mid-bass layer, so laptop and Deck speakers still hear the hit.
    this.sub(160, 90, 0.3 * v, length * 0.5, 0.015, hold * 0.5);
    this.burst(550 + Math.random() * 150, length, (0.35 + size * 0.35) * 1.4 * v, 'lowpass', now, 0.03, hold);
  }

  // Hero contact: a dry crack, a fast bass drop and a short grit tail, distinct from a collapse.
  groundPound(power = 1) {
    if (!this.open('punch', 0.4, 'pound', 0.08)) return;
    const t = this.ctx.currentTime;
    const weight = 0.5 + Math.max(0, Math.min(1, power)) * 0.5;
    this.sub(125, 38, 0.6 * weight, 0.32, 0.003);
    this.sub(190, 80, 0.22 * weight, 0.13, 0.002);
    this.burst(1900, 0.055, 0.27 * weight, 'lowpass', t);
    this.burst(520, 0.38, 0.2 * weight, 'bandpass', t + 0.015, 0.015);
    for (let i = 0; i < 3; i++) this.burst(800 + i * 230, 0.07,
      0.045 * weight, 'highpass', t + 0.07 + i * 0.045, 0.002);
  }

  // Building piece hitting the ground: a swelling sub-bass rumble with a low debris tail. size: 0..1.
  crash(size = 0.5) {
    const length = 1 + size * 3;
    if (!this.open('destruction', length * 0.5, 'crash', 0.06)) return;
    const t = this.ctx.currentTime;
    const hold = 0.2 + size * 0.6;
    const v = BUILDING;
    this.sub(70, 40, 0.3 * (0.4 + size) * v, length * 0.8, 0.12, hold);
    this.burst(420, length, (0.35 + size * 0.4) * 1.3 * v, 'lowpass', t, 0.15, hold);
    // Rubble tumbling: the crunchy mid layer that sells a collapse.
    for (let i = 0; i < 4 + size * 12; i++) {
      const at = t + 0.1 + Math.random() * (0.4 + size * 3);
      this.burst(500 + Math.random() * 900, 0.12, (0.05 + Math.random() * 0.06) * 1.8 * v, 'lowpass', at, 0.02);
    }
    if (size >= 0.5) this.duck('music', 0.5, length);
  }

  // A car body folding under a falling slab: a metallic crunch over a dull thud. size: 0..1.
  crunch(size = 0.5) {
    if (!this.open('destruction', 0.4, 'crunch', 0.08)) return;
    const t = this.ctx.currentTime;
    this.burst(1700, 0.25 + size * 0.2, 0.18 + size * 0.1, 'bandpass', t, 0, 0.04);
    this.burst(650, 0.35, 0.15, 'bandpass', t + 0.03, 0, 0.05);
    this.sub(110, 40, 0.45, 0.4, 0.005, 0.05);
  }

  // Something heavy hitting water: a hollow thump and a hiss of spray. size: 0..1.
  splash(size = 0.5) {
    if (!this.open('destruction', 0.5 + size * 0.5, 'splash', 0.08)) return;
    const t = this.ctx.currentTime;
    this.sub(120 - size * 50, 40, 0.35 + size * 0.45, 0.5 + size * 0.9, 0.01, 0.05 + size * 0.1);
    this.burst(900 - size * 300, 0.6 + size * 0.8, 0.25 + size * 0.25, 'bandpass', t, 0.01, 0.05);
    this.burst(2600, 0.3 + size * 0.5, 0.08 + size * 0.08, 'highpass', t + 0.05, 0.03);
  }

  // Under water the whole mix goes dull and muffled (QA-12); surfacing opens it again.
  underwater(on) {
    if (this.under === on) return;
    this.under = on;
    if (!this.ctx || !this.muffle) return;
    const f = this.muffle.frequency;
    f.cancelScheduledValues(this.ctx.currentTime);
    f.setTargetAtTime(on ? 450 : 20000, this.ctx.currentTime, on ? 0.04 : 0.12);
  }

  // Sine sliding down from `from` to `to` Hz: swells in over `attack`, holds, then decays.
  sub(from, to, level, length, attack, hold = 0) {
    const { ctx } = this;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + length * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.setValueAtTime(level, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(length, attack + hold + 0.1));
    osc.connect(g).connect(this.dest);
    osc.start(t);
    osc.stop(t + Math.max(length, attack + hold + 0.1) + 0.05);
  }

  burst(freq, length, level, type, at = this.ctx.currentTime, attack = 0, hold = 0) {
    const { ctx } = this;
    const src = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    const end = at + Math.max(length, attack + hold + 0.05);
    g.gain.setValueAtTime(attack ? 0.0001 : level, at);
    if (attack) g.gain.linearRampToValueAtTime(level, at + attack);
    if (hold) g.gain.setValueAtTime(level, at + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.001, end);
    src.connect(f).connect(g).connect(this.dest);
    src.start(at, Math.random() * 0.5, end - at + 0.05);
  }
}

export const sound = new Sound();
