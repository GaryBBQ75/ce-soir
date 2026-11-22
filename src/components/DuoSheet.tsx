import { useEffect, useMemo, useState } from 'react';
import type { Channel, Film } from '../types';
import { Sheet } from './Sheet';
import { Poster } from './Poster';
import { ChannelLogo } from './ChannelLogo';
import { durationLabel, hhmm } from '../utils';
import { castVote, createRoom, deviceId, getRoom, listVotes, watchVotes, type Room, type Vote } from '../social';

interface Props {
  roomId: string | null;
  day: string;
  /** Les suggestions de celui qui lance le duo */
  suggestions: Film[];
  films: Film[];
  channels: Channel[];
  onOpen: (f: Film) => void;
  onClose: () => void;
}

/** « Ce soir à deux » : chacun dit oui ou non, l'app montre ce qui plaît aux deux. */
export function DuoSheet({ roomId, day, suggestions, films, channels, onOpen, onClose }: Props) {
  const me = deviceId();
  const [room, setRoom] = useState<Room | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const byId = useMemo(() => new Map(films.map((f) => [f.id, f])), [films]);
  const chan = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  // Rejoindre (lien reçu) ou créer le duo
  useEffect(() => {
    let stop: (() => void) | undefined;
    (async () => {
      try {
        const r = roomId ? await getRoom(roomId) : await createRoom(day, suggestions.slice(0, 15).map((f) => f.id));
        setRoom(r);
        setVotes(await listVotes(r.id));
        stop = await watchVotes(r.id, (v) => setVotes((vs) => (vs.some((x) => x.voter === v.voter && x.film === v.film) ? vs : [...vs, v])));
      } catch {
        setError("Impossible de lancer le duo pour l'instant. Réessaie dans un moment.");
      }
    })();
    return () => stop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const list = (room?.films ?? []).map((id) => byId.get(id)).filter((f): f is Film => !!f);
  const mine = new Map(votes.filter((v) => v.voter === me).map((v) => [v.film, v.vote]));
  const others = votes.filter((v) => v.voter !== me);
  const partnerHere = others.length > 0;
  const current = list.find((f) => !mine.has(f.id));
  const matches = list.filter((f) => mine.get(f.id) === 1 && others.some((v) => v.film === f.id && v.vote === 1));
  const link = room ? `${location.origin}${import.meta.env.BASE_URL}?duo=${room.id}` : '';

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Y'a quoi ce soir ?", text: 'On choisit ensemble ce soir ?', url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch {
      /* partage annulé */
    }
  };

  const vote = async (f: Film, v: number) => {
    setVotes((vs) => [...vs, { voter: me, film: f.id, vote: v }]);
    try {
      await castVote(room!.id, f.id, v);
    } catch {
      /* hors ligne : le vote reste local */
    }
  };

  return (
    <Sheet label="Ce soir à deux" onClose={onClose}>
      <h2 className="sheet__heading">Ce soir à deux</h2>
      {error && <p className="muted">{error}</p>}
      {!room && !error && <p className="muted">Préparation…</p>}

      {room && (
        <div className="duo">
          {!roomId && (
            <div className="duo__invite">
              <p className="small">
                {partnerHere ? <strong>L'autre personne est là.</strong> : <strong>Envoie le lien à la personne avec qui tu regardes.</strong>}
                <span className="muted"> Chacun dit oui ou non, et l'app vous montre ce qui vous plaît à tous les deux.</span>
              </p>
              <button className="btn btn--ghost btn--wide" onClick={share}>{copied ? 'Lien copié' : 'Envoyer le lien'}</button>
            </div>
          )}

          {matches.length > 0 && (
            <section className="duo__matches">
              <h3 className="eyebrow">Vous êtes d'accord · {matches.length}</h3>
              {matches.map((f) => (
                <button key={f.id} className="airing" onClick={() => onOpen(f)}>
                  <ChannelLogo channel={chan.get(f.channelId)} fallback={f.channel} size="xs" />
                  <span className="airing__when"><strong>{f.title}</strong></span>
                  <span className="muted airing__ch">{hhmm(f.start)}</span>
                </button>
              ))}
            </section>
          )}

          {current ? (
            <article className="duo__card">
              <span className="muted small">{mine.size + 1} / {list.length}</span>
              <div className="duo__media">
                <Poster title={current.title} poster={current.backdrop ?? current.poster} big />
              </div>
              <h3 className="duo__title">{current.title}</h3>
              <p className="muted small">
                {chan.get(current.channelId)?.name ?? current.channel} · {hhmm(current.start)} · {durationLabel(current)}
              </p>
              {current.synopsis && <p className="small duo__syn">{current.synopsis}</p>}
              <div className="duo__actions">
                <button className="btn btn--ghost" onClick={() => vote(current, -1)}>Non</button>
                <button className="btn btn--primary" onClick={() => vote(current, 1)}>Oui</button>
              </div>
            </article>
          ) : (
            <p className="muted center">
              {matches.length > 0
                ? 'Tu as tout vu. Bonne soirée !'
                : partnerHere
                  ? "Tu as tout vu. Pas encore d'accord : attends que l'autre finisse."
                  : "Tu as tout vu. On attend l'autre personne."}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
