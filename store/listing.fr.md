# Fiche boutique — Pare-Facho (français)

## Nom
Pare-Facho

## Résumé (Chrome : 132 caractères max)
On bloque l'extrême droite : masque et bloque progressivement les comptes d'extrême droite listés, que vous les suiviez ou non.

## Description longue

Pare-Facho masque et bloque les comptes d'extrême droite sur X, à partir de listes que vous choisissez.

Ce que fait l'extension :

• Masquer tout de suite. Les publications des comptes listés disparaissent de votre fil, des réponses et de la recherche dès qu'elles s'affichent. Rien ne change sur X, seulement votre écran.

• Bloquer progressivement, en arrière-plan (activé par défaut, désactivable). L'extension bloque les comptes listés un par un, à un rythme que vous réglez (par défaut : au plus 300 par heure, 1000 par jour, avec un délai aléatoire de 5 à 15 secondes entre deux). Elle envoie la même demande que le site X quand vous cliquez vous-même sur « Bloquer », avec votre propre session. Elle n'ouvre aucune page et ne fonctionne que si un onglet x.com connecté est ouvert. Si un compte sort de toutes vos listes (ajouté par erreur, ou liste trafiquée), l'extension le débloque de la même façon, à condition que ce soit elle qui l'ait bloqué.

• Un bouton ⛔ sur chaque publication : un clic pour masquer, ajouter le compte à votre liste et le mettre en file de blocage. Cinq secondes pour annuler.

• Vos listes, votre contrôle. La liste du site « On bloque l'extrême droite » est abonnée d'office et mise à jour automatiquement ; vous pouvez la retirer, vous abonner à d'autres adresses, ajouter vos propres comptes, et « garder » n'importe quel compte pour qu'il ne soit jamais masqué ni bloqué.

• Statut et historique : comptes listés, bloqués, restants, prochain blocage, liste complète avec recherche.

Vie privée : aucune donnée collectée, aucun serveur. Tout reste dans votre navigateur. Les seules connexions sont le téléchargement des listes (celle fournie par défaut et celles que vous ajoutez) et les blocages que vous demandez sur x.com.

À savoir : les actions automatiques sont contraires aux conditions d'utilisation de X. Un rythme modéré réduit le risque pour votre compte, il ne le supprime pas. Utilisez de préférence un compte secondaire.

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
- alarms : vérifier les listes périodiquement et lancer les blocages en arrière-plan, au rythme réglé.
- Accès au site x.com (host permission) : masquer les publications des comptes listés dans la page, afficher le bouton ⛔, et envoyer les demandes de blocage et de déblocage avec la session de l'utilisateur.
- Accès au site pare-facho.github.io (host permission) : télécharger la liste fournie par défaut et ses mises à jour.
- Accès optionnel à d'autres sites (optional host permission https://*/*) : demandé uniquement, et au cas par cas, quand l'utilisateur ajoute l'adresse d'une liste, pour pouvoir la télécharger.
- Aucun code distant : tout le code est dans le paquet.

## Collecte de données (formulaire Chrome)
Aucune donnée collectée ni transmise. Pas de vente, pas d'usage hors objectif, pas de crédit.

## Captures d'écran (à fournir, 1280×800 ou 640×400)
1. Fil X avec le bouton ⛔ visible sur une publication.
2. Page de réglages : statut + listes abonnées.
3. Page de réglages : liste complète avec recherche et boutons Garder / Retirer.
4. Page de réglages : historique.
