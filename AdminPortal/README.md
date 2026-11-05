# Bharat Yaatri Admin Portal

React 18, Vite, Tailwind 3, lucide-react, react-router, TipTap, recharts and Leaflet
(OpenStreetMap tiles, so no API key is needed). It talks to **Backend3.0** at `/api/v3/admin`.
The routes, roles and metric definitions are in `Backend3.0/docs/admin-api.md`.

## Run

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`. Set `VITE_API_URL` if the API is not at `http://localhost:5000/api/v3`.

3. Start the dev server:

   ```bash
   npm run dev     # http://localhost:5173
   ```

4. For a production build, run `npm run build`. The output goes to `dist/`.

The first admin account is created on the backend:

```bash
node scripts/create-admin.mjs --email … --name … --password …
```

## Theme

The layout, type scale, components and spacing follow the Zaishree system in `theme.md`. Only the
palette changes, to match the Partner logo:

| theme.md | Here | Hex |
|---|---|---|
| rose (accent) | `brand` | `#F26B21` |
| rose-deep | `brand-deep` | `#D3560F` |
| rose-soft | `brand-soft` | `#F8B88E` |
| charcoal (text) | `ink` | `#0E2A47` |
| ivory (secondary surface) | `mist` | `#F4F6F9` |
| beige (hairlines) | `line` | `#C5CED9` |
| — | `navy` (sidebar, sign-in panel) | `#0D2C4B` |

Chart colours are in `src/components/charts.jsx`. They pass colour-blind-safety and contrast checks
on a white background.

## Layout

| Path | Contents |
|---|---|
| `src/lib/` | API client (turns every backend error shape into a message plus field errors), auth context, formatters and hooks |
| `src/components/ui/` | Buttons, badges, cards, form fields, modal/confirm, toasts, table/pagination, the rich-text editor and other shared parts |
| `src/layout/` | Sidebar (links hidden by permission), topbar, sign-in screen |
| `src/pages/` | One file per screen |

Bids, reviews, saved destinations and UPI details have no pages of their own. They appear inside
the ride, driver and customer detail pages.
