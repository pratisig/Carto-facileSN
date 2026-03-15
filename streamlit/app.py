"""
Carto-facileSN — Interface experts Streamlit
Connectee 100% a l'API Flask via variable d'environnement API_URL.
"""
import os
import streamlit as st
import requests
import folium
from streamlit_folium import st_folium
import pandas as pd
import json

st.set_page_config(
    page_title="Carto-facileSN Experts",
    page_icon="\U0001f5fa\ufe0f",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Lire API_URL depuis variable d'environnement Render (ou secrets Streamlit Cloud)
API = os.environ.get("API_URL", "https://carto-facilesn-api.onrender.com")


@st.cache_data(ttl=3600, show_spinner=False)
def charger_geojson_admin(niveau: str) -> dict:
    try:
        r = requests.get(f"{API}/api/couches/admin/{niveau}", timeout=60)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        st.error(f"Erreur chargement {niveau}: {e}")
        return {"type": "FeatureCollection", "features": []}


@st.cache_data(ttl=3600, show_spinner=False)
def charger_couche_thematique(couche: str) -> dict:
    try:
        r = requests.get(f"{API}/api/couches/thematique/{couche}", timeout=60)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"type": "FeatureCollection", "features": []}


@st.cache_data(ttl=3600, show_spinner=False)
def charger_catalogue() -> list:
    try:
        r = requests.get(f"{API}/api/couches/catalogue", timeout=30)
        return r.json() if r.ok else []
    except Exception:
        return []


COULEURS = {
    "routes": "#888888", "cours_eau": "#3498db", "localites": "#c0392b",
    "aeroports": "#2c3e50", "aires_protegees": "#1e8449", "plans_eau": "#85c1e9",
    "chemin_fer": "#444444", "points_eau": "#2980b9", "agglomerations": "#e67e22",
    "surfaces_boisees": "#27ae60", "sable": "#f0e68c", "courbes_niveau": "#b7950b",
}

LABELS = {
    "routes": "\U0001f6e3\ufe0f Routes",
    "cours_eau": "\U0001f4a7 Cours d'eau",
    "localites": "\U0001f3d8\ufe0f Localites",
    "aeroports": "\u2708\ufe0f Aeroports",
    "aires_protegees": "\U0001f33f Aires protegees",
    "plans_eau": "\U0001f30a Plans d'eau",
    "chemin_fer": "\U0001f682 Chemin de fer",
    "points_eau": "\U0001f6b0 Points d'eau",
    "agglomerations": "\U0001f3d9\ufe0f Agglomerations",
    "surfaces_boisees": "\U0001f332 Forets",
}

# ── Sidebar ──────────────────────────────────────────────────────────────────
st.sidebar.title("\U0001f5fa\ufe0f Carto-facileSN")
st.sidebar.caption(f"API: {API}")

module = st.sidebar.radio("Module", [
    "\U0001f5fa\ufe0f Carte interactive",
    "\U0001f4ca Statistiques",
    "\U0001f4e4 Export donnees",
    "\U0001f517 API Documentation",
])

