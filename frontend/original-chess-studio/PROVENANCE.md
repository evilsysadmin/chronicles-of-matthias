# Original Chronicles frontend — immutable migration snapshot

Source: `evilsysadmin/chess-studio@ab0531d7e2812eed8c24003e8ef3386e8853b5a9`

This is the complete relevant **Chronicles-specific source snapshot**:
Chronicles React components/CSS, all game modules, authored maps and tests,
portrait/UI/sprite assets, plus shared helper sources required by original
imports. Its contents are not imported by production until modules have
been isolated from legacy auth/saves/sound and verified. Do not silently
modify these originals, or mistake a source snapshot for a playable port.

Active compiled entry remains `frontend/src/App.jsx`. Replace modules
incrementally, preserving source provenance and tests.
