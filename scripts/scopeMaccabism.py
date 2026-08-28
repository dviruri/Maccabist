"""
Label or strip every Maccabism mutation (v0.4.8, Phase 8).

Maccabism is what the player feels about ONE club, and it was moving because of a national-team
call-up, a cup final at another club, a dressing-room speech and a contract negotiation. 27 of the
events that changed it carried no Maccabi scope whatsoever.

Each event below is judged on its CONTENT rather than on where the player happens to be, because
"he is currently at Maccabi" is explicitly not sufficient - training hard at Maccabi is training
hard. What moves the number is a decision about the club: its identity, its supporters, its
people, leaving it, coming back, or facing it.

Events absent from KEEP have their `maccabism` effects removed entirely.
"""

import io
import glob
import re

# event id -> maccabiRelevance
KEEP = {
    # --- the club's identity: the shirt, the badge, the contract, the armband ---
    'kids_first_stadium': 'identity',      # the first time a boy stands in Sami Ofer
    'kids_travel': 'identity',             # keeping the journey up, or giving it up for a local club
    'youth_guaranteed_spot': 'identity',   # staying at Maccabi, or taking a guaranteed shirt elsewhere
    'u19_contract_talk': 'identity',       # signing for the club
    'u19_loan_talk': 'identity',           # fighting to stay rather than be loaned out
    'youth_captain_band': 'identity',      # the armband, in green
    'br_first_bench': 'identity',          # first time in a Maccabi senior squad
    'br_first_contract_pressure': 'identity',
    'sen_captaincy_offer': 'identity',     # captain of Maccabi
    'sen_lost_captaincy': 'identity',
    'sen_contract_renewal': 'identity',
    'sen_one_year_deal': 'identity',
    'sen_veteran_role': 'identity',
    'sen_farewell': 'identity',            # a farewell at this club
    'pr_club_symbol': 'identity',          # becoming what the club is
    'pr_title_race_leader': 'identity',
    'vt_captaincy_succession': 'identity',
    'vt_farewell_season': 'identity',
    'vt_final_contract': 'identity',
    'vt_coaching_offer': 'identity',       # staying with the club after playing
    'sen_derby_moment': 'identity',        # the Haifa derby
    'vt_final_derby': 'identity',
    'gk_derby_save': 'identity',
    'rare_derby_legend': 'identity',
    'sen_title_penalty': 'identity',       # the penalty that wins this club the league
    'es_europe_qualifier': 'identity',     # a European night with this club

    # --- the supporters ---
    'sen_fans_sing': 'fans',
    'sen_fan_meeting': 'fans',
    'es_fan_criticism': 'fans',
    'mac_return_to_sami_ofer_warm': 'fans',

    # --- the people ---
    'sen_mentor_youngster': 'people',
    'sen_young_talent': 'people',
    'mac_they_still_watch': 'people',

    # --- leaving ---
    'sen_big_money_offer': 'leaving',
    'pr_big_european_offer': 'leaving',
    'sen_first_europe_interest': 'leaving',
    'sen_veteran_money_abroad': 'leaving',
    'sen_agent_pressure': 'leaving',

    # --- coming back ---
    'sen_return_call': 'return',
    'sen_homesick': 'return',
    'arc_europe_settling': 'return',
    'arc_europe_struggling': 'return',
    'amb_the_club_is_falling_apart': 'return',
    'amb_they_need_your_position': 'return',
    'mac_the_door_is_closed': 'return',

    # --- facing them, or hearing about them ---
    'mac_scored_against_them': 'opponent',
    'mac_asked_about_them': 'opponent',
    'cb_released_return': 'opponent',
    'amb_they_went_down': 'people',
    'amb_they_won_it_without_you': 'people',
}

# Judged NOT about Maccabi. Their maccabism effects are removed.
#   sen_national_call         a national-team call-up
#   sen_cup_final             a cup final at whatever club he is at
#   sen_title_run_in          a title run-in at whatever club he is at
#   sen_media_storm           generic media
#   sen_retirement_thoughts   thinking about the end
#   sen_new_signing_rivalry   squad politics
#   sen_abroad_bench          being benched abroad
#   pr_dressing_room_leader   generic leadership
#   spon_last_minute          a late chance, at any club
#   youth_agent               an agent
#   u19_media                 generic media
#   arc_coach_consequence     being frozen out
#   gk_keeper_competition     a rival goalkeeper


def run() -> None:
    labelled = 0
    stripped = 0
    events_seen = set()

    for path in glob.glob('src/data/events/*.ts'):
        s = io.open(path, encoding='utf-8').read()
        out = s
        for m in re.finditer(r"\n    id: '([a-z0-9_]+)',", s):
            eid = m.group(1)
            nxt = s.find("\n  {\n    id: '", m.end())
            block = s[m.start(): nxt if nxt != -1 else len(s)]
            if 'maccabism' not in block:
                continue
            events_seen.add(eid)

            bstart = out.find(f"\n    id: '{eid}',")
            if bstart == -1:
                continue
            bnext = out.find("\n  {\n    id: '", bstart + 5)
            bend = bnext if bnext != -1 else len(out)
            bl = out[bstart:bend]

            if eid in KEEP:
                rel = KEEP[eid]
                # Label each outcome that carries a maccabism effect.
                def label(mm: re.Match) -> str:
                    nonlocal labelled
                    labelled += 1
                    indent = mm.group(1)
                    return f"{indent}maccabiRelevance: '{rel}',\n{indent}effects: {{{mm.group(2)}"
                new_bl = re.sub(
                    r"\n(\s+)effects: \{((?:(?!\n\s+effects: \{)[\s\S])*?maccabism)",
                    lambda mm: '\n' + label(mm),
                    bl,
                )
            else:
                # Remove the maccabism line entirely.
                new_bl, n = re.subn(r"\n\s*maccabism: -?\d+(?:\.\d+)?,", '', bl)
                stripped += n

            out = out[:bstart] + new_bl + out[bend:]

        if out != s:
            io.open(path, 'w', encoding='utf-8').write(out)

    print(f'events with maccabism: {len(events_seen)}')
    print(f'outcomes labelled:     {labelled}')
    print(f'outcomes stripped:     {stripped}')


if __name__ == '__main__':
    run()
