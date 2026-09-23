import os
import sys
import sqlite3
import subprocess
import json
import streamlit as st
import pandas as pd
import folium
from streamlit_folium import st_folium
import streamlit.components.v1 as components

# 匯入即時天氣特報、極端觀測值、全台 360+ 測站、空品與颱風服務
from weather_services import (
    fetch_weather_alerts,
    fetch_extreme_observations,
    fetch_all_stations,
    fetch_typhoon_data,
    fetch_air_quality,
    get_aqi_details,
    REGION_COORDS,
    CWA_API_KEY
)

# 設定頁面配置 (全景大背景一頁式戰情室)
st.set_page_config(
    page_title="Mini Taiwan Pulse 台灣全景氣象戰情室",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

DB_PATH = "data.db"

# 注入 Cyberpunk / Glassmorphic 極致時尚全景戰情室 CSS
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;600;700&family=Syne:wght@700;800&display=swap');

    /* 全局背景：深黑科技霓虹氛圍 */
    .stApp {
        background-color: #060913 !important;
        background-image: 
            radial-gradient(at 10% 10%, rgba(14, 165, 233, 0.1) 0px, transparent 50%),
            radial-gradient(at 90% 90%, rgba(99, 102, 241, 0.08) 0px, transparent 50%),
            radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.75) 0px, transparent 100%);
        color: #f1f5f9 !important;
        font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    }
    .block-container {
        padding-top: 0.8rem !important;
        padding-bottom: 0.8rem !important;
        padding-left: 1.2rem !important;
        padding-right: 1.2rem !important;
        max-width: 100% !important;
    }

    /* 頂部極致 Cyber HUD 狀態列 */
    .hud-bar {
        background: linear-gradient(90deg, rgba(13, 17, 23, 0.95) 0%, rgba(10, 14, 26, 0.92) 100%);
        border: 1px solid rgba(56, 189, 248, 0.28);
        border-radius: 14px;
        padding: 8px 18px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 25px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(56, 189, 248, 0.05);
    }
    .hud-brand {
        font-family: 'Syne', 'Space Grotesk', sans-serif;
        font-size: 1.25rem;
        font-weight: 800;
        background: linear-gradient(135deg, #ffffff 20%, #38bdf8 70%, #818cf8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: -0.3px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .pulse-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #38bdf8;
        box-shadow: 0 0 10px #38bdf8;
        display: inline-block;
        animation: radar-pulse 2s infinite;
    }
    @keyframes radar-pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.7); }
        70% { transform: scale(1.3); box-shadow: 0 0 0 8px rgba(56, 189, 248, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
    }

    /* 頂部特報小晶片 */
    .hud-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        font-family: 'Space Grotesk', sans-serif;
    }
    .hud-chip-alert {
        background: rgba(244, 63, 94, 0.18);
        border: 1px solid rgba(244, 63, 94, 0.5);
        color: #fda4af;
        box-shadow: 0 0 12px rgba(244, 63, 94, 0.2);
    }
    .hud-chip-safe {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.35);
        color: #6ee7b7;
    }

    /* 極值微型膠囊群 */
    .hud-metrics {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    .hud-metric-pill {
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(56, 189, 248, 0.2);
        border-radius: 8px;
        padding: 3px 10px;
        display: flex;
        align-items: baseline;
        gap: 5px;
        font-size: 0.74rem;
        color: #94a3b8;
    }
    .hud-metric-pill b {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.88rem;
    }

    /* 動態浮動科技導航列 (Cyber Dock) */
    .dock-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        gap: 12px;
    }

    /* 浮動動態選單 Popover 玻璃彈窗 (時尚毛玻璃質感) */
    div[data-testid="stPopoverBody"] {
        background: rgba(10, 14, 24, 0.96) !important;
        border: 1px solid rgba(56, 189, 248, 0.4) !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(6, 182, 212, 0.15) !important;
        backdrop-filter: blur(24px) !important;
        padding: 18px 22px !important;
        max-width: 600px !important;
    }
    div[data-testid="stPopover"] > button {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(13, 17, 23, 0.95) 100%) !important;
        border: 1px solid rgba(56, 189, 248, 0.3) !important;
        color: #f1f5f9 !important;
        font-family: 'Space Grotesk', sans-serif !important;
        font-weight: 700 !important;
        font-size: 0.84rem !important;
        border-radius: 10px !important;
        padding: 6px 14px !important;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4) !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    div[data-testid="stPopover"] > button:hover {
        border-color: #38bdf8 !important;
        box-shadow: 0 0 20px rgba(56, 189, 248, 0.4) !important;
        transform: translateY(-2px) !important;
        color: #38bdf8 !important;
    }

    /* Segmented Control 滿版科技切換器 */
    div[data-testid="stSegmentedControl"] {
        background-color: #0b111a !important;
        border-radius: 10px !important;
        padding: 3px !important;
        border: 1px solid rgba(56, 189, 248, 0.25) !important;
    }
    div[data-testid="stSegmentedControl"] button {
        font-family: 'Space Grotesk', sans-serif !important;
        font-size: 0.84rem !important;
        font-weight: 700 !important;
        border-radius: 7px !important;
        padding: 5px 12px !important;
    }

    /* 氣象卡片與指標 */
    .metric-card-box {
        background: rgba(13, 17, 23, 0.9);
        border: 1px solid rgba(56, 189, 248, 0.2);
        border-radius: 10px;
        padding: 10px 12px;
        text-align: center;
    }
    .metric-card-box .label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 0.72rem;
        font-weight: 600;
        color: #7dd3fc;
    }
    .metric-card-box .val {
        font-family: 'JetBrains Mono', monospace;
        font-size: 1.45rem;
        font-weight: 700;
    }

    /* 底部懸浮圖例 */
    .floating-legend-dock {
        background: rgba(13, 17, 23, 0.92);
        border: 1px solid rgba(56, 189, 248, 0.2);
        border-radius: 10px;
        padding: 6px 14px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 14px;
        margin-top: 8px;
        font-size: 0.76rem;
        font-family: 'Space Grotesk', sans-serif;
    }
    .floating-legend-dock .badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: #cbd5e1;
    }
    .floating-legend-dock .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        box-shadow: 0 0 6px currentColor;
    }
