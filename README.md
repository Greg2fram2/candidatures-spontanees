# Candidatures spontanées

Petite app web statique (GitHub Pages) qui :

1. importe un fichier **CSV** d'entreprises ;
2. utilise **votre clé API OpenAI** pour faire une **recherche web** sur chaque entreprise ;
3. rédige une **candidature spontanée** à partir de **votre CV (PDF)** et de ce qui a été trouvé ;
4. génère un **lien Gmail** qui ouvre la fenêtre de rédaction pré-remplie : Gmail l'enregistre automatiquement dans vos **brouillons**.

## Utilisation

1. Ouvrez la page GitHub Pages du dépôt.
2. Dans **Réglages** : collez votre clé API OpenAI (`sk-…`, à créer sur [platform.openai.com/api-keys](https://platform.openai.com/api-keys)), chargez votre CV en PDF, ajoutez votre signature et, si besoin, des consignes (poste visé, ton, longueur…).
3. Importez votre CSV (séparateur `,` ou `;`). Les colonnes sont détectées automatiquement et peuvent être corrigées :
   - **Entreprise** (obligatoire)
   - E-mail, Contact, Site web, Notes / poste (facultatifs ; les autres colonnes sont aussi transmises comme contexte)
4. Cliquez sur **Générer** (ou **Tout générer**), relisez, modifiez si besoin, puis **Ouvrir le brouillon dans Gmail**.
5. Ajoutez votre CV en pièce jointe dans Gmail (un lien ne permet pas de joindre un fichier).

Un exemple de fichier est fourni : [`exemple.csv`](exemple.csv).

## Confidentialité

- Aucun serveur : tout tourne dans votre navigateur.
- La clé API, le CV et les lettres générées sont stockés uniquement dans le `localStorage` de votre navigateur.
- La clé n'est **jamais** dans ce dépôt (pas de `.env`) : un dépôt public ou un site statique ne peut pas garder de secret. Elle reste masquée dans le champ (pas de bouton « afficher », copie bloquée) ; le bouton **Effacer** la retire du navigateur.
- Utilisez une clé dédiée à cette app, avec une limite de dépense sur votre compte OpenAI, et révoquez-la si vous utilisez un ordinateur partagé.
- Les seules requêtes sortantes vont à l'API OpenAI (`api.openai.com`) et aux CDN qui servent les bibliothèques.
- Le CV n'est **pas** dans ce dépôt.

## Coût

Chaque entreprise = un appel à l'API Responses avec l'outil de recherche web (facturé par recherche) plus les tokens lus. Les consignes et le CV sont placés en tête de requête pour profiter du cache automatique d'OpenAI d'une entreprise à l'autre. Comptez quelques centimes à quelques dizaines de centimes par entreprise selon le modèle choisi.

## Technique

- HTML/CSS/JS sans étape de build.
- SDK officiel [`openai`](https://www.npmjs.com/package/openai) chargé depuis jsDelivr, avec `dangerouslyAllowBrowser: true` (la clé reste chez vous, dans votre navigateur).
- API Responses, modèle par défaut `gpt-6-astra` (ou `gpt-6.1-sol`, moins cher), outil `web_search`, CV envoyé en `input_file` PDF.
- Parsing CSV : [PapaParse](https://www.papaparse.com/).
