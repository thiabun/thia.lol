# thia.lol Brand Guidelines

> **Status: Active canonical reference.** Use this with `AGENTS.md` and
> `docs/product-ui-ux-guidelines.md` for brand, logo, favicon, app icon, and
> social preview work.

Date: 2026-06-17

## Brand Idea

`thia.lol` is represented by a minimal bunny mark that subtly hides a `T` in
its nose and mouth. The mark should feel cute, clean, friendly, distinct, and
easy to recognize without making the platform feel childish or overly themed.

The product identity is `thia.lol`. Thia's personal/founder identity remains a
secondary member profile, for example `/@thia`.

## Logo System

Use the bunny mark and `thia.lol` wordmark as the core identity system:

- Horizontal lockup: primary brand asset for larger previews, social cards,
  docs, and Open Graph or campaign-style previews.
- Main logo image: square bunny plus wordmark asset for auth panels, legal
  index intros, and other compact trust surfaces where the full horizontal
  lockup feels too wide.
- Bunny mark: compact identity for favicons, app icons, small header spaces,
  footers, policy intros, cookie notices, loading states, and avatar-like brand
  contexts. Use circle or squircle versions when the mark needs a contained
  app-icon feel outside the top bar.
- Favicon: pink bunny mark cropped to a squircle so it reads clearly in browser
  tab chrome.
- T mark: supporting shorthand asset only. Do not use it as the default site
  identity when the bunny mark, main logo image, or lockup fits.

The header should stay compact. Use the bunny mark plus wordmark once in the
top bar and do not repeat brand marks across routine content cards.

## Product Placement

Use brand assets where they clarify product identity or add trust at natural
entry and exit points:

- Header: compact bunny mark plus `thia.lol` wordmark.
- Footer: compact bunny/wordmark treatment near copyright and legal links, using
  the circle mark.
- Auth: restrained main logo image at the top of sign-in and account creation
  panels.
- Legal: main logo image on the legal index, and one compact squircle bunny mark
  on policy intros.
- Cookie notice: one small pink squircle bunny mark as a brand-aware utility
  marker.
- Loading: one small pink circle bunny mark beside the route loading message.
- Social/app previews: use the prepared lockup, app icon, and Open Graph image.

Do not add bunny marks to feeds, post cards, profile modules, repeated room
cards, empty states, or decorative backgrounds unless a future product decision
explicitly calls for that surface.

## Theme Usage

The selectable site theme options are Light, Dark, and Profile Theme. Light and
Dark are the standard product themes. Their product mood names are:

- Light: `Glinda`, a pink-toned light mode that is soft, bright, clean,
  friendly, refined, elegant, and modern.
- Dark: `Elphaba`, a green-toned dark mode that is rich, sleek, calm, sharp,
  alive, modern, and refined.

Profile Theme is an explicit signed-in opt-in, not another brand palette. It
uses the signed-in member's constrained profile appearance across supported
site surfaces, including its colors, background treatment, surface opacity, and
glass treatment. Selecting Light or Dark must remove those site-wide profile
styles and restore the corresponding standard product theme.

Viewed profile pages remain themed to the profile owner regardless of the
viewer's selected site theme. Profile Theme changes the surrounding signed-in
site experience; it does not override another member's profile identity.

These are product tone names only. Do not add character art, fandom jokes,
stage styling, magic props, or theme literalism to the brand system.

Pink remains a signature accent in Light mode and brand/social/app-icon assets.
Green gives Dark mode its identity. Neither color should overrun whole product
surfaces.

## Asset Locations

Source files live in:

```text
brand/source/
```

Deploy-facing generated files live in:

```text
public/brand/
public/favicon-32x32.png
public/apple-touch-icon.png
public/site.webmanifest
```

Runtime product assets currently include:

- `/brand/thia-mark-light-96.png`
- `/brand/thia-mark-dark-96.png`
- `/brand/thia-mark-pink-96.png`
- `/brand/thia-logo-main-256.png`
- `/brand/thia-mark-light-circle-96.png`
- `/brand/thia-mark-dark-circle-96.png`
- `/brand/thia-mark-pink-circle-96.png`
- `/brand/thia-mark-light-squircle-96.png`
- `/brand/thia-mark-dark-squircle-96.png`
- `/brand/thia-mark-pink-squircle-96.png`
- `/brand/thia-t-light-96.png`
- `/brand/thia-t-dark-96.png`
- `/brand/thia-lockup-light.png`
- `/brand/thia-lockup-dark.png`
- `/brand/thia-og.png`

The `sunveil` and `frostveil` asset filenames are still generated as legacy
compatibility aliases. Standard-theme copy should use Light/Dark and
Glinda/Elphaba, the third option must use the exact label Profile Theme, and new
code should reference the Light/Dark filenames for standard-theme assets.

Regenerate public assets with:

```bash
npm run optimize:assets
```

The generated assets are committed so local dev, Vite builds, and VPS deploys
all have the same favicon, app icon, header mark, and Open Graph image.

## Do Not

- Do not turn Profile Theme into a third fixed pink or brand palette.
- Do not replace app theme tokens with brand image colors.
- Do not use Glinda/Elphaba as a reason to add character art or theatrical UI.
- Do not use the bunny mark as a decorative repeated pattern.
- Do not stretch, recolor, outline, or manually redraw the raster marks in app
  code.
- Do not use the T mark where people need to recognize `thia.lol` quickly.
