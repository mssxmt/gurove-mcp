# GuRove Synth & FX Theory (for AI / sound designers)

> MCP Resource `gurove://sound-design`. The DSP building blocks, expressed as
> "what it sounds like" + "which params control it" + numeric guidance.

## 1. Oscillator (`waveform`)
- 0=sine (pure, soft, no harmonics), 1=triangle (soft, few harmonics),
  2=saw (bright, rich), 3=square (hollow, buzzy).
- All use PolyBLEP/BLAMP anti-aliasing, so they stay clean at high notes.
- **Choice rule**: sine/tri for kick bodies & pads; saw/square for hats,
  bass, FM carriers, bright leads.

## 2. Pitch envelope (AHDC)
- `pitchEnvAmount` ±48 semitones, applied to oscillator pitch. **Starts at
  +amount and decays to the base** (so positive = drop, negative = rise).
- `pitchEnvDecay` 0-2000ms; curve via `pitchEnvCurve` (0/1/2).
- **Kick body drop**: +18..+36, decay 40-120ms. **Tom bend**: -8..+8.
- Disabled (amount=0) → oscillator stays at base pitch.

## 3. FM / modulation (`fmMode`, `fmAmount`, `fmRatio`)
All modes bypass the plain oscillator when `fmAmount>0` and use a 2-osc
modulator. After the P0/P1 fixes:
- **0 FM** (frequency): metallic, bell-like, aggressive. Internal modIndex
  is bounded (freqDeviation clamped ≥0.1) so it can't explode. fmAmount 0.3-0.6
  for color, higher for extreme.
- **1 AM** (amplitude): tremolo. Normalized so output never exceeds carrier
  amplitude (tremolo-style). fmAmount = depth.
- **2 RM** (ring): carrier × modulator → inharmonic, robotic, great for
  metallic clank. Use **non-integer fmRatio** (1.3-1.7 for snare, 2.5-3.2 for
  hats) to avoid periodic dullness.
- **3 Sync** (hard sync): carrier phase reset by modulator period → rich
  harmonics, synth-lead character.
- `fmRatio` 0.1-10 (modulator = carrier × ratio). Sub-bass drone: 0.5.

## 4. Noise & click layers
- `noiseLevel` 0-1, `noiseColor` 0-1 (0=white, 1=pink).
- Add to the osc mix (after osc, before filter). Snare/hat/clap need it;
  kick/bass usually 0.
- `clickLevel` 0-1: very short transient on top — the beater/attack. Kick
  0.2-0.4, others usually 0.

## 5. Filter (SVF lowpass only)
- `filterCutoff` 20-20000 Hz (log-skew). `resonance` 0-1.
- Dark/warm: cutoff 400-1500. Neutral: 3000-5000. Bright/airy: 8000-12000.
- Resonance adds a peak at cutoff; useful for hat "ting" (0.3-0.6) or
  synth sweeps. Keep kick resonance low (0-0.2).
- **No HPF/BPF** — to thin a sound, lower its `vol` or use a higher LPF
  subtly, but you can't remove lows.

## 6. Drive & punch
- `drive` 0-1: saturation (weight/grit). Light 0.1-0.2 for warmth, higher
  for distorted/aggressive.
- `punch` 0-1: transient enhancer (sharpens attack). Kick 0.4-0.7, others 0.

## 7. Amplitude envelope (AHDC, no sustain)
- `attack` 0-1000ms, `hold` 0-1000ms, `decay` 0-5000ms, `decayCurve`
  0=lin/1=exp/2=log.
- Pluck/keyboard: attack 1-3ms, decay 100-400ms.
- Pad/drone: attack 10-25ms, decay 1000-3500ms, curve log.
- **exp/log curves** sound natural (faster initial drop); lin is mechanical.

## 8. Sequencer → voice interaction
- The sequencer triggers `strips[ch].noteOn(fixedPitch, velocity)` at
  sample-accurate offsets. Each trigger re-arms the AHDC env.
