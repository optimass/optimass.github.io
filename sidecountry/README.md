# Sidecountry

A browser snowboarding and skiing game. Four friends, two mountains, and a lot of ways down.

Play online: **https://optimass.github.io/sidecountry/**

## Play

From this directory:

```sh
python3 -m http.server 8080 --bind 0.0.0.0
```

Open **http://localhost:8080** in Chrome, Firefox, Edge, or Safari. The game needs WebGL. It also works on a phone. There is no build step or package install. Three.js 0.170.0 is bundled locally in `lib/` under its MIT license. DM Sans and DM Serif Display are bundled under the SIL Open Font License. All game assets load locally and work offline once served. Gamepads require a secure context (HTTPS or localhost).

## The crew

- **Massimo:** small, steazy snowboarder. Quick spins, a little extra pop.
- **Benn:** tall, lanky snowboarder. Big reach, loose style.
- **Jeece:** skier, off-duty policeman. Fast edges and a safety grab.
- **Fred B:** fireman on telemark skis. Free heels, deep knee turns.

## Controls

| Action | Keyboard | Xbox / PlayStation |
| --- | --- | --- |
| Carve / spin in the air | Arrows left/right or A/D | Left stick left/right |
| Accelerate / frontflip in the air | Up or W | Left stick up |
| Brake / backflip in the air | Down or S | Left stick down |
| Charge and pop | Hold Space, then release | Right stick down, then flick up; or hold A / Cross and release |
| Grab | Hold J | LT / L2, or LB / L1 |
| Tweak | Hold K | RT / R2, or RB / R1 |
| Pause | P or Escape | Menu / Options |
| Restart | R | View / Share |
| Field guide | H | Use the menu |

Touch devices show steering, grab, tweak, and pop buttons. Sound starts muted; click the music-note button to enable procedural wind, snow, and trick sounds.

## Find a line

**Juniper Park** has orange kickers and rails. **The Ridgeline** has larger natural snow kickers. Both are 1.8 km runs. Ride across a ramp to launch automatically, or charge and release a jump anywhere.

Spin, flip, grab, and tweak while airborne. Stop turning before landing: rotation assists settle to the nearest 180° for spins and 360° for flips. Clean landings score points. Jump onto a rail to lock into a boardslide or ski slide; jump or carve out to exit. Link tricks within about two seconds to grow a combo and multiplier. The combo banks after a short clean glide. Bailing loses the current combo, but keeps banked points.

Finish the run to see your score, best combo, air time, and bails. Personal records are stored in this browser, separately for each rider and route. Pause automatically when the browser loses focus.

This is an original arcade game inspired by the charged, flick-to-pop feeling of Skate, with stylized 3D graphics and assisted landings. It does not reproduce Skate's full physics or trick system.
