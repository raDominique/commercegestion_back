# Ticket : Incohérence entre actifs et passifs (MGA)

**Type :** Bug **Priorité :** Haute (intégrité des données financières) **Module :** Actifs / Passifs (commercegestion.online) **Pages concernées :** `/actifs` et `/passifs`

## Contexte

Sur la plateforme Etokisana, chaque passif doit être couvert par un actif correspondant. Les pages « Mes Actifs » et « Mes Passifs » affichent pour le produit **MGA (code 99999)** des totaux incohérents.

## Comportement observé

- **Page Actifs** : la ligne MGA (dépôt RANDRIA Amboh…, statut Actif / Approuvé) affiche une quantité de **885 000**.
- **Page Passifs** : les 4 lignes MGA approuvées totalisent **1 080 000** :

| Ayant droit | Dépôt | Quantité |
| --- | --- | --- |
| randrianaivo.dominique@gmail.com | Mvola Bank | 160 000 |
| superadmin@commercegestion.com | RANDRIA Amboh… | 400 000 |
| sergeradert@yahoo.fr | RANDRIA Amboh… | 420 000 |
| sergeradert@gmail.com | RANDRIA Amboh… | 100 000 |

- **Écart** : 1 080 000 − 885 000 = **195 000** de passifs non couverts.

## Comportement attendu

> Cette quantité doit être au moins égale à la somme des passifs.

Pour un produit donné, la quantité d'actif doit toujours être **≥ la somme des passifs** associés.

## Pistes à vérifier

- Les opérations du 19/10/2026 (15:29 à 16:41) ont-elles bien créé un actif et un passif de même montant ?
- Un passif peut-il être approuvé sans contrôle de couverture par l'actif ?
- Le passif de 160 000 chez Mvola Bank est-il rattaché à un actif de 10 000 seulement ? Le rapprochement se fait-il par dépôt ou globalement ?
- Y a-t-il des retraits ou virements qui diminuent l'actif sans diminuer le passif ?

## Critères d'acceptation

- [ ] Une validation bloque l'approbation d'un passif si l'actif disponible est insuffisant.
- [ ] Pour chaque produit, actif ≥ somme des passifs approuvés.
- [ ] Les données existantes incohérentes (MGA) sont identifiées et corrigées.

## Pièces jointes

- Capture 1 : page Actifs (ligne 885 000 entourée)
- Capture 2 : page Passifs (4 lignes entourées, total 1 080 000)
