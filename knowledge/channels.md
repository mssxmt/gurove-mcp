# GuRove 8-Channel Guide (for AI / sound designers)

> This document is the single source for "what each channel is and how to
> voice it". MCP Resources surface it as `gurove://channels`.

## 1. Standard channel template

GuRove is an **8-channel synth**, not strictly a drum machine. The default
template below is for drum kits; any channel can instead be a melodic voice,
bass, or FX (see the melodic/ambient presets 31-40).

| ch | Default role | pitch (MIDI) | waveform | essentials |
|----|--------------|--------------|----------|------------|
| 1 | Kick | 28-36 | sine/tri/saw | pitchEnvAmount +18..+36, click, punch |
| 2 | Snare / Clap | 50-62 | tri/saw | noise 0.3-0.6, LPF, short pitchEnv |
| 3 | Closed hat | 70-92 | square/saw | noise white, short decay 20-60ms |
| 4 | Open hat / Ride | 70-92 | square/saw | longer decay 150-400ms |
| 5 | Clap / Rim / Perc | 60-80 | tri/saw | FM/RM for metallic, pitchQuantize for melodic |
| 6 | Tom / Perc | 40-66 | tri/saw | pitchEnv -8..+8, mid decay |
| 7 | Bass (single note) | 24-40 | saw/square | LPF dark, offbeat/rolling seq |
| 8 | FX / Atmosphere | 30-90 | saw/sine | FM/noise, long decay, reverb heavy |

Unused channels → set `vol = 0` (the engine still runs them, but they're
silent and free of send-bus contribution).

## 2. Per-channel recipes

Each section lists: role, pitch range, waveform, required elements, genre
typical values, and common failure modes (so the LLM can self-correct).

### ch1 — KICK
- **Why pitchEnv matters**: a real kick's pitch drops sharply after the
  initial transient ("body drop"). Without `pitchEnvAmount`, the channel is
  just a low sine blip — thin and weak. Always set pitchEnvAmount +18..+36
  with pitchEnvDecay 40-120 ms.
- **Anatomy**: osc (+pitchEnv) → click (transient) → punch (transient
  enhancer) → drive (weight) → LPF (darken) → ampEnv.
- **Genre table** (pitch / pitchEnv / punch / drive / decay ms):

| Genre | pitch | pitchEnv | punch | drive | decay |
|-------|-------|----------|-------|-------|-------|
| techno | 30 | +24 | 0.55 | 0.3 | 300 |
| house | 33 | +18 | 0.45 | 0.1 | 350 |
| dnb | 31 | +26 | 0.6 | 0.2 | 250 |
| trap (808) | 28 | small (mostly sustained) | 0.3 | 0.1 | 700+ |
| ambient | 31 | +12 | 0.2 | 0.05 | 600 |

- **Failure modes**: pitchEnvAmount=0 → weak blip (avoid); decay <120ms →
  thin; drive >0.5 on techno → muddy; pitch <26 → inaudible on small speakers.

### ch2 — SNARE / CLAP
- **Anatomy**: tonal body (tri/saw, note 50-62, short pitchEnv) + noise layer
  (noiseLevel 0.3-0.6, noiseColor 0.4-0.7 = pink-ish), shaped by LPF+reso.
- **Metallic snare**: fmMode=RM, fmAmount 0.3-0.5, fmRatio non-integer
  (1.3-1.7) adds clank.
- **Clap**: shorter, noisier, layered feel (noiseLevel 0.5-0.7).
- **Genre**:
  - techno: tri 55, noise 0.45 color 0.55, LPF 2600, reso 0.4, RM fm 0.4/1.3
  - house: clap feel, noise 0.55, LPF 3000
  - dnb: breakbeat (algo 7 seed 3), noisier, punchy

### ch3 — CLOSED HAT
- **Anatomy**: square/saw at high note (80-92), very short decay 20-60 ms,
  white noise (noiseColor 0) for air, high LPF (9000-12000), reso 0.3-0.6.
- **Metallic clank**: fmMode=RM, fmAmount 0.25-0.4, fmRatio non-integer
  (2.5-3.2).
- **Failure**: sine/tri waveform → no metal (sounds like a beep); noiseLevel=0
  → synthetic; decay >100ms → becomes an open hat.

### ch4 — OPEN HAT / RIDE
- Same as ch3 but decay 150-400 ms. Offbeat placement is genre-defining
  (techno offbeat open hat).

