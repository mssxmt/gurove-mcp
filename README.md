# gurove-mcp

MCP server for [GuRove](https://github.com/mssxmt/gurove) — a generative drum
synthesizer. Lets an LLM (Claude) control GuRove via OSC, with built-in
sound-design knowledge.

## Architecture

```
[Claude] ←MCP(stdio)→ [gurove-mcp] ←OSC(UDP)→ [GuRove app :9001/:9002]
```

## Setup

### 1. Install dependencies

```bash
cd gurove-mcp
npm install
npm run build
```

### 2. Run GuRove

Launch the GuRove standalone app. It listens for OSC on port 9001 and
replies on port 9002.

### 3. Register with Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gurove": {
      "command": "node",
      "args": ["/path/to/gurove-mcp/dist/index.js"],
      "env": {
        "GUROVE_KNOWLEDGE_PATH": "/path/to/gurove-mcp/knowledge"
      }
    }
  }
}
```

Restart Claude Desktop. You can now say things like:

- "Load the Warehouse Techno preset and start playback"
- "Set the reverb decay to 5 seconds"
- "Make the kick punchier"
- "List all presets"

## Tools

| Tool | Description |
|------|-------------|
| `set_param` | Set a parameter (normalized 0-1) |
| `setraw_param` | Set a parameter by real value (Hz, ms, MIDI note) |
| `get_param` | Get current value (normalized + raw) |
| `transport` | Start/stop the sequencer |
| `set_bpm` | Set tempo |
| `load_preset` | Load a preset by name or index |
| `list_presets` | List all 40 presets |
| `status` | Get transport/BPM/preset state |
| `trigger_note` | Audition a channel |

## Resources

| URI | Content |
|-----|---------|
| `gurove://channels` | 8-channel guide (roles, pitch ranges, genre tables) |
| `gurove://house-rules` | Drum anatomy, genre dictionary, failure fixes |
| `gurove://sound-design` | FM/filter/envelope/effects theory |

## Knowledge files

The `knowledge/` directory ships with the MCP server. To update:

```bash
cp ../gurove/docs/knowledge/*.md knowledge/
```