</style>
""", unsafe_allow_html=True)

# 載入所有資料庫與服務
df = None
try:
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("SELECT regionName, dataDate, mint, maxt FROM TemperatureForecasts ORDER BY dataDate ASC", conn)
    conn.close()
except Exception:
    df = pd.DataFrame()

if df.empty:
    with st.spinner("⚡ 首次啟動：正在初始化中央氣象署資料庫..."):
        subprocess.run([sys.executable, "etl_weather.py"], capture_output=True, text=True)
        st.cache_data.clear()
        conn = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query("SELECT regionName, dataDate, mint, maxt FROM TemperatureForecasts ORDER BY dataDate ASC", conn)
        conn.close()

# 側邊欄：環境部 MOENV 金鑰設定
with st.sidebar:
    st.markdown("### ⚙️ 氣候與空品監測核心")
    st.caption("CWA 氣象署 API ｜ MOENV 環境部開放資料 ｜ Open-Meteo 全球大氣")
    st.markdown("---")
    user_moenv_key = st.text_input(
        "MOENV API Key (選填)",
        value=os.getenv("MOENV_API_KEY", ""),
        type="password",
        help="臺灣環境部開放資料平台 (data.moenv.gov.tw) 提供的 API 金鑰。留空時自動使用 Open-Meteo 免 Key 即時空品通道。"
    )
    if not user_moenv_key:
        st.info("💡 **目前使用 Open-Meteo 全球即時空氣品質通道**（全台秒級自動連線，免 API Key 即可開箱即用）。若欲串接環境部 84 個官方測站，可至 [環境部開放資料平台](https://data.moenv.gov.tw/) 免費申辦金鑰。")
    else:
        st.success("✨ 已啟用環境部 MOENV 官方測站優先連線通道！")
        
    st.markdown("---")
    if st.button("🔄 強制重新整理所有氣象與空品數據", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

# 擷取即時特報、極值、測站、颱風與空品
alerts_data = fetch_weather_alerts(CWA_API_KEY)
extremes = fetch_extreme_observations(CWA_API_KEY)
all_stations = fetch_all_stations(CWA_API_KEY)
typhoon_info = fetch_typhoon_data(CWA_API_KEY)
aqi_dict = fetch_air_quality(user_moenv_key)

# ----------------- 頂部 HUD 狀態列 (極致科技感) -----------------
hud_col1, hud_col2, hud_col3 = st.columns([4, 4, 4])
with hud_col1:
    st.markdown("""
    <div style="display:flex; align-items:center; gap:10px; height:100%;">
        <span class="pulse-dot"></span>
        <span class="hud-brand">⚡ TAIWAN PULSE // 全景氣候戰情空間</span>
    </div>
    """, unsafe_allow_html=True)

with hud_col2:
    if alerts_data:
        first_alert = list(alerts_data.items())[0]
        alert_title = first_alert[0]
        alert_locs = "、".join(first_alert[1]["locations"][:3])
        st.markdown(f"""
        <div style="display:flex; justify-content:center; align-items:center; height:100%;">
            <span class="hud-chip hud-chip-alert">
                🚨 {alert_title} ｜ 警戒：{alert_locs}
            </span>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown("""
        <div style="display:flex; justify-content:center; align-items:center; height:100%;">
            <span class="hud-chip hud-chip-safe">
                🟢 全台天候平穩 ｜ 無災害性特報
            </span>
        </div>
        """, unsafe_allow_html=True)