### ch5 — CLAP / RIM / PERC / MELODIC
- Most flexible slot. For drums: rimshot (tri, FM RM), perc (CA/RandomWalk).
- For **melodic** use: enable pitchQuantize, pick a scale, set a fixed note;
  use RandomWalk/Euclidean for evolving melody.

### ch6 — TOM / PERC
- Mid-pitch (40-66), pitchEnv slight (-8..+8) for the tom "bend", mid decay
  (200-500ms). Good target for CA rule 30/110 evolving patterns.

### ch7 — BASS (single note)
- **Constraint**: the sequencer triggers the channel's fixed pitch only (no
  per-step melody). So bass = **rhythmic single-note** bassline. Melodic bass
  would need an engine change (out of scope).
- saw/square, note 24-40, LPF dark (400-1500Hz), decay tuned to the groove
  (offbeat / rolling). Light drive.
- Offbeat: Euclidean (algo 0) with seqHits/seqOffset; rolling: more hits.

### ch8 — FX / ATMOSPHERE
- Metallic FM zaps (RM/FM, non-integer ratio), noise risers (long attack
  noise + filter + reverb), crashes (noise/FM long decay), drones (saw, low
  FM sub ratio 0.5, very long decay). Sparse triggers (seqTriggerRate < 0.4).

## 3. Sequencer per channel

| algo | name | use for |
|------|------|---------|
| 0 | Euclidean | core deterministic (bass offbeat, sparse perc) |
| 1 | ProbDensity | sparse/ambient (density = fire probability) |
| 2 | LFSR | glitchy irregular |
| 3 | Markov | morphing texture (order/bias shape memory) |
| 4 | CellularAutomaton | self-organizing (rule 30=chaos, 90=fractal, 110=complex) |
| 5 | RandomWalk | melodic/ambient generative |
| 6 | KickPattern | kick core (seed % 8 picks variant) |
| 7 | SnarePattern | snare core |
| 8 | HihatPattern | hat core |

- **Deterministic core**: kick/snare/hat use algo 6/7/8 with
  `seqTriggerRate=1.0`, `seqFreeze=1`, `seqSeed` picks the named variant.
- **Evolving texture**: perc/FX/ambient can use algo 1-5 with
  `seqFreeze=0` (regenerates each play) and `seqTriggerRate<1.0` (stochastic
  gating) — the "experimental" presets 17-40 do this.

## 4. Pitch quantization (for melodic channels)

- `pitchQuantize=1` snaps the channel's fixed `pitch` to the nearest note in
  `pitchScale`. Since each channel is one fixed note, you build a melody by
  putting **different channels on different scale notes** and sequencing them
  independently.
- Scales: 0=Chromatic, 1=Minor, 2=Major, 3=PentatonicMinor, 4=PentatonicMajor,
  5=Blues, 6=Dorian, 7=Phrygian, 8=Lydian, 9=Mixolydian, 10=HarmonicMinor,
  11=MelodicMinor.
- Pentatonic (3/4) is foolproof for ambient/melodic — no wrong notes.

## 5. Channel → APVTS param ID convention

- Channel params: `ch{N}_{param}` with N = 1..8 (e.g. `ch1_pitch`,
  `ch3_seqAlgorithm`).
- Master params: no prefix (`masterVol`, `bpm`, `reverbLevel`, ...).
- This matters for OSC/MCP: `channel="ch1"`, `param="pitch"` → ID `ch1_pitch`.

## 6. Quick "make it sound good" defaults

If unsure, start from:
- ch1: pitch 32, pitchEnvAmount +22, pitchEnvDecay 70, clickLevel 0.3,
  punch 0.55, drive 0.2, decay 300, seqAlgorithm 6, seqSeed 0, seqFreeze 1.
- ch2: tri 56, noise 0.45 color 0.55, LPF 3000 reso 0.35, seqAlgorithm 7,
  seqSeed 0, seqFreeze 1.
- ch3: square 86, noise 0.45 color 0, LPF 10000 reso 0.35, decay 35,
  seqAlgorithm 8, seqSeed 1, seqFreeze 1.
- ch7: saw 30, LPF 1000 reso 0.2, drive 0.2, seqAlgorithm 0, seqHits 4,
  seqOffset 2, seqFreeze 1.
- master: masterVol 0.85, reverbLevel 0.3, delayLevel 0.25, limiter on,
  ceiling -0.3.
