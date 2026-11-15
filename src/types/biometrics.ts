export type ScenarioId =
  | 'deep_sleep'
  | 'rem_active'
  | 'elevated_hr'
  | 'bradycardia'
  | 'arrhythmia';

export type AlertSeverity = 'normal' | 'warning' | 'critical';

export type VascularScopeId = 'heart' | 'full_body';

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
  | 'conduction_system'
  | 'brain_carotid'
  | 'pulmonary_loop'
  | 'upper_limbs'
  | 'hands_fingers'
  | 'renal_visceral'
  | 'lower_limbs';

export type CardiacPhase = 'Atrial Systole' | 'Ventricular Systole' | 'Diastole';

export interface AnatomyPartInfo {
  id: AnatomyPartId;
  category: 'heart' | 'vascular';
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
  autoExplode: number;
  autoXray: boolean;
  requiredScope: VascularScopeId;
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
  cardiacCyclePhase: number;
  severity: AlertSeverity;
  activeAlertTitle: string | null;
  activeAlertBody: string | null;
  ecgWave: number[];
}

export const ANATOMY_PARTS: Record<AnatomyPartId, AnatomyPartInfo> = {
  cardiac_valves: {
    id: 'cardiac_valves',
    category: 'heart',
    shortLabel: 'دریچه‌ها',
    name: 'دریچه‌های چهارگانه قلب (میترال، تریکوسپید، آئورتی، ریوی)',
    role: 'کنترل یک‌طرفه جریان خون',
    functionSummary:
      'دریچه‌ها با اختلاف فشار بین حفره‌ها به‌صورت هماهنگ باز و بسته می‌شوند تا خون فقط در یک مسیر حرکت کند.',
    openCloseMechanism:
      'در دیاستول دریچه‌های میترال و تریکوسپید به سمت پایین باز می‌شوند و آئورتی و ریوی بسته می‌مانند. در سیستول، میترال و تریکوسپید با کشش طناب‌های وتری بسته شده و آئورتی و ریوی باز می‌شوند.',
    phaseActions: {
      'Atrial Systole': 'میترال و تریکوسپید باز · آئورتی و ریوی بسته',
      'Ventricular Systole': 'میترال و تریکوسپید بسته · آئورتی و ریوی باز (خروج خون)',
      Diastole: 'میترال و تریکوسپید باز (پرشدن بطن) · آئورتی و ریوی بسته',
    },
    focusCamera: {
      position: [0.35, 0.72, 2.35],
      target: [0.02, 0.08, 0.05],
    },
    autoExplode: 0.75,
    autoXray: true,
    requiredScope: 'heart',
  },
  left_ventricle: {
    id: 'left_ventricle',
    category: 'heart',
    shortLabel: 'بطن چپ',
    name: 'بطن چپ و رأس قلب (Left Ventricle)',
    role: 'پمپ اصلی خون اکسیژن‌دار به بدن',
    functionSummary:
      'ضخیم‌ترین دیواره عضلانی قلب را دارد و خون اکسیژن‌دار را با فشار بالا از آئورت به کل بدن می‌فرستد.',
    openCloseMechanism:
      'در دیاستول از طریق دریچه میترال باز پر از خون می‌شود؛ در سیستول منقبض و پیچ‌خورده می‌شود تا دریچه آئورتی را باز کند.',
    phaseActions: {
      'Atrial Systole': 'تکمیل پرشدن از دهلیز چپ (دریچه میترال باز)',
      'Ventricular Systole': 'انقباض قوی دیواره · دریچه میترال بسته · خروج خون به آئورت',
      Diastole: 'استراحت عضله و پرشدن مجدد با خون اکسیژن‌دار',
    },
    focusCamera: {
      position: [1.65, -0.05, 1.95],
      target: [0.35, -0.25, 0.05],
    },
    autoExplode: 0.65,
    autoXray: false,
    requiredScope: 'heart',
  },
  right_ventricle: {
    id: 'right_ventricle',
    category: 'heart',
    shortLabel: 'بطن راست',
    name: 'بطن راست و مخروط شریانی (Right Ventricle)',
    role: 'پمپ خون تیره به ریه‌ها',
    functionSummary:
      'خون کم‌اکسیژن را دریافت کرده و از راه تنه ریوی برای اکسیژن‌گیری به هر دو ریه ارسال می‌کند.',
    openCloseMechanism:
      'هنگام دیاستول از راه دریچه سه‌لتی پر می‌شود و در سیستول با بسته شدن تریکوسپید، دریچه ریوی را باز می‌کند.',
    phaseActions: {
      'Atrial Systole': 'ورود خون از دهلیز راست (دریچه سه‌لتی باز)',
      'Ventricular Systole': 'انقباض قدامی · بسته شدن تریکوسپید · باز شدن دریچه ریوی',
      Diastole: 'آرامش دیواره و دریافت خون وریدی',
    },
    focusCamera: {
      position: [-1.35, -0.02, 2.05],
      target: [-0.22, -0.15, 0.16],
    },
    autoExplode: 0.65,
    autoXray: false,
    requiredScope: 'heart',
  },
  right_atrium: {
    id: 'right_atrium',
    category: 'heart',
    shortLabel: 'دهلیز راست',
    name: 'دهلیز راست و گره سینوسی (Right Atrium)',
    role: 'دریافت خون بدن و شروع ضربان',
    functionSummary:
      'خون وریدی کل بدن را از بزرگ‌سیاهرگ‌های زبرین و زیرین جمع‌آوری می‌کند و میزبان گره ضربان‌ساز SA است.',
    openCloseMechanism:
      'ابتدا پر از خون می‌شود و سپس با انقباض دهلیزی خون را از دریچه تریکوسپید به بطن راست هدایت می‌کند.',
    phaseActions: {
      'Atrial Systole': 'انقباض فعال دهلیز · ارسال خون به بطن راست',
      'Ventricular Systole': 'پرشدن از بزرگ‌سیاهرگ‌ها (دریچه تریکوسپید بسته)',
      Diastole: 'انتقال آرام خون به بطن راست',
    },
    focusCamera: {
      position: [-1.75, 0.55, 1.55],
      target: [-0.45, 0.28, 0.0],
    },
    autoExplode: 0.55,
    autoXray: false,
    requiredScope: 'heart',
  },
  left_atrium: {
    id: 'left_atrium',
    category: 'heart',
    shortLabel: 'دهلیز چپ',
    name: 'دهلیز چپ و سیاهرگ‌های ریوی (Left Atrium)',
    role: 'دریافت خون اکسیژن‌دار از ریه‌ها',
    functionSummary:
      'خون اکسیژن‌دار را از چهار سیاهرگ ریوی تحویل گرفته و از مسیر دریچه میترال به بطن چپ منتقل می‌کند.',
    openCloseMechanism:
      'پس از باز شدن میترال، خون اکسیژن‌دار را وارد بطن چپ کرده و با موج P انقباض نهایی را انجام می‌دهد.',
    phaseActions: {
      'Atrial Systole': 'انقباض دهلیز چپ · تکمیل حجم بطن چپ',
      'Ventricular Systole': 'بسته بودن میترال · جمع‌آوری خون تازه از ریه‌ها',
      Diastole: 'باز شدن میترال و جریان خون به بطن چپ',
    },
    focusCamera: {
      position: [1.35, 0.72, -1.95],
      target: [0.28, 0.35, -0.28],
    },
    autoExplode: 0.55,
    autoXray: false,
    requiredScope: 'heart',
  },
  aorta: {
    id: 'aorta',
    category: 'heart',
    shortLabel: 'آئورت',
    name: 'آئورت صعودی و قوس آئورت (Aortic Arch)',
    role: 'شاه‌رگ توزیع خون به مغز و بدن',
    functionSummary:
      'بزرگ‌ترین سرخرگ بدن که خون را به شریان‌های سر، دست‌ها، اندام‌های شکمی و پاها توزیع می‌کند.',
    openCloseMechanism:
      'در سیستول با باز شدن دریچه آئورتی منبسط می‌شود و در دیاستول با برگشت الاستیک جریان را یکنواخت نگه می‌دارد.',
    phaseActions: {
      'Atrial Systole': 'دریچه آئورتی بسته · جریان پیوسته کشسانی',
      'Ventricular Systole': 'دریچه آئورتی باز · اتساع دیواره آئورت با پالس فشار',
      Diastole: 'بسته‌شدن دریچه آئورتی و جمع‌شدن الاستیک دیواره',
    },
    focusCamera: {
      position: [0.55, 1.35, 2.05],
      target: [0.1, 0.72, -0.1],
    },
    autoExplode: 0.45,
    autoXray: false,
    requiredScope: 'heart',
  },
  pulmonary_trunk: {
    id: 'pulmonary_trunk',
    category: 'heart',
    shortLabel: 'تنه ریوی',
    name: 'تنه ریوی و انشعاب شریان‌های ریه',
    role: 'ارسال خون کم‌اکسیژن به ریه‌ها',
    functionSummary:
      'از بطن راست خارج شده و زیر قوس آئورت به دو شاخه چپ و راست برای ریه‌ها تقسیم می‌شود.',
    openCloseMechanism:
      'دریچه ریوی در قاعده آن هنگام سیستول باز شده و در دیاستول برای جلوگیری از برگشت خون بسته می‌شود.',
    phaseActions: {
      'Atrial Systole': 'دریچه ریوی بسته',
      'Ventricular Systole': 'دریچه ریوی باز · پمپاژ خون تیره به ریه‌ها',
      Diastole: 'بسته‌شدن دریچه ریوی',
    },
    focusCamera: {
      position: [-0.55, 1.05, 2.1],
      target: [0.02, 0.58, 0.05],
    },
    autoExplode: 0.45,
    autoXray: false,
    requiredScope: 'heart',
  },
  coronary_vessels: {
    id: 'coronary_vessels',
    category: 'heart',
    shortLabel: 'عروق کرونری',
    name: 'سرخرگ‌ها و سیاهرگ‌های کرونری',
    role: 'خون‌رسانی به خود عضله قلب',
    functionSummary:
      'شریان‌های LAD، LCx و RCA روی سطح قلب قرار دارند و اکسیژن مورد نیاز میوکارد را تأمین می‌کنند.',
    openCloseMechanism:
      'بیشترین خون‌رسانی کرونری هنگام دیاستول (آرامش عضله و بسته‌بودن دریچه آئورت) صورت می‌گیرد.',
    phaseActions: {
      'Atrial Systole': 'تداوم خون‌رسانی کرونری',
      'Ventricular Systole': 'فشار عضله منقبض بر شاخه‌های عمقی',
      Diastole: 'اوج جریان خون کرونری به دیواره قلب',
    },
    focusCamera: {
      position: [1.35, 0.1, 1.95],
      target: [0.14, -0.1, 0.25],
    },
    autoExplode: 0.0,
    autoXray: false,
    requiredScope: 'heart',
  },
  conduction_system: {
    id: 'conduction_system',
    category: 'heart',
    shortLabel: 'سیستم الکتریکی',
    name: 'شبکه هدایت الکتریکی (SA → AV → پورکینژ)',
    role: 'فرماندهی ریتم و هماهنگی ضربان',
    functionSummary:
      'پالس الکتریکی از گره SA به AV، دسته هیس و الیاف پورکینژ منتقل می‌شود تا حفره‌ها هماهنگ منقبض شوند.',
    openCloseMechanism:
      'مکث کوتاه در گره AV باعث می‌شود دهلیزها پیش از بسته شدن دریچه‌ها و انقباض بطن‌ها کامل تخلیه شوند.',
    phaseActions: {
      'Atrial Systole': 'تحریک گره SA و دهلیزها (موج P)',
      'Ventricular Systole': 'انتشار سریع در دسته هیس و پورکینژ (QRS)',
      Diastole: 'بازیابی الکتریکی میوکارد (موج T)',
    },
    focusCamera: {
      position: [0.1, 0.25, 2.35],
      target: [0.0, 0.05, 0.0],
    },
    autoExplode: 0.25,
    autoXray: true,
    requiredScope: 'heart',
  },
  // Full-body systemic & pulmonary vascular regions
  brain_carotid: {
    id: 'brain_carotid',
    category: 'vascular',
    shortLabel: 'مغز و کاروتید',
    name: 'شریان‌های کاروتید، حلقه ویلیس و وریدهای ژوگولار',
    role: 'گردش خون مغزی و سر',
    functionSummary:
      'شریان‌های کاروتید مشترک و مهره‌ای خون اکسیژن‌دار را مستقیم از قوس آئورت به مغز می‌برند و وریدهای ژوگولار خون را به بزرگ‌سیاهرگ زبرین بازمی‌گردانند.',
    openCloseMechanism:
      'نبض شریان کاروتید بلافاصله پس از باز شدن دریچه آئورتی به مغز می‌رسد و خودتنظیمی عروق مغز جریان ثابت را حفظ می‌کند.',
    phaseActions: {
      'Atrial Systole': 'بازگشت آرام خون وریدی از سینوس‌های مغزی به ژوگولار',
      'Ventricular Systole': 'ارسال موج فشار شریانی به کاروتید و حلقه ویلیس',
      Diastole: 'تداوم پرفیوژن یکنواخت بافت مغز',
    },
    focusCamera: {
      position: [0.35, 1.95, 3.25],
      target: [0.0, 1.55, -0.05],
    },
    autoExplode: 0.0,
    autoXray: false,
    requiredScope: 'full_body',
  },
  pulmonary_loop: {
    id: 'pulmonary_loop',
    category: 'vascular',
    shortLabel: 'گردش ریوی',
    name: 'شبکه عروق ریوی چپ و راست (تبادل اکسیژن)',
    role: 'اکسیژن‌گیری خون در ریه‌ها',
    functionSummary:
      'شریان‌های ریوی خون تیره را به بستر مویرگی هر دو ریه می‌برند تا پس از جذب اکسیژن از راه سیاهرگ‌های ریوی به دهلیز چپ برگردد.',
    openCloseMechanism:
      'با باز شدن دریچه ریوی، خون با فشار ملایم به شبکه مویرگی ریه‌ها پمپاژ می‌شود تا آسیب نبیند.',
    phaseActions: {
      'Atrial Systole': 'ورود خون اکسیژن‌دار از ریه‌ها به دهلیز چپ',
      'Ventricular Systole': 'پمپاژ خون کم‌اکسیژن از بطن راست به شریان‌های ریه',
      Diastole: 'تبادل گاز CO2 و O2 در مویرگ‌های حبابکی ریه',
    },
    focusCamera: {
      position: [0.1, 0.55, 3.35],
      target: [0.0, 0.28, -0.08],
    },
    autoExplode: 0.0,
    autoXray: false,
    requiredScope: 'full_body',
  },
  upper_limbs: {
    id: 'upper_limbs',
    category: 'vascular',
    shortLabel: 'رگ‌های دست و بازو',
    name: 'شریان ساب‌کلاوین، بازویی، رادیال، اولنار و وریدهای سفالیک/بازیلیک',
    role: 'خون‌رسانی شریانی و بازگشت وریدی بازو و ساعد',
    functionSummary:
      'خون اکسیژن‌دار از قوس آئورت به زیرترقوه‌ای، زیربغلی، بازویی (براکیال) و دو شریان رادیال و اولنار در ساعد می‌رود و از طریق وریدهای عمقی بازویی و سطحی سفالیک، بازیلیک و مدین‌کوبیتال بازمی‌گردد.',
    openCloseMechanism:
      'دریچه‌های لانه‌کبوتری درون وریدهای بازویی، سفالیک و بازیلیک مانع برگشت خون به پایین شده و بازگشت به قلب را تسهیل می‌کنند.',
    phaseActions: {
      'Atrial Systole': 'بازگشت خون از وریدهای سفالیک و بازیلیک به ساب‌کلاوین',
      'Ventricular Systole': 'عبور موج نبض قابل لمس در شریان بازویی و رادیال مچ دست',
      Diastole: 'تداوم جریان متعادل در رگ‌های بازو و ساعد',
    },
    focusCamera: {
      position: [1.95, 0.25, 3.35],
      target: [1.05, -0.1, 0.05],
    },
    autoExplode: 0.0,
    autoXray: false,
    requiredScope: 'full_body',
  },
  hands_fingers: {
    id: 'hands_fingers',
    category: 'vascular',
    shortLabel: 'کف دست و انگشتان',
    name: 'قوس‌های کف‌دستی، شریان‌ها و وریدهای انگشتان پنج‌گانه',
    role: 'خون‌رسانی ظریف کف دست، شست و چهار انگشت',
    functionSummary:
      'شریان‌های رادیال و اولنار در کف دست به قوس‌های کف‌دستی سطحی و عمقی متصل می‌شوند و از هر قوس، شریان‌های انگشتی به دو طرف شست، اشاره، میانی، حلقه و کوچک می‌روند؛ خون پس از تغذیه نوک انگشتان از طریق شبکه وریدی پشت دست به وریدهای سفالیک و بازیلیک بازمی‌گردد.',
    openCloseMechanism:
      'قوس‌های کف‌دستی یک مسیر ایمنی دوتایی می‌سازند تا اگر یکی از شریان‌های مچ فشرده شد، خون‌رسانی به تمام انگشتان ادامه یابد.',
    phaseActions: {
      'Atrial Systole': 'تخلیه خون از وریدهای انگشتی و شبکه وریدی پشت دست',
      'Ventricular Systole': 'ارسال پالس خون اکسیژن‌دار به قوس کف‌دستی و نوک پنج انگشت',
      Diastole: 'تبادل اکسیژن در بستر مویرگی زیرناخنی و سرانگشتان (محل اندازه‌گیری SpO2)',
    },
    focusCamera: {
      position: [2.25, -0.78, 1.48],
      target: [1.56, -1.16, 0.18],
    },
    autoExplode: 0.0,
    autoXray: false,
    requiredScope: 'full_body',
  },
  renal_visceral: {
    id: 'renal_visceral',
    category: 'vascular',
    shortLabel: 'کلیه‌ها و احشا',
    name: 'آئورت شکمی، تنه سلیاک و شریان‌های کلیوی',
    role: 'تصفیه خون و تغذیه اندام‌های حیاتی',
    functionSummary:
      'حدود ۲۰ تا ۲۵ درصد خروجی قلب از آئورت شکمی وارد شریان‌های کلیوی می‌شود تا خون تصفیه شود؛ شریان‌های کبدی و مزانتریک نیز دستگاه گوارش را تغذیه می‌کنند.',
    openCloseMechanism:
      'فشار مداوم آئورت شکمی جریان پایدار تصفیه گلومرولی را در هر دو کلیه حفظ می‌کند.',
    phaseActions: {
      'Atrial Systole': 'بازگشت خون تصفیه‌شده از وریدهای کلیوی و کبدی به IVC',
      'Ventricular Systole': 'ورود موج فشار خون به شریان‌های کلیوی و سلیاک',
      Diastole: 'ادامه فیلتراسیون و جریان احشایی',
    },
    focusCamera: {
      position: [0.3, -0.65, 3.25],
      target: [0.0, -0.92, -0.12],
    },
    autoExplode: 0.0,
    autoXray: false,
    requiredScope: 'full_body',
  },
  lower_limbs: {
    id: 'lower_limbs',
    category: 'vascular',
    shortLabel: 'لگن و پاها',
    name: 'شریان ایلیاک، فمورال، تیبیال و ورید صافن بزرگ',
    role: 'گردش خون اندام تحتانی',
    functionSummary:
      'آئورت در لگن به شریان‌های ایلیاک تقسیم شده و از مسیر ران (فمورال)، پشت زانو (پوپلیتئال) و ساق پا تا قوس کف پا ادامه می‌یابد.',
    openCloseMechanism:
      'انقباض عضلات پا به همراه دریچه‌های وریدی یک‌طرفه خون را برخلاف جاذبه به بزرگ‌سیاهرگ زیرین برمی‌گرداند.',
    phaseActions: {
      'Atrial Systole': 'صعود خون وریدی در ورید فمورال و صافن بزرگ به سمت قلب',
      'Ventricular Systole': 'رسیدن موج نبض قوی به شریان فمورال و پشت پا',
      Diastole: 'پرفیوژن بافت‌های عضلانی ساق و کف پا',
    },
    focusCamera: {
      position: [0.4, -2.05, 4.7],
      target: [0.0, -2.35, 0.0],
    },
    autoExplode: 0.0,
    autoXray: false,
    requiredScope: 'full_body',
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

export const CAMERA_PRESETS_BY_SCOPE: Record<
  VascularScopeId,
  Record<
    CameraPresetId,
    { label: string; position: [number, number, number]; target: [number, number, number] }
  >
> = {
  heart: {
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
  },
  full_body: {
    anterior: {
      label: 'تمام‌قد روبرو',
      position: [0.0, -0.55, 8.85],
      target: [0.0, -0.78, 0.0],
    },
    left_lateral: {
      label: 'نمای نیم‌رخ',
      position: [6.8, -0.35, 4.9],
      target: [0.0, -0.78, 0.0],
    },
    superior: {
      label: 'بالاتنه و مغز',
      position: [0.3, 1.45, 4.35],
      target: [0.0, 0.72, -0.05],
    },
    posterior: {
      label: 'تمام‌قد پشتی',
      position: [0.0, -0.55, -8.85],
      target: [0.0, -0.78, 0.0],
    },
  },
};
