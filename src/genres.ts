// Ramène les genres XMLTV / TMDB (français ou anglais) à une liste courte et stable.
const MAP: [RegExp, string][] = [
  [/com[ée]die|comedy/i, 'Comédie'],
  [/action/i, 'Action'],
  [/aventure|adventure/i, 'Aventure'],
  [/anim/i, 'Animation'],
  [/famil|jeunesse|enfant|kids/i, 'Famille'],
  [/horreur|horror|[ée]pouvante/i, 'Horreur'],
  [/thriller|suspense|myst[eè]re|mystery/i, 'Thriller'],
  [/policier|crime|polar|gangster/i, 'Policier'],
  [/science|sci-?fi/i, 'Science-fiction'],
  [/fantas/i, 'Fantastique'],
  [/romance|romanti|sentiment/i, 'Romance'],
  [/musical|musique|music/i, 'Musical'],
  [/western/i, 'Western'],
  [/guerre|war/i, 'Guerre'],
  [/histo|biopic|biograph/i, 'Histoire'],
  [/documentaire|documentary/i, 'Documentaire'],
  [/drame|drama|dramatique/i, 'Drame'],
];

export function normalizeGenre(raw: string): string | null {
  for (const [re, label] of MAP) if (re.test(raw)) return label;
  return null;
}

export function normalizeGenres(raw: string[]): string[] {
  const out = new Set<string>();
  for (const r of raw) {
    // "Film : comédie dramatique" -> on regarde chaque morceau
    for (const part of r.split(/[:,/]/)) {
      for (const [re, label] of MAP) if (re.test(part)) out.add(label);
    }
  }
  return [...out];
}
