// Universal adapter to allow Vercel/Express-style (req, res) handlers to run on:
// 1. Vite dev server / Node HTTP (req, res)
// 2. Netlify Functions v1 / AWS Lambda (event, context)
// 3. Netlify Functions v2 / Web Fetch API (request: Request, context: Context)
export function netlifyAdapter(vercelHandler) {
  return async function universalHandler(arg1, arg2) {
    // Case 1: Standard Node (req, res) from Vite dev server or Vercel
    if (arg2 && typeof arg2.setHeader === 'function') {
      return await vercelHandler(arg1, arg2);
    }

    // Case 2: Netlify Functions v2 (Web API Request object)
    if (arg1 && typeof arg1 === 'object' && typeof arg1.arrayBuffer === 'function' && typeof arg1.url === 'string') {
      const webReq = arg1;
      const urlObj = new URL(webReq.url);
      const query = Object.fromEntries(urlObj.searchParams.entries());

      let body = {};
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes((webReq.method || '').toUpperCase())) {
        try {
          const rawText = await webReq.text();
          body = rawText ? JSON.parse(rawText) : {};
        } catch {
          body = {};
        }
      }

      const reqHeaders = {};
      webReq.headers.forEach((val, key) => {
        reqHeaders[key.toLowerCase()] = val;
      });

      const req = {
        method: (webReq.method || 'GET').toUpperCase(),
        headers: reqHeaders,
        query,
        body,
        url: urlObj.pathname + urlObj.search,
      };

      let statusCode = 200;
      const responseHeaders = new Headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      let responseBody = '';

      const res = {
        status(code) {
          statusCode = code;
          return res;
        },
        setHeader(name, val) {
          responseHeaders.set(name, String(val));
          return res;
        },
        getHeader(name) {
          return responseHeaders.get(name);
        },
        json(data) {
          responseHeaders.set('Content-Type', 'application/json');
          responseBody = JSON.stringify(data);
          return res;
        },
        send(data) {
          if (typeof data === 'object') return res.json(data);
          responseBody = String(data);
          return res;
        },
        end(data) {
          if (data !== undefined) responseBody = String(data);
          return res;
        },
      };

      if (req.method === 'OPTIONS') {
        return new Response('', {
          status: 204,
          headers: responseHeaders,
        });
      }

      try {
        await vercelHandler(req, res);
        return new Response(responseBody, {
          status: statusCode,
          headers: responseHeaders,
        });
      } catch (err) {
        console.error('Netlify function v2 error:', err);
        responseHeaders.set('Content-Type', 'application/json');
        return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
          status: 500,
          headers: responseHeaders,
        });
      }
    }

    // Case 3: Netlify Functions v1 / AWS Lambda (event, context)
    const event = arg1 || {};
    const query = event.queryStringParameters || {};
    let body = {};
    if (event.body) {
      try {
        body = event.isBase64Encoded
          ? JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
          : (typeof event.body === 'string' ? JSON.parse(event.body) : event.body);
      } catch {
        body = event.body;
      }
    }

    const req = {
      method: event.httpMethod || 'GET',
      headers: event.headers || {},
      query,
      body,
      url: event.path || '/',
    };

    let statusCode = 200;
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    let responseBody = '';

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      setHeader(name, val) {
        responseHeaders[name] = val;
        return res;
      },
      getHeader(name) {
        return responseHeaders[name];
      },
      json(data) {
        responseHeaders['Content-Type'] = 'application/json';
        responseBody = JSON.stringify(data);
        return res;
      },
      send(data) {
        if (typeof data === 'object') return res.json(data);
        responseBody = String(data);
        return res;
      },
      end(data) {
        if (data !== undefined) responseBody = String(data);
        return res;
      },
    };

    if (req.method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: responseHeaders,
        body: '',
      };
    }

    try {
      await vercelHandler(req, res);
      return {
        statusCode,
        headers: responseHeaders,
        body: responseBody,
      };
    } catch (err) {
      console.error('Netlify function v1 error:', err);
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({ error: err.message || 'Internal Server Error' }),
      };
    }
  };
}
