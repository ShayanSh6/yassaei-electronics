// ─────────────────────────────────────────────────────────────
//  روتر بسیار سبک (بدون وابستگی)
// ─────────────────────────────────────────────────────────────
export class Router {
  constructor() { this.routes = []; this.seen = new Set(); }

  add(method, pattern, handler, opts = {}) {
    const key = `${method} ${pattern}`;
    if (this.seen.has(key)) throw new Error(`[router] duplicate route: ${key}`);
    this.seen.add(key);
    const parts = pattern.split('/').filter(Boolean);
    this.routes.push({ method, pattern, parts, handler, opts });
  }

  get(p, h, o) { this.add('GET', p, h, o); }
  post(p, h, o) { this.add('POST', p, h, o); }
  patch(p, h, o) { this.add('PATCH', p, h, o); }
  put(p, h, o) { this.add('PUT', p, h, o); }
  delete(p, h, o) { this.add('DELETE', p, h, o); }

  match(method, pathname) {
    const segs = pathname.split('/').filter(Boolean);
    let pathExists = false;
    for (const r of this.routes) {
      if (r.parts.length !== segs.length) continue;
      let ok = true;
      const params = {};
      for (let i = 0; i < segs.length; i++) {
        const rp = r.parts[i];
        if (rp.startsWith(':')) { params[rp.slice(1)] = decodeURIComponent(segs[i]); continue; }
        if (rp !== segs[i]) { ok = false; break; }
      }
      if (!ok) continue;
      pathExists = true;
      if (r.method !== method) continue;
      return { route: r, params };
    }
    return pathExists ? { methodNotAllowed: true } : null;
  }

  list() { return this.routes.map((r) => `${r.method} ${r.pattern}`); }
}
