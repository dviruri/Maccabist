# Recommended repository placement

Copy these folders into the repo root:
- public/assets/maccabist
- src/data/assetManifest.json
- src/lib/assetSelector.ts

## Suggested selection logic
1. Determine age group from career stage:
   - child: children leagues / טרום / ילדים
   - youth: נערים / נוער
   - adult: בוגרים / senior / professional / Europe first team
2. Determine role:
   - goalkeeper -> goalkeeper
   - otherwise -> outfield
3. Determine pose from screen type:
   - hero screens / splash / preview -> hero (outfield) or ready (goalkeeper)
   - match result / achievement / breakthrough -> celebration
4. Determine color by club family.
