# Focused orbit-period check with NASA's GMAT

`docs/VALIDATION.md` compares the game's orbit maths with an independent calculation. This folder checks three Earth orbit periods with **GMAT**, NASA's General Mission Analysis Tool (https://software.nasa.gov/software/GSC-19468-1), which is one of the resources listed for this challenge. The check uses a two-body Earth point-mass setup and GMAT's osculating `OrbitPeriod` parameter; it is not a full mission design or validation of the game's flight simulator.

**Run status and measured values:** see the dated “GMAT cross-check” section in `docs/VALIDATION.md`.

## Steps

1. Install GMAT from the project page above.
2. From GMAT's `bin` directory, run `./GmatConsole -r /path/to/orbit_check.script -x`.
3. Read `every_kilogram_periods.txt` in GMAT's working directory. The report contains the GMAT-computed orbital period for each defined Keplerian state.
4. Compare the reported period with the table in `docs/VALIDATION.md`:
   - 705 km (Landsat 9 style): about 98.9 min
   - 410 km (International Space Station style): about 92.8 min
   - 600 km (the game's sun-synchronous orbit): about 96.7 min
5. Keep the GMAT version, date, assumptions, and values together in `docs/VALIDATION.md`. Do not describe this focused cross-check as a GMAT validation of the full game.
