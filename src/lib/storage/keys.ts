export const LS_KEYS = {
  SCHEMA_VERSION: 'mhm_schema_version',
  PENDING_SYNC: 'mhm_pending_sync',
  CLIENT_ID: 'mhm_client_id',
  MIGRATION_BLOCKS_V2: 'mhm_migration_blocks_v2',
  TASKS: 'mhm_tasks',
  TASKS_TIMESTAMP: 'mhm_tasks_timestamp',
  SCHEDULE: 'mhm_schedule',
  OFF_EXCEPTIONS: 'mhm_off_exceptions',
  WORK_EXCEPTIONS: 'mhm_work_exceptions',
  VACATION_DAYS: 'mhm_vacation_days',
  VACATION_BALANCE: 'mhm_vacation_balance',
  SCHEDULE_TIMESTAMP: 'mhm_schedule_timestamp',
  DATE: 'mhm_date',
  CHECKED: 'mhm_checked',
  SUB_CHECKED: 'mhm_sub_checked',
  SKIPPED: 'mhm_skipped',
  DAILY_TIMESTAMP: 'mhm_daily_timestamp',
  DAY_START_HOUR: 'mhm_day_start_hour',
  EPOCH: 'mhm_epoch',
  SNAPSHOT_QUEUE: 'mhm_snapshot_queue',
  LAST_MANUAL_SNAPSHOT: 'mhm_last_manual_snapshot_at',
  LAST_RESET_DATE: 'mhm_last_reset_date',
  SNAP_SUMMARIES: 'mhm_snap_summaries',
  // Logging
  ERROR_LOGS: 'mhm_error_logs',
  SESSION_ID: 'mhm_session_id',
  // Calendar
  CALENDAR_NOTES_LEGACY: 'mhm_calendar_notes',
  CALENDAR_NOTES_V2: 'mhm_calendar_notes_v2',
  CALENDAR_NOTES_V2_TS: 'mhm_calendar_notes_v2_ts',
  HOLIDAY_OFFSETS: 'mhm_holiday_offsets',
  ALADHAN_PREFIX: 'mhm_aladhan_',
  // Finance
  FIN_INCOME: 'mhm_fin2_income',
  FIN_CATEGORIES: 'mhm_fin2_categories',
  FIN_EXPENSES: 'mhm_fin2_expenses',
  FIN_TRANSACTIONS: 'mhm_fin2_transactions',
  FIN_GOALS: 'mhm_fin2_goals',
  FIN_SETTINGS: 'mhm_fin2_settings',
  FIN_TIMESTAMP: 'mhm_fin2_timestamp',
  FIN_CYCLE_CONFIG: 'mhm_fin_cycle_config',
  // OKR
  OKR_CYCLES: 'mhm_okr_cycles',
  OKR_OBJECTIVES: 'mhm_okr_objectives',
  OKR_KEY_RESULTS: 'mhm_okr_key_results',
  OKR_CHECK_INS: 'mhm_okr_check_ins',
  /** ISO datetime of last successful OKR sync — used as `since` for incremental check-in fetch */
  OKR_TIMESTAMP: 'mhm_okr_timestamp',
  /** YYYY-MM-DD of the Friday when the weekly OKR review prompt was last shown/dismissed */
  OKR_WEEKLY_REVIEW_SHOWN: 'mhm_okr_weekly_review_shown',
  /** YYYY-MM-DD of the last time the weekly report modal was viewed */
  WEEKLY_REPORT_LAST_SEEN: 'mhm_weekly_report_last_seen',
  /** Streak threshold percentage (50-90), default 60 */
  STREAK_THRESHOLD: 'mhm_streak_threshold',
} as const;

export const QUERY_KEYS = {
  TASKS: 'tasks',
  SCHEDULE: 'schedule',
  DAILY: 'daily', // usually ['daily', todayISO()]
} as const;
