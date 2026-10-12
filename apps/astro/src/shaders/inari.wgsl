// Cover art for Inari — a private control plane for physical devices.
//
// Inari calls itself the trusted threshold between physical devices and
// software, so the print is a boundary: printers, scales, and scanners on the
// left, the control plane on the right, and one opening between them that all
// traffic has to pass through. The agent stands in that opening.
//
// The motion is the part of the product that is hard to state in a sentence.
// The link to the controller drops on a cycle; work does not stop, it queues
// beside the agent and crosses in a burst when the link comes back. A cover
// that only drew the topology would miss what the thing is for.
//
// This is the one print on a light ground. The other drawn covers are ink on
// dark, and a wall of four needs a sheet of paper in it.

import { bayer4, cover, grain, hairline, sdBox, sdSegment } from "./ink.wgsl";

struct Params {
  /// Seconds since the cover started drawing.
  time: f32,
  /// Print width over height, so the composition holds at any canvas size.
  aspect: f32,
  /// One device pixel in print units — the width every edge is resolved over.
  pixel: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

/// The agent straddles the boundary, because it is the opening.
const AGENT: vec2f = vec2f(-0.040, 0.0);
const BOUNDARY_X: f32 = AGENT.x;
const GAP_HALF: f32 = 0.068;
const CONTROLLER: vec2f = vec2f(0.330, 0.0);
const DEVICE_X: f32 = -0.480;
const SERVICE_X: f32 = 0.566;

/// Seconds for one outage-and-recovery cycle.
const CYCLE: f32 = 17.0;
const OFFLINE_AT: f32 = 0.50;
const DRAIN_AT: f32 = 0.80;
const QUEUE_MAX: i32 = 7;

const PAPER_TOP: vec3f = vec3f(0.914, 0.902, 0.875);
const PAPER_BOTTOM: vec3f = vec3f(0.855, 0.841, 0.812);
const INK: vec3f = vec3f(0.129, 0.133, 0.141);
const TORII: vec3f = vec3f(0.741, 0.227, 0.192);

fn deviceY(index: i32) -> f32 {
  return 0.292 - f32(index) * 0.292;
}

/// A receipt printer, a scale, and a scanner, drawn as themselves.
///
/// Three identical boxes would say "three nodes"; the whole point of this
/// project is that the things on this side of the boundary are awkward,
/// specific hardware. Each silhouette has to be recognisable at print size,
/// so the detail that survives is the outline, not the ornament.
fn deviceDistance(point: vec2f, index: i32, pixel: f32) -> f32 {
  let local = point - vec2f(DEVICE_X, deviceY(index));
  let edge = hairline(0.0018, pixel);

  if (index == 0) {
    // Receipt printer: a body, the paper slot, and the tongue coming out.
    let body = abs(sdBox(local - vec2f(0.0, -0.008), vec2f(0.054, 0.030))) - edge;
    let slot = sdBox(local - vec2f(0.0, 0.020), vec2f(0.030, edge));
    let paper = sdBox(local - vec2f(0.0, 0.036), vec2f(0.026, 0.016));
    return min(body, min(slot, abs(paper) - edge));
  }
  if (index == 1) {
    // Scale: a platform on a plinth, with the readout below it.
    let platform = sdBox(local - vec2f(0.0, 0.021), vec2f(0.054, 0.0048));
    let plinth = abs(sdBox(local - vec2f(0.0, -0.012), vec2f(0.038, 0.026))) - edge;
    let readout = sdBox(local - vec2f(0.0, -0.014), vec2f(0.020, 0.008));
    return min(platform, min(plinth, readout));
  }
  // Scanner: a flat bed, the lid seam, and the lamp inside it.
  let bed = abs(sdBox(local, vec2f(0.058, 0.026))) - edge;
  let seam = sdBox(local - vec2f(0.0, 0.009), vec2f(0.058, edge));
  let lamp = sdBox(local - vec2f(-0.012, -0.010), vec2f(0.030, 0.0055));
  return min(bed, min(seam, lamp));
}

/// Postgres, OIDC, and the certificate authority behind the controller.
fn serviceDistance(point: vec2f, index: i32, pixel: f32) -> f32 {
  let local = point - vec2f(SERVICE_X, 0.215 - f32(index) * 0.215);
  let edge = hairline(0.0016, pixel);
  return abs(sdBox(local, vec2f(0.030, 0.021))) - edge;
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  // Print space: origin at the centre, y up, one unit per print height.
  let p = vec2f((uv.x - 0.5) * params.aspect, 0.5 - uv.y);
  let px = params.pixel;
  let t = params.time;

  let cycle = fract(t / CYCLE);
  let offline = cycle > OFFLINE_AT;
  let draining = cycle > DRAIN_AT;
  // Work queued beside the agent: it accumulates for as long as the link is
  // down and leaves in one burst, which is the behaviour worth drawing.
  let held = select(
    0.0,
    select(
      f32(QUEUE_MAX) * smoothstep(OFFLINE_AT, DRAIN_AT, cycle),
      f32(QUEUE_MAX) * (1.0 - smoothstep(DRAIN_AT, 0.94, cycle)),
      draining,
    ),
    offline,
  );

  var color = mix(PAPER_BOTTOM, PAPER_TOP, smoothstep(-0.65, 0.68, p.y - p.x * 0.20));

  // Module grid: a drawn sheet, not graph paper. Only the coarse lines carry
  // any weight, and neither reaches the tone of a real mark.
  let sheetGrid = (0.5 - abs(fract(p / 0.0625) - 0.5)) * 0.0625;
  color = mix(color, INK, cover(min(sheetGrid.x, sheetGrid.y) - hairline(0.0004, px), px) * 0.05);

  // The boundary, with its one opening. Drawn before everything so the links
  // and the traffic sit on top of it rather than being interrupted by it.
  let upper = sdSegment(p, vec2f(BOUNDARY_X, 0.430), vec2f(BOUNDARY_X, GAP_HALF), hairline(0.0011, px));
  let lower = sdSegment(p, vec2f(BOUNDARY_X, -0.430), vec2f(BOUNDARY_X, -GAP_HALF), hairline(0.0011, px));
  color = mix(color, INK, cover(min(upper, lower), px) * 0.42);
  // Hatch ticks along the boundary. A bare vertical rule is a line; a hatched
  // one is a side you are either on or not.
  for (var h = 0; h < 14; h = h + 1) {
    let y = -0.420 + f32(h) * 0.0646;
    if (abs(y) < GAP_HALF + 0.02) { continue; }
    let tick = sdSegment(
      p,
      vec2f(BOUNDARY_X, y),
      vec2f(BOUNDARY_X - 0.018, y - 0.014),
      hairline(0.0009, px),
    );
    color = mix(color, INK, cover(tick, px) * 0.24);
  }

  // Ticks either side of the opening, the way a plan marks a doorway.
  for (var s = -1; s <= 1; s = s + 2) {
    let jamb = sdSegment(
      p,
      vec2f(BOUNDARY_X - 0.016, f32(s) * GAP_HALF),
      vec2f(BOUNDARY_X + 0.016, f32(s) * GAP_HALF),
      hairline(0.0011, px),
    );
    color = mix(color, INK, cover(jamb, px) * 0.42);
  }

  // Devices, their links to the agent, and the traffic on them.
  for (var i = 0; i < 3; i = i + 1) {
    let seat = vec2f(DEVICE_X + 0.082, deviceY(i));
    let link = sdSegment(p, seat, AGENT, hairline(0.0011, px));
    color = mix(color, INK, cover(link, px) * 0.34);
    color = mix(color, INK, cover(deviceDistance(p, i, px), px));

    // Enrollment: two devices hold a certificate, the third is still pending,
    // so the mark reads as a state rather than as decoration.
    let enrolled = select(1.0, 0.0, i == 2);
    let badge = sdBox(p - vec2f(DEVICE_X + 0.082, deviceY(i)), vec2f(0.0105));
    color = mix(color, INK, cover(badge, px) * mix(0.0, 1.0, enrolled));
    color = mix(color, INK, cover(abs(badge) - hairline(0.0014, px), px));

    // One tick per device, always moving: the local side keeps working whether
    // or not the controller is reachable.
    let march = fract(t * 0.21 + f32(i) * 0.37);
    let tick = sdBox(p - mix(seat, AGENT, march), vec2f(0.0065));
    color = mix(color, INK, cover(tick, px) * 0.72);
  }

  // The agent, in the opening.
  let agentBody = abs(sdBox(p - AGENT, vec2f(0.052, 0.046))) - hairline(0.0020, px);
  color = mix(color, INK, cover(agentBody, px));
  let agentCore = sdBox(p - AGENT, vec2f(0.020, 0.016));
  color = mix(color, INK, cover(agentCore, px) * 0.85);

  // Held work, stacked on the device side of the boundary while the link is
  // down. It belongs to this side: that is the claim the product makes.
  for (var q = 0; q < QUEUE_MAX; q = q + 1) {
    if (f32(q) >= held) { break; }
    let slot = sdBox(
      p - vec2f(AGENT.x - 0.064, 0.064 + f32(q) * 0.0255),
      vec2f(0.032, 0.0088),
    );
    color = mix(color, TORII, cover(slot, px));
  }

  // The link across the boundary. Solid while it holds, dashed while it does
  // not — a dropped link should look like an absence, not like a colour.
  if (offline && !draining) {
    for (var d = 0; d < 9; d = d + 1) {
      let a = mix(AGENT, CONTROLLER, (f32(d) + 0.18) / 9.0);
      let b = mix(AGENT, CONTROLLER, (f32(d) + 0.62) / 9.0);
      color = mix(color, INK, cover(sdSegment(p, a, b, hairline(0.0012, px)), px) * 0.44);
    }
  } else {
    let span = sdSegment(p, AGENT, CONTROLLER, hairline(0.0016, px));
    color = mix(color, INK, cover(span, px) * 0.60);

    // Traffic across the threshold: a steady beat normally, and the backlog
    // going through in a burst on recovery.
    let carriers = select(2, 6, draining);
    for (var c = 0; c < carriers; c = c + 1) {
      let speed = select(0.26, 0.85, draining);
      let march = fract(t * speed + f32(c) / f32(carriers));
      let at = mix(AGENT, CONTROLLER, march);
      let tick = sdBox(p - at, vec2f(0.0075));
      color = mix(color, select(INK, TORII, draining), cover(tick, px));
    }
  }

  // The controller and the services behind it.
  let controllerBody = abs(sdBox(p - CONTROLLER, vec2f(0.060, 0.052))) - hairline(0.0020, px);
  color = mix(color, INK, cover(controllerBody, px));
  for (var r = 0; r < 3; r = r + 1) {
    let rib = sdSegment(
      p,
      CONTROLLER - vec2f(0.030, 0.0) + vec2f(0.0, 0.022 - f32(r) * 0.022),
      CONTROLLER + vec2f(0.030, 0.0) + vec2f(0.0, 0.022 - f32(r) * 0.022),
      hairline(0.0013, px),
    );
    color = mix(color, INK, cover(rib, px) * 0.55);

    let seat = vec2f(SERVICE_X - 0.030, 0.215 - f32(r) * 0.215);
    let feed = sdSegment(p, CONTROLLER + vec2f(0.060, 0.0), seat, hairline(0.0011, px));
    color = mix(color, INK, cover(feed, px) * 0.30);
    color = mix(color, INK, cover(serviceDistance(p, r, px), px) * 0.78);
  }

  // Substrate: grain first, then an ordered dither, so the sheet holds its
  // tone without banding at 8 bits.
  color += grain(uv * 2048.0, 0.013);
  color += bayer4(vec2u(uv / max(px, 1e-6))) * (1.5 / 255.0);

  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}