with hud_col3:
    st.markdown(f"""
    <div style="display:flex; justify-content:flex-end; align-items:center; gap:6px; height:100%;">
        <div class="hud-metric-pill">🔥 <b style="color:#f43f5e;">{extremes['max_temp'][0]:.1f}°</b> {extremes['max_temp'][1].split()[-1]}</div>
        <div class="hud-metric-pill">❄️ <b style="color:#38bdf8;">{extremes['min_temp'][0]:.1f}°</b> {extremes['min_temp'][1].split()[-1]}</div>
        <div class="hud-metric-pill">🌧️ <b style="color:#818cf8;">{extremes['max_rain'][0]:.1f}mm</b></div>
        <div class="hud-metric-pill">💨 <b style="color:#f59e0b;">{extremes['max_wind'][0]:.1f}m/s</b></div>
    </div>
    """, unsafe_allow_html=True)

# ----------------- 浮動科技控制導航列 (Cyber Dock + 動態彈出選單) -----------------
dock_col_mode, dock_col_menus = st.columns([5, 5])

with dock_col_mode:
    # 頂部四合一圖層切換
    map_layer = st.segmented_control(
        "圖層模式",
        options=[
            "🌡️ 全台即時氣溫 (360+測站)",
            "🌀 颱風路徑與暴風圈預測",
            "🫧 空氣品質 AQI",
            "⚡ Mini Taiwan Pulse 全層"
        ],
        default="🌡️ 全台即時氣溫 (360+測站)",
        label_visibility="collapsed",
        key="grand_map_layer"
    )
    if not map_layer:
        map_layer = "🌡️ 全台即時氣溫 (360+測站)"

