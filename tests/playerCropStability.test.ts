/**
 * The player must appear already in the correct crop (v0.9.6.1).
 *
 * The reported bug: on first paint the player rendered almost full-body, then jumped to his
 * intended framing. The cause was not the art or the resolver - it was CSS. Every player surface
 * crops with a static `transform` (a scale about a point below the head, so the frame's overflow
 * takes the legs), and every one of them also ran `animation: gf-rise`, whose keyframes animate
 * `transform`. An animated property REPLACES the static declaration for the animation's whole
 * duration, so the art drew at scale(1) - uncropped, and off-centre wherever the static transform
 * also carried a translateX - until the last frame snapped it back.
 *
 * These tests are written against the general rule rather than today's four class names, so a
 * future surface that crops with a transform cannot quietly reintroduce the jump.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const CSS_FILES = ['src/styles/gamefeel.css', 'src/styles/global.css'];

interface Rule {
  file: string;
  selector: string;
  body: string;
}

/** Comments carry braces, colons and semicolons of their own - strip them before parsing. */
function uncommented(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

function rulesOf(file: string): Rule[] {
  const source = uncommented(file);
  const rules: Rule[] = [];
  const pattern = /([^{}@\/][^{}]*?)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    rules.push({ file, selector: match[1]!.trim(), body: match[2]! });
  }
  return rules;
}

const ALL_RULES = CSS_FILES.flatMap(rulesOf);

/** Keyframe names whose steps touch geometry, so animating them overrides a static crop. */
function geometryAnimations(): Set<string> {
  const geometric = new Set<string>();
  for (const file of CSS_FILES) {
    const source = uncommented(file);
    const pattern = /@keyframes\s+([\w-]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const steps = match[2]!;
      if (/(^|[;{\s])(transform|scale|translate|rotate|width|height|top|left|inset|transform-origin)\s*:/.test(steps)) {
        geometric.add(match[1]!);
      }
    }
  }
  return geometric;
}

/** A crop is a transform that changes the drawn geometry - centring alone is not one. */
function isCrop(transform: string): boolean {
  const value = transform.trim();
  if (value === 'none' || value === '') return false;
  return /scale|rotate|matrix|perspective|skew/.test(value);
}

function declaration(body: string, property: string): string | null {
  const match = new RegExp(String.raw`(?:^|;)\s*${property}\s*:([^;]*)`, 'i').exec(body);
  return match ? match[1]!.trim() : null;
}

describe('a static crop is never animated away', () => {
  const GEOMETRY = geometryAnimations();

  it('gf-rise is still recognised as a geometry animation', () => {
    // Guards the test itself: if gf-rise stopped animating transform, the rule below goes vacuous.
    expect([...GEOMETRY]).toContain('gf-rise');
  });

  it('no rule that crops with a transform runs a geometry animation', () => {
    const offenders: string[] = [];
    let cropping = 0;
    for (const rule of ALL_RULES) {
      const transform = declaration(rule.body, 'transform');
      if (!transform || !isCrop(transform)) continue;
      cropping += 1;
      const animation = declaration(rule.body, 'animation');
      if (!animation) continue;
      for (const name of GEOMETRY) {
        if (new RegExp(String.raw`(^|[\s,])${name}([\s,]|$)`).test(animation)) {
          offenders.push(`${rule.file} ${rule.selector} crops with "${transform}" but animates ${name}`);
        }
      }
    }
    expect(cropping, 'no cropping rule found - the sweep is not seeing the CSS').toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('the player surfaces named in the bug report all still crop, and all fade instead', () => {
    // Non-vacuity with names: these are the four the playtest jump was actually seen on.
    for (const selector of ['.gf-hero-art', '.gf-md-art', '.gf-moment-player']) {
      const rule = ALL_RULES.find((candidate) => candidate.selector === selector);
      expect(rule, `${selector} is gone - re-point this test at its replacement`).toBeDefined();
      expect(isCrop(declaration(rule!.body, 'transform') ?? '')).toBe(true);
      expect(declaration(rule!.body, 'animation')).toContain('gf-player-fade');
    }
  });
});

describe('the player entrance itself', () => {
  const source = uncommented('src/styles/gamefeel.css');
  const keyframes = /@keyframes\s+gf-player-fade\s*\{((?:[^{}]|\{[^{}]*\})*)\}/.exec(source)?.[1] ?? '';

  it('exists', () => {
    expect(keyframes.trim()).not.toBe('');
  });

  it('animates opacity and nothing else', () => {
    expect(keyframes).toContain('opacity');
    for (const property of [
      'transform', 'scale', 'translate', 'rotate',
      'width', 'height', 'transform-origin', 'top', 'left', 'inset', 'margin', 'padding',
    ]) {
      expect(
        new RegExp(String.raw`(^|[;{\s])${property}\s*:`).test(keyframes),
        `gf-player-fade animates ${property}, which moves the crop`,
      ).toBe(false);
    }
  });

  it('has no explicit end state, so a surface fades to its own opacity', () => {
    /*
     * .gf-md-art sits at opacity 0.9. An explicit `to { opacity: 1 }` would overshoot and then
     * drop back to 0.9 when the animation ended - a different pop, in the same place.
     */
    expect(/\bto\s*\{|100%\s*\{/.test(keyframes)).toBe(false);
    expect(/from\s*\{[^}]*opacity\s*:\s*0\s*;?[^}]*\}/.test(keyframes)).toBe(true);
  });
});
