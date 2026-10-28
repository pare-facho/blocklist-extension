# Pare-Facho

*[English version](README.en.md)*

Extension pour Chrome et Firefox qui masque et bloque sur X les comptes d'extrême droite
recensés par le site [On bloque l'extrême droite](https://onbloquelextremedroite.fun/).
La liste du site est abonnée dès l'installation et mise à jour toutes les heures. Vous
pouvez la retirer, ajouter d'autres listes, et ajouter ou retirer des comptes vous-même.

## Installer

**Firefox** : installez l'extension depuis la page officielle
[addons.mozilla.org/firefox/addon/pare-facho](https://addons.mozilla.org/firefox/addon/pare-facho/)
en cliquant sur « Ajouter à Firefox ».

**Chrome, Edge, Brave** : l'extension est en cours de validation par Google. En attendant,
vous pouvez l'installer à la main en cinq étapes :

1. Téléchargez ce fichier :
   [pare-facho-chrome.zip](https://github.com/pare-facho/blocklist-extension/releases/latest/download/pare-facho-chrome.zip).
2. Décompressez-le (double-clic sur le fichier). Vous obtenez un dossier `pare-facho-chrome`.
   Ne le supprimez pas ensuite : le navigateur s'en sert.
3. Dans le navigateur, tapez `chrome://extensions` dans la barre d'adresse et validez.
4. Activez le « Mode développeur » (interrupteur en haut à droite).
5. Cliquez sur « Charger l'extension non empaquetée » et choisissez le dossier décompressé.

C'est tout. Ouvrez [x.com](https://x.com) et laissez l'onglet ouvert : les comptes listés
disparaissent de votre écran tout de suite, et les blocages se font en arrière-plan. L'icône
de l'extension (dans le menu des extensions, en haut à droite) ouvre la page de réglages,
avec le statut et l'historique.

Utilisez de préférence un compte secondaire (voir [À savoir avant d'installer](#à-savoir-avant-dinstaller)).

## Ce que fait l'extension

1. **Masquer tout de suite.** Sur x.com, les publications des comptes listés disparaissent
   de votre écran dès qu'elles s'affichent : fil, réponses, recherche. Rien ne change sur
   X, seulement votre affichage.
2. **Bloquer en arrière-plan.** L'extension bloque les comptes listés un par un, à un rythme
   réglable (par défaut : au plus 300 par heure, 1000 par jour, avec un délai aléatoire de
   5 à 15 secondes entre deux). Elle envoie la même requête que le site X quand vous
   cliquez vous-même sur « Bloquer », avec votre propre session. Elle n'ouvre aucune page et
   ne fonctionne que si un onglet x.com connecté est ouvert. Les blocages s'appliquent
   ensuite partout, y compris dans l'application mobile. Le blocage se désactive dans les
   réglages si vous voulez seulement masquer.
3. **Débloquer ce qui sort des listes.** Si un compte disparaît de toutes vos listes (ajouté
   par erreur, ou liste trafiquée), l'extension le débloque de la même façon, à condition que
   ce soit elle qui l'ait bloqué. Vos propres blocages ne sont jamais annulés.
4. **Un bouton ⛔ sur chaque publication.** Un clic : la publication est masquée, le compte
   est ajouté à votre liste et mis dans la file de blocage. Cinq secondes pour annuler.
5. **Statut et historique.** La page de réglages montre les comptes listés, bloqués,
   restants, le prochain blocage prévu, l'historique et la liste complète avec recherche.
   Chaque compte peut être **gardé** (jamais masqué ni bloqué) ou, s'il vient de votre
   liste, **retiré**.

Toutes les données restent dans votre navigateur. Rien n'est envoyé à personne. Voir
[PRIVACY.md](PRIVACY.md).

## À savoir avant d'installer

- Les actions automatiques sont contraires aux conditions d'utilisation de X. Le rythme
  modéré réduit le risque pour votre compte, il ne le supprime pas. 
- L'extension dépend des pages et des adresses internes de X. Quand X change, elle peut
  cesser de fonctionner jusqu'à une mise à jour.
- Sur X, une personne bloquée peut toujours voir vos publications publiques. Elle ne peut
  plus y répondre, les aimer, ni vous écrire, et vous ne la voyez plus.

## Pour les auteurs de listes

Une liste est un fichier JSON servi en HTTPS, à une adresse fixe, avec l'en-tête
`Access-Control-Allow-Origin: *`. Dans l'extension, elle s'ajoute par son adresse.

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

- `id` est l'identifiant numérique permanent du compte. Donnez-le quand vous l'avez : les
  pseudos changent, l'identifiant jamais.
- `site` : `x`, `threads` ou `instagram`. D'autres valeurs sont acceptées et ignorées.
  Seul X est bloqué pour l'instant.
- `updated` doit changer à chaque modification.
- Retirer une entrée retire le masquage, et l'extension débloque le compte si c'est elle
  qui l'avait bloqué.
- Taille maximale : 5 Mo.

Nommer des personnes dans une liste publique, en particulier pour leurs opinions
politiques, relève des données sensibles au sens du RGPD. C'est la responsabilité de
l'auteur de la liste.

## La liste par défaut

`tools/feed/` lit les fichiers publics du site *On bloque l'extrême droite*, retrouve
l'identifiant numérique de chaque compte X (sans compte ni clé API, via la redirection
publique `x.com/intent/user`) et écrit `feed/blocklist.json`. Un
[workflow GitHub Actions](.github/workflows/feed.yml) le lance toutes les heures et publie
le résultat à l'adresse
`https://pare-facho.github.io/blocklist-extension/blocklist.json`. L'historique git montre
chaque ajout et chaque retrait. Si la source perd plus d'un dixième de ses comptes d'un coup
(site en maintenance, téléchargement incomplet, liste trafiquée), la liste n'est pas publiée
et la précédente reste en ligne.

```
node tools/feed/run.ts   # exécute une passe
```

Les identifiants déjà trouvés sont gardés dans `tools/feed/cache/x-ids.json`.
`tools/feed/corrections.json` corrige les pseudos périmés sur le site source.

## Développement

Node 22 ou plus récent.

```
npm install            # installe WXT et TypeScript
npm test               # tests unitaires (flux, format, file de blocage, rythme, traductions)
npm run check          # vérification des types
npm run build          # build Chrome dans .output/chrome-mv3
npm run build:firefox  # build Firefox dans .output/firefox-mv2
npm run zip            # zips pour les boutiques
```

Pour essayer un build dans Firefox sans passer par la boutique : `about:debugging#/runtime/this-firefox`,
« Charger un module temporaire », choisir le zip. Le module disparaît à la fermeture de Firefox.

Structure : `entrypoints/` (arrière-plan, script de contenu X, page de réglages),
`lib/` (logique partagée, testée sous Node), `public/_locales/` (traductions : français
par défaut, anglais), `tools/feed/` (pipeline de la liste), [SPEC.md](SPEC.md)
(spécification).

Les traductions se font dans `public/_locales/<langue>/messages.json`. Un test vérifie
que toutes les langues ont les mêmes clés.

## Licence

[GPL-3.0](LICENSE).
