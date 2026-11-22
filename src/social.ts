import { pb } from './account';

/** Identifiant anonyme de ce téléphone (pour les votes à deux et les J'aime comptés une seule fois). */
export function deviceId(): string {
  const K = 'ce-soir.device.v1';
  try {
    let id = localStorage.getItem(K);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(K, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

// ---------- Populaire ce soir ----------

const LIKED = 'ce-soir.liked.v1';
function likedToday(day: string): Record<string, true> {
  try {
    const all = JSON.parse(localStorage.getItem(LIKED) ?? '{}');
    return all.day === day ? all.keys : {};
  } catch {
    return {};
  }
}

/** Compte un J'aime anonyme (une fois par programme et par téléphone). */
export async function shareLike(key: string, day: string) {
  const keys = likedToday(day);
  if (keys[key]) return;
  try {
    await pb.collection('likes').create({ key, day });
    localStorage.setItem(LIKED, JSON.stringify({ day, keys: { ...keys, [key]: true } }));
  } catch {
    /* serveur indisponible : pas grave */
  }
}

/** Nombre de J'aime par programme pour la soirée. */
export async function popularTonight(day: string): Promise<Record<string, number>> {
  try {
    const list = await pb.collection('popular').getList(1, 50, { filter: pb.filter('day = {:day}', { day }), sort: '-n' });
    return Object.fromEntries(list.items.map((r) => [r.key as string, r.n as number]));
  } catch {
    return {};
  }
}

// ---------- Ce soir à deux ----------

export interface Room {
  id: string;
  day: string;
  films: string[];
}

export async function createRoom(day: string, films: string[]): Promise<Room> {
  const r = await pb.collection('duo_rooms').create({ day, films, owner: deviceId() });
  return { id: r.id, day: r.day, films: r.films };
}

export async function getRoom(id: string): Promise<Room> {
  const r = await pb.collection('duo_rooms').getOne(id);
  return { id: r.id, day: r.day, films: r.films };
}

export interface Vote {
  voter: string;
  film: string;
  vote: number;
}

export async function listVotes(room: string): Promise<Vote[]> {
  const list = await pb.collection('duo_votes').getFullList({ filter: pb.filter('room = {:room}', { room }) });
  return list.map((v) => ({ voter: v.voter, film: v.film, vote: v.vote }));
}

export async function castVote(room: string, film: string, vote: number) {
  await pb.collection('duo_votes').create({ room, film, vote, voter: deviceId() });
}

/** Suit les votes de l'autre en direct. Renvoie la fonction pour arrêter. */
export async function watchVotes(room: string, onVote: (v: Vote) => void) {
  return pb.collection('duo_votes').subscribe(
    '*',
    (e) => {
      if (e.action === 'create' && e.record.room === room) onVote({ voter: e.record.voter, film: e.record.film, vote: e.record.vote });
    },
    { filter: pb.filter('room = {:room}', { room }) },
  );
}
