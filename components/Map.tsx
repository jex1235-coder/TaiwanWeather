'use client';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, Fragment } from 'react';

// Next.js leaflet icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function Map({ stations, aqiStations, typhoon, activeLayer }: { stations: any[], aqiStations: any[], typhoon: any, activeLayer: string }) {
  const [radarUrl, setRadarUrl] = useState<string>('');

  useEffect(() => {
    if (activeLayer === 'radar') {
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
          if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
            const host = data.host || 'https://tilecache.rainviewer.com';
            const latest = data.radar.past[data.radar.past.length - 1];
            // 新版 Rainviewer API 的 url 組合方式
            setRadarUrl(`${host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`);
          }
        })
        .catch(console.error);
    }
  }, [activeLayer]);

  return (
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
      
      {activeLayer === 'radar' && radarUrl && (
        <TileLayer
          url={radarUrl}
          opacity={0.65}
        />
      )}

      {/* 天氣測站點位 (氣溫、雨量、濕度) */}
      {['temp', 'rain', 'humid'].includes(activeLayer) && stations.map((st, i) => {
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
        }

        if (activeLayer === 'rain' && st.rain === 0) return null;

        return (
          <CircleMarker key={i} center={[st.lat, st.lon]} radius={7} color={color} fillColor={color} fillOpacity={0.85} weight={1.5}>
            <Popup>
              <div className="min-w-[180px] p-4">
                <div className="font-bold text-[16px] border-b pb-1.5 mb-2.5 flex justify-between" style={{color, borderColor: `${color}40`, fontFamily: 'var(--font-noto)'}}>
                  <span>{st.county} | {st.name}</span>
                  <span className="font-mono">{displayVal}</span>
                </div>
                <div className="text-[14px] space-y-1.5 font-mono tracking-wide">
                  <div className={activeLayer==='temp' ? 'font-bold text-[16px] text-white' : ''} style={activeLayer==='temp'?{color}: {}}>氣溫: {st.temp}°C</div>
                  <div className={activeLayer==='humid' ? 'font-bold text-[16px] text-white' : 'text-sky-300'} style={activeLayer==='humid'?{color}: {}}>濕度: {st.humid}%</div>
                  <div className="text-amber-400">風速: {st.wind} m/s</div>
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

      {/* 颱風路徑 */}
      {activeLayer === 'typhoon' && typhoon && typhoon.current && (
        <>
          {/* 將現在位置與預測位置合併，以便統一繪製漸層暴風圈 */}
          {[
             { lat: typhoon.current.lat, lon: typhoon.current.lon, time: '現在', isCurrent: true },
             ...typhoon.forecast
          ].map((pt: any, ptIdx: number, arr: any[]) => {
             // 越後面的預測點，透明度越低 (最少保留 0.15 的比例)
             const fadeRatio = Math.max(0.15, 1 - (ptIdx / arr.length));
             const baseRadius = (typhoon.current.radius7 * 1000);

             return (
               <Fragment key={`typhoon-pt-${ptIdx}`}>
                 {/* 颱風漸層暴風圈 (模擬雷達回波的漸層紅圈) */}
                 {[1, 0.8, 0.6, 0.4, 0.2].map((scale, idx) => (
                   <Circle 
                     key={`grad-${ptIdx}-${idx}`}
                     center={[pt.lat, pt.lon]} 
                     radius={baseRadius * scale} 
                     color={idx === 0 ? "#ef4444" : "transparent"} 
                     fillColor={idx === 4 ? "#fca5a5" : "#ef4444"} 
                     fillOpacity={(0.06 + (0.04 * idx)) * fadeRatio} 
                     weight={idx === 0 ? (1.5 * fadeRatio) : 0} 
                     dashArray={idx === 0 ? "5, 10" : ""} 
                     opacity={fadeRatio}
                   />
                 ))}
                 
                 {/* 只有現在位置才畫十級風半徑 (因為預測通常不會有精準的十級風預測) */}
                 {pt.isCurrent && typhoon.current.radius10 > 0 && [1, 0.7, 0.4].map((scale, idx) => (
                    <Circle 
                     key={`grad10-${idx}`}
                     center={[pt.lat, pt.lon]} 
                     radius={(typhoon.current.radius10 * 1000) * scale} 
                     color={idx === 0 ? "#b91c1c" : "transparent"} 
                     fillColor="#991b1b" 
                     fillOpacity={0.15 + (0.1 * idx)} 
                     weight={idx === 0 ? 2 : 0} 
                   />
                 ))}
               </Fragment>
             );
          })}
          
          {/* 預測路徑連線 */}
          <Polyline 
            positions={[ [typhoon.current.lat, typhoon.current.lon], ...typhoon.forecast.map((f: any) => [f.lat, f.lon]) ]} 
            color="#fca5a5" 
            weight={3} 
            dashArray="8, 12"
            opacity={0.8}
          />

          {/* 預測點 (外圍加上小光暈) */}
          {typhoon.forecast.map((f: any, i: number) => {
            const fadeRatio = Math.max(0.3, 1 - ((i + 1) / (typhoon.forecast.length + 1)));
            return (
              <Fragment key={`tf-group-${i}`}>
                <CircleMarker center={[f.lat, f.lon]} radius={8} color="transparent" fillColor="#fca5a5" fillOpacity={0.2 * fadeRatio} />
                <CircleMarker center={[f.lat, f.lon]} radius={4} color="#ef4444" weight={1} fillColor="#fef08a" fillOpacity={1 * fadeRatio} opacity={fadeRatio}>
                    <Popup><div className="font-bold font-mono text-rose-500">{f.time} 預測位置</div></Popup>
                </CircleMarker>
              </Fragment>
            );
          })}

          {/* 目前中心位置 (強烈發光紅點) */}
          <CircleMarker center={[typhoon.current.lat, typhoon.current.lon]} radius={16} color="transparent" fillColor="#ef4444" fillOpacity={0.4} />
          <CircleMarker center={[typhoon.current.lat, typhoon.current.lon]} radius={10} color="#fef08a" fillColor="#dc2626" fillOpacity={1} weight={2}>
            <Popup>
              <div className="min-w-[180px] p-2 font-mono">
                <div className="font-bold text-[18px] text-rose-500 border-b border-rose-500/30 pb-1 mb-2">
                   {typhoon.name}
                </div>
                <div className="text-gray-300 space-y-1">
                   <div>狀態: <span className="text-rose-400 font-bold">{typhoon.status}</span></div>
                   <div>中心氣壓: {typhoon.current.pressure} hPa</div>
                   <div>近中心最大風速: {typhoon.current.maxWind} m/s</div>
                   <div>七級風半徑: {typhoon.current.radius7} km</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        </>
      )}

    </MapContainer>
  );
}