with dock_col_menus:
    # 四大動態彈出面板 (Popovers) - 帥氣又時尚的懸浮毛玻璃抽屜！
    m_col1, m_col2, m_col3, m_col4 = st.columns(4)

    # 1. 📊 一週預報與趨勢折線圖 (動態彈出面板)
    with m_col1:
        with st.popover("一週預報", icon="📊", use_container_width=True):
            st.markdown("#### 📊 一週氣候預報與雙軌趨勢")
            available_regions = sorted(df["regionName"].unique()) if not df.empty else ["北部地區"]
            sel_reg = st.selectbox("選擇查詢分區：", options=available_regions, index=0, key="popover_region")
            reg_df = df[df["regionName"] == sel_reg].sort_values("dataDate").reset_index(drop=True)
            
            if not reg_df.empty:
                r_min = reg_df["mint"].min()
                r_max = reg_df["maxt"].max()
                r_avg = ((reg_df["mint"] + reg_df["maxt"]) / 2.0).mean()
                r_diff = (reg_df["maxt"] - reg_df["mint"]).max()
                
                c1, c2, c3, c4 = st.columns(4)
                with c1:
                    st.markdown(f"""<div class="metric-card-box"><div class="label">❄️ 本週最低</div><div class="val" style="color:#38bdf8;">{r_min}°</div></div>""", unsafe_allow_html=True)
                with c2:
                    st.markdown(f"""<div class="metric-card-box"><div class="label">🔥 本週最高</div><div class="val" style="color:#f43f5e;">{r_max}°</div></div>""", unsafe_allow_html=True)
                with c3:
                    st.markdown(f"""<div class="metric-card-box"><div class="label">🌡️ 一週均溫</div><div class="val" style="color:#a78bfa;">{r_avg:.1f}°</div></div>""", unsafe_allow_html=True)
                with c4:
                    st.markdown(f"""<div class="metric-card-box"><div class="label">↔️ 最大溫差</div><div class="val" style="color:#f59e0b;">{r_diff:.1f}°</div></div>""", unsafe_allow_html=True)
                
                st.markdown("<div style='height: 8px;'></div>", unsafe_allow_html=True)
                st.markdown("##### 📈 最低溫 vs 最高溫雙軌折線圖")
                c_data = reg_df.set_index("dataDate")[["mint", "maxt"]]
                c_data.columns = ["最低氣溫 (MinT)", "最高氣溫 (MaxT)"]
                st.line_chart(c_data, height=220, color=["#38bdf8", "#f43f5e"])
                
                st.markdown("##### 📋 詳細氣溫數據表")
                t_show = reg_df[["dataDate", "mint", "maxt"]].copy()
                t_show["平均氣溫 (°C)"] = ((t_show["mint"] + t_show["maxt"]) / 2.0).round(1)
                t_show.columns = ["預報日期", "最低氣溫", "最高氣溫", "平均氣溫"]
                st.dataframe(t_show, use_container_width=True, hide_index=True)

    # 2. 🌀 颱風情報與預報時程 (動態彈出面板)
    with m_col2:
        with st.popover("颱風情報", icon="🌀", use_container_width=True):
            st.markdown(f"#### 🌀 {typhoon_info['name']}")
            st.info("熱帶氣旋持續監測中。外圍雲系將可能接近臺灣東部與海域，請留意風浪動態與氣象署最新警報。")
            if typhoon_info.get("latest"):
                lat_p = typhoon_info["latest"]
                tc1, tc2, tc3 = st.columns(3)
                with tc1:
                    st.markdown(f"""<div class="metric-card-box"><div class="label">目前位置</div><div class="val" style="font-size:1.1rem; color:#38bdf8;">{lat_p['lat']}°N, {lat_p['lon']}°E</div></div>""", unsafe_allow_html=True)
                with tc2:
                    st.markdown(f"""<div class="metric-card-box"><div class="label">最大風速</div><div class="val" style="font-size:1.1rem; color:#f43f5e;">{lat_p['max_wind']} m/s</div></div>""", unsafe_allow_html=True)
                with tc3:
                    st.markdown(f"""<div class="metric-card-box"><div class="label">中心氣壓</div><div class="val" style="font-size:1.1rem; color:#f59e0b;">{lat_p['pressure']} hPa</div></div>""", unsafe_allow_html=True)
            
            st.markdown("##### ⏱️ 未來 120 小時預報路徑時間表")
            tf_data = []
            for f in typhoon_info["forecast_points"]:
                tf_data.append({
                    "時效": f"+{f['hour']}h",
                    "時間": f["time"][:16],
                    "緯度/經度": f"{f['lat']}°N / {f['lon']}°E",
                    "氣壓": f"{f['pressure']} hPa",
                    "風速": f"{f['max_wind']} m/s",
                    "7級風半徑": f"{f['gale_radius_km']} km"
                })
            st.dataframe(pd.DataFrame(tf_data), use_container_width=True, hide_index=True)

    # 3. 🫧 空氣品質與健康防護 (動態彈出面板)
    with m_col3:
        with st.popover("空氣品質", icon="🫧", use_container_width=True):
            st.markdown("#### 🫧 全台即時空氣品質指標 (AQI)")
            aq_table = []
            for r_name in REGION_COORDS.keys():
                aq_d = aqi_dict.get(r_name, {"aqi": 50, "pm25": 10.0, "pm10": 18.0, "source": "系統預報"})
                det = get_aqi_details(aq_d["aqi"])
                aq_table.append({
                    "分區": r_name,
                    "AQI": aq_d["aqi"],
                    "狀態評級": det["status"],
                    "PM2.5": aq_d["pm25"],
                    "PM10": aq_d["pm10"],
                    "健康建議": det["advice"]
                })
            st.dataframe(pd.DataFrame(aq_table), use_container_width=True, hide_index=True)
            st.info("💡 綠色良好 (0-50) 適合戶外運動；橘色敏感警示 (101-150) 孩童長輩應減少劇烈運動；紅色不健康 (151-200) 外出請佩戴防護口罩。")

    # 4. 📍 全台 360+ 測站即時觀測列表 (動態彈出面板)
    with m_col4:
        with st.popover("測站列表", icon="📍", use_container_width=True):
            st.markdown(f"#### 📍 全台 360+ 氣象測站即時列表 ({len(all_stations)} 站)")
            kw = st.text_input("🔍 搜尋縣市或測站：", placeholder="例如：臺南、玉山、板橋...", key="popover_st_kw")
            st_view = []
            for s in all_stations:
                if not kw or (kw in s["county"] or kw in s["name"] or kw in s["town"]):
                    st_view.append({
                        "縣市": s["county"],
                        "測站": s["name"],
                        "氣溫": f"{s['temp']}°C" if s['temp'] is not None else "-",
                        "濕度": f"{s['humid']}%" if s['humid'] is not None else "-",
                        "風速": f"{s['wind']} m/s" if s['wind'] is not None else "-",
                        "雨量": f"{s['rain']} mm"
                    })
            st.dataframe(pd.DataFrame(st_view), use_container_width=True, hide_index=True)

