-- ============================================================
-- DimeVision — Weld Scoring Engine Schema
-- Score range: 1–100
-- Architecture: universal rubric + per-process weight modifiers
-- ============================================================


-- ------------------------------------------------------------
-- APP CONFIG: Tunable parameters (no deploy needed to adjust)
-- ------------------------------------------------------------
CREATE TABLE app_config (
    key         VARCHAR(60)  PRIMARY KEY,
    value       TEXT         NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO app_config (key, value, description) VALUES
    ('process_detection.auto_confirm_threshold', '0.90',
     'AI confidence level (0–1) at or above which the detected process is auto-confirmed without asking the user'),
    ('process_detection.low_confidence_threshold', '0.60',
     'Below this confidence the app warns the user that detection is uncertain before auto-confirming');


-- ------------------------------------------------------------
-- REFERENCE: Weld processes supported
-- ------------------------------------------------------------
CREATE TABLE weld_process (
    id          SMALLINT PRIMARY KEY,
    code        VARCHAR(10)  NOT NULL UNIQUE,  -- 'MIG','TIG','STICK','FCAW'
    name        VARCHAR(50)  NOT NULL,
    description TEXT
);

INSERT INTO weld_process (id, code, name, description) VALUES
    (1, 'MIG',   'MIG (GMAW)',        'Gas Metal Arc Welding'),
    (2, 'TIG',   'TIG (GTAW)',        'Gas Tungsten Arc Welding'),
    (3, 'STICK', 'Stick (SMAW)',      'Shielded Metal Arc Welding'),
    (4, 'FCAW',  'Flux-Core (FCAW)',  'Flux-Cored Arc Welding');


-- ------------------------------------------------------------
-- REFERENCE: Scoring dimensions (the rubric axes)
-- ------------------------------------------------------------
CREATE TABLE score_dimension (
    id            SMALLINT PRIMARY KEY,
    code          VARCHAR(30)  NOT NULL UNIQUE,
    name          VARCHAR(60)  NOT NULL,
    description   TEXT,
    display_order SMALLINT     NOT NULL DEFAULT 0
);

INSERT INTO score_dimension (id, code, name, description, display_order) VALUES
    (1,  'bead_consistency',   'Bead Consistency',    'Uniformity of bead width and height along the full length',          1),
    (2,  'penetration',        'Penetration',         'Fusion depth relative to base material thickness',                    2),
    (3,  'spatter',            'Spatter',             'Amount and distribution of spatter deposits around the weld zone',    3),
    (4,  'undercut',           'Undercut',            'Groove depth along the toes of the weld',                             4),
    (5,  'overlap',            'Overlap / Rollover',  'Weld metal extending beyond the toe without fusion',                  5),
    (6,  'porosity',           'Porosity',            'Surface or subsurface gas pockets visible in the bead',               6),
    (7,  'crack_indication',   'Crack Indication',    'Visible cracks, crater cracks, or heat-affected zone cracking',       7),
    (8,  'straightness',       'Straightness',        'How well the bead tracks the intended joint path',                    8),
    (9,  'starts_stops',       'Starts & Stops',      'Quality of tie-ins, restarts, and crater fill at weld terminations',  9),
    (10, 'color_oxidation',    'Color / Oxidation',   'Heat tint and oxidation pattern (process-relevant for TIG/stainless)',10);


-- ------------------------------------------------------------
-- REFERENCE: Per-process dimension weights
-- Weight values are relative — engine normalises to 100 pts
-- ------------------------------------------------------------
CREATE TABLE process_dimension_weight (
    process_id    SMALLINT     NOT NULL REFERENCES weld_process(id),
    dimension_id  SMALLINT     NOT NULL REFERENCES score_dimension(id),
    weight        NUMERIC(5,2) NOT NULL CHECK (weight >= 0),
    PRIMARY KEY (process_id, dimension_id)
);

-- MIG weights
INSERT INTO process_dimension_weight VALUES
    (1, 1,  20.00),  -- bead_consistency
    (1, 2,  18.00),  -- penetration
    (1, 3,  15.00),  -- spatter
    (1, 4,  12.00),  -- undercut
    (1, 5,   8.00),  -- overlap
    (1, 6,  10.00),  -- porosity
    (1, 7,  10.00),  -- crack_indication
    (1, 8,   4.00),  -- straightness
    (1, 9,   3.00),  -- starts_stops
    (1, 10,  0.00);  -- color_oxidation (not scored for MIG)

-- TIG weights
INSERT INTO process_dimension_weight VALUES
    (2, 1,  18.00),  -- bead_consistency
    (2, 2,  18.00),  -- penetration
    (2, 3,   5.00),  -- spatter (minimal for TIG)
    (2, 4,  12.00),  -- undercut
    (2, 5,   8.00),  -- overlap
    (2, 6,  10.00),  -- porosity
    (2, 7,  10.00),  -- crack_indication
    (2, 8,   5.00),  -- straightness
    (2, 9,   4.00),  -- starts_stops
    (2, 10, 10.00);  -- color_oxidation (important for TIG)

-- Stick weights
INSERT INTO process_dimension_weight VALUES
    (3, 1,  18.00),  -- bead_consistency
    (3, 2,  20.00),  -- penetration (critical for structural)
    (3, 3,  10.00),  -- spatter
    (3, 4,  15.00),  -- undercut (high consequence in structural)
    (3, 5,   8.00),  -- overlap
    (3, 6,  10.00),  -- porosity
    (3, 7,  12.00),  -- crack_indication
    (3, 8,   3.00),  -- straightness
    (3, 9,   4.00),  -- starts_stops
    (3, 10,  0.00);  -- color_oxidation

-- Flux-core weights
INSERT INTO process_dimension_weight VALUES
    (4, 1,  18.00),  -- bead_consistency
    (4, 2,  18.00),  -- penetration
    (4, 3,  12.00),  -- spatter
    (4, 4,  14.00),  -- undercut
    (4, 5,   8.00),  -- overlap
    (4, 6,  12.00),  -- porosity
    (4, 7,  10.00),  -- crack_indication
    (4, 8,   4.00),  -- straightness
    (4, 9,   4.00),  -- starts_stops
    (4, 10,  0.00);  -- color_oxidation


-- ------------------------------------------------------------
-- REFERENCE: Defect taxonomy
-- severity: 1=cosmetic  2=minor  3=major  4=critical
-- ------------------------------------------------------------
CREATE TABLE defect_type (
    id               SMALLINT PRIMARY KEY,
    code             VARCHAR(40)  NOT NULL UNIQUE,
    name             VARCHAR(80)  NOT NULL,
    dimension_id     SMALLINT     NOT NULL REFERENCES score_dimension(id),
    severity         SMALLINT     NOT NULL CHECK (severity BETWEEN 1 AND 4),
    score_deduction  NUMERIC(5,2) NOT NULL DEFAULT 0,  -- pts deducted from dimension raw score
    description      TEXT
);

INSERT INTO defect_type (id, code, name, dimension_id, severity, score_deduction, description) VALUES
    -- Bead Consistency defects
    (1,  'wavy_bead',           'Wavy / Irregular Bead',          1, 2,  8.00, 'Non-uniform ripple pattern indicating inconsistent travel speed'),
    (2,  'uneven_width',        'Uneven Bead Width',               1, 2,  8.00, 'Bead width varies more than 20% along its length'),
    (3,  'sagging_bead',        'Sagging / Convex Bead',           1, 2,  6.00, 'Excessive crown height indicating too slow travel or high wire speed'),
    -- Penetration defects
    (4,  'lack_of_fusion',      'Lack of Fusion',                  2, 4, 25.00, 'Weld metal failed to fuse with base metal — critical structural defect'),
    (5,  'incomplete_penetration','Incomplete Joint Penetration',  2, 3, 15.00, 'Root pass did not achieve required depth'),
    (6,  'burn_through',        'Burn-Through',                    2, 3, 15.00, 'Excessive penetration melting through the base material'),
    -- Spatter defects
    (7,  'heavy_spatter',       'Heavy Spatter Field',             3, 2,  8.00, 'Dense spatter coverage within 25mm of weld toe'),
    (8,  'spatter_islands',     'Spatter Islands',                 3, 1,  4.00, 'Isolated spatter deposits beyond the immediate weld zone'),
    -- Undercut defects
    (9,  'toe_undercut',        'Toe Undercut',                    4, 3, 12.00, 'Groove at weld toe exceeding 0.8mm depth'),
    (10, 'intermittent_undercut','Intermittent Undercut',          4, 2,  6.00, 'Isolated undercut not exceeding 10% of weld length'),
    -- Overlap defects
    (11, 'cold_lap',            'Cold Lap / Overlap',              5, 3, 12.00, 'Weld metal folded over base plate without fusion'),
    -- Porosity defects
    (12, 'surface_porosity',    'Surface Porosity',                6, 3, 12.00, 'Gas pockets visible at the weld face'),
    (13, 'cluster_porosity',    'Cluster Porosity',                6, 3, 14.00, 'Group of gas pockets concentrated in one area'),
    (14, 'scattered_porosity',  'Scattered Porosity',              6, 2,  8.00, 'Isolated pores distributed along the weld length'),
    -- Crack defects
    (15, 'centerline_crack',    'Centerline Crack',                7, 4, 30.00, 'Longitudinal crack along the weld centerline'),
    (16, 'crater_crack',        'Crater Crack',                    7, 3, 18.00, 'Crack at weld termination crater'),
    (17, 'haz_crack',           'HAZ Crack',                       7, 4, 30.00, 'Crack in the heat-affected zone adjacent to the weld'),
    (18, 'transverse_crack',    'Transverse Crack',                7, 4, 30.00, 'Crack perpendicular to the weld axis'),
    -- Straightness defects
    (19, 'weld_wander',         'Weld Wander',                     8, 2,  8.00, 'Bead deviates more than 3mm from intended joint centerline'),
    -- Starts & Stops defects
    (20, 'unfilled_crater',     'Unfilled Crater',                 9, 2,  8.00, 'Depression at weld stop not properly filled'),
    (21, 'poor_restart',        'Poor Restart / Cold Tie-In',      9, 2,  6.00, 'Visible cold lap or lack of fusion at a weld restart'),
    -- Color / Oxidation defects (TIG-relevant)
    (22, 'heavy_oxidation',     'Heavy Oxidation (Gold/Blue)',     10, 2,  8.00, 'Indicates insufficient shielding gas coverage'),
    (23, 'black_oxidation',     'Black / Burnt Oxidation',         10, 3, 15.00, 'Severe oxidation indicating contamination or no shielding gas');


-- ------------------------------------------------------------
-- RUNTIME: User process corrections (post-score "wrong process?" flow)
-- Captures every time a user overrides the AI after scoring completes.
-- Drives model retraining — each row is a labelled correction.
-- ------------------------------------------------------------
CREATE TABLE weld_process_correction (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID         NOT NULL REFERENCES weld_session(id),
    original_process_id SMALLINT     NOT NULL REFERENCES weld_process(id),  -- what AI used for scoring
    corrected_process_id SMALLINT    NOT NULL REFERENCES weld_process(id),  -- what user said it actually was
    corrected_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    rescore_requested   BOOLEAN      NOT NULL DEFAULT TRUE,                  -- user wants a fresh score on correct process
    rescored_at         TIMESTAMPTZ                                          -- NULL until rescore completes
);


-- ------------------------------------------------------------
-- RUNTIME: A single weld analysis session
-- process_id      = AI-suggested process (set after detection runs)
-- confirmed_process_id = what the user accepted or corrected to
-- process_confirmed_by = 'ai' if user accepted suggestion, 'user' if overridden
-- ------------------------------------------------------------
CREATE TABLE weld_session (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID         NOT NULL,                          -- FK to users table
    media_url               TEXT         NOT NULL,                          -- S3 / CDN path to photo or video
    media_type              VARCHAR(10)  NOT NULL CHECK (media_type IN ('photo','video')),
    submitted_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    scored_at               TIMESTAMPTZ,                                    -- NULL until AI pipeline completes
    status                  VARCHAR(20)  NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','detecting','processing','scored','rescoring','failed')),
    -- Process detection outcome
    suggested_process_id    SMALLINT     REFERENCES weld_process(id),       -- AI top pick, NULL until detection completes
    confirmed_process_id    SMALLINT     REFERENCES weld_process(id),       -- final process used for scoring
    process_confirmed_by    VARCHAR(10)  CHECK (process_confirmed_by IN ('ai','user')),
    user_corrected_process  BOOLEAN      NOT NULL DEFAULT FALSE,             -- TRUE if user changed process after auto-confirm
    -- Optional user-supplied context
    material_type           VARCHAR(60),
    material_thickness_mm   NUMERIC(6,2),
    joint_type              VARCHAR(40),
    notes                   TEXT
);


-- ------------------------------------------------------------
-- RUNTIME: AI process detection — confidence per process
-- One row per process per session (always 4 rows after detection)
-- ------------------------------------------------------------
CREATE TABLE weld_process_detection (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID         NOT NULL REFERENCES weld_session(id),
    process_id      SMALLINT     NOT NULL REFERENCES weld_process(id),
    confidence      NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    ai_model_version VARCHAR(30) NOT NULL,
    detected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Visual signals the model used to reach this confidence
    detection_signals JSONB,     -- e.g. {"spatter_pattern": 0.91, "bead_profile": 0.87, "electrode_stub_visible": false}
    UNIQUE (session_id, process_id)
);


-- ------------------------------------------------------------
-- RUNTIME: Composite score result for a session
-- ------------------------------------------------------------
CREATE TABLE weld_score (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID         NOT NULL UNIQUE REFERENCES weld_session(id),
    total_score         SMALLINT     NOT NULL CHECK (total_score BETWEEN 1 AND 100),
    grade               VARCHAR(5)   NOT NULL,   -- 'A+','A','B','C','D','F'
    ai_model_version    VARCHAR(30)  NOT NULL,
    scored_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    summary_feedback    TEXT,                    -- AI-generated one-paragraph summary
    improvement_tips    TEXT[]                   -- ordered list of actionable tips
);


-- ------------------------------------------------------------
-- RUNTIME: Per-dimension breakdown scores
-- ------------------------------------------------------------
CREATE TABLE weld_score_dimension (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id        UUID         NOT NULL REFERENCES weld_score(id),
    dimension_id    SMALLINT     NOT NULL REFERENCES score_dimension(id),
    raw_score       NUMERIC(5,2) NOT NULL CHECK (raw_score BETWEEN 0 AND 100),
    weighted_score  NUMERIC(5,2) NOT NULL,   -- raw_score * (weight / total_weight)
    UNIQUE (score_id, dimension_id)
);


-- ------------------------------------------------------------
-- RUNTIME: Defects detected in a session
-- ------------------------------------------------------------
CREATE TABLE weld_defect_finding (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id        UUID         NOT NULL REFERENCES weld_score(id),
    defect_type_id  SMALLINT     NOT NULL REFERENCES defect_type(id),
    confidence      NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),  -- AI confidence 0.000–1.000
    location_note   TEXT,        -- e.g. "approx 40mm from start, left toe"
    bounding_box    JSONB        -- {x, y, width, height} as % of image if photo
);


