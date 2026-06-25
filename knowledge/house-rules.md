# GuRove Sound-Design House Rules (for AI / sound designers)

> MCP Resource `gurove://house-rules`. The principles that turn a pile of
> parameters into an idiomatic drum/synth sound. Numeric, causal, and
> failure-aware so an LLM can self-correct.

## 1. Drum anatomy (the four sounds)

### Kick = pitch drop + attack + body
- A real kick's pitch falls fast right after the transient. Model that with
  `pitchEnvAmount +18..+36` semitones, `pitchEnvDecay 40-120ms`, starting
  high and decaying to the base note.
- Attack: `clickLevel 0.2-0.4` (the beater click), `punch 0.4-0.7`
  (transient enhancer).
- Body/weight: `drive 0.1-0.4`, `filterCutoff` low-ish to keep it dark.
- Decay `200-400ms` (longer for trap/808, shorter for techno punch).
- **WITHOUT pitchEnv, a kick is a weak low sine blip.** This is the #1 fix.

### Snare = tone layer + noise layer
- Tone: tri/saw, note 50-62, short pitchEnv (+5..+10).
- Noise: `noiseLevel 0.3-0.6`, `noiseColor 0.4-0.7` (toward pink = warmer).
- Shaped by LPF (2500-3500) + resonance 0.3-0.4.
- Metallic: `fmMode=RM`, `fmAmount 0.3-0.5`, `fmRatio` non-integer (1.3-1.7).

### Hi-hat = metal + noise
- Waveform: sine (0) or square (3). For **noise-dominant hats** use sine so the
  oscillator doesn't mask the noise — the noise IS the hat, the osc is just a
  faint carrier.
- **pitch**: set to the highest of all channels (MIDI 90-96).
- **noiseLevel**: set to **1.0 (max)** for noise-dominant hats. The hat IS the noise.
- **noiseColor**: 0 = white (bright/airy), 0.3-0.5 = slightly colored,
  1.0 = pink (dark/muffled). Pick a color that suits the genre.
- Very short decay (closed 20-60ms, open 150-400ms).
- High LPF (9000-12000), reso 0.3-0.6.
- Clank: `fmMode=RM`, `fmAmount 0.25-0.4`, `fmRatio` non-integer (2.5-3.2).

### Clap = noisier, layered snare
- noiseLevel 0.5-0.7, slightly longer decay, LPF ~3000. Often offbeat.

## 2. Bass & FX (it's a synth, not just drums)

### Bass (ch7, single note)
- saw/square, low note 24-40, LPF dark (400-1500), drive light (0.1-0.3).
- Offbeat (Euclidean sparse) or rolling (more hits). The sequencer plays one
  fixed pitch — no melodic bass without an engine change.

### FX / Atmosphere (ch8)
- Metallic zap: RM/FM, non-integer ratio.
- Noise riser: long attack noise + filter sweep + reverb.
- Crash: noise/FM long decay.
- Drone: saw, FM sub (fmRatio 0.5), very long decay, heavy reverb send.
- Sparse triggers (seqTriggerRate < 0.4).

## 3. Genre dictionary (structured)

```yaml
techno:
  bpm: [128, 140]
  kick: { pitch: 30, pitchEnvAmount: 24, punch: 0.55, drive: 0.3, decay: 300, seed: 4 }
  snare_or_clap: { offbeat_clap: true, noise: 0.45 }
  open_hat: { offbeat: true, decay: 250 }
  bass: { rolling: true, note: 26, LPF: 800 }
  reverb: { level: 0.3, decay: 3, tone: 2500 }
  seq: { triggerRate: 1.0, freeze: 1 }

house:
  bpm: [120, 126]
  kick: { pitch: 33, pitchEnvAmount: 18, punch: 0.45, decay: 350 }
  clap: { on_2_and_4: true, noise: 0.55 }
  hats: { eighth_notes: true }
  bass: { stab: true, note: 33 }
  reverb: { level: 0.35, decay: 3.5 }

dnb:
  bpm: [170, 175]
  kick: { breakbeat: seed_2_or_3, pitch: 31, punch: 0.6 }
  snare: { breakbeat: seed_3, noise: 0.5 }
  bass: { smooth_sub: note_29, LPF: 500, long_decay: 800 }
  reverb: { level: 0.3, decay: 3 }

trap:
  bpm: [140, 150]
  kick: { 808: true, pitch: 28, decay: 700, sine: true, pitchEnv: small }
  hats: { rolls: true, fast_alg8_busy }
  bass: { 808_sub: note_28 }
  half_time: true

breaks:
  bpm: [130, 140]
  kick: { breakbeat: seed_2 }
  snare: { rough: noise_0.5, LPF: 2800 }
  bass: { dirty: drive_0.3 }

electro:
  bpm: [120, 130]
  kick: { 808: syncopated }
  rim: { FM: true }
  bass: { FM: true, note: 33 }

ambient:
  bpm: [55, 90]
  drumless: true
  pitchQuantize: pentatonic (scale 3 or 4)
  reverb: { level: 0.5-0.65, decay: 6-9 }
  seq: { triggerRate: 0.15-0.3, freeze: 0, evolving: true }
```

## 4. Sequencer usage rules

1. **Deterministic core**: kick/snare/hat use algo 6/7/8 with
   `seqTriggerRate=1.0`, `seqFreeze=1`, `seqSeed` picks the variant.
2. **Evolving texture**: perc/FX/ambient may use Euclidean/CA/RandomWalk/
   LFSR/Markov/ProbDensity, optionally `seqFreeze=0` and
   `seqTriggerRate<1.0` for true randomness.
3. `seqSteps=16` for a bar (1 step = 1/16 note); 32 for slow/ambient.
4. `seqTriggerRate<1.0` is a **probability gate** (stochastic thinning), not
   a clock division. Use it for sparseness, not groove.

## 5. Mix balance

- Kick is the foundation: vol 0.85-0.95 on ch1, masterVol ~0.85.
- Snare/hat lower (0.4-0.7), bass solid (0.55-0.65), FX subtle (0.25-0.35).
- Limiter ON, ceiling -0.3 dB. Reverb on snare/perc/FX, delay on hats/FX.
- **Send-bus returns are wet-only** (P1 fix): reverbLevel/delayLevel are
  return gains; the dry signal only reaches master via direct-out.

## 6. Failure patterns & fixes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Kick weak/thin | pitchEnvAmount ≈ 0 | set +18..+36 |
| Kick muddy | drive too high / LPF too low | drive ≤0.4, cutoff ≥700 |
| Hat sounds like a beep | sine/tri waveform | use square/saw + noise |
| Hat too short/chintzy | noiseLevel=0 or decay <20ms | noise 0.4-0.6, decay 25-50ms |
| Snare lacks body | no tone layer (pure noise) | add tri/saw + short pitchEnv |
| Groove sparse/random | seqTriggerRate<1 on core | set 1.0, seqFreeze=1 |
| Reverb overwhelms | reverbLevel near 1 + long decay | 0.3-0.5, decay 3-5s |
| Sound explodes (past bug) | FM negative freq (FIXED in P0) | ensure fmAmount≤1, osc guarded |
| AM too loud (past bug) | 2x overshoot (FIXED in P1) | normalized tremolo formula |
| Bass can't play melody | engine limit (fixed pitch) | use multiple channels as a scale |

## 7. Hard constraints (don't fight these)

- **One fixed pitch per channel** (no per-step melody). Build melodies by
  spreading channels across scale notes.
- **LPF only** (SVF) — no HPF/BPF.
- **No sampler** — everything is synthesized.
- **Standalone on macOS/iPadOS** (Windows needs a build environment).
