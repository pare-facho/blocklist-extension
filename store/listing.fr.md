# Fiche boutique — Pare-Facho (français)

## Nom
Pare-Facho

## Résumé (Chrome : 132 caractères max)
On bloque l'extrême droite : replie sur X les publications des comptes listés et dit à X qu'elles ne vous intéressent pas.

## Description longue

Pare-Facho replie sur X les publications des comptes d'extrême droite, à partir de listes que vous choisissez, et agit depuis votre fil par le menu de X, avec votre session, comme si vous cliquiez vous-même : « Ce post ne m'intéresse pas » sur chaque publication (par défaut), ou « Masquer » le compte. Rien n'est bloqué.

Ce que fait l'extension :

• Replier. Les publications des comptes listés sont remplacées par une ligne « ⛔ @compte · publication masquée » dans votre fil, les réponses, la recherche et les profils. Les republications faites par un compte listé sont repliées aussi. Un bouton « Afficher » montre la publication.

• Agir depuis le fil. Quand la ligne repliée est à l'écran, l'extension ouvre le menu de la publication et choisit « Ce post ne m'intéresse pas » (par défaut) ou « Masquer » (mute), comme vous le feriez à la main. Au plus 30 actions par heure et 150 par jour, 15 à 45 secondes entre deux, une seule à la fois, jamais en arrière-plan, jamais depuis un profil. La page de réglages explique ce que chaque option pèse sur la portée du compte, d'après le code de classement publié par X.

• Un bouton ⛔ sur chaque publication : un clic pour ajouter le compte à votre liste. Cinq secondes pour annuler.

• Vos listes, votre contrôle. La liste du site « On bloque l'extrême droite » est abonnée d'office et mise à jour automatiquement ; vous pouvez la retirer, vous abonner à d'autres adresses, ajouter vos propres comptes, et « garder » n'importe quel compte pour qu'il ne soit jamais masqué.

• Page de réglages : mode (pas intéressé ou masquer), compteurs, listes abonnées, liste complète avec recherche, ce que l'extension a fait, journal.

Vie privée : aucune donnée collectée, aucun serveur. Tout reste dans votre navigateur. Les seules connexions de l'extension sont le téléchargement des listes (celle fournie par défaut et celles que vous ajoutez) ; les actions sont envoyées par la page de X elle-même, avec votre session.

À savoir : le masquage ne vaut que dans ce navigateur ; l'application mobile affiche tout. Quand X change son affichage, l'extension peut cesser de masquer jusqu'à une mise à jour.

Logiciel libre (GPL-3.0). Code source : https://github.com/pare-facho/blocklist-extension

## Catégorie
Chrome : Réseaux sociaux et communication. Firefox : Réseaux sociaux (Social & Communication).

## Langue par défaut
Français (anglais disponible).

## Politique de confidentialité (URL)
https://github.com/pare-facho/blocklist-extension/blob/main/PRIVACY.md

## Page d'accueil / support
https://github.com/pare-facho/blocklist-extension
https://github.com/pare-facho/blocklist-extension/issues

## Objectif unique (Chrome « single purpose »)
Replier sur X les publications des comptes figurant dans des listes choisies par l'utilisateur, et les marquer « pas intéressé » (ou masquer le compte) depuis le fil.

## Justification des permissions (Chrome)
- storage : enregistrer les listes, les réglages et le journal, localement.
- alarms : retélécharger les listes périodiquement.
- Accès au site x.com (host permission) : replier dans la page les publications des comptes listés, afficher le bouton ⛔ et cliquer sur « Ce post ne m'intéresse pas » ou « Masquer » dans le menu de X. L'extension n'envoie aucune requête à X elle-même.
- Accès au site pare-facho.github.io (host permission) : télécharger la liste fournie par défaut et ses mises à jour.
- Accès optionnel à d'autres sites (optional host permission https://*/*) : demandé uniquement, et au cas par cas, quand l'utilisateur ajoute l'adresse d'une liste, pour pouvoir la télécharger.
- Aucun code distant : tout le code est dans le paquet.

## Collecte de données (formulaire Chrome)
Aucune donnée collectée ni transmise. Pas de vente, pas d'usage hors objectif, pas de crédit.

## Captures d'écran (1280×800, dossier store/screenshots)
1. `1-strips.png` : sur X, les publications d'un compte listé repliées en une ligne (⛔ @compte · publication masquée) avec le bouton Afficher.
2. `2-status.png` : page de réglages, statut et choix du mode avec l'explication.
3. `3-lists.png` : page de réglages, listes abonnées et ma liste.
4. `4-full-list.png` : page de réglages, liste complète avec recherche et boutons Garder / Retirer.
