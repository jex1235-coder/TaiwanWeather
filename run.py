"""
Mini Taiwan Pulse 氣溫戰情室 - 一鍵整合啟動入口
用法: python run.py
"""
import os
import sys
import subprocess
from pathlib import Path

# 強制控制台使用 UTF-8 輸出，避免 Windows CMD 編碼問題
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent

def create_desktop_shortcut():
    """在 Windows 桌面建立一鍵啟動捷徑"""
    try:
        desktop = Path(os.environ.get("USERPROFILE", "")) / "Desktop"
        if not desktop.exists():
            print("[提示] 找不到桌面目錄。")
            return False
            
        target_bat = BASE_DIR / "run.bat"
        shortcut_file = desktop / "氣溫戰情室.lnk"
        
        ps_cmd = (
            f"$ws = New-Object -ComObject WScript.Shell; "
            f"$s = $ws.CreateShortcut('{shortcut_file}'); "
            f"$s.TargetPath = '{target_bat}'; "
            f"$s.WorkingDirectory = '{BASE_DIR}'; "
            f"$s.Description = 'Mini Taiwan Pulse 台灣氣候戰情室'; "
            f"$s.Save();"
        )
        res = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
            capture_output=True,
            text=True
        )
        if shortcut_file.exists():
            print(f"✨ 成功在桌面建立捷徑：{shortcut_file}")
            return True
        else:
            print("[提示] 捷徑建立未完成。")
            return False
    except Exception as e:
        print(f"[錯誤] 建立捷徑時發生異常：{e}")
        return False

def main():
    os.chdir(BASE_DIR)
    
    # 若有帶入 --shortcut 參數，僅建立桌面捷徑
    if "--shortcut" in sys.argv:
        create_desktop_shortcut()
        return

    print("=" * 60)
    print("  🌤️  MINI TAIWAN PULSE 氣象戰情室 - 一鍵啟動中...")
    print("=" * 60)
    print()

    # 1. 檢查並自動初始化資料庫
    db_file = BASE_DIR / "data.db"
    if not db_file.exists():
        print("📦 [首次啟動] 正在向中央氣象署抓取最新一週氣象資料並建立資料庫...")
        res = subprocess.run([sys.executable, "etl_weather.py"])
        if res.returncode == 0:
            print("✅ 氣象資料庫建立成功！\n")
        else:
            print("⚠️ 資料庫初次同步失敗，請檢查網路連線。\n")

    # 2. 啟動 Streamlit
    print("🚀 [啟動服務] 正在啟動 Streamlit 氣溫戰情室...")
    print("🌐 [瀏覽器] 系統將自動在預設瀏覽器開啟：http://localhost:8501")
    print("⏹️  [關閉說明] 如需關閉戰情室，請按 Ctrl + C 或直接關閉此視窗。")
    print("=" * 60 + "\n")

    app_path = str(BASE_DIR / "app.py")
    cmd = [sys.executable, "-m", "streamlit", "run", app_path]
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\n戰情室已安全關閉。")

if __name__ == "__main__":
    main()
