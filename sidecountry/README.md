# Sidecountry

Snowboarding and skiing with forgiving, Skate-inspired trick controls and physical momentum. Massimo and Benn ride snowboards; Jeece skis; Fred B rides telemark.

Play online: **https://optimass.github.io/sidecountry/**

## Play on your laptop

Open the public URL. Rendering and Rapier's WebAssembly physics run on your device; there is no simulation server, stream, or account to sign into. Once the menu says **READY FOR OFFLINE LAPS**, the game and engine are cached. You can reload and play without a connection. Chrome and Edge can install it from the address bar or the **Install for offline laps** button when offered; Safari supports adding it to the Dock or Home Screen.

Pause to choose **Laptop / battery** graphics. It reduces resolution and disables shadows; the physical simulation stays at 120 Hz. Automatic graphics falls back to that setting when rendering runs slowly. Performance depends on your laptop and browser; WebGL hardware acceleration is recommended.

To serve the files yourself, from this directory:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open **http://localhost:8080**. No build step or package install is required. Service workers and controllers need HTTPS or localhost.

## Controls

| Action | Keyboard | Xbox / PlayStation |
| --- | --- | --- |
| Carve; request a 180 in the air | Left/right arrows or A/D | Left stick left/right |
| Tuck; request a frontflip in the air | Up arrow or W | Left stick up |
| Brake; request a backflip in the air | Down arrow or S | Left stick down |
| Brake | Shift | X / Square |
| Charge and pop | Hold Space, then release | Right stick down, then flick up; or hold A / Cross and release |
| Send a 180 | Q / E | Left stick during a pop |
| Send a flip | F | B / Circle |
| Send a cork | C | Y / Triangle |
| Grab | Hold J | LT / L2 or LB / L1 |
| Tweak | Hold K | RT / R2 or RB / R1 |
| Pause | P or Escape | Menu / Options |
| Restart | R | View / Share |
| Field guide | H | Use the menu |

Phones have dedicated **CORK**, **FLIP**, and left/right **180** buttons, plus steering, brake, grab, tweak, and pop. Tap a trick on the snow to automatically load, jump, and rotate; tap just after takeoff to start it in the air. On a kicker, a loaded trick waits for the lip. You can hold GRAB with another finger while corking. Sound starts muted; enable it with the music-note button.

## Riding

Gravity accelerates you downhill. Hold a direction to carve, and release to settle back into the fall line. Ground steering stays within a downhill arc, including when riding switch. Low-speed edge grip releases so a sideways board can slide instead of holding you across the hill. Hold brake to slow or stop; release it to let gravity get you moving again. A persistent low-speed snag on the mountain moves you a few metres onto a clear line without losing your combo. Flat fixtures still coast down naturally; this recovery is only enabled on downhill terrain.

A tap on pop gives useful airtime; holding charges a larger pop. Releases are buffered for 0.2 seconds, with 0.12 seconds of grace after a lip. Hold a direction during a pop to send a 180. Q/E, F, and C provide direct spin, flip, and cork requests; the same actions have controller and phone buttons. A rotation motor follows a smooth, timed physical rotation, with a tilted axis for corks. Scoring requires the body to perform at least 85% of the requested angular travel. Requests too late for a complete rotation leave you preparing for the landing.

Balance and catch assists help finish the move and get your feet under you, including switch landings. The centre of mass still follows real gravity and momentum; trick controls do not steer the flight path. Small sideways and tilted landings are forgiven. Extreme flat drops, body-first impacts, and fast obstacle collisions still wipe out. Ragdolls recover in 1.6 seconds. The beginner park has wider, mellower kickers, broader landing slopes, and an opening line of three aligned jumps. The chase camera is closer to the rider.

These are deliberate gameplay assists rather than a complete biomechanical simulation. Rider masses, equipment, snow grip, ramp contacts, ballistic motion, and wipeouts still use Rapier.

Rail slides require an actual collision with the rail. There is no proximity snap. Steer gently to maintain balance, and pop to exit. Link clean tricks within about two seconds to build a multiplier, then glide to bank the combo. Bailing loses the pending combo. Finish the 1.8 km run for a summary. Physics-version records are stored separately from the original arcade records, per rider and route, in your browser.

## Engine and checks

Three.js **0.170.0** renders the scene. Rapier **0.17.3** runs the rigid-body solver, continuous collision detection, terrain and feature contacts, angular dynamics, and ragdoll joints. Both are bundled in `lib/`; Rapier's compatibility build embeds its WebAssembly binary. MIT, Apache 2.0, and font SIL Open Font License files ship with the game. Nothing is fetched from a third-party CDN at runtime.

The physics regression checks protect gravity and energy behaviour, braking and release, frame-rate independence, ballistic flight without air steering, pop height, switch landings, extreme-impact combo loss, physical rail contact, sideways/uphill stall recovery, and actual off-axis corks that land and score for all four riders. Run them in the browser console on the game page:

```js
await (await import('./tests/physics-checks.js')).runPhysicsChecks();
```

Graphics are still stylized. The motion and collisions are more physical, but this is an original browser game inspired by Skate, rather than a reproduction of its complete physics, world, or animation system.

For future releases, update the module/CSS version queries and `cache-worker.js` cache name together so returning and offline players receive one consistent release.