# 共用 Leaflet 消除留白 CSS
popup_css = """
<style>
    .leaflet-popup-content-wrapper {
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        border-radius: 12px !important;
    }
    .leaflet-popup-content {
        margin: 0 !important;
        line-height: normal !important;
    }
    .leaflet-popup-tip-container {
        display: none !important;
    }
    .leaflet-container a.leaflet-popup-close-button {
        color: #94a3b8 !important;
        padding: 6px 8px 0 0 !important;
        font-size: 15px !important;
        z-index: 1000 !important;
    }
    .leaflet-container a.leaflet-popup-close-button:hover {
        color: #38bdf8 !important;
    }
</style>
"""

# =========================================================
# 台灣全景大畫布 (Grand Full-Screen Background Map)
# =========================================================
if map_layer == "🌡️ 全台即時氣溫 (360+測站)":
    # 頂部密度切換選項
    opt_col1, opt_col2 = st.columns([8, 2])
    with opt_col1:
        st.caption(f"✨ 全島即時氣象觀測網：當前連線 **{len(all_stations)}** 個全台自動氣象站點，即時呈現實時溫度分布：")
    with opt_col2:
        density_choice = st.radio(
            "測站密度",
            ["全台 360+ 自動觀測網", "22 縣市核心代表站"],
            horizontal=True,
            label_visibility="collapsed",
            key="grand_density"
        )

    if density_choice == "22 縣市核心代表站":
        seen = {}
        target_stations = []
        for s in all_stations:
            c = s["county"]
            if seen.get(c, 0) < 1:
                target_stations.append(s)
                seen[c] = seen.get(c, 0) + 1
    else:
        target_stations = all_stations

    m_grand = folium.Map(
        location=[23.75, 120.95],
        zoom_start=7.3,
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        attr="Esri World Dark Gray",
        control_scale=True
    )
    m_grand.get_root().header.add_child(folium.Element(popup_css))
    
    folium.TileLayer(
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        attr="Esri",
        name="地名標籤",
        overlay=True
    ).add_to(m_grand)

    # 疊加內政部官方台灣縣市界線
    try:
        with open("taiwan_topo.json", "r", encoding="utf-8") as f:
            topo_data = json.load(f)
        folium.TopoJson(
            topo_data,
            "objects.COUNTY_MOI_1090820",
            style_function=lambda feature: {"fillColor": "transparent", "color": "#38bdf8", "weight": 1.4, "opacity": 0.85}
        ).add_to(m_grand)
    except Exception:
        pass

    # 標註全台密布測站
    for st_item in target_stations:
        t = st_item["temp"]
        if t is not None:
            if t < 20: c_hex = "#38bdf8"
            elif 20 <= t < 25: c_hex = "#10b981"
            elif 25 <= t <= 30: c_hex = "#f59e0b"
            else: c_hex = "#f43f5e"
            t_str = f"{t:.1f}°C"
        else:
            c_hex = "#64748b"
            t_str = "維護中"

        h_str = f"{st_item['humid']}%" if st_item['humid'] is not None else "-"
        w_str = f"{st_item['wind']} m/s" if st_item['wind'] is not None else "-"
        r_str = f"{st_item['rain']} mm"

        p_html = f"""
        <div style="font-family:'Space Grotesk',Arial,sans-serif; min-width:170px; padding:12px 14px; background:#0f172a; color:#f1f5f9; border-radius:10px; border:1px solid {c_hex}; box-shadow:0 8px 25px rgba(0,0,0,0.85);">
            <div style="font-size:15px; font-weight:700; color:#38bdf8; border-bottom:1px solid {c_hex}; padding-bottom:4px; margin-bottom:5px;">
                {st_item['county']} ｜ {st_item['name']}
            </div>
            <div style="font-size:12px; line-height:1.75; font-family:'JetBrains Mono',monospace;">
                <b>即時氣溫:</b> <span style="color:{c_hex}; font-weight:bold; font-size:14px;">{t_str}</span><br>
                <b>相對濕度:</b> <span style="color:#7dd3fc;">{h_str}</span><br>
                <b>即時風速:</b> <span style="color:#f59e0b;">{w_str}</span><br>
                <b>累積雨量:</b> <span style="color:#818cf8;">{r_str}</span>
            </div>
            <div style="font-size:10px; color:#64748b; margin-top:5px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:3px;">
                站號: {st_item['id']} ｜ {st_item['town']}
            </div>
        </div>
        """

        folium.CircleMarker(
            location=[st_item["lat"], st_item["lon"]],
            radius=6 if density_choice == "全台 360+ 自動觀測網" else 10,
            color=c_hex,
            fill=True,
            fill_color=c_hex,
            fill_opacity=0.88,
            weight=1,
            popup=folium.Popup(p_html, max_width=290),
            tooltip=f"📍 {st_item['county']} {st_item['name']}：{t_str} ｜ 雨量: {r_str}"
        ).add_to(m_grand)

    st_folium(m_grand, width="100%", height=660, returned_objects=[])

    st.markdown(f"""
    <div class="floating-legend-dock">
        <span class="badge"><span class="dot" style="background:#38bdf8; color:#38bdf8;"></span> 寒冷 (&lt;20°C)</span>
        <span class="badge"><span class="dot" style="background:#10b981; color:#10b981;"></span> 舒適 (20-25°C)</span>
        <span class="badge"><span class="dot" style="background:#f59e0b; color:#f59e0b;"></span> 溫暖 (25-30°C)</span>
        <span class="badge"><span class="dot" style="background:#f43f5e; color:#f43f5e;"></span> 炎熱 (&gt;30°C)</span>
        <span style="color:#64748b; margin-left: 14px;">📍 全臺連線測站數：{len(all_stations)} 站</span>
    </div>
    """, unsafe_allow_html=True)

