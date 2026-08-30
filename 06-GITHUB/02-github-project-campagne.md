# GitHub Project — Atelier de campagne Automne 2026

## Nom

`Campagne Automne 2026 — 20 inscriptions`

## Statuts

1. Idée
2. Prête à produire
3. En production
4. En contrôle
5. Programmée
6. Publiée
7. À mesurer
8. À recycler
9. Terminée

## Champs

| Champ | Type | Valeurs |
|---|---|---|
| Canal | sélection | WhatsApp, Facebook, LinkedIn, Vidéo, Webinaire, Meta Ads |
| Segment | sélection | A Coachs/Formateurs, B Managers/Projets, C Professionnels |
| Type | sélection | Affiche, Message, Vidéo, Témoignage, Webinaire, Publicité |
| CTA | sélection | Programme, Entretien, Webinaire, Candidature |
| Responsable | personne | membre de l’équipe |
| Date cible | date | 29 août au 25 septembre |
| KPI principal | texte | leads, entretiens, inscriptions |
| Statut preuve | sélection | aucune, source prête, contrôlée, publiée |

## Vues

### Vue 1 — Calendrier éditorial

Disposition calendrier. Filtre sur la date cible.

### Vue 2 — Kanban de production

Groupement par statut.

### Vue 3 — Meta Ads

Filtre `Canal = Meta Ads`. Afficher audience, création, budget et décision.

### Vue 4 — Témoignages

Filtre `Type = Témoignage`. Afficher autorisation et statut de publication.

### Vue 5 — Contenus à recycler

Filtre `Statut = À recycler`. Conserver les contenus qui ont produit des conversations qualifiées.

## Labels recommandés

```text
canal:whatsapp
canal:facebook
canal:linkedin
canal:video
canal:webinaire
canal:meta-ads
type:affiche
type:message
type:temoignage
type:preuve
priorite:haute
controle:requis
blocage:decision
```

## Automatisations simples

- Issue ajoutée → statut `Idée`.
- Responsable et date présents → statut `Prête à produire`.
- Pull Request ouverte → statut `En contrôle`.
- Pull Request fusionnée → statut `Programmée` ou `Terminée` selon le type.
- Contenu publié → statut `À mesurer`.

## Règle de gouvernance

Une affiche, une vidéo ou une publicité doit être contrôlée avant diffusion : date, texte, lien, CTA, droit à l’image et cohérence avec l’offre.

