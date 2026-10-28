# Fiche boutique — Pare-Facho (français)

## Nom
Pare-Facho

## Résumé (Chrome : 132 caractères max)
On bloque l'extrême droite : masque et bloque lentement les comptes des listes auxquelles vous vous abonnez. X pour l'instant.

## Description longue

Pare-Facho masque et bloque les comptes d'extrême droite sur X, à partir de listes que vous choisissez.

Ce que fait l'extension :

• Masquer tout de suite. Les publications des comptes listés disparaissent de votre fil, des réponses et de la recherche dès qu'elles s'affichent. Rien ne change sur X, seulement votre écran.

• Bloquer lentement, en arrière-plan (optionnel, désactivé par défaut). Si vous l'activez, l'extension bloque les comptes listés un par un, à un rythme lent que vous réglez (par défaut : au plus 10 par heure, 60 par jour, avec un délai aléatoire entre deux). Elle envoie la même demande que le site X quand vous cliquez vous-même sur « Bloquer », avec votre propre session. Elle n'ouvre aucune page et ne fonctionne que si un onglet x.com connecté est ouvert.

• Un bouton ⛔ sur chaque publication : un clic pour masquer, ajouter le compte à votre liste et le mettre en file de blocage. Cinq secondes pour annuler.

• Vos listes, votre contrôle. L'extension ne contient aucune liste. Vous vous abonnez à une adresse (par exemple la liste du site « On bloque l'extrême droite »), vous ajoutez vos propres comptes, et vous pouvez « garder » n'importe quel compte pour qu'il ne soit jamais masqué ni bloqué.

• Statut et historique : comptes listés, bloqués, restants, prochain blocage, liste complète avec recherche.

Vie privée : aucune donnée collectée, aucun serveur. Tout reste dans votre navigateur. Les seules connexions sont le téléchargement des listes que vous avez ajoutées et les blocages que vous demandez sur x.com.

À savoir : les actions automatiques sont contraires aux conditions d'utilisation de X. Le rythme lent réduit le risque pour votre compte, il ne le supprime pas. Utilisez de préférence un compte secondaire.

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
Masquer et bloquer sur X les comptes figurant dans des listes choisies par l'utilisateur.

## Justification des permissions (Chrome)
- storage : enregistrer les listes, les réglages, la file de blocage et l'historique, localement.
- alarms : vérifier les listes périodiquement et exécuter au plus un blocage par minute, au rythme réglé.
- Accès au site x.com (host permission) : masquer les publications des comptes listés dans la page, afficher le bouton ⛔, et envoyer les demandes de blocage avec la session de l'utilisateur.
- Accès optionnel à d'autres sites (optional host permission https://*/*) : demandé uniquement, et au cas par cas, quand l'utilisateur ajoute l'adresse d'une liste, pour pouvoir la télécharger.
- Aucun code distant : tout le code est dans le paquet.

## Collecte de données (formulaire Chrome)
Aucune donnée collectée ni transmise. Pas de vente, pas d'usage hors objectif, pas de crédit.

## Captures d'écran (à fournir, 1280×800 ou 640×400)
1. Fil X avec le bouton ⛔ visible sur une publication.
2. Page de réglages : statut + listes abonnées.
3. Page de réglages : liste complète avec recherche et boutons Garder / Retirer.
4. Page de réglages : historique.
