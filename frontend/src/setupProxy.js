const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const apiProxy = createProxyMiddleware(
    // Filter: only proxy XHR/fetch requests, not browser navigations
    (pathname, req) => {
      const isPrefixMatch = pathname.startsWith('/auth') ||
                            pathname.startsWith('/groups') ||
                            pathname.startsWith('/invite');
      if (!isPrefixMatch) return false;

      // Skip browser page navigations (they send Accept: text/html)
      const accept = req.headers.accept || '';
      if (req.method === 'GET' && accept.includes('text/html') && !accept.includes('application/json')) {
        return false;
      }
      return true;
    },
    {
      target: 'http://127.0.0.1:8001',
      changeOrigin: true,
    }
  );
  app.use(apiProxy);
};

