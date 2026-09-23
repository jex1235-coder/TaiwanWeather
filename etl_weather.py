import os
import json
import sqlite3
import requests
import pandas as pd

# ==========================================
# 設定區：中央氣象署 CWA API 授權碼
# ==========================================
CWA_API_KEY = os.getenv("CWA_API_KEY", "CWA-F49AA343-6B93-4175-9822-D014399E7ABC")
API_URL = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-A0010-001"
BACKUP_API_URL = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-091"

TARGET_REGIONS = ["北部地區", "中部地區", "南部地區", "東北部地區", "東部地區", "東南部地區"]

# 臺灣縣市對應之六大分區對照表
REGION_COUNTIES = {
    "北部地區": ["基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣"],
    "中部地區": ["臺中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣"],
    "南部地區": ["臺南市", "高雄市", "屏東縣"],
    "東北部地區": ["宜蘭縣"],
    "東部地區": ["花蓮縣"],
    "東南部地區": ["臺東縣"]
}

# ------------------------------------------
# HW10-1: 獲取天氣預報資料 (20%)
# ------------------------------------------
def fetch_weather_data(api_key: str) -> dict:
    """調用 CWA API 獲取一週天氣預報資料 (JSON)，具備現代 CWA API 容錯機制"""
    params = {
        "Authorization": api_key,
        "format": "JSON"
    }
    
    print("[HW10-1] 發送 API 請求至中央氣象署...")
    
    data = None
    try:
        response = requests.get(API_URL, params=params, timeout=15)
        if response.status_code == 200:
            data = response.json()
        else:
            print(f"[提示] F-A0010-001 回傳狀態碼 {response.status_code} (氣象署已於 2026 年調整開放資料集)")
            print("[HW10-1] 自動切換至最新官方一週預報資料集 (F-D0047-091)...")
            res_backup = requests.get(BACKUP_API_URL, params=params, timeout=15)
            res_backup.raise_for_status()
            backup_json = res_backup.json()
            data = _transform_fd0047_to_standard(backup_json)
    except Exception as e:
        print(f"[HW10-1] 連線發生異常: {e}，嘗試備援通道...")
        res_backup = requests.get(BACKUP_API_URL, params=params, timeout=15)
        res_backup.raise_for_status()
        backup_json = res_backup.json()
        data = _transform_fd0047_to_standard(backup_json)

    # 觀察獲得的資料 (評分要求：使用 json.dumps 觀察)
    print("\n" + "=" * 50)
    print("[HW10-1] 觀察取得的 JSON 原始結構 (前 600 字元)：")
    print("=" * 50)
    print(json.dumps(data, indent=2, ensure_ascii=False)[:600] + "\n...")
    
    return data


def _transform_fd0047_to_standard(fd0047_json: dict) -> dict:
    """將 F-D0047-091 全臺 22 縣市數據聚合為 HW10 規範之六大分區標準結構"""
    loc_list = fd0047_json.get("records", {}).get("Locations", [{}])[0].get("Location", [])
    county_map = {loc["LocationName"]: loc for loc in loc_list}
    
    standard_locations = []
    
    for region_name, counties in REGION_COUNTIES.items():
        # 收集該分區所有縣市的 MinT 與 MaxT
        dates_min = {}
        dates_max = {}
        
        for c_name in counties:
            if c_name not in county_map:
                continue
            elem_map = {elem["ElementName"]: elem for elem in county_map[c_name].get("WeatherElement", [])}
            
            # 最低溫度
            min_times = elem_map.get("最低溫度", {}).get("Time", [])
            for t in min_times:
                d_str = t["StartTime"].split("T")[0]
                val = float(t["ElementValue"][0]["MinTemperature"])
                dates_min.setdefault(d_str, []).append(val)
                
            # 最高溫度
            max_times = elem_map.get("最高溫度", {}).get("Time", [])
            for t in max_times:
                d_str = t["StartTime"].split("T")[0]
                val = float(t["ElementValue"][0]["MaxTemperature"])
                dates_max.setdefault(d_str, []).append(val)
        
        mint_records = []
        maxt_records = []
        all_dates = sorted(set(dates_min.keys()) & set(dates_max.keys()))
        
        for d in all_dates:
            # 聚合：分區最低溫取最小值、分區最高溫取最大值
            reg_min = round(min(dates_min[d]), 1)
            reg_max = round(max(dates_max[d]), 1)
            
            mint_records.append({
                "startTime": f"{d}T00:00:00+08:00",
                "endTime": f"{d}T23:59:59+08:00",
                "elementValue": [{"value": str(reg_min)}]
            })
            maxt_records.append({
                "startTime": f"{d}T00:00:00+08:00",
                "endTime": f"{d}T23:59:59+08:00",
                "elementValue": [{"value": str(reg_max)}]
            })
            
        standard_locations.append({
            "locationName": region_name,
            "weatherElement": [
                {"elementName": "MinT", "time": mint_records},
                {"elementName": "MaxT", "time": maxt_records}
            ]
        })
        
    return {
        "success": "true",
        "result": {"resource_id": "F-A0010-001"},
        "records": {
            "locations": {
                "location": standard_locations
            }
        }
    }

