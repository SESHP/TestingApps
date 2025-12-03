// src/components/LoadingScreen.js
import React, { useEffect, useRef, useState } from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ onLoadComplete }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: null, y: null });
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const phrases = [
    "Собираем подарки...",
    "Подкручиваем реф коды...",
    "Проверяем гарантии...",
    "Полируем интерфейс...",
    "Синхронизируем TON...",
    "Почти готово..."
  ];

  const settings = {
    density: 5,
    particleSize: 0.5,
    repulseRadius: 50,
    moveSpeed: 0.7,
    returnSpeed: 0.05,
    friction: 0.9
  };

  useEffect(() => {
    // Смена фраз
    const phraseInterval = setInterval(() => {
      setCurrentPhrase(prev => (prev + 1) % phrases.length);
    }, 2000);

    // Имитация загрузки (можешь заменить на реальную логику)
    const loadTimer = setTimeout(() => {
      setIsLoaded(true);
      setTimeout(() => {
        if (onLoadComplete) onLoadComplete();
      }, 800);
    }, 6000); // 6 секунд загрузки

    return () => {
      clearInterval(phraseInterval);
      clearTimeout(loadTimer);
    };
  }, [onLoadComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class Particle {
      constructor(x, y, color) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 200;
        
        this.x = centerX + Math.cos(angle) * distance;
        this.y = centerY + Math.sin(angle) * distance;
        this.targetX = x;
        this.targetY = y;
        this.originX = x;
        this.originY = y;
        
        this.vx = 0;
        this.vy = 0;
        this.color = color;
        this.size = 0;
        this.targetSize = settings.particleSize;
        
        this.appearProgress = 0;
        this.appearDelay = Math.random() * 100;
        this.appeared = false;
        
        this.noiseOffset = Math.random() * 1000;
        this.noiseSpeed = 0.005 + Math.random() * 0.005;
        
        this.flickerOffset = Math.random() * Math.PI * 2;
        this.flickerSpeed = 0.02 + Math.random() * 0.03;
      }

      update(time) {
        if (!this.appeared) {
          if (time > this.appearDelay) {
            this.appeared = true;
          } else {
            return;
          }
        }

        if (this.appearProgress < 1) {
          this.appearProgress += 0.02;
          this.size = this.targetSize * this.appearProgress;
        }

        const mouse = mouseRef.current;
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < settings.repulseRadius) {
            const force = (settings.repulseRadius - distance) / settings.repulseRadius;
            const angle = Math.atan2(dy, dx);
            const pushForce = force * 4;
            
            this.vx -= Math.cos(angle) * pushForce;
            this.vy -= Math.sin(angle) * pushForce;
          }
        }

        this.noiseOffset += this.noiseSpeed;
        const noiseX = Math.sin(this.noiseOffset) * settings.moveSpeed * 0.3;
        const noiseY = Math.cos(this.noiseOffset * 1.3) * settings.moveSpeed * 0.3;
        this.vx += noiseX;
        this.vy += noiseY;

        const returnX = (this.originX - this.x) * settings.returnSpeed;
        const returnY = (this.originY - this.y) * settings.returnSpeed;
        this.vx += returnX;
        this.vy += returnY;

        this.vx *= settings.friction;
        this.vy *= settings.friction;

        this.x += this.vx;
        this.y += this.vy;
      }

      draw(time) {
        if (!this.appeared || this.size === 0) return;

        const flicker = 0.7 + Math.sin(time * this.flickerSpeed + this.flickerOffset) * 0.3;

        const gradient = ctx.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.size * 2.5
        );

        const rgb = this.color;
        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${flicker})`);
        gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${flicker * 0.5})`);
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${flicker})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const loadImage = () => {
      const img = new Image();
      img.src = '/logo.png'; // Путь к логотипу в public/
      
      img.onload = () => {
        initParticles(img);
      };

      img.onerror = () => {
        console.error('Не удалось загрузить логотип. Убедитесь что файл находится в public/logo.png');
      };
    };

    const initParticles = (img) => {
      particlesRef.current = [];
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      const maxWidth = 400;
      const maxHeight = 400;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      
      tempCanvas.width = scaledWidth;
      tempCanvas.height = scaledHeight;
      tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
      
      const imageData = tempCtx.getImageData(0, 0, scaledWidth, scaledHeight);
      const pixels = imageData.data;
      
      const offsetX = (canvas.width - scaledWidth) / 2;
      const offsetY = (canvas.height - scaledHeight) / 2;
      
      const gap = settings.density;
      
      for (let y = 0; y < scaledHeight; y += gap) {
        for (let x = 0; x < scaledWidth; x += gap) {
          const index = (y * scaledWidth + x) * 4;
          const alpha = pixels[index + 3];
          
          if (alpha > 128) {
            const r = pixels[index];
            const g = pixels[index + 1];
            const b = pixels[index + 2];
            
            particlesRef.current.push(new Particle(
              x + offsetX,
              y + offsetY,
              { r, g, b }
            ));
          }
        }
      }
      
      animate();
    };

    const animate = () => {
      const currentTime = Date.now() - startTimeRef.current;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      particlesRef.current.forEach(particle => {
        particle.update(currentTime);
        particle.draw(currentTime);
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY
      };
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        mouseRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: null, y: null };
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cancelAnimationFrame(animationFrameRef.current);
      startTimeRef.current = Date.now();
      loadImage();
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    loadImage();

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className={`loading-screen ${isLoaded ? 'fade-out' : ''}`}>
      <canvas ref={canvasRef} className="particles-canvas" />
      <div className="loading-content">
        <div className="loading-phrase">
          {phrases[currentPhrase]}
        </div>
        <div className="loading-bar">
          <div className="loading-bar-fill"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;