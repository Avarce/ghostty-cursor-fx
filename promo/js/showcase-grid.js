// The showcase cut's music grid, shared by the storyboard (showcase.js) and the music
// generator (music/compose.py reads the JSON between the braces, so keep it plain JSON).
// The track is written for the video: video time 0 = audio time 0, bar 0 starts at 0.
export const GRID = {
  "bpm": 120,
  "beatsPerBar": 4,
  "drop1": 8.0,
  "break": 24.0,
  "drop2": 28.0,
  "outro": 48.0,
  "end": 56.0
};
export const BEAT = 60 / GRID.bpm, BAR = BEAT * GRID.beatsPerBar, E8 = BEAT / 2, S16 = BEAT / 4;
export const bar = (n, beats = 0) => n * BAR + beats * BEAT;
