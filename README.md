# Candidatures spontanées

Petite app web statique (GitHub Pages) qui :

1. importe un fichier **CSV** d'entreprises ;
2. utilise **votre clé API Anthropic** pour que Claude fasse une **recherche web** sur chaque entreprise ;
3. rédige une **candidature spontanée** à partir de **votre CV (PDF)** et de ce qui a été trouvé ;
4. génère un **lien Gmail** qui ouvre la fenêtre de rédaction pré-remplie : Gmail l'enregistre automatiquement dans vos **brouillons**.

## Utilisation

1. Ouvrez la page GitHub Pages du dépôt.
2. Dans **Réglages** : collez votre clé API (`sk-ant-…`), chargez votre CV en PDF, ajoutez votre signature et, si besoin, des consignes (poste visé, ton, longueur…).
3. Importez votre CSV (séparateur `,` ou `;`). Les colonnes sont détectées automatiquement et peuvent être corrigées :
   - **Entreprise** (obligatoire)
   - E-mail, Contact, Site web, Notes / poste (facultatifs ; les autres colonnes sont aussi transmises comme contexte)
4. Cliquez sur **Générer** (ou **Tout générer**), relisez, modifiez si besoin, puis **Ouvrir le brouillon dans Gmail**.
5. Ajoutez votre CV en pièce jointe dans Gmail (un lien ne permet pas de joindre un fichier).

Un exemple de fichier est fourni : [`exemple.csv`](exemple.csv).

## Confidentialité

- Aucun serveur : tout tourne dans votre navigateur.
- La clé API, le CV et les lettres générées sont stockés uniquement dans le `localStorage` de votre navigateur.
- Les seules requêtes sortantes vont à l'API Anthropic (`api.anthropic.com`) et aux CDN qui servent les bibliothèques.
- Le CV n'est **pas** dans ce dépôt.

## Coût

Chaque entreprise = un appel à Claude avec jusqu'à 6 recherches web (10 $ / 1 000 recherches) plus les tokens lus. Le CV est mis en cache entre deux entreprises pour réduire le coût. Comptez quelques centimes à quelques dizaines de centimes par entreprise selon le modèle choisi.

## Technique

- HTML/CSS/JS sans étape de build.
- SDK officiel [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) chargé depuis jsDelivr, avec `dangerouslyAllowBrowser: true` (la clé reste chez vous, dans votre navigateur).
- Modèle par défaut : `claude-opus-5-5` avec l'outil `web_search_20260209`.
- Parsing CSV : [PapaParse](https://www.papaparse.com/).
