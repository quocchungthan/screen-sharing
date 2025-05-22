// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logCBT(message: string, additions?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[CBT ${timestamp}] ${message}`, additions);
}
