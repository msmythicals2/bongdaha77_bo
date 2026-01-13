// Admin Panel Configuration
const CONFIG = {
  // Default values - will be overridden by server config
  API_BASE: '/api',
  FRONTEND_DOMAIN: window.location.protocol + '//' + window.location.host,
};

// 导出配置
window.APP_CONFIG = CONFIG;

// Promise that resolves when config is loaded
let configResolve;
window.CONFIG_READY = new Promise(resolve => {
  configResolve = resolve;
});

// Load config from server
(async function loadServerConfig() {
  try {
    // Always use relative path to config endpoint
    const configUrl = '/api/config';
    
    const response = await fetch(configUrl);
    if (response.ok) {
      const serverConfig = await response.json();
      
      // Always use server config for API_BASE
      if (serverConfig.adminApiUrl) {
        const normalizedAdminApiUrl = String(serverConfig.adminApiUrl).replace(/\/+$/, '');
        CONFIG.API_BASE = normalizedAdminApiUrl + '/api';
      }
      
      // Update FRONTEND_DOMAIN
      if (serverConfig.frontendDomain) {
        CONFIG.FRONTEND_DOMAIN = serverConfig.frontendDomain;
      }
      
      console.log('Admin config loaded from server:', CONFIG);
    }
  } catch (error) {
    console.warn('Failed to load server config, using defaults:', error);
  } finally {
    // Resolve the promise so app.js can proceed
    configResolve();
  }
})();

