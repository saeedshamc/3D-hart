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
  | 'cardiac_valves'
  | 'aorta'
  | 'pulmonary_trunk'
  | 'coronary_vessels'
  | 'conduction_system';

export type CardiacPhase = 'Atrial Systole' | 'Ventricular Systole' | 'Diastole';

export interface AnatomyPartInfo {
  id: AnatomyPartId;
  shortLabel: string;
  name: string;
  role: string;
  functionSummary: string;
  openCloseMechanism: string;
  phaseActions: Record<CardiacPhase, string>;
  focusCamera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  autoExplode: number; // 0..1 when focused
  autoXray: boolean;
}

export interface ScenarioConfig {
  id: ScenarioId;
  label: string;
  targetBpm: number;
  bpmJitter: number;
  targetSpo2: number;
  skinTempC: number;
  rhythmLabel: string;
  irregularity: number;
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
  ecgWave: number[];
}

export const ANATOMY_PARTS: Record<AnatomyPartId, AnatomyPartInfo> = {
  cardiac_valves: {
    id: 'cardiac_valves',
    shortLabel: 'دریچه‌ها',
    name: 'دریچه‌های چهارگانه قلب (میترال، تریکوسپید، آئورتی، ریوی)',
    role: 'کنترل یک‌طرفه جریان خون',
    functionSummary:
      'دریچه‌ها با اختلاف فشار بین حفره‌ها به‌صورت هماهنگ باز و بسته می‌شوند تا خون فقط در یک مسیر حرکت کند.',
    openCloseMechanism:
      'در فاز پرشدن (دیاستول)، دریچه‌های میترال و تریکوسپید به سمت پایین باز می‌شوند و هم‌زمان دریچه‌های آئورتی و ریوی بسته می‌مانند. هنگام انقباض بطنی (سیستول)، میترال و تریکوسپید با کشش طناب‌های وتری محکم بسته شده و دریچه‌های آئورتی و ریوی به سمت بالا باز می‌شوند.',
    phaseActions: {
      'Atrial Systole': 'میترال و تریکوسپید کاملاً باز · آئورتی و ریوی بسته',
      'Ventricular Systole': 'میترال و تریکوسپید بسته · آئورتی و ریوی باز (خروج خون)',
      Diastole: 'میترال و تریکوسپید باز (پرشدن بطن) · آئورتی و ریوی بسته',
    },
    focusCamera: {
      position: [0.35, 0.72, 2.35],
      target: [0.02, 0.08, 0.05],
    },
    autoExplode: 0.75,
    autoXray: true,
  },
  left_ventricle: {
    id: 'left_ventricle',
    shortLabel: 'بطن چپ',
    name: 'بطن چپ و رأس قلب (Left Ventricle)',
    role: 'پمپ اصلی خون اکسیژن‌دار به بدن',
    functionSummary:
      'ضخیم‌ترین دیواره عضلانی قلب کودک را دارد و خون تمیز را با فشار بالا از طریق آئورت به تمام اندام‌ها پمپ می‌کند.',
    openCloseMechanism:
      'در دیاستول دیواره آن شل شده و از طریق دریچه میترال باز پر از خون می‌شود؛ در سیستول منقبض و پیچ‌خورده (Torsion) می‌شود تا دریچه آئورتی را باز کرده و خون را پرتاب کند.',
    phaseActions: {
      'Atrial Systole': 'دریافت آخرین حجم خون از دهلیز چپ (دریچه میترال باز)',
      'Ventricular Systole': 'انقباض قوی دیواره · دریچه میترال بسته · خروج خون به آئورت',
      Diastole: 'استراحت عضله و پرشدن مجدد با خون اکسیژن‌دار',
    },
    focusCamera: {
      position: [1.65, -0.05, 1.95],
      target: [0.35, -0.25, 0.05],
    },
    autoExplode: 0.65,
    autoXray: false,
  },
  right_ventricle: {
    id: 'right_ventricle',
    shortLabel: 'بطن راست',
    name: 'بطن راست و مخروط شریانی (Right Ventricle)',
    role: 'پمپ خون تیره به ریه‌ها',
    functionSummary:
      'در کودکان بخش قدامی قلب را می‌سازد و خون کم‌اکسیژن را برای تصفیه به سمت سرخرگ ریوی می‌فرستد.',
    openCloseMechanism:
      'هنگام دیاستول از راه دریچه سه‌لتی (تریکوسپید) پر می‌شود و در سیستول با بسته شدن تریکوسپید، دریچه ریوی را باز کرده و خون را به تنه ریوی هدایت می‌کند.',
    phaseActions: {
      'Atrial Systole': 'تکمیل پرشدن بطن از طریق دریچه سه‌لتی باز',
      'Ventricular Systole': 'انقباض قدامی · بسته شدن تریکوسپید · باز شدن دریچه ریوی',
      Diastole: 'بازگشت به حالت آرامش و ورود خون وریدی از دهلیز راست',
    },
    focusCamera: {
      position: [-1.35, -0.02, 2.05],
      target: [-0.22, -0.15, 0.16],
    },
    autoExplode: 0.65,
    autoXray: false,
  },
  right_atrium: {
    id: 'right_atrium',
    shortLabel: 'دهلیز راست',
    name: 'دهلیز راست و گره سینوسی (Right Atrium)',
    role: 'دریافت خون بدن و شروع ضربان',
    functionSummary:
      'خون بازگشتی از کل بدن (بزرگ‌سیاهرگ‌های زبرین و زیرین) را دریافت می‌کند و ضربان‌ساز طبیعی قلب (گره SA) در دیواره آن قرار دارد.',
    openCloseMechanism:
      'ابتدا در سیستول بطنی پر از خون می‌شود، سپس در ابتدای هر ضربان منقبض شده و از طریق دریچه تریکوسپید خون را به بطن راست هل می‌دهد.',
    phaseActions: {
      'Atrial Systole': 'انقباض فعال دهلیز · ارسال خون به بطن راست',
      'Ventricular Systole': 'آرامش دهلیز و پرشدن از بزرگ‌سیاهرگ‌ها (تریکوسپید بسته)',
      Diastole: 'تخلیه غیرفعال خون به درون بطن راست',
    },
    focusCamera: {
      position: [-1.75, 0.55, 1.55],
      target: [-0.45, 0.28, 0.0],
    },
    autoExplode: 0.55,
    autoXray: false,
  },
  left_atrium: {
    id: 'left_atrium',
    shortLabel: 'دهلیز چپ',
    name: 'دهلیز چپ و سیاهرگ‌های ریوی (Left Atrium)',
    role: 'دریافت خون اکسیژن‌دار از ریه‌ها',
    functionSummary:
      'خون سرشار از اکسیژن را از چهار سیاهرگ ریوی تحویل گرفته و از مسیر دریچه میترال به بطن چپ منتقل می‌کند.',
    openCloseMechanism:
      'پس از باز شدن دریچه میترال خون را به بطن چپ می‌فرستد و با موج P نوار قلب یک انقباض کوتاه برای پرکردن کامل بطن انجام می‌دهد.',
    phaseActions: {
      'Atrial Systole': 'انقباض دهلیز چپ · تکمیل حجم بطن چپ',
      'Ventricular Systole': 'بسته بودن دریچه میترال · جمع‌آوری خون تازه از ریه‌ها',
      Diastole: 'باز شدن میترال و جریان خون اکسیژن‌دار به بطن چپ',
    },
    focusCamera: {
      position: [1.35, 0.72, -1.95],
      target: [0.28, 0.35, -0.28],
    },
    autoExplode: 0.55,
    autoXray: false,
  },
  aorta: {
    id: 'aorta',
    shortLabel: 'آئورت',
    name: 'آئورت صعودی و قوس آئورت (Aortic Arch)',
    role: 'شاه‌رگ توزیع خون به مغز و بدن',
    functionSummary:
      'بزرگ‌ترین سرخرگ بدن که با سه شاخه بالایی خود خون را به سر، مغز و دست‌ها و با آئورت نزولی به سایر بدن می‌رساند.',
    openCloseMechanism:
      'با باز شدن دریچه آئورتی، دیواره ارتجاعی آن منبسط می‌شود و در دیاستول با بسته شدن دریچه آئورتی جمع شده تا جریان خون را یکنواخت نگه دارد.',
    phaseActions: {
      'Atrial Systole': 'دریچه آئورتی بسته · ادامه جریان ملایم بر اثر خاصیت کشسانی',
      'Ventricular Systole': 'دریچه آئورتی باز · اتساع دیواره آئورت با فشار خون خروجی',
      Diastole: 'بسته شدن ناگهانی دریچه آئورتی و برگشت الاستیک دیواره',
    },
    focusCamera: {
      position: [0.55, 1.35, 2.05],
      target: [0.1, 0.72, -0.1],
    },
    autoExplode: 0.45,
    autoXray: false,
  },
  pulmonary_trunk: {
    id: 'pulmonary_trunk',
    shortLabel: 'تنه ریوی',
    name: 'تنه ریوی و انشعاب شریان‌های ریه',
    role: 'ارسال خون کم‌اکسیژن به ریه‌ها',
    functionSummary:
      'از بخش بالایی بطن راست خارج شده و زیر قوس آئورت به دو شاخه چپ و راست برای هر دو ریه تقسیم می‌شود.',
    openCloseMechanism:
      'دریچه ریوی در قاعده آن هنگام سیستول بطن راست باز می‌شود تا خون وارد ریه‌ها شود و در دیاستول بسته می‌ماند.',
    phaseActions: {
      'Atrial Systole': 'دریچه ریوی بسته',
      'Ventricular Systole': 'دریچه ریوی باز · پمپاژ خون تیره به ریه‌های چپ و راست',
      Diastole: 'بسته شدن دریچه ریوی برای جلوگیری از برگشت خون',
    },
    focusCamera: {
      position: [-0.55, 1.05, 2.1],
      target: [0.02, 0.58, 0.05],
    },
    autoExplode: 0.45,
    autoXray: false,
  },
  coronary_vessels: {
    id: 'coronary_vessels',
    shortLabel: 'عروق کرونری',
    name: 'سرخرگ‌ها و سیاهرگ‌های کرونری',
    role: 'خون‌رسانی به خود عضله قلب',
    functionSummary:
      'شریان‌های LAD، LCx و RCA روی سطح قلب قرار دارند و اکسیژن مورد نیاز میوکارد پرتحرک کودک را تأمین می‌کنند.',
    openCloseMechanism:
      'برخلاف سایر اندام‌ها، بیشترین خون‌رسانی به عروق کرونری در زمان دیاستول (آرامش عضله قلب و بسته‌بودن دریچه آئورت) انجام می‌شود.',
    phaseActions: {
      'Atrial Systole': 'ادامه جریان خون کرونری به عضله قلب',
      'Ventricular Systole': 'انقباض میوکارد · فشار موقت روی شاخه‌های عمقی',
      Diastole: 'اوج خون‌رسانی کرونری هنگام پرشدن سینوس‌های آئورتی',
    },
    focusCamera: {
      position: [1.35, 0.1, 1.95],
      target: [0.14, -0.1, 0.25],
    },
    autoExplode: 0.0,
    autoXray: false,
  },
  conduction_system: {
    id: 'conduction_system',
    shortLabel: 'سیستم الکتریکی',
    name: 'شبکه هدایت الکتریکی قلب (SA → AV → پورکینژ)',
    role: 'فرماندهی ریتم و هماهنگی انقباض',
    functionSummary:
      'پالس الکتریکی از گره سینوسی شروع شده، پس از مکث کوتاه در گره AV از راه دسته هیس و الیاف پورکینژ به هر دو بطن می‌رسد.',
    openCloseMechanism:
      'مکث ۰.۱۲ ثانیه‌ای در گره AV باعث می‌شود دهلیزها پیش از بسته‌شدن دریچه‌ها و انقباض بطن‌ها فرصت تخلیه کامل داشته باشند.',
    phaseActions: {
      'Atrial Systole': 'شلیک گره SA و عبور موج از دهلیزها به گره AV (موج P)',
      'Ventricular Systole': 'عبور سریع از دسته هیس و الیاف پورکینژ (کمپلکس QRS)',
      Diastole: 'بازیابی الکتریکی عضله (موج T) و آمادگی برای ضربان بعد',
    },
    focusCamera: {
      position: [0.1, 0.25, 2.35],
      target: [0.0, 0.05, 0.0],
    },
    autoExplode: 0.25,
    autoXray: true,
  },
};

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  deep_sleep: {
    id: 'deep_sleep',
    label: 'خواب آرام',
    targetBpm: 114,
    bpmJitter: 3,
    targetSpo2: 99,
    skinTempC: 36.6,
    rhythmLabel: 'ریتم سینوسی طبیعی',
    irregularity: 0,
    description: 'ضربان منظم و آرام کودک در خواب عمیق.',
  },
  rem_active: {
    id: 'rem_active',
    label: 'بیداری / تحرک',
    targetBpm: 138,
    bpmJitter: 6,
    targetSpo2: 98,
    skinTempC: 36.8,
    rhythmLabel: 'ریتم فعال طبیعی',
    irregularity: 0.08,
    description: 'افزایش طبیعی ضربان در بیداری یا خواب REM.',
  },
  elevated_hr: {
    id: 'elevated_hr',
    label: 'تاکیکاردی (تند)',
    targetBpm: 184,
    bpmJitter: 5,
    targetSpo2: 96,
    skinTempC: 37.5,
    rhythmLabel: 'تاکیکاردی سینوسی',
    irregularity: 0.05,
    description: 'ضربان بالا بیش از آستانه مجاز و ارسال هشدار موبایل.',
  },
  bradycardia: {
    id: 'bradycardia',
    label: 'برادیکاردی (کند)',
    targetBpm: 72,
    bpmJitter: 4,
    targetSpo2: 90,
    skinTempC: 36.2,
    rhythmLabel: 'برادیکاردی و افت اکسیژن',
    irregularity: 0.1,
    description: 'کاهش خطرناک ضربان و SpO2 همراه با هشدار فوری.',
  },
  arrhythmia: {
    id: 'arrhythmia',
    label: 'ضربان نامنظم',
    targetBpm: 128,
    bpmJitter: 14,
    targetSpo2: 95,
    skinTempC: 36.7,
    rhythmLabel: 'نامنظمی ضربان (PAC)',
    irregularity: 0.72,
    description: 'ضربان‌های زودرس دهلیزی قابل مشاهده روی قلب و نوار ECG.',
  },
};

export const CAMERA_PRESETS: Record<
  CameraPresetId,
  { label: string; position: [number, number, number]; target: [number, number, number] }
> = {
  anterior: {
    label: 'نمای روبرو',
    position: [0.15, 0.35, 3.15],
    target: [0.0, 0.08, 0.0],
  },
  left_lateral: {
    label: 'چپ / کرونری',
    position: [2.55, 0.3, 1.65],
    target: [0.0, 0.06, 0.0],
  },
  superior: {
    label: 'رگ‌های بزرگ',
    position: [0.25, 2.65, 1.55],
    target: [0.0, 0.38, 0.0],
  },
  posterior: {
    label: 'نمای پشتی',
    position: [-0.35, 0.35, -3.1],
    target: [0.0, 0.08, 0.0],
  },
};
