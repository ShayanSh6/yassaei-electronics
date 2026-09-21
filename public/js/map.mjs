// ─────────────────────────────────────────────────────────────
//  انتخاب نقشه و مسیریابی (نشان / بلد / OSM / گوگل)
// ─────────────────────────────────────────────────────────────
import { t } from './i18n.mjs';
import { store, S, promptInstall } from './state.mjs';
import { modal, toastSuccess, installHintModal } from './ui.mjs';
import { html as h, icon } from './lib/dom.mjs';
import { act } from './actions.mjs';

function coords() {
  const c = store().mapCoords || { lat: 35.731026, lng: 51.488461 };
  return { lat: Number(c.lat), lng: Number(c.lng) };
}

function urls(dest, origin) {
  const d = `${dest.lat},${dest.lng}`;
  const o = origin ? `${origin.lat},${origin.lng}` : '';
  return [
    {
      id: 'neshan', label: t('contact.neshan'), icon: 'map',
      href: origin
        ? `https://nshn.ir/maps?origin=${o}&destination=${d}&type=drive`
        : `https://nshn.ir/?lat=${dest.lat}&lng=${dest.lng}`,
    },
    {
      id: 'balad', label: t('contact.balad'), icon: 'pin',
      href: origin
        ? `https://balad.ir/route/${o.replace(',', ',')}/${d}`
        : `https://balad.ir/map?lat=${dest.lat}&lng=${dest.lng}`,
    },
    {
      id: 'osm', label: t('contact.osm'), icon: 'globe',
      href: origin
        ? `https://www.openstreetmap.org/directions?from=${o.replace(',', ';')}&to=${d.replace(',', ';')}`
        : `https://www.openstreetmap.org/?mlat=${dest.lat}&mlon=${dest.lng}#map=17/${dest.lat}/${dest.lng}`,
    },
    {
      id: 'google', label: t('contact.google'), icon: 'external',
      href: origin
        ? `https://www.google.com/maps/dir/?api=1&destination=${d}&origin=${o}`
        : `https://www.google.com/maps/search/?api=1&query=${d}`,
    },
  ];
}

function getLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), 7000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { clearTimeout(timer); finish(null); },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 },
    );
  });
}

export function openMapChooser() {
  const dest = coords();
  let origin = null;
  const m = modal({
    title: t('contact.mapAsk'),
    size: 'sm',
    body: h`
      <p class="notice notice-info mb">${icon('info')}<span>${t('contact.mapPermission')}</span></p>
      <div class="col" data-maps></div>`,
    footer: h`<button type="button" class="btn btn-ghost" data-x>${t('common.close')}</button>`,
    onMount: (panel, handle) => {
      const box = panel.querySelector('[data-maps]');
      const renderBtns = () => {
        box.innerHTML = urls(dest, origin).map((u) => h`
          <a class="btn btn-ghost btn-block" href="${u.href}" target="_blank" rel="noopener noreferrer">${icon(u.icon)} ${u.label} ${icon('external')}</a>`).join('');
      };
      renderBtns();
      panel.querySelector('[data-x]').addEventListener('click', () => handle.close());

      // اجازهٔ موقعیت
      getLocation().then((pos) => {
        if (pos) {
          origin = pos;
          renderBtns();
          toastSuccess(t('contact.locationOn'), { timeout: 2400 });
        }
      });
    },
  });
  return m;
}

act('open-map', (e) => { e.preventDefault?.(); openMapChooser(); });

act('install-app', async () => {
  if (S.installPrompt) { const ok = await promptInstall(); if (!ok) installHintModal(); }
  else installHintModal();
});

export { coords as mapCoords };
