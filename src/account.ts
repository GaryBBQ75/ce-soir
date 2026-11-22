import PocketBase from 'pocketbase';
import type { Profile } from './profile';

/** Serveur de comptes (PocketBase sur Coolify). */
export const PB_URL = (import.meta.env.VITE_PB_URL as string | undefined) ?? 'https://cesoir-api.57.129.170.196.sslip.io';
export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

export type Provider = 'google' | 'apple' | 'facebook';

export interface Account {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export function currentAccount(): Account | null {
  const r = pb.authStore.isValid ? pb.authStore.record : null;
  if (!r) return null;
  const avatar = r.avatar ? pb.files.getURL(r, r.avatar, { thumb: '100x100' }) : undefined;
  return { id: r.id, name: (r.name as string) || (r.email as string)?.split('@')[0] || 'Moi', email: r.email as string, avatar };
}

/** Connexion via Google (ou autre fournisseur activé dans PocketBase). */
export async function signIn(provider: Provider) {
  await pb.collection('users').authWithOAuth2({ provider });
  return currentAccount();
}

export function signOut() {
  pb.authStore.clear();
}

/** Fusion : on garde tout ce qui a été choisi d'un côté ou de l'autre (favorites, suivis, masqués…),
 * et les poids de goût du profil qui a le plus de réactions. */
export function mergeProfiles(local: Profile, remote: Profile): Profile {
  const base = remote.signals >= local.signals ? remote : local;
  return {
    ...base,
    favorites: { ...local.favorites, ...remote.favorites },
    followed: { ...local.followed, ...remote.followed },
    hidden: { ...local.hidden, ...remote.hidden },
    reminders: { ...local.reminders, ...remote.reminders },
  };
}

/** Récupère le profil enregistré sur le compte et le fusionne avec celui du téléphone. */
export async function pullProfile(local: Profile): Promise<Profile> {
  const acc = currentAccount();
  if (!acc) return local;
  const rec = await pb.collection('users').getOne(acc.id);
  const remote = rec.profile as Profile | null;
  if (!remote || remote.version !== 1) {
    await pushProfile(local);
    return local;
  }
  const merged = mergeProfiles(local, remote);
  await pushProfile(merged);
  return merged;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export async function pushProfile(p: Profile) {
  const acc = currentAccount();
  if (!acc) return;
  await pb.collection('users').update(acc.id, { profile: p });
}

/** Enregistre sur le compte, au plus une fois toutes les 2 secondes. */
export function schedulePush(p: Profile) {
  if (!currentAccount()) return;
  clearTimeout(timer);
  timer = setTimeout(() => pushProfile(p).catch(() => {}), 2000);
}

/** Fournisseurs de connexion réellement activés sur le serveur (vide tant que rien n'est configuré). */
export async function availableProviders(): Promise<Provider[]> {
  try {
    const m = await pb.collection('users').listAuthMethods();
    return (m.oauth2?.providers ?? []).map((p) => p.name as Provider);
  } catch {
    return [];
  }
}
