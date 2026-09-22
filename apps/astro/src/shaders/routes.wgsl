// Cover art for VRPT-SWTS — vehicle routing with transshipment.
//
// The print draws the problem, not a generic map. Collection vehicles run
// fixed tours through their stops and empty at a transfer station; a transport
// vehicle then carries the load from the station to the landfill. The
// transshipment is the whole point of the problem, so it is the centre of the
// composition: every thin line ends at a station, and only heavy lines leave
// one.
//
// The faint cell boundaries under everything are service districts, not a
// texture — they come from the same jittered lattice each frame, so the region
// a tour covers stays the region it covers.

import { voronoi2d } from "@vgpu/wgsl-std/noise";
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

/// Stops on the northern tour, ending at its transfer station.
const NORTH_COUNT: i32 = 9;
/// Stops on the southern tour, ending at its transfer station.
const SOUTH_COUNT: i32 = 8;

const STATION_NORTH: vec2f = vec2f(0.240, 0.100);
const STATION_SOUTH: vec2f = vec2f(0.220, -0.240);
const LANDFILL: vec2f = vec2f(0.548, -0.062);
const DEPOT: vec2f = vec2f(-0.120, 0.010);

const GROUND_TOP: vec3f = vec3f(0.066, 0.074, 0.071);
const GROUND_BOTTOM: vec3f = vec3f(0.034, 0.039, 0.038);
const CHALK: vec3f = vec3f(0.855, 0.867, 0.843);
const VERMILION: vec3f = vec3f(0.769, 0.368, 0.259);

/// A point on a tour, by tour index and stop index.
///
/// One table rather than two so the tours share a coordinate system and can be
/// walked by the same code. The last point of each tour is its station, which
/// is what makes a tour a tour and not an open path.
fn tourPoint(tour: i32, index: i32) -> vec2f {
  var north = array<vec2f, NORTH_COUNT>(
    vec2f(-0.596, 0.180),
    vec2f(-0.520, 0.352),
    vec2f(-0.356, 0.268),
    vec2f(-0.244, 0.396),
    vec2f(-0.116, 0.276),
    vec2f(0.026, 0.372),
    vec2f(0.130, 0.238),
    vec2f(0.268, 0.318),
    STATION_NORTH,
  );
  var south = array<vec2f, SOUTH_COUNT>(
    vec2f(-0.606, -0.086),
    vec2f(-0.500, -0.268),
    vec2f(-0.344, -0.162),
    vec2f(-0.236, -0.362),
    vec2f(-0.074, -0.238),
    vec2f(0.052, -0.392),
    vec2f(0.186, -0.372),
    STATION_SOUTH,
  );
  if (tour == 0) {
    return north[clamp(index, 0, NORTH_COUNT - 1)];
  }
  return south[clamp(index, 0, SOUTH_COUNT - 1)];
}

fn tourCount(tour: i32) -> i32 {
  return select(SOUTH_COUNT, NORTH_COUNT, tour == 0);
}

/// Stops cleared by a vehicle at normalised progress `t`.
fn stopsCleared(tour: i32, t: f32) -> f32 {
  return floor(t * f32(tourCount(tour) - 1));
}

/// Where a vehicle is, at normalised progress along its tour.
///
/// Progress is per leg rather than per unit length: a stop is a stop whether
/// or not the street to it is long, and pacing by distance would make the
/// vehicle crawl through the dense part of the district.
fn tourPosition(tour: i32, t: f32) -> vec2f {
  let legs = f32(tourCount(tour) - 1);
  let scaled = clamp(t, 0.0, 1.0) * legs;
  let leg = i32(floor(min(scaled, legs - 0.001)));
  let local = scaled - f32(leg);
  return mix(tourPoint(tour, leg), tourPoint(tour, leg + 1), local);
}

/// Outline of a transfer station: a chamfered square, split by a bar.
///
/// The cut corners are the whole reason this mark is not a node like the
/// stops — a station is where one kind of vehicle hands off to another, and it
/// should be recognisable as a different kind of thing from across the print.
fn stationDistance(point: vec2f, center: vec2f, pixel: f32) -> f32 {
  let local = point - center;
  let chamfered = max(
    sdBox(local, vec2f(0.0235)),
    dot(abs(local), vec2f(0.7071)) - 0.0295,
  );
  let outline = abs(chamfered) - hairline(0.0016, pixel);
  let bar = sdBox(local, vec2f(0.0235, hairline(0.0015, pixel)));
  return min(outline, bar);
}

