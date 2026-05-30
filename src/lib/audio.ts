/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Sound sources & nodes
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;

  private staticNoiseNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private staticGain: GainNode | null = null;
  private staticFilter: BiquadFilterNode | null = null;

  private heartbeatTimer: any = null;
  private heartbeatInterval = 1200; // ms
  private currentFear = 0;

  // OST playback fields
  private ostTimer: any = null;
  private ostIndex = 0;
  private ostMelody = [
    196.00, 164.81, 196.00, 196.00, 164.81, 196.00, // I love you, you love me
    220.00, 196.00, 174.61, 164.81, 146.83, 164.81, 174.61, // we're a happy family
    164.81, 174.61, 196.00, 261.63, 261.63, // with a great big hug
    261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 293.66, // and a kiss from me to you
    196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 261.63  // won't you say you love me too
  ];

  // Status flags
  private isInitialized = false;
  private isMuted = false;

  constructor() {}

  public async init() {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.15, this.ctx.currentTime); // Keep master volume slightly low to prevent ear damage
      this.masterGain.connect(this.ctx.destination);

      // 1. Setup Drone (Low detuned rumble)
      this.setupDrone();

      // 2. Setup Analog Static Noise
      this.setupTapeStatic();

      // 3. Start Heartbeat Loop
      this.startHeartbeatLoop();

      // 4. Start Sad Satan OST Loop
      this.startOSTLoop();

      this.isInitialized = true;
      console.log('Procedural horror audio engine initialized.');
    } catch (e) {
      console.error('Failed to initialize Web Audio engine:', e);
    }
  }

  private setupDrone() {
    if (!this.ctx || !this.masterGain) return;

    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneGain = this.ctx.createGain();

    // Detuned lower triangle wave
    this.droneOsc1.type = 'triangle';
    this.droneOsc1.frequency.setValueAtTime(53.0, this.ctx.currentTime); // G#1 detuned

    this.droneOsc2.type = 'sawtooth';
    this.droneOsc2.frequency.setValueAtTime(54.2, this.ctx.currentTime);

    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.setValueAtTime(95, this.ctx.currentTime);
    this.droneFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.droneGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    // Connect
    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.droneOsc1.start();
    this.droneOsc2.start();

    // Drone LFO filter modulation to create "breathing" sweep
    this.modulateDroneFilter();
  }

  private modulateDroneFilter() {
    if (!this.ctx || !this.droneFilter) return;

    // Use Web Audio oscillators as LFO to sweep filter frequency
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // Very slow rise/fall ~8 seconds
    lfoGain.gain.setValueAtTime(25.0, this.ctx.currentTime); // +/- 25Hz modulation

    lfo.connect(lfoGain);
    lfoGain.connect(this.droneFilter.frequency);
    lfo.start();
  }

  private setupTapeStatic() {
    if (!this.ctx || !this.masterGain) return;

    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    this.staticFilter = this.ctx.createBiquadFilter();
    this.staticFilter.type = 'bandpass';
    this.staticFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
    this.staticFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    // Create a noise buffer (white noise)
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    whiteNoise.connect(this.staticFilter);
    this.staticFilter.connect(this.staticGain);
    this.staticGain.connect(this.masterGain);

    whiteNoise.start();

    // Modulate static sweeps
    const sweepLFO = this.ctx.createOscillator();
    const sweepLFOGain = this.ctx.createGain();
    sweepLFO.frequency.setValueAtTime(0.08, this.ctx.currentTime); // 12.5 seconds block
    sweepLFOGain.gain.setValueAtTime(300.0, this.ctx.currentTime);

    sweepLFO.connect(sweepLFOGain);
    sweepLFOGain.connect(this.staticFilter.frequency);
    sweepLFO.start();
  }

  private startHeartbeatLoop() {
    const playHeartbeat = () => {
      if (!this.isInitialized || this.isMuted || !this.ctx || !this.masterGain) {
        this.heartbeatTimer = setTimeout(playHeartbeat, this.heartbeatInterval);
        return;
      }

      this.triggerSingleBeat();

      // Adjust interval dynamically based on fear setting (max fear = faster heartbeat)
      this.heartbeatInterval = Math.max(380, 1100 - (this.currentFear * 700));
      this.heartbeatTimer = setTimeout(playHeartbeat, this.heartbeatInterval);
    };

    playHeartbeat();
  }

  private triggerSingleBeat() {
    if (!this.ctx || !this.masterGain) return;

    // Heartbeat is modeled as two successive low pitch thuds (lub-dub)
    const playThump = (timeOffset: number, volume: number) => {
      if (!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime + timeOffset;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, t);
      osc.frequency.exponentialRampToValueAtTime(10, t + 0.18);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(70, t);

      gain.gain.setValueAtTime(0.0, t);
      gain.gain.linearRampToValueAtTime(volume * 0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.25);
    };

    // "lub-dub": two thumps spaced ~150ms apart
    const fearScale = 1.0 + (this.currentFear * 0.8);
    playThump(0, 0.4 * fearScale);
    playThump(0.14, 0.25 * fearScale);
  }

  public updateState(moving: boolean, fear: number) {
    if (!this.isInitialized || !this.ctx) return;
    this.currentFear = Math.min(Math.max(fear, 0), 1);

    // Resume context if browser suspended it (can happen randomly or after wake-up)
    if (this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch (e) {}
    }

    if (this.droneGain && this.droneFilter) {
      // Fear increases background drone filter cutoff and noise gain
      const baseFreq = 95 + (this.currentFear * 140);
      const droneVol = 0.4 + (this.currentFear * 0.3);
      this.droneFilter.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      this.droneGain.gain.setValueAtTime(droneVol, this.ctx.currentTime);
    }

    if (this.staticGain) {
      // Static becomes louder and sharper at high fear/glitch levels
      const staticVol = 0.04 + (this.currentFear * 0.15);
      this.staticGain.gain.setValueAtTime(staticVol, this.ctx.currentTime);
    }
  }

  public triggerFootstep() {
    if (!this.isInitialized || this.isMuted || !this.ctx || !this.masterGain) return;

    // A low dry echoing bump sound simulating leather soles on decaying floors
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    // Create simple feedback delay to simulate echoey hallway
    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.25, t); // 250ms echo delay

    const delayGain = this.ctx.createGain();
    delayGain.gain.setValueAtTime(0.35, t); // fading echo

    // Connect feedback path
    delay.connect(delayGain);
    delayGain.connect(delay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // Also route footstep to dynamic echo
    gain.connect(delay);
    delayGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  public triggerScreech() {
    if (!this.isInitialized || this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // Create an intense, screeching analogue static alarm scream
    const modOsc = this.ctx.createOscillator();
    const carrierOsc = this.ctx.createOscillator();
    const delay = this.ctx.createDelay();
    const delayGain = this.ctx.createGain();
    const modGain = this.ctx.createGain();
    const mainGain = this.ctx.createGain();
    const highpass = this.ctx.createBiquadFilter();

    modOsc.type = 'square';
    modOsc.frequency.setValueAtTime(1400 + Math.random() * 500, t);
    modOsc.frequency.linearRampToValueAtTime(150 + Math.random() * 80, t + 1.2);

    carrierOsc.type = 'sawtooth';
    carrierOsc.frequency.setValueAtTime(320, t);
    carrierOsc.frequency.exponentialRampToValueAtTime(45, t + 1.2);

    modGain.gain.setValueAtTime(600, t);

    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(250, t);

    mainGain.gain.setValueAtTime(0.0, t);
    mainGain.gain.linearRampToValueAtTime(0.55, t + 0.05);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

    delay.delayTime.setValueAtTime(0.05, t);
    delayGain.gain.setValueAtTime(0.8, t); // extreme ring modulation decay

    // FM connection: modOsc -> modGain -> carrierOsc frequency
    modOsc.connect(modGain);
    modGain.connect(carrierOsc.frequency);

    carrierOsc.connect(highpass);
    highpass.connect(mainGain);
    mainGain.connect(this.masterGain);

    // Connect to echo feedback for scary mechanical glitch reverb
    mainGain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(delay);
    delayGain.connect(this.masterGain);

    modOsc.start(t);
    carrierOsc.start(t);

    modOsc.stop(t + 1.5);
    carrierOsc.stop(t + 1.5);

    // Pink noise explosion simultaneously
    const bufferSize = this.ctx.sampleRate * 1.5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Amplify pink noise
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    noiseNode.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseNode.start(t);
    noiseNode.stop(t + 1.4);
  }

  public triggerWhisper() {
    if (!this.isInitialized || this.isMuted || !this.ctx || !this.masterGain) return;

    // Vocalized formant synthesis whispers. Done by routing white noise through 
    // highly resonant bandpass filters sweeping to mimic mouth syllables (e.g. "shhh", "sh-ah-oo")
    const t = this.ctx.currentTime;
    const duration = 1.0 + Math.random() * 1.5;

    // Formant filter parameters (rough approximations of vowels)
    // F1, F2, F3 bandpasses
    const filter1 = this.ctx.createBiquadFilter();
    const filter2 = this.ctx.createBiquadFilter();
    const filter3 = this.ctx.createBiquadFilter();

    filter1.type = 'bandpass'; filter1.Q.setValueAtTime(32, t);
    filter2.type = 'bandpass'; filter2.Q.setValueAtTime(32, t);
    filter3.type = 'bandpass'; filter3.Q.setValueAtTime(32, t);

    // Draw random vowel sweep (from ee: [270, 2200], oo: [300, 870], ah: [730, 1090])
    const startFrequencies = [290, 1200, 2400];
    const endFrequencies = [550, 800, 1400];

    filter1.frequency.setValueAtTime(startFrequencies[0], t);
    filter2.frequency.setValueAtTime(startFrequencies[1], t);
    filter3.frequency.setValueAtTime(startFrequencies[2], t);

    filter1.frequency.exponentialRampToValueAtTime(endFrequencies[0], t + duration);
    filter2.frequency.exponentialRampToValueAtTime(endFrequencies[1], t + duration);
    filter3.frequency.exponentialRampToValueAtTime(endFrequencies[2], t + duration);

    // Create a transient white noise source
    const bufferSize = this.ctx.sampleRate * duration;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.linearRampToValueAtTime(0.18, t + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Connect source in parallel to filters (to construct formants)
    noiseSource.connect(noiseGain);
    
    // Output node mapping
    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(0.7, t);

    noiseGain.connect(filter1);
    noiseGain.connect(filter2);
    noiseGain.connect(filter3);

    // Add panning node to rotate disembodied voice from left ear to right ear! (Ultra psychological!)
    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.random() > 0.5 ? -1.0 : 1.0, t);
    panner.pan.linearRampToValueAtTime(Math.random() * 2 - 1.0, t + duration);

    filter1.connect(voiceGain);
    filter2.connect(voiceGain);
    filter3.connect(voiceGain);
    voiceGain.connect(panner);
    panner.connect(this.masterGain);

    noiseSource.start(t);
    noiseSource.stop(t + duration);
  }

  public triggerCreak() {
    if (!this.isInitialized || this.isMuted || !this.ctx || !this.masterGain) return;

    // Distant echoing metallic creaking pipe or door hinge
    const t = this.ctx.currentTime;
    const duration = 1.8 + Math.random() * 1.5;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110 + Math.random() * 40, t);
    // Slowly scrape pitch upward then crack down
    osc.frequency.linearRampToValueAtTime(140 + Math.random() * 80, t + duration * 0.7);
    osc.frequency.linearRampToValueAtTime(75, t + duration);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.setValueAtTime(5, t);

    // LFO modulation to add flutter/shuddering creak effect
    const flutterLFO = this.ctx.createOscillator();
    const flutterLFO_Gain = this.ctx.createGain();
    flutterLFO.frequency.setValueAtTime(12 + Math.random() * 6, t);
    flutterLFO_Gain.gain.setValueAtTime(45, t);

    flutterLFO.connect(flutterLFO_Gain);
    flutterLFO_Gain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.1);
    gain.gain.linearRampToValueAtTime(0.001, t + duration);

    // Route to reverb delay
    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.4, t);
    const delayGain = this.ctx.createGain();
    delayGain.gain.setValueAtTime(0.45, t);

    delay.connect(delayGain);
    delayGain.connect(delay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    gain.connect(delay);
    delayGain.connect(this.masterGain);

    osc.start(t);
    flutterLFO.start(t);

    osc.stop(t + duration + 0.5);
    flutterLFO.stop(t + duration + 0.5);
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.15, this.ctx?.currentTime || 0);
    }
    return this.isMuted;
  }

  public getMuted() {
    return this.isMuted;
  }

  private startOSTLoop() {
    const playNextNote = () => {
      if (!this.isInitialized || this.isMuted || !this.ctx || !this.masterGain) {
        this.ostTimer = setTimeout(playNextNote, 1300);
        return;
      }

      this.triggerOSTNote();

      // Sluggishly warp note interval delay when fear scales up
      const delay = 1200 + (this.currentFear * 700);
      this.ostTimer = setTimeout(playNextNote, delay);
    };

    playNextNote();
  }

  private triggerOSTNote() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const freq = this.ostMelody[this.ostIndex];
    this.ostIndex = (this.ostIndex + 1) % this.ostMelody.length;

    // Shift notes deep down to G#0 / G#1 demonic pitch ranges
    // Fear stretches and melts the pitch down even deeper!
    const pitchFactor = 0.5 - (this.currentFear * 0.18);
    const baseFreq = freq * pitchFactor;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const oscFilter = this.ctx.createBiquadFilter();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(baseFreq, t);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(baseFreq * 0.992, t);

    // Dynamic Tape wow & flutter (pitch wobbles representing analog degeneration)
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    const configHz = 1.4 + (this.currentFear * 3.5);
    const configMod = 12.0 + (this.currentFear * 40.0);

    vibrato.frequency.setValueAtTime(configHz, t);
    vibratoGain.gain.setValueAtTime(configMod, t);

    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc1.frequency);
    vibratoGain.connect(osc2.frequency);

    // Muted lowpass to mimic old wax dictaphone recordings
    oscFilter.type = 'lowpass';
    const cutoff = Math.max(90, 270 - (this.currentFear * 170));
    oscFilter.frequency.setValueAtTime(cutoff, t);

    const decayDuration = 1.1 + (this.currentFear * 1.5);
    oscGain.gain.setValueAtTime(0.0, t);
    if (this.currentFear > 0.7) {
      // Saturated signal gain boost when player enters high glitch levels
      oscGain.gain.linearRampToValueAtTime(0.35, t + 0.12);
    } else {
      oscGain.gain.linearRampToValueAtTime(0.20, t + 0.15);
    }
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + decayDuration);

    const delayNode = this.ctx.createDelay();
    delayNode.delayTime.setValueAtTime(0.35, t);
    const delayGainNode = this.ctx.createGain();
    delayGainNode.gain.setValueAtTime(0.42 + (this.currentFear * 0.18), t);

    delayNode.connect(delayGainNode);
    delayGainNode.connect(delayNode);

    osc1.connect(oscFilter);
    osc2.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(this.masterGain);

    oscGain.connect(delayNode);
    delayGainNode.connect(this.masterGain);

    vibrato.start(t);
    osc1.start(t);
    osc2.start(t);

    vibrato.stop(t + decayDuration + 0.5);
    osc1.stop(t + decayDuration + 0.5);
    osc2.stop(t + decayDuration + 0.5);
  }

  public stopAll() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.ostTimer) {
      clearTimeout(this.ostTimer);
      this.ostTimer = null;
    }

    try {
      this.droneOsc1?.stop();
      this.droneOsc2?.stop();
    } catch (e) {}

    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.isInitialized = false;
  }
}

// Global voice singleton exporter
export const audio = new SoundEngine();
