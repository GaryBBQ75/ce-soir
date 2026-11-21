# Ce soir

L'app qui te dit quoi regarder ce soir à la télé, sans chercher : films, séries, docs, divertissement, sport.
Elle classe tous les programmes de la soirée selon tes goûts, et apprend à chaque réaction.

## Lancer

```bash
npm install
npm run dev
```

Par défaut, l'app lit `public/data/tonight.json`, qui contient une **soirée d'exemple**.

## Le vrai programme

`scripts/fetch-tonight.mjs` récupère les programmes diffusés entre 20h30 et 1h30 (heure de Paris) dans les flux XMLTV gratuits de [xmltvfr.fr](https://xmltvfr.fr) (flux TNT + flux complet), télécharge les visuels et écrit `tonight.json`.

```bash
npm run fetch:tonight                 # écrit dans public/
OUT_DIR=dist npm run fetch:tonight    # écrit dans dist/ après un build
TMDB_API_KEY=xxx npm run fetch:tonight  # + notes et casting TMDB (optionnel)
```

- **Bouquets** : TNT gratuite, Canal+ (et Planète+, Polar+, Comédie+…), Ciné+ OCS, Sport (beIN, RMC Sport, Eurosport, DAZN…), Chaînes des box. Sont écartées : chaînes étrangères, locales, outre-mer, adultes, décalées (+1), doublons 4K et multiplex sport.
- **Types gardés** : film (et téléfilm), série, doc et magazine, divertissement, sport. Journaux, météo, jeunesse, téléachat et programmes de moins de 20 min sont ignorés. Les épisodes de série enchaînés sont regroupés.
- **Visuels** : téléchargés depuis le flux, redimensionnés en WebP 400 px (sharp) et servis par l'app.
- **TMDB** (optionnel) : notes et casting des films, affiches des séries. Clé gratuite sur https://www.themoviedb.org/settings/api

### Mise à jour automatique et mise en ligne

Le workflow `.github/workflows/tonight.yml` tourne chaque jour vers 15h et 19h, et à chaque push :
1. build de l'app ;
2. récupération du programme et des visuels dans `dist/` ;
3. copie des données sur la branche `data` (un seul commit, écrasé chaque jour) ;
4. mise en ligne sur GitHub Pages.

À faire une fois : Settings > Pages > Source : **GitHub Actions** (et le secret `TMDB_API_KEY` si tu veux TMDB).

## Comment l'app apprend tes goûts

Tout est dans `src/profile.ts`, stocké en local (pas de compte pour l'instant).

1. **Pas de questionnaire** : on arrive direct sur le programme, avec la TNT par défaut. Le bouton réglages permet d'activer des bouquets (Canal+, Ciné+) et d'ajouter ou retirer des chaînes une par une.
2. **Traits** : chaque programme est décrit par son type (film, série, doc…), ses genres, réalisateurs, 3 premiers acteurs et sa décennie.
3. **Signaux** : chaque réaction modifie le poids des traits du film.

   | Réaction | Effet |
   | --- | --- |
   | J'aime | +1 |
   | Déjà vu | +0,8 |
   | Me rappeler | +0,6 |
   | Ouvrir la fiche | +0,25 |
   | Pas pour moi | -1 (et le film est masqué) |

   Les genres comptent plus que le réalisateur, qui compte plus que les acteurs et la décennie.
4. **Score** : somme des poids des traits du film, plus un petit bonus pour les films bien notés sur TMDB.
5. **Variété** : jamais plus de 3 programmes du même type dans le top 5.
6. **Découverte** : après 3 réactions, la 4e place du top 5 va à un film que l'algo connaît mal, pour éviter la bulle.

Les réglages montrent aussi ce que l'app a compris de tes goûts.

## Structure

```
scripts/fetch-tonight.mjs   récupération XMLTV + TMDB
public/data/tonight.json    films du soir (exemple ou réel)
src/profile.ts              profil, signaux, score, classement
src/genres.ts               normalisation des genres
src/App.tsx                 écran principal
src/components/             fiche film, réglages des chaînes, affiche
```

## Prochaines étapes

- Vraies notifications pour « Me rappeler » (PWA + Web Push)
- Ajouter les plateformes de streaming
- Compte optionnel pour synchroniser le profil entre appareils
