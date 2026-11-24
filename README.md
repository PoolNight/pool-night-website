# PoolNight – site du club

Un seul site, hébergé sur Netlify (une seule adresse) : présentation, bureau, **tournois**, évènements, classement ELO et espace organisateur.

## Structure

```
index.html            site principal (onglets) ; l'onglet Tournois affiche tournois.html
tournois.html         générateur de tableaux (organisateur) et suivi (joueurs)
css/index.css         styles du site principal
css/tournois.css      styles de la page des tournois
js/dom.js             utilitaires partagés
js/organizer-session.js  connexion et déconnexion du bureau
js/home/              club, évènements, classement, défis, navigation et gestion du site
js/tournaments/       participants, tableaux, tables, vue joueur et synchronisation
data.json             données de départ (évènements + résultats), utilisées tant que rien n'a été publié
assets/               images du site
_headers              en-têtes de sécurité
package.json          dépendance @netlify/blobs
netlify/functions/
  organisateur.mjs    /api/organisateur   sessions du bureau
  tournoi.mjs         /api/tournoi   tournoi en cours
  defis.mjs           /api/defis     défis entre joueurs
  donnees.mjs         /api/donnees   évènements et résultats publiés  +  /api/affiche  affiches
netlify/lib/ratelimit.mjs   anti force brute de la clé organisateur
```

## Mise en place

1. Netlify → Site configuration → Environment variables : `ORGANIZER_KEY` = une clé longue et aléatoire (32 caractères ou plus).
2. Netlify déploie la branche `main` (Site configuration → Build & deploy → Branches).
3. Ouvrir `/#tournois` : l'onglet Tournois. Ouvrir `/#tournois?vue=orga` : la vue organisateur des tournois.

## Espace organisateur (`/#organisateur`)

1. Se connecter avec le mot de passe configuré dans la variable Netlify `ORGANIZER_KEY`. Le même accès ouvre la vue organisateur des tournois.
2. Modifier les évènements, importer les tournois, corriger les défis, puis **Publier**.
3. Utiliser **Se déconnecter** pour fermer la session sur ce navigateur. Elle expire automatiquement après huit heures.

Les évènements publiés sont stockés dans Netlify Blobs. Avant la première publication, le site lit `data.json`.

## Sécurité

- Les écritures du bureau nécessitent une session validée côté serveur. Le mot de passe reste configuré dans Netlify et le navigateur reçoit un cookie de session HttpOnly, Secure et SameSite=Strict.
- La connexion est limitée à 8 essais incorrects par heure et par adresse IP.
- Défis : confirmation par l'adversaire, limites par adresse IP et par joueur, validation facultative du bureau.
- Aucun secret dans les pages du site.
