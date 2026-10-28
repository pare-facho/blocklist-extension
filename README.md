# Pare-Facho

*[English version](README.en.md)*

Extension pour Chrome et Firefox qui masque sur X les publications des comptes d'extrême
droite recensés par le site [On bloque l'extrême droite](https://onbloquelextremedroite.fun/).
La liste du site est abonnée dès l'installation et mise à jour régulièrement. Vous pouvez
la retirer, ajouter d'autres listes, et ajouter ou retirer des comptes vous-même.

L'extension ne touche pas à votre compte : elle ne bloque, ne masque côté X et ne signale
personne. Elle change seulement ce qui s'affiche sur votre écran.

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

1. **Masquer.** Sur x.com, les publications des comptes listés disparaissent de votre écran
   dès qu'elles s'affichent : fil, réponses, recherche, profils. Les republications
   (reposts) faites par un compte listé sont masquées aussi. Rien ne change sur X,
   seulement votre affichage.
2. **Un bouton ⛔ sur chaque publication.** Un clic : la publication est masquée et le
   compte est ajouté à votre liste. Cinq secondes pour annuler.
3. **Vos listes, votre contrôle.** La page de réglages montre les listes abonnées, votre
   propre liste, la liste complète avec recherche, et le journal. Chaque compte peut être
   **gardé** (jamais masqué) ou, s'il vient de votre liste, **retiré**.

Toutes les données restent dans votre navigateur. Rien n'est envoyé à personne. Voir
[PRIVACY.md](PRIVACY.md).

Jusqu'à la version 0.3, l'extension pouvait aussi bloquer les comptes listés, petit à
petit, avec votre session. Cette fonction a été retirée dans la version 0.4 : les actions
automatiques sont contraires aux conditions d'utilisation de X et exposaient votre compte.
Les blocages déjà faits par une ancienne version restent en place ; vous pouvez les annuler
dans les réglages de X (« Comptes bloqués »).

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
