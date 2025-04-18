import { initializeAnimations, triggerVisualEffect } from './animations.js';
import { fetchIP, fetchLocationInfo } from './network.js';
import { initializeSpeedTest } from './speedtest.js';
import { copyToClipboard } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('theme', newTheme);
  });

  // Copy IP
  document.getElementById('copy-ip-btn').addEventListener('click', () => {
    const ip = document.getElementById('ip-display').textContent;
    if (ip !== 'IP unavailable') {
      copyToClipboard(ip);
      triggerVisualEffect();
    }
  });

  // Initialize Systems
  initializeAnimations();
  initializeSpeedTest();
  await Promise.all([fetchIP(), fetchLocationInfo()]);

  // Easter Egg
  window.addEventListener('keydown', (e) => {
    if (e.key === 'x') triggerVisualEffect();
  });
});