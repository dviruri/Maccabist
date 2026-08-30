# Maccabist v0.9 Complete Art Pack

Extract this ZIP at the **repository root**. It creates `public/assets/gamefeel/` for runtime assets and `docs/design/v09/` for Claude visual references.

Use direct Vite public paths such as `/assets/gamefeel/players/adult/outfield-hero.webp`.

## Rules
- Dynamic text/numbers always come from code.
- Children/academy -> `players/youth/`.
- נערים/נוער -> `players/teen/`.
- Senior -> `players/adult/`.
- GK uses goalkeeper art; field players use outfield art.
- `people/` is intended for 48-120px feed/avatar use.
- `transfer/` is supporting card art; full transfer screens should layer a high-res player cutout over a coded UI.
- The four `ui-concepts` images are the visual source of truth. Rebuild the presentation layer; do not merely decorate the dashboard.


## Palette note
Primary character palette for the player renders is black with pink / purple / blue accents. Avoid red and yellow kits, and avoid any baked-in shirt numbers or other dynamic text inside character art.
