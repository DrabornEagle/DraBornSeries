export const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export function calendarDays(year: number, month: number): (number | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  return [...Array(offset).fill(null), ...Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1)];
}
export function localPublishTime(year: number, month: number, day: number, hour: string, minute: string): string {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || +hour > 23 || +minute > 59) throw Error("Saati 00:00 ile 23:59 arasında seç.");
  const value = new Date(year, month, day, +hour, +minute);
  if (value.getFullYear() !== year || value.getMonth() !== month || value.getDate() !== day) throw Error("Geçerli bir tarih seç.");
  return value.toISOString();
}
export function publishTimeLabel(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "Tarih ve saat seç";
  return new Date(value).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
