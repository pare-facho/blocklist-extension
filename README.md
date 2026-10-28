# Pare-Facho

*[English version](README.en.md)*

Extension pour Chrome et Firefox qui masque sur X les publications des comptes d'extrême
droite recensés par le site [On bloque l'extrême droite](https://onbloquelextremedroite.fun/).
La liste du site est abonnée dès l'installation et mise à jour régulièrement. Vous pouvez
la retirer, ajouter d'autres listes, et ajouter ou retirer des comptes vous-même.

Par défaut, l'extension replie ces publications et **bloque le compte** par le menu de X,
avec votre session, au moment où la publication arrive à l'écran : un compte à la fois, au
rythme d'une personne. Un réglage « Masquer seulement » replie sans rien envoyer à X.

## Installer

### Firefox

L'extension est en attente de validation par Mozilla. En attendant la page officielle
([addons.mozilla.org/firefox/addon/pare-facho](https://addons.mozilla.org/firefox/addon/pare-facho/)),
vous pouvez installer la version signée par Mozilla en deux étapes :

1. Dans Firefox, cliquez sur ce lien :
   [pare-facho-firefox.xpi](https://github.com/pare-facho/blocklist-extension/releases/latest/download/pare-facho-firefox.xpi).
2. Firefox demande d'abord l'autorisation d'installer depuis GitHub : cliquez sur
   « Continuer l'installation » (ou « Autoriser »), puis sur « Ajouter » dans la fenêtre
   « Ajouter Pare-Facho ? ».

Autre méthode : téléchargez le fichier `.xpi`, puis faites-le glisser sur une fenêtre de
Firefox, ou ouvrez `about:addons`, cliquez sur la roue dentée et choisissez « Installer un
module depuis un fichier… ».

Cette version est signée par Mozilla, elle fonctionne dans Firefox normal et reste
installée. Un fichier `.zip` ou un `.xpi` non signé est refusé par Firefox (« le module n'a
pas pu être vérifié ») : n'utilisez pas `pare-facho-firefox.zip` pour installer, il sert
seulement à la validation du code.

### Chrome, Edge, Brave

L'extension est en cours de validation par Google. En attendant, vous pouvez l'installer à
la main en cinq étapes :

1. Téléchargez ce fichier :
   [pare-facho-chrome.zip](https://github.com/pare-facho/blocklist-extension/releases/latest/download/pare-facho-chrome.zip).
2. Décompressez-le (double-clic sur le fichier). Vous obtenez un dossier `pare-facho-chrome`.
   Ne le supprimez pas ensuite : le navigateur s'en sert.
3. Dans le navigateur, tapez `chrome://extensions` dans la barre d'adresse et validez
   (`edge://extensions` dans Edge, `brave://extensions` dans Brave).
4. Activez le « Mode développeur » (interrupteur en haut à droite).
5. Faites glisser le dossier décompressé sur cette page, ou cliquez sur « Charger
   l'extension non empaquetée » et choisissez le dossier.

Le fichier `.zip` lui-même ne peut pas être glissé : il faut d'abord le décompresser.

C'est tout. Ouvrez [x.com](https://x.com) : les comptes listés disparaissent de votre
écran. L'icône de l'extension (dans le menu des extensions, en haut à droite) ouvre la page
de réglages.

## Ce que fait l'extension

1. **Replier.** Sur x.com, les publications des comptes listés sont remplacées par une
   ligne « ⛔ @compte · publication masquée » dès qu'elles s'affichent : fil, réponses,
   recherche, profils. Les republications (reposts) faites par un compte listé sont repliées
   aussi. Un bouton « Afficher » montre la publication quand même.
2. **Bloquer depuis le fil** (réglage par défaut). Quand la ligne repliée est à l'écran,
   l'extension ouvre le menu « ⋯ » de la publication, choisit « Bloquer » et confirme,
   exactement comme vous le feriez à la main : ce sont les clics et les requêtes de X
   elle-même, avec votre session. Un blocage fait depuis une publication affichée est un
   signal négatif pour ce compte dans ce que X recommande. Rythme : au plus 30 blocages
   par heure et 150 par jour, 15 à 45 secondes de pause entre deux, un seul à la fois,
   jamais en arrière-plan. La ligne repliée indique « blocage dans un instant » et offre
   « Ne pas bloquer ». Les comptes bloqués sont listés dans les réglages.
3. **Un bouton ⛔ sur chaque publication.** Un clic : le compte est ajouté à votre liste,
   la publication est repliée et, en mode bloquer, le compte est bloqué. Cinq secondes
   pour annuler.
4. **Vos listes, votre contrôle.** La page de réglages montre les listes abonnées, votre
   propre liste, la liste complète avec recherche, et le journal. Chaque compte peut être
   **gardé** (jamais masqué) ou, s'il vient de votre liste, **retiré**.

Toutes les données restent dans votre navigateur. Rien n'est envoyé à personne d'autre que
X, et seulement sous la forme de vos propres blocages. Voir [PRIVACY.md](PRIVACY.md).

**À savoir.** X interdit les actions automatisées en masse. Le mode « bloquer » agit
uniquement sur les publications que X vous a affichées, une par une, à un rythme humain,
et jamais sur l'ensemble de la liste en arrière-plan (c'est ce que faisaient les versions
0.3, retiré en 0.4). C'est tout de même votre compte qui bloque : choisissez « Masquer
seulement » si vous ne voulez rien envoyer à X. Un blocage s'annule dans les réglages de X
(« Comptes bloqués »).

## À savoir avant d'installer

- L'extension dépend des pages de X. Quand X change son affichage, elle peut cesser de
  masquer jusqu'à une mise à jour.
- Le masquage ne vaut que dans le navigateur où l'extension est installée. L'application
  mobile affiche tout.

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
  Seul X est pris en charge pour l'instant.
- `updated` doit changer à chaque modification.
- Retirer une entrée retire le masquage à la prochaine mise à jour.
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
npm test               # tests unitaires (flux, format, filtrage, traductions)
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
