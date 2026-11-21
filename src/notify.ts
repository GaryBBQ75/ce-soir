import type { Film } from './types';
import { showKey, type Profile } from './profile';
import { hhmm } from './utils';

/**
 * Rappels : notification système (si autorisée) + message dans l'app.
 *
 * Limite d'une app web sans serveur : les notifications partent tant que l'app est ouverte
 * ou en arrière-plan. Pour être prévenu app fermée, il faudra un petit serveur Web Push
 * (ou l'ajout à l'agenda, qui marche partout).
 */

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function askPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

let swReg: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker() {
  try {
    if (!('serviceWorker' in navigator)) return;
    swReg = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  } catch {
    /* pas de service worker (aperçu, navigateur privé…) : notifications simples */
  }
}

async function systemNotify(title: string, body: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    if (swReg) await swReg.showNotification(title, { body, tag, icon: undefined });
    else new Notification(title, { body, tag });
  } catch {
    /* refusé par le navigateur : le message dans l'app suffit */
  }
}

const SENT_KEY = 'ce-soir.notified.v1';
function loadSent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function saveSent(s: Record<string, number>) {
  try {
    // On oublie les rappels de plus de 2 jours
    const cutoff = Date.now() - 2 * 86_400_000;
    localStorage.setItem(SENT_KEY, JSON.stringify(Object.fromEntries(Object.entries(s).filter(([, t]) => t > cutoff))));
  } catch {
    /* ignore */
  }
}

/** Programmes pour lesquels l'utilisateur veut être prévenu. */
export function watchedFilms(p: Profile, films: Film[]) {
  return films.filter((f) => p.reminders[f.id] || p.followed[showKey(f.title)]?.notify);
}

export interface Alert {
  id: string;
  film: Film;
  text: string;
}

/**
 * À appeler régulièrement (toutes les 30 s) : envoie les rappels dus.
 * Renvoie les alertes à afficher dans l'app.
 */
export function checkReminders(p: Profile, films: Film[], now: number): Alert[] {
  const sent = loadSent();
  const alerts: Alert[] = [];
  for (const f of watchedFilms(p, films)) {
    const start = Date.parse(f.start);
    const due = start - p.notifyBefore * 60_000;
    if (now < due || now > start + 5 * 60_000 || sent[f.id]) continue;
    const min = Math.round((start - now) / 60_000);
    const text = min > 0 ? `${f.title} commence dans ${min} min sur ${f.channel}` : `${f.title} commence sur ${f.channel}`;
    sent[f.id] = now;
    alerts.push({ id: f.id, film: f, text });
    if (p.notifyEnabled) void systemNotify(f.title, `${hhmm(f.start)} sur ${f.channel}`, f.id);
  }
  if (alerts.length) saveSent(sent);
  return alerts;
}

// ---------- Ajout à l'agenda (.ics) : marche partout, même app fermée ----------

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function icsFor(f: Film, before: number) {
  const stop = f.stop ?? new Date(Date.parse(f.start) + (f.durationMin ?? 60) * 60_000).toISOString();
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ce soir//FR',
    'BEGIN:VEVENT',
    `UID:${f.id}@ce-soir`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(f.start)}`,
    `DTEND:${icsDate(stop)}`,
    `SUMMARY:${icsText(`${f.title} (${f.channel})`)}`,
    f.synopsis ? `DESCRIPTION:${icsText(f.synopsis)}` : '',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(f.title)}`,
    `TRIGGER:-PT${before}M`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export function downloadIcs(f: Film, before: number) {
  try {
    const blob = new Blob([icsFor(f, before)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${f.title.replace(/[^\w\- ]+/g, '').slice(0, 40) || 'programme'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return true;
  } catch {
    return false;
  }
}
