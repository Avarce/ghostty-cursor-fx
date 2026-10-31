// Music timing, measured from the song (see promo/README.md, "Music"): 117.07 BPM,
// the drop's bass starts at song 47.24 s. Video frame 0 = song SONG_START, six
// bars before the drop; everything else is placed on this grid in video seconds.
export const FPS = 60;
export const SONG_START = 34.955;
export const BAR = 2.0501, BEAT = BAR / 4, E8 = BEAT / 2, S16 = BEAT / 4;
export const DROP = 12.30;                       // bar 0: the drop (song 47.255)
export const bar = (n, beats = 0) => DROP + n * BAR + beats * BEAT;
export const BASS_BACK = 62.01;                  // after the first break (song 96.97)
export const END = bar(31, 3);                   // fade to black before the second drop
export const SETTLE = 0.04, JUMP_SETTLE = 0.12;  // shaders wait this long after a change
// Enter/done events fire this long before their beat: the screen changes about a frame early and
// the effect (SETTLE later) lights up about a frame after. The drop keeps SETTLE: its surge lands on the drop frame.
export const HIT = 0.025;
