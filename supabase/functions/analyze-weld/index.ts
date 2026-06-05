// HotPass — Analyze Weld Edge Function
// Receives a weld photo URL, calls Claude for scoring, saves results to DB

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ----------------------------------------------------------------
// Process weights (mirrors engine.py)
// ----------------------------------------------------------------
const PROCESS_WEIGHTS: Record<string, Record<string, number>> = {
  MIG:   { bead_consistency:20, penetration:18, spatter:15, undercut:12, overlap:8, porosity:10, crack_indication:10, straightness:4, starts_stops:3, color_oxidation:0 },
  TIG:   { bead_consistency:18, penetration:18, spatter:5,  undercut:12, overlap:8, porosity:10, crack_indication:10, straightness:5, starts_stops:4, color_oxidation:10 },
  STICK: { bead_consistency:18, penetration:20, spatter:10, undercut:15, overlap:8, porosity:10, crack_indication:12, straightness:3, starts_stops:4, color_oxidation:0 },
  FCAW:  { bead_consistency:18, penetration:18, spatter:12, undercut:14, overlap:8, porosity:12, crack_indication:10, straightness:4, starts_stops:4, color_oxidation:0 },
};

function calculateScore(process: string, rawScores: Record<string, number>): number {
  const weights = PROCESS_WEIGHTS[process] ?? PROCESS_WEIGHTS['MIG'];
  const activeWeights = Object.entries(weights).filter(([, w]) => w > 0);
  const totalWeight = activeWeights.reduce((sum, [, w]) => sum + w, 0);
  const weightedSum = activeWeights.reduce((sum, [dim, w]) => {
    return sum + (rawScores[dim] ?? 0) * (w / totalWeight);
  }, 0);
  return Math.max(1, Math.min(100, Math.round(weightedSum)));
}

