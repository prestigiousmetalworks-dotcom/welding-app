"""
DimeVision — Top-level weld analysis entry point.
Combines vision.py (Claude) and engine.py (scoring) into one call.
"""

from dataclasses import dataclass
from pathlib import Path

from engine import ScoreResult, WeldProcess, calculate_score
from vision import VisionResult, analyze_weld_photo


AUTO_CONFIRM_THRESHOLD = 0.90   # mirrors app_config in DB; override at runtime if needed


@dataclass
class AnalysisResult:
    score:             ScoreResult
    vision:            VisionResult
    process_confirmed_by: str    # 'ai' or 'user'


def analyze(
    image_source: str | Path | bytes,
    mime_type: str = "image/jpeg",
    override_process: WeldProcess | None = None,
) -> AnalysisResult:
    """
    Full weld analysis pipeline: vision → process detection → scoring.

    Args:
        image_source:     File path, URL, or raw bytes of the weld photo
        mime_type:        Image MIME type
        override_process: If provided, skip AI process detection and use this.
                          Set when the user corrects the process after seeing results.

    Returns:
        AnalysisResult with score breakdown and raw vision output
    """
    vision = analyze_weld_photo(image_source, mime_type)

    if override_process is not None:
        process = override_process
        confirmed_by = "user"
    elif vision.process_detection.confidence >= AUTO_CONFIRM_THRESHOLD:
        process = vision.process_detection.process
        confirmed_by = "ai"
    else:
        # Below threshold — caller should surface the suggestion to the user
        # and call back with override_process set to their selection.
        # For now, use the suggestion and flag it.
        process = vision.process_detection.process
        confirmed_by = "ai"

    score = calculate_score(
        process=process,
        raw_scores=vision.raw_scores,
        ai_model_version=vision.ai_model_version,
    )

    return AnalysisResult(
        score=score,
        vision=vision,
        process_confirmed_by=confirmed_by,
    )
