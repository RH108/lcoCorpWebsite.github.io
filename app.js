// app.js
//
// Printify connect service for lco.fc merch.
// Holds the Printify API token server-side and exposes a small set of
// read-only endpoints the front end (lco-fc.html) can call safely.
//
// Setup:
//   npm init -y
//   npm install express dotenv
//   node --version   # needs 18+ for built-in fetch
//
// .env (create this file, never commit it):
//   PRINTIFY_API_TOKEN=your_token_here
//   PRINTIFY_SHOP_ID=your_shop_id_here
//   ALLOWED_ORIGIN=https://your-site.com
//   PORT=3000
//
// Get PRINTIFY_SHOP_ID from GET https://api.printify.com/v1/shops.json
// Get PRINTIFY_API_TOKEN from Printify > My Account > Connections > API tokens.
//
// Run:
//   node app.js

require('dotenv').config();
const express = require('express');

const app = express();

const {
    PRINTIFY_API_TOKEN,
    PRINTIFY_SHOP_ID,
    ALLOWED_ORIGIN = '*',
    PORT = 3000
} = process.env;

const PRINTIFY_BASE = 'https://api.printify.com/v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — Printify rate-limits aggressively

if (!PRINTIFY_API_TOKEN || !PRINTIFY_SHOP_ID) {
    console.warn('[printify-connect] Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID in .env — requests will fail until set.');
}

// ---------- tiny in-memory cache ----------
const cache = new Map();

function getCached(key) {
    const hit = cache.get(key);
    if (!hit || Date.now() - hit.time > CACHE_TTL_MS) return null;
    return hit.value;
}

function setCached(key, value) {
    cache.set(key, { value, time: Date.now() });
}

// ---------- shared CORS + Printify request helper ----------
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

async function printifyFetch(path) {
    const res = await fetch(`${PRINTIFY_BASE}${path}`, {
        headers: { Authorization: `Bearer ${PRINTIFY_API_TOKEN}` }
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        const err = new Error(`Printify API ${res.status}: ${body}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

function requireConfig(req, res, next) {
    if (!PRINTIFY_API_TOKEN || !PRINTIFY_SHOP_ID) {
        return res.status(500).json({ error: 'Server missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID' });
    }
    next();
}

// Only the token is needed to look up shop IDs — this is how you find
// PRINTIFY_SHOP_ID in the first place, so it can't depend on already having it.
function requireToken(req, res, next) {
    if (!PRINTIFY_API_TOKEN) {
        return res.status(500).json({ error: 'Server missing PRINTIFY_API_TOKEN' });
    }
    next();
}

// ---------- routes ----------

app.get('/health', (req, res) => {
    res.json({ ok: true, configured: Boolean(PRINTIFY_API_TOKEN && PRINTIFY_SHOP_ID) });
});

// List shops connected to this Printify account — use this to find your
// PRINTIFY_SHOP_ID. Visit /api/printify/shops (or run `node app.js --shops`,
// see bottom of file) and copy the "id" of the shop you want.
app.get('/api/printify/shops', requireToken, async (req, res) => {
    try {
        const cached = getCached('shops');
        if (cached) return res.json(cached);

        const data = await printifyFetch('/shops.json');
        const shops = data.map(s => ({ id: s.id, title: s.title, sales_channel: s.sales_channel }));

        setCached('shops', shops);
        res.json(shops);
    } catch (err) {
        console.error(err);
        res.status(err.status || 500).json({ error: 'Failed to fetch shops' });
    }
});

// List published, visible products for the configured shop.
app.get('/api/printify/products', requireConfig, async (req, res) => {
    try {
        const cacheKey = `products:${PRINTIFY_SHOP_ID}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const data = await printifyFetch(`/shops/${PRINTIFY_SHOP_ID}/products.json`);
        const visible = (data.data || []).filter(p => p.visible);
        const payload = { data: visible };

        setCached(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error(err);
        res.status(err.status || 500).json({ error: 'Failed to fetch products' });
    }
});

// Single product detail, e.g. for a product page.
app.get('/api/printify/products/:id', requireConfig, async (req, res) => {
    try {
        const cacheKey = `product:${req.params.id}`;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const data = await printifyFetch(`/shops/${PRINTIFY_SHOP_ID}/products/${req.params.id}.json`);
        setCached(cacheKey, data);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(err.status || 500).json({ error: 'Failed to fetch product' });
    }
});

// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- CLI shortcut: `node app.js --shops` ----------
// Prints your shop IDs straight to the terminal, no server needed.
async function printShopsAndExit() {
    if (!PRINTIFY_API_TOKEN) {
        console.error('Missing PRINTIFY_API_TOKEN in .env');
        process.exit(1);
    }
    try {
        const shops = await printifyFetch('/shops.json');
        console.log('\nYour Printify shops:\n');
        shops.forEach(s => console.log(`  id: ${s.id}   title: ${s.title}   channel: ${s.sales_channel}`));
        console.log('\nCopy the id of the shop you want and set PRINTIFY_SHOP_ID in .env\n');
    } catch (err) {
        console.error('Failed to fetch shops:', err.message);
        process.exit(1);
    }
    process.exit(0);
}

if (process.argv.includes('--shops')) {
    printShopsAndExit();
} else {
    app.listen(PORT, () => {
        console.log(`[printify-connect] listening on :${PORT}`);
    });
}