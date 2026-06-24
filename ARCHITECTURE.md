# How gurove-mcp Works

An overview of the architecture and data flow, for users who want to
understand what happens when they ask Claude to control GuRove.

## The Big Picture

```
┌──────────┐     MCP (stdio)      ┌──────────────┐    OSC (UDP)    ┌──────────┐
│  Claude  │ ←──────────────────→ │  gurove-mcp  │ ←────────────→ │  GuRove  │
│  (LLM)   │   JSON-RPC messages  │  (Node.js)   │  port 9001↔9002 │  (App)   │
└──────────┘                      └──────────────┘                 └──────────┘
                                        │
                                        │ reads
                                        ▼
                                  ┌──────────────┐
                                  │  knowledge/  │  ← drum theory, genre recipes,
                                  │  (*.md)      │    channel guide, sound design
                                  └──────────────┘
```

## What Each Part Does

### 1. Claude (the LLM)

You talk to Claude in natural language: *"Make the kick punchier"*.
Claude decides which MCP **tool** to call and with what arguments.

### 2. gurove-mcp (this server)

A thin Node.js bridge that exposes three things to Claude:

| Primitive | Purpose | Example |
|-----------|---------|---------|
| **Tools** | Actions Claude can perform | `set_param("ch1", "pitch", 0.5)` |
| **Resources** | Knowledge Claude can read | `gurove://house-rules` (drum anatomy) |
| **Prompts** | Templates for common tasks | (planned: `make_techno_kit`) |

When Claude calls a tool, the server translates it into an **OSC message**
and sends it to GuRove via UDP.

### 3. GuRove (the app)

GuRove has a built-in **OSC server** (`Source/osc/OscServer.cpp`) that
listens on `127.0.0.1:9001`. It translates incoming OSC into:

- **APVTS parameter changes** (the synth's internal parameter system)
- **Transport** start/stop
- **Preset** loading
- **Note** triggers (via a lock-free atomic bridge to the audio thread)

Replies (parameter values, preset lists, status) go back on port `9002`.

### 4. knowledge/ (the brain)

Markdown files that give Claude the domain knowledge to make musical
decisions:

| File | What it teaches Claude |
|------|----------------------|
| `channels.md` | What each of the 8 channels does, pitch ranges, genre tables |
| `house-rules.md` | Drum anatomy (kick needs pitchEnv, snare needs noise+tone), genre dictionary, failure fixes |
| `sound-design.md` | FM/AM/RM/Sync theory, filter, envelope, effects, quick recipes |

Claude reads these via MCP Resources when it needs to reason about sound
design — e.g., "the user wants a techno kick" → reads house-rules → learns
kick needs `pitchEnvAmount +24, punch 0.55, drive 0.3`.

## Data Flow: A Real Example

You say: *"Load Detroit Techno and start playback"*

```
1. Claude decides:
   → call load_preset(name="Detroit Techno")
   → call transport(state=1)

2. gurove-mcp translates to OSC:
   → UDP "/gurove/preset/load" "Detroit Techno"  → 127.0.0.1:9001
   → UDP "/gurove/transport" 1                     → 127.0.0.1:9001

3. GuRove receives OSC:
   → OscServer finds "Detroit Techno" in preset list
   → PresetManager loads it (replaces all APVTS params)
   → transport parameter set to 1 (Start)
   → Sequencer begins running

4. You hear Detroit Techno playing.
```

## OSC Address Quick Reference

| OSC Address | Args | Direction |
|-------------|------|-----------|
| `/gurove/param/set` | channel, param, value(0-1) | → GuRove |
| `/gurove/param/setraw` | channel, param, rawValue | → GuRove |
| `/gurove/param/get` | channel, param | → GuRove, ← reply |
| `/gurove/transport` | state(0/1) | → GuRove |
| `/gurove/bpm` | bpm(10-300) | → GuRove |
| `/gurove/note` | channel(1-8), velocity(0-1) | → GuRove |
| `/gurove/preset/load` | name or index | → GuRove |
| `/gurove/preset/list` | — | → GuRove, ← reply |
| `/gurove/status` | — | → GuRove, ← reply |

**channel**: `"master"` or `"ch1"`..`"ch8"`
**param**: APVTS suffix (`pitch`, `decay`, `reverbLevel`, `fmAmount`, etc.)

## Why Not Just MIDI?

MIDI Learn already exists in GuRove, but:
- MIDI is **one-directional** (controller → app, no state readback)
- MIDI CC has **128 steps** (not enough for fine parameter control)
- MIDI can't do **preset names** or **status queries**

OSC solves all of these: bidirectional, full float resolution, arbitrary
messages, JSON payloads for complex data.

## Why a Separate MCP Server (Not Built Into GuRove)?

- **Separation of concerns**: GuRove is a C++ audio app; MCP is a Node.js
  text protocol. Mixing them bloats the audio binary.
- **Language fit**: MCP SDK is TypeScript/Python; JUCE is C++.
- **Updatability**: Knowledge files and tool descriptions can be updated
  without rebuilding the app.
- **Reusability**: The OSC server in GuRove works with any OSC client, not
  just this MCP server (DAWs, Max/MSP, TouchOSC, etc.).

## Thread Safety

GuRove processes audio on a **real-time audio thread** that must never
block. OSC messages arrive on the **network/message thread**. The bridge:

- **Parameters**: APVTS `setValueNotifyingHost()` is thread-safe (lock-free
  atomic internally). Called directly from OSC handler.
- **Note triggers**: An `std::atomic<float>` array (`oscNoteVelocity_[8]`)
  is set by OSC, consumed by the audio thread each block. Lock-free, no
  allocation.
- **Preset loading**: Runs on the message thread (APVTS state replacement).

No mutexes, no allocations, no blocking on the audio path.

## File Structure

```
gurove-mcp/
├── src/
│   ├── index.ts        # MCP server: tools + resources + OSC bridge
│   └── osc-bridge.ts   # UDP OSC send/receive with reply timeout
├── knowledge/
│   ├── channels.md     # 8-channel guide (roles, pitch, genre tables)
│   ├── house-rules.md  # Drum anatomy + genre dictionary + fixes
│   └── sound-design.md # FM/filter/envelope/effects theory
├── README.md           # Setup instructions
└── ARCHITECTURE.md     # This file
```

```
gurove/ (app repo)
├── Source/osc/
│   ├── OscServer.h     # OSC receiver (9001) + sender (9002)
│   └── OscServer.cpp   # Address dispatch → APVTS/transport/preset/note
└── docs/
    ├── plans/mcp-server-plan.md     # Full design doc
    └── knowledge/                    # Knowledge source files
```
