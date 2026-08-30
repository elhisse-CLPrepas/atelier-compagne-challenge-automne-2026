# Automatisation A2 — Mode opératoire

## Emplacement

Les dossiers `.github`, `config` et `scripts` se trouvent à la racine du dépôt. Le dossier quotidien se trouve dans `02-CONTENUS/QUOTIDIEN/AAAA-MM-JJ`.

## Cycle

```text
Calendrier approuvé
→ génération du brouillon
→ contrôle automatique
→ Pull Request
→ revue humaine
→ fusion décidée par Abderrahman
→ préparation de la programmation
→ diffusion autorisée
→ mesure
```

## Exécution quotidienne

Le workflow `prepare-daily-content.yml` s’exécute à 7 h 45 dans le fuseau `Africa/Casablanca`. Il peut aussi être lancé manuellement depuis l’onglet Actions.

Il crée une branche `automation/daily-AAAA-MM-JJ` et une Pull Request. Il ne modifie pas directement `main`.

## Validation humaine

Le workflow `prepare-publication.yml` utilise l’environnement GitHub `publication`.

À configurer dans `Settings → Environments → New environment` :

1. nommer l’environnement `publication` ;
2. ajouter Abderrahman comme relecteur obligatoire ;
3. interdire l’auto-approbation si un second relecteur est disponible ;
4. ne placer aucun jeton dans les fichiers du dépôt.

Le mot de confirmation demandé est `VALIDATION_HUMAINE`.

## Limite de la version A2.1

Le workflow construit un pack prêt à programmer. Il ne publie pas directement sur Facebook, LinkedIn ou WhatsApp. Les connecteurs de plateforme seront ajoutés dans une mission séparée après contrôle des comptes, des autorisations, du consentement et des secrets.

## Enregistrement de la diffusion

Après publication, mettre à jour `publication.json` par une Pull Request :

```json
{
  "status": "published",
  "human_approval": true,
  "approved_by": "Abderrahman",
  "scheduled_for": "AAAA-MM-JJTHH:MM:SS+01:00",
  "published_at": "AAAA-MM-JJTHH:MM:SS+01:00",
  "platform_urls": {
    "facebook": "URL_PUBLIQUE",
    "linkedin": "URL_PUBLIQUE"
  }
}
```

Conserver les autres propriétés du fichier, notamment le bloc `metrics`.

Le workflow de mesure ouvrira ensuite une Issue sans recopier de données personnelles.
