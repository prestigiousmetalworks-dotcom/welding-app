import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { supabase } from './lib/supabase';

type Screen = 'signin' | 'onboarding' | 'app';
type Tab = 'analyze' | 'machine' | 'progress' | 'community' | 'profile';
type OnboardingStep = 'welcome' | 'username' | 'processes' | 'follow' | 'done';
type AnalyzeState = 'capture' | 'processing' | 'results' | 'posting' | 'posted';
type Visibility = 'public' | 'followers' | 'private';

const DIMENSIONS = [
  { label: 'Bead Consistency', score: 88 },
  { label: 'Penetration',      score: 91 },
  { label: 'Spatter',          score: 74 },
  { label: 'Undercut',         score: 95 },
  { label: 'Overlap',          score: 98 },
  { label: 'Porosity',         score: 82 },
  { label: 'Crack Indication', score: 100 },
  { label: 'Straightness',     score: 79 },
  { label: 'Starts & Stops',   score: 71 },
];

const TIPS = [
  'Reduce voltage slightly to cut down spatter — try dropping 1–2V and test on scrap.',
  'Work on your starts — back-step into the weld to improve tie-in quality.',
  'Travel speed was inconsistent mid-pass — aim for a steady drag rhythm.',
];

const DEFECTS = [
  { label: 'Heavy Spatter Field', severity: 'Minor', location: 'approx 30mm from start' },
  { label: 'Poor Restart',        severity: 'Minor', location: 'mid-bead restart point' },
];

function scoreColor(score: number) {
  if (score >= 85) return '#4CAF50';   // A / A+ — green
  if (score >= 70) return '#F0A500';   // B — deep amber (distinct from orange)
  if (score >= 55) return '#FF5500';   // C — vivid orange
  return '#CB2027';                    // D / F — red
}

function gradeFromScore(score: number) {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function PostWeldScreen({ score, grade, process, onPost, onCancel }: {
  score: number; grade: string; process: string;
  onPost: () => void; onCancel: () => void;
}) {
  const [caption, setCaption]         = useState('');
  const [visibility, setVisibility]   = useState<Visibility>('public');
  const [challenge, setChallenge]     = useState(false);
  const [posting, setPosting]         = useState(false);

  const visibilityOptions: { value: Visibility; label: string; desc: string }[] = [
    { value: 'public',    label: 'PUBLIC',    desc: 'Anyone on HotPass' },
    { value: 'followers', label: 'FOLLOWERS', desc: 'Only people you follow' },
    { value: 'private',   label: 'PRIVATE',   desc: 'Only you' },
  ];

  function handlePost() {
    setPosting(true);
    setTimeout(() => { setPosting(false); onPost(); }, 1200);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.machineContent}>
      <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back to Results</Text>
      </TouchableOpacity>

      <Text style={styles.screenTitle}>POST WELD</Text>
      <Text style={styles.screenSub}>Share your result with the community.</Text>

      {/* Score preview card */}
      <View style={styles.postPreviewCard}>
        <View style={styles.postPreviewLeft}>
          <View style={styles.postPreviewImageBox}>
            <Text style={{ fontSize: 28, opacity: 0.4 }}>🔥</Text>
          </View>
        </View>
        <View style={styles.postPreviewRight}>
          <View style={[styles.processPill, { alignSelf: 'flex-start', marginBottom: 8 }]}>
            <Text style={styles.processPillText}>{process}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={[styles.postPreviewScore, { color: scoreColor(score) }]}>{score}</Text>
            <Text style={[styles.postPreviewGrade, { color: scoreColor(score) }]}>{grade}</Text>
          </View>
          <Text style={styles.postPreviewLabel}>WELD SCORE</Text>
        </View>
      </View>

      {/* Caption */}
      <Text style={[styles.selectorLabel, { marginTop: 20, marginBottom: 8 }]}>CAPTION</Text>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 12 }]}
        placeholder="Describe your weld, technique, or setup..."
        placeholderTextColor="#333"
        multiline
        maxLength={280}
        value={caption}
        onChangeText={setCaption}
      />
      <Text style={styles.captionCount}>{caption.length}/280</Text>

      {/* Visibility */}
      <Text style={[styles.selectorLabel, { marginTop: 20, marginBottom: 12 }]}>VISIBILITY</Text>
      {visibilityOptions.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.visibilityRow, visibility === opt.value && styles.visibilityRowActive]}
          onPress={() => setVisibility(opt.value)}
        >
          <View style={[styles.visibilityRadio, visibility === opt.value && styles.visibilityRadioActive]}>
            {visibility === opt.value && <View style={styles.visibilityRadioDot} />}
          </View>
          <View>
            <Text style={[styles.visibilityLabel, visibility === opt.value && { color: '#fff' }]}>{opt.label}</Text>
            <Text style={styles.visibilityDesc}>{opt.desc}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Enter challenge toggle */}
      <TouchableOpacity
        style={[styles.challengeToggle, challenge && styles.challengeToggleActive]}
        onPress={() => setChallenge(v => !v)}
      >
        <View>
          <Text style={[styles.challengeToggleTitle, challenge && { color: '#CB2027' }]}>
            🏆  ENTER WEEKLY CHALLENGE
          </Text>
          <Text style={styles.challengeToggleDesc}>TIG on Stainless · 2G · 4d 11h left</Text>
        </View>
        <View style={[styles.toggleSwitch, challenge && styles.toggleSwitchOn]}>
          <View style={[styles.toggleKnob, challenge && styles.toggleKnobOn]} />
        </View>
      </TouchableOpacity>

      {/* Post button */}
      <TouchableOpacity
        style={[styles.button, { marginHorizontal: 0, marginTop: 24, opacity: posting ? 0.7 : 1 }]}
        onPress={handlePost}
        disabled={posting}
      >
        {posting
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.buttonText}>POST WELD</Text>
        }
      </TouchableOpacity>

    </ScrollView>
  );
}

