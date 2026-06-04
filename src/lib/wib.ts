const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function wibDate(d: Date): string {
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function wibToday(): string {
  return wibDate(new Date());
}
