import { initializeAnimations, triggerVisualEffect } from './animations.js';
import { fetchIP, fetchLocationInfo } from './network.js';
import { initializeSpeedTest } from './speedtest.js';
import { copyToClipboard } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize systems
  initializeAnimations();
  initializeSpeedTest();
  await Promise.all([fetchIP(), fetchLocationInfo()]);

  // Copy IP button
  document.getElementById('copy-ip-btn').addEventListener('click', () => {
    const ip = document.getElementById('ip-display').textContent;
    if (ip !== 'Fetching IP...' && ip !== 'IP unavailable') {
      copyToClipboard(ip);
      triggerVisualEffect();
      alert('IP copied to clipboard!');
    }
  });
});
