// HotPass — Machine Settings Edge Function
// Returns recommended welding parameters for a given process/material/thickness
// Falls back to Claude AI for combinations not in the static lookup table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ----------------------------------------------------------------
// Static settings database
// Covers the most common combinations — AI fills gaps
// ----------------------------------------------------------------
type Settings = {
  voltage: string;
  wire_speed: string;
  amperage: string;
  gas_mix: string;
  travel_speed: string;
  tips: string[];
};

const SETTINGS_DB: Record<string, Record<string, Record<string, Settings>>> = {
  MIG: {
    'Mild Steel': {
      '1/16"': { voltage:'14–16V', wire_speed:'140–170 IPM', amperage:'80–100A',  gas_mix:'75/25 Ar/CO₂', travel_speed:'16–20 IPM', tips:['Use .023" or .030" wire for thin material','Keep contact tip close to work','Stringer beads only on thin material'] },
      '1/8"':  { voltage:'17–19V', wire_speed:'180–220 IPM', amperage:'110–140A', gas_mix:'75/25 Ar/CO₂', travel_speed:'14–18 IPM', tips:['Push angle 10–15° for best bead profile','Clean base metal before welding','Check wire tension at drive rolls'] },
      '3/16"': { voltage:'19–21V', wire_speed:'220–260 IPM', amperage:'140–175A', gas_mix:'75/25 Ar/CO₂', travel_speed:'12–16 IPM', tips:['Single pass if fit-up is tight','Preheat to 150°F in cold weather','Use .035" wire for best results'] },
      '1/4"':  { voltage:'20–22V', wire_speed:'250–300 IPM', amperage:'160–200A', gas_mix:'75/25 Ar/CO₂', travel_speed:'10–14 IPM', tips:['Preheat to 200°F for thick sections','Multi-pass with interpass cleaning','Watch for lack of fusion at toes'] },
      '3/8"':  { voltage:'22–24V', wire_speed:'300–360 IPM', amperage:'200–250A', gas_mix:'75/25 Ar/CO₂', travel_speed:'8–12 IPM',  tips:['Preheat 250–300°F recommended','Multi-pass — clean slag between passes','Use weave bead for fill passes'] },
      '1/2"':  { voltage:'24–26V', wire_speed:'340–400 IPM', amperage:'240–280A', gas_mix:'75/25 Ar/CO₂', travel_speed:'7–10 IPM',  tips:['Preheat 300–400°F','Post-heat to slow cooling','Multiple passes required'] },
    },
    'Stainless Steel': {
      '1/16"': { voltage:'13–15V', wire_speed:'120–150 IPM', amperage:'70–90A',   gas_mix:'98/2 Ar/O₂',   travel_speed:'16–20 IPM', tips:['Use ER308L wire for 304 SS','Keep heat input low to prevent warping','Use backing bar on thin material'] },
      '1/8"':  { voltage:'16–18V', wire_speed:'160–200 IPM', amperage:'100–130A', gas_mix:'98/2 Ar/O₂',   travel_speed:'14–18 IPM', tips:['Use 308L wire for 304 SS','Keep heat input low','Allow full cool between passes'] },
      '3/16"': { voltage:'18–20V', wire_speed:'190–230 IPM', amperage:'130–160A', gas_mix:'98/2 Ar/O₂',   travel_speed:'12–15 IPM', tips:['Back purge pipe welds','Interpass temp max 350°F','Use stringer beads only'] },
      '1/4"':  { voltage:'19–21V', wire_speed:'210–250 IPM', amperage:'150–185A', gas_mix:'98/2 Ar/O₂',   travel_speed:'10–13 IPM', tips:['Keep interpass temp under 350°F','Multiple passes with stringer beads','Back purge for sanitary welds'] },
    },
    'Aluminum': {
      '1/8"':  { voltage:'18–20V', wire_speed:'200–260 IPM', amperage:'120–150A', gas_mix:'100% Argon',    travel_speed:'18–24 IPM', tips:['Push technique only — never drag','Use Teflon liner to prevent wire kinking','Clean with stainless brush before welding'] },
      '3/16"': { voltage:'20–22V', wire_speed:'250–310 IPM', amperage:'150–185A', gas_mix:'100% Argon',    travel_speed:'16–20 IPM', tips:['Preheat to 200–250°F','Use 4043 or 5356 wire based on alloy','Keep gun angle consistent'] },
      '1/4"':  { voltage:'21–23V', wire_speed:'280–340 IPM', amperage:'175–215A', gas_mix:'100% Argon',    travel_speed:'14–18 IPM', tips:['Preheat to 250–300°F','Use spool gun for long wire runs','Multiple passes for best results'] },
    },
  },
  TIG: {
    'Mild Steel': {
      '1/16"': { voltage:'10–12V', wire_speed:'Manual filler', amperage:'60–90A',   gas_mix:'100% Argon', travel_speed:'6–10 IPM', tips:['Use 2% thoriated or ceriated tungsten','DCEN polarity','Arc length = tungsten diameter'] },
      '1/8"':  { voltage:'12–15V', wire_speed:'Manual filler', amperage:'100–140A', gas_mix:'100% Argon', travel_speed:'5–8 IPM',  tips:['Amperage ~125A for 1/8"','Keep arc length tight and consistent','Use ER70S-2 or ER70S-6 filler'] },
      '3/16"': { voltage:'14–17V', wire_speed:'Manual filler', amperage:'140–175A', gas_mix:'100% Argon', travel_speed:'4–7 IPM',  tips:['Preheat to 150–200°F','Multiple passes for full penetration','Back purge for root pass on pipe'] },
      '1/4"':  { voltage:'15–18V', wire_speed:'Manual filler', amperage:'160–200A', gas_mix:'100% Argon', travel_speed:'4–6 IPM',  tips:['Preheat 200–250°F','Use walking the cup for pipe','Post-flow shielding 15+ seconds'] },
    },
    'Stainless Steel': {
      '1/16"': { voltage:'10–12V', wire_speed:'Manual filler', amperage:'55–80A',   gas_mix:'100% Argon', travel_speed:'6–10 IPM', tips:['Post-flow shielding 15+ seconds','Use 308L filler for 304 SS','Keep interpass temp under 300°F'] },
      '1/8"':  { voltage:'12–14V', wire_speed:'Manual filler', amperage:'85–115A',  gas_mix:'100% Argon', travel_speed:'5–8 IPM',  tips:['Back purge critical for sanitary welds','Keep interpass temp under 350°F','Use argon back purge at 5–10 CFH'] },
      '3/16"': { voltage:'13–16V', wire_speed:'Manual filler', amperage:'110–145A', gas_mix:'100% Argon', travel_speed:'4–7 IPM',  tips:['Multiple passes with stringer beads','Interpass temp max 350°F','Full back purge on all passes'] },
    },
    'Aluminum': {
      '1/8"':  { voltage:'14–17V', wire_speed:'Manual filler', amperage:'120–160A', gas_mix:'100% Argon', travel_speed:'8–12 IPM', tips:['Use AC polarity','Balance wave 65–70% EN for cleaning','Use pure or zirconiated tungsten'] },
      '3/16"': { voltage:'16–19V', wire_speed:'Manual filler', amperage:'155–195A', gas_mix:'100% Argon', travel_speed:'6–10 IPM', tips:['Preheat to 200–250°F','Use 4043 filler for most alloys','Keep tungsten clean — no steel contamination'] },
      '1/4"':  { voltage:'18–21V', wire_speed:'Manual filler', amperage:'185–230A', gas_mix:'100% Argon', travel_speed:'5–8 IPM',  tips:['Preheat 250–300°F','Multiple passes for thick sections','High frequency start — no scratch start'] },
    },
  },
  STICK: {
    'Mild Steel': {
      '1/8"':  { voltage:'70–90A',   wire_speed:'N/A', amperage:'70–90A',   gas_mix:'None (SMAW)', travel_speed:'8–12 IPM', tips:['E6013 for general, E7018 for structural','Keep rod dry — store in rod oven','5–10° drag angle'] },
      '3/16"': { voltage:'90–120A',  wire_speed:'N/A', amperage:'90–120A',  gas_mix:'None (SMAW)', travel_speed:'7–10 IPM', tips:['E7018 for structural applications','Preheat 150°F in cold weather','Remove slag completely between passes'] },
      '1/4"':  { voltage:'110–140A', wire_speed:'N/A', amperage:'110–140A', gas_mix:'None (SMAW)', travel_speed:'6–9 IPM',  tips:['Preheat 200°F for thick plate','E7018 low hydrogen recommended','Drag technique for best bead'] },
      '3/8"':  { voltage:'130–170A', wire_speed:'N/A', amperage:'130–170A', gas_mix:'None (SMAW)', travel_speed:'5–8 IPM',  tips:['Preheat 300–400°F','Use E7018 low hydrogen only','Multiple passes required'] },
      '1/2"':  { voltage:'160–200A', wire_speed:'N/A', amperage:'160–200A', gas_mix:'None (SMAW)', travel_speed:'4–7 IPM',  tips:['Preheat 400°F+','Post-heat to slow cooling','Use 5/32" or 3/16" rod'] },
    },
  },
  FCAW: {
    'Mild Steel': {
      '1/8"':  { voltage:'18–20V', wire_speed:'180–220 IPM', amperage:'130–160A', gas_mix:'75/25 Ar/CO₂ or Self-shielded', travel_speed:'12–16 IPM', tips:['Self-shielded needs no gas — good for outdoors','Drag angle 10–15° for gas-shielded','Remove slag between passes'] },
      '3/16"': { voltage:'20–22V', wire_speed:'210–260 IPM', amperage:'155–190A', gas_mix:'75/25 Ar/CO₂ or Self-shielded', travel_speed:'10–14 IPM', tips:['Great for windy conditions with self-shielded wire','Keep contact tip 1" from work','Stringer beads for best quality'] },
      '1/4"':  { voltage:'21–24V', wire_speed:'240–290 IPM', amperage:'175–220A', gas_mix:'75/25 Ar/CO₂ or Self-shielded', travel_speed:'8–12 IPM',  tips:['Multi-pass with stringer beads','Clean slag fully before next pass','Check wire for moisture contamination'] },
      '3/8"':  { voltage:'23–26V', wire_speed:'270–330 IPM', amperage:'200–250A', gas_mix:'75/25 Ar/CO₂ or Self-shielded', travel_speed:'6–10 IPM',  tips:['Preheat 200–250°F','Multiple passes required','Clean all slag between passes'] },
      '1/2"':  { voltage:'25–28V', wire_speed:'300–370 IPM', amperage:'230–280A', gas_mix:'75/25 Ar/CO₂ or Self-shielded', travel_speed:'5–8 IPM',  tips:['Preheat 300°F+','High deposition rate — monitor heat input','Use weave bead for fill passes'] },
    },
  },
};

