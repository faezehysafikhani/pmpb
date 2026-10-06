import React, { useEffect, useRef } from 'react';

interface Sphere {
  x: number;
  y: number;
  z: number; // For 3D depth perception (0.5 to 1.5 scale)
  radius: number;
  baseRadius: number;
  vx: number;
  vy: number;
  vz: number;
  alpha: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export const FloatingSpheresCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates for gentle interactive repulsion
    let mouseX = -1000;
    let mouseY = -1000;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Generate solid white floating spheres of various sizes and depths
    const sphereCount = Math.max(35, Math.min(65, Math.floor((width * height) / 24000)));
    const spheres: Sphere[] = [];

    for (let i = 0; i < sphereCount; i++) {
      const baseRadius = 8 + Math.random() * 32; // Solid white balls ranging from 8px to 40px
      const z = 0.5 + Math.random() * 1.0;
      spheres.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        baseRadius,
        radius: baseRadius * z,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7 - 0.2, // Slight upward natural drift
        vz: (Math.random() - 0.5) * 0.002,
        alpha: 0.75 + Math.random() * 0.25, // Solid white appearance (75% to 100% solid opacity)
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.015 + Math.random() * 0.02
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Sort spheres by z for natural depth rendering
      spheres.sort((a, b) => a.z - b.z);

      for (let i = 0; i < spheres.length; i++) {
        const s = spheres[i];

        // Animate position
        s.x += s.vx;
        s.y += s.vy;
        s.z += s.vz;
        s.pulsePhase += s.pulseSpeed;

        // Keep z in bounds
        if (s.z < 0.4) {
          s.z = 0.4;
          s.vz *= -1;
        } else if (s.z > 1.6) {
          s.z = 1.6;
          s.vz *= -1;
        }

        // Subtly update radius with breathing pulse & depth
        const pulse = 1 + Math.sin(s.pulsePhase) * 0.04;
        s.radius = s.baseRadius * s.z * pulse;

        // Gentle interactive mouse repulsion
        const dx = s.x - mouseX;
        const dy = s.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = 140 + s.radius;

        if (dist < minDist && dist > 0) {
          const force = (minDist - dist) / minDist;
          s.x += (dx / dist) * force * 3;
          s.y += (dy / dist) * force * 3;
        }

        // Wrap around screen boundaries with margin
        const pad = s.radius + 20;
        if (s.x < -pad) s.x = width + pad;
        if (s.x > width + pad) s.x = -pad;
        if (s.y < -pad) s.y = height + pad;
        if (s.y > height + pad) s.y = -pad;

        // Draw 3D Solid White Sphere with realistic lighting & depth
        // Highlight offset for 3D sphere illusion
        const highlightOffsetX = s.radius * 0.32;
        const highlightOffsetY = s.radius * 0.32;
        const highlightRadius = s.radius * 0.12;

        ctx.save();

        // 1. Soft ambient drop shadow beneath the solid sphere
        ctx.shadowColor = `rgba(0, 0, 0, ${0.18 * s.z})`;
        ctx.shadowBlur = 14 * s.z;
        ctx.shadowOffsetX = 3 * s.z;
        ctx.shadowOffsetY = 6 * s.z;

        // 2. Radial Gradient creating a solid 3D white sphere
        const grad = ctx.createRadialGradient(
          s.x - highlightOffsetX,
          s.y - highlightOffsetY,
          highlightRadius,
          s.x,
          s.y,
          s.radius
        );

        // Solid white sphere shades: Pure bright specular highlight to solid pristine white to subtle shaded contour
        grad.addColorStop(0, `rgba(255, 255, 255, ${s.alpha})`);
        grad.addColorStop(0.25, `rgba(255, 255, 255, ${s.alpha})`);
        grad.addColorStop(0.65, `rgba(240, 244, 248, ${s.alpha})`);
        grad.addColorStop(0.9, `rgba(215, 226, 236, ${s.alpha})`);
        grad.addColorStop(1, `rgba(185, 200, 215, ${s.alpha * 0.95})`);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // 3. Crisp edge rim highlight for pure 3D glass/ceramic solid feel
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * s.alpha})`;
        ctx.lineWidth = Math.max(1, 1.5 * s.z);
        ctx.stroke();

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
    />
  );
};
