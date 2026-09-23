'use client';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface WindFieldProps {
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
  typhoon, 
  typhoonCenter,
  speedMultiplier = 1.0, 
  opacity = 0.85 
}: WindFieldProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // 建立獨立的 Canvas 疊加層
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

    // 粒子數量 (依螢幕大小動態配置，維持 60 FPS 極速順暢)
    const PARTICLE_COUNT = Math.min(1800, Math.floor((width * height) / 600));
    const particles: Particle[] = [];

    const getBounds = () => {
      const b = map.getBounds();
      return {
        minLat: b.getSouth() - 2,
        maxLat: b.getNorth() + 2,
        minLon: b.getWest() - 3,
        maxLon: b.getEast() + 3,
      };
    };

    const resetParticle = (p: Particle) => {
      const b = getBounds();
      p.lat = b.minLat + Math.random() * (b.maxLat - b.minLat);
      p.lon = b.minLon + Math.random() * (b.maxLon - b.minLon);
      p.age = 0;
      p.maxAge = 40 + Math.floor(Math.random() * 50);
      p.speed = 0.8 + Math.random() * 0.7;
    };

    // 初始化粒子
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p: Particle = { lat: 0, lon: 0, age: 0, maxAge: 0, speed: 1 };
      resetParticle(p);
      p.age = Math.floor(Math.random() * p.maxAge); // 隨機初始壽命避免同時重生
      particles.push(p);
    }

    // 計算指定經緯度之風向風速向量 (u: 經度方向, v: 緯度方向)
    const getWindVector = (lat: number, lon: number) => {
      // 1. 背景環境氣流：台灣盛行之東北季風/太平洋高壓環流 (自東北往西南流動)
      let u = -0.045; // 向西
      let v = -0.022; // 向南

      // 台灣地形阻擋與海峽噴流效應 (流經台灣海峽加速，繞過中央山脈)
      const nearTaiwan = lat > 21.5 && lat < 25.5 && lon > 119.5 && lon < 122.2;
      if (nearTaiwan) {
        // 台灣海峽風道加速
        if (lon < 120.6) {
          u *= 1.4;
          v *= 1.5;
        } else if (lon > 120.8 && lon < 121.8) {
          // 中央山脈背風/阻擋弱風
          u *= 0.5;
          v *= 0.6;
        }
      }

      // 2. 颱風強烈氣旋渦流 (北半球逆時針旋轉 + 向心輻合氣流)
      const center = typhoonCenter || (typhoon?.current ? { lat: typhoon.current.lat, lon: typhoon.current.lon } : null);
      if (center) {
        const dLat = lat - center.lat;
        const dLon = lon - center.lon;
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);

        // 颱風影響半徑約 12 度經緯度
        if (dist < 14) {
          // 逆時針旋轉切線角 + 內收向心角 (約 18 度輻合)
          const angle = Math.atan2(dLat, dLon) + Math.PI / 2 - 0.32;
          
          // 近中心風速最大 (Rankine 渦旋模型)
          const radiusScale = (typhoon.current?.radius7 || 100) / 110; // 轉經緯度約 1-2 度
          let vortexSpeed = 0;
          if (dist < 0.4) {
            // 颱風眼內風速驟降
            vortexSpeed = (dist / 0.4) * 0.12;
          } else {
            // 眼牆外風速向外遞減
            vortexSpeed = 0.22 * Math.exp(-(dist - 0.4) / (radiusScale * 2.8));
          }

          const weight = Math.max(0, 1 - (dist / 14));
          u = u * (1 - weight) + Math.cos(angle) * vortexSpeed * weight;
          v = v * (1 - weight) + Math.sin(angle) * vortexSpeed * weight;
        }
      }

      return { u: u * speedMultiplier, v: v * speedMultiplier };
    };

    // 速度轉色彩 (柔和螢光 Cyber 漸層)
    const getColor = (speedMag: number) => {
      if (speedMag > 0.14) return '#f43f5e'; // 強烈風暴 (霓虹粉紅)
      if (speedMag > 0.09) return '#facc15'; // 強風 (螢光黃)
      if (speedMag > 0.05) return '#34d399'; // 中度風 (電光綠)
      return '#38bdf8';                     // 微風 (天空冰藍)
    };

    // 每一幀的渲染循環
    const render = () => {
      // 半透明背景重繪產生粒子拖曳尾跡 (流線感)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';

      const bounds = getBounds();

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];

        // 超出邊界或過期則重新產生
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

        // 計算向量與移動
        const vec = getWindVector(p.lat, p.lon);
        const nextLat = p.lat + vec.v * p.speed;
        const nextLon = p.lon + vec.u * p.speed;
        const screenEnd = map.latLngToContainerPoint([nextLat, nextLon]);

        const speedMag = Math.sqrt(vec.u * vec.u + vec.v * vec.v);

        // 螢幕內部才繪製
        if (
          screenStart.x >= 0 &&
          screenStart.x <= width &&
          screenStart.y >= 0 &&
          screenStart.y <= height
        ) {
          const alpha = Math.sin((p.age / p.maxAge) * Math.PI); // 淡入淡出
          ctx.strokeStyle = getColor(speedMag);
          ctx.globalAlpha = alpha * 0.75;
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
  }, [map, typhoon, typhoonCenter, speedMultiplier, opacity]);

  return null;
}
