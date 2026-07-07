import { format, isToday, isYesterday, startOfDay, parseISO } from 'date-fns';

export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return '今天';
  if (isYesterday(date)) return '昨天';
  return format(date, 'yyyy-MM-dd');
}

export function formatDateFull(dateStr: string): string {
  return format(parseISO(dateStr), 'yyyy年MM月dd日');
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'yyyy-MM-dd HH:mm');
}

export function getTodayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getNowStr(): string {
  return new Date().toISOString();
}

export function isDateInRange(dateStr: string, days: number): boolean {
  const date = parseISO(dateStr);
  const now = new Date();
  const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return date >= startOfDay(daysAgo);
}

export function getDaysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = parseISO(dateStr1);
  const d2 = parseISO(dateStr2);
  return Math.abs(d1.getTime() - d2.getTime()) / (24 * 60 * 60 * 1000);
}
