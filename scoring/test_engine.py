"""Quick smoke tests for the scoring engine."""

from engine import calculate_score, WeldProcess, Grade


def test_clean_mig_weld():
    raw = {
        "bead_consistency": 90,
        "penetration":      88,
        "spatter":          85,
        "undercut":         92,
        "overlap":          95,
        "porosity":         91,
        "crack_indication": 94,
        "straightness":     89,
        "starts_stops":     87,
        "color_oxidation":   0,  # not scored for MIG
    }
    result = calculate_score(WeldProcess.MIG, raw, ai_model_version="v1.0")
    assert result.total_score >= 85, f"Expected A, got {result.total_score}"
    assert result.grade in (Grade.A_PLUS, Grade.A)
    print(f"Clean MIG:  {result.total_score}/100  {result.grade}")


def test_rough_stick_weld():
    raw = {
        "bead_consistency": 55,
        "penetration":      60,
        "spatter":          50,
        "undercut":         45,
        "overlap":          70,
        "porosity":         65,
        "crack_indication": 80,
        "straightness":     72,
        "starts_stops":     58,
        "color_oxidation":   0,
    }
    result = calculate_score(WeldProcess.STICK, raw, ai_model_version="v1.0")
    assert result.total_score < 70, f"Expected below B, got {result.total_score}"
    print(f"Rough Stick: {result.total_score}/100  {result.grade}")
    print(f"  Tips: {result.improvement_tips}")


def test_tig_oxidation_penalty():
    raw = {
        "bead_consistency": 88,
        "penetration":      85,
        "spatter":          95,
        "undercut":         90,
        "overlap":          92,
        "porosity":         88,
        "crack_indication": 91,
        "straightness":     87,
        "starts_stops":     84,
        "color_oxidation":  20,  # heavy oxidation drags TIG score
    }
    result = calculate_score(WeldProcess.TIG, raw, ai_model_version="v1.0")
    print(f"TIG oxidation: {result.total_score}/100  {result.grade}")
    worst_dim = result.dimensions[0]
    assert worst_dim.dimension == "color_oxidation"
    print(f"  Worst dimension: {worst_dim.dimension} ({worst_dim.raw_score})")


def test_minimum_score_floor():
    raw = {d: 0 for d in [
        "bead_consistency", "penetration", "spatter", "undercut",
        "overlap", "porosity", "crack_indication", "straightness",
        "starts_stops", "color_oxidation"
    ]}
    result = calculate_score(WeldProcess.MIG, raw, ai_model_version="v1.0")
    assert result.total_score == 1, f"Floor should be 1, got {result.total_score}"
    print(f"All-zero MIG:  {result.total_score}/100  {result.grade}")


if __name__ == "__main__":
    test_clean_mig_weld()
    test_rough_stick_weld()
    test_tig_oxidation_penalty()
    test_minimum_score_floor()
    print("\nAll tests passed.")
