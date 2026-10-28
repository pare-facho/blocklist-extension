# Pare-Facho

*[English version](README.en.md)*

Extension de navigateur (Chrome et Firefox) qui **masque** et **bloque lentement** les
comptes figurant dans des listes auxquelles vous choisissez de vous abonner. Première
cible : X. Threads et Instagram sont prévus.

Le projet est né pour utiliser la liste du site
[On bloque l'extrême droite](https://onbloquelextremedroite.fun/) : elle est **abonnée
d'office** à l'installation (mise à jour toutes les heures depuis ce dépôt). Vous pouvez la
retirer, ajouter d'autres listes, et retirer ou ajouter des comptes vous-même.

> **Bêta.** Le code est public et testé automatiquement, mais l'extension n'est pas encore
> publiée sur les boutiques. Installez-la à la main (voir plus bas) et utilisez de
> préférence un compte secondaire.

## Ce que fait l'extension

1. **Masquer tout de suite.** Sur x.com, les publications des comptes listés disparaissent
   de votre écran dès qu'elles s'affichent : fil, réponses, recherche. Cela ne touche à rien
   sur X, seulement à votre affichage.
2. **Bloquer lentement, en arrière-plan (activé par défaut, désactivable).** Tant qu'il est
   activé, l'extension bloque les comptes listés un par un, à un rythme lent
   (par défaut : au plus 15 par heure, 120 par jour, avec un délai aléatoire de 1 à 4
   minutes entre deux). Elle envoie exactement la même requête que le site X quand vous
   cliquez vous-même sur « Bloquer », avec votre propre session. Elle n'ouvre aucune page,
   ne clique nulle part, et ne fonctionne que si un onglet x.com connecté est ouvert.
   Le blocage réel s'applique ensuite partout, y compris dans l'application mobile.
3. **Un bouton ⛔ sur chaque publication.** Un clic : la publication est masquée, le compte
   est ajouté à *ma liste* et mis dans la file de blocage. Cinq secondes pour annuler.
4. **Statut et historique.** La page de réglages montre le nombre de comptes listés,
   bloqués, restants, le prochain blocage prévu, l'historique des derniers blocages et la
   liste complète, avec recherche. Chaque compte peut être **gardé** (jamais masqué ni
   bloqué) ou, s'il vient de votre liste, **retiré**.

Toutes les données restent dans votre navigateur. Voir [PRIVACY.md](PRIVACY.md).

## Installation (bêta)

Téléchargez le fichier zip de la
[dernière version](https://github.com/pare-facho/blocklist-extension/releases).

- **Chrome / Edge / Brave** : décompressez le zip. Ouvrez `chrome://extensions`, activez le
  « Mode développeur », cliquez « Charger l'extension non empaquetée » et choisissez le
  dossier décompressé.
- **Firefox** : ouvrez `about:debugging#/runtime/this-firefox`, cliquez « Charger un module
  temporaire » et choisissez le zip. (Un module temporaire disparaît à la fermeture de
  Firefox ; la publication sur addons.mozilla.org réglera ce point.)

Puis ouvrez les réglages de l'extension et ajoutez une liste, par exemple :

```
https://pare-facho.github.io/blocklist-extension/blocklist.json
```

Cette liste est générée automatiquement toutes les heures à partir du site
*On bloque l'extrême droite* (voir [Le flux](#le-flux)).

## Risques, dit clairement

- Les actions automatiques sont contraires aux conditions d'utilisation de X et des autres
  réseaux. Le rythme lent fait ressembler l'extension à une personne ; ce n'est pas une
  garantie. **Utilisez un compte secondaire si vous le pouvez.**
- Le masquage dépend de la structure des pages de X ; le blocage dépend de ses adresses
  internes. Quand X change, l'extension peut cesser de fonctionner jusqu'à une mise à jour.
- Depuis fin 2024, une personne que vous bloquez sur X peut toujours voir vos publications
  publiques. Elle ne peut plus y répondre, les aimer, ni vous écrire ; et vous ne la voyez
  plus.

## Pour les auteurs de listes : le format

Une liste est un fichier JSON servi en HTTPS, à une adresse fixe, avec l'en-tête
`Access-Control-Allow-Origin: *`.

```json
{
  "format": "blocklist/1",
  "name": "Nom de la liste",
  "description": "À quoi elle sert",
  "homepage": "https://exemple.org/",
  "updated": "2026-10-27T10:00:00Z",
  "entries": [
    { "site": "x", "id": "12345678", "handle": "exemple", "name": "Nom affiché", "reason": "texte court" },
    { "site": "instagram", "handle": "exemple" }
  ]
}
```

- `id` est l'identifiant numérique permanent du compte : donnez-le quand vous l'avez, les
  pseudos changent, l'identifiant jamais.
- `site` : `x`, `threads` ou `instagram`. D'autres valeurs sont acceptées et ignorées.
- `updated` doit changer à chaque modification. Retirer une entrée retire le masquage ;
  un blocage déjà fait n'est pas annulé.
- Taille maximale : 5 Mo.

Nommer des personnes dans une liste publique, en particulier pour leurs opinions
politiques, relève des données sensibles au sens du RGPD. C'est la responsabilité de
l'auteur de la liste, pas de l'extension.

## Le flux

`tools/feed/` lit les fichiers publics du site *On bloque l'extrême droite*, retrouve
l'identifiant numérique de chaque compte X (sans compte ni clé API, via la redirection
publique `x.com/intent/user`), et écrit `feed/blocklist.json`. Un
[workflow GitHub Actions](.github/workflows/feed.yml) le lance toutes les heures et publie
le résultat sur GitHub Pages. L'historique git montre chaque ajout ou retrait.

```
node tools/feed/run.ts   # exécute une passe
```

Les identifiants déjà trouvés sont gardés dans `tools/feed/cache/x-ids.json`.
`tools/feed/corrections.json` corrige les pseudos périmés sur le site source.

## Développement

Node 22 ou plus récent.

```
npm install            # installe WXT et TypeScript
npm test               # tests unitaires (flux, format, rythme, traductions)
npm run check          # vérification des types
npm run build          # build Chrome dans .output/chrome-mv3
npm run build:firefox  # build Firefox dans .output/firefox-mv2
npm run zip            # zips pour les boutiques
```

Structure : `entrypoints/` (arrière-plan, script de contenu X, page de réglages),
`lib/` (logique partagée, testée sous Node), `public/_locales/` (traductions : français
par défaut, anglais), `tools/feed/` (pipeline du flux), [SPEC.md](SPEC.md) (spécification).

Les traductions se font dans `public/_locales/<langue>/messages.json`. Un test vérifie
que toutes les langues ont les mêmes clés.

## Licence

[GPL-3.0](LICENSE).