/// The landfill: an open cell with its face hatched, the way a plan draws
/// ground that is filled rather than built on.
fn landfillDistance(point: vec2f, center: vec2f, pixel: f32) -> f32 {
  let local = point - center;
  let outline = abs(sdBox(local, vec2f(0.052, 0.034))) - hairline(0.0018, pixel);
  var hatch = 1e6;
  for (var i = -2; i <= 2; i = i + 1) {
    let offset = f32(i) * 0.026;
    let line = sdSegment(
      local,
      vec2f(offset - 0.028, -0.034),
      vec2f(offset + 0.028, 0.034),
      hairline(0.0011, pixel),
    );
    hatch = min(hatch, max(line, sdBox(local, vec2f(0.052, 0.034))));
  }
  return min(outline, hatch);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  // Print space: origin at the centre, y up, one unit per print height.
  let p = vec2f((uv.x - 0.5) * params.aspect, 0.5 - uv.y);
  let px = params.pixel;
  let t = params.time;

  var color = mix(GROUND_BOTTOM, GROUND_TOP, smoothstep(-0.62, 0.70, p.y + p.x * 0.25));

  // Service districts. Drawn from the second-nearest minus nearest feature
  // distance, which puts a line exactly on each cell boundary, then held to a
  // whisper: the districts are the ground the routes are solved over, and the
  // moment they compete the routes stop being readable.
  let cells = voronoi2d(p * 9.0 + vec2f(11.0, 5.0));
  // The line has to be measured in pixels, not in field units. `f2 - f1` grows
  // slowly where a boundary runs between two distant sites, so thresholding it
  // directly widens those boundaries into wedges that read as light leaks.
  let edge = cells.f2 - cells.f1;
  let boundary = 1.0 - smoothstep(0.0, max(fwidth(edge), 1e-5) * 2.2, edge);
  color = mix(color, CHALK * 0.34, boundary * 0.13);

  // Survey grid under the districts. Two decades of it — a fine module and a
  // heavier one every fifth line — so the print reads as a plan with a scale
  // rather than a diagram floating on a dark field.
  let fine = (0.5 - abs(fract(p / 0.05) - 0.5)) * 0.05;
  let coarse = (0.5 - abs(fract(p / 0.25) - 0.5)) * 0.25;
  let fineLine = cover(min(fine.x, fine.y) - hairline(0.0004, px), px);
  let coarseLine = cover(min(coarse.x, coarse.y) - hairline(0.0005, px), px);
  color = mix(color, CHALK * 0.30, max(fineLine * 0.06, coarseLine * 0.11));

  // Deadhead legs: the empty run from the depot out to the first stop of each
  // tour. Dashed because no collection happens on them — in this problem they
  // are cost without work, which is exactly what a solver is trying to cut.
  for (var tour = 0; tour < 2; tour = tour + 1) {
    let first = tourPoint(tour, 0);
    for (var d = 0; d < 11; d = d + 1) {
      let a = mix(DEPOT, first, (f32(d) + 0.15) / 11.0);
      let b = mix(DEPOT, first, (f32(d) + 0.72) / 11.0);
      color = mix(color, CHALK * 0.22, cover(sdSegment(p, a, b, hairline(0.0011, px)), px));
    }
  }

  // Tours: two collection vehicles, each on its own beat so the pair never
  // pulses in step.
  let progress = array<f32, 2>(
    fract(t * 0.052),
    fract(t * 0.043 + 0.38),
  );

  for (var tour = 0; tour < 2; tour = tour + 1) {
    let count = tourCount(tour);
    let travelled = stopsCleared(tour, progress[tour]);
    let vehicle = tourPosition(tour, progress[tour]);
    let ahead = tourPosition(tour, progress[tour] + 0.004);

    for (var i = 0; i < count - 1; i = i + 1) {
      let a = tourPoint(tour, i);
      let b = tourPoint(tour, i + 1);
      // A leg the vehicle has already run is drawn as collected: brighter, and
      // in the accent once the load is on board.
      let done = select(0.0, 1.0, f32(i) < travelled);
      let line = sdSegment(p, a, b, hairline(0.0013, px));
      let ink = mix(CHALK * 0.26, VERMILION * 0.92, done);
      color = mix(color, ink, cover(line, px));
    }

    for (var i = 0; i < count - 1; i = i + 1) {
      let stop = tourPoint(tour, i);
      let cleared = select(0.0, 1.0, f32(i) < travelled);
      let node = sdBox(p - stop, vec2f(0.0092));
      color = mix(color, mix(CHALK * 0.44, VERMILION, cleared), cover(node, px));
      // A cleared stop keeps a mark: the tour has to be legible as history,
      // not just as a vehicle in motion.
      if (cleared > 0.5) {
        let core = sdBox(p - stop, vec2f(0.0036));
        color = mix(color, GROUND_BOTTOM, cover(core, px));
      }
    }

    // The vehicle, and the load it is carrying: a bar trailing the direction
    // of travel, one segment per stop cleared.
    let heading = normalize(ahead - vehicle + vec2f(1e-5, 0.0));
    let body = sdSegment(p, vehicle - heading * 0.010, vehicle + heading * 0.010, 0.0062);
    color = mix(color, CHALK, cover(body, px));

    // Load: one tick behind the vehicle per stop cleared. A bar would read as
    // a progress meter; ticks read as cargo, which is what they are.
    for (var i = 0; i < count - 2; i = i + 1) {
      if (f32(i) >= travelled) { break; }
      let at = vehicle - heading * (0.021 + f32(i) * 0.0115);
      let side = vec2f(-heading.y, heading.x);
      let tick = sdSegment(p, at - side * 0.0055, at + side * 0.0055, hairline(0.0017, px));
      color = mix(color, VERMILION, cover(tick, px));
    }
  }

  // Transshipment. The transport leg is heavier than any collection leg,
  // because that is the trade the problem is about: many light tours feeding
  // one heavy haul.
  let haulPhase = fract(t * 0.085);
  let outbound = haulPhase < 0.55;
  let haulT = select((haulPhase - 0.55) / 0.45, haulPhase / 0.55, outbound);
  // The origin is fixed for a whole haul cycle. Deriving it from a wave would
  // let the truck change which station it left from while it was in transit.
  let origin = select(STATION_SOUTH, STATION_NORTH, i32(floor(t * 0.085)) % 2 == 0);

  let haulNorth = sdSegment(p, STATION_NORTH, LANDFILL, hairline(0.0026, px));
  let haulSouth = sdSegment(p, STATION_SOUTH, LANDFILL, hairline(0.0026, px));
  color = mix(color, CHALK * 0.34, cover(min(haulNorth, haulSouth), px));

  let truck = mix(origin, LANDFILL, select(1.0 - haulT, haulT, outbound));
  let haulHeading = normalize(LANDFILL - origin);
  let truckBody = sdSegment(
    p,
    truck - haulHeading * 0.016,
    truck + haulHeading * 0.016,
    0.0082,
  );
  color = mix(color, mix(CHALK * 0.70, VERMILION, select(0.0, 1.0, outbound)), cover(truckBody, px));

  // The two transfer stations and the landfill.
  color = mix(color, CHALK * 0.80, cover(stationDistance(p, STATION_NORTH, px), px));
  color = mix(color, CHALK * 0.80, cover(stationDistance(p, STATION_SOUTH, px), px));

  color = mix(color, CHALK * 0.62, cover(landfillDistance(p, LANDFILL, px), px));

  // The depot: a ringed node, the one mark in the frame that is neither a
  // stop nor a facility. Both tours leave from here and both come back.
  let depotRing = abs(sdBox(p - DEPOT, vec2f(0.0245))) - hairline(0.0016, px);
  let depotCore = sdBox(p - DEPOT, vec2f(0.0105));
  color = mix(color, CHALK * 0.76, cover(min(depotRing, depotCore), px));

  // Substrate: grain first, then an ordered dither, so the long tonal sweep
  // across the ground resolves without banding at 8 bits.
  color += grain(uv * 2048.0, 0.010);
  color += bayer4(vec2u(uv / max(px, 1e-6))) * (1.5 / 255.0);

  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}
