import type { Task } from '@/types';

/**
 * Initial tasks based on the actual daily routine.
 * Each task declares which shift(s) it belongs to and which time block.
 *
 * shifts: ['morning'] | ['evening'] | ['morning', 'evening']
 * timeBlock: one of the block IDs from scheduleConfig.ts
 */
export const INITIAL_TASKS: Task[] = [
  // ══════════════════════════════════════════════════
  // 🕌 عبادة — تظهر في كلا الوردتين
  // ══════════════════════════════════════════════════
  {
    id: 1,
    icon: '🕌',
    title: 'الصلوات الخمس',
    shifts: ['morning', 'evening'],
    timeBlock: 'prayer',
    isPrayerTask: true,
    category: 'عبادة',
    color: 'var(--gold)',
    isWarning: false,
    recurrence: 'يومي',
    subtasks: [
      { id: 's1', text: 'الفجر' },
      { id: 's2', text: 'الظهر' },
      { id: 's3', text: 'العصر' },
      { id: 's4', text: 'المغرب' },
      { id: 's5', text: 'العشاء' },
    ],
    brief: {
      blockers: ['النوم بعد الفجر', 'الانشغال بالشاشات وقت الأذان', 'الكسل والتأجيل'],
      helpers: ['ضبط منبه لكل أذان', 'تطبيق أذان على الموبايل', 'الوضوء المبكر قبل الوقت'],
    },
  },

  // ══════════════════════════════════════════════════
  // ☀️ الأسبوع الصباحي — بداية الدوام (٥-٩ص)
  // ══════════════════════════════════════════════════
  {
    id: 10,
    icon: '📧',
    title: 'متابعة إيميلات العمل',
    shifts: ['morning'],
    timeBlock: 'work-early',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'أيام العمل',
    subtasks: [],
    brief: {
      blockers: ['فتح السوشيال ميديا أول الصبح', 'كتر الإيميلات وعدم التصفية'],
      helpers: ['ابدأ بأهم ٣ رسائل فقط', 'اغلق التاب بعد الخلاص'],
    },
  },
  {
    id: 11,
    icon: '📋',
    title: 'تحديث ملف الريفيل للوصفات',
    shifts: ['morning'],
    timeBlock: 'work-early',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'أيام العمل',
    subtasks: [],
    brief: {
      blockers: ['عدم وضوح التعديلات المطلوبة', 'انتظار معلومات من طرف ثاني'],
      helpers: ['راجع الملف الحالي أولاً', 'خصص ٣٠ دقيقة بدون مقاطعة'],
    },
  },
  {
    id: 12,
    icon: '🔧',
    title: 'متابعة الصيانة والنواقص',
    shifts: ['morning'],
    timeBlock: 'work-early',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'أيام العمل',
    subtasks: [
      { id: 'm1', text: 'متابعة طلبات الصيانة المفتوحة' },
      { id: 'm2', text: 'تحويلات النواقص للمورد' },
    ],
    brief: {
      blockers: ['عدم وجود قائمة واضحة بالنواقص', 'تأخر الموردين في الرد'],
      helpers: ['حدّث القائمة يومياً', 'تواصل مع المورد في بداية الدوام'],
    },
  },
  {
    id: 13,
    icon: '💻',
    title: 'جلسة البرمجة الصباحية',
    shifts: ['morning'],
    timeBlock: 'work-early',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'أيام العمل',
    subtasks: [],
    brief: {
      blockers: ['الانشغال بمهام الإدارة والإيميلات', 'الإرهاق قبل البدء', 'عدم وضوح المهمة'],
      helpers: [
        'حدد المهمة البرمجية مسبقاً من آخر الدوام',
        'الوقت من ٦-٩ فرصة ذهبية بدون مقاطعة',
        'ضع Pomodoro ٤٥ دقيقة',
      ],
    },
  },

  // ══════════════════════════════════════════════════
  // ☀️ الأسبوع الصباحي — الدوام الرئيسي (٩ص-١:٣٠م)
  // ══════════════════════════════════════════════════
  {
    id: 20,
    icon: '📞',
    title: 'التواصل مع عملاء الريفيل',
    shifts: ['morning'],
    timeBlock: 'work-main',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'أيام العمل',
    subtasks: [],
    brief: {
      blockers: ['عملاء لا يردون في هذا الوقت', 'انتظار موافقات داخلية'],
      helpers: ['جهز قائمة العملاء المطلوب التواصل معهم', 'سجّل ملاحظات كل مكالمة فوراً'],
    },
  },

  // ══════════════════════════════════════════════════
  // 👨‍👩‍👦 وقت العائلة — مشترك بين الوردتين
  // ══════════════════════════════════════════════════
  {
    id: 30,
    icon: '📖',
    title: 'حصة درس المد لأحمد',
    shifts: ['morning', 'evening'],
    timeBlock: 'family',
    isPrayerTask: false,
    category: 'أسرة',
    color: '#9bc87a',
    isWarning: false,
    recurrence: 'أيام العمل',
    alertTime: '16:00',
    subtasks: [],
    brief: {
      blockers: ['تعب أحمد أو عدم تركيزه', 'مقاطعات المنزل وقت الحصة'],
      helpers: ['اختار وقت بعد أكل وراحة قصيرة', 'جهز اللوح والورقة قبل الجلسة'],
    },
  },
  {
    id: 31,
    icon: '🚫',
    title: 'ممنوع النوم بعد العصر',
    shifts: ['morning'],
    timeBlock: 'family',
    isPrayerTask: false,
    category: 'تنبيه',
    color: '#d97e6a',
    isWarning: true,
    recurrence: 'يومي',
    subtasks: [],
    brief: {
      blockers: ['الإحساس بالتعب بعد الظهر', 'عدم وجود نشاط يشغلك'],
      helpers: ['اشرب كوباية مية باردة بعد العصر', 'افتكر إن النوم هيخرب نوم الليل'],
    },
  },

  // ══════════════════════════════════════════════════
  // 🚶 المشي — اختياري، الوردية الصباحية
  // ══════════════════════════════════════════════════
  {
    id: 40,
    icon: '🚶',
    title: 'مشي بين المغرب والعشاء',
    shifts: ['morning'],
    timeBlock: 'walking',
    isPrayerTask: false,
    category: 'صحة',
    color: '#9bc87a',
    isWarning: false,
    recurrence: 'يومي',
    subtasks: [],
    brief: {
      blockers: ['الإحساس بالتعب بعد يوم طويل', 'إغراء الجلوس بعد المغرب'],
      helpers: ['جهز حذاء المشي قبل المغرب', 'مسار قصير ١٥-٢٠ دقيقة يكفي'],
    },
  },

  // ══════════════════════════════════════════════════
  // 🌙 الأسبوع المسائي — بداية الدوام (٦-٧م)
  // ══════════════════════════════════════════════════
  {
    id: 50,
    icon: '📧',
    title: 'متابعة إيميلات العمل',
    shifts: ['evening'],
    timeBlock: 'work-prep',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'أيام العمل',
    subtasks: [],
    brief: {
      blockers: ['بداية الدوام مزدحمة', 'إيميلات متراكمة من النهار'],
      helpers: ['خصص ٣٠ دقيقة للإيميلات فقط', 'رتب حسب الأولوية'],
    },
  },

  // ══════════════════════════════════════════════════
  // 🌙 الأسبوع المسائي — وقت البرمجة (٧م-١٢م)
  // ══════════════════════════════════════════════════
  {
    id: 60,
    icon: '💻',
    title: 'مهام البرمجة المخططة مسبقاً',
    shifts: ['evening'],
    timeBlock: 'work-coding',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'أيام العمل',
    subtasks: [],
    brief: {
      blockers: ['عدم تحديد المهمة مسبقاً من آخر الدوام', 'الانشغال بالمكالمات'],
      helpers: [
        'المهمة يجب أن تكون محددة قبل الدوام',
        'هذا الوقت ذهبي — لا مقاطعات',
        'ضع قائمة sub-tasks واضحة',
      ],
    },
  },

  // ══════════════════════════════════════════════════
  // 🌙 الأسبوع المسائي — آخر الدوام (١٢:٣٠-٢:٣٠ص)
  // ══════════════════════════════════════════════════
  {
    id: 70,
    icon: '📋',
    title: 'تحديث ملف الريفيل وطلب النواقص',
    shifts: ['evening'],
    timeBlock: 'work-late',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'أيام العمل',
    subtasks: [
      { id: 'r1', text: 'تحديث ملف الريفيل' },
      { id: 'r2', text: 'طلب النواقص للمورد' },
    ],
    brief: {
      blockers: ['الإرهاق في آخر الدوام', 'عدم تسجيل الملاحظات أثناء الشفت'],
      helpers: ['سجّل الملاحظات فور حدوثها', 'جهز الطلب مبكراً وأرسله في نهاية الدوام'],
    },
  },
  {
    id: 71,
    icon: '📝',
    title: 'التخطيط لليوم التالي',
    shifts: ['evening'],
    timeBlock: 'work-late',
    isPrayerTask: false,
    category: 'عمل',
    color: '#6e9fcf',
    isWarning: false,
    recurrence: 'يومي',
    subtasks: [
      { id: 'p1', text: 'تحديد مهمة البرمجة لليوم التالي' },
      { id: 'p2', text: 'مراجعة قائمة العملاء للغد' },
    ],
    brief: {
      blockers: ['الإرهاق في آخر الدوام', 'عدم وضوح أولويات اليوم التالي'],
      helpers: ['٥ دقائق تخطيط توفر ساعة في اليوم التالي', 'اكتب ٣ أولويات فقط'],
    },
  },
];
