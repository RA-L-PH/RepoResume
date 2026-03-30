import { useEffect, useRef, useMemo } from 'react'

export function PointerBackground({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const dims = useRef({ w: 0, h: 0 });
  const waves = useRef<any[]>([]);

  const colors = useMemo(() => ['#818cf8', '#f472b6', '#a78bfa', '#6366f1', '#c084fc'], []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const particleCount = 1800;
    const particles: any[] = [];
    
    const init = () => {
      dims.current = { w: window.innerWidth, h: window.innerHeight };
      canvas.width = dims.current.w;
      canvas.height = dims.current.h;
      
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          ox: Math.random() * dims.current.w,
          oy: Math.random() * dims.current.h,
          x: 0, y: 0, // Current Offset
          targetX: 0, targetY: 0,
          w: Math.random() * 8 + 6,
          h: 1.0,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 0,
          targetOpacity: 0,
          impulseX: 0, impulseY: 0
        });
      }
    };

    const handleResize = () => init();
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseDown = (e: MouseEvent) => {
      // 1. RADIATION WAVE
      waves.current.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });
      
      // 2. DIRECT IMPULSE (Newton's 3rd Law Push)
      for (let p of particles) {
        const dx = p.ox + p.x - e.clientX;
        const dy = p.oy + p.y - e.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 400) {
          const force = (1 - dist / 400) * 80;
          const angle = Math.atan2(dy, dx);
          p.impulseX += Math.cos(angle) * force;
          p.impulseY += Math.sin(angle) * force;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    init();

    let frameId: number;
    let time = 0;

    const animate = () => {
      time += 0.015;
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = theme === 'dark' ? '#0c0c0e' : '#ffffff';
      ctx.fillRect(0, 0, dims.current.w, dims.current.h);

      for (let w of waves.current) {
        w.r += 10;
        w.life *= 0.985;
      }
      waves.current = waves.current.filter(w => w.life > 0.01);

      for (let p of particles) {
        const dx = p.ox + p.x - mouse.current.x;
        const dy = p.oy + p.y - mouse.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const angle = Math.atan2(dy, dx);
        const radius = 330 + Math.sin(angle * 4 + time) * 35;

        let waveForceX = 0;
        let waveForceY = 0;
        let waveBright = 0;

        for (let w of waves.current) {
           const wdx = p.ox + p.x - w.x;
           const wdy = p.oy + p.y - w.y;
           const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
           const edgeDist = Math.abs(wdist - w.r);
           
           if (edgeDist < 80) {
              const power = (1 - edgeDist / 80) * w.life;
              const flicker = Math.sin(wdist / 15 - time * 8) * 12;
              const wAngle = Math.atan2(wdy, wdx);
              waveForceX += Math.cos(wAngle) * (15 + flicker) * power;
              waveForceY += Math.sin(wAngle) * (15 + flicker) * power;
              waveBright += power * 1.5;
           }
        }

        // Apply Impulse decay (The instant push on click)
        p.x += p.impulseX;
        p.y += p.impulseY;
        p.impulseX *= 0.88;
        p.impulseY *= 0.88;

        if (dist < radius) {
          const force = Math.pow(1 - dist / radius, 1.4);
          const repulsionX = (dx / dist) * radius * force;
          const repulsionY = (dy / dist) * radius * force;
          
          p.x += (repulsionX + waveForceX - p.x) * 0.12;
          p.y += (repulsionY + waveForceY - p.y) * 0.12;
          p.targetOpacity = force; 
        } else if (waveBright > 0.01) {
          p.x += (waveForceX - p.x) * 0.12;
          p.y += (waveForceY - p.y) * 0.12;
          p.targetOpacity = waveBright * 0.5;
        } else {
          p.x *= 0.85; // Natural return to Origin
          p.y *= 0.85;
          p.targetOpacity = 0;
        }

        p.opacity += (p.targetOpacity - p.opacity) * 0.1;

        if (p.opacity > 0.01) {
          ctx.save();
          ctx.translate(p.ox + p.x, p.oy + p.y);
          ctx.rotate(angle);
          
          ctx.globalAlpha = Math.min(1.0, p.opacity + waveBright);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2 - 1, -p.h / 2 - 1, p.w + 2, p.h + 2);
          
          if (p.opacity > 0.6 || waveBright > 0.4) {
             ctx.globalAlpha = Math.min(1.0, (p.opacity + waveBright - 0.5) * 0.9);
             ctx.fillStyle = '#ffffff';
             ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          }
          ctx.restore();
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(frameId);
    };
  }, [colors, theme]);

  return (
    <div className="fixed inset-0 z-0 bg-[#0c0c0e] overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
