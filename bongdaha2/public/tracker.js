(function() {
  'use strict';

  // Get API URL from config or use fallback
  const getTrackingAPI = () => {
    const apiBase = window.APP_CONFIG?.adminApiUrl || 'http://localhost:8080';
    return `${apiBase}/api/track`;
  };

  const HEARTBEAT_INTERVAL = 30000; // 30 seconds

  // Generate or retrieve visitor ID
  function getVisitorId() {
    let vid = localStorage.getItem('_vid');
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('_vid', vid);
    }
    return vid;
  }

  // Generate session ID
  function getSessionId() {
    let sid = sessionStorage.getItem('_sid');
    if (!sid) {
      sid = 's_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
      sessionStorage.setItem('_sid', sid);
    }
    return sid;
  }

  // Get device type
  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }

  // Get OS
  function getOS() {
    const ua = navigator.userAgent;
    if (ua.indexOf('Win') !== -1) return 'Windows';
    if (ua.indexOf('Mac') !== -1) return 'MacOS';
    if (ua.indexOf('Linux') !== -1) return 'Linux';
    if (ua.indexOf('Android') !== -1) return 'Android';
    if (ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1) return 'iOS';
    return 'Unknown';
  }

  // Get browser
  function getBrowser() {
    const ua = navigator.userAgent;
    if (ua.indexOf('Firefox') !== -1) return 'Firefox';
    if (ua.indexOf('SamsungBrowser') !== -1) return 'Samsung';
    if (ua.indexOf('Opera') !== -1 || ua.indexOf('OPR') !== -1) return 'Opera';
    if (ua.indexOf('Trident') !== -1) return 'IE';
    if (ua.indexOf('Edge') !== -1) return 'Edge';
    if (ua.indexOf('Edg') !== -1) return 'Edge';
    if (ua.indexOf('Chrome') !== -1) return 'Chrome';
    if (ua.indexOf('Safari') !== -1) return 'Safari';
    return 'Unknown';
  }

  // Get page type
  function getPageType() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') return 'home';
    if (path.includes('/match/') || path.includes('/fixture/')) return 'match';
    if (path.includes('/live/')) return 'live';
    if (path.includes('/news/') || path.includes('/article/')) return 'article';
    return 'other';
  }

  // Get reference ID (match ID, article ID, etc.)
  function getReferenceId() {
    const path = window.location.pathname;
    const match = path.match(/\/(?:match|fixture|live|article)\/(\d+)/);
    return match ? match[1] : null;
  }

  // Send tracking data
  function track(action, extraData = {}) {
    const data = {
      action: action,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      timestamp: new Date().toISOString(),
      page_path: window.location.pathname,
      page_type: getPageType(),
      reference_id: getReferenceId(),
      referrer: document.referrer || null,
      device_type: getDeviceType(),
      os: getOS(),
      browser: getBrowser(),
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      language: navigator.language,
      ...extraData
    };

    const TRACKING_API = getTrackingAPI();

    // Use sendBeacon for reliability
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACKING_API, JSON.stringify(data));
    } else {
      fetch(TRACKING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(() => {});
    }
  }

  // Track page view
  let pageStartTime = Date.now();

  function trackPageView() {
    pageStartTime = Date.now();
    track('pageview');
  }

  // Track heartbeat (keep alive)
  let heartbeatTimer = null;

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    
    heartbeatTimer = setInterval(() => {
      const duration = Math.round((Date.now() - pageStartTime) / 1000);
      track('heartbeat', { 
        duration: duration,
        status: document.hidden ? 'inactive' : 'active'
      });
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // Track page leave
  function trackLeave() {
    const duration = Math.round((Date.now() - pageStartTime) / 1000);
    track('leave', { duration: duration });
  }

  // Visibility change handler
  function handleVisibilityChange() {
    if (document.hidden) {
      track('heartbeat', { 
        event: 'visibility_hidden',
        duration: Math.round((Date.now() - pageStartTime) / 1000)
      });
    } else {
      track('heartbeat', { 
        event: 'visibility_visible',
        duration: Math.round((Date.now() - pageStartTime) / 1000)
      });
    }
  }

  // Initialize tracking
  async function init() {
    // Wait for config to load (with timeout fallback)
    if (window.CONFIG_READY) {
      await Promise.race([
        window.CONFIG_READY,
        new Promise(resolve => setTimeout(resolve, 2000)) // 2s timeout
      ]);
    }
    
    // Track initial page view
    trackPageView();

    // Start heartbeat
    startHeartbeat();

    // Handle visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle page leave
    window.addEventListener('beforeunload', trackLeave);

    // Handle SPA navigation (if applicable)
    window.addEventListener('popstate', () => {
      trackLeave();
      trackPageView();
    });

    // Expose for manual tracking
    window.BongdahaTracker = {
      track: track,
      trackPageView: trackPageView,
      getVisitorId: getVisitorId
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
