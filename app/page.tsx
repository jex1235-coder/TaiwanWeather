'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Map as MapIcon, CloudRain, Wind, Thermometer, RadioReceiver, Activity, Droplets, Newspaper, X, Leaf, Tornado } from 'lucide-react';

const MapComponent = dynamic(() => import('@/components/Map'), { 
  ssr: false, 
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-[#060913] text-sky-400 font-mono text-xl animate-pulse tracking-widest">
      INITIALIZING TAIWAN PULSE...
    </div>
  ) 
});

export default function Home() {
  const [stations, setStations] = useState<any[]>([]);
  const [aqiStations, setAqiStations] = useState<any[]>([]);
  const [typhoon, setTyphoon] = useState<any>(null);
  const [extremes, setExtremes] = useState({ maxTemp: {val: 0, name: ''}, minTemp: {val: 0, name: ''} });
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState('temp');
  const [news, setNews] = useState<any[]>([]);
  const [showNews, setShowNews] = useState(false);

  useEffect(() => {
    fetch('/api/weather?type=stations')
      .then(res => res.json())
      .then(data => {
        setStations(data.stations || []);
        if (data.extremes) setExtremes(data.extremes);
        setLoading(false);
      })
      .catch(console.error);
      
    fetch('/api/weather?type=aqi')
      .then(res => res.json())
      .then(data => setAqiStations(data.stations || []))
      .catch(console.error);

    fetch('/api/weather?type=typhoon')
      .then(res => res.json())
      .then(data => setTyphoon(data.typhoon || null))
      .catch(console.error);
      
    fetch('/api/weather?type=news')
      .then(res => res.json())
      .then(data => setNews(data.news || []))
      .catch(console.error);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060913] text-gray-100">
      <MapComponent stations={stations} aqiStations={aqiStations} typhoon={typhoon} activeLayer={activeLayer} />

      {/* 頂部奇幻 Cyber HUD */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-7 py-3.5 rounded-[24px] flex items-center justify-between w-[92%] max-w-5xl transition-all duration-500 hover:shadow-[0_15px_50px_rgba(56,189,248,0.2)] pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_#38bdf8] animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
          <h1 className="text-[22px] font-bold bg-gradient-to-r from-white via-sky-300 to-indigo-400 bg-clip-text text-transparent tracking-widest" style={{fontFamily: 'var(--font-space)'}}>
            TAIWAN PULSE
          </h1>
        </div>
        
        <div className="hidden md:flex items-center gap-4 text-[13px] font-bold tracking-wider" style={{fontFamily: 'var(--font-noto)'}}>
          <span className="flex items-center gap-2 bg-rose-500/15 text-rose-400 px-4 py-1.5 rounded-full border border-rose-500/30 backdrop-blur-md">
            🔥 最高溫 {loading ? '--' : `${extremes.maxTemp.val}° ${extremes.maxTemp.name}`}
          </span>
          <span className="flex items-center gap-2 bg-sky-500/15 text-sky-400 px-4 py-1.5 rounded-full border border-sky-500/30 backdrop-blur-md">
            ❄️ 最低溫 {loading ? '--' : `${extremes.minTemp.val}° ${extremes.minTemp.name}`}
          </span>
        </div>
      </div>

      {/* 右側懸浮動態抽屜面板 (圖層控制) */}
      <div className="absolute right-6 top-28 z-[1000] glass-panel p-4 rounded-3xl w-[250px] flex flex-col gap-2.5 transition-transform duration-500 pointer-events-auto max-h-[75vh] overflow-y-auto custom-scrollbar">
        <div className="text-[11px] font-bold text-sky-400/80 uppercase tracking-[0.2em] mb-1 px-1" style={{fontFamily: 'var(--font-space)'}}>LAYER CONTROL</div>
        
        <button onClick={() => setActiveLayer('temp')} className={`group flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] ${activeLayer === 'temp' ? 'bg-sky-500/30 text-sky-300 border-sky-500/50 shadow-[0_0_20px_rgba(56,189,248,0.3)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}>
          <Thermometer size={18} className={activeLayer === 'temp' ? "animate-pulse text-sky-300" : ""} />
          <span className="font-bold text-[14px] tracking-wide" style={{fontFamily: 'var(--font-noto)'}}>即時氣溫分布</span>
        </button>
        
        <button onClick={() => setActiveLayer('rain')} className={`group flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] ${activeLayer === 'rain' ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}>
          <CloudRain size={18} className={activeLayer === 'rain' ? "animate-bounce text-indigo-300" : ""} />
          <span className="font-bold text-[14px] tracking-wide" style={{fontFamily: 'var(--font-noto)'}}>測站累積雨量</span>
        </button>
        
        <button onClick={() => setActiveLayer('radar')} className={`group flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] ${activeLayer === 'radar' ? 'bg-fuchsia-500/30 text-fuchsia-300 border-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.3)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}>
          <RadioReceiver size={18} className={activeLayer === 'radar' ? "animate-spin text-fuchsia-300" : ""} style={{ animationDuration: '3s' }} />
          <span className="font-bold text-[14px] tracking-wide" style={{fontFamily: 'var(--font-noto)'}}>即時降雨雷達</span>
        </button>
        
        <button onClick={() => setActiveLayer('humid')} className={`group flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] ${activeLayer === 'humid' ? 'bg-teal-500/30 text-teal-300 border-teal-500/50 shadow-[0_0_20px_rgba(20,184,166,0.3)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}>
          <Droplets size={18} className={activeLayer === 'humid' ? "animate-pulse text-teal-300" : ""} />
          <span className="font-bold text-[14px] tracking-wide" style={{fontFamily: 'var(--font-noto)'}}>全台濕度分布</span>
        </button>

        <button onClick={() => setActiveLayer('aqi')} className={`group flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] ${activeLayer === 'aqi' ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}>
          <Leaf size={18} className={activeLayer === 'aqi' ? "animate-pulse text-emerald-300" : ""} />
          <span className="font-bold text-[14px] tracking-wide" style={{fontFamily: 'var(--font-noto)'}}>空氣品質 (AQI)</span>
        </button>

        <button onClick={() => setActiveLayer('typhoon')} className={`group flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] ${activeLayer === 'typhoon' ? 'bg-rose-500/30 text-rose-300 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'}`}>
          <Tornado size={18} className={activeLayer === 'typhoon' ? "animate-[spin_1s_linear_infinite] text-rose-300" : ""} />
          <span className="font-bold text-[14px] tracking-wide" style={{fontFamily: 'var(--font-noto)'}}>颱風路徑預測</span>
        </button>

        <div className="my-2 border-t border-sky-500/20"></div>

        <button onClick={() => setShowNews(true)} className={`group flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]`}>
          <Newspaper size={18} />
          <span className="font-bold text-[14px] tracking-wide" style={{fontFamily: 'var(--font-noto)'}}>氣象特報新聞</span>
        </button>
      </div>
      
      {/* 氣象特報/新聞 Modal */}
      {showNews && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto">
          <div className="glass-panel w-full max-w-2xl max-h-[80vh] rounded-3xl p-6 flex flex-col relative overflow-hidden border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
            <button onClick={() => setShowNews(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white transition bg-white/10 p-2 rounded-full z-10">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-bold text-amber-400 mb-6 flex items-center gap-3 shrink-0" style={{fontFamily: 'var(--font-noto)'}}>
              <Newspaper size={28} /> 中央氣象署即時特報
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {news.length === 0 ? (
                <div className="text-center py-10 text-gray-400 animate-pulse">載入特報資料中...</div>
              ) : (
                news.map((item, idx) => (
                  <div key={idx} className="bg-black/40 border border-white/5 p-4 rounded-2xl hover:border-amber-500/30 transition">
                    <div className="text-[13px] text-amber-500/80 mb-1 font-mono">{item.time}</div>
                    <div className="font-bold text-[17px] text-white mb-2" style={{fontFamily: 'var(--font-noto)'}}>{item.title}</div>
                    <div className="text-[14px] text-gray-300 leading-relaxed" style={{fontFamily: 'var(--font-noto)'}}>{item.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 底部圖例 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-6 py-2.5 rounded-full flex items-center gap-6 text-[13px] font-bold tracking-wider pointer-events-auto" style={{fontFamily: 'var(--font-noto)'}}>
        {activeLayer === 'temp' && (
          <>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]"></span><span className="text-gray-300">舒適 (&lt;25°)</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]"></span><span className="text-gray-300">溫暖 (25-30°)</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] shadow-[0_0_8px_#f43f5e]"></span><span className="text-gray-300">炎熱 (&gt;30°)</span></div>
          </>
        )}
        {activeLayer === 'rain' && (
          <>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#60a5fa] shadow-[0_0_8px_#60a5fa]"></span><span className="text-gray-300">微雨 (&gt;0mm)</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6]"></span><span className="text-gray-300">大雨 (&gt;10mm)</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#7c3aed] shadow-[0_0_8px_#7c3aed]"></span><span className="text-gray-300">豪雨 (&gt;50mm)</span></div>
          </>
        )}
        {activeLayer === 'humid' && (
          <>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#fcd34d] shadow-[0_0_8px_#fcd34d]"></span><span className="text-gray-300">乾燥 (&lt;70%)</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf] shadow-[0_0_8px_#2dd4bf]"></span><span className="text-gray-300">微濕 (70-90%)</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9] shadow-[0_0_8px_#0ea5e9]"></span><span className="text-gray-300">潮濕 (&gt;90%)</span></div>
          </>
        )}
        {activeLayer === 'radar' && (
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#d946ef] shadow-[0_0_8px_#d946ef] animate-pulse"></span><span className="text-gray-300">Live 雷達回波圖已啟動</span></div>
        )}
        {activeLayer === 'aqi' && (
          <>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]"></span><span className="text-gray-300">良好</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#f97316] shadow-[0_0_8px_#f97316]"></span><span className="text-gray-300">不健康</span></div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#7e22ce] shadow-[0_0_8px_#7e22ce]"></span><span className="text-gray-300">危害</span></div>
          </>
        )}
        {activeLayer === 'typhoon' && typhoon && (
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-[0_0_8px_#ef4444] animate-pulse"></span><span className="text-gray-300">颱風中心與暴風半徑預測</span></div>
        )}
      </div>

      {/* 無颱風時的提示 */}
      {activeLayer === 'typhoon' && !typhoon && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] glass-panel px-8 py-6 rounded-3xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 shadow-[0_0_50px_rgba(244,63,94,0.15)] pointer-events-none">
          <Tornado size={48} className="text-rose-400/50" />
          <div className="text-xl font-bold text-gray-200 tracking-wider" style={{fontFamily: 'var(--font-noto)'}}>目前西北太平洋無活躍颱風或熱帶性低氣壓</div>
          <div className="text-sm text-gray-400" style={{fontFamily: 'var(--font-noto)'}}>天氣相當平靜，請盡情享受好天氣！</div>
        </div>
      )}
    </main>
  );
}
