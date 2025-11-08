// src/components/SpaceBackground.js

import React, { useEffect, useRef } from 'react';

const SpaceBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Настройки
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles = [];
    const numParticles = 100;

    // Создаём треугольники
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        color: '#240059',
      });
    }

    // Рисуем треугольники
    function draw() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.lineTo(p.x + p.size / 2, p.y + p.size);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    }

    // Обновляем позиции
    function update() {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;

        // Отскок от краёв
        if (p.x < 0 || p.x > width) p.speedX *= -1;
        if (p.y < 0 || p.y > height) p.speedY *= -1;
      }
    }

    // Анимация
    function animate() {
      update();
      draw();
      requestAnimationFrame(animate);
    }

    animate();

    // Реакция на движения пальца
    canvas.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = p.x - touch.clientX;
        const dy = p.y - touch.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          p.speedX += dx * 0.01;
          p.speedY += dy * 0.01;
        }
      }
    });

    return () => {
      canvas.removeEventListener('touchmove', animate);
    };
  }, []);

  return <canvas ref={canvasRef} className="space-canvas" />;
};

export default SpaceBackground;
