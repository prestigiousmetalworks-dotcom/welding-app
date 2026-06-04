"""
DimeVision AI Vision Pipeline
Sends a weld photo to Claude, returns structured scores and defects
ready to pass directly into engine.calculate_score().
"""

import base64
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import anthropic

from engine import WeldProcess


AI_MODEL_VERSION = "claude-opus-4-8"

# ------------------------------------------------------------------
# Output structures
# ------------------------------------------------------------------

@dataclass
class DefectFinding:
    code:         str
    confidence:   float              # 0.0–1.0
    bounding_box: Optional[dict]     # {x, y, width, height} as % of image, or None
    location_note: Optional[str]


@dataclass
class ProcessDetection:
    process:    WeldProcess
    confidence: float                # 0.0–1.0
    signals:    dict                 # visual cues the model used


@dataclass
class VisionResult:
    raw_scores:        dict[str, float]   # dimension_code → 0–100
    defects:           list[DefectFinding]
    process_detection: ProcessDetection
    ai_model_version:  str


# ------------------------------------------------------------------
# Scoring rubric prompt — tells Claude exactly what to assess
# ------------------------------------------------------------------

RUBRIC_PROMPT = """
You are an expert certified welding inspector (CWI) analyzing a weld photo.
Assess the weld and return a JSON object with EXACTLY this structure — no extra text, no markdown fences:

{
  "process_detection": {
    "suggested_process": "MIG" | "TIG" | "STICK" | "FCAW",
    "confidence": 0.0–1.0,
    "signals": {
      "spatter_pattern": <float>,
      "bead_ripple_frequency": <float>,
      "bead_profile": <float>,
      "heat_tint_present": <bool>,
      "electrode_stub_visible": <bool>,
      "gas_cup_visible": <bool>
    }
  },
  "raw_scores": {
    "bead_consistency":  <0–100>,
    "penetration":       <0–100>,
    "spatter":           <0–100>,
    "undercut":          <0–100>,
    "overlap":           <0–100>,
    "porosity":          <0–100>,
    "crack_indication":  <0–100>,
    "straightness":      <0–100>,
    "starts_stops":      <0–100>,
    "color_oxidation":   <0–100>
  },
  "defects": [
    {
      "code": "<defect_code>",
      "confidence": 0.0–1.0,
      "location_note": "<description of where in the image>",
      "bounding_box": {"x": <0–100>, "y": <0–100>, "width": <0–100>, "height": <0–100>} | null
    }
  ]
}

SCORING RUBRIC — score each dimension 0–100:

bead_consistency (uniformity of width and height along full length)
  100 = perfectly uniform ripple pattern, consistent crown height
   75 = minor variation in width or height, acceptable
   50 = noticeable waviness or uneven crown
   25 = significant irregularity, multiple width changes
    0 = chaotic bead, no consistency

penetration (fusion depth relative to base material)
  100 = full fusion visible, proper tie-in at toes
   75 = good fusion, minor lack of tie-in at edges
   50 = partial fusion, visible cold areas
   25 = significant lack of fusion
    0 = no apparent fusion / burn-through present

spatter (deposits around the weld zone — higher score = less spatter)
  100 = zero spatter
   75 = trace spatter, isolated particles only
   50 = moderate spatter within 25mm of toe
   25 = heavy spatter field
    0 = extreme spatter covering base metal

undercut (groove depth at weld toes — higher score = no undercut)
  100 = no undercut
   75 = trace undercut, under 0.4mm
   50 = undercut present, under 0.8mm
   25 = undercut exceeds 0.8mm intermittently
    0 = continuous deep undercut

overlap (weld metal extending beyond toe without fusion)
  100 = no overlap
   75 = trace rollover at toe, fused
   50 = visible overlap, minor cold lap
   25 = cold lap present along weld
    0 = severe overlap/cold lap

porosity (gas pockets — higher score = no porosity)
  100 = no porosity
   75 = 1–2 isolated pores, small
   50 = scattered porosity or one cluster
   25 = multiple clusters
    0 = heavy porosity throughout

crack_indication (visible cracks anywhere — higher score = no cracks)
  100 = no cracks
   50 = possible indication, uncertain
    0 = definite crack present (centerline, crater, HAZ, or transverse)

straightness (bead tracks intended joint path)
  100 = perfectly straight
   75 = minor deviation under 2mm
   50 = wanders 2–4mm from centerline
   25 = significant wander over 4mm
    0 = severe deviation

starts_stops (quality of tie-ins and crater fill)
  100 = seamless restarts, craters filled
   75 = minor cold tie-in or slight crater
   50 = visible restart mark or unfilled crater
   25 = multiple poor restarts
    0 = severe crater cracking or cold laps at every stop

color_oxidation (heat tint — score 0 if process is MIG/STICK/FCAW)
  100 = bright silver (TIG on stainless — perfect shielding)
   75 = light gold tint (acceptable)
   50 = dark gold / light blue (marginal shielding)
   25 = blue / grey (poor shielding)
    0 = black / burnt (no shielding coverage)

DEFECT CODES — only report defects you can see with confidence > 0.5:
  wavy_bead, uneven_width, sagging_bead,
  lack_of_fusion, incomplete_penetration, burn_through,
  heavy_spatter, spatter_islands,
  toe_undercut, intermittent_undercut,
  cold_lap,
  surface_porosity, cluster_porosity, scattered_porosity,
  centerline_crack, crater_crack, haz_crack, transverse_crack,
  weld_wander,
  unfilled_crater, poor_restart,
  heavy_oxidation, black_oxidation

Bounding box coordinates are percentages of image dimensions (0–100).
If you cannot determine a bounding box, set it to null.
Return ONLY the JSON object.
"""


