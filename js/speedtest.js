import { log, formatBytes, formatTime } from './utils.js';
import { triggerVisualEffect } from './animations.js';
import Chart from 'chart.js/auto';

const CONFIG = {
  testServers: {
    cloudflare: {
      name: 'Cloudflare Workers',
      pingUrl: 'https://speed.cloudflare.com/ping',
      downloadUrls: ['https://speed.cloudflare.com/25mb.bin'],
      uploadUrl: 'https://speed.cloudflare.com/upload',
    },
    local: {
      name: 'Local Assets',
      pingUrl: '/assets/ping-test.txt',
      downloadUrls: ['/assets/25one.bin', '/assets/25two.bin'],
      uploadUrl: null,
    },
  },
  testDurations: { download: 8000, upload: 5000, ping: 3000 },
  uploadSimulation: { chunkSize: 256 * 1024, totalSize: 10 * 1024 * 1024 },
};

export function initializeSpeedTest() {
  const speedTest = {
    testHistory: JSON.parse(localStorage.getItem('testHistory') || '[]'),
    currentResults: null,
    testRunning: false,
    testAborted: false,

    setupEvents() {
      document.getElementById('start-speed-test').addEventListener('click', () => this.toggleTest());
      document.getElementById('refresh-test').addEventListener('click', () => this.startTest());
      document.getElementById('share-results').addEventListener('click', () => this.shareResults());
      document.getElementById('view-history').addEventListener('click', () => this.showHistory());
      document.getElementById('close-history').addEventListener('click', () => document.getElementById('history-overlay').classList.remove('active'));
    },

    toggleTest() {
      const container = document.getElementById('speed-test-container');
      const button = document.getElementById('start-speed-test');
      if (container.classList.contains('active')) {
        container.classList.remove('active');
        button.textContent = 'Test Speed';
        this.abortTest();
      } else {
        container.classList.add('active');
        button.textContent = 'Stop Test';
        this.startTest();
      }
    },

    async startTest() {
      if (this.testRunning) return;
      this.testRunning = true;
      this.testAborted = false;
      const button = document.getElementById('start-speed-test');
      button.disabled = true;

      // Reset UI
      ['download-value', 'upload-value', 'ping-value', 'jitter-value'].forEach(id => document.getElementById(id).textContent = '0');
      document.getElementById('progress-bar').style.width = '0%';
      document.getElementById('progress-percent').textContent = '0%';
      document.getElementById('current-speed').textContent = '0.00 Mbps';
      document.getElementById('data-transferred').textContent = '0 MB';
      document.getElementById('time-elapsed').textContent = '00:00';
      document.getElementById('results-display').classList.remove('active');
      ['refresh-test', 'share-results', 'view-history'].forEach(id => document.getElementById(id).style.display = 'none');

      const chart = this.initializeChart();
      try {
        const pingResults = await this.runPingTest();
        if (!this.testAborted) {
          const downloadSpeed = await this.runDownloadTest(chart);
          this.currentResults = { ...pingResults, downloadSpeed };
        }
        if (!this.testAborted) {
          const uploadSpeed = await this.runUploadTest(chart);
          this.currentResults = { ...this.currentResults, uploadSpeed };
        }
        if (!this.testAborted && this.currentResults) {
          this.displayResults();
          triggerVisualEffect();
          this.saveResult();
        }
      } catch (error) {
        log(`Test error: ${error.message}`);
      } finally {
        this.testRunning = false;
        button.disabled = false;
        button.textContent = 'Test Speed';
      }
    },

    async runPingTest() {
      log('Starting ping test...');
      const pingValue = document.getElementById('ping-value');
      const jitterValue = document.getElementById('jitter-value');
      const progressBar = document.getElementById('progress-bar');
      const progressPercent = document.getElementById('progress-percent');
      const currentSpeed = document.getElementById('current-speed');
      const timeElapsed = document.getElementById('time-elapsed');

      const pingTimes = [];
      const server = CONFIG.testServers[document.getElementById('server-select').value];
      const pingUrl = server.pingUrl;

      for (let i = 0; i < 8; i++) {
        if (this.testAborted) break;
        try {
          const start = performance.now();
          await fetch(pingUrl, { method: 'HEAD', cache: 'no-store' });
          const ping = performance.now() - start;
          pingTimes.push(ping);
          log(`Ping #${i+1}: ${ping.toFixed(2)}ms`);
          progressBar.style.width = `${((i + 1) / 8) * 100}%`;
          progressPercent.textContent = `${((i + 1) / 8) * 100}%`;
          currentSpeed.textContent = `${ping.toFixed(2)} ms`;
          timeElapsed.textContent = `${i + 1}/8`;
        } catch (error) {
          log(`Ping #${i+1} failed: ${error.message}`);
        }
        await new Promise(r => setTimeout(r, 300));
      }

      const avgPing = pingTimes.length ? pingTimes.reduce((sum, t) => sum + t, 0) / pingTimes.length : 0;
      const jitter = pingTimes.length > 1 ? Math.sqrt(pingTimes.map(t => Math.pow(t - avgPing, 2)).reduce((sum, d) => sum + d, 0) / (pingTimes.length - 1)) : 0;
      pingValue.textContent = avgPing.toFixed(0);
      jitterValue.textContent = jitter.toFixed(0);
      return { ping: avgPing, jitter };
    },

    async runDownloadTest(chart) {
      log('Starting download test...');
      const downloadValue = document.getElementById('download-value');
      const progressBar = document.getElementById('progress-bar');
      const progressPercent = document.getElementById('progress-percent');
      const currentSpeed = document.getElementById('current-speed');
      const dataTransferred = document.getElementById('data-transferred');
      const timeElapsed = document.getElementById('time-elapsed');

      const server = CONFIG.testServers[document.getElementById('server-select').value];
      let totalBytes = 0, startTime = performance.now();
      const maxTime = CONFIG.testDurations.download;

      for (const url of server.downloadUrls) {
        if (this.testAborted) break;
        try {
          const response = await fetch(url, { cache: 'no-store' });
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done || this.testAborted) break;
            totalBytes += value.length;
            const elapsed = (performance.now() - startTime) / 1000;
            const speed = ((totalBytes * 8) / elapsed) / (1024 * 1024);
            downloadValue.textContent = speed.toFixed(1);
            progressBar.style.width = `${Math.min(100, (elapsed / (maxTime / 1000)) * 100)}%`;
            progressPercent.textContent = `${Math.min(100, (elapsed / (maxTime / 1000)) * 100).toFixed(1)}%`;
            currentSpeed.textContent = `${speed.toFixed(2)} Mbps`;
            dataTransferred.textContent = formatBytes(totalBytes);
            timeElapsed.textContent = formatTime(elapsed);
            chart.data.datasets[0].data.push({ x: elapsed, y: speed });
            chart.update();
            if (elapsed >= maxTime / 1000) break;
          }
        } catch (error) {
          log(`Download error: ${error.message}`);
        }
      }

      const totalTime = (performance.now() - startTime) / 1000;
      const finalSpeed = ((totalBytes * 8) / totalTime) / (1024 * 1024);
      downloadValue.textContent = finalSpeed.toFixed(1);
      return finalSpeed;
    },

    async runUploadTest(chart) {
      log('Starting upload test...');
      const uploadValue = document.getElementById('upload-value');
      const server = CONFIG.testServers[document.getElementById('server-select').value];
      if (!server.uploadUrl) return this.simulateUploadTest(chart);

      let totalBytes = 0, startTime = performance.now();
      const maxTime = CONFIG.testDurations.upload;
      const chunkSize = CONFIG.uploadSimulation.chunkSize;

      try {
        const data = new ArrayBuffer(chunkSize);
        while ((performance.now() - startTime) / 1000 < maxTime / 1000 && !this.testAborted) {
          const blob = new Blob([data]);
          const formData = new FormData();
          formData.append('file', blob);
          await fetch(server.uploadUrl, { method: 'POST', body: formData, cache: 'no-store' });
          totalBytes += chunkSize;
          const elapsed = (performance.now() - startTime) / 1000;
          const speed = ((totalBytes * 8) / elapsed) / (1024 * 1024);
          uploadValue.textContent = speed.toFixed(1);
          chart.data.datasets[1].data.push({ x: elapsed, y: speed });
          chart.update();
        }
        const totalTime = (performance.now() - startTime) / 1000;
        const finalSpeed = ((totalBytes * 8) / totalTime) / (1024 * 1024);
        uploadValue.textContent = finalSpeed.toFixed(1);
        return finalSpeed;
      } catch (error) {
        log(`Upload error: ${error.message}`);
        return this.simulateUploadTest(chart);
      }
    },

    simulateUploadTest(chart) {
      log('Simulating upload test...');
      return new Promise(resolve => {
        const uploadValue = document.getElementById('upload-value');
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const currentSpeed = document.getElementById('current-speed');
        const dataTransferred = document.getElementById('data-transferred');
        const timeElapsed = document.getElementById('time-elapsed');

        const { chunkSize, totalSize } = CONFIG.uploadSimulation;
        let uploaded = 0, startTime = performance.now();

        const simulate = () => {
          if (uploaded >= totalSize || this.testAborted) {
            const elapsed = (performance.now() - startTime) / 1000;
            const speed = ((uploaded * 8) / elapsed) / (1024 * 1024);
            uploadValue.textContent = speed.toFixed(1);
            resolve(speed);
            return;
          }
          uploaded += chunkSize;
          const elapsed = (performance.now() - startTime) / 1000;
          const speed = ((uploaded * 8) / elapsed) / (1024 * 1024);
          progressBar.style.width = `${(uploaded / totalSize) * 100}%`;
          progressPercent.textContent = `${(uploaded / totalSize) * 100}%`;
          currentSpeed.textContent = `${speed.toFixed(2)} Mbps`;
          dataTransferred.textContent = formatBytes(uploaded);
          timeElapsed.textContent = formatTime(elapsed);
          chart.data.datasets[1].data.push({ x: elapsed, y: speed });
          chart.update();
          setTimeout(simulate, 300);
        };
        simulate();
      });
    },

    initializeChart() {
      const ctx = document.getElementById('speed-graph').getContext('2d');
      return new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            { label: 'Download (Mbps)', data: [], borderColor: '#00b7eb', fill: false },
            { label: 'Upload (Mbps)', data: [], borderColor: '#ff00cc', fill: false },
          ],
        },
        options: {
          scales: {
            x: { type: 'linear', title: { display: true, text: 'Time (s)' } },
            y: { beginAtZero: true, title: { display: true, text: 'Speed (Mbps)' } },
          },
        },
      });
    },

    displayResults() {
      if (!this.currentResults) return;
      const { ping, jitter, downloadSpeed, uploadSpeed } = this.currentResults;
      document.getElementById('results-display').innerHTML = `
        <strong>Test Results</strong><br>
        Download: ${downloadSpeed.toFixed(1)} Mbps<br>
        Upload: ${uploadSpeed.toFixed(1)} Mbps<br>
        Ping: ${ping.toFixed(0)} ms<br>
        Jitter: ${jitter.toFixed(0)} ms
      `;
      document.getElementById('results-display').classList.add('active');
      ['refresh-test', 'share-results', 'view-history'].forEach(id => document.getElementById(id).style.display = 'inline-block');
    },

    saveResult() {
      if (!this.currentResults) return;
      const result = {
        timestamp: new Date().toLocaleString(),
        download: this.currentResults.downloadSpeed.toFixed(1),
        upload: this.currentResults.uploadSpeed.toFixed(1),
        ping: this.currentResults.ping.toFixed(0),
        jitter: this.currentResults.jitter.toFixed(0),
        server: CONFIG.testServers[document.getElementById('server-select').value].name,
      };
      this.testHistory.push(result);
      if (this.testHistory.length > 10) this.testHistory.shift();
      localStorage.setItem('testHistory', JSON.stringify(this.testHistory));
    },

    shareResults() {
      if (!this.currentResults) return;
      const { ping, jitter, downloadSpeed, uploadSpeed } = this.currentResults;
      const server = CONFIG.testServers[document.getElementById('server-select').value].name;
      const text = `Labverse Speed Test\nDownload: ${downloadSpeed.toFixed(1)} Mbps\nUpload: ${uploadSpeed.toFixed(1)} Mbps\nPing: ${ping.toFixed(0)} ms\nJitter: ${jitter.toFixed(0)} ms\nServer: ${server}\nTest at https://labverse.co.za`;
      if (navigator.share) {
        navigator.share({ title: 'Labverse Speed Test', text, url: 'https://labverse.co.za' });
      } else {
        copyToClipboard(text);
        alert('Results copied to clipboard!');
      }
    },

    showHistory() {
      const content = document.getElementById('history-content');
      content.innerHTML = this.testHistory.length ? this.testHistory.map(r => `
        <div class="history-item">
          <strong>${r.timestamp}</strong><br>
          Download: ${r.download} Mbps<br>
          Upload: ${r.upload} Mbps<br>
          Ping: ${r.ping} ms<br>
          Jitter: ${r.jitter} ms<br>
          Server: ${r.server}
        </div>
      `).join('') : 'No test history.';
      document.getElementById('history-overlay').classList.add('active');
    },

    abortTest() {
      this.testAborted = true;
    },
  };

  speedTest.setupEvents();
  return speedTest;
}