-- ------------------------------------------------------------
-- RUNTIME: Score history view (for Progress Tracking feature)
-- ------------------------------------------------------------
CREATE VIEW v_user_score_history AS
SELECT
    ws.user_id,
    wse.id              AS session_id,
    wse.process_id,
    wp.code             AS process_code,
    wsc.total_score,
    wsc.grade,
    wse.submitted_at
FROM weld_session wse
JOIN weld_process wp   ON wp.id  = wse.process_id
JOIN weld_score   wsc  ON wsc.session_id = wse.id
JOIN weld_session ws   ON ws.id  = wse.id
ORDER BY wse.submitted_at DESC;


-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
CREATE INDEX idx_weld_session_user              ON weld_session(user_id);
CREATE INDEX idx_weld_session_suggested_process ON weld_session(suggested_process_id);
CREATE INDEX idx_weld_session_confirmed_process ON weld_session(confirmed_process_id);
CREATE INDEX idx_weld_session_status            ON weld_session(status);
CREATE INDEX idx_process_detection_session      ON weld_process_detection(session_id);
CREATE INDEX idx_process_correction_session     ON weld_process_correction(session_id);
CREATE INDEX idx_process_correction_rescore     ON weld_process_correction(rescore_requested, rescored_at)
    WHERE rescore_requested = TRUE AND rescored_at IS NULL;  -- fast queue lookup for pending rescores
CREATE INDEX idx_weld_score_session    ON weld_score(session_id);
CREATE INDEX idx_weld_score_dim_score  ON weld_score_dimension(score_id);
CREATE INDEX idx_defect_finding_score  ON weld_defect_finding(score_id);