# ------------------------------------------------------------------
# Main callable
# ------------------------------------------------------------------

def analyze_weld_photo(
    image_source: str | Path | bytes,
    mime_type: str = "image/jpeg",
) -> VisionResult:
    """
    Send a weld photo to Claude and return structured vision results.

    Args:
        image_source: File path, S3 URL string, or raw bytes
        mime_type:    MIME type of the image (image/jpeg or image/png)

    Returns:
        VisionResult with raw_scores, defects, and process detection
    """
    client = anthropic.Anthropic()

    image_block = _build_image_block(image_source, mime_type)

    message = client.messages.create(
        model=AI_MODEL_VERSION,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    image_block,
                    {"type": "text", "text": RUBRIC_PROMPT},
                ],
            }
        ],
    )

    raw_json = _extract_json(message.content[0].text)
    return _parse_vision_response(raw_json)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _build_image_block(source: str | Path | bytes, mime_type: str) -> dict:
    if isinstance(source, bytes):
        encoded = base64.standard_b64encode(source).decode("utf-8")
        return {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": encoded}}

    if isinstance(source, Path) or (isinstance(source, str) and not source.startswith("http")):
        data = Path(source).read_bytes()
        encoded = base64.standard_b64encode(data).decode("utf-8")
        return {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": encoded}}

    # URL
    return {"type": "image", "source": {"type": "url", "url": source}}


def _extract_json(text: str) -> dict:
    text = text.strip()
    # Strip markdown fences if Claude adds them despite instructions
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def _parse_vision_response(data: dict) -> VisionResult:
    pd = data["process_detection"]
    process_detection = ProcessDetection(
        process=WeldProcess(pd["suggested_process"]),
        confidence=float(pd["confidence"]),
        signals=pd.get("signals", {}),
    )

    defects = [
        DefectFinding(
            code=d["code"],
            confidence=float(d["confidence"]),
            location_note=d.get("location_note"),
            bounding_box=d.get("bounding_box"),
        )
        for d in data.get("defects", [])
    ]

    return VisionResult(
        raw_scores=data["raw_scores"],
        defects=defects,
        process_detection=process_detection,
        ai_model_version=AI_MODEL_VERSION,
    )