// ----------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { process, material, thickness, machine_name, machine_brand } = await req.json();

    if (!process || !material || !thickness) {
      return new Response(JSON.stringify({ error: 'process, material, and thickness are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try static lookup first
    const staticSettings = SETTINGS_DB[process]?.[material]?.[thickness];

    if (staticSettings) {
      return new Response(JSON.stringify({
        source: 'database',
        process, material, thickness,
        machine_name: machine_name ?? null,
        machine_brand: machine_brand ?? null,
        ...staticSettings,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fall back to Claude for unlisted combinations
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    const machineContext = machine_brand
      ? `The welder is using a ${machine_brand}${machine_name ? ' ' + machine_name : ''}.`
      : '';

    const prompt = `You are an expert welding engineer. ${machineContext}
Provide recommended settings for:
- Process: ${process}
- Material: ${material}
- Thickness: ${thickness}

Return ONLY this JSON object — no markdown, no extra text:
{
  "voltage": "<range>",
  "wire_speed": "<range or Manual filler>",
  "amperage": "<range>",
  "gas_mix": "<gas recommendation>",
  "travel_speed": "<range in IPM>",
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    let raw = (message.content[0] as any).text.trim()
      .replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const aiSettings = JSON.parse(raw);

    return new Response(JSON.stringify({
      source: 'ai',
      process, material, thickness,
      machine_name: machine_name ?? null,
      machine_brand: machine_brand ?? null,
      ...aiSettings,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('machine-settings error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
