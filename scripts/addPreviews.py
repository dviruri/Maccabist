"""
Insert `preview:` lines into event outcomes (v0.4.6, Phase 15).

Editing 300-odd outcomes by hand across ten files is how typos and mis-scoped edits happen: an
outcome id like `paid_off` is unique inside its choice and repeats across the catalogue, so a
naive find-and-replace would patch the wrong event. This scopes every edit to its event block
first, then to the outcome id inside it, and refuses to apply anything it cannot place exactly.

Usage: previews are declared in PREVIEWS below as event id -> { outcome id: preview }.
"""

import io
import glob
import re
import sys

PREVIEWS: dict[str, dict[str, str]] = {}


def load(previews: dict[str, dict[str, str]]) -> None:
    PREVIEWS.update(previews)


def apply_all() -> int:
    files = glob.glob('src/data/events/*.ts')
    applied = 0
    missing: list[str] = []

    for event_id, outcomes in PREVIEWS.items():
        placed = False
        for path in files:
            s = io.open(path, encoding='utf-8').read()
            # Find this event's block: from `id: 'event_id',` to the start of the next event.
            start = s.find(f"id: '{event_id}',")
            if start == -1:
                continue
            nxt = s.find("\n  {\n    id: '", start + 1)
            end = nxt if nxt != -1 else len(s)
            block = s[start:end]
            new_block = block
            for outcome_id, preview in outcomes.items():
                # Inside the block, find the outcome and the `text:` that follows it.
                m = re.search(
                    r"(id: '" + re.escape(outcome_id) + r"',[\s\S]{0,600}?)(\n(\s*)text:)",
                    new_block,
                )
                if not m:
                    missing.append(f'{event_id}/{outcome_id}')
                    continue
                if "preview:" in m.group(1):
                    continue
                indent = m.group(3)
                escaped = preview.replace("\\", "\\\\").replace("'", "\\'")
                new_block = (
                    new_block[: m.end(1)]
                    + f"\n{indent}preview: '{escaped}',"
                    + new_block[m.end(1):]
                )
                applied += 1
            if new_block != block:
                io.open(path, 'w', encoding='utf-8').write(s[:start] + new_block + s[end:])
            placed = True
            break
        if not placed:
            missing.append(f'{event_id} (event not found)')

    if missing:
        print('COULD NOT PLACE:', file=sys.stderr)
        for m in missing:
            print(f'  {m}', file=sys.stderr)
    print(f'inserted {applied} previews')
    return len(missing)
