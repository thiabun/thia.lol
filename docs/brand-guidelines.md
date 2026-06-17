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

Sunveil and Frostveil remain the only selectable site themes:

- Sunveil uses the darker bunny mark so it holds contrast on warm light UI.
- Frostveil uses the lighter bunny mark so it holds contrast on cool dark UI.
- The pink variant is a brand/social/app-icon variant, not a third app theme.

Pink should feel like a signature accent. Use it for `.lol`, app icons, social
previews, and occasional brand material. Do not turn whole product surfaces into
pink unless a specific campaign or special page calls for it.

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

- `/brand/thia-mark-sunveil-96.png`
- `/brand/thia-mark-frostveil-96.png`
- `/brand/thia-mark-pink-96.png`
- `/brand/thia-logo-main-256.png`
- `/brand/thia-mark-sunveil-circle-96.png`
- `/brand/thia-mark-frostveil-circle-96.png`
- `/brand/thia-mark-pink-circle-96.png`
- `/brand/thia-mark-sunveil-squircle-96.png`
- `/brand/thia-mark-frostveil-squircle-96.png`
- `/brand/thia-mark-pink-squircle-96.png`
- `/brand/thia-t-sunveil-96.png`
- `/brand/thia-t-frostveil-96.png`
- `/brand/thia-lockup-sunveil.png`
- `/brand/thia-lockup-frostveil.png`
- `/brand/thia-og.png`

Regenerate public assets with:

```bash
npm run optimize:assets
```

The generated assets are committed so local dev, Vite builds, and cPanel deploys
all have the same favicon, app icon, header mark, and Open Graph image.

## Do Not

- Do not add a third selectable pink theme without an explicit product decision.
- Do not replace Sunveil/Frostveil tokens with brand image colors.
- Do not use the bunny mark as a decorative repeated pattern.
- Do not stretch, recolor, outline, or manually redraw the raster marks in app
  code.
- Do not use the T mark where people need to recognize `thia.lol` quickly.
