// Mock DeckyPluginLoader for development/testing
// This allows ROMDownloader.vue to work in a browser without Decky

const IS_TEST = import.meta.env.VITE_TEST_MODE === 'true' || window.location.search.includes('test=true');
const DEV_API = IS_TEST ? 'http://localhost:3556/api' : 'http://localhost:3555/api';

// Mock DeckyPluginLoader
window.DeckyPluginLoader = {
  async call(method, ...args) {
    // Map backend method calls to dev API endpoints
    const endpointMap = {
      'fetch_rom_list': '/fetch_rom_list',
      'download_rom': '/download_rom',
      'get_download_progress': '/download_progress',
      'cancel_download': '/cancel_download',
    };

    const endpoint = endpointMap[method];
    if (!endpoint) {
      throw new Error(`Unknown method: ${method}`);
    }

    // Convert args to the format expected by the test server
    // The test server expects objects with named parameters
    let body;
    if (method === 'fetch_rom_list' && args.length === 2) {
      body = { base_url: args[0], console_path: args[1] };
    } else if (method === 'download_rom' && args.length === 4) {
      body = { url: args[0], filename: args[1], download_path: args[2], unzip: args[3] };
    } else if (method === 'get_download_progress' && args.length === 1) {
      body = { download_id: args[0] };
    } else if (method === 'cancel_download' && args.length === 1) {
      body = { download_id: args[0] };
    } else if (args.length === 1) {
      body = args[0];
    } else {
      body = args;
    }

    const response = await fetch(DEV_API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return await response.json();
  },

  openFilePicker(options) {
    console.log('File picker not available in dev mode', options);
    return Promise.resolve({ path: options?.start || '/home/deck/Downloads/' });
  },

  // For testing purposes
  async callTest(method, ...args) {
    return this.call(method, ...args);
  }
};

export default window.DeckyPluginLoader;
