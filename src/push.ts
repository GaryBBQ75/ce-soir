import { pb } from './account';
import type { Profile } from './profile';

/** Clé publique VAPID du service de notifications (la clé privée reste sur le serveur). */
const VAPID_PUBLIC = (import.meta.env.VITE_VAPID_PUBLIC as string | undefined) ??
  'BIMHP4ir6EoafDNnVIdqFEw2Fyh58quMvXDe1-zOKjNeN6ckqx-bnTVuE5ztLk2QT7YjMdqj6tpEDtX6ZKxQT6k';

const KEY = 'ce-soir.push.v1';
interface Stored {
  id: string;
  secret: string;
  endpoint: string;
}

const load = (): Stored | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
};
const save = (s: Stored | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Ce que le serveur doit savoir pour prévenir l'utilisateur, et rien de plus. */
function payload(p: Profile) {
  return {
    follows: p.followed,
    reminders: p.reminders,
    notify_before: p.notifyBefore,
    user: pb.authStore.isValid ? pb.authStore.record?.id : undefined,
  };
}

/** Abonne ce téléphone aux notifications serveur (ou met à jour ce qu'il suit). */
export async function syncPush(p: Profile) {
  if (!pushSupported() || Notification.permission !== 'granted' || !p.notifyEnabled) return;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) });
  }
  const json = sub.toJSON();
  const stored = load();
  const body = payload(p);
  if (stored && stored.endpoint === json.endpoint) {
    try {
      await pb.collection('push_subs').update(stored.id, body, { headers: { 'x-sub-secret': stored.secret } });
      return;
    } catch {
      /* enregistrement disparu : on le recrée */
    }
  }
  const secret = crypto.randomUUID();
  const rec = await pb.collection('push_subs').create({ ...body, endpoint: json.endpoint, keys: json.keys, secret });
  save({ id: rec.id, secret, endpoint: json.endpoint! });
}

/** Désabonne ce téléphone. */
export async function stopPush() {
  const stored = load();
  if (stored) await pb.collection('push_subs').delete(stored.id, { headers: { 'x-sub-secret': stored.secret } }).catch(() => {});
  save(null);
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  await sub?.unsubscribe();
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function schedulePushSync(p: Profile) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    (p.notifyEnabled ? syncPush(p) : stopPush()).catch(() => {});
  }, 1500);
}
