import { log, formatBytes, formatTime } from './utils.js';
import { triggerVisualEffect } from './animations.js';

const CONFIG = {
  testServer: {
    pingUrl: '/assets/ping-test.txt',
    downloadUrl: '/assets/25mb.bin',
    uploadSimulation: { chunkSize: 256 * 1024, totalSize: 10 * 1024 * 1024 },
  },
  testDurations: { download: 8000, upload: 5000, ping: 3000 },
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
      ['download-value', 'upload-value', 'ping-value', 'jitter-value', 'packet-loss-value'].forEach(id => document.getElementById(id).textContent = '0');
      document.getElementById('progress-bar').style.width = '0%';
      document.getElementById('progress-percent').textContent = '0%';
      document.getElementById('current-speed').textContent = '0.00 Mbps';
      document.getElementById('data-transferred').textContent = '0 MB';
      document.getElementById('time-elapsed').textContent = '00:00';
      ['refresh-test', 'share-results', 'view-history'].forEach(id => document.getElementById(id).style.display = 'none');

      try {
        const pingResults = await this.runPingTest();
        if (!this.testAborted) {
          const downloadSpeed = await this.runDownloadTest();
          this.currentResults = { ...pingResults, downloadSpeed };
        }
        if (!this.testAborted) {
          const uploadSpeed = await this.runUploadTest();
          this.currentResults = { ...this.currentResults, uploadSpeed };
        }
        if (!this.testAborted && this.currentResults) {
          this.displayResults();
          triggerVisualEffect();
          this.saveResult();
        }
      } catch (error) {
        log(`Test error: ${error.message}`);
        document.getElementById('error-message').style.display = 'block';
        document.getElementById('error-message').textContent = 'Speed test failed. Please try again.';
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
      const packetLossValue = document.getElementById('packet-loss-value');
      const progressBar = document.getElementById('progress-bar');
      const progressPercent = document.getElementById('progress-percent');
      const currentSpeed = document.getElementById('current-speed');
      const timeElapsed = document.getElementById('time-elapsed');

      const pingTimes = [];
      let packetsLost = 0;
      const totalPackets = 10;

      for (let i = 0; i < totalPackets; i++) {
        if (this.testAborted) break;
        try {
          const start = performance.now();
          await fetch(CONFIG.testServer.pingUrl, { method: 'HEAD', cache: 'no-store' });
          const ping = performance.now() - start;
          pingTimes.push(ping);
          log(`Ping #${i+1}: ${ping.toFixed(2)}ms`);
        } catch (error) {
          log(`Ping #${i+1} failed: ${error.message}`);
          packetsLost++;
        }
        progressBar.style.width = `${((i + 1) / totalPackets) * 100}%`;
        progressPercent.textContent = `${((i + 1) / totalPackets) * 100}%`;
        currentSpeed.textContent = `${pingTimes.length ? (pingTimes[pingTimes.length - 1]).toFixed(2) : 0} ms`;
        timeElapsed.textContent = `${i + 1}/${totalPackets}`;
        await new Promise(r => setTimeout(r, 300));
      }

      const avgPing = pingTimes.length ? pingTimes.reduce((sum, t) => sum + t, 0) / pingTimes.length : 0;
      const jitter = pingTimes.length > 1 ? Math.sqrt(pingTimes.map(t => Math.pow(t - avgPing, 2)).reduce((sum, d) => sum + d, 0) / (pingTimes.length - 1)) : 0;
      const packetLoss = (packetsLost / totalPackets) * 100;

      pingValue.textContent = avgPing.toFixed(0);
      jitterValue.textContent = jitter.toFixed(0);
      packetLossValue.textContent = packetLoss.toFixed(0);

      return { ping: avgPing, jitter, packetLoss };
    },

    async runDownloadTest() {
      log('Starting download test...');
      const downloadValue = document.getElementById('download-value');
      const progressBar = document.getElementById('progress-bar');
      const progressPercent = document.getElementById('progress-percent');
      const currentSpeed = document.getElementById('current-speed');
      const dataTransferred = document.getElementById('data-transferred');
      const timeElapsed = document.getElementById('time-elapsed');

      let totalBytes = 0, startTime = performance.now();
      const maxTime = CONFIG.testDurations.download;

      try {
        const response = await fetch(CONFIG.testServer.downloadUrl, { cache: 'no-store' });
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
          if (elapsed >= maxTime / 1000) break;
        }
      } catch (error) {
        log(`Download error: ${error.message}`);
        throw error;
      }

      const totalTime = (performance.now() - startTime) / 1000;
      const finalSpeed = ((totalBytes * 8) / totalTime) / (1024 * 1024);
      downloadValue.textContent = finalSpeed.toFixed(1);
      return finalSpeed;
    },

    async runUploadTest() {
      log('Simulating upload test...');
      const uploadValue = document.getElementById('upload-value');
      const progressBar = document.getElementById('progress-bar');
      const progressPercent = document.getElementById('progress-percent');
      const currentSpeed = document.getElementById('current-speed');
      const dataTransferred = document.getElementById('data-transferred');
      const timeElapsed = document.getElementById('time-elapsed');

      const { chunkSize, totalSize } = CONFIG.testServer.uploadSimulation;
      let uploaded = 0, startTime = performance.now();

      while (uploaded < totalSize && !this.testAborted) {
        uploaded += chunkSize;
        const elapsed = (performance.now() - startTime) / 1000;
        const speed = ((uploaded * 8) / elapsed) / (1024 * 1024);
        uploadValue.textContent = speed.toFixed(1);
        progressBar.style.width = `${(uploaded / totalSize) * 100}%`;
        progressPercent.textContent = `${(uploaded / totalSize) * 100}%`;
        currentSpeed.textContent = `${speed.toFixed(2)} Mbps`;
        dataTransferred.textContent = formatBytes(uploaded);
        timeElapsed.textContent = formatTime(elapsed);
        await new Promise(r => setTimeout(r, 300));
      }

      const totalTime = (performance.now() - startTime) / 1000;
      const finalSpeed = ((uploaded * 8) / totalTime) / (1024 * 1024);
      uploadValue.textContent = finalSpeed.toFixed(1);
      return finalSpeed;
    },

    displayResults() {
      if (!this.currentResults) return;
      const { ping, jitter, packetLoss, downloadSpeed, uploadSpeed } = this.currentResults;
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
        packetLoss: this.currentResults.packetLoss.toFixed(0),
      };
      this.testHistory.push(result);
      if (this.testHistory.length > 10) this.testHistory.shift();
      localStorage.setItem('testHistory', JSON.stringify(this.testHistory));
    },

    shareResults() {
      if (!this.currentResults) return;
      const { ping, jitter, packetLoss, downloadSpeed, uploadSpeed } = this.currentResults;
      const text = `Labverse Speed Test\nDownload: ${downloadSpeed.toFixed(1)} Mbps\nUpload: ${uploadSpeed.toFixed(1)} Mbps\nPing: ${ping.toFixed(0)} ms\nJitter: ${jitter.toFixed(0)} ms\nPacket Loss: ${packetLoss.toFixed(0)}%\nTest at https://labverse.co.za`;
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
          Packet Loss: ${r.packetLoss}%
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
