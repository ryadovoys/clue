#!/usr/bin/env node
// Clue preview server for animations: serves one folder of animation scenes on localhost, puts Clue
// into every page (F freezes the motion to pick on a moment) and reloads the open page as soon as
// any file in it (or Clue) changes, so nobody has to press reload.
//
//   node serve.cjs <folder of scenes> [--port 5195] [--lan]      (from a clone of this repo)
//
// --lan also opens it to the local network (a phone on the same Wi-Fi), by this machine's address.
//
// - Only that folder is served, on 127.0.0.1. Clue is added to every HTML page (/__clue/clue.js),
//   so the scenes need no script tags of their own.
// - Every HTML page gets a small client that listens on /__clue-reload (server-sent events).
//   Only the top page reloads (its iframes come with it), and it waits while the page is frozen,
//   so a moment being picked on is never lost. Each page knows the version it was served at and
//   checks it on every (re)connect: a phone drops the stream when its screen sleeps, and comes
//   back to a stale page otherwise.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const args = process.argv.slice(2)
const folder = path.resolve(args.find(arg => !arg.startsWith('--')) || '.')
const port = Number(args[args.indexOf('--port') + 1]) || 5195
const lan = args.includes('--lan')
// This machine's addresses on the local network (IPv4, not loopback), for --lan.
const lanAddresses = lan ? Object.values(require('node:os').networkInterfaces()).flat()
  .filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address) : []
const clue = path.join(__dirname, 'clue.js')
const TOOLS = { '/__clue/clue.js': clue }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.woff2': 'font/woff2' }

const INJECT = '<script src="/__clue/clue.js"></script>'
// The version goes up on every change. The stream sends it on connect and on each change.
let version = 1
const CLIENT = () => `<script>(() => {
  if (window.top !== window) return
  const loaded = ${version}
  // A frozen page holds the reload until it plays again.
  const busy = () => { try { return Boolean(window.__clue?.frozen?.()) } catch { return false } }
  let pending = false, stream = null
  const reload = () => busy() ? setTimeout(reload, 300) : location.reload()
  const connect = () => {
    stream?.close()
    stream = new EventSource('/__clue-reload')
    stream.onmessage = event => { if (Number(event.data) !== loaded && !pending) { pending = true; reload() } }
  }
  connect()
  // Back from a sleeping screen, another tab or the back-forward cache: the old stream may be dead.
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') connect() })
  addEventListener('pageshow', event => { if (event.persisted) connect() })
})()</script>`

const clients = new Set()
let timer
const changed = () => {
  clearTimeout(timer)   // editors write in bursts; one reload per burst
  timer = setTimeout(() => { version++; for (const res of clients) res.write(`data: ${version}\n\n`) }, 120)
}
fs.watch(folder, { recursive: true }, changed)
fs.watch(clue, changed)

const root = fs.realpathSync(folder)
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, ...lanAddresses.map(address => `${address}:${port}`)])
// Inside the folder, and no hidden part (.git, .env) on the real path.
const inside = file => (file === root || file.startsWith(root + path.sep))
  && !path.relative(root, file).split(path.sep).some(part => part.startsWith('.'))
const fail = (res, code) => { res.writeHead(code); res.end() }
// On every response: only this origin may embed or read it, and types are taken as sent.
const GUARD = { 'Cross-Origin-Resource-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "frame-ancestors 'self'" }

http.createServer((req, res) => {
  // Only this machine by name: a page on another site cannot reach in through DNS rebinding.
  if (!hosts.has(req.headers.host)) return fail(res, 403)
  // Another site may link here (a navigation) but not load or read anything from this server.
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none' && req.headers['sec-fetch-mode'] !== 'navigate') return fail(res, 403)
  for (const [name, value] of Object.entries(GUARD)) res.setHeader(name, value)
  let url
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { return fail(res, 400) }
  if (url.includes('\0') || url.includes('\\') || url.split('/').some(part => part.startsWith('.') && part !== '.' && part !== '..')) return fail(res, 404)
  if (url === '/__clue-reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
    res.write(`data: ${version}\n\n`)
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }
  let file = TOOLS[url] || path.join(root, url)
  try {
    if (!Object.values(TOOLS).includes(file)) {
      // Real paths, so a symlink in the folder cannot point outside it.
      if (fs.existsSync(file)) file = fs.realpathSync(file)
      if (!inside(file)) return fail(res, 403)
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        const index = path.join(file, 'index.html')
        if (!fs.existsSync(index)) {
          // A folder with no index: list its pages.
          const pages = fs.readdirSync(file).filter(name => name.endsWith('.html'))
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
          return res.end(`<!doctype html><meta charset="utf-8"><body style="font:15px/1.8 -apple-system,sans-serif;padding:32px">${pages.map(name => `<a href="${encodeURI(name)}">${name.replace(/</g, '&lt;')}</a>`).join('<br>')}${CLIENT()}`)
        }
        file = fs.realpathSync(index)
        if (!inside(file)) return fail(res, 403)
      }
    }
  } catch { return fail(res, 404) }
  fs.readFile(file, (error, data) => {
    if (error) return fail(res, 404)
    const type = TYPES[path.extname(file)] || 'application/octet-stream'
    const text = /^(text|application\/json)/.test(type)
    res.writeHead(200, { 'Content-Type': text ? `${type}; charset=utf-8` : type, 'Cache-Control': 'no-store' })
    res.end(type === 'text/html' ? data.toString().replace(/<\/body>|$/i, match => INJECT + CLIENT() + match) : data)
  })
}).listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Clue preview: http://127.0.0.1:${port}/  (serving ${root})`)
  for (const address of lanAddresses) console.log(`On the network: http://${address}:${port}/`)
})
