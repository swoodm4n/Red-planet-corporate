// Centralised environment access. Never hardcode secrets/credentials.

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get authSecret() {
    const s = required("AUTH_SECRET");
    if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 bytes");
    return s;
  },
  get sessionTtlHours() {
    return Number(optional("SESSION_TTL_HOURS", "168"));
  },
  get adminEmail() {
    return required("ADMIN_EMAIL");
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
  get defaultTurnLengthHours() {
    return Number(optional("DEFAULT_TURN_LENGTH_HOURS", "96"));
  },
  get schedulerPollSeconds() {
    return Number(optional("SCHEDULER_POLL_SECONDS", "60"));
  },
  get appBaseUrl() {
    return optional("APP_BASE_URL", "http://localhost:3000");
  },
};
