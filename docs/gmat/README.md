# Checking the game's orbits with NASA's GMAT

`docs/VALIDATION.md` compares the game's orbit maths with an independent calculation. This folder lets you confirm the same cases with **GMAT**, NASA's General Mission Analysis Tool (https://github.com/nasa/GMAT), which is one of the resources listed for this challenge.

**Status: untested.** GMAT is not installed where this repo was prepared, so `orbit_check.script` has not been run. It is written in standard GMAT script form; if GMAT reports a syntax error, fix the line it names (field names differ slightly between GMAT releases) and keep the orbit values.

## Steps

1. Install GMAT from the project page above and open `orbit_check.script` (File > Open).
2. Run it (the Run button). It propagates three circular Earth orbits for one revolution each and reports the orbital period.
3. Compare the reported period with the table in `docs/VALIDATION.md`:
   - 705 km (Landsat 9 style): about 98.9 min
   - 410 km (International Space Station style): about 92.8 min
   - 600 km (the game's sun-synchronous orbit): about 96.7 min
4. Write the GMAT numbers into `docs/VALIDATION.md` under a new heading "GMAT run" with the GMAT version and the date. Only then say in the submission that the orbits were checked with GMAT.
