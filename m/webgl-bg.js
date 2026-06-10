/**
 * webgl-bg.js
 * High-performance lightweight particle system simulating molten sparks/embers
 * that drift upwards, reacting to mouse movement.
 */
(function() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles = [];
    const maxParticles = 60;
    const mouse = { x: null, y: null, radius: 150 };

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
        mouse.x = null;
        mouse.y = null;
    });

    // Handle clicks for splash effects
    window.addEventListener('click', (e) => {
        createSplash(e.clientX, e.clientY);
    });

    class Particle {
        constructor(x, y, isSplash = false) {
            this.x = x || Math.random() * width;
            this.y = y || (isSplash ? y : height + Math.random() * 100);
            this.size = Math.random() * (isSplash ? 4 : 3) + 1;
            this.speedX = Math.random() * 0.8 - 0.4;
            this.speedY = isSplash ? (Math.random() * 4 - 2) : -(Math.random() * 1.2 + 0.4);
            
            // Check theme dynamically to set colors
            const isLight = document.body.classList.contains('light-theme');
            let colors;
            if (isLight) {
                // High contrast dark blue/indigo sparks for light background
                colors = ['rgba(30, 58, 138, ', 'rgba(2, 132, 199, ', 'rgba(29, 78, 216, ', 'rgba(3, 105, 161, '];
            } else {
                // Electric cyan/blue/white sparks for dark background
                colors = ['rgba(56, 189, 248, ', 'rgba(14, 165, 233, ', 'rgba(34, 211, 238, ', 'rgba(255, 255, 255, '];
            }
            this.colorBase = colors[Math.floor(Math.random() * colors.length)];
            
            this.alpha = isSplash ? 1.0 : Math.random() * 0.5 + 0.2;
            this.decay = isSplash ? (Math.random() * 0.03 + 0.01) : 0;
            this.isSplash = isSplash;
            this.wobble = Math.random() * 10;
            this.wobbleSpeed = Math.random() * 0.02 + 0.01;
        }

        update() {
            // Apply mouse repulsion/attraction forces
            if (mouse.x !== null && mouse.y !== null) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const distance = Math.hypot(dx, dy);
                if (distance < mouse.radius) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    // Push particles away from mouse
                    this.x += (dx / distance) * force * 1.5;
                    this.y += (dy / distance) * force * 1.5;
                }
            }

            this.x += this.speedX + Math.sin(this.wobble) * 0.1;
            this.y += this.speedY;
            this.wobble += this.wobbleSpeed;

            if (this.isSplash) {
                this.alpha -= this.decay;
            } else {
                // Fade out near top of screen
                if (this.y < height * 0.8) {
                    this.alpha -= 0.002;
                }
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            
            // Glowing effect
            const alphaVal = Math.max(0, this.alpha);
            ctx.fillStyle = this.colorBase + alphaVal + ')';
            ctx.shadowBlur = this.isSplash ? 10 : 5;
            
            const isLight = document.body.classList.contains('light-theme');
            ctx.shadowColor = isLight ? 'rgba(30, 58, 138, 0.3)' : 'rgba(2, 132, 199, 0.5)';
            
            ctx.fill();
            ctx.shadowBlur = 0; // Reset
        }
    }

    function createSplash(x, y) {
        // Limit splash particles to keep page lite
        const numSplash = Math.min(15, 30);
        for (let i = 0; i < numSplash; i++) {
            particles.push(new Particle(x, y, true));
        }
    }

    // Populate initial particles
    for (let i = 0; i < maxParticles; i++) {
        const p = new Particle();
        p.y = Math.random() * height; // Distribute across vertical height
        particles.push(p);
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Slow glow background layer
        const gradient = ctx.createRadialGradient(width/2, height, 50, width/2, height, height);
        const isLight = document.body.classList.contains('light-theme');
        if (isLight) {
            gradient.addColorStop(0, 'rgba(30, 58, 138, 0.04)'); // Subtle navy glow
        } else {
            gradient.addColorStop(0, 'rgba(2, 132, 199, 0.03)'); // Subtle cyan/blue glow
        }
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            p.draw();

            // Remove dead or off-screen particles
            if (p.alpha <= 0 || p.y < -10 || p.x < -10 || p.x > width + 10) {
                particles.splice(i, 1);
                // Replenish background embers
                if (!p.isSplash && particles.filter(x => !x.isSplash).length < maxParticles) {
                    particles.push(new Particle());
                }
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
})();
