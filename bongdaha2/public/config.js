// Frontend Configuration
// This file loads configuration from the server and provides fallback values

(function() {
  'use strict';

  // Default fallback values
  const DEFAULT_CONFIG = {
    adminApiUrl: 'http://localhost:8080',
    frontendDomain: 'https://localhost:3000'
  };

  // Global config object
  window.APP_CONFIG = { ...DEFAULT_CONFIG };

  // Promise that resolves when config is loaded
  let configResolve;
  window.CONFIG_READY = new Promise(resolve => {
    configResolve = resolve;
  });

  // Load config from server
  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        window.APP_CONFIG = {
          adminApiUrl: config.adminApiUrl || DEFAULT_CONFIG.adminApiUrl,
          frontendDomain: config.frontendDomain || DEFAULT_CONFIG.frontendDomain
        };
        console.log('Config loaded:', window.APP_CONFIG);
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
    } finally {
      // Resolve the promise so other scripts can proceed
      configResolve();
    }
  }

  // Load config immediately
  loadConfig();
})();
