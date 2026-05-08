const STORAGE_KEY = 'mhm_error_logs';
const MAX_LOCAL_LOGS = 100;

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
  sessionId: string;
  userAgent: string;
  url: string;
}

class Logger {
  private sessionId: string;
  private logs: LogEntry[] = [];
  private batchSize = 10;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.loadFromStorage();
    this.setupBatching();
  }

  private getOrCreateSessionId(): string {
    const stored = localStorage.getItem('mhm_session_id');
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem('mhm_session_id', id);
    return id;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as LogEntry[];
        this.logs = parsed.slice(-MAX_LOCAL_LOGS);
      }
    } catch {
      this.logs = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs.slice(-MAX_LOCAL_LOGS)));
    } catch {
      // Storage full, ignore
    }
  }

  private setupBatching(): void {
    if (typeof window === 'undefined') return;

    this.flushInterval = setInterval(() => {
      if (this.logs.length > 0) {
        void this.flush();
      }
    }, 30000);
  }

  private log(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, unknown>,
    stack?: string
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack,
      sessionId: this.sessionId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    this.logs.push(entry);
    this.saveToStorage();

    if (level === 'error' || this.logs.length >= this.batchSize) {
      void this.flush();
    }

    if (typeof console !== 'undefined') {
      const consoleFn =
        level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      consoleFn(`[${level.toUpperCase()}] ${message}`, context ?? '');
    }
  }

  private async flush(): Promise<void> {
    if (this.logs.length === 0 || this.isFlushing) return;
    if (typeof window === 'undefined') return;

    this.isFlushing = true;
    const logsToSend = [...this.logs];
    this.logs = [];
    this.saveToStorage();

    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: logsToSend }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch {
      this.logs = [...logsToSend, ...this.logs].slice(0, MAX_LOCAL_LOGS);
      this.saveToStorage();
    } finally {
      this.isFlushing = false;
    }
  }

  public error(message: string, context?: Record<string, unknown>, stack?: string): void {
    this.log('error', message, context, stack);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    void this.flush();
  }
}

export const logger = new Logger();
