// Fixed first-party SVG set: use the same name for the same action everywhere.
const paths = {
  moon:'<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>',
  pulse:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  mobile:'<path d="M4 20v-3M9 20v-7M14 20V9M19 20V4"/>',
  wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0"/><circle cx="12" cy="20" r=".7"/>',
  satellite:'<path d="m4 7 4-4 5 5-4 4zM11 14l4-4 5 5-4 4zM10 10l4 4M4 14a6 6 0 0 1 6 6M4 18a2 2 0 0 1 2 2"/>',
  charge:'<path d="m14 2-9 12h7l-2 8 9-12h-7z"/>',
  kort:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
  ture:'<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h6a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h6"/>',
  indstillinger:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  find:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  battery:'<rect x="2" y="6" width="18" height="12" rx="3"/><path d="M23 10v4M6 10v4M10 10v4M14 10v4"/>',
  cat:'<path d="M5 10 4 3l6 4h4l6-4-1 7a8 8 0 1 1-14 0Z"/><path d="M8 12h.1M16 12h.1M10 16l2 2 2-2M2 14l5 1M17 15l5-1"/>',
  dog:'<path d="M7 5 3 7v8l4-3m10-7 4 2v8l-4-3M7 5h10v10a5 5 0 0 1-10 0ZM9 10h.1M15 10h.1M10 15h4l-2 2z"/>',
  horse:'<path d="m8 3 3 3 5-1 3 4-2 10H7l2-7-5-1V8l4-5Zm5 7h.1M17 19v3M7 19v3"/>',
  paw:'<ellipse cx="12" cy="16" rx="6" ry="4"/><ellipse cx="4" cy="9" rx="2" ry="3"/><ellipse cx="10" cy="5" rx="2" ry="3"/><ellipse cx="16" cy="5" rx="2" ry="3"/><ellipse cx="21" cy="10" rx="2" ry="3"/>',
  car:'<path d="m4 10 2-6h12l2 6M3 10h18v9H3zM6 19v2M18 19v2M6 14h2M16 14h2"/>',
  bicycle:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-9 5 9H5l7-11h4M8 5h4M16 6l3 11"/>',
  object:'<path d="m3 7 9-4 9 4v12l-9 4-9-4ZM3 7l9 4 9-4M12 11v12M8 5l9 4"/>',
  home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>',
  location:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  layers:'<path d="m2 8 10-5 10 5-10 5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  arrow:'<path d="m12 2 8 19-8-5-8 5z"/>',
  plus:'<path d="M12 4v16M4 12h16"/>'
};
export const icon = (name, size=22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.object}</svg>`;