elif map_layer == "🌀 颱風路徑與暴風圈預測":
    st.caption(f"✨ 颱風監控中心：**{typhoon_info['name']}** 動態路徑追蹤與未來 120 小時潛勢暴風圈範圍：")

    # 視角涵蓋臺灣與西北太平洋洋面
    m_ty = folium.Map(
        location=[21.0, 128.5],
        zoom_start=5.2,
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        attr="Esri World Dark Gray",
        control_scale=True
    )
    m_ty.get_root().header.add_child(folium.Element(popup_css))
    
    folium.TileLayer(
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        attr="Esri",
        name="地名標籤",
        overlay=True
    ).add_to(m_ty)

    # 縣市界線
    try:
        with open("taiwan_topo.json", "r", encoding="utf-8") as f:
            topo_data = json.load(f)
        folium.TopoJson(
            topo_data,
            "objects.COUNTY_MOI_1090820",
            style_function=lambda feature: {"fillColor": "transparent", "color": "#38bdf8", "weight": 1.4, "opacity": 0.85}
        ).add_to(m_ty)
    except Exception:
        pass

    # 歷史軌跡線 (Past track)
    past_coords = [[p["lat"], p["lon"]] for p in typhoon_info["past_points"]]
    if len(past_coords) > 1:
        folium.PolyLine(past_coords, color="#94a3b8", weight=2.5, dash_array="5, 5", tooltip="過去歷史移動軌跡").add_to(m_ty)

    for p in typhoon_info["past_points"]:
        folium.CircleMarker(
            location=[p["lat"], p["lon"]],
            radius=4,
            color="#94a3b8",
            fill=True,
            fill_color="#64748b",
            tooltip=f"歷史分析: {p['time']} ｜ 氣壓 {p['pressure']}hPa ｜ 風速 {p['max_wind']}m/s"
        ).add_to(m_ty)

    # 未來 120 小時預測路徑線 (Forecast track)
    forecast_coords = []
    if typhoon_info.get("latest"):
        forecast_coords.append([typhoon_info["latest"]["lat"], typhoon_info["latest"]["lon"]])
    for f in typhoon_info["forecast_points"]:
        forecast_coords.append([f["lat"], f["lon"]])

    if len(forecast_coords) > 1:
        folium.PolyLine(forecast_coords, color="#f43f5e", weight=3.8, tooltip="CWA 未來 120 小時預測路徑").add_to(m_ty)

    # 暴風圈半徑與 70% 潛勢圓
    for f in typhoon_info["forecast_points"]:
        if f["prob_radius_km"] > 0:
            folium.Circle(
                location=[f["lat"], f["lon"]],
                radius=f["prob_radius_km"] * 1000,
                color="#f59e0b",
                fill=True,
                fill_color="#f59e0b",
                fill_opacity=0.08,
                weight=1,
                dash_array="5, 5"
            ).add_to(m_ty)

        if f["gale_radius_km"] > 0:
            folium.Circle(
                location=[f["lat"], f["lon"]],
                radius=f["gale_radius_km"] * 1000,
                color="#f43f5e",
                fill=True,
                fill_color="#f43f5e",
                fill_opacity=0.18,
                weight=1.2
            ).add_to(m_ty)

        p_ty_html = f"""
        <div style="font-family:'Space Grotesk',Arial,sans-serif; min-width:170px; padding:12px 14px; background:#0f172a; color:#f1f5f9; border-radius:10px; border:1px solid #f43f5e; box-shadow:0 8px 25px rgba(244,63,94,0.35);">
            <div style="color:#f43f5e; font-size:15px; font-weight:700; border-bottom:1px solid rgba(244,63,94,0.4); padding-bottom:4px; margin-bottom:5px;">
                🌀 預測時程：+{f['hour']} 小時
            </div>
            <div style="font-size:12px; line-height:1.75; font-family:'JetBrains Mono',monospace;">
                <b>預報時間:</b> {f['time'][:16]}<br>
                <b>中心位置:</b> {f['lat']}°N, {f['lon']}°E<br>
                <b>中心氣壓:</b> <span style="color:#38bdf8;">{f['pressure']} hPa</span><br>
                <b>最大風速:</b> <span style="color:#f43f5e; font-weight:bold;">{f['max_wind']} m/s</span><br>
                <b>移動速度:</b> {f['speed']} km/h ({f['dir']})<br>
                <b>7級風半徑:</b> {f['gale_radius_km']} km
            </div>
        </div>
        """

        folium.CircleMarker(
            location=[f["lat"], f["lon"]],
            radius=6,
            color="#f43f5e",
            fill=True,
            fill_color="#ffffff",
            weight=2,
            popup=folium.Popup(p_ty_html, max_width=300),
            tooltip=f"🌀 預測 +{f['hour']}h：中心氣壓 {f['pressure']}hPa ｜ 風速 {f['max_wind']}m/s"
        ).add_to(m_ty)

    # 標註颱風眼中心
    latest = typhoon_info.get("latest")
    if latest:
        folium.Marker(
            location=[latest["lat"], latest["lon"]],
            icon=folium.DivIcon(
                html="""<div style="font-size:26px; animation:spin 4s linear infinite; filter:drop-shadow(0 0 10px #f43f5e);">🌀</div>"""
            ),
            tooltip=f"🚨 颱風中心位置：{latest['lat']}°N, {latest['lon']}°E ｜ 近中心最大風速 {latest['max_wind']}m/s"
        ).add_to(m_ty)

    st_folium(m_ty, width="100%", height=660, returned_objects=[])

    st.markdown("""
    <div class="floating-legend-dock">
        <span class="badge"><span class="dot" style="background:#f43f5e; color:#f43f5e;"></span> 120小時預測路徑</span>
        <span class="badge"><span class="dot" style="background:#f59e0b; color:#f59e0b;"></span> 70% 機率潛勢圈</span>
        <span class="badge"><span class="dot" style="background:rgba(244,63,94,0.4); color:#f43f5e;"></span> 7級風暴風半徑</span>
        <span class="badge"><span class="dot" style="background:#94a3b8; color:#94a3b8;"></span> 過去歷史路徑</span>
    </div>
    """, unsafe_allow_html=True)

