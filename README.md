# gurove-mcp

MCP server for [**GuRove**](https://lab.mssxmt.com/gurove/) — a generative
drum synthesizer / synth. Lets Claude (or any MCP-compatible LLM) control
GuRove via OSC, with built-in sound-design knowledge.

## What is this?

GuRove is a standalone drum synth app (macOS, JUCE/C++). This MCP server lets
an AI assistant:

- Load presets, start/stop playback, set BPM
- Change any synthesizer parameter (pitch, reverb, FM, filter, etc.)
- Trigger individual drum voices
- Reason about sound design using built-in knowledge (drum anatomy, genre
  recipes, FM theory)

So you can say things like:

> *"Load Warehouse Techno, set the reverb to 4 seconds, make the kick
> punchier, and start playback."*

…and the AI will translate that into the right OSC commands.

## Requirements

1. **[GuRove](https://lab.mssxmt.com/gurove/)** app running (it has a
   built-in OSC server on UDP port 9001)
2. **Node.js 18+** and npm
3. **Claude Desktop** or **Claude Code** (supports MCP)

## Installation

```bash
git clone https://github.com/mssxmt/gurove-mcp.git
cd gurove-mcp
npm install
```

## Setup

### Step 1: Run GuRove

Launch the GuRove standalone app. It automatically listens for OSC on
`127.0.0.1:9001` and replies on `:9002`. No configuration needed.

### Step 2: Register with Claude

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gurove": {
      "command": "npx",
      "args": ["tsx", "/path/to/gurove-mcp/src/index.ts"]
    }
  }
}
```

Restart Claude Desktop. Look for the 🔌 icon to confirm `gurove` is connected.

#### Claude Code

```bash
claude mcp add gurove npx tsx /path/to/gurove-mcp/src/index.ts
```

### Step 3: Try it!

Open a conversation with Claude and try:

- *"List all GuRove presets"*
- *"Load Detroit Techno and start playback"*
- *"Set the reverb decay to 5 seconds"*
- *"What does the FM modulation do?"*
- *"Make an ambient pad with long reverb"*

## Tools

| Tool | Args | Description |
|------|------|-------------|
| `set_param` | channel, param, value (0-1) | Set a parameter (normalized) |
| `setraw_param` | channel, param, value | Set a parameter by real value (Hz, ms, MIDI note, semitones) |
| `get_param` | channel, param | Get current value |
| `transport` | state (0=stop, 1=start) | Start/stop the sequencer |
| `set_bpm` | bpm (10-300) | Set tempo |
| `load_preset` | name or index | Load one of 40 presets |
| `list_presets` | — | List all preset names |
| `status` | — | Get current transport/BPM/preset |
| `trigger_note` | channel (1-8), velocity | Audition a voice |

**channel**: `"master"` or `"ch1"`..`"ch8"`
**param**: APVTS suffix (`pitch`, `decay`, `reverbLevel`, `fmAmount`, etc.)

## Resources (AI knowledge base)

| URI | Content |
|-----|---------|
| `gurove://channels` | 8-channel guide: roles, pitch ranges, genre tables, failure modes |
| `gurove://house-rules` | Drum anatomy (kick/snare/hat/bass), genre dictionary, troubleshooting |
| `gurove://sound-design` | FM/AM/RM/Sync theory, filter, envelope, effects, quick recipes |

## How it works

```
You ←→ Claude ←(MCP stdio)→ gurove-mcp ←(OSC UDP)→ GuRove app
```

- **GuRove** has a built-in OSC receiver (port 9001) that maps OSC addresses
  to its internal parameter system (APVTS).
- **gurove-mcp** is a thin Node.js bridge: it exposes MCP tools/resources and
  forwards commands to GuRove via OSC.
- **Knowledge** ships as markdown files in `knowledge/`, surfaced as MCP
  Resources so the AI can reason about sound design.

## Updating the knowledge

The knowledge files in `knowledge/` are copied from the
[GuRove repo](https://github.com/mssxmt/gurove/tree/main/docs/knowledge). To
update:

```bash
cp ../gurove/docs/knowledge/*.md knowledge/
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Claude says "tool not found" | Restart Claude after editing config |
| OSC timeout | Make sure GuRove app is running |
| Port 9001 in use | Only one GuRove instance can listen at a time |
| `npx tsx` not found | Run `npm install` in the gurove-mcp directory |

## License

Same as GuRove (AGPLv3 / Commercial).
