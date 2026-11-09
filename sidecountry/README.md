# Sidecountry

Snowboarding and skiing with physical momentum, carving, jumps, and landings. Massimo and Benn ride snowboards; Jeece skis; Fred B rides telemark.

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
| Carve; preload or check a spin | Left/right arrows or A/D | Left stick left/right |
| Tuck; preload or control a frontflip | Up arrow or W | Left stick up |
| Brake; preload or control a backflip | Down arrow or S | Left stick down |
| Brake / spread out in the air | Shift | X / Square |
| Charge and pop | Hold Space, then release | Right stick down, then flick up; or hold A / Cross and release |
| Grab | Hold J | LT / L2 or LB / L1 |
| Tweak | Hold K | RT / R2 or RB / R1 |
| Pause | P or Escape | Menu / Options |
| Restart | R | View / Share |
| Field guide | H | Use the menu |

Phones show steering, brake, grab, tweak, and pop buttons. Sound starts muted; enable it with the music-note button.

## Riding

Gravity accelerates you downhill. Turn across the slope to scrub speed, point downhill to build it, and tuck to reduce air drag. Edges redirect your existing momentum, with limited grip; sharp turns can slide. You can turn uphill, slow down, and ride switch. Snowboard, ski, and telemark riders have different masses, equipment lengths, grip, and handling.

A flat-ground ollie gives a human-sized pop. A kicker redirects incoming velocity along its actual surface; its speed, curve, and lip determine the flight. The airborne centre of mass follows gravity and existing momentum. Air controls apply limited orientation torques, rather than changing the flight path. Hold pop and steer before takeoff to wind up a spin; use the opposite direction to check it. Grabbing reduces rotational inertia, making you spin faster. Releasing controls does not snap rotation to a preset angle.

Land feet-down with your board or skis along your momentum. Switch landings keep their orientation. Hard flat landings, sideways edge catches, body collisions, and tree or rock impacts can cause a wipeout. Wipeouts create a 10-body, 9-joint Rapier ragdoll and return you to your last clean checkpoint. Board and skier balance, aerial posture control, and impact thresholds are game assists, rather than a complete biomechanical model.

Rail slides require an actual collision with the rail. There is no proximity snap. Steer gently to maintain balance, and pop to exit. Link clean tricks within about two seconds to build a multiplier, then glide to bank the combo. Bailing loses the pending combo. Finish the 1.8 km run for a summary. Physics-version records are stored separately from the original arcade records, per rider and route, in your browser.

## Engine and checks

Three.js **0.170.0** renders the scene. Rapier **0.17.3** runs the rigid-body solver, continuous collision detection, terrain and feature contacts, angular dynamics, and ragdoll joints. Both are bundled in `lib/`; Rapier's compatibility build embeds its WebAssembly binary. MIT, Apache 2.0, and font SIL Open Font License files ship with the game. Nothing is fetched from a third-party CDN at runtime.

The physics regression checks protect gravity and energy behaviour, braking, frame-rate independence, ballistic flight without air steering, realistic ollie height, switch landings, hard-impact combo loss, and physical rail contact. Run them in the browser console on the game page:

```js
await (await import('./tests/physics-checks.js')).runPhysicsChecks();
```

Graphics are still stylized. The motion and collisions are more physical, but this is an original browser game inspired by Skate, rather than a reproduction of its complete physics, world, or animation system.

For future releases, update the module/CSS version queries and `cache-worker.js` cache name together so returning and offline players receive one consistent release.
