# Carto-facileSN — Interface Streamlit (Experts)

Interface d'analyse avancée connectée à l'API Flask Carto-facileSN.

## Déploiement Streamlit Cloud

1. Aller sur [streamlit.io/cloud](https://streamlit.io/cloud)
2. "New app" → Repo : `pratisig/Carto-facileSN`
3. Branch : `feature/streamlit-experts` (puis `main` après merge)
4. Main file : `streamlit/app.py`
5. Dans **Secrets**, ajouter :
   ```toml
   API_URL = "https://carto-facilesn.onrender.com"
   ```

## Lancement local

```bash
cd streamlit
pip install -r requirements.txt
streamlit run app.py
```

## Architecture

Ce module ne lit **jamais** les SHPs directement.
Toute la logique métier reste dans l'API Flask.
