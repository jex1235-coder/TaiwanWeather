'use client';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface WindFieldProps {
  stations?: any[];
  typhoon?: any;
  typhoonCenter?: { lat: number; lon: number } | null;
  speedMultiplier?: number;
  opacity?: number;
}

interface Particle {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
  speed: number;
}

export default function WindField({ 
  stations = [],
  typhoon, 
  typhoonCenter,
  speedMultiplier = 1.0, 
  opacity = 0.85 
}: WindFieldProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 使用 ref 保存即時變動的資料，避免每一幀觸發 useEffect 重新掛載 Canvas 造成記憶體溢出
  const stationsRef = useRef(stations);
  stationsRef.current = stations;

  const typhoonRef = useRef(typhoon);
  typhoonRef.current = typhoon;

  const typhoonCenterRef = useRef(typhoonCenter);
  typhoonCenterRef.current = typhoonCenter;

  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '450';
    canvas.style.opacity = `${opacity}`;
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = container.clientWidth);
    let height = (canvas.height = container.clientHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = container.clientWidth;
      height = canvas.height = container.clientHeight;
    };
    map.on('resize', onResize);

    const PARTICLE_COUNT = Math.min(1800, Math.floor((width * height) / 600));
    const particles: Particle[] = [];

    const getBounds = () => {
      const b = map.getBounds();
      return {
        minLat: b.getSouth() - 1.5,
        maxLat: b.getNorth() + 1.5,
        minLon: b.getWest() - 2.5,
        maxLon: b.getEast() + 2.5,
      };
    };

    const resetParticle = (p: Particle) => {
      const b = getBounds();
      p.lat = b.minLat + Math.random() * (b.maxLat - b.minLat);
      p.lon = b.minLon + Math.random() * (b.maxLon - b.minLon);
      p.age = 0;
      p.maxAge = 35 + Math.floor(Math.random() * 45);
      p.speed = 0.8 + Math.random() * 0.6;
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p: Particle = { lat: 0, lon: 0, age: 0, maxAge: 0, speed: 1 };
      resetParticle(p);
      p.age = Math.floor(Math.random() * p.maxAge);
      particles.push(p);
    }

    // 計算特定座標之風向風速 (以 349 處真實測站 IDW 逆距離權重內插 + 海域氣旋環流)
    const getWindVector = (lat: number, lon: number) => {
      let realU = 0;
      let realV = 0;
      let totalWeight = 0;
      let minDist = 999;

      const currentStations = (stationsRef.current || []).filter(
        (s: any) => typeof s.wind === 'number' && typeof s.windDir === 'number' && !isNaN(s.lat) && !isNaN(s.lon)
      );

      // 1. 真實測站 IDW (Inverse Distance Weighting) 插值演算
      if (currentStations.length > 0) {
        for (let i = 0; i < currentStations.length; i++) {
          const st = currentStations[i];
          const dLat = lat - st.lat;
          const dLon = lon - st.lon;
          const d = Math.sqrt(dLat * dLat + dLon * dLon);
          if (d < minDist) minDist = d;

          if (d < 2.0) {
            const w = 1.0 / Math.pow(d + 0.08, 2);
            realU += (st.windU || 0) * w;
            realV += (st.windV || 0) * w;
            totalWeight += w;
          }
        }
      }

      let u = 0;
      let v = 0;
      let isRealDominated = false;

      if (totalWeight > 0) {
        realU /= totalWeight;
        realV /= totalWeight;
        
        const scale = 0.007;
        const stationInfluence = Math.max(0, 1 - (minDist / 1.8));
        
        u = realU * scale * stationInfluence;
        v = realV * scale * stationInfluence;
        if (minDist < 0.6) isRealDominated = true;
      }

      // 2. 太平洋與外海背景環境場 (當遠離測站覆蓋區域時無縫融合)
      if (!isRealDominated) {
        let envU = -0.025; // 偏東微風
        let envV = -0.012; // 偏北微風

        // 颱風氣旋環流 (讀取即時更新的颱風中心)
        const currentTyphoon = typhoonRef.current;
        const center = typhoonCenterRef.current || (currentTyphoon?.current ? { lat: currentTyphoon.current.lat, lon: currentTyphoon.current.lon } : null);
        if (center) {
          const dLat = lat - center.lat;
          const dLon = lon - center.lon;
          const dist = Math.sqrt(dLat * dLat + dLon * dLon);

          if (dist < 14) {
            const angle = Math.atan2(dLat, dLon) + Math.PI / 2 - 0.28;
            const vortexSpeed = 0.18 * Math.exp(-dist / 3.5);
            const w = Math.max(0, 1 - dist / 14);
            envU = envU * (1 - w) + Math.cos(angle) * vortexSpeed * w;
            envV = envV * (1 - w) + Math.sin(angle) * vortexSpeed * w;
          }
        }

        const envWeight = Math.min(1, Math.max(0, (minDist - 0.3) / 1.2));
        u = u * (1 - envWeight) + envU * envWeight;
        v = v * (1 - envWeight) + envV * envWeight;
      }

      return { u: u * speedMultiplier, v: v * speedMultiplier };
    };

    // 速度轉色彩
    const getColor = (speedMag: number) => {
      if (speedMag > 0.10) return '#f43f5e'; // 強烈陣風 / 暴風 (>15 m/s)
      if (speedMag > 0.055) return '#facc15'; // 強風 (8-15 m/s)
      if (speedMag > 0.025) return '#34d399'; // 和風 (4-8 m/s)
      return '#38bdf8';                      // 微風 (<4 m/s)
    };

    const render = () => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1.35;
      ctx.lineCap = 'round';

      const bounds = getBounds();

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];

        if (
          p.age >= p.maxAge ||
          p.lat < bounds.minLat ||
          p.lat > bounds.maxLat ||
          p.lon < bounds.minLon ||
          p.lon > bounds.maxLon
        ) {
          resetParticle(p);
          continue;
        }

        const screenStart = map.latLngToContainerPoint([p.lat, p.lon]);
        const vec = getWindVector(p.lat, p.lon);
        const nextLat = p.lat + vec.v * p.speed;
        const nextLon = p.lon + vec.u * p.speed;
        const screenEnd = map.latLngToContainerPoint([nextLat, nextLon]);

        const speedMag = Math.sqrt(vec.u * vec.u + vec.v * vec.v);

        if (
          screenStart.x >= 0 &&
          screenStart.x <= width &&
          screenStart.y >= 0 &&
          screenStart.y <= height
        ) {
          const alpha = Math.sin((p.age / p.maxAge) * Math.PI);
          ctx.strokeStyle = getColor(speedMag);
          ctx.globalAlpha = alpha * 0.8;
          ctx.beginPath();
          ctx.moveTo(screenStart.x, screenStart.y);
          ctx.lineTo(screenEnd.x, screenEnd.y);
          ctx.stroke();
        }

        p.lat = nextLat;
        p.lon = nextLon;
        p.age++;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      map.off('resize', onResize);
      if (canvas && container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, [map, speedMultiplier, opacity]);

  return null;
}
