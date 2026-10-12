// Cover art for RAM — a Random Access Machine language and emulator.
//
// The print is the thing the project produces: a program, mid-execution. Rows
// are instructions (address ticks, opcode, operand), the gutter carries the
// jump arcs that make the listing a loop rather than a list, and the block on
// the right is the register file those instructions write to. Both panes share
// one row grid, so the frame reads as a single machine view rather than two
// drawings that happen to sit side by side.
//
// Execution follows a fixed trace, so the same jump is taken at the same beat
// every time and the arcs mean something. Registers change on the step that
// writes them, never on a timer.

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

const ROWS: i32 = 10;
const ROW_TOP: f32 = 0.400;
const ROW_PITCH: f32 = 0.0889;
const TRACE_LENGTH: i32 = 22;
const STEPS_PER_SECOND: f32 = 1.35;

const ARC_OUTER_X: f32 = -0.600;
const ARC_INNER_X: f32 = -0.560;
const ARC_STUB_X: f32 = -0.520;
const ADDRESS_X: f32 = -0.500;
const ADDRESS_PITCH: f32 = 0.017;
const OPCODE_X: f32 = -0.435;
const OPCODE_WIDTH: f32 = 0.105;
const OPERAND_X: f32 = -0.310;
const OPERAND_MAX: f32 = 0.455;
const RULE_X: f32 = 0.205;
const REGISTER_X: f32 = 0.284;
const REGISTER_CELLS: i32 = 6;
const REGISTER_CELL_PITCH: f32 = 0.0575;

const GROUND_TOP: vec3f = vec3f(0.094, 0.099, 0.105);
const GROUND_BOTTOM: vec3f = vec3f(0.050, 0.053, 0.058);
const BONE: vec3f = vec3f(0.886, 0.871, 0.831);
const AMBER: vec3f = vec3f(0.831, 0.596, 0.271);

fn rowY(row: i32) -> f32 {
  return ROW_TOP - f32(row) * ROW_PITCH;
}

fn hash(seed: f32) -> f32 {
  return fract(sin(seed * 12.9898) * 43758.5453);
}

/// The executing instruction for a step of the trace.
///
/// Hand-written rather than generated: the listing has to loop the way a real
/// program loops — a body that repeats, an exit, and a second pass through a
/// tail — or the arcs in the gutter are decoration.
fn traceRow(step: i32) -> i32 {
  var trace = array<i32, TRACE_LENGTH>(
    0, 1, 2, 3, 4, 5, 6, 7,
    2, 3, 4, 5, 6, 7,
    2, 3, 4, 5, 6, 7,
    8, 9,
  );
  return trace[((step % TRACE_LENGTH) + TRACE_LENGTH) % TRACE_LENGTH];
}

/// Operand width for a row, as a fraction of the operand column.
///
/// Two rows in ten come back near zero. A listing where every line carries a
/// wide operand has no texture, and a real program is full of instructions
/// that take a register and nothing else.
fn operandWidth(row: i32) -> f32 {
  let value = hash(f32(row) * 3.17 + 1.7);
  return select(0.30 + value * 0.70, 0.06, value < 0.2);
}

