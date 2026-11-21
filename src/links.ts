/**
 * Liens vers le direct de chaque chaîne (sites officiels des groupes).
 * Clé : nom de chaîne simplifié. À compléter au fil de l'eau.
 */
const LIVE: [RegExp, string, string][] = [
  [/^tf1$/, 'https://www.tf1.fr/tf1/direct', 'TF1+'],
  [/^tmc$/, 'https://www.tf1.fr/tmc/direct', 'TF1+'],
  [/^tfx$/, 'https://www.tf1.fr/tfx/direct', 'TF1+'],
  [/^tf1 series ?films$/, 'https://www.tf1.fr/tf1-series-films/direct', 'TF1+'],
  [/^lci$/, 'https://www.tf1.fr/lci/direct', 'TF1+'],
  [/^france ?2$/, 'https://www.france.tv/france-2/direct.html', 'france.tv'],
  [/^france ?3$/, 'https://www.france.tv/france-3/direct.html', 'france.tv'],
  [/^france ?4$/, 'https://www.france.tv/france-4/direct.html', 'france.tv'],
  [/^france ?5$/, 'https://www.france.tv/france-5/direct.html', 'france.tv'],
  [/^franceinfo/, 'https://www.france.tv/franceinfo/direct.html', 'france.tv'],
  [/^m6$/, 'https://www.m6.fr/m6/direct', 'M6+'],
  [/^w9$/, 'https://www.m6.fr/w9/direct', 'M6+'],
  [/^6ter$/, 'https://www.m6.fr/6ter/direct', 'M6+'],
  [/^gulli$/, 'https://www.m6.fr/gulli/direct', 'M6+'],
  [/^arte$/, 'https://www.arte.tv/fr/direct/', 'arte.tv'],
  [/^rmc (story|decouverte|life)$|^bfm ?tv$/, 'https://www.rmcbfmplay.com/', 'RMC BFM Play'],
  [/^canal|^cine ?\+|^planete|^polar|^comedie ?\+|^seasons|^infosport/, 'https://www.canalplus.com/live/', 'myCANAL'],
];

const simplify = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+ ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function liveLink(channelName: string): { url: string; label: string } | null {
  const n = simplify(channelName);
  const hit = LIVE.find(([re]) => re.test(n));
  return hit ? { url: hit[1], label: hit[2] } : null;
}
