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

`scripts/fetch-tonight.mjs` récupère tous les programmes de la journée, de 6h à 2h (heure de Paris ; entre minuit et 4h on reste sur la soirée de la veille), dans les flux XMLTV gratuits de [xmltvfr.fr](https://xmltvfr.fr) (flux TNT + flux complet), télécharge les visuels et écrit `tonight.json`.

```bash
npm run fetch:tonight                 # écrit dans public/
OUT_DIR=dist npm run fetch:tonight    # écrit dans dist/ après un build
TMDB_API_KEY=xxx npm run fetch:tonight  # + notes et casting TMDB (optionnel)
```

- **Bouquets et thèmes** : TNT gratuite, Canal+, puis les chaînes des box rangées par thème : Cinéma, Sport, Découverte, Séries & divertissement, Jeunesse, Musique, Info, Maison & loisirs, Autres. Le classement se fait par nom de chaîne dans `bouquetOf()`. Sont écartées : chaînes étrangères, locales, outre-mer, adultes, décalées (+1), doublons 4K et multiplex sport.
- **Catégories** : Films (cinéma et téléfilms), Séries, Docs & magazines, Divertissement, Spectacles & musique, Sport, Jeunesse, Info & débats (pas suggérée par défaut), et « autre » (météo, téléachat…) visible seulement dans la grille. Chaque programme a aussi des **sous-genres** (Comédie, Policier… / Foot, Rugby… / Nature, Histoire…) qui servent de 2e filtre et nourrissent l'algo. Les programmes enchaînés avec le même titre sont regroupés.
- **Logos des chaînes** : téléchargés et redimensionnés comme les visuels.
- **Visuels** : téléchargés depuis le flux, redimensionnés en WebP 400 px (sharp) et servis par l'app.
- **Fiches détaillées** (flux XMLTV) : signalétique -10/-12/-16/-18, notes presse, pays, saison/épisode, rôles, présentateurs, scénaristes, inédit/rediffusion, HD, sous-titres.
- **TMDB** (optionnel, secret `TMDB_API_KEY`) : pour les films et séries du soir, photos des acteurs, grande image, réalisation, scénario, musique, titre original, accroche, bande-annonce, note TMDB. Clé gratuite sur https://www.themoviedb.org/settings/api
- **OMDb** (optionnel, secret `OMDB_API_KEY`) : notes IMDb, Rotten Tomatoes et Metacritic. Clé gratuite sur https://www.omdbapi.com/apikey.aspx

### Mise à jour automatique et mise en ligne

Le workflow `.github/workflows/tonight.yml` tourne chaque jour vers 6h, 12h, 15h et 19h, et à chaque push :
1. build de l'app ;
2. récupération du programme et des visuels dans `dist/` ;
3. copie des données sur la branche `data` (un seul commit, écrasé chaque jour) ;
4. mise en ligne sur GitHub Pages.

À faire une fois : Settings > Pages > Source : **GitHub Actions** (et le secret `TMDB_API_KEY` si tu veux TMDB).

## L'app

- **Moment** : Maintenant (en cours ou qui commence dans 30 min), 1re partie (vers 21h10), 2e partie (vers 22h50).
- **Pour toi** : les programmes du moment classés selon tes goûts, avec une ligne de temps (avancement, temps restant ou « dans 12 min »).
- **Chaînes** : toutes tes chaînes d'un coup, en **liste** (ce qui passe, progression, ce qui suit) ou en **grille horaire** (test). Recherche par titre, acteur ou équipe ; filtre par type ; tri « Mon ordre » ou « Pour toi » ; favoris et réorganisation des chaînes.
- **Deux niveaux de chaînes** : les chaînes reçues (bouquets, ajouts, exclusions dans les réglages), puis les **favorites** (étoile). En haut de l'app, « Toutes mes chaînes » ou « Mes favorites » change ce que montrent Pour toi et Chaînes.
- **Émissions suivies** : « Suivre cette émission » sur une fiche. Elle remonte dans les suggestions, et un bandeau rouge s'affiche en haut de l'app dès qu'elle est en cours (ou commence dans 15 min).
- **Rappels** : « Me rappeler » sur un programme, ou « Me prévenir à chaque diffusion » sur une émission suivie. Message dans l'app + notification système si autorisée (réglage : 5, 10, 15 ou 30 min avant). « Ajouter à l'agenda » télécharge un fichier .ics avec alarme.
- **Regarder en direct** : lien vers le site de la chaîne (TF1+, france.tv, M6+, arte.tv, myCANAL…), dans `src/links.ts`.

> Limite actuelle : sans serveur, les notifications partent seulement quand l'app est ouverte ou en arrière-plan. Pour être prévenu app fermée, il faudra un petit serveur Web Push (par exemple sur Coolify). L'ajout à l'agenda marche dans tous les cas.

- **Fiche programme** : grand visuel, logo de la chaîne (touche-le pour voir sa journée), signalétique, notes, casting avec photos, réalisation, détails, bande-annonce, regarder en direct, rappel, agenda.
- **Journée d'une chaîne** : touche un logo (liste, grille ou fiche) pour voir tout son programme du jour.
- **Installable** : « Ajouter à l'écran d'accueil » depuis le navigateur du téléphone. Le bouton retour ferme les fiches.

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

- Serveur Web Push pour les notifications app fermée
- Ajouter les plateformes de streaming
- Compte optionnel pour synchroniser le profil entre appareils