/// Lit cells of a register, packed as six bits.
///
/// A register is only disturbed when the trace writes it, which is what keeps
/// the block on the right from reading as an idle animation.
fn registerBits(index: i32, writes: f32) -> f32 {
  return hash(f32(index) * 7.31 + floor(writes) * 2.19);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  // Print space: origin at the centre, y up, one unit per print height.
  let p = vec2f((uv.x - 0.5) * params.aspect, 0.5 - uv.y);
  let px = params.pixel;

  let clock = params.time * STEPS_PER_SECOND;
  let step = i32(floor(clock));
  let phase = fract(clock);
  let executing = traceRow(step);
  let executingY = rowY(executing);

  // Ground: a shallow diagonal lift, brightest at the top left where the
  // listing starts. Deliberately narrow in range — this is paper for a
  // technical drawing, not a backdrop with a mood.
  var color = mix(
    GROUND_BOTTOM,
    GROUND_TOP,
    smoothstep(-0.7, 0.75, p.y - p.x * 0.35),
  );

  // Current-line band, clipped to the listing pane. An editor highlights the
  // executing row across the pane it belongs to; a glow that bleeds past the
  // column would read as a lens artefact instead of as state.
  let band = sdBox(
    p - vec2f((ARC_STUB_X + RULE_X) * 0.5, executingY),
    vec2f((RULE_X - ARC_STUB_X) * 0.5, 0.030),
  );
  color = mix(color, AMBER * 0.42, cover(band, px) * 0.11);

  // Control flow, in the gutter. Two arcs at two depths: the inner one is the
  // loop the trace is running, the outer one the branch that ends it.
  let arcs = array<vec3f, 2>(
    // spine x, source row, target row
    vec3f(ARC_INNER_X, 7.0, 2.0),
    vec3f(ARC_OUTER_X, 9.0, 5.0),
  );
  for (var a = 0; a < 2; a = a + 1) {
    let arc = arcs[a];
    let sourceY = rowY(i32(arc.y));
    let targetY = rowY(i32(arc.z));
    let taken = select(0.0, 1.0, executing == i32(arc.z) && traceRow(step - 1) == i32(arc.y));
    let ink = mix(BONE * 0.32, AMBER, taken);

    let spine = sdSegment(p, vec2f(arc.x, sourceY), vec2f(arc.x, targetY), hairline(0.0009, px));
    let fromRow = sdSegment(p, vec2f(arc.x, sourceY), vec2f(ARC_STUB_X, sourceY), hairline(0.0009, px));
    let toRow = sdSegment(p, vec2f(arc.x, targetY), vec2f(ARC_STUB_X, targetY), hairline(0.0009, px));
    color = mix(color, ink, cover(min(spine, min(fromRow, toRow)), px));

    // Arrowhead at the target: a branch has a direction, and a bracket without
    // one is just a brace.
    let upper = sdSegment(p, vec2f(ARC_STUB_X, targetY), vec2f(ARC_STUB_X - 0.019, targetY + 0.011), hairline(0.0009, px));
    let lower = sdSegment(p, vec2f(ARC_STUB_X, targetY), vec2f(ARC_STUB_X - 0.019, targetY - 0.011), hairline(0.0009, px));
    color = mix(color, ink, cover(min(upper, lower), px));
  }

  // The listing.
  for (var row = 0; row < ROWS; row = row + 1) {
    let y = rowY(row);
    let live = select(0.0, 1.0, row == executing);

    // Address: three ticks carrying the row's low bits, the way a listing
    // prints an address before it prints an instruction.
    let bits = i32(hash(f32(row) * 5.53) * 8.0);
    for (var b = 0; b < 3; b = b + 1) {
      let lit = select(0.22, 0.60, ((bits >> u32(b)) & 1) == 1);
      let tick = sdBox(p - vec2f(ADDRESS_X + f32(b) * ADDRESS_PITCH, y), vec2f(0.005, 0.005));
      color = mix(color, BONE * lit, cover(tick, px));
    }

    // Opcode: a fixed-width block whose tone is its class — load and store,
    // arithmetic, or branch. Fixed width because an opcode is a word, not a
    // quantity; only the operand beside it carries magnitude.
    let opcodeTone = 0.30 + floor(hash(f32(row) * 2.11 + 0.4) * 3.0) * 0.17;
    let opcode = sdBox(
      p - vec2f(OPCODE_X + OPCODE_WIDTH * 0.5, y),
      vec2f(OPCODE_WIDTH * 0.5, 0.0115),
    );
    color = mix(color, mix(BONE * opcodeTone, AMBER, live), cover(opcode, px));

    // Operand.
    let width = operandWidth(row) * OPERAND_MAX * 0.5;
    let operand = sdBox(p - vec2f(OPERAND_X + width, y), vec2f(width, hairline(0.0065, px)));
    color = mix(color, mix(BONE * 0.26, AMBER * 0.88, live), cover(operand, px));

    if (row == executing) {
      // The value leaves the row on the beat it is read, and crosses the rule
      // into the register file. That crossing is the whole instruction cycle
      // in one mark: fetch on the left, write on the right.
      let travel = smoothstep(0.10, 0.80, phase);
      let departX = OPERAND_X + width * 2.0 + 0.020;
      let carrier = sdBox(
        p - vec2f(mix(departX, REGISTER_X - 0.030, travel), y),
        vec2f(0.008, 0.008),
      );
      color = mix(color, AMBER, cover(carrier, px));
    }
  }

  // The rule between the panes, and the register file beyond it. Six cells per
  // register, one register per listing row, R0 ticked because the accumulator
  // is where every operand ends up.
  let rule = sdBox(p - vec2f(RULE_X, 0.0), vec2f(hairline(0.0007, px), ROW_TOP + 0.048));
  color = mix(color, BONE * 0.20, cover(rule, px));

  for (var r = 0; r < ROWS; r = r + 1) {
    let y = rowY(r);
    let writes = clock / (2.0 + f32(r) * 0.6);
    let settle = smoothstep(0.0, 0.35, fract(writes));
    let pattern = i32(registerBits(r, writes) * 64.0);
    let previous = i32(registerBits(r, writes - 1.0) * 64.0);

    for (var c = 0; c < REGISTER_CELLS; c = c + 1) {
      let x = REGISTER_X + f32(c) * REGISTER_CELL_PITCH;
      // An unlit cell still has to be a cell: drop it to the ground and the
      // block stops reading as a register file and starts reading as confetti.
      let lit = select(0.17, 0.72, ((pattern >> u32(c)) & 1) == 1);
      let was = select(0.17, 0.72, ((previous >> u32(c)) & 1) == 1);
      let cell = sdBox(p - vec2f(x, y), vec2f(0.021, 0.0155));
      color = mix(color, BONE * mix(was, lit, settle), cover(cell, px));
    }

    if (r == 0) {
      let tick = sdBox(p - vec2f(REGISTER_X - 0.040, y), vec2f(0.009, hairline(0.0020, px)));
      color = mix(color, AMBER, cover(tick, px));
    }
  }

  // Substrate: grain first, then an ordered dither, so the long tonal sweep
  // across the ground resolves without banding at 8 bits.
  color += grain(uv * 2048.0, 0.010);
  color += bayer4(vec2u(uv / max(px, 1e-6))) * (1.5 / 255.0);

  return vec4f(clamp(color, vec3f(0.0), vec3f(1.0)), 1.0);
}