elif map_layer == "🫧 空氣品質 AQI":
    st.caption("✨ 空氣品質全景監測：實時標註全台六大分區 AQI 燈號、微粒濃度與動態健康指標：")

    m_aqi = folium.Map(
        location=[23.75, 120.95],
        zoom_start=7.3,
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        attr="Esri World Dark Gray",
        control_scale=True
    )
    m_aqi.get_root().header.add_child(folium.Element(popup_css))
    
    folium.TileLayer(
        tiles="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        attr="Esri",
        name="地名標籤",
        overlay=True
    ).add_to(m_aqi)
    
    try:
        with open("taiwan_topo.json", "r", encoding="utf-8") as f:
            topo_data = json.load(f)
        folium.TopoJson(
            topo_data,
            "objects.COUNTY_MOI_1090820",
            style_function=lambda feature: {"fillColor": "transparent", "color": "#38bdf8", "weight": 1.4, "opacity": 0.85}
        ).add_to(m_aqi)
    except Exception:
        pass

    for reg_name, coords in REGION_COORDS.items():
        aq_info = aqi_dict.get(reg_name, {"aqi": 50, "pm25": 10.0, "pm10": 18.0, "source": "系統預報"})
        aqi_val = aq_info["aqi"]
        pm25_val = aq_info["pm25"]
        pm10_val = aq_info["pm10"]
        details = get_aqi_details(aqi_val)
        hex_color = details["color"]
        status_text = details["status"]
        advice_text = details["advice"]

        aqi_p_html = f"""
        <div style="font-family:'Space Grotesk',Arial,sans-serif; min-width:180px; padding:12px 14px; background:#0f172a; color:#f1f5f9; border-radius:10px; border:1px solid {hex_color}; box-shadow:0 8px 28px rgba(0,0,0,0.85);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid {hex_color}; padding-bottom:5px; margin-bottom:6px;">
                <span style="color:#38bdf8; font-size:15px; font-weight:700;">{reg_name}</span>
                <span style="background:{hex_color}; color:#ffffff; font-size:11px; padding:1px 6px; border-radius:4px; font-weight:700;">{status_text}</span>
            </div>
            <div style="font-size:12px; line-height:1.75; font-family:'JetBrains Mono',monospace;">
                <b>即時 AQI 指標:</b> <span style="color:{hex_color}; font-size:14px; font-weight:bold;">{aqi_val}</span><br>
                <b>細懸浮微粒 PM2.5:</b> <span style="color:#7dd3fc;">{pm25_val} μg/m³</span><br>
                <b>懸浮微粒 PM10:</b> <span style="color:#cbd5e1;">{pm10_val} μg/m³</span>
            </div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.15); font-size:11px; color:#94a3b8; line-height:1.4;">
                💡 {advice_text}
            </div>
        </div>
        """

        folium.CircleMarker(
            location=[coords["lat"], coords["lon"]],
            radius=20,
            color=hex_color,
            fill=False,
            weight=1.8,
            opacity=0.6
        ).add_to(m_aqi)

        folium.CircleMarker(
            location=[coords["lat"], coords["lon"]],
            radius=14,
            color=hex_color,
            fill=True,
            fill_color=hex_color,
            fill_opacity=0.88,
            popup=folium.Popup(aqi_p_html, max_width=320),
            tooltip=f"🫧 {reg_name}：AQI {aqi_val} ({status_text})"
        ).add_to(m_aqi)

    st_folium(m_aqi, width="100%", height=660, returned_objects=[])

    st.markdown("""
    <div class="floating-legend-dock">
        <span class="badge"><span class="dot" style="background:#10b981; color:#10b981;"></span> 良好 (0-50)</span>
        <span class="badge"><span class="dot" style="background:#f59e0b; color:#f59e0b;"></span> 普通 (51-100)</span>
        <span class="badge"><span class="dot" style="background:#f97316; color:#f97316;"></span> 敏感警示 (101-150)</span>
        <span class="badge"><span class="dot" style="background:#f43f5e; color:#f43f5e;"></span> 不健康 (151-200)</span>
        <span class="badge"><span class="dot" style="background:#a855f7; color:#a855f7;"></span> 危害 (&gt;200)</span>
    </div>
    """, unsafe_allow_html=True)

else:
    st.caption("✨ 載入 Mini Taiwan Pulse 官方線上全層地圖（整合航班、船舶、鐵道、發電廠真實動態）：")
    components.html(
        """
        <div style="width: 100%; height: 660px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(56, 189, 248, 0.35); background: #070a12; box-shadow: 0 0 25px rgba(6, 182, 212, 0.12);">
            <iframe 
                src="https://mini-taiwan-pulse.itsmigu.com/embed.html?v=1&style=dark&lng=120.95&lat=23.75&z=7.2"
                style="width: 100%; height: 100%; border: none; display: block;"
                allowfullscreen>
            </iframe>
        </div>
        """,
        height=670
    )

st.caption("⚡ MINI TAIWAN PULSE // 全景沉浸式大背景 // 全台 360+ 自動氣象測站 // CWA 颱風 120h 預測 // 即時空氣品質 AQI // 時尚動態選單")
