"""
DimeVision Weld Scoring Engine
Calculates a 1-100 score from per-dimension raw scores using
process-specific weights.
"""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


# ------------------------------------------------------------------
# Enums
# ------------------------------------------------------------------

class WeldProcess(str, Enum):
    MIG   = "MIG"
    TIG   = "TIG"
    STICK = "STICK"
    FCAW  = "FCAW"


class Grade(str, Enum):
    A_PLUS = "A+"
    A      = "A"
    B      = "B"
    C      = "C"
    D      = "D"
    F      = "F"


# ------------------------------------------------------------------
# Dimension weights per process
# Values match process_dimension_weight table in schema.
# Keys match score_dimension.code.
# ------------------------------------------------------------------

PROCESS_WEIGHTS: dict[WeldProcess, dict[str, float]] = {
    WeldProcess.MIG: {
        "bead_consistency": 20.0,
        "penetration":      18.0,
        "spatter":          15.0,
        "undercut":         12.0,
        "overlap":           8.0,
        "porosity":         10.0,
        "crack_indication": 10.0,
        "straightness":      4.0,
        "starts_stops":      3.0,
        "color_oxidation":   0.0,
    },
    WeldProcess.TIG: {
        "bead_consistency": 18.0,
        "penetration":      18.0,
        "spatter":           5.0,
        "undercut":         12.0,
        "overlap":           8.0,
        "porosity":         10.0,
        "crack_indication": 10.0,
        "straightness":      5.0,
        "starts_stops":      4.0,
        "color_oxidation":  10.0,
    },
    WeldProcess.STICK: {
        "bead_consistency": 18.0,
        "penetration":      20.0,
        "spatter":          10.0,
        "undercut":         15.0,
        "overlap":           8.0,
        "porosity":         10.0,
        "crack_indication": 12.0,
        "straightness":      3.0,
        "starts_stops":      4.0,
        "color_oxidation":   0.0,
    },
    WeldProcess.FCAW: {
        "bead_consistency": 18.0,
        "penetration":      18.0,
        "spatter":          12.0,
        "undercut":         14.0,
        "overlap":           8.0,
        "porosity":         12.0,
        "crack_indication": 10.0,
        "straightness":      4.0,
        "starts_stops":      4.0,
        "color_oxidation":   0.0,
    },
}

GRADE_BANDS: list[tuple[int, Grade]] = [
    (95, Grade.A_PLUS),
    (85, Grade.A),
    (70, Grade.B),
    (55, Grade.C),
    (40, Grade.D),
    (0,  Grade.F),
]


# ------------------------------------------------------------------
# Data structures
# ------------------------------------------------------------------

@dataclass
class DimensionScore:
    dimension:     str
    raw_score:     float   # 0–100 as assessed by AI vision model
    weight:        float   # from PROCESS_WEIGHTS
    weighted_score: float  # raw_score * (weight / total_active_weight)


@dataclass
class ScoreResult:
    total_score:      int                        # 1–100, final rounded score
    grade:            Grade
    process:          WeldProcess
    dimensions:       list[DimensionScore]
    ai_model_version: str
    improvement_tips: list[str] = field(default_factory=list)


# ------------------------------------------------------------------
# Core scoring function
# ------------------------------------------------------------------

def calculate_score(
    process: WeldProcess,
    raw_scores: dict[str, float],   # {dimension_code: 0–100}
    ai_model_version: str,
    improvement_tips: Optional[list[str]] = None,
) -> ScoreResult:
    """
    Calculate a 1–100 weld score from AI-assessed dimension raw scores.

    Args:
        process:           Weld process (MIG / TIG / STICK / FCAW)
        raw_scores:        Dict of dimension code → raw score (0–100)
        ai_model_version:  Version string of the AI model that produced raw_scores
        improvement_tips:  Optional ordered list of feedback strings

    Returns:
        ScoreResult with total score, grade, and per-dimension breakdown
    """
    _validate_raw_scores(raw_scores)

    weights = PROCESS_WEIGHTS[process]

    # Only include dimensions with weight > 0 (e.g. color_oxidation skipped for MIG)
    active_weights = {dim: w for dim, w in weights.items() if w > 0}
    total_weight = sum(active_weights.values())

    dimensions: list[DimensionScore] = []
    weighted_sum = 0.0

    for dim, weight in active_weights.items():
        raw = raw_scores.get(dim, 0.0)
        normalised_weight = weight / total_weight
        weighted = raw * normalised_weight
        weighted_sum += weighted
        dimensions.append(DimensionScore(
            dimension=dim,
            raw_score=raw,
            weight=normalised_weight,
            weighted_score=weighted,
        ))

    total_score = max(1, min(100, round(weighted_sum)))

    return ScoreResult(
        total_score=total_score,
        grade=_grade(total_score),
        process=process,
        dimensions=sorted(dimensions, key=lambda d: d.weighted_score),
        ai_model_version=ai_model_version,
        improvement_tips=improvement_tips or _auto_tips(dimensions),
    )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _grade(score: int) -> Grade:
    for threshold, grade in GRADE_BANDS:
        if score >= threshold:
            return grade
    return Grade.F


def _validate_raw_scores(raw_scores: dict[str, float]) -> None:
    for dim, val in raw_scores.items():
        if not (0.0 <= val <= 100.0):
            raise ValueError(f"Raw score for '{dim}' must be 0–100, got {val}")


def _auto_tips(dimensions: list[DimensionScore]) -> list[str]:
    """Return up to 3 improvement tips based on the lowest-scoring dimensions."""
    tips_map = {
        "bead_consistency":  "Work on maintaining consistent travel speed — uneven ripple patterns indicate speed changes mid-pass.",
        "penetration":       "Increase amperage or slow travel speed to improve fusion depth into the base material.",
        "spatter":           "Check wire feed tension, reduce voltage slightly, or verify your shielding gas flow rate.",
        "undercut":          "Reduce amperage or increase travel speed, and ensure correct electrode angle at the toes.",
        "overlap":           "Increase travel speed or reduce wire feed — weld metal is pooling over the base without fusing.",
        "porosity":          "Check for moisture contamination, verify shielding gas coverage, and clean the base metal.",
        "crack_indication":  "Review preheat requirements for this material and ensure proper crater fill at weld stops.",
        "straightness":      "Use a guide or chalk line for long runs — wander indicates loss of joint tracking.",
        "starts_stops":      "Back-step restarts and use a run-off tab or fill-crater technique at weld terminations.",
        "color_oxidation":   "Increase post-flow gas time and check for drafts — heavy oxidation means the puddle lost shielding.",
    }

    worst = sorted(dimensions, key=lambda d: d.raw_score)[:3]
    return [tips_map[d.dimension] for d in worst if d.dimension in tips_map]
