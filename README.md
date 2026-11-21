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

`scripts/fetch-tonight.mjs` récupère les programmes diffusés entre 20h30 et 1h30 (heure de Paris) dans les flux XMLTV gratuits de [xmltvfr.fr](https://xmltvfr.fr), puis écrit `public/data/tonight.json`.

```bash
npm run fetch:tonight
# avec affiches, notes et casting :
TMDB_API_KEY=xxx npm run fetch:tonight
```

- Types gardés : film (et téléfilm), série, doc et magazine, divertissement (jeux, humour, spectacles, talk-shows), sport. Journaux, météo, jeunesse, téléachat et programmes de moins de 20 min sont ignorés. Les épisodes de série enchaînés sont regroupés.
- TMDB complète les films (affiche, note, casting) et les séries (affiche, note).
- Clé TMDB gratuite : https://www.themoviedb.org/settings/api
- Les noms des flux Canal+ et cinéma (`xmltv_canalsat`, `xmltv_cinema`) sont à vérifier sur xmltvfr.fr. Un flux introuvable est ignoré sans bloquer les autres.
- Le workflow GitHub `.github/workflows/tonight.yml` relance le script chaque jour vers 15h (et à chaque push), commite le fichier, puis met l'app en ligne sur GitHub Pages.

### Mise en ligne (une seule fois)

1. Settings > Pages > Source : **GitHub Actions**
2. Settings > Secrets and variables > Actions : ajoute `TMDB_API_KEY`
3. Actions > « Programme du soir et mise en ligne » > Run workflow

L'app est ensuite sur `https://<compte>.github.io/ce-soir/`, avec les vraies affiches.

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
