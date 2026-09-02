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
  /** Position in the file, so two rules sharing a selector string are still distinguishable. */
  at: number;
}

/** Comments carry braces, colons and semicolons of their own - strip them before parsing. */
function uncommented(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseRules(file: string, source: string): Rule[] {
  const rules: Rule[] = [];
  const pattern = /([^{}@\/][^{}]*?)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    rules.push({ file, selector: match[1]!.trim(), body: match[2]!, at: match.index });
  }
  return rules;
}

const rulesOf = (file: string): Rule[] => parseRules(file, uncommented(file));

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

/**
 * The TARGET of a selector: its last class token, with attribute filters, pseudo-classes and
 * ancestors stripped.
 *
 * `.gf-moment-art`, `.gf-moment-with-player .gf-moment-art` and
 * `.gf-moment-art[src*="/trophies/"]` all style the same element, and the cascade merges them.
 * Grouping by target is what makes this audit see that - the per-rule version could not, which is
 * how `.gf-moment-art` kept `animation: gf-rise` in one rule and `transform: scale(1.04)` in
 * another 700 lines away without either test noticing.
 *
 * An over-approximation on purpose: it can group two rules the cascade would not actually
 * combine. That direction is safe - it reports something to look at - whereas the per-rule
 * version's blind spot silently passed a real jump.
 */
function targetOf(selector: string): string | null {
  const last = selector.split(',')[0]!.trim().split(/\s+|>|\+|~/).filter(Boolean).pop();
  if (!last) return null;
  const match = last.replace(/\[[^\]]*\]/g, '').replace(/::?[a-z-]+(\([^)]*\))?/g, '').match(/[.]([\w-]+)$/);
  return match ? match[1]! : null;
}

function cascadeOffenders(rules: Rule[], geometry: Set<string>): string[] {
  const offenders: string[] = [];
  for (const [target, entry] of mergeByTarget(rules)) {
    if (entry.crops.length === 0 || entry.animations.length === 0) continue;
    for (const animation of entry.animations) {
      for (const name of geometry) {
        if (new RegExp(String.raw`(^|[\s,])${name}([\s,]|$)`).test(animation.value)) {
          offenders.push(
            `.${target} crops ("${entry.crops[0]!.value}" in ${entry.crops[0]!.selector}) ` +
              `but animates ${name} in ${animation.selector}`,
          );
        }
      }
    }
  }
  return offenders;
}

interface Merged {
  crops: { selector: string; value: string; at: number }[];
  animations: { selector: string; value: string; at: number }[];
}

function mergeByTarget(rules: Rule[]): Map<string, Merged> {
  const merged = new Map<string, Merged>();
  for (const rule of rules) {
    const target = targetOf(rule.selector);
    if (!target) continue;
    const entry = merged.get(target) ?? { crops: [], animations: [] };
    const transform = declaration(rule.body, 'transform');
    if (transform && isCrop(transform)) entry.crops.push({ selector: rule.selector, value: transform, at: rule.at });
    const animation = declaration(rule.body, 'animation');
    if (animation) entry.animations.push({ selector: rule.selector, value: animation, at: rule.at });
    merged.set(target, entry);
  }
  return merged;
}

describe('a static crop is never animated away', () => {
  const GEOMETRY = geometryAnimations();
  const MERGED = mergeByTarget(ALL_RULES);

  it('gf-rise is still recognised as a geometry animation', () => {
    // Guards the test itself: if gf-rise stopped animating transform, the rules below go vacuous.
    expect([...GEOMETRY]).toContain('gf-rise');
  });

  it('catches a crop and an animation split across separate rules', () => {
    /*
     * The merge itself, proved against a synthetic stylesheet rather than against whatever the
     * real CSS happens to contain today.
     *
     * This is the shape the per-rule audit was blind to and that v0.9.6.2 found in the shipped
     * stylesheet: `.gf-moment-art` declared `animation: gf-rise` in one rule and
     * `transform: scale(1.04)` in another ~700 lines later. Neither rule was an offender on its
     * own; the element was.
     */
    const split = parseRules(
      'synthetic',
      `.a { animation: gf-rise 1s ease-out; }
       .unrelated { color: red; }
       .a { transform: scale(1.4); }`,
    );
    expect(cascadeOffenders(split, new Set(['gf-rise']))).toHaveLength(1);

    /* An ancestor-qualified selector styles the same element and must merge too. */
    const nested = parseRules(
      'synthetic',
      `.b { animation: gf-rise 1s; }
       .wrap .b { transform: scale(1.2); }`,
    );
    expect(cascadeOffenders(nested, new Set(['gf-rise']))).toHaveLength(1);

    /* And the audit must not cry wolf: opacity-only entrances beside a crop are the fix, not a bug. */
    const clean = parseRules(
      'synthetic',
      `.c { animation: gf-player-fade 1s; }
       .c { transform: scale(1.4); }`,
    );
    expect(cascadeOffenders(clean, new Set(['gf-rise']))).toEqual([]);
  });

  it('no element that crops with a transform runs a geometry animation', () => {
    expect(cascadeOffenders(ALL_RULES, GEOMETRY)).toEqual([]);
  });

  it('still sees a large, real stylesheet', () => {
    /*
     * General non-vacuity, deliberately NOT anchored on a specific offender: the previous version
     * of this check asserted that `.gf-moment-art` had both a crop and an animation, which stopped
     * being true the moment the bug was fixed. A guard that only holds while the bug exists is not
     * a guard.
     */
    expect(ALL_RULES.length).toBeGreaterThan(200);
    expect([...MERGED.keys()].length).toBeGreaterThan(100);
    const cropping = [...MERGED.values()].filter((entry) => entry.crops.length > 0);
    expect(cropping.length, 'no cropping element found - the sweep is not seeing the CSS').toBeGreaterThan(2);
  });

  it('the player surfaces named in the bug report all still crop, and all fade instead', () => {
    // Non-vacuity with names: these are the ones the playtest jump was actually seen on.
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
