#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { OscBridge } from "./osc-bridge.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = process.env.GUROVE_KNOWLEDGE_PATH || join(__dirname, "..", "knowledge");

const osc = new OscBridge();
const server = new Server(
  { name: "gurove-mcp", version: "0.1.0" },
  { capabilities: { resources: {}, tools: {}, prompts: {} } }
);

// ── Resources (knowledge base) ──────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const files = readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
  return {
    resources: files.map((f) => ({
      uri: `gurove://${f.replace(".md", "")}`,
      name: f.replace(".md", ""),
      mimeType: "text/markdown",
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const name = req.params.uri.replace("gurove://", "");
  const path = join(KNOWLEDGE_DIR, `${name}.md`);
  return { contents: [{ uri: req.params.uri, mimeType: "text/markdown", text: readFileSync(path, "utf-8") }] };
});

// ── Tools ───────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "set_param",
    description: "Set a GuRove APVTS parameter. channel='master' or 'ch1'..'ch8'. param is the APVTS suffix (pitch, decay, reverbLevel, etc.). value is 0.0-1.0 (normalized). For real values use setraw_param. Key params: pitch(MIDI 0-127), decay(ms), pitchEnvAmount(±48), fmAmount(0-1), filterCutoff(20-20000Hz), vol(0-1), seqAlgorithm(0-9; 9=OFF disables the internal sequencer, ch fires from MIDI/OSC noteIn only). Note: paraOut is VST3-only — inert in the Standalone this bridge controls, leave it 0.",
    inputSchema: { type: "object", properties: { channel: { type: "string" }, param: { type: "string" }, value: { type: "number" } }, required: ["channel", "param", "value"] },
  },
  {
    name: "setraw_param",
    description: "Set a parameter by its real (non-normalized) value. E.g. reverbDecay=4.5 (seconds), ch1_pitch=30 (MIDI note). GuRove normalizes internally.",
    inputSchema: { type: "object", properties: { channel: { type: "string" }, param: { type: "string" }, value: { type: "number" } }, required: ["channel", "param", "value"] },
  },
  {
    name: "get_param",
    description: "Get a parameter's current value. Returns normalized (0-1) and raw value.",
    inputSchema: { type: "object", properties: { channel: { type: "string" }, param: { type: "string" } }, required: ["channel", "param"] },
  },
  {
    name: "transport",
    description: "Start (1) or stop (0) the sequencer transport.",
    inputSchema: { type: "object", properties: { state: { type: "number", enum: [0, 1] } }, required: ["state"] },
  },
  {
    name: "set_bpm",
    description: "Set tempo (10-300 BPM).",
    inputSchema: { type: "object", properties: { bpm: { type: "number" } }, required: ["bpm"] },
  },
  {
    name: "load_preset",
    description: "Load a factory preset by name (e.g. 'Warehouse Techno') or index (0-39). 40 presets: 1-16 drum standards, 17-28 experimental, 29-32 melodic, 33-40 ambient.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, index: { type: "number" } } },
  },
  {
    name: "list_presets",
    description: "List all 40 factory preset names.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "status",
    description: "Get current GuRove status: transport state, BPM, current preset name.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "trigger_note",
    description: "Manually trigger a voice on a channel (1-8) with velocity (0-1). For auditioning sounds.",
    inputSchema: { type: "object", properties: { channel: { type: "number" }, velocity: { type: "number" } }, required: ["channel"] },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    switch (name) {
      case "set_param":
        osc.send("/gurove/param/set", args!.channel as string, args!.param as string, args!.value as number);
        return { content: [{ type: "text", text: `Set ${args!.channel}_${args!.param} = ${args!.value}` }] };

      case "setraw_param":
        osc.send("/gurove/param/setraw", args!.channel as string, args!.param as string, args!.value as number);
        return { content: [{ type: "text", text: `Set raw ${args!.channel}_${args!.param} = ${args!.value}` }] };

      case "get_param": {
        const reply = await osc.sendAndWait("/gurove/param/get", "/gurove/param/value", args!.channel as string, args!.param as string);
        const v = reply.args;
        return { content: [{ type: "text", text: `${v[0]}_${v[1]}: normalized=${v[2]?.toFixed(4)}, raw=${v[3]?.toFixed(2)}` }] };
      }

      case "transport":
        osc.send("/gurove/transport", args!.state as number);
        return { content: [{ type: "text", text: args!.state ? "Transport started" : "Transport stopped" }] };

      case "set_bpm":
        osc.send("/gurove/bpm", args!.bpm as number);
        return { content: [{ type: "text", text: `BPM set to ${args!.bpm}` }] };

      case "load_preset":
        if (args!.name) osc.send("/gurove/preset/load", args!.name as string);
        else if (args!.index !== undefined) osc.send("/gurove/preset/load", args!.index as number);
        return { content: [{ type: "text", text: `Preset load requested: ${args!.name ?? args!.index}` }] };

      case "list_presets": {
        const reply = await osc.sendAndWait("/gurove/preset/list", "/gurove/preset/list");
        return { content: [{ type: "text", text: reply.args[0] ?? "[]" }] };
      }

      case "status": {
        const reply = await osc.sendAndWait("/gurove/status", "/gurove/status");
        const a = reply.args;
        return { content: [{ type: "text", text: `Transport: ${a[0] ? "running" : "stopped"}, BPM: ${a[1]?.toFixed(1)}, Preset: ${a[2]}` }] };
      }

      case "trigger_note":
        osc.send("/gurove/note", args!.channel as number, (args!.velocity ?? 0.8) as number);
        return { content: [{ type: "text", text: `Triggered ch${args!.channel} vel=${args!.velocity ?? 0.8}` }] };

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (e: any) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("gurove-mcp server started (OSC → 127.0.0.1:9001)");