# ── MODULE 1 : Carte interactive ─────────────────────────────────────────────
if module == "\U0001f5fa\ufe0f Carte interactive":
    st.header("Carte du Senegal")
    col1, col2 = st.columns([1, 3])

    with col1:
        st.subheader("Options")
        catalogue = charger_catalogue()
        couches_dispo = [c["id"] for c in catalogue] if catalogue else list(COULEURS.keys())
        couches_sel = st.multiselect(
            "Couches thematiques",
            options=couches_dispo,
            default=["routes", "cours_eau"],
            format_func=lambda x: LABELS.get(x, x)
        )
        afficher_dep = st.checkbox("Departements", value=True)
        afficher_arr = st.checkbox("Arrondissements", value=False)
        fond = st.selectbox("Fond de carte", [
            "OpenStreetMap", "Satellite (Esri)", "CartoDB Positron"
        ])

    with col2:
        m = folium.Map(location=[14.4, -14.4], zoom_start=7, control_scale=True)
        FONDS = {
            "OpenStreetMap": ("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", "(c) OpenStreetMap"),
            "Satellite (Esri)": (
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                "(c) Esri"),
            "CartoDB Positron": (
                "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
                "(c) CartoDB"),
        }
        url, attr = FONDS[fond]
        folium.TileLayer(url, attr=attr).add_to(m)

        with st.spinner("Chargement regions..."):
            geo_reg = charger_geojson_admin("regions")

        if geo_reg["features"]:
            nom_field = "_nom" if "_nom" in geo_reg["features"][0].get("properties", {}) else "NOM"
            folium.GeoJson(
                geo_reg, name="Regions",
                style_function=lambda f: {"color": "#2471a3", "weight": 2,
                                           "fillColor": "#aed6f1", "fillOpacity": 0.15},
                tooltip=folium.GeoJsonTooltip(fields=[nom_field], aliases=["Region :"])
            ).add_to(m)

        if afficher_dep:
            with st.spinner("Departements..."):
                geo_dep = charger_geojson_admin("departements")
            folium.GeoJson(
                geo_dep, name="Departements",
                style_function=lambda f: {"color": "#1a5276", "weight": 1.2, "fillOpacity": 0.05}
            ).add_to(m)

        if afficher_arr:
            with st.spinner("Arrondissements..."):
                geo_arr = charger_geojson_admin("arrondissements")
            folium.GeoJson(
                geo_arr, name="Arrondissements",
                style_function=lambda f: {"color": "#117a65", "weight": 1, "fillOpacity": 0.05}
            ).add_to(m)

        for couche in couches_sel:
            with st.spinner(f"Couche {couche}..."):
                geo_c = charger_couche_thematique(couche)
            if geo_c.get("features"):
                folium.GeoJson(
                    geo_c, name=LABELS.get(couche, couche),
                    style_function=lambda f, c=couche: {
                        "color": COULEURS.get(c, "#666"), "weight": 1.5, "fillOpacity": 0.3
                    }
                ).add_to(m)

        folium.LayerControl().add_to(m)
        st_folium(m, width=None, height=620, returned_objects=[])

# ── MODULE 2 : Statistiques ───────────────────────────────────────────────────
elif module == "\U0001f4ca Statistiques":
    st.header("Statistiques administratives")
    with st.spinner("Chargement..."):
        geo_reg = charger_geojson_admin("regions")
        geo_dep = charger_geojson_admin("departements")
        geo_arr = charger_geojson_admin("arrondissements")
        geo_com = charger_geojson_admin("communes")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Regions",          len(geo_reg.get("features", [])))
    c2.metric("Departements",     len(geo_dep.get("features", [])))
    c3.metric("Arrondissements",  len(geo_arr.get("features", [])))
    c4.metric("Communes",         len(geo_com.get("features", [])))
    cat = charger_catalogue()
    if cat:
        st.subheader("Catalogue des couches")
        df = pd.DataFrame(cat)
        cols = [c for c in ["id", "description", "disponible"] if c in df.columns]
        st.dataframe(df[cols], use_container_width=True)

# ── MODULE 3 : Export ─────────────────────────────────────────────────────────
elif module == "\U0001f4e4 Export donnees":
    st.header("Export GeoJSON")
    niveau = st.selectbox("Niveau administratif",
        ["regions", "departements", "arrondissements", "communes"])
    if st.button("Telecharger GeoJSON"):
        with st.spinner("Preparation..."):
            data = charger_geojson_admin(niveau)
        st.download_button(
            label=f"Enregistrer senegal_{niveau}.geojson",
            data=json.dumps(data, ensure_ascii=False, indent=2),
            file_name=f"senegal_{niveau}.geojson",
            mime="application/geo+json"
        )
        st.success(f"{len(data['features'])} entites pretes")

# ── MODULE 4 : Doc API ────────────────────────────────────────────────────────
elif module == "\U0001f517 API Documentation":
    st.header("Documentation API Flask")
    st.markdown(f"""
**Base URL** : `{API}`

| Endpoint | Description |
|---|---|
| `GET /api/couches/admin/regions` | GeoJSON 14 regions |
| `GET /api/couches/admin/departements` | GeoJSON 45 departements |
| `GET /api/couches/admin/arrondissements` | GeoJSON arrondissements |
| `GET /api/couches/admin/communes` | GeoJSON 557 communes |
| `GET /api/couches/thematique/{{couche}}` | Routes, cours d'eau, etc. |
| `GET /api/couches/catalogue` | Liste couches disponibles |
| `GET /health` | Statut serveur |

**Exemple curl :**
```bash
curl {API}/api/couches/admin/regions | python3 -m json.tool
```
    """)
