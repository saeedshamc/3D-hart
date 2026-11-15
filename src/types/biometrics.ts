export type ScenarioId =
  | 'deep_sleep'
  | 'rem_active'
  | 'elevated_hr'
  | 'bradycardia'
  | 'arrhythmia';

export type AlertSeverity = 'normal' | 'warning' | 'critical';

export type CameraPresetId = 'anterior' | 'left_lateral' | 'superior' | 'posterior';

export type ViewModeId = 'anatomical' | 'conduction_xray' | 'exploded';

export type AnatomyPartId =
  | 'left_ventricle'
  | 'right_ventricle'
  | 'right_atrium'
  | 'left_atrium'
  | 'aorta'
  | 'pulmonary_trunk'
  | 'vena_cava'
  | 'coronary_vessels'
  | 'conduction_system';

export interface AnatomyPartInfo {
  id: AnatomyPartId;
  name: string;
  pediatricNote: string;
  role: string;
}

export interface ScenarioConfig {
  id: ScenarioId;
  label: string;
  targetBpm: number;
  bpmJitter: number;
  targetSpo2: number;
  skinTempC: number;
  rhythmLabel: string;
  irregularity: number; // 0..1
  description: string;
}

export interface AlertThresholds {
  lowBpm: number;
  highBpm: number;
  minSpo2: number;
}

export interface MobileAlertEntry {
  id: string;
  timestamp: string;
  severity: Exclude<AlertSeverity, 'normal'>;
  title: string;
  message: string;
  bpm: number;
  spo2: number;
  acknowledged: boolean;
}

export type CardiacPhase = 'Atrial Systole' | 'Ventricular Systole' | 'Diastole';

export interface TelemetrySnapshot {
  bpm: number;
  spo2: number;
  skinTempC: number;
  rhythmLabel: string;
  cardiacPhase: CardiacPhase;
  cardiacCyclePhase: number; // 0..1 within current beat
  severity: AlertSeverity;
  activeAlertTitle: string | null;
  activeAlertBody: string | null;
  ecgWave: number[]; // recent samples -0.3..1.2
}

export const ANATOMY_PARTS: Record<AnatomyPartId, AnatomyPartInfo> = {
  left_ventricle: {
    id: 'left_ventricle',
    name: 'Left Ventricle & Cardiac Apex',
    pediatricNote: 'Forms the rounded cardiac apex; thick muscular wall (~6–8 mm in young children) pumps oxygenated blood systemically.',
    role: 'Systemic Pumping Chamber',
  },
  right_ventricle: {
    id: 'right_ventricle',
    name: 'Right Ventricle & Conus Arteriosus',
    pediatricNote: 'Proportionally more prominent in infancy, curving anteriorly into the infundibulum toward the pulmonary valve.',
    role: 'Pulmonary Pumping Chamber',
  },
  right_atrium: {
    id: 'right_atrium',
    name: 'Right Atrium & Auricle',
    pediatricNote: 'Receives systemic venous return from SVC and IVC; houses the sinoatrial (SA) pacemaker node.',
    role: 'Venous Receiving Chamber',
  },
  left_atrium: {
    id: 'left_atrium',
    name: 'Left Atrium & Auricle',
    pediatricNote: 'Receives oxygenated blood from four pulmonary veins and delivers it through the mitral valve.',
    role: 'Oxygenated Receiving Chamber',
  },
  aorta: {
    id: 'aorta',
    name: 'Ascending Aorta & Aortic Arch',
    pediatricNote: 'Elastic great artery giving off brachiocephalic, left common carotid, and left subclavian branches.',
    role: 'Primary Systemic Outflow',
  },
  pulmonary_trunk: {
    id: 'pulmonary_trunk',
    name: 'Pulmonary Trunk & Bifurcation',
    pediatricNote: 'Arises anteriorly from the right ventricle and bifurcates beneath the aortic arch into left and right pulmonary arteries.',
    role: 'Pulmonary Outflow Tract',
  },
  vena_cava: {
    id: 'vena_cava',
    name: 'Superior & Inferior Vena Cava',
    pediatricNote: 'Large thin-walled venous conduits returning deoxygenated blood from the upper and lower body.',
    role: 'Systemic Venous Return',
  },
  coronary_vessels: {
    id: 'coronary_vessels',
    name: 'Coronary Arteries & Cardiac Veins',
    pediatricNote: 'LAD, LCx, and RCA travel along the interventricular and atrioventricular sulci to perfuse the myocardium.',
    role: 'Myocardial Perfusion',
  },
  conduction_system: {
    id: 'conduction_system',
    name: 'Cardiac Conduction System',
    pediatricNote: 'SA node initiates rapid pediatric sinus impulses (100–140 BPM), relayed via AV node, Bundle of His, and Purkinje fibers.',
    role: 'Electrical Pacemaker Network',
  },
};

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  deep_sleep: {
    id: 'deep_sleep',
    label: 'Quiet Sleep',
    targetBpm: 114,
    bpmJitter: 3,
    targetSpo2: 99,
    skinTempC: 36.6,
    rhythmLabel: 'Normal Sinus',
    irregularity: 0,
    description: 'Steady pediatric sinus rhythm during quiet restorative sleep.',
  },
  rem_active: {
    id: 'rem_active',
    label: 'Awake / Active',
    targetBpm: 138,
    bpmJitter: 6,
    targetSpo2: 98,
    skinTempC: 36.8,
    rhythmLabel: 'Sinus Variability',
    irregularity: 0.08,
    description: 'Higher sympathetic tone with natural pediatric respiratory sinus variability.',
  },
  elevated_hr: {
    id: 'elevated_hr',
    label: 'Tachycardia',
    targetBpm: 184,
    bpmJitter: 5,
    targetSpo2: 96,
    skinTempC: 37.5,
    rhythmLabel: 'Sinus Tachycardia',
    irregularity: 0.05,
    description: 'Rapid ventricular rate exceeding pediatric high-HR mobile alert threshold.',
  },
  bradycardia: {
    id: 'bradycardia',
    label: 'Bradycardia',
    targetBpm: 72,
    bpmJitter: 4,
    targetSpo2: 90,
    skinTempC: 36.2,
    rhythmLabel: 'Sinus Bradycardia',
    irregularity: 0.1,
    description: 'Slowed SA node firing & mild desaturation triggering critical mobile alert.',
  },
  arrhythmia: {
    id: 'arrhythmia',
    label: 'Irregular Beat',
    targetBpm: 128,
    bpmJitter: 14,
    targetSpo2: 95,
    skinTempC: 36.7,
    rhythmLabel: 'Irregular / PACs',
    irregularity: 0.72,
    description: 'Occasional premature atrial contractions visible in cardiac cycle & ECG.',
  },
};

export const CAMERA_PRESETS: Record<
  CameraPresetId,
  { label: string; position: [number, number, number]; target: [number, number, number] }
> = {
  anterior: {
    label: 'Anterior',
    position: [0.15, 0.35, 3.15],
    target: [0.0, 0.08, 0.0],
  },
  left_lateral: {
    label: 'Left / LAD',
    position: [2.55, 0.3, 1.65],
    target: [0.0, 0.06, 0.0],
  },
  superior: {
    label: 'Great Vessels',
    position: [0.25, 2.65, 1.55],
    target: [0.0, 0.38, 0.0],
  },
  posterior: {
    label: 'Posterior',
    position: [-0.35, 0.35, -3.1],
    target: [0.0, 0.08, 0.0],
  },
};
