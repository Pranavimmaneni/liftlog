"""Renders design/illustrations/pictos.py with token CSS variables instead of hex colours and writes
src/illustration/__ref__/pictos-ref.json. The TypeScript port must reproduce these strings exactly
(src/illustration/port.test.ts, FR-ILL-1)."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(here, '..', 'design', 'illustrations'))
import pictos

TOKENS = dict(INK='var(--ll-ink)', EQUIP='var(--ll-equip)', EQUIP_D='var(--ll-equipDark)', GHOST='var(--ll-ghost)',
              RED='var(--ll-accent)', FLOOR='var(--ll-floor)', PANEL_BG='var(--ll-panel)', FAR='var(--ll-farLimb)',
              IDLE='var(--ll-muscleIdle)', BODY='var(--ll-muscleBody)', PRIM='var(--ll-musclePrimary)',
              SEC='var(--ll-muscleSecondary)')
# pictos functions bind colour defaults at call time via globals, except default args; patch both.
pictos.__dict__.update(TOKENS)
out = {}
for key in pictos.EXERCISES:
    prim, sec = pictos.MUSCLES[key]
    out[key] = {
        'full': pictos.illustration(key),
        'thumb': pictos.illustration(key, ghost=False, arrow_on=False),
        'muscles': pictos.muscle_map(prim, sec),
    }
dst = os.path.join(here, '..', 'src', 'illustration', '__ref__', 'pictos-ref.json')
with open(dst, 'w', encoding='utf-8') as fh:
    json.dump(out, fh, indent=1, sort_keys=True)
print('wrote', dst)