- `seqTriggerRate` ≥1.0 = deterministic on-steps; <1.0 = probability gate.
- `seqFreeze=1` locks the generated pattern (reproducible); 0 regenerates.
- pitchQuantize snaps the **channel's fixed pitch** (not per-step) to the
  chosen scale — so melodic work is done by channel assignment + seq timing.

## 9. Master effects (send bus, post-P1)

### Reverb (`reverbLevel`, `reverbDecay`, `reverbTone`)
- JUCE Schroeder (light) only for now — plate experiment was reverted.
- `reverbLevel` 0-1 = **wet return gain** (dry is NOT mixed back; the
  channel's dry signal reaches master via direct-out). So 0=silent reverb,
  1=full wet return.
- `reverbDecay` 0.1-10s. `reverbTone` 200-8000 Hz (damping cutoff).
- **Long ambient tails** hold up less well than a plate would (Schroeder
  gets metallic >6s) — compensate with darker tone and moderate level.

### Delay (`delayLevel`, `delayTime`, `delayFeedback`, `delayTone`, `delayMode`)
- Sync (0) or Free (1) ms. Feedback clamped to 0.98.
- Wet-only return, same as reverb. Tone = feedback LPF damping.

### Stutter (per-channel + master)
- On/off, sync/free rate. Captures a slice at ON and loops it (frozen).
- Rate is live: turning the rate knob mid-loop follows the sound immediately
  (no dry leak). Sync choices are 1/128..1/4 (CW = slower); Free is 1..500 ms
  (CW = longer) — both CW = longer/slower.

### Limiter (`masterLimiterOn`, `limiterCeiling`)
- Brickwall, JUCE dsp::Limiter, release 100ms. Ceiling in dB (-12..0),
  default -0.3. Keep ON for distribution.

### LFO Modulation (per-channel 2 + master 2)
- Each LFO modulates one same-scope APVTS parameter (`dest`). Channel LFOs →
  own channel params; master LFOs → master params. Single dest per LFO.
- `dest` choices (append-only, index persisted): None + scope params.
  `stutterRate`/`masterStutterRate` are virtual — resolve to syncRate or
  freeRate depending on the stutter's current mode.
- 13 waveforms (bipolar [-1,+1]): Sine, Triangle, SawUp, SawDown, Square,
  Ramp, SampleHold, SmoothRandom, ExpUp, ExpDown, Pulse (25% duty),
  Staircase (4-step), Trapezoid (symmetric rounded square).
- `depth` is bipolar [-1,+1] (negative inverts). `rateMode` Sync/Free;
  Sync = 1/1..1/128, Free = 0.01..40 Hz.
- Parameter-write model on a 60Hz message-thread Timer: LFO writes the target
  via `setValueNotifyingHost` (knobs/switches animate). processBlock reads the
  modulated value via `->load()` like any param.
- Base-value management: on dest change the current param value is captured as
  baseNorm; clearing dest (None) restores it. Saving a preset mid-modulation
  stores baseNorm (not the live LFO value).

## 10. Signal chain (one channel)
```
Osc(+pitchEnv) → [FM if active] → Mixer(+noise+click) → LPF(SVF)
  → Drive+Punch → AmpEnv × velocity → Panner → channel vol/smooth
  → (stutter) → [sends to reverb/delay bus] + direct out → master mix
  → masterVol → masterStutter → limiter → out
```

## 11. Quick tone recipes (numbers an LLM can apply)

| Want | Set |
|------|-----|
| Punchy techno kick | ch1: pitch 30, pitchEnvAmount 24, pitchEnvDecay 70, click 0.3, punch 0.55, drive 0.3, cutoff 900, decay 300 |
| 808 sub bass | ch7: sine, pitch 28, decay 700, cutoff 300, drive 0.1, fmAmount 0 |
| Bell-like FM perc | ch5: tri 72, fmMode FM, fmAmount 0.6, fmRatio 2.4, decay 200 |
| Airy pad | ch8: saw 48, attack 20, decay 2500, curve log, cutoff 1200, fmAmount 0.3 fmRatio 0.5, reverbSend 0.6 |
| Dark ambient drone | ch1+ch2 low sine/saw, long decay, fmRatio 0.5, reverbLevel 0.6 decay 8 |
