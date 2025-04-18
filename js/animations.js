import * as THREE from 'three';
import { gsap } from 'gsap';

export function initializeAnimations() {
  const canvas = document.getElementById('background-canvas');
  let scene, camera, renderer, particles = [];

  try {
    // Initialize WebGL
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.position.z = 50;

    // Particle System
    const createParticle = (index) => {
      const phi = (1 + Math.sqrt(5)) / 2;
      const theta = index * 2 * Math.PI * phi;
      const r = Math.sqrt(index) * 0.8;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([r * Math.cos(theta), r * Math.sin(theta), 0], 3));
      const material = new THREE.PointsMaterial({
        color: 0x00b7eb,
        size: 0.3,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      const particle = new THREE.Points(geometry, material);
      scene.add(particle);
      return { obj: particle, life: 10, velocity: new THREE.Vector3(0, 0, 0) };
    };

    for (let i = 0; i < 50; i++) particles.push(createParticle(i));

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      particles.forEach(p => {
        p.life -= 1 / 60;
        if (p.life <= 0) {
          scene.remove(p.obj);
          p.obj.geometry.dispose();
          p.obj.material.dispose();
          particles.splice(particles.indexOf(p), 1);
          particles.push(createParticle(particles.length));
        }
        p.obj.position.add(p.velocity);
        p.obj.material.opacity = p.life / 10;
        p.velocity.multiplyScalar(0.98);
      });
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });

    // Visual Effect
    window.triggerVisualEffect = () => {
      particles.forEach(p => scene.remove(p.obj));
      particles = [];
      const colors = [0x00b7eb, 0xff00cc, 0x00ffff, 0xffd700];
      for (let i = 0; i < 100; i++) {
        const theta = i * 2 * Math.PI * ((1 + Math.sqrt(5)) / 2);
        const r = Math.sqrt(i) * 1.5;
        const particle = createParticle(i);
        particle.velocity = new THREE.Vector3(r * Math.cos(theta) * 0.1, r * Math.sin(theta) * 0.1, 0);
        particle.obj.material.color.set(colors[Math.floor(Math.random() * colors.length)]);
        particles.push(particle);
      }
      gsap.to(canvas, { opacity: 1, duration: 0.5 });
    };
  } catch (error) {
    console.error('WebGL Error:', error);
    document.getElementById('error-message').style.display = 'block';
  }
}

export { triggerVisualEffect };