# ------------------------------------------
# HW10-2: 分析資料，提取最高與最低氣溫 (20%)
# ------------------------------------------
def parse_temperature_data(raw_data: dict) -> list[dict]:
    """從 JSON 結構中提取指定六大地區的日期、最低氣溫與最高氣溫"""
    locations = raw_data.get("records", {}).get("locations", {}).get("location", [])
    extracted_records = []
    
    for loc in locations:
        region_name = loc.get("locationName")
        if region_name not in TARGET_REGIONS:
            continue
            
        weather_elements = {elem["elementName"]: elem for elem in loc.get("weatherElement", [])}
        mint_times = weather_elements.get("MinT", {}).get("time", [])
        maxt_times = weather_elements.get("MaxT", {}).get("time", [])
        
        # 對齊 MinT 與 MaxT 的日期時段
        temp_dict = {}
        for item in mint_times:
            # 格式：YYYY-MM-DD
            date_str = item["startTime"].split("T")[0]
            val = float(item["elementValue"][0]["value"])
            if "mint" not in temp_dict.setdefault(date_str, {}):
                temp_dict[date_str]["mint"] = val
            else:
                temp_dict[date_str]["mint"] = min(temp_dict[date_str]["mint"], val)

        for item in maxt_times:
            date_str = item["startTime"].split("T")[0]
            val = float(item["elementValue"][0]["value"])
            if "maxt" not in temp_dict.setdefault(date_str, {}):
                temp_dict[date_str]["maxt"] = val
            else:
                temp_dict[date_str]["maxt"] = max(temp_dict[date_str]["maxt"], val)

        for date_str, temps in sorted(temp_dict.items()):
            if "mint" in temps and "maxt" in temps:
                extracted_records.append({
                    "regionName": region_name,
                    "dataDate": date_str,
                    "mint": temps["mint"],
                    "maxt": temps["maxt"]
                })
                
    # 觀察提取出來的資料 (評分要求：使用 json.dumps 觀察)
    print("\n" + "=" * 50)
    print("[HW10-2] 觀察提取後的氣溫結構 (範例前 3 筆)：")
    print("=" * 50)
    print(json.dumps(extracted_records[:3], indent=2, ensure_ascii=False))
    
    return extracted_records

# ------------------------------------------
# HW10-3: 儲存至 SQLite3 資料庫並驗證 (20%)
# ------------------------------------------
def init_and_save_to_db(records: list[dict], db_path: str = "data.db"):
    """建立資料表並存入氣溫資料，最後執行驗證查詢"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 建立 Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS TemperatureForecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            regionName TEXT NOT NULL,
            dataDate TEXT NOT NULL,
            mint REAL NOT NULL,
            maxt REAL NOT NULL,
            UNIQUE(regionName, dataDate) ON CONFLICT REPLACE
        )
    """)
    
    # 寫入資料
    insert_sql = """
        INSERT INTO TemperatureForecasts (regionName, dataDate, mint, maxt)
        VALUES (:regionName, :dataDate, :mint, :maxt)
    """
    cursor.executemany(insert_sql, records)
    conn.commit()
    print(f"\n[HW10-3] 成功將 {len(records)} 筆紀錄寫入 {db_path} 中的 TemperatureForecasts 表格。")
    
    # ---------------- 驗證查詢 ----------------
    print("\n" + "=" * 50)
    print("[HW10-3] 驗證 1：列出所有地區名稱")
    print("=" * 50)
    cursor.execute("SELECT DISTINCT regionName FROM TemperatureForecasts;")
    regions = cursor.fetchall()
    for reg in regions:
        print(f"- {reg[0]}")
        
    print("\n" + "=" * 50)
    print("[HW10-3] 驗證 2：列出中部地區的氣溫資料")
    print("=" * 50)
    cursor.execute("""
        SELECT id, regionName, dataDate, mint, maxt 
        FROM TemperatureForecasts 
        WHERE regionName = '中部地區'
        ORDER BY dataDate ASC;
    """)
    central_rows = cursor.fetchall()
    cols = ["id", "regionName", "dataDate", "mint", "maxt"]
    print(pd.DataFrame(central_rows, columns=cols).to_string(index=False))
    
    conn.close()

if __name__ == "__main__":
    if CWA_API_KEY == "YOUR_CWA_API_KEY_HERE":
        print("提示：請先將程式碼中的 CWA_API_KEY 替換為您的中央氣象署有效授權碼。")
    else:
        raw_json = fetch_weather_data(CWA_API_KEY)
        parsed_records = parse_temperature_data(raw_json)
        init_and_save_to_db(parsed_records)
