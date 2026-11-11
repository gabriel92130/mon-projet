# GS HORIZON — nouveau design du site public

Refonte de la page d'accueil (`index.html`) faite avec le skill **UI/UX Pro Max**.

## Ce qui change

| Avant | Après |
|---|---|
| `index.html` de 12 Mo (169 images en base64 dans le HTML) | HTML de ~50 Ko, la 3D est générée par le code (aucune image à charger) |
| Écran de chargement bloquant jusqu'à 100 % | Le contenu s'affiche tout de suite |
| Séquence de 169 images (8 Mo) | Expérience 3D temps réel « Vers l'horizon » : compacte sportive inspirée d'une 308 GT Line (sans logo), scan laser, nuit → lever de soleil, choix de teinte |
| Emojis utilisés comme icônes | Icônes SVG (Lucide + logos officiels Simple Icons) |
| Menu caché sur mobile | Menu burger + barre « Appeler / WhatsApp » fixe en bas |
| 43 véhicules affichés d'un coup | Recherche, filtres, tri, « Afficher plus » |
| Message d'erreur technique « JSONBin » visible des clients | Message clair avec bouton d'appel |
| Bug : balise `<style>` coupée qui masquait du contenu et désactivait un script | Corrigé |
| Formulaires sans `label for`, pas de focus visible | Formulaires accessibles, validation claire, navigation clavier |

Design system : fond noir, titres argent métallisé (comme le logo), jaune de marque
réservé aux actions et aux prix. Polices : Barlow Condensed (titres) + Barlow (texte).

## Mise en ligne (OVH, par FTP)

Dans le dossier `www/` du serveur, envoyer :

- `index.html` (remplace l'ancien : **gardez une copie de l'ancien avant**)
- le dossier `assets/` (styles, script, logo)

Ne touchez à rien d'autre : `api/`, `admin/`, `data/`, `photos/`, `commande.html`
continuent de fonctionner. La page lit toujours le catalogue depuis `/api/catalogue.php`,
et le bouton « Réserver » mène toujours à `/commande.html?vehicleId=…`.

## L'expérience 3D

- Fichier `assets/scene.js` (Three.js, chargé depuis cdn.jsdelivr.net).
- 5 chapitres pilotés par le défilement : intro (phares), inspection (scan laser + repères),
  garantie (feux arrière), en route (compteur de vitesse), lever de soleil + boutons.
- Le visiteur peut changer la couleur de la voiture.
- Sans WebGL, ou si le visiteur a activé « réduire les animations », la section s'affiche
  en version fixe lisible : rien n'est perdu.