function ViewfinderCorner({ position }: { position: 'tl'|'tr'|'bl'|'br' }) {
  const isRight = position.includes('r');
  const isBottom = position.includes('b');
  return (
    <View style={{
      position: 'absolute',
      top: isBottom ? undefined : 0,
      bottom: isBottom ? 0 : undefined,
      left: isRight ? undefined : 0,
      right: isRight ? 0 : undefined,
      width: 24, height: 24,
    }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#CB2027' }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#CB2027' }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, backgroundColor: '#CB2027' }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 2, backgroundColor: '#CB2027' }} />
    </View>
  );
}

function AnalyzeScreen() {
  const [state, setState] = useState<AnalyzeState>('capture');
  const [step, setStep] = useState(0);
  const totalScore = 83;
  const grade = gradeFromScore(totalScore);

  function handleAnalyze() {
    setState('processing');
    setStep(0);
    setTimeout(() => setStep(1), 700);
    setTimeout(() => setStep(2), 1400);
    setTimeout(() => setStep(3), 2100);
    setTimeout(() => setState('results'), 2800);
  }

  if (state === 'capture') {
    return (
      <View style={styles.captureScreen}>
        {/* Top readout bar */}
        <View style={styles.captureTopBar}>
          <Text style={styles.captureReadout}>RES 12MP</Text>
          <View style={styles.captureReadoutCenter}>
            <View style={styles.captureReadoutDot} />
            <Text style={styles.captureReadoutLabel}>READY</Text>
          </View>
          <Text style={styles.captureReadout}>AI v1.0</Text>
        </View>

        {/* Viewfinder */}
        <TouchableOpacity style={styles.viewfinder} onPress={handleAnalyze} activeOpacity={0.85}>
          {/* Corner brackets */}
          <ViewfinderCorner position="tl" />
          <ViewfinderCorner position="tr" />
          <ViewfinderCorner position="bl" />
          <ViewfinderCorner position="br" />

          {/* Grid lines */}
          <View style={styles.vfGridH1} />
          <View style={styles.vfGridH2} />
          <View style={styles.vfGridV1} />
          <View style={styles.vfGridV2} />

          {/* Center crosshair */}
          <View style={styles.vfCrosshairH} />
          <View style={styles.vfCrosshairV} />

          {/* Intentionally empty — no label in viewfinder */}

          {/* Bottom left tag */}
          <View style={styles.vfTag}>
            <Text style={styles.vfTagText}>HOTPASS · WELD ANALYZER</Text>
          </View>
        </TouchableOpacity>

        {/* Bottom panel */}
        <View style={styles.captureBottomPanel}>
          {/* Dimension preview pills */}
          <View style={styles.captureDimRow}>
            {['BEAD', 'PENETRATION', 'SPATTER', 'UNDERCUT', 'POROSITY'].map(d => (
              <View key={d} style={styles.captureDimPill}>
                <Text style={styles.captureDimText}>{d}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.captureBtn} onPress={handleAnalyze}>
            <View style={styles.captureBtnInner}>
              <View style={styles.captureBtnRing} />
              <View style={styles.captureBtnCore} />
            </View>
          </TouchableOpacity>
          <Text style={styles.captureHint}>PRESS TO ANALYZE WELD</Text>
        </View>
      </View>
    );
  }

  if (state === 'processing') {
    const steps = [
      { label: 'UPLOADING IMAGE',        done: step > 0, active: step === 0 },
      { label: 'DETECTING PROCESS TYPE', done: step > 1, active: step === 1 },
      { label: 'SCANNING FOR DEFECTS',   done: step > 2, active: step === 2 },
      { label: 'CALCULATING SCORE',      done: step > 3, active: step === 3 },
    ];
    const pct = Math.min(100, step * 25);

    return (
      <View style={styles.processingScreen}>
        <View style={styles.processingCard}>
          {/* Header */}
          <View style={styles.processingHeader}>
            <ActivityIndicator size="small" color="#CB2027" />
            <Text style={styles.processingTitle}>ANALYZING WELD</Text>
          </View>

          {/* Segmented progress bar */}
          <View style={styles.segBarRow}>
            {[0,1,2,3].map(i => (
              <View key={i} style={[styles.segBar, i < step ? styles.segBarDone : i === step ? styles.segBarActive : styles.segBarEmpty]} />
            ))}
          </View>
          <Text style={styles.processingPct}>{pct}%</Text>

          {/* Step log */}
          <View style={styles.processingLog}>
            {steps.map((s, i) => (
              <View key={i} style={styles.processingLogRow}>
                <Text style={[
                  styles.processingLogIcon,
                  s.done ? { color: '#4CAF50' } : s.active ? { color: '#CB2027' } : { color: '#222' }
                ]}>
                  {s.done ? '✓' : s.active ? '›' : '·'}
                </Text>
                <Text style={[
                  styles.processingLogText,
                  s.done ? { color: '#444' } : s.active ? { color: '#fff' } : { color: '#222' }
                ]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Technical readout */}
          <View style={styles.processingReadout}>
            <Text style={styles.processingReadoutText}>HOTPASS AI · CWI RUBRIC v1.0 · 10 DIMENSIONS</Text>
          </View>
        </View>
      </View>
    );
  }

  // Results
  return (
    <ScrollView style={styles.resultsScroll} contentContainerStyle={styles.resultsContent}>

      {/* Score hero */}
      <View style={styles.scoreHero}>
        <View style={styles.scoreHeroGlow} />
        <View style={styles.scoreHeroInner}>
          <Text style={styles.processTag}>MIG · AUTO-DETECTED</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreBig, { color: scoreColor(totalScore) }]}>{totalScore}</Text>
            <View style={styles.scoreRightCol}>
              <View style={[styles.gradeBadge, { borderColor: scoreColor(totalScore), backgroundColor: scoreColor(totalScore) + '22' }]}>
                <Text style={[styles.gradeText, { color: scoreColor(totalScore) }]}>{grade}</Text>
              </View>
              <Text style={styles.scoreLabel}>/ 100</Text>
              <Text style={styles.scoreSub}>WELD SCORE</Text>
            </View>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreQuickStats}>
            <View style={styles.scoreQuickStat}>
              <Text style={styles.scoreQuickVal}>2</Text>
              <Text style={styles.scoreQuickLabel}>DEFECTS</Text>
            </View>
            <View style={styles.scoreQuickDivider} />
            <View style={styles.scoreQuickStat}>
              <Text style={[styles.scoreQuickVal, { color: '#4CAF50' }]}>7</Text>
              <Text style={styles.scoreQuickLabel}>PASSING</Text>
            </View>
            <View style={styles.scoreQuickDivider} />
            <View style={styles.scoreQuickStat}>
              <Text style={styles.scoreQuickVal}>MIG</Text>
              <Text style={styles.scoreQuickLabel}>PROCESS</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Defects */}
      {DEFECTS.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DEFECTS FOUND</Text>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{DEFECTS.length}</Text></View>
          </View>
          {DEFECTS.map((d, i) => (
            <View key={i} style={styles.defectRow}>
              <View style={styles.defectIndicator} />
              <View style={styles.defectLeft}>
                <Text style={styles.defectName}>{d.label}</Text>
                <Text style={styles.defectLocation}>📍 {d.location}</Text>
              </View>
              <View style={styles.severityBadge}>
                <Text style={styles.severityText}>{d.severity}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Dimension breakdown */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>BREAKDOWN</Text>
          <Text style={styles.sectionSubtitle}>9 DIMENSIONS</Text>
        </View>
        <View style={styles.dimCard}>
          {DIMENSIONS.map((d, i) => (
            <View key={i} style={[styles.dimRow, i < DIMENSIONS.length - 1 && styles.dimRowBorder]}>
              <View style={styles.dimLabelRow}>
                <Text style={styles.dimLabel}>{d.label}</Text>
                <Text style={[styles.dimScore, { color: scoreColor(d.score) }]}>{d.score}</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${d.score}%` as any, backgroundColor: scoreColor(d.score), shadowColor: scoreColor(d.score), shadowOpacity: 0.6, shadowRadius: 4 }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Tips */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>IMPROVEMENT TIPS</Text>
        </View>
        {TIPS.map((tip, i) => (
          <View key={i} style={styles.tipCard}>
            <View style={styles.tipNumberBadge}>
              <Text style={styles.tipNumber}>{i + 1}</Text>
            </View>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* Wrong process */}
      <TouchableOpacity style={styles.wrongProcess}>
        <Text style={styles.wrongProcessText}>Wrong process? Tap to correct →</Text>
      </TouchableOpacity>

      {/* Action buttons */}
      <TouchableOpacity style={styles.button} onPress={() => setState('posting')}>
        <Text style={styles.buttonText}>SHARE TO COMMUNITY</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.buttonOutline} onPress={() => setState('capture')}>
        <Text style={styles.buttonOutlineText}>ANALYZE ANOTHER</Text>
      </TouchableOpacity>

    </ScrollView>
  );

  // Post a Weld
  if (state === 'posting') {
    return <PostWeldScreen
      score={totalScore}
      grade={grade}
      process="MIG"
      onPost={() => setState('posted')}
      onCancel={() => setState('results')}
    />;
  }

  if (state === 'posted') {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 56, marginBottom: 20 }}>🔥</Text>
        <Text style={styles.screenTitle}>POSTED!</Text>
        <Text style={[styles.screenSub, { textAlign: 'center' }]}>
          Your weld is live on the community feed.
        </Text>
        <TouchableOpacity style={[styles.button, { marginHorizontal: 0, width: 280 }]} onPress={() => setState('capture')}>
          <Text style={styles.buttonText}>ANALYZE ANOTHER</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

type SavedMachine = {
  id: string;
  name: string;
  brand: string;
  model: string;
  process: string;
};

type MachineView = 'main' | 'add';

const BRANDS = ['Miller', 'Lincoln', 'ESAB', 'Hobart', 'Everlast', 'YesWelder', 'Other'];
const PROCESSES = ['MIG', 'TIG', 'Stick', 'Flux-Core'];
const MATERIALS = ['Mild Steel', 'Stainless Steel', 'Aluminum', 'Cast Iron'];
const THICKNESSES = ['1/16"', '1/8"', '3/16"', '1/4"', '3/8"', '1/2"', '3/4"', '1"'];

const MACHINE_SETTINGS: Record<string, Record<string, Record<string, {
  voltage: string; wireSpeed: string; gas: string; travel: string; tips: string[];
}>>> = {
  MIG: {
    'Mild Steel': {
      '1/8"':  { voltage: '17–19V', wireSpeed: '180–220 IPM', gas: '75/25 Ar/CO₂', travel: '14–18 IPM', tips: ['Use a push angle of 10–15°', 'Clean base metal before welding'] },
      '1/4"':  { voltage: '20–22V', wireSpeed: '250–300 IPM', gas: '75/25 Ar/CO₂', travel: '12–16 IPM', tips: ['Preheat to 200°F for thick sections', 'Use multiple passes if needed'] },
      '3/8"':  { voltage: '22–24V', wireSpeed: '300–350 IPM', gas: '75/25 Ar/CO₂', travel: '10–14 IPM', tips: ['Preheat recommended', 'Multi-pass with interpass cleaning'] },
    },
    'Stainless Steel': {
      '1/8"':  { voltage: '16–18V', wireSpeed: '160–200 IPM', gas: '98/2 Ar/O₂',   travel: '14–18 IPM', tips: ['Use 308L wire for 304 SS', 'Keep heat input low to prevent warping'] },
      '1/4"':  { voltage: '18–20V', wireSpeed: '200–240 IPM', gas: '98/2 Ar/O₂',   travel: '12–15 IPM', tips: ['Back-purge pipe welds', 'Allow full cool between passes'] },
    },
    'Aluminum': {
      '1/8"':  { voltage: '18–20V', wireSpeed: '200–260 IPM', gas: '100% Argon',    travel: '18–24 IPM', tips: ['Use push technique only', 'Use Teflon liner to prevent wire kinking'] },
      '1/4"':  { voltage: '21–23V', wireSpeed: '260–320 IPM', gas: '100% Argon',    travel: '16–20 IPM', tips: ['Preheat to 250°F', 'Use 4043 or 5356 wire based on alloy'] },
    },
  },
  TIG: {
    'Mild Steel': {
      '1/16"': { voltage: '10–12V', wireSpeed: 'Manual filler', gas: '100% Argon',  travel: '6–10 IPM',  tips: ['Use 2% thoriated or ceriated tungsten', 'DCEN polarity'] },
      '1/8"':  { voltage: '12–15V', wireSpeed: 'Manual filler', gas: '100% Argon',  travel: '6–10 IPM',  tips: ['Amperage ~125–160A', 'Keep arc length equal to tungsten diameter'] },
    },
    'Stainless Steel': {
      '1/16"': { voltage: '10–12V', wireSpeed: 'Manual filler', gas: '100% Argon',  travel: '6–10 IPM',  tips: ['Post-flow shielding 15+ seconds', 'Use 308L filler for 304 SS'] },
      '1/8"':  { voltage: '12–14V', wireSpeed: 'Manual filler', gas: '100% Argon',  travel: '6–10 IPM',  tips: ['Back purge critical for sanitary welds', 'Keep interpass temp under 350°F'] },
    },
    'Aluminum': {
      '1/8"':  { voltage: '14–17V', wireSpeed: 'Manual filler', gas: '100% Argon',  travel: '8–12 IPM',  tips: ['Use AC polarity', 'Balance wave 65–70% EN for cleaning action'] },
    },
  },
  Stick: {
    'Mild Steel': {
      '1/8"':  { voltage: '70–90A',  wireSpeed: 'N/A', gas: 'None (SMAW)',           travel: '8–12 IPM',  tips: ['Use E6013 for general work, E7018 for structural', 'Keep rod dry — store in rod oven'] },
      '1/4"':  { voltage: '90–120A', wireSpeed: 'N/A', gas: 'None (SMAW)',           travel: '8–12 IPM',  tips: ['Preheat 200°F for thick plate', 'Drag technique, 5–10° drag angle'] },
      '3/8"':  { voltage: '120–160A', wireSpeed: 'N/A', gas: 'None (SMAW)',          travel: '6–10 IPM',  tips: ['Use E7018 low hydrogen', 'Preheat 300–400°F'] },
    },
  },
  'Flux-Core': {
    'Mild Steel': {
      '1/8"':  { voltage: '18–20V', wireSpeed: '180–220 IPM', gas: '75/25 Ar/CO₂ or None', travel: '12–16 IPM', tips: ['Self-shielded FCAW needs no gas', 'Drag angle 10–15° for gas-shielded'] },
      '1/4"':  { voltage: '20–23V', wireSpeed: '220–270 IPM', gas: '75/25 Ar/CO₂ or None', travel: '10–14 IPM', tips: ['Great for outdoor/windy conditions with self-shielded wire', 'Remove slag between passes'] },
      '3/8"':  { voltage: '23–26V', wireSpeed: '270–320 IPM', gas: '75/25 Ar/CO₂ or None', travel: '8–12 IPM',  tips: ['Multi-pass with stringer beads', 'Clean slag fully before next pass'] },
    },
  },
};

function Selector({ label, options, selected, onSelect }: {
  label: string; options: string[]; selected: string; onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.selectorBlock}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.selectorRow}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, selected === opt && styles.chipActive]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.chipText, selected === opt && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function AddMachineScreen({ onSave, onCancel }: { onSave: (m: SavedMachine) => void; onCancel: () => void }) {
  const [name, setName]       = useState('');
  const [brand, setBrand]     = useState('Miller');
  const [model, setModel]     = useState('');
  const [process, setProcess] = useState('MIG');

  function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Give your machine a name.'); return; }
    onSave({ id: Date.now().toString(), name: name.trim(), brand, model: model.trim(), process });
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.machineContent}>
      <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.screenTitle}>ADD MACHINE</Text>
      <Text style={styles.screenSub}>Save your rig for quick access.</Text>

      <Text style={styles.selectorLabel}>MACHINE NAME</Text>
      <TextInput
        style={styles.input}
        placeholder='e.g. "Shop Miller" or "Home Rig"'
        placeholderTextColor="#626362"
        value={name}
        onChangeText={setName}
      />

      <Text style={[styles.selectorLabel, { marginTop: 16 }]}>BRAND</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.selectorRow}>
          {BRANDS.map(b => (
            <TouchableOpacity key={b} style={[styles.chip, brand === b && styles.chipActive]} onPress={() => setBrand(b)}>
              <Text style={[styles.chipText, brand === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text style={[styles.selectorLabel, { marginTop: 20 }]}>MODEL (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder='e.g. "Millermatic 255"'
        placeholderTextColor="#626362"
        value={model}
        onChangeText={setModel}
      />

      <Selector label="PRIMARY PROCESS" options={PROCESSES} selected={process} onSelect={setProcess} />

      <TouchableOpacity style={[styles.button, { marginHorizontal: 0, marginTop: 24 }]} onPress={handleSave}>
        <Text style={styles.buttonText}>SAVE MACHINE</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function MachineScreen() {
  const [view, setView]           = useState<MachineView>('main');
  const [machines, setMachines]   = useState<SavedMachine[]>([
    { id: '1', name: 'Shop Rig', brand: 'Miller', model: 'Millermatic 255', process: 'MIG' },
  ]);
  const [activeMachine, setActiveMachine] = useState<SavedMachine | null>(null);
  const [process, setProcess]     = useState('MIG');
  const [material, setMaterial]   = useState('Mild Steel');
  const [thickness, setThickness] = useState('1/4"');
  const [showResults, setShowResults] = useState(false);

  function handleSelectMachine(m: SavedMachine) {
    setActiveMachine(m);
    setProcess(m.process);
    setShowResults(false);
  }

  function handleDeleteMachine(id: string) {
    Alert.alert('Delete machine?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        setMachines(prev => prev.filter(m => m.id !== id));
        if (activeMachine?.id === id) setActiveMachine(null);
      }},
    ]);
  }

  function handleSaveMachine(m: SavedMachine) {
    setMachines(prev => [...prev, m]);
    setActiveMachine(m);
    setProcess(m.process);
    setView('main');
  }

  if (view === 'add') {
    return <AddMachineScreen onSave={handleSaveMachine} onCancel={() => setView('main')} />;
  }

  const settings = MACHINE_SETTINGS[process]?.[material]?.[thickness];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.machineContent}>
      <Text style={styles.screenTitle}>MACHINE SETTINGS</Text>
      <Text style={styles.screenSub}>Select your setup to get recommended parameters.</Text>

      {/* Saved machines */}
      <View style={styles.savedSection}>
        <View style={styles.savedHeader}>
          <Text style={styles.sectionTitle}>MY MACHINES</Text>
          <TouchableOpacity onPress={() => setView('add')} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ ADD</Text>
          </TouchableOpacity>
        </View>
        {machines.length === 0 && (
          <Text style={styles.emptyText}>No machines saved yet. Tap + ADD to save your rig.</Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.selectorRow}>
            {machines.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.machineCard, activeMachine?.id === m.id && styles.machineCardActive]}
                onPress={() => handleSelectMachine(m)}
                onLongPress={() => handleDeleteMachine(m.id)}
              >
                <Text style={[styles.machineName, activeMachine?.id === m.id && styles.machineNameActive]}>{m.name}</Text>
                <Text style={styles.machineMeta}>{m.brand} · {m.process}</Text>
                {m.model ? <Text style={styles.machineMeta}>{m.model}</Text> : null}
                <Text style={styles.machineHint}>hold to delete</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <Selector label="PROCESS"   options={PROCESSES}   selected={process}    onSelect={v => { setProcess(v); setShowResults(false); }} />
      <Selector label="MATERIAL"  options={MATERIALS}   selected={material}   onSelect={v => { setMaterial(v); setShowResults(false); }} />
      <Selector label="THICKNESS" options={THICKNESSES} selected={thickness}  onSelect={v => { setThickness(v); setShowResults(false); }} />

      <TouchableOpacity style={[styles.button, { marginHorizontal: 0, marginTop: 24 }]} onPress={() => setShowResults(true)}>
        <Text style={styles.buttonText}>GET SETTINGS</Text>
      </TouchableOpacity>

      {showResults && settings && (
        <View style={styles.settingsCard}>
          {activeMachine && (
            <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>
              {activeMachine.name.toUpperCase()} · {activeMachine.brand.toUpperCase()}
            </Text>
          )}
          <Text style={styles.sectionTitle}>RECOMMENDED PARAMETERS</Text>
          <View style={styles.paramGrid}>
            <View style={styles.paramBox}>
              <Text style={styles.paramValue}>{settings.voltage}</Text>
              <Text style={styles.paramLabel}>Voltage</Text>
            </View>
            <View style={styles.paramBox}>
              <Text style={styles.paramValue}>{settings.wireSpeed}</Text>
              <Text style={styles.paramLabel}>Wire Speed</Text>
            </View>
            <View style={styles.paramBox}>
              <Text style={styles.paramValue}>{settings.gas}</Text>
              <Text style={styles.paramLabel}>Gas Mix</Text>
            </View>
            <View style={styles.paramBox}>
              <Text style={styles.paramValue}>{settings.travel}</Text>
              <Text style={styles.paramLabel}>Travel Speed</Text>
            </View>
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>TECHNIQUE TIPS</Text>
          {settings.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipNumber}>{i + 1}</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {showResults && !settings && (
        <View style={styles.settingsCard}>
          <Text style={styles.screenSub}>No settings available for this combination yet. More data coming soon.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const SCORE_HISTORY = [
  { date: 'May 28', score: 61, process: 'MIG' },
  { date: 'May 30', score: 74, process: 'MIG' },
  { date: 'Jun 1',  score: 70, process: 'Stick' },
  { date: 'Jun 2',  score: 78, process: 'MIG' },
  { date: 'Jun 3',  score: 83, process: 'MIG' },
  { date: 'Jun 4',  score: 89, process: 'TIG' },
];

const BADGES = [
  { label: 'First Weld',    desc: 'Analyzed your first weld',         earned: true  },
  { label: 'First B',       desc: 'Scored 70+ on a weld',             earned: true  },
  { label: 'First A',       desc: 'Scored 85+ on a weld',             earned: true  },
  { label: 'On a Roll',     desc: '3 welds in a row above 75',        earned: true  },
  { label: 'TIG Certified', desc: 'Score 80+ on a TIG weld',          earned: false },
  { label: 'Perfectionist', desc: 'Score 95+ on any weld',            earned: false },
  { label: 'Consistent',    desc: '10 welds with no critical defects', earned: false },
  { label: 'All Processes', desc: 'Analyze MIG, TIG, Stick & FCAW',   earned: false },
];

const PROCESS_AVGS = [
  { process: 'MIG',       avg: 81, count: 4 },
  { process: 'TIG',       avg: 89, count: 1 },
  { process: 'Stick',     avg: 70, count: 1 },
  { process: 'Flux-Core', avg: 0,  count: 0 },
];

function MiniChart() {
  const max = 100;
  const min = 40;
  const chartH = 80;
  const chartW = 280;
  const pts = SCORE_HISTORY;
  const stepX = chartW / (pts.length - 1);

  return (
    <View style={styles.chartWrap}>
      {/* Y-axis labels */}
      <View style={styles.chartYAxis}>
        {[100, 75, 50].map(v => (
          <Text key={v} style={styles.chartYLabel}>{v}</Text>
        ))}
      </View>
      {/* Bars */}
      <View style={styles.chartBars}>
        {pts.map((p, i) => {
          const barH = ((p.score - min) / (max - min)) * chartH;
          return (
            <View key={i} style={styles.chartBarCol}>
              <View style={[styles.chartBar, { height: barH, backgroundColor: scoreColor(p.score) }]} />
              <Text style={styles.chartBarLabel}>{p.date.split(' ')[1]}</Text>
              <Text style={[styles.chartBarScore, { color: scoreColor(p.score) }]}>{p.score}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ProgressScreen() {
  const latest = SCORE_HISTORY[SCORE_HISTORY.length - 1].score;
  const allScores = SCORE_HISTORY.map(s => s.score);
  const avg = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
  const best = Math.max(...allScores);
  const earnedBadges = BADGES.filter(b => b.earned).length;

  const rankedProcesses = PROCESS_AVGS
    .filter(p => p.count > 0)
    .sort((a, b) => b.avg - a.avg);
  const bestProcess  = rankedProcesses[0];
  const worstProcess = rankedProcesses[rankedProcesses.length - 1];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.progressContent}>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: scoreColor(latest) }]}>{latest}</Text>
          <Text style={styles.statLabel}>Latest</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: scoreColor(avg) }]}>{avg}</Text>
          <Text style={styles.statLabel}>Avg</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: scoreColor(best) }]}>{best}</Text>
          <Text style={styles.statLabel}>Best</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{SCORE_HISTORY.length}</Text>
          <Text style={styles.statLabel}>Welds</Text>
        </View>
      </View>

      {/* Best / Worst process */}
      {bestProcess && worstProcess && bestProcess.process !== worstProcess.process && (
        <View style={styles.processStrengthRow}>
          <View style={[styles.processStrengthCard, { borderColor: '#4CAF50' }]}>
            <Text style={styles.processStrengthLabel}>STRONGEST</Text>
            <Text style={[styles.processStrengthProcess, { color: '#4CAF50' }]}>{bestProcess.process}</Text>
            <Text style={[styles.processStrengthAvg, { color: '#4CAF50' }]}>{bestProcess.avg}</Text>
            <Text style={styles.processStrengthCount}>{bestProcess.count} weld{bestProcess.count !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.processStrengthVs}>
            <Text style={styles.processStrengthVsText}>VS</Text>
          </View>
          <View style={[styles.processStrengthCard, { borderColor: '#CB2027' }]}>
            <Text style={styles.processStrengthLabel}>NEEDS WORK</Text>
            <Text style={[styles.processStrengthProcess, { color: '#CB2027' }]}>{worstProcess.process}</Text>
            <Text style={[styles.processStrengthAvg, { color: '#CB2027' }]}>{worstProcess.avg}</Text>
            <Text style={styles.processStrengthCount}>{worstProcess.count} weld{worstProcess.count !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      {/* Score chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SCORE TREND</Text>
        <MiniChart />
      </View>

      {/* Per-process breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BY PROCESS</Text>
        {PROCESS_AVGS.map((p, i) => (
          <View key={i} style={styles.processStat}>
            <View style={styles.processStatLeft}>
              <Text style={styles.processStatName}>{p.process}</Text>
              <Text style={styles.processStatCount}>{p.count} weld{p.count !== 1 ? 's' : ''}</Text>
            </View>
            {p.count > 0 ? (
              <View style={styles.processStatRight}>
                <Text style={[styles.processStatAvg, { color: scoreColor(p.avg) }]}>{p.avg}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${p.avg}%` as any, backgroundColor: scoreColor(p.avg) }]} />
                </View>
              </View>
            ) : (
              <Text style={styles.processStatNone}>No welds yet</Text>
            )}
          </View>
        ))}
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BADGES  {earnedBadges}/{BADGES.length}</Text>
        <View style={styles.badgeGrid}>
          {BADGES.map((b, i) => (
            <View key={i} style={[styles.badgeCard, b.earned ? styles.badgeCardEarned : styles.badgeCardLocked]}>
              <Text style={styles.badgeIcon}>{b.earned ? '🏅' : '🔒'}</Text>
              <Text style={[styles.badgeName, !b.earned && styles.badgeNameLocked]}>{b.label}</Text>
              <Text style={styles.badgeDesc}>{b.desc}</Text>
            </View>
          ))}
        </View>
      </View>

    </ScrollView>
  );
}

type CommunityTab = 'feed' | 'discover' | 'challenge';
type ChallengeView = 'detail' | 'submit' | 'submitting' | 'submitted';

const CURRENT_CHALLENGE = {
  id:          'wc-2026-23',
  title:       'TIG on Stainless',
  subtitle:    '2G Position · 304 Stainless · 1/8"',
  process:     'TIG',
  position:    '2G',
  material:    '304 Stainless Steel',
  thickness:   '1/8"',
  rules: [
    'Must be TIG process — no filler rod skipping',
    '2G (horizontal) position only',
    '304 or 316 stainless steel',
    'Single pass, no grinding before photo',
    'Minimum 3" bead length visible in photo',
  ],
  daysLeft:    4,
  hoursLeft:   11,
  entries:     37,
  prize:       'Featured on HotPass + Winner Badge',
};

const CHALLENGE_LEADERBOARD = [
  { rank: 1, user: 'stainless_sal',  score: 97, grade: 'A+', caption: 'Full penetration, back purged, zero oxidation.', liked: false, likes: 89  },
  { rank: 2, user: 'pipe_dawg_77',   score: 94, grade: 'A',  caption: '2G on sch10, tight root gap. Clean passes.',    liked: true,  likes: 61  },
  { rank: 3, user: 'tig_torch_mike', score: 91, grade: 'A',  caption: 'First time on horizontal SS. Happy with it.',   liked: false, likes: 44  },
  { rank: 4, user: 'weld_wolf_ohio', score: 88, grade: 'A',  caption: 'Used 308L filler, 100% argon back purge.',      liked: false, likes: 31  },
  { rank: 5, user: 'fab_king_tx',    score: 82, grade: 'B',  caption: 'Working on keeping travel speed steady.',       liked: false, likes: 18  },
];

const FEED_POSTS = [
  {
    id: '1', user: 'pipe_dawg_77', process: 'TIG', score: 94, grade: 'A',
    caption: '6G position on 2" schedule 80. Clean root, no restarts.',
    likes: 142, comments: 18, time: '2h ago', liked: false,
  },
  {
    id: '2', user: 'fab_king_tx', process: 'MIG', score: 81, grade: 'B',
    caption: 'Shop project, 1/4" mild steel. Working on my starts.',
    likes: 87, comments: 9, time: '4h ago', liked: true,
  },
  {
    id: '3', user: 'ironworker_pnw', process: 'Stick', score: 88, grade: 'A',
    caption: 'E7018 structural — field weld, windy conditions.',
    likes: 203, comments: 31, time: '6h ago', liked: false,
  },
  {
    id: '4', user: 'stainless_sal', process: 'TIG', score: 97, grade: 'A+',
    caption: 'Sanitary fitting on 316L. Full penetration, back purged.',
    likes: 318, comments: 44, time: '1d ago', liked: false,
  },
];

const DISCOVER_WELDERS = [
  { user: 'pipe_dawg_77',    process: 'TIG',   avg: 91, welds: 48, following: false },
  { user: 'ironworker_pnw',  process: 'Stick', avg: 85, welds: 32, following: true  },
  { user: 'stainless_sal',   process: 'TIG',   avg: 94, welds: 61, following: false },
  { user: 'fab_king_tx',     process: 'MIG',   avg: 79, welds: 27, following: true  },
  { user: 'weld_wolf_ohio',  process: 'MIG',   avg: 83, welds: 19, following: false },
  { user: 'fcaw_frank',      process: 'FCAW',  avg: 76, welds: 14, following: false },
];

function ChallengeTab() {
  const [view, setView] = useState<ChallengeView>('detail');
  const [leaderboard, setLeaderboard] = useState(CHALLENGE_LEADERBOARD);
  const c = CURRENT_CHALLENGE;

  function toggleLike(rank: number) {
    setLeaderboard(prev => prev.map(e =>
      e.rank === rank ? { ...e, liked: !e.liked, likes: e.liked ? e.likes - 1 : e.likes + 1 } : e
    ));
  }

  if (view === 'submit') {
    return (
      <ScrollView contentContainerStyle={styles.machineContent}>
        <TouchableOpacity onPress={() => setView('detail')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back to Challenge</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>SUBMIT YOUR WELD</Text>
        <Text style={styles.screenSub}>{c.title} · {c.subtitle}</Text>

        <TouchableOpacity style={styles.cameraBox} onPress={() => {
          setView('submitting');
          setTimeout(() => setView('submitted'), 2500);
        }}>
          <Text style={styles.cameraIcon}>📷</Text>
          <Text style={styles.cameraLabel}>Tap to capture weld</Text>
          <Text style={styles.cameraHint}>AI will score it before posting</Text>
        </TouchableOpacity>

        <View style={styles.submitRulesBox}>
          <Text style={styles.sectionTitle}>CHALLENGE RULES</Text>
          {c.rules.map((r, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipNumber}>·</Text>
              <Text style={styles.tipText}>{r}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.button, { marginHorizontal: 0 }]} onPress={() => {
          setView('submitting');
          setTimeout(() => setView('submitted'), 2500);
        }}>
          <Text style={styles.buttonText}>ANALYZE & SUBMIT</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (view === 'submitting') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#CB2027" style={{ marginBottom: 24 }} />
        <Text style={styles.screenTitle}>ANALYZING WELD</Text>
        <Text style={styles.screenSub}>Scoring before submission...</Text>
        <View style={styles.processingSteps}>
          <Text style={styles.processingStep}>✓ Verifying process type (TIG)</Text>
          <Text style={styles.processingStep}>✓ Checking position indicators</Text>
          <Text style={styles.processingStepActive}>◌ Calculating challenge score...</Text>
        </View>
      </View>
    );
  }

  if (view === 'submitted') {
    return (
      <ScrollView contentContainerStyle={[styles.machineContent, { alignItems: 'center' }]}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>🏆</Text>
        <Text style={styles.screenTitle}>SUBMITTED!</Text>
        <Text style={[styles.screenSub, { textAlign: 'center' }]}>Your weld scored <Text style={{ color: '#4CAF50', fontWeight: '900' }}>91 / A</Text> and has been entered into the challenge.</Text>

        <View style={styles.submittedCard}>
          <Text style={styles.sectionTitle}>YOUR ENTRY</Text>
          <Text style={[styles.scoreBig, { color: '#4CAF50', fontSize: 64 }]}>91</Text>
          <Text style={styles.processTag}>TIG · 2G · 304 Stainless</Text>
          <View style={[styles.gradeBadge, { borderColor: '#4CAF50', marginTop: 8 }]}>
            <Text style={[styles.gradeText, { color: '#4CAF50' }]}>A</Text>
          </View>
        </View>

        <Text style={[styles.screenSub, { textAlign: 'center', marginTop: 8 }]}>
          You're ranked <Text style={{ color: '#fff', fontWeight: '900' }}>#3</Text> with {c.daysLeft}d {c.hoursLeft}h left. Keep watching the leaderboard.
        </Text>

        <TouchableOpacity style={[styles.button, { marginHorizontal: 0, width: '100%' }]} onPress={() => setView('detail')}>
          <Text style={styles.buttonText}>VIEW LEADERBOARD</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Challenge detail + leaderboard
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Challenge hero */}
      <View style={styles.challengeHero}>
        <Text style={styles.challengeWeekLabel}>WEEK 23 CHALLENGE</Text>
        <Text style={styles.challengeHeroTitle}>{c.title}</Text>
        <Text style={styles.challengeHeroSub}>{c.subtitle}</Text>

        <View style={styles.challengeMeta}>
          <View style={styles.challengeMetaBox}>
            <Text style={styles.challengeMetaValue}>{c.daysLeft}d {c.hoursLeft}h</Text>
            <Text style={styles.challengeMetaLabel}>Remaining</Text>
          </View>
          <View style={styles.challengeMetaBox}>
            <Text style={styles.challengeMetaValue}>{c.entries}</Text>
            <Text style={styles.challengeMetaLabel}>Entries</Text>
          </View>
          <View style={styles.challengeMetaBox}>
            <Text style={styles.challengeMetaValue}>{c.process}</Text>
            <Text style={styles.challengeMetaLabel}>Process</Text>
          </View>
          <View style={styles.challengeMetaBox}>
            <Text style={styles.challengeMetaValue}>{c.position}</Text>
            <Text style={styles.challengeMetaLabel}>Position</Text>
          </View>
        </View>

        <View style={styles.prizeRow}>
          <Text style={styles.prizeLabel}>🏆  PRIZE</Text>
          <Text style={styles.prizeText}>{c.prize}</Text>
        </View>

        <TouchableOpacity style={[styles.button, { marginHorizontal: 0, marginTop: 16 }]} onPress={() => setView('submit')}>
          <Text style={styles.buttonText}>ENTER CHALLENGE</Text>
        </TouchableOpacity>
      </View>

      {/* Rules */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RULES</Text>
        {c.rules.map((r, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={styles.tipNumber}>·</Text>
            <Text style={styles.tipText}>{r}</Text>
          </View>
        ))}
      </View>

      {/* Leaderboard */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LEADERBOARD</Text>
        {leaderboard.map((e, i) => (
          <View key={i} style={[styles.leaderRow, e.rank === 1 && styles.leaderRowFirst]}>
            <Text style={[styles.leaderRank, e.rank === 1 && styles.leaderRankFirst]}>
              {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`}
            </Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{e.user[0].toUpperCase()}</Text>
            </View>
            <View style={styles.leaderInfo}>
              <Text style={styles.welderName}>{e.user}</Text>
              <Text style={styles.leaderCaption}>{e.caption}</Text>
            </View>
            <View style={styles.leaderScoreCol}>
              <Text style={[styles.leaderScore, { color: scoreColor(e.score) }]}>{e.score}</Text>
              <Text style={[styles.leaderGrade, { color: scoreColor(e.score) }]}>{e.grade}</Text>
              <TouchableOpacity style={styles.leaderLike} onPress={() => toggleLike(e.rank)}>
                <Text style={[styles.postActionIcon, { fontSize: 14 }, e.liked && { color: '#CB2027' }]}>
                  {e.liked ? '♥' : '♡'}
                </Text>
                <Text style={[styles.postActionCount, { fontSize: 11 }, e.liked && { color: '#CB2027' }]}>{e.likes}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const DETAIL_COMMENTS = [
  { user: 'ironworker_pnw', text: 'Clean tie-ins. What filler you running?', time: '1h ago', likes: 12 },
  { user: 'fab_king_tx',    text: 'That color is perfect — zero oxidation.',  time: '2h ago', likes: 8  },
  { user: 'weld_wolf_ohio', text: 'Gas coverage on point. Back purged?',      time: '3h ago', likes: 5  },
  { user: 'tig_torch_mike', text: 'Bead consistency is insane on this one.',  time: '4h ago', likes: 19 },
];

const DETAIL_DIMENSIONS = [
  { label: 'Bead Consistency', score: 94 },
  { label: 'Penetration',      score: 96 },
  { label: 'Spatter',          score: 98 },
  { label: 'Undercut',         score: 91 },
  { label: 'Overlap',          score: 99 },
  { label: 'Porosity',         score: 93 },
  { label: 'Crack Indication', score: 100 },
  { label: 'Straightness',     score: 88 },
  { label: 'Starts & Stops',   score: 90 },
];

function WeldDetailView({ post, onBack, onLike }: {
  post: typeof FEED_POSTS[0];
  onBack: () => void;
  onLike: () => void;
}) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(DETAIL_COMMENTS);
  const [following, setFollowing] = useState(false);

  function handleComment() {
    if (!comment.trim()) return;
    setComments(prev => [{ user: 'your_username', text: comment.trim(), time: 'Just now', likes: 0 }, ...prev]);
    setComment('');
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.detailBack}>
          <Text style={styles.backBtnText}>← Feed</Text>
        </TouchableOpacity>
        <Text style={styles.detailHeaderTitle}>WELD</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Post header */}
        <View style={styles.postHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{post.user[0].toUpperCase()}</Text>
          </View>
          <View style={styles.postHeaderText}>
            <Text style={styles.postUser}>{post.user}</Text>
            <Text style={styles.postTime}>{post.time}</Text>
          </View>
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followBtnActive]}
            onPress={() => setFollowing(v => !v)}
          >
            <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Weld image */}
        <View style={[styles.postImagePlaceholder, { height: 280 }]}>
          <Text style={[styles.postImageIcon, { fontSize: 64 }]}>🔥</Text>
          <View style={styles.postScoreBadge}>
            <Text style={[styles.postScoreNum, { color: scoreColor(post.score), fontSize: 32 }]}>{post.score}</Text>
            <Text style={[styles.postGrade, { color: scoreColor(post.score) }]}>{post.grade}</Text>
          </View>
          <View style={[styles.processPill, { position: 'absolute', top: 12, left: 12, backgroundColor: '#000' }]}>
            <Text style={styles.processPillText}>{post.process}</Text>
          </View>
        </View>

        {/* Caption + actions */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Text style={[styles.postUser, { marginBottom: 4 }]}>{post.user} <Text style={styles.postCaption}>{post.caption}</Text></Text>
          <Text style={[styles.postTime, { marginBottom: 16 }]}>{post.time}</Text>

          <View style={[styles.postActions, { paddingHorizontal: 0, marginBottom: 20 }]}>
            <TouchableOpacity style={styles.postAction} onPress={onLike}>
              <Text style={[styles.postActionIcon, post.liked && { color: '#CB2027' }]}>{post.liked ? '♥' : '♡'}</Text>
              <Text style={[styles.postActionCount, post.liked && { color: '#CB2027' }]}>{post.likes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.postAction}>
              <Text style={styles.postActionIcon}>💬</Text>
              <Text style={styles.postActionCount}>{comments.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.postAction}>
              <Text style={styles.postActionIcon}>↗</Text>
              <Text style={styles.postActionCount}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Score Breakdown */}
        <View style={[styles.section, { paddingTop: 0 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI BREAKDOWN</Text>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>CWI RUBRIC</Text></View>
          </View>
          <View style={styles.dimCard}>
            {DETAIL_DIMENSIONS.map((d, i) => (
              <View key={i} style={[styles.dimRow, i < DETAIL_DIMENSIONS.length - 1 && styles.dimRowBorder]}>
                <View style={styles.dimLabelRow}>
                  <Text style={styles.dimLabel}>{d.label}</Text>
                  <Text style={[styles.dimScore, { color: scoreColor(d.score) }]}>{d.score}</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${d.score}%` as any, backgroundColor: scoreColor(d.score) }]} />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Comments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>COMMENTS</Text>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{comments.length}</Text></View>
          </View>
          {comments.map((c, i) => (
            <View key={i} style={styles.commentRow}>
              <View style={[styles.avatar, { width: 30, height: 30, borderRadius: 2 }]}>
                <Text style={[styles.avatarText, { fontSize: 11 }]}>{c.user[0].toUpperCase()}</Text>
              </View>
              <View style={styles.commentBody}>
                <View style={styles.commentBubble}>
                  <Text style={styles.commentUser}>{c.user}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
                <View style={styles.commentMeta}>
                  <Text style={styles.commentTime}>{c.time}</Text>
                  <TouchableOpacity><Text style={styles.commentLike}>♡ {c.likes}</Text></TouchableOpacity>
                  <TouchableOpacity><Text style={styles.commentReply}>Reply</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* Comment input — fixed at bottom */}
      <View style={styles.commentInputBar}>
        <View style={[styles.avatar, { width: 30, height: 30, borderRadius: 2 }]}>
          <Text style={[styles.avatarText, { fontSize: 11 }]}>Y</Text>
        </View>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor="#333"
          value={comment}
          onChangeText={setComment}
          onSubmitEditing={handleComment}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={handleComment} style={styles.commentSendBtn}>
          <Text style={[styles.commentSendText, comment.trim() && { color: '#CB2027' }]}>POST</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CommunityScreen() {
  const [tab, setTab] = useState<CommunityTab>('feed');
  const [posts, setPosts] = useState(FEED_POSTS);
  const [welders, setWelders] = useState(DISCOVER_WELDERS);
  const [filterProcess, setFilterProcess] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<typeof FEED_POSTS[0] | null>(null);

  function toggleLike(id: string) {
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  }

  function toggleFollow(user: string) {
    setWelders(prev => prev.map(w =>
      w.user === user ? { ...w, following: !w.following } : w
    ));
  }

  const filteredWelders = filterProcess
    ? welders.filter(w => w.process === filterProcess)
    : welders;

  if (selectedPost) {
    return <WeldDetailView post={selectedPost} onBack={() => setSelectedPost(null)} onLike={() => toggleLike(selectedPost.id)} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs */}
      <View style={styles.subTabBar}>
        {(['feed', 'challenge', 'discover'] as const).map(t => (
          <TouchableOpacity key={t} style={styles.subTab} onPress={() => setTab(t)}>
            <Text style={[styles.subTabText, tab === t && styles.subTabActive]}>
              {t === 'challenge' ? '🏆 CHALLENGE' : t.toUpperCase()}
            </Text>
            {tab === t && <View style={styles.subTabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'feed' && (
        <ScrollView style={{ flex: 1 }}>
          {posts.map(p => (
            <TouchableOpacity key={p.id} style={styles.postCard} activeOpacity={0.9} onPress={() => setSelectedPost(p)}>
              <View style={styles.postHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{p.user[0].toUpperCase()}</Text>
                </View>
                <View style={styles.postHeaderText}>
                  <Text style={styles.postUser}>{p.user}</Text>
                  <Text style={styles.postTime}>{p.time}</Text>
                </View>
                <View style={[styles.processPill, { borderColor: '#CB2027' }]}>
                  <Text style={styles.processPillText}>{p.process}</Text>
                </View>
              </View>
              <View style={styles.postImagePlaceholder}>
                <Text style={styles.postImageIcon}>🔥</Text>
                <View style={styles.postScoreBadge}>
                  <Text style={[styles.postScoreNum, { color: scoreColor(p.score) }]}>{p.score}</Text>
                  <Text style={[styles.postGrade, { color: scoreColor(p.score) }]}>{p.grade}</Text>
                </View>
              </View>
              <Text style={styles.postCaption}>{p.caption}</Text>
              <View style={styles.postActions}>
                <TouchableOpacity style={styles.postAction} onPress={e => { e.stopPropagation?.(); toggleLike(p.id); }}>
                  <Text style={[styles.postActionIcon, p.liked && { color: '#CB2027' }]}>{p.liked ? '♥' : '♡'}</Text>
                  <Text style={[styles.postActionCount, p.liked && { color: '#CB2027' }]}>{p.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction} onPress={() => setSelectedPost(p)}>
                  <Text style={styles.postActionIcon}>💬</Text>
                  <Text style={styles.postActionCount}>{p.comments}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction}>
                  <Text style={styles.postActionIcon}>↗</Text>
                  <Text style={styles.postActionCount}>Share</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {tab === 'challenge' && <ChallengeTab />}

      {tab === 'discover' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Text style={styles.sectionTitle}>FILTER BY PROCESS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.selectorRow}>
                {['All', ...PROCESSES].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, (filterProcess === p || (p === 'All' && !filterProcess)) && styles.chipActive]}
                    onPress={() => setFilterProcess(p === 'All' ? null : p)}
                  >
                    <Text style={[styles.chipText, (filterProcess === p || (p === 'All' && !filterProcess)) && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <Text style={styles.sectionTitle}>WELDERS</Text>
            {filteredWelders.map((w, i) => (
              <View key={i} style={styles.welderRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{w.user[0].toUpperCase()}</Text>
                </View>
                <View style={styles.welderInfo}>
                  <Text style={styles.welderName}>{w.user}</Text>
                  <Text style={styles.welderMeta}>{w.process} · Avg {w.avg} · {w.welds} welds</Text>
                </View>
                <TouchableOpacity
                  style={[styles.followBtn, w.following && styles.followBtnActive]}
                  onPress={() => toggleFollow(w.user)}
                >
                  <Text style={[styles.followBtnText, w.following && styles.followBtnTextActive]}>
                    {w.following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const PROFILE_WELDS = [
  { score: 89, process: 'TIG',   grade: 'A'  },
  { score: 83, process: 'MIG',   grade: 'B'  },
  { score: 78, process: 'MIG',   grade: 'B'  },
  { score: 97, process: 'TIG',   grade: 'A+' },
  { score: 70, process: 'Stick', grade: 'B'  },
  { score: 61, process: 'MIG',   grade: 'C'  },
  { score: 74, process: 'MIG',   grade: 'B'  },
  { score: 91, process: 'TIG',   grade: 'A'  },
  { score: 88, process: 'Stick', grade: 'A'  },
];

const EARNED_BADGES = BADGES.filter(b => b.earned);

type ProfileTab = 'welds' | 'badges';

function ProfileScreen() {
  const [tab, setTab] = useState<ProfileTab>('welds');
  const avg = Math.round(PROFILE_WELDS.reduce((a, b) => a + b.score, 0) / PROFILE_WELDS.length);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>Y</Text>
        </View>
        <Text style={styles.profileUsername}>your_username</Text>
        <Text style={styles.profileBio}>Professional welder · MIG · TIG · Stick</Text>

        {/* Stats */}
        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>{PROFILE_WELDS.length}</Text>
            <Text style={styles.profileStatLabel}>Welds</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <Text style={[styles.profileStatValue, { color: scoreColor(avg) }]}>{avg}</Text>
            <Text style={styles.profileStatLabel}>Avg Score</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>124</Text>
            <Text style={styles.profileStatLabel}>Followers</Text>
          </View>
          <View style={styles.profileStatDivider} />
          <View style={styles.profileStat}>
            <Text style={styles.profileStatValue}>38</Text>
            <Text style={styles.profileStatLabel}>Following</Text>
          </View>
        </View>

        {/* Edit profile */}
        <TouchableOpacity style={styles.editProfileBtn}>
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-tabs */}
      <View style={styles.subTabBar}>
        {(['welds', 'badges'] as const).map(t => (
          <TouchableOpacity key={t} style={styles.subTab} onPress={() => setTab(t)}>
            <Text style={[styles.subTabText, tab === t && styles.subTabActive]}>
              {t === 'welds' ? `WELDS (${PROFILE_WELDS.length})` : `BADGES (${EARNED_BADGES.length})`}
            </Text>
            {tab === t && <View style={styles.subTabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Weld grid */}
      {tab === 'welds' && (
        <View style={styles.weldGrid}>
          {PROFILE_WELDS.map((w, i) => (
            <TouchableOpacity key={i} style={styles.weldGridItem}>
              <View style={[styles.weldGridImage, { borderBottomWidth: 3, borderBottomColor: scoreColor(w.score) }]}>
                <View style={styles.weldGridBadge}>
                  <Text style={[styles.weldGridScore, { color: scoreColor(w.score) }]}>{w.score}</Text>
                  <Text style={[styles.weldGridGrade, { color: scoreColor(w.score) }]}>{w.grade}</Text>
                </View>
                <View style={styles.weldGridProcess}>
                  <Text style={styles.weldGridProcessText}>{w.process}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Badges */}
      {tab === 'badges' && (
        <View style={[styles.badgeGrid, { padding: 16 }]}>
          {BADGES.map((b, i) => (
            <View key={i} style={[styles.badgeCard, b.earned ? styles.badgeCardEarned : styles.badgeCardLocked]}>
              <Text style={styles.badgeIcon}>{b.earned ? '🏅' : '🔒'}</Text>
              <Text style={[styles.badgeName, !b.earned && styles.badgeNameLocked]}>{b.label}</Text>
              <Text style={styles.badgeDesc}>{b.desc}</Text>
            </View>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

const SUGGESTED_WELDERS = [
  { user: 'pipe_dawg_77',   process: 'TIG',   avg: 91, welds: 48 },
  { user: 'ironworker_pnw', process: 'Stick', avg: 85, welds: 32 },
  { user: 'stainless_sal',  process: 'TIG',   avg: 94, welds: 61 },
  { user: 'fab_king_tx',    process: 'MIG',   avg: 79, welds: 27 },
  { user: 'weld_wolf_ohio', process: 'MIG',   avg: 83, welds: 19 },
  { user: 'fcaw_frank',     process: 'FCAW',  avg: 76, welds: 14 },
];

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep]             = useState<OnboardingStep>('welcome');
  const [username, setUsername]     = useState('');
  const [processes, setProcesses]   = useState<string[]>([]);
  const [followed, setFollowed]     = useState<string[]>([]);

  function toggleProcess(p: string) {
    setProcesses(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  function toggleFollow(u: string) {
    setFollowed(prev => prev.includes(u) ? prev.filter(x => x !== u) : [...prev, u]);
  }

  // Step indicator
  const steps: OnboardingStep[] = ['welcome', 'username', 'processes', 'follow', 'done'];
  const stepIndex = steps.indexOf(step);

  function next() {
    const nextStep = steps[stepIndex + 1];
    if (nextStep) setStep(nextStep);
    else onComplete();
  }

  if (step === 'welcome') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.onboardingScreen}>
          <View style={styles.onboardingHero}>
            <View style={styles.onboardingGlow} />
            <Text style={styles.onboardingLogo}>HOTPASS</Text>
            <Text style={styles.onboardingTagline}>THE PLATFORM BUILT{'\n'}FOR WELDERS.</Text>
          </View>
          <View style={styles.onboardingContent}>
            <View style={styles.onboardingFeatureList}>
              {[
                { icon: '🔍', title: 'AI Weld Analysis',      desc: 'Photo your weld. Get a score, defect callouts, and tips.' },
                { icon: '⚙️', title: 'Machine Settings',       desc: 'Voltage, wire speed, gas mix — dialed in for your setup.' },
                { icon: '📈', title: 'Track Your Progress',    desc: 'Score history, badges, and process breakdowns.' },
                { icon: '🔥', title: 'Community of Welders',   desc: 'Zero tolerance. Welders only. No beginners.' },
              ].map((f, i) => (
                <View key={i} style={styles.onboardingFeatureRow}>
                  <Text style={styles.onboardingFeatureIcon}>{f.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.onboardingFeatureTitle}>{f.title}</Text>
                    <Text style={styles.onboardingFeatureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.button, { marginHorizontal: 0 }]} onPress={next}>
              <Text style={styles.buttonText}>GET STARTED</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'username') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.onboardingScreen}>
          <OnboardingProgress current={stepIndex} total={steps.length - 1} />
          <View style={styles.onboardingContent}>
            <Text style={styles.onboardingStepTitle}>CHOOSE YOUR{'\n'}HANDLE</Text>
            <Text style={styles.onboardingStepSub}>This is how other welders will know you.</Text>
            <TextInput
              style={[styles.input, { fontSize: 20, fontWeight: '800', letterSpacing: 2, textAlign: 'center' }]}
              placeholder="your_username"
              placeholderTextColor="#333"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <Text style={styles.onboardingHint}>Letters, numbers, and underscores only.</Text>
            <TouchableOpacity
              style={[styles.button, { marginHorizontal: 0, opacity: username.length < 3 ? 0.4 : 1 }]}
              onPress={next}
              disabled={username.length < 3}
            >
              <Text style={styles.buttonText}>CONTINUE</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={next} style={{ alignItems: 'center', marginTop: 8 }}>
              <Text style={styles.onboardingSkip}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'processes') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.onboardingScreen}>
          <OnboardingProgress current={stepIndex} total={steps.length - 1} />
          <View style={styles.onboardingContent}>
            <Text style={styles.onboardingStepTitle}>WHAT DO{'\n'}YOU WELD?</Text>
            <Text style={styles.onboardingStepSub}>Select all processes you work with.</Text>
            <View style={styles.processPickerGrid}>
              {[
                { code: 'MIG',       label: 'MIG',       sub: 'GMAW' },
                { code: 'TIG',       label: 'TIG',       sub: 'GTAW' },
                { code: 'Stick',     label: 'STICK',     sub: 'SMAW' },
                { code: 'Flux-Core', label: 'FLUX-CORE', sub: 'FCAW' },
              ].map(p => {
                const selected = processes.includes(p.code);
                return (
                  <TouchableOpacity
                    key={p.code}
                    style={[styles.processPickerCard, selected && styles.processPickerCardActive]}
                    onPress={() => toggleProcess(p.code)}
                  >
                    <Text style={[styles.processPickerLabel, selected && { color: '#CB2027' }]}>{p.label}</Text>
                    <Text style={styles.processPickerSub}>{p.sub}</Text>
                    {selected && <View style={styles.processPickerCheck}><Text style={styles.processPickerCheckText}>✓</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.button, { marginHorizontal: 0, opacity: processes.length === 0 ? 0.4 : 1 }]}
              onPress={next}
              disabled={processes.length === 0}
            >
              <Text style={styles.buttonText}>CONTINUE</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={next} style={{ alignItems: 'center', marginTop: 8 }}>
              <Text style={styles.onboardingSkip}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'follow') {
    const filtered = processes.length > 0
      ? SUGGESTED_WELDERS.filter(w => processes.includes(w.process))
      : SUGGESTED_WELDERS;
    const suggestions = filtered.length >= 3 ? filtered : SUGGESTED_WELDERS;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.onboardingScreen}>
          <OnboardingProgress current={stepIndex} total={steps.length - 1} />
          <View style={styles.onboardingContent}>
            <Text style={styles.onboardingStepTitle}>FOLLOW SOME{'\n'}WELDERS</Text>
            <Text style={styles.onboardingStepSub}>
              {processes.length > 0 ? `Top ${processes.join(' & ')} welders on HotPass.` : 'Top welders on HotPass.'}
            </Text>
            <View style={{ width: '100%', marginBottom: 24 }}>
              {suggestions.slice(0, 5).map((w, i) => {
                const isFollowed = followed.includes(w.user);
                return (
                  <View key={i} style={styles.welderRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{w.user[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.welderInfo}>
                      <Text style={styles.welderName}>{w.user}</Text>
                      <Text style={styles.welderMeta}>{w.process} · Avg {w.avg} · {w.welds} welds</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.followBtn, isFollowed && styles.followBtnActive]}
                      onPress={() => toggleFollow(w.user)}
                    >
                      <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
                        {isFollowed ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.button, { marginHorizontal: 0 }]} onPress={next}>
              <Text style={styles.buttonText}>
                {followed.length > 0 ? `FOLLOW ${followed.length} & CONTINUE` : 'SKIP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Done
  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.onboardingScreen, { justifyContent: 'center' }]}>
        <View style={styles.onboardingContent}>
          <View style={styles.onboardingDoneGlow} />
          <Text style={{ fontSize: 72, textAlign: 'center', marginBottom: 24 }}>🔥</Text>
          <Text style={styles.onboardingStepTitle}>YOU'RE IN.</Text>
          <Text style={[styles.onboardingStepSub, { textAlign: 'center' }]}>
            {username ? `Welcome, ${username}.` : 'Welcome to HotPass.'}{'\n'}Start by analyzing your first weld.
          </Text>
          <TouchableOpacity style={[styles.button, { marginHorizontal: 0, marginTop: 32 }]} onPress={onComplete}>
            <Text style={styles.buttonText}>ANALYZE FIRST WELD</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function OnboardingProgress({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.onboardingProgressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.onboardingProgressDot, i < current && styles.onboardingProgressDotDone, i === current && styles.onboardingProgressDotActive]} />
      ))}
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('analyze');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  async function handleSignIn() {
    if (!email || !password) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
      } else {
        setScreen('app');
      }
    } catch {
      setAuthError('Something went wrong. Try again.');
    }
    setAuthLoading(false);
  }

  async function handleSignUp() {
    if (!email || !password) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthError(error.message);
      } else {
        setScreen('onboarding');
      }
    } catch {
      setAuthError('Something went wrong. Try again.');
    }
    setAuthLoading(false);
  }

  if (screen === 'onboarding') {
    return <OnboardingScreen onComplete={() => setScreen('app')} />;
  }

  if (screen === 'signin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authInner}>
          <Text style={styles.logo}>HOTPASS</Text>
          <Text style={styles.tagline}>BUILT FOR WELDERS.</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#333"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={t => { setEmail(t); setAuthError(''); }}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#333"
            secureTextEntry
            value={password}
            onChangeText={t => { setPassword(t); setAuthError(''); }}
          />

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <TouchableOpacity
            style={[styles.button, { opacity: authLoading ? 0.6 : 1 }]}
            onPress={handleSignIn}
            disabled={authLoading}
          >
            {authLoading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.buttonText}>SIGN IN</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.buttonOutline, { opacity: authLoading ? 0.6 : 1 }]}
            onPress={handleSignUp}
            disabled={authLoading}
          >
            <Text style={styles.buttonOutlineText}>CREATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setScreen('app')} style={{ alignItems: 'center', marginTop: 8 }}>
            <Text style={styles.hint}>Skip — preview the app</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appContainer}>

        <View style={styles.header}>
          <Text style={styles.headerLogo}>HOTPASS</Text>
        </View>

        <View style={styles.screenContent}>
          {tab === 'analyze'   && <AnalyzeScreen />}
          {tab === 'machine'   && <MachineScreen />}
          {tab === 'progress'  && <ProgressScreen />}
          {tab === 'community' && <CommunityScreen />}
          {tab === 'profile'   && <ProfileScreen />}
        </View>

        <View style={styles.tabBar}>
          {(['analyze', 'machine', 'progress', 'community', 'profile'] as const).map(t => (
            <TouchableOpacity key={t} style={styles.tab} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
              {tab === t && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#080808' },

  // Auth
  authInner:          { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo:               { fontSize: 40, fontWeight: '900', color: '#CB2027', letterSpacing: 6, marginBottom: 2 },
  tagline:            { fontSize: 13, color: '#444', marginBottom: 52, letterSpacing: 3, textTransform: 'uppercase' },
  input:              {
    backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#222',
    borderRadius: 2, color: '#fff', paddingHorizontal: 16, paddingVertical: 15,
    fontSize: 15, marginBottom: 10,
  },
  button:             {
    backgroundColor: '#CB2027', borderRadius: 2, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 16, marginHorizontal: 20,
  },
  buttonText:         { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 3 },
  hint:               { color: '#2a2a2a', fontSize: 12, textAlign: 'center' },
  authError:          { color: '#CB2027', fontSize: 12, marginBottom: 10, textAlign: 'center', letterSpacing: 0.5 },

  // App shell
  appContainer:       { flex: 1 },
  header:             {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#151515',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#080808',
  },
  headerLogo:         { fontSize: 18, fontWeight: '900', color: '#CB2027', letterSpacing: 4 },
  screenContent:      { flex: 1 },
  centered:           { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  screenTitle:        { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 6, letterSpacing: 3 },
  screenSub:          { fontSize: 13, color: '#444', textAlign: 'center', marginBottom: 32, letterSpacing: 0.5 },

  // Capture screen
  captureScreen:      { flex: 1, backgroundColor: '#050505' },
  captureTopBar:      {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#111',
  },
  captureReadout:     { color: '#333', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  captureReadoutCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  captureReadoutDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CB2027' },
  captureReadoutLabel:{ color: '#CB2027', fontSize: 10, letterSpacing: 3, fontWeight: '800' },

  // Viewfinder
  viewfinder:         {
    flex: 1, margin: 16, backgroundColor: '#0a0a0a',
    borderWidth: 1, borderColor: '#1a1a1a', position: 'relative',
    justifyContent: 'center', alignItems: 'center',
  },
  vfGridH1:           { position: 'absolute', top: '33%', left: 0, right: 0, height: 1, backgroundColor: '#111' },
  vfGridH2:           { position: 'absolute', top: '66%', left: 0, right: 0, height: 1, backgroundColor: '#111' },
  vfGridV1:           { position: 'absolute', left: '33%', top: 0, bottom: 0, width: 1, backgroundColor: '#111' },
  vfGridV2:           { position: 'absolute', left: '66%', top: 0, bottom: 0, width: 1, backgroundColor: '#111' },
  vfCrosshairH:       { position: 'absolute', top: '50%', left: '40%', right: '40%', height: 1, backgroundColor: '#CB2027', opacity: 0.5 },
  vfCrosshairV:       { position: 'absolute', left: '50%', top: '40%', bottom: '40%', width: 1, backgroundColor: '#CB2027', opacity: 0.5 },
  vfCenter:           { alignItems: 'center', marginTop: 48 },
  vfLabel:            { color: '#CB2027', fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 3 },
  vfSub:              { color: '#333', fontSize: 9, letterSpacing: 3 },
  vfTag:              { position: 'absolute', bottom: 10, left: 12 },
  vfTagText:          { color: '#1a1a1a', fontSize: 9, letterSpacing: 2 },

  // Capture bottom
  captureBottomPanel: { backgroundColor: '#080808', borderTopWidth: 1, borderTopColor: '#111', paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center' },
  captureDimRow:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 20 },
  captureDimPill:     { borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3 },
  captureDimText:     { color: '#2a2a2a', fontSize: 9, letterSpacing: 2, fontWeight: '700' },
  captureBtn:         { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: '#333', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  captureBtnInner:    { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  captureBtnRing:     { position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 1, borderColor: '#CB2027' },
  captureBtnCore:     { width: 42, height: 42, borderRadius: 21, backgroundColor: '#CB2027' },
  captureHint:        { color: '#222', fontSize: 9, letterSpacing: 3 },

  // Processing screen
  processingScreen:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  processingCard:     { width: '100%', backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 4, padding: 24 },
  processingHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  processingTitle:    { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 3 },
  segBarRow:          { flexDirection: 'row', gap: 4, marginBottom: 8 },
  segBar:             { flex: 1, height: 4, borderRadius: 2 },
  segBarDone:         { backgroundColor: '#4CAF50' },
  segBarActive:       { backgroundColor: '#CB2027' },
  segBarEmpty:        { backgroundColor: '#1a1a1a' },
  processingPct:      { color: '#333', fontSize: 11, letterSpacing: 2, marginBottom: 24, textAlign: 'right' },
  processingLog:      { gap: 12, marginBottom: 24 },
  processingLogRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  processingLogIcon:  { fontSize: 14, fontWeight: '900', width: 16, textAlign: 'center' },
  processingLogText:  { fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  processingReadout:  { borderTopWidth: 1, borderTopColor: '#151515', paddingTop: 14 },
  processingReadoutText: { color: '#1a1a1a', fontSize: 9, letterSpacing: 2, textAlign: 'center' },

  // Legacy (used in other screens)
  cameraBox:          {
    width: 300, height: 280, borderWidth: 1, borderColor: '#CB2027',
    borderRadius: 4, justifyContent: 'center', alignItems: 'center',
    marginBottom: 28, borderStyle: 'dashed', backgroundColor: '#0d0000',
  },
  cameraIcon:         { fontSize: 52, marginBottom: 14 },
  cameraLabel:        { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 4, letterSpacing: 1 },
  cameraHint:         { color: '#444', fontSize: 12, letterSpacing: 1 },
  processingSteps:    { marginTop: 36, alignItems: 'flex-start' },
  processingStep:     { color: '#333', fontSize: 13, marginBottom: 10, letterSpacing: 0.5 },
  processingStepActive: { color: '#CB2027', fontSize: 13, marginBottom: 10, letterSpacing: 0.5 },

  // Results
  resultsScroll:      { flex: 1 },
  resultsContent:     { paddingBottom: 40 },

  // Score hero
  scoreHero:          { position: 'relative', overflow: 'hidden', marginBottom: 4 },
  scoreHeroGlow:      {
    position: 'absolute', top: -60, left: '50%', marginLeft: -120,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: '#CB2027', opacity: 0.07,
  },
  scoreHeroInner:     { padding: 24, paddingTop: 32, borderBottomWidth: 1, borderBottomColor: '#151515' },
  processTag:         { color: '#444', fontSize: 10, letterSpacing: 3, marginBottom: 16 },
  scoreRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  scoreBig:           { fontSize: 108, fontWeight: '900', lineHeight: 108, letterSpacing: -4 },
  scoreRightCol:      { marginLeft: 16, justifyContent: 'center', gap: 6 },
  scoreLabel:         { color: '#333', fontSize: 18, fontWeight: '700' },
  scoreSub:           { color: '#333', fontSize: 9, letterSpacing: 3 },
  gradeBadge:         { borderWidth: 1, borderRadius: 2, paddingHorizontal: 14, paddingVertical: 4, alignSelf: 'flex-start' },
  gradeText:          { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  scoreDivider:       { height: 1, backgroundColor: '#151515', marginBottom: 20 },
  scoreQuickStats:    { flexDirection: 'row', alignItems: 'center' },
  scoreQuickStat:     { flex: 1, alignItems: 'center' },
  scoreQuickVal:      { color: '#fff', fontSize: 16, fontWeight: '900', marginBottom: 3 },
  scoreQuickLabel:    { color: '#333', fontSize: 9, letterSpacing: 2 },
  scoreQuickDivider:  { width: 1, height: 28, backgroundColor: '#1a1a1a' },

  // Sections
  section:            { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 4 },
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  sectionTitle:       { color: '#444', fontSize: 10, letterSpacing: 3 },
  sectionSubtitle:    { color: '#222', fontSize: 10, letterSpacing: 2 },
  sectionBadge:       { backgroundColor: '#1a0000', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText:   { color: '#CB2027', fontSize: 10, fontWeight: '800' },

  // Defects
  defectRow:          {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a',
    borderRadius: 4, padding: 14, marginBottom: 8,
  },
  defectIndicator:    { width: 3, height: '100%', backgroundColor: '#FFC107', borderRadius: 2, marginRight: 12 },
  defectLeft:         { flex: 1 },
  defectName:         { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  defectLocation:     { color: '#444', fontSize: 11 },
  severityBadge:      { backgroundColor: '#1a1500', borderWidth: 1, borderColor: '#2a2000', borderRadius: 3, paddingHorizontal: 10, paddingVertical: 4 },
  severityText:       { color: '#FFC107', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  // Dimensions
  dimCard:            { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 4, paddingHorizontal: 16, paddingTop: 8 },
  dimRow:             { paddingVertical: 12 },
  dimRowBorder:       { borderBottomWidth: 1, borderBottomColor: '#141414' },
  dimLabelRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dimLabel:           { color: '#888', fontSize: 12 },
  dimScore:           { fontSize: 12, fontWeight: '800' },
  barBg:              { height: 4, backgroundColor: '#151515', borderRadius: 2, overflow: 'hidden' },
  barFill:            { height: 4, borderRadius: 2 },

  // Tips
  tipCard:            { flexDirection: 'row', backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 4, padding: 14, marginBottom: 8, alignItems: 'flex-start' },
  tipNumberBadge:     { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1a0000', borderWidth: 1, borderColor: '#CB2027', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 1 },
  tipNumber:          { color: '#CB2027', fontWeight: '900', fontSize: 11 },
  tipText:            { color: '#888', fontSize: 13, flex: 1, lineHeight: 20 },
  tipRow:             { flexDirection: 'row', marginBottom: 10 },

  // Wrong process
  wrongProcess:       { marginHorizontal: 20, marginBottom: 8, alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#111', marginTop: 8 },
  wrongProcessText:   { color: '#333', fontSize: 12, letterSpacing: 1 },

  // Back button
  backBtn:            { marginBottom: 16 },
  backBtnText:        { color: '#CB2027', fontSize: 14, fontWeight: '700' },

  // Saved machines
  savedSection:       { marginBottom: 24 },
  savedHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addBtn:             { borderWidth: 1, borderColor: '#CB2027', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 4 },
  addBtnText:         { color: '#CB2027', fontSize: 12, fontWeight: '800' },
  emptyText:          { color: '#626362', fontSize: 13, marginBottom: 8 },
  machineCard:        {
    borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 6,
    padding: 14, marginRight: 10, minWidth: 140,
  },
  machineCardActive:  { borderColor: '#CB2027', backgroundColor: '#1a0000' },
  machineName:        { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  machineNameActive:  { color: '#CB2027' },
  machineMeta:        { color: '#626362', fontSize: 12, marginBottom: 2 },
  machineHint:        { color: '#2a2a2a', fontSize: 10, marginTop: 6 },

  // Machine Settings
  machineContent:     { padding: 20, paddingBottom: 40 },
  selectorBlock:      { marginBottom: 20 },
  selectorLabel:      { color: '#626362', fontSize: 11, letterSpacing: 2, marginBottom: 10 },
  selectorRow:        { flexDirection: 'row', gap: 8 },
  chip:               { borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive:         { borderColor: '#CB2027', backgroundColor: '#1a0000' },
  chipText:           { color: '#626362', fontSize: 13, fontWeight: '600' },
  chipTextActive:     { color: '#CB2027' },
  settingsCard:       { backgroundColor: '#111', borderRadius: 8, padding: 20, marginTop: 8 },
  paramGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  paramBox:           { width: '47%', backgroundColor: '#000', borderRadius: 6, padding: 14, alignItems: 'center' },
  paramValue:         { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  paramLabel:         { color: '#626362', fontSize: 11, letterSpacing: 1 },

  // Onboarding
  onboardingScreen:       { flex: 1 },
  onboardingHero:         { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: 32, position: 'relative' },
  onboardingGlow:         { position: 'absolute', top: 60, left: '50%', marginLeft: -100, width: 200, height: 200, borderRadius: 100, backgroundColor: '#CB2027', opacity: 0.08 },
  onboardingLogo:         { fontSize: 42, fontWeight: '900', color: '#CB2027', letterSpacing: 6, marginBottom: 12 },
  onboardingTagline:      { fontSize: 22, fontWeight: '900', color: '#fff', lineHeight: 28, letterSpacing: 2 },
  onboardingContent:      { paddingHorizontal: 28, paddingVertical: 24, alignItems: 'stretch' },
  onboardingFeatureList:  { marginBottom: 28 },
  onboardingFeatureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 18 },
  onboardingFeatureIcon:  { fontSize: 22, width: 30 },
  onboardingFeatureTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  onboardingFeatureDesc:  { color: '#444', fontSize: 12, lineHeight: 17 },
  onboardingStepTitle:    { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 2, lineHeight: 34, marginBottom: 8 },
  onboardingStepSub:      { color: '#444', fontSize: 13, marginBottom: 28, lineHeight: 18 },
  onboardingHint:         { color: '#333', fontSize: 11, letterSpacing: 1, textAlign: 'center', marginBottom: 20, marginTop: -8 },
  onboardingSkip:         { color: '#333', fontSize: 12, letterSpacing: 1 },
  onboardingProgressRow:  { flexDirection: 'row', gap: 6, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 8 },
  onboardingProgressDot:  { flex: 1, height: 2, backgroundColor: '#1a1a1a', borderRadius: 1 },
  onboardingProgressDotDone:   { backgroundColor: '#4CAF50' },
  onboardingProgressDotActive: { backgroundColor: '#CB2027' },
  onboardingDoneGlow:     { position: 'absolute', top: -40, alignSelf: 'center', width: 200, height: 200, borderRadius: 100, backgroundColor: '#CB2027', opacity: 0.06 },
  processPickerGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  processPickerCard:      { width: '47%', backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 4, padding: 20, alignItems: 'center', position: 'relative' },
  processPickerCardActive:{ borderColor: '#CB2027', backgroundColor: '#0d0000' },
  processPickerLabel:     { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  processPickerSub:       { color: '#333', fontSize: 10, letterSpacing: 2 },
  processPickerCheck:     { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: '#CB2027', justifyContent: 'center', alignItems: 'center' },
  processPickerCheckText: { color: '#000', fontSize: 10, fontWeight: '900' },

  // Weld Detail
  detailHeader:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111' },
  detailBack:           { width: 48 },
  detailHeaderTitle:    { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  commentRow:           { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentBody:          { flex: 1 },
  commentBubble:        { backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 4, padding: 12, marginBottom: 6 },
  commentUser:          { color: '#CB2027', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  commentText:          { color: '#888', fontSize: 13, lineHeight: 18 },
  commentMeta:          { flexDirection: 'row', gap: 16, paddingLeft: 4 },
  commentTime:          { color: '#333', fontSize: 11 },
  commentLike:          { color: '#333', fontSize: 11 },
  commentReply:         { color: '#444', fontSize: 11, fontWeight: '700' },
  commentInputBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#080808', borderTopWidth: 1, borderTopColor: '#111' },
  commentInput:         { flex: 1, backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 2, color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  commentSendBtn:       { paddingHorizontal: 8 },
  commentSendText:      { color: '#333', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  // Post Weld
  buttonOutline:        { borderWidth: 1, borderColor: '#333', borderRadius: 2, paddingVertical: 14, alignItems: 'center', marginHorizontal: 20, marginBottom: 16 },
  buttonOutlineText:    { color: '#444', fontWeight: '800', fontSize: 13, letterSpacing: 3 },
  postPreviewCard:      { flexDirection: 'row', backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  postPreviewLeft:      { width: 90 },
  postPreviewImageBox:  { width: 90, height: 90, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  postPreviewRight:     { flex: 1, padding: 14, justifyContent: 'center' },
  postPreviewScore:     { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  postPreviewGrade:     { fontSize: 20, fontWeight: '900' },
  postPreviewLabel:     { color: '#333', fontSize: 9, letterSpacing: 3, marginTop: 2 },
  captionCount:         { color: '#333', fontSize: 11, textAlign: 'right', marginTop: 4 },
  visibilityRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 4, marginBottom: 8 },
  visibilityRowActive:  { borderColor: '#333', backgroundColor: '#111' },
  visibilityRadio:      { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
  visibilityRadioActive:{ borderColor: '#CB2027' },
  visibilityRadioDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CB2027' },
  visibilityLabel:      { color: '#444', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  visibilityDesc:       { color: '#333', fontSize: 11 },
  challengeToggle:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 4, marginTop: 8 },
  challengeToggleActive:{ borderColor: '#CB2027', backgroundColor: '#0d0000' },
  challengeToggleTitle: { color: '#444', fontSize: 12, fontWeight: '800', marginBottom: 3 },
  challengeToggleDesc:  { color: '#333', fontSize: 11 },
  toggleSwitch:         { width: 40, height: 22, borderRadius: 11, backgroundColor: '#1a1a1a', padding: 2 },
  toggleSwitchOn:       { backgroundColor: '#CB2027' },
  toggleKnob:           { width: 18, height: 18, borderRadius: 9, backgroundColor: '#333' },
  toggleKnobOn:         { backgroundColor: '#000', marginLeft: 18 },

  // Process strength
  processStrengthRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, gap: 10 },
  processStrengthCard:  { flex: 1, backgroundColor: '#0d0d0d', borderWidth: 1, borderRadius: 4, padding: 16, alignItems: 'center' },
  processStrengthLabel: { color: '#444', fontSize: 9, letterSpacing: 2, marginBottom: 8 },
  processStrengthProcess: { fontSize: 20, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
  processStrengthAvg:   { fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  processStrengthCount: { color: '#444', fontSize: 10, letterSpacing: 1 },
  processStrengthVs:    { alignItems: 'center' },
  processStrengthVsText:{ color: '#222', fontSize: 11, fontWeight: '900', letterSpacing: 2 },

  // Progress
  progressContent:    { paddingBottom: 40 },
  statsRow:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  statBox:            { flex: 1, alignItems: 'center', paddingVertical: 20 },
  statValue:          { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 4 },
  statLabel:          { fontSize: 11, color: '#626362', letterSpacing: 1 },

  // Chart
  chartWrap:          { flexDirection: 'row', alignItems: 'flex-end' },
  chartYAxis:         { justifyContent: 'space-between', height: 80, marginRight: 8, paddingBottom: 20 },
  chartYLabel:        { color: '#626362', fontSize: 10 },
  chartBars:          { flex: 1, flexDirection: 'row', alignItems: 'flex-end', height: 110 },
  chartBarCol:        { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar:           { width: 28, borderRadius: 3, marginBottom: 4 },
  chartBarLabel:      { color: '#626362', fontSize: 9, marginBottom: 2 },
  chartBarScore:      { fontSize: 10, fontWeight: '700' },

  // Process breakdown
  processStat:        { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  processStatLeft:    { width: 90 },
  processStatName:    { color: '#fff', fontSize: 13, fontWeight: '700' },
  processStatCount:   { color: '#626362', fontSize: 11 },
  processStatRight:   { flex: 1 },
  processStatAvg:     { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  processStatNone:    { color: '#2a2a2a', fontSize: 12 },

  // Badges
  badgeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard:          {
    width: '47%', backgroundColor: '#0d0d0d', borderWidth: 1,
    borderRadius: 4, padding: 14, alignItems: 'center',
  },
  badgeCardEarned:    { borderColor: '#4CAF50', backgroundColor: '#051005' },
  badgeCardLocked:    { borderColor: '#1a1a1a', opacity: 0.4 },
  badgeIcon:          { fontSize: 28, marginBottom: 8 },
  badgeName:          { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  badgeNameLocked:    { color: '#626362' },
  badgeDesc:          { color: '#626362', fontSize: 11, textAlign: 'center', lineHeight: 15 },

  // Community sub-tabs
  subTabBar:          { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111', backgroundColor: '#060606' },
  subTab:             { flex: 1, alignItems: 'center', paddingVertical: 12 },
  subTabText:         { color: '#333', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  subTabActive:       { color: '#fff' },
  subTabIndicator:    { width: 24, height: 2, backgroundColor: '#CB2027', marginTop: 6, borderRadius: 1 },

  // Feed posts
  postCard:           { borderBottomWidth: 1, borderBottomColor: '#0f0f0f', paddingBottom: 16, marginBottom: 4 },
  postHeader:         { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10 },
  avatar:             { width: 36, height: 36, borderRadius: 2, backgroundColor: '#CB2027', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText:         { color: '#000', fontWeight: '900', fontSize: 14 },
  postHeaderText:     { flex: 1 },
  postUser:           { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  postTime:           { color: '#333', fontSize: 11 },
  processPill:        { borderWidth: 1, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#0d0000' },
  processPillText:    { color: '#CB2027', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  postImagePlaceholder: {
    height: 240, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center', position: 'relative',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#111',
  },
  postImageIcon:      { fontSize: 52, opacity: 0.4 },
  postScoreBadge:     {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: '#000', borderWidth: 1, borderColor: '#1a1a1a',
    borderRadius: 4, padding: 10, alignItems: 'center',
  },
  postScoreNum:       { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  postGrade:          { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  postCaption:        { color: '#888', fontSize: 13, paddingHorizontal: 14, paddingTop: 10, lineHeight: 19 },
  postActions:        { flexDirection: 'row', paddingHorizontal: 14, paddingTop: 12, gap: 24 },
  postAction:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionIcon:     { color: '#444', fontSize: 18 },
  postActionCount:    { color: '#444', fontSize: 13 },

  // Discover
  challengeCard:      { margin: 20, backgroundColor: '#1a0000', borderWidth: 1, borderColor: '#CB2027', borderRadius: 8, padding: 16 },
  challengeLabel:     { color: '#CB2027', fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  challengeTitle:     { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  challengeDesc:      { color: '#626362', fontSize: 13, lineHeight: 18 },
  welderRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  welderInfo:         { flex: 1, marginLeft: 10 },
  welderName:         { color: '#fff', fontSize: 13, fontWeight: '700' },
  welderMeta:         { color: '#626362', fontSize: 12 },
  followBtn:          { borderWidth: 1, borderColor: '#626362', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
  followBtnActive:    { borderColor: '#CB2027', backgroundColor: '#1a0000' },
  followBtnText:      { color: '#626362', fontSize: 12, fontWeight: '700' },
  followBtnTextActive: { color: '#CB2027' },

  // Profile
  profileHeader:        { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  profileAvatar:        { width: 72, height: 72, borderRadius: 36, backgroundColor: '#CB2027', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  profileAvatarText:    { color: '#000', fontSize: 32, fontWeight: '900' },
  profileUsername:      { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  profileBio:           { color: '#626362', fontSize: 13, marginBottom: 20 },
  profileStats:         { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  profileStat:          { alignItems: 'center', paddingHorizontal: 16 },
  profileStatValue:     { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 2 },
  profileStatLabel:     { color: '#626362', fontSize: 10, letterSpacing: 1 },
  profileStatDivider:   { width: 1, height: 30, backgroundColor: '#1a1a1a' },
  editProfileBtn:       { borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 4, paddingHorizontal: 24, paddingVertical: 8 },
  editProfileText:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  weldGrid:             { flexDirection: 'row', flexWrap: 'wrap' },
  weldGridItem:         { width: '33.33%', aspectRatio: 1, padding: 1 },
  weldGridImage:        { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  weldGridIcon:         { fontSize: 28 },
  weldGridBadge:        { position: 'absolute', top: 6, right: 6, backgroundColor: '#000', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  weldGridScore:        { fontSize: 11, fontWeight: '900' },
  weldGridGrade:        { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  weldGridProcess:      { position: 'absolute', bottom: 6, left: 6, backgroundColor: '#000', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  weldGridProcessText:  { color: '#626362', fontSize: 9, fontWeight: '700' },

  // Challenge
  challengeHero:        { backgroundColor: '#0d0000', borderBottomWidth: 1, borderBottomColor: '#CB2027', padding: 20 },
  challengeWeekLabel:   { color: '#CB2027', fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  challengeHeroTitle:   { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 4 },
  challengeHeroSub:     { color: '#626362', fontSize: 13, marginBottom: 20 },
  challengeMeta:        { flexDirection: 'row', marginBottom: 16 },
  challengeMetaBox:     { flex: 1, alignItems: 'center' },
  challengeMetaValue:   { color: '#fff', fontSize: 16, fontWeight: '900', marginBottom: 2 },
  challengeMetaLabel:   { color: '#626362', fontSize: 10, letterSpacing: 1 },
  prizeRow:             { backgroundColor: '#1a0000', borderRadius: 6, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  prizeLabel:           { color: '#CB2027', fontSize: 12, fontWeight: '800' },
  prizeText:            { color: '#ccc', fontSize: 12, flex: 1 },
  submitRulesBox:       { backgroundColor: '#111', borderRadius: 8, padding: 16, marginBottom: 16 },
  submittedCard:        { backgroundColor: '#111', borderRadius: 8, padding: 24, alignItems: 'center', marginVertical: 16, width: '100%' },
  leaderRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 10 },
  leaderRowFirst:       { backgroundColor: '#0d0000', borderRadius: 8, paddingHorizontal: 8, borderBottomWidth: 0, marginBottom: 4 },
  leaderRank:           { width: 32, textAlign: 'center', color: '#626362', fontWeight: '900', fontSize: 13 },
  leaderRankFirst:      { fontSize: 22 },
  leaderInfo:           { flex: 1 },
  leaderCaption:        { color: '#626362', fontSize: 11, marginTop: 2 },
  leaderScoreCol:       { alignItems: 'center' },
  leaderScore:          { fontSize: 20, fontWeight: '900' },
  leaderGrade:          { fontSize: 12, fontWeight: '800' },
  leaderLike:           { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },

  // Tabs
  tabBar:             { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#111', backgroundColor: '#060606' },
  tab:                { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabText:            { color: '#333', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  tabActive:          { color: '#CB2027' },
  tabIndicator:       { width: 16, height: 2, backgroundColor: '#CB2027', marginTop: 4, borderRadius: 1 },
});
