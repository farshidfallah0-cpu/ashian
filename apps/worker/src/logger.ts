import { pino } from 'pino';

export function createLogger(level: string, pretty: boolean) {
  return pino({
    level,
    base: { service: 'worker' },
    transport: pretty
      ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } }
      : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
