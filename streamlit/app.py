"""
Carto-facileSN — Interface experts Streamlit
Connectée 100% à l'API Flask, jamais aux SHPs directement.
Déploiement : Streamlit Cloud (streamlit.io/cloud)
"""
import streamlit as st
import requests
import folium
from streamlit_folium import st_folium
import pandas as pd
import json

st.set_page_config(
    page_title="Carto-facileSN Experts",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="expanded"
)

API = st.secrets.get("API_URL", "https://carto-facilesn.onrender.com")


@st.cache_data(ttl=3600, show_spinner=False)
def charger_geojson_admin(niveau: str) -> dict:
    r = requests.get(f"{API}/api/couches/admin/{niveau}", timeout=60)
    r.raise_for_status()
    return r.json()


@st.cache_data(ttl=3600, show_spinner=False)
def charger_couche_thematique(couche: str) -> dict:
    r = requests.get(f"{API}/api/couches/thematique/{couche}", timeout=60)
    r.raise_for_status()
    return r.json()


@st.cache_data(ttl=3600, show_spinner=False)
def charger_catalogue() -> list:
    r = requests.get(f"{API}/api/couches/catalogue", timeout=30)
    return r.json() if r.ok else []


# ── Sidebar ─────────────────────────────────────────────────────────────
st.sidebar.title("🗺️ Carto-facileSN")
st.sidebar.caption("Interface Experts & Analyse")

module = st.sidebar.radio("Module", [
    "🗺️ Carte interactive",
    "📊 Statistiques",
    "📤 Export données",
    "🔗 API Documentation",
])

COULEURS = {
    "routes": "#888888", "cours_eau": "#3498db", "localites": "#c0392b",
    "aeroports": "#2c3e50", "aires_protegees": "#1e8449", "plans_eau": "#85c1e9",
    "chemin_fer": "#444444", "points_eau": "#2980b9", "agglomerations": "#e67e22",
    "surfaces_boisees": "#27ae60", "sable": "#f0e68c", "courbes_niveau": "#b7950b",
}

LABELS = {
    "routes": "🛣️ Routes", "cours_eau": "💧 Cours d'eau",
    "localites": "🏘️ Localités", "aeroports": "✈️ Aéroports",
    "aires_protegees": "🌿 Aires protégées", "plans_eau": "🌊 Plans d'eau",
    "chemin_fer": "🚂 Chemin de fer", "points_eau": "🚰 Points d'eau",
    "agglomerations": "🏙️ Agglomérations", "surfaces_boisees": "🌲 Forêts",
}


# ── MODULE 1 : Carte interactive ──────────────────────────────────────────
if module == "🗺️ Carte interactive":
    st.header("Carte du Sénégal")
    col1, col2 = st.columns([1, 3])

    with col1:
        st.subheader("Options")
        catalogue = charger_catalogue()
        couches_dispo = [c["id"] for c in catalogue] if catalogue else list(COULEURS.keys())
        couches_sel = st.multiselect(
            "Couches thématiques",
            options=couches_dispo,
            default=["routes", "cours_eau"],
            format_func=lambda x: LABELS.get(x, x)
        )
        afficher_departements  = st.checkbox("Départements",   value=True)
        afficher_arrondissements = st.checkbox("Arrondissements", value=False)
        fond = st.selectbox("Fond de carte", [
            "OpenStreetMap", "Satellite (Esri)", "CartoDB Positron"
        ])

    with col2:
        m = folium.Map(location=[14.4, -14.4], zoom_start=7, control_scale=True)

        FONDS = {
            "OpenStreetMap": ("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", "© OpenStreetMap"),
            "Satellite (Esri)": (
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                "© Esri"),
            "CartoDB Positron": (
                "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
                "© CartoDB"),
        }
        url, attr = FONDS[fond]
        folium.TileLayer(url, attr=attr).add_to(m)

        with st.spinner("Chargement régions..."):
            geo_reg = charger_geojson_admin("regions")

        nom_field = "_nom" if geo_reg["features"] and "_nom" in geo_reg["features"][0].get("properties", {}) else "NOM"
        folium.GeoJson(
            geo_reg, name="Régions",
            style_function=lambda f: {"color": "#2471a3", "weight": 2, "fillColor": "#aed6f1", "fillOpacity": 0.15},
            tooltip=folium.GeoJsonTooltip(fields=[nom_field], aliases=["Région :"])
        ).add_to(m)

        if afficher_departements:
            with st.spinner("Départements..."):
                geo_dep = charger_geojson_admin("departements")
            folium.GeoJson(
                geo_dep, name="Départements",
                style_function=lambda f: {"color": "#1a5276", "weight": 1.2, "fillOpacity": 0.05}
            ).add_to(m)

        if afficher_arrondissements:
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


# ── MODULE 2 : Statistiques ───────────────────────────────────────────────
elif module == "📊 Statistiques":
    st.header("Statistiques administratives")
    with st.spinner("Chargement..."):
        geo_reg = charger_geojson_admin("regions")
        geo_dep = charger_geojson_admin("departements")
        geo_arr = charger_geojson_admin("arrondissements")
        geo_com = charger_geojson_admin("communes")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("🌍 Régions",          len(geo_reg.get("features", [])))
    col2.metric("📍 Départements",    len(geo_dep.get("features", [])))
    col3.metric("🏘️ Arrondissements",len(geo_arr.get("features", [])))
    col4.metric("🏡 Communes",         len(geo_com.get("features", [])))
    st.subheader("Catalogue des couches")
    cat = charger_catalogue()
    if cat:
        df = pd.DataFrame(cat)
        st.dataframe(
            df[["id", "description", "disponible"]].rename(columns={
                "id": "Identifiant", "description": "Description", "disponible": "Disponible"
            }),
            use_container_width=True
        )


# ── MODULE 3 : Export ─────────────────────────────────────────────────────
elif module == "📤 Export données":
    st.header("Export GeoJSON")
    st.info("Téléchargez les couches directement depuis l'API Flask.")
    niveau = st.selectbox("Niveau administratif",
        ["regions", "departements", "arrondissements", "communes"])
    if st.button("📥 Télécharger GeoJSON"):
        with st.spinner("Préparation..."):
            data = charger_geojson_admin(niveau)
        st.download_button(
            label=f"💾 Enregistrer senegal_{niveau}.geojson",
            data=json.dumps(data, ensure_ascii=False, indent=2),
            file_name=f"senegal_{niveau}.geojson",
            mime="application/geo+json"
        )
        st.success(f"✓ {len(data['features'])} entités prêtes")


# ── MODULE 4 : Doc API ───────────────────────────────────────────────────
elif module == "🔗 API Documentation":
    st.header("Documentation API Flask")
    st.markdown(f"""
**Base URL** : `{API}`

| Endpoint | Description |
|---|---|
| `GET /api/couches/admin/regions` | GeoJSON 14 régions |
| `GET /api/couches/admin/departements` | GeoJSON 45 départements |
| `GET /api/couches/admin/arrondissements` | GeoJSON arrondissements |
| `GET /api/couches/admin/communes` | GeoJSON 557 communes |
| `GET /api/couches/thematique/{{couche}}` | Routes, cours d'eau, etc. |
| `GET /api/couches/catalogue` | Liste couches disponibles |
| `GET /api/communes/regions` | Liste régions (texte) |
| `GET /health` | Statut serveur |

**Exemple curl :**
```bash
curl {API}/api/couches/admin/regions | python3 -m json.tool
```
    """)
