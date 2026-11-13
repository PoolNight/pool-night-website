# PoolNight – site du club

Un seul site, hébergé sur Netlify (une seule adresse) : présentation, bureau, **tournois**, évènements, classement ELO et espace organisateur.

## Structure

```
index.html            site principal (onglets) ; l'onglet Tournois affiche tournois.html
tournois.html         générateur de tableaux (organisateur) et suivi (joueurs)
data.json             données de départ (évènements + résultats), utilisées tant que rien n'a été publié
assets/               images du site
_headers              en-têtes de sécurité
package.json          dépendance @netlify/blobs
netlify/functions/
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

1. Mot de passe de l'espace (empreinte `ORGA_HASH` dans `index.html`).
2. Saisir la clé organisateur (`ORGANIZER_KEY`) puis « Vérifier la clé ».
3. Modifier les évènements, importer les tournois, corriger les défis, puis **Publier** : c'est visible tout de suite, sans déploiement.

Les évènements publiés sont stockés dans Netlify Blobs. Avant la première publication, le site lit `data.json`.

## Sécurité

- Seules les fonctions Netlify modifient des données, et chaque écriture demande la clé organisateur, comparée côté serveur.
- 8 mauvaises clés par heure et par adresse IP, puis blocage d'une heure.
- Défis : confirmation par l'adversaire, limites par adresse IP et par joueur, validation facultative du bureau.
- Aucun secret dans les pages du site.
