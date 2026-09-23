'use client';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Circle, ImageOverlay, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, Fragment, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import WindField from './WindField';

// Next.js leaflet icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// 自訂 SVG 颱風旋風圖示 (逆時針旋轉氣旋)
const cycloneIcon = L.divIcon({
  className: 'custom-cyclone-icon',
  html: `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <svg viewBox="0 0 100 100" style="width: 38px; height: 38px; filter: drop-shadow(0 0 8px #ef4444); animation: spin 2s linear infinite;" fill="none" stroke="#fca5a5" stroke-width="8">
        <path d="M 50 15 C 30 15, 15 35, 15 50 C 15 70, 35 85, 50 85 C 45 75, 45 60, 50 50 C 55 40, 55 25, 50 15 Z" fill="#ef4444" opacity="0.9" />
        <path d="M 85 50 C 85 30, 65 15, 50 15 C 30 15, 15 35, 15 50" stroke="#f87171" stroke-linecap="round" />
        <circle cx="50" cy="50" r="7" fill="#fef08a" stroke="#dc2626" stroke-width="3" />
      </svg>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

export default function Map({ stations, aqiStations, typhoon, activeLayer }: { stations: any[], aqiStations: any[], typhoon: any, activeLayer: string }) {
  const [radarUrl, setRadarUrl] = useState<string>('');

  // 颱風動態預測動畫狀態
  const [typhoonStep, setTyphoonStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const animRef = useRef<number | null>(null);

  // 全路徑節點 (現在點 + 未來預測點)
  const allTyphoonPoints = typhoon && typhoon.current ? [
    { ...typhoon.current, time: '現在 (即時位置)', isCurrent: true },
    ...(typhoon.forecast || [])
  ] : [];

  // 動態推進預測時間軸
  useEffect(() => {
    if (activeLayer !== 'typhoon' || !isPlaying || allTyphoonPoints.length <= 1) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let lastTime = performance.now();
    const speed = 0.25; // 每一秒推進 0.25 個預測時間節點

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      setTyphoonStep((prev) => {
        const next = prev + speed * dt;
        if (next >= allTyphoonPoints.length - 1) {
          return 0; // 循環播放
        }
        return next;
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [activeLayer, isPlaying, allTyphoonPoints.length]);

  // RainViewer 雷達
  useEffect(() => {
    if (activeLayer === 'radar') {
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
          if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
            const host = data.host || 'https://tilecache.rainviewer.com';
            const latest = data.radar.past[data.radar.past.length - 1];
            setRadarUrl(`${host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`);
          }
        })
        .catch(console.error);
    }
  }, [activeLayer]);

  // 插值計算颱風當前運動中心座標
  let interpLat = typhoon?.current?.lat || 23.5;
  let interpLon = typhoon?.current?.lon || 121;
  let interpTime = '即時位置';
  let interpRadius = (typhoon?.current?.radius7 || 100) * 1000;

  if (allTyphoonPoints.length > 1) {
    const idx = Math.min(Math.floor(typhoonStep), allTyphoonPoints.length - 2);
    const frac = typhoonStep - idx;
    const p1 = allTyphoonPoints[idx];
    const p2 = allTyphoonPoints[idx + 1];
    interpLat = p1.lat + (p2.lat - p1.lat) * frac;
    interpLon = p1.lon + (p2.lon - p1.lon) * frac;
    interpTime = frac > 0.5 ? p2.time : p1.time;
    interpRadius = ((p1.radius7 || 100) + ((p2.radius7 || 100) - (p1.radius7 || 100)) * frac) * 1000;
  }

  // 走過的路徑與尚未到達的預測路徑
  const traversedPositions: [number, number][] = [];
  const futurePositions: [number, number][] = [];

  if (allTyphoonPoints.length > 1) {
    const currIdx = Math.floor(typhoonStep);
    for (let i = 0; i <= currIdx; i++) {
      traversedPositions.push([allTyphoonPoints[i].lat, allTyphoonPoints[i].lon]);
    }
    traversedPositions.push([interpLat, interpLon]);

    futurePositions.push([interpLat, interpLon]);
    for (let i = currIdx + 1; i < allTyphoonPoints.length; i++) {
      futurePositions.push([allTyphoonPoints[i].lat, allTyphoonPoints[i].lon]);
    }
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer 
        center={[23.75, 120.95]} 
        zoom={7.4} 
        className="w-full h-full absolute inset-0 z-0"
        zoomControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri World Dark Gray"
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        />
        
        {/* 全球動態氣流場 (Wind Stream) - 亦可在颱風模式中連動 */}
        {(activeLayer === 'wind' || activeLayer === 'typhoon') && (
          <WindField 
            typhoon={typhoon} 
            typhoonCenter={activeLayer === 'typhoon' ? { lat: interpLat, lon: interpLon } : null}
            speedMultiplier={activeLayer === 'typhoon' ? 1.25 : 1.0}
            opacity={activeLayer === 'wind' ? 0.9 : 0.75}
          />
        )}

        {/* RainViewer 全球降雨雷達 */}
        {activeLayer === 'radar' && radarUrl && (
          <TileLayer
            url={radarUrl}
            opacity={0.65}
          />
        )}

        {/* CWA 官方台灣無地形高解析雷達 */}
        {activeLayer === 'cwa_radar' && (
          <ImageOverlay
            url={`https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Observation/O-A0058-003.png?t=${Date.now()}`}
            bounds={[[20.5, 118.0], [26.5, 124.0]]}
            opacity={0.72}
          />
        )}

        {/* 天氣測站點位 (氣溫、雨量、濕度) */}
        {['temp', 'rain', 'humid', 'wind'].includes(activeLayer) && stations.map((st, i) => {
          let color = "#38bdf8";
          let displayVal = "";
          
          if (activeLayer === 'temp') {
            if (st.temp >= 30) color = "#f43f5e";
            else if (st.temp >= 25) color = "#f59e0b";
            else if (st.temp >= 20) color = "#10b981";
            displayVal = `${st.temp}°C`;
          } else if (activeLayer === 'rain') {
            if (st.rain > 50) color = "#7c3aed";
            else if (st.rain > 10) color = "#3b82f6";
            else if (st.rain > 0) color = "#60a5fa";
            else color = "#475569";
            displayVal = `${st.rain} mm`;
          } else if (activeLayer === 'humid') {
            if (st.humid > 90) color = "#0ea5e9";
            else if (st.humid > 70) color = "#2dd4bf";
            else color = "#fcd34d";
            displayVal = `${st.humid}%`;
          } else if (activeLayer === 'wind') {
            color = st.wind > 10 ? "#f43f5e" : st.wind > 5 ? "#facc15" : "#38bdf8";
            displayVal = `${st.wind || 0} m/s`;
          }

          if (activeLayer === 'rain' && st.rain === 0) return null;

          return (
            <CircleMarker key={i} center={[st.lat, st.lon]} radius={activeLayer === 'wind' ? 5 : 7} color={color} fillColor={color} fillOpacity={0.85} weight={1.5}>
              <Popup>
                <div className="min-w-[180px] p-4">
                  <div className="font-bold text-[16px] border-b pb-1.5 mb-2.5 flex justify-between" style={{color, borderColor: `${color}40`, fontFamily: 'var(--font-noto)'}}>
                    <span>{st.county} | {st.name}</span>
                    <span className="font-mono">{displayVal}</span>
                  </div>
                  <div className="text-[14px] space-y-1.5 font-mono tracking-wide">
                    <div className={activeLayer==='temp' ? 'font-bold text-[16px] text-white' : ''} style={activeLayer==='temp'?{color}: {}}>氣溫: {st.temp}°C</div>
                    <div className={activeLayer==='humid' ? 'font-bold text-[16px] text-white' : 'text-sky-300'} style={activeLayer==='humid'?{color}: {}}>濕度: {st.humid}%</div>
                    <div className={activeLayer==='wind' ? 'font-bold text-[16px] text-white' : 'text-amber-400'} style={activeLayer==='wind'?{color}: {}}>風速: {st.wind} m/s</div>
                    <div className={activeLayer==='rain' ? 'font-bold text-[16px] text-white' : 'text-indigo-400'} style={activeLayer==='rain'?{color}: {}}>雨量: {st.rain} mm</div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* 空氣品質 AQI 測站 */}
        {activeLayer === 'aqi' && aqiStations.map((st, i) => {
          let color = "#10b981"; // 良好
          if (st.aqi > 300) color = "#7e22ce"; // 危害
          else if (st.aqi > 200) color = "#6b21a8"; // 非常不健康
          else if (st.aqi > 150) color = "#ef4444"; // 對所有族群不健康
          else if (st.aqi > 100) color = "#f97316"; // 對敏感族群不健康
          else if (st.aqi > 50) color = "#eab308"; // 普通

          return (
            <CircleMarker key={`aqi-${i}`} center={[st.lat, st.lon]} radius={8} color={color} fillColor={color} fillOpacity={0.9} weight={2}>
              <Popup>
                <div className="min-w-[160px] p-3">
                  <div className="font-bold text-[16px] border-b pb-1.5 mb-2.5 flex justify-between" style={{color, borderColor: `${color}40`, fontFamily: 'var(--font-noto)'}}>
                    <span>{st.county} | {st.name}</span>
                  </div>
                  <div className="text-[14px] space-y-2 font-mono tracking-wide">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">AQI:</span>
                      <span className="font-bold text-[18px]" style={{color}}>{st.aqi}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">狀態:</span>
                      <span className="font-bold" style={{color}}>{st.status}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">PM2.5:</span>
                      <span className="text-white">{st.pm25} <span className="text-[10px] text-gray-500">μg/m³</span></span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* 颱風動態預測路徑 */}
        {activeLayer === 'typhoon' && typhoon && typhoon.current && (
          <>
            {/* 已走過的歷史與即時模擬軌跡 (實線發光) */}
            {traversedPositions.length > 1 && (
              <Polyline 
                positions={traversedPositions} 
                color="#ef4444" 
                weight={3.5} 
                opacity={0.9}
              />
            )}

            {/* 未來預測路徑 (虛線發光) */}
            {futurePositions.length > 1 && (
              <Polyline 
                positions={futurePositions} 
                color="#fca5a5" 
                weight={2.5} 
                dashArray="6, 8"
                opacity={0.65}
              />
            )}

            {/* 所有預測節點 (標示光暈點) */}
            {allTyphoonPoints.map((pt: any, i: number) => (
              <CircleMarker 
                key={`wp-${i}`} 
                center={[pt.lat, pt.lon]} 
                radius={pt.isCurrent ? 6 : 4} 
                color={pt.isCurrent ? "#fef08a" : "#f87171"} 
                fillColor={pt.isCurrent ? "#ef4444" : "#450a0a"} 
                fillOpacity={0.9} 
                weight={pt.isCurrent ? 2 : 1}
              >
                <Popup>
                  <div className="font-bold font-mono text-rose-400 p-1">
                    <div>{pt.time}</div>
                    <div className="text-xs text-gray-300 mt-1">座標: {pt.lat}°N, {pt.lon}°E</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* 動態行進中的颱風暴風圈 (即時隨時間軸移動) */}
            {[1, 0.75, 0.5, 0.25].map((scale, idx) => (
              <Circle 
                key={`storm-circle-${idx}`}
                center={[interpLat, interpLon]} 
                radius={interpRadius * scale} 
                color={idx === 0 ? "#ef4444" : "transparent"} 
                fillColor={idx === 3 ? "#fef08a" : "#ef4444"} 
                fillOpacity={0.06 + (0.05 * idx)} 
                weight={idx === 0 ? 1.5 : 0} 
                dashArray={idx === 0 ? "4, 6" : ""} 
              />
            ))}

            {/* 動態旋轉的颱風眼中心圖示 (使用 Leaflet divIcon) */}
            <Marker position={[interpLat, interpLon]} icon={cycloneIcon}>
              <Popup>
                <div className="min-w-[190px] p-2 font-mono">
                  <div className="font-bold text-[18px] text-rose-500 border-b border-rose-500/30 pb-1 mb-2 flex items-center justify-between">
                    <span>{typhoon.name}</span>
                    <span className="text-xs text-amber-300 font-normal animate-pulse">{interpTime}</span>
                  </div>
                  <div className="text-gray-300 space-y-1 text-xs">
                    <div>狀態: <span className="text-rose-400 font-bold">{typhoon.status}</span></div>
                    <div>預估座標: {interpLat.toFixed(2)}°N, {interpLon.toFixed(2)}°E</div>
                    <div>中心氣壓: {typhoon.current.pressure} hPa</div>
                    <div>近中心最大風速: {typhoon.current.maxWind} m/s</div>
                    <div>七級風半徑: {typhoon.current.radius7} km</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* 颱風時間軸播放控制器 (Cyber Player HUD) */}
      {activeLayer === 'typhoon' && typhoon && allTyphoonPoints.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-6 py-4 rounded-3xl w-[92%] max-w-xl border border-rose-500/30 shadow-[0_0_35px_rgba(244,63,94,0.25)] flex flex-col gap-2.5 pointer-events-auto backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span className="font-bold text-rose-400 text-sm tracking-wide" style={{fontFamily: 'var(--font-noto)'}}>{typhoon.name} 動態路徑預測模擬</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <span className="text-amber-300 font-bold">🕒 {interpTime}</span>
              <span className="text-sky-300 font-mono">📍 {interpLat.toFixed(1)}°N, {interpLon.toFixed(1)}°E</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="p-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 transition hover:scale-105 active:scale-95"
              title={isPlaying ? "暫停" : "播放"}
            >
              {isPlaying ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <button 
              onClick={() => {
                setTyphoonStep(0);
                setIsPlaying(true);
              }} 
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition hover:scale-105 active:scale-95"
              title="重新播放"
            >
              <RotateCcw size={17} />
            </button>
            <input 
              type="range" 
              min="0" 
              max={allTyphoonPoints.length - 1} 
              step="0.01" 
              value={typhoonStep} 
              onChange={(e) => {
                setIsPlaying(false);
                setTyphoonStep(parseFloat(e.target.value));
              }}
              className="flex-1 accent-rose-500 cursor-pointer h-2 bg-gray-800/80 rounded-lg"
            />
            <span className="text-xs font-mono text-gray-400 min-w-[55px] text-right">
              進度 {Math.round((typhoonStep / (allTyphoonPoints.length - 1)) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
