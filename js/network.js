import { log } from './utils.js';

const CONFIG = {
  ipApis: [
    { url: 'https://api.ipify.org?format=json', parser: data => data.ip },
    { url: 'https://api.ipgeolocation.io/getip', parser: data => data.ip },
  ],
  geoApis: [
    {
      url: 'https://ipwho.is/',
      parser: data => ({
        isp: data.connection?.isp || 'Unknown',
        city: data.city || 'Unknown',
        country: data.country || 'Unknown',
      }),
    },
  ],
};

export async function fetchIP() {
  log('Fetching public IP...');
  for (const api of CONFIG.ipApis) {
    try {
      const response = await fetch(api.url);
      const data = await response.json();
      const ip = api.parser(data);
      if (ip) {
        log(`IP found: ${ip}`);
        document.getElementById('ip-display').textContent = ip;
        return ip;
      }
    } catch (error) {
      log(`IP fetch error (${api.url}): ${error.message}`);
    }
  }
  document.getElementById('ip-display').textContent = 'IP unavailable';
}

export async function fetchLocationInfo() {
  log('Fetching network location info...');
  for (const api of CONFIG.geoApis) {
    try {
      const response = await fetch(api.url);
      const data = await response.json();
      const info = api.parser(data);
      if (info) {
        log(`Network info found: ISP=${info.isp}, Location=${info.city}, ${info.country}`);
        document.getElementById('network-info').innerHTML = `ISP: ${info.isp}<br>Location: ${info.city}, ${info.country}`;
        return info;
      }
    } catch (error) {
      log(`Geo API error (${api.url}): ${error.message}`);
    }
  }
  document.getElementById('network-info').innerHTML = 'Network info unavailable';
}