# lluc.dev

A personal site that is also a small world.

It’s built so that **a casual visitor finds it pretty and leaves** - and **a curious
one keeps finding more**. Almost nothing announces itself. The deeper you look, the
more there is: a living sky, a real sun and an independent moon, eclipses, the
analemma, moon phases, seasons that reach into the trees, weather, glitter on the
sea. None of it is decoration bolted on top - it’s one simulation, and the whole
site quietly dresses itself in whatever sky you left running.

Vanilla HTML / CSS / JS. Just open `index.html` (or serve the folder with
any static server) and it just runs.

---

## The idea: every visit is different

Open the home page and you don’t land on a static hero - you land **at your own
local time**, arriving there from 12 hours earlier in a short linear glide
(open at 21:43 and it sweeps 09:43 → 21:43). From then on **time never stops
flowing**: 3x speed until your first interaction, 1x after (1 real second ≈ 1 sim
minute). Come back at dawn and it’s dawn; come back at 2 a.m. and the stars are out
and the moon is wherever the moon should be.

Then you can **grab the sky and scrub it yourself**.

---

## The home page (`index.html`) - a living sky / fully interactive

- **Drag / scroll vertically** → move the **hour** (the day rolls forward and back).
- **Drag / scroll horizontally** → move the **day** (whole days; the time of day stays put).
- **Arrow keys** → ↑/↓ hour, ←/→ day. Everything has inertia and friction, so a flick coasts.
- Let go and automatic time resumes. Open the **ESC menu** and the whole simulation pauses to save cycles.

### A real sun and an independent moon
The sun and the moon are two separate bodies, each with its own transit time,
time above the horizon and peak height. They slide sideways in opposite
directions, so over a day their paths **cross in an X**. The handoff between them
is hidden below the horizon - you never watch the sun morph into the moon.

### Moon phases, for real
The moon runs a ~29.53-day cycle (a true month). Its phase drives both the
**lit shape** and **when it’s up**: a **full moon transits at midnight** and is up
for exactly the night (rises at sunset, sets at sunrise); a **new moon rides the
day** with the sun, lost in the glare. Scrub days quickly and the phase animates
smoothly instead of strobing.

### Eclipses
Because the sun and moon sit at opposite seasonal heights most of the year, they
can only line up near the **equinoxes** - the natural “eclipse seasons”.
- **Solar eclipse** - a *new* moon crossing the sun: the discs occult and the day dims to twilight.
- **Lunar eclipse** - a *full* moon in an eclipse season while the sun is down: Earth’s shadow turns it a coppery **blood moon**.

### Seasons & the analemma
Sunrise and sunset shift with the season; the keyframe colours are warped to match
so dawn and dusk always land on the real horizon. The **equation of time** nudges
the sun sideways day to day - scrub the **day axis** and faint **analemma guides**
fade in, tracing the figure-8 the sun draws across a year.

### Stars, water, weather
- **Stars** are a 360° panorama that drifts with the days, reach the horizon, and are **never drawn inside the moon’s disc**. A **brighter moon washes them out** (fewer stars near full moon).
- **The sea** has persistent glitter facets that twinkle, waves that change with the hour, and it **flattens while you scrub** fast so it never looks shaky.
- **Weather** is a smooth, deterministic cloud cover that drifts over hours and days - same date, same sky.

### The instruments
- A tiny **orbit visualiser**: Earth riding its yearly path, with a bar through it that turns with the time of day.
- A **clock + calendar HUD** (with Korean seasons / micro-seasons) that fades in while you drag and out when you let go.

---

## The whole site wears the sky

Whatever sky the home page is showing is saved (to `localStorage`), and **every
main page inherits it** - the nav, the about page, the blog, the map. The home
page is the clock that sets the time; everywhere else the day still turns, but
**very slowly** (≈10 real seconds per sim minute, so a full day ≈ 4 real hours).

### Eight themes, chosen by the sky
| sky | theme |
|---|---|
| daytime | **whitemode** - bright cream |
| around sunrise | **dawn** - a glossy warm-yellow → soft-blue wash |
| around sunset | **sunset** - a glossy orange → violet wash |
| solar eclipse | **eclipse-day** - a dracula dusk |
| lunar eclipse | **blood-moon** - coppery dark |
| clear night, full moon | **full-moon** - soft blue dark |
| clear night, new moon | **new-moon** - deepest dark |
| any other phase | **moon** - neutral dark |

The nav bar and the **ESC menu** recolour with it: the dawn menu pools a warm
**sunrise glow** at its foot, the sunset menu turns violet, and the **cursor wind
trail recolours too** (a dark, hushed wind at night).

### The sun button → a little “sky” window
On every main page (not in labs) a small **☀** sits by the menu. Click it and a
draggable, OS-style window opens - anchored under the sun, draggable anywhere on
desktop, a tap-outside card on mobile - reporting the live state: **time, Earth’s
position on its orbit, season, and the moon phase** (with an eclipse note when one
is happening). A **change** button takes you back to the home page to set a new sky.

### Trees that know the season
A procedural tree sways in the wind behind the **ESC menu** and across the **about
page**. Its foliage follows the **calendar**:
- **summer** - full green canopy
- **autumn** - reds, oranges, browns (the falling leaves too)
- **winter** - nearly bare; the few leaves left are brown, and round **snow** flecks drift down
- **spring** - fresh greens dotted with pink **blossoms**

On the darker lunar nights the tree dims toward black - present, but hushed.

---

## The other rooms

- **About (`me.html`)** - an editorial page that scrolls up over a full-screen tree swaying in the wind, a grey cursor wind-trail following the mouse, and a **projects viewer**: opening one pops a draggable OS-style window with a live `<iframe>` (and a graceful “open in a tab” fallback for sites that refuse to be embedded).
- **Map (`map.html`)** - a friendly flat-colour globe (globe.gl). Places are tiered **home / been / passed-through**; **flights** arc between them and **road trips** run as straight lines hugging the surface. At night the space around the globe fills with **stars that pan as you spin it** (and thin out under a bright moon, like the home sky).
- **Blog (`blog.html`)** - a featured hero, pagination, a live search box, a desktop keyboard mode, and falling leaves on the cursor wind.
- **Labs (`labs/`)** - *lluc labs*, the experimentation zone (hazard-tape trim, always white): an **englyph** syllable-block generator and a **cassette** cover composer.

## The ESC menu
Press **ESC** (or click the logo / hamburger) anywhere: a rotating 3D **barrel**
of pages you scroll, drag or jump to by number, with that fresh tree growing
behind it. It knows **two worlds** - the main site and the labs - and switches the
wheel and the trim accordingly.

---

## Structure

```
index.html        the living-sky home page
me.html           about
blog.html         blog (hash-routed)
map.html          travel globe
labs/             the experimentation zone
  labs.html         labs index
  englglyph.html    syllable-block generator
  cassette.html     cassette cover composer
assets/
  theme.js / theme.css   time-of-day theming (the palette engine)
  nav.js                 the two-world ESC menu + sky window
  tree.js                the seasonal procedural tree
  window.js              the OS-style window viewer
  render.js              englyph rendering
  fonts/ img/ lib/ …     shared assets
```

Everything is static and dependency-free except the map, which pulls **globe.gl**
from a CDN (and needs WebGL).

---

*Look closely. There’s more than there seems.*
