function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, ...rest: unknown[]): void {
    console.log(`[${ts()}] INFO  ${message}`, ...rest);
  },
  warn(message: string, ...rest: unknown[]): void {
    console.warn(`[${ts()}] WARN  ${message}`, ...rest);
  },
  error(message: string, ...rest: unknown[]): void {
    console.error(`[${ts()}] ERROR ${message}`, ...rest);
  },
};
