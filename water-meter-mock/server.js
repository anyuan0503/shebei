/*
 * 模拟水表 Web 工具 —— 本地服务
 * -------------------------------------------------------------
 * 启动:  node server.js
 * 默认端口: 8090   (可用环境变量 PORT 覆盖, 如 PORT=8095 node server.js)
 *
 * 作用:
 *   1. 托管前端页面(index.html), 浏览器打开 http://<服务器IP>:8090 即可使用
 *   2. 把前端请求代理转发到你已部署水务系统的真实接口
 *      - POST /api/mock/login    => 你后端  POST /api/auth/login   (登录拿 token)
 *      - POST /api/mock/send     => 你后端  POST /api/monitor/data (上报监测数据)
 *      - GET  /api/mock/devices  => 你后端  GET  <可配置路径>       (拉设备列表, 可选)
 *
 * 说明: 工具自身不修改你系统任何代码, 只是替你调用真实接口。
 *       后端地址、账号、设备列表路径都在前端页面上配置即可。
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = +(process.env.PORT || 8090);
const HOST = process.env.HOST || '0.0.0.0';
const INDEX = path.join(__dirname, 'index.html');

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, cb) {
  let data = '';
  req.on('data', (c) => {
    data += c;
    if (data.length > 5e6) req.destroy();
  });
  req.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(data || '{}'); } catch (e) { parsed = {}; }
    cb(parsed);
  });
}

/*
 * proxy: 把请求转发到目标后端, 仅补齐必需的 header, 其余原样透传
 */
function proxy(urlPath, options, bodyObj, cb) {
  const baseURL = options.baseURL || 'http://127.0.0.1:8080';
  const method = options.method || 'POST';
  const headers = options.headers || {};
  let u;
  try { u = new URL(urlPath, baseURL.endsWith('/') ? baseURL : baseURL + '/'); }
  catch (e) { return cb(new Error('后端地址无效: ' + baseURL)); }

  const mod = u.protocol === 'https:' ? https : http;
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
  const reqHdrs = {};
  for (const k in headers) reqHdrs[k] = headers[k];
  if (!reqHdrs['Content-Type']) reqHdrs['Content-Type'] = 'application/json';
  if (bodyStr) reqHdrs['Content-Length'] = Buffer.byteLength(bodyStr);

  const req = mod.request({
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    method,
    headers: reqHdrs,
  }, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => cb(null, res.statusCode, data));
  });
  req.on('error', (err) => cb(err));
  if (bodyStr) req.write(bodyStr);
  req.end();
}

function tryJson(s) {
  try { return JSON.parse(s); } catch (e) { return s; }
}

/* 把代理失败的原因拼进提示，方便定位是地址/端口/网络问题 */
function detailErr(action, baseURL, err) {
  const map = {
    ECONNREFUSED: '端口无服务（后端没启动，或端口/地址不对）',
    ETIMEDOUT: '连接超时（内网不通或防火墙拦截）',
    ENOTFOUND: '主机名无法解析',
    EHOSTUNREACH: '主机不可达（IP/网段不通）',
  };
  return `${action}失败：目标 ${baseURL}（${err.code || ''} ${err.message}）${map[err.code] ? ' —— ' + map[err.code] : ''}`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  // 托管前端页面
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    fs.readFile(INDEX, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('index.html 不存在'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buf);
    });
    return;
  }

  // 模拟登录：转发到后端 /api/auth/login 拿 token
  if (req.method === 'POST' && pathname === '/api/mock/login') {
    return readBody(req, (body) => {
      proxy('/api/auth/login', { baseURL: body.baseURL }, {
        username: body.username, password: body.password,
      }, (err, code, data) => {
        if (err) return sendJson(res, 502, { ok: false, message: detailErr('登录', body.baseURL, err), code: null });
        sendJson(res, code, { ok: String(code).startsWith('2') && !/error/i.test((data || '').slice(0, 200)), code, data: tryJson(data) });
      });
    });
  }

  // 上报数据：转发到后端 /api/monitor/data (需要 Bearer token)
  if (req.method === 'POST' && pathname === '/api/mock/send') {
    return readBody(req, (body) => {
      proxy('/api/monitor/data', {
        baseURL: body.baseURL,
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (body.token || '').trim() },
      }, body.payload, (err, code, data) => {
        if (err) return sendJson(res, 502, { ok: false, message: detailErr('上报', body.baseURL, err), code: null });
        sendJson(res, code, { ok: String(code).startsWith('2'), code, data: tryJson(data) });
      });
    });
  }

  // 拉设备列表（可选，路径可在前端配置）
  if (req.method === 'GET' && pathname === '/api/mock/devices') {
    const baseURL = url.searchParams.get('baseURL');
    const token = url.searchParams.get('token');
    const devPath = url.searchParams.get('devicesPath') || process.env.MOCK_DEVICES_PATH || '/api/device';
    proxy(devPath, {
      baseURL, method: 'GET',
      headers: { Authorization: 'Bearer ' + (token || '').trim() },
    }, null, (err, code, data) => {
      if (err) return sendJson(res, 502, { ok: false, message: err.message, code: null });
      sendJson(res, code, { ok: String(code).startsWith('2'), code, data: tryJson(data) });
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end('{"ok":false,"message":"not found"}');
});

server.listen(PORT, HOST, () => {
  console.log('[WaterMeter-Mock] 模拟水表工具已启动:');
  console.log(`  本机访问: http://127.0.0.1:${PORT}`);
  console.log(`  局域网访问: http://<你的服务器IP>:${PORT}`);
});