export const ALFRED_WA = "628112634321";

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
