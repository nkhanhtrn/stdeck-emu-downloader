import { createApp } from 'vue';
import ROMDownloaderComponent from '../src/components/ROMDownloader.vue';
import { CONSOLES, SOURCES, getConsoleInfo } from '../src/config/consoles.js';
import './decky-adapter.js';

// For dev/test mode, we need to override the API URL based on environment
const IS_TEST = import.meta.env.VITE_TEST_MODE === 'true' || window.location.search.includes('test=true');

// Override baseUrl for test mode
const originalGetConsoleInfo = getConsoleInfo;
const testGetConsoleInfo = (consoleName) => {
  const info = originalGetConsoleInfo(consoleName);
  if (IS_TEST) {
    return { ...info, baseUrl: 'http://localhost:3556/files' };
  }
  return info;
};

createApp(ROMDownloaderComponent, {
  consoles: CONSOLES,
  sources: SOURCES,
  getConsoleInfo: testGetConsoleInfo
}).mount('#app');