function gradeFromScore(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ----------------------------------------------------------------
// CWI rubric prompt
// ----------------------------------------------------------------
const RUBRIC_PROMPT = `
You are an expert certified welding inspector (CWI) analyzing a weld photo.
Return ONLY a JSON object with this exact structure — no markdown, no extra text:

{
  "process_detection": {
    "suggested_process": "MIG" | "TIG" | "STICK" | "FCAW",
    "confidence": 0.0–1.0,
    "signals": {
      "spatter_pattern": <float>,
      "bead_ripple_frequency": <float>,
      "heat_tint_present": <bool>,
      "electrode_stub_visible": <bool>,
      "gas_cup_visible": <bool>
    }
  },
  "raw_scores": {
    "bead_consistency": <0–100>,
    "penetration": <0–100>,
    "spatter": <0–100>,
    "undercut": <0–100>,
    "overlap": <0–100>,
    "porosity": <0–100>,
    "crack_indication": <0–100>,
    "straightness": <0–100>,
    "starts_stops": <0–100>,
    "color_oxidation": <0–100>
  },
  "defects": [
    {
      "code": "<defect_code>",
      "confidence": 0.0–1.0,
      "location_note": "<where in image>",
      "bounding_box": {"x": <0–100>, "y": <0–100>, "width": <0–100>, "height": <0–100>} | null
    }
  ],
  "summary_feedback": "<one paragraph summary>",
  "improvement_tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}

Score each dimension 0–100:
- bead_consistency: 100=perfectly uniform, 50=noticeable waviness, 0=chaotic
- penetration: 100=full fusion, 50=partial fusion, 0=no fusion or burn-through
- spatter: 100=zero spatter, 50=moderate spatter, 0=extreme spatter (higher=better)
- undercut: 100=no undercut, 50=under 0.8mm, 0=severe undercut (higher=better)
- overlap: 100=no overlap, 50=minor cold lap, 0=severe overlap (higher=better)
- porosity: 100=no porosity, 50=scattered pores, 0=heavy porosity (higher=better)
- crack_indication: 100=no cracks, 50=possible indication, 0=definite crack
- straightness: 100=perfectly straight, 50=2–4mm wander, 0=severe deviation
- starts_stops: 100=seamless, 50=visible restart mark, 0=severe crater cracking
- color_oxidation: 100=silver (perfect), 50=blue/grey, 0=black/burnt (TIG only, else 0)

Valid defect codes: wavy_bead, uneven_width, sagging_bead, lack_of_fusion,
incomplete_penetration, burn_through, heavy_spatter, spatter_islands, toe_undercut,
intermittent_undercut, cold_lap, surface_porosity, cluster_porosity, scattered_porosity,
centerline_crack, crater_crack, haz_crack, transverse_crack, weld_wander,
unfilled_crater, poor_restart, heavy_oxidation, black_oxidation

Return ONLY the JSON object.
`;

// ----------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_id, image_url } = await req.json();
    if (!session_id || !image_url) {
      return new Response(JSON.stringify({ error: 'session_id and image_url required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Init clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    // Mark session as processing
    await supabase.from('weld_session').update({ status: 'processing' }).eq('id', session_id);

    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: image_url } },
          { type: 'text', text: RUBRIC_PROMPT },
        ],
      }],
    });

    // Parse response
    let raw = (message.content[0] as any).text.trim();
    raw = raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
    const result = JSON.parse(raw);

    const pd = result.process_detection;
    const process = pd.suggested_process as string;
    const confidence = pd.confidence as number;
    const autoConfirmThreshold = 0.90;

    // Calculate final score
    const totalScore = calculateScore(process, result.raw_scores);
    const grade = gradeFromScore(totalScore);

    // Save process detection rows
    await supabase.from('weld_process_detection').insert(
      Object.entries({ MIG:1, TIG:2, STICK:3, FCAW:4 }).map(([code, id]) => ({
        session_id,
        process_id: id,
        confidence: code === process ? confidence : (1 - confidence) / 3,
        ai_model_version: 'claude-opus-4-5',
        detection_signals: code === process ? pd.signals : {},
      }))
    );

    // Update session with detected process
    await supabase.from('weld_session').update({
      suggested_process_id: { MIG:1, TIG:2, STICK:3, FCAW:4 }[process],
      confirmed_process_id: confidence >= autoConfirmThreshold ? { MIG:1, TIG:2, STICK:3, FCAW:4 }[process] : null,
      process_confirmed_by: confidence >= autoConfirmThreshold ? 'ai' : null,
      status: 'scored',
      scored_at: new Date().toISOString(),
    }).eq('id', session_id);

    // Save weld score
    const { data: scoreRow } = await supabase.from('weld_score').insert({
      session_id,
      total_score: totalScore,
      grade,
      ai_model_version: 'claude-opus-4-5',
      summary_feedback: result.summary_feedback,
      improvement_tips: result.improvement_tips,
    }).select().single();

    // Save per-dimension scores
    const weights = PROCESS_WEIGHTS[process] ?? PROCESS_WEIGHTS['MIG'];
    const activeWeights = Object.entries(weights).filter(([, w]) => w > 0);
    const totalWeight = activeWeights.reduce((sum, [, w]) => sum + w, 0);

    const dimensionMap: Record<string, number> = {
      bead_consistency:1, penetration:2, spatter:3, undercut:4, overlap:5,
      porosity:6, crack_indication:7, straightness:8, starts_stops:9, color_oxidation:10
    };

    await supabase.from('weld_score_dimension').insert(
      activeWeights.map(([dim, w]) => ({
        score_id: scoreRow.id,
        dimension_id: dimensionMap[dim],
        raw_score: result.raw_scores[dim] ?? 0,
        weighted_score: (result.raw_scores[dim] ?? 0) * (w / totalWeight),
      }))
    );

    // Save defects
    if (result.defects?.length > 0) {
      const defectCodeMap: Record<string, number> = {
        wavy_bead:1, uneven_width:2, sagging_bead:3, lack_of_fusion:4,
        incomplete_penetration:5, burn_through:6, heavy_spatter:7, spatter_islands:8,
        toe_undercut:9, intermittent_undercut:10, cold_lap:11, surface_porosity:12,
        cluster_porosity:13, scattered_porosity:14, centerline_crack:15, crater_crack:16,
        haz_crack:17, transverse_crack:18, weld_wander:19, unfilled_crater:20,
        poor_restart:21, heavy_oxidation:22, black_oxidation:23,
      };
      const defectRows = result.defects
        .filter((d: any) => defectCodeMap[d.code])
        .map((d: any) => ({
          score_id: scoreRow.id,
          defect_type_id: defectCodeMap[d.code],
          confidence: d.confidence,
          location_note: d.location_note,
          bounding_box: d.bounding_box,
        }));
      if (defectRows.length > 0) {
        await supabase.from('weld_defect_finding').insert(defectRows);
      }
    }

    return new Response(JSON.stringify({
      session_id,
      total_score: totalScore,
      grade,
      process,
      process_confidence: confidence,
      auto_confirmed: confidence >= autoConfirmThreshold,
      raw_scores: result.raw_scores,
      defects: result.defects,
      summary_feedback: result.summary_feedback,
      improvement_tips: result.improvement_tips,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('analyze-weld error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
