// leaflet.heat is a classic plugin that attaches itself to a global `L`. Imported before it,
// this module makes sure that global exists under Vite's ESM build.
import L from 'leaflet';

if (typeof window !== 'undefined' && !window.L) window.L = L;

export default L;
