// The effects in the promo (twelve of the thirteen; hologram isn't in it): shader file, preset cursor color, and the README table's wording.
export const EFFECTS = {
  lightning: { file: 'lightning-cursor.glsl', color: '#9fd0fe', name: 'Lightning', enter: 0.6,
    line: 'Sparks as you type · a surge of current along the input box on Enter' },
  cyber: { file: 'cyber-cursor.glsl', color: '#50e080', name: 'Cyber', enter: 1.5,
    line: 'Each typed letter decrypts through glyphs · data rain pours through the input box' },
  glitch: { file: 'glitch-cursor.glsl', color: '#f85452', name: 'Glitch', enter: 0.45,
    line: 'Tears into slices as you type · the lines break into glitch slices' },
  neon: { file: 'neon-cursor.glsl', color: '#ff5ed2', name: 'Neon', enter: 0.9,
    line: 'A glowing tube that breathes · the lines light up as neon tubes' },
  phosphor: { file: 'phosphor-cursor.glsl', color: '#6be894', name: 'Phosphor', enter: 0.8,
    line: 'CRT glow and scanlines · a beam sweeps the lines, leaving them glowing' },
  embers: { file: 'ember-cursor.glsl', color: '#ff8a3c', name: 'Embers', enter: 1.45,
    line: 'A burning coal · the lines flare and shed embers' },
  shockwave: { file: 'shockwave-cursor.glsl', color: '#b69cfe', name: 'Shockwave', enter: 0.9,
    line: 'A small ring as you type · a pulse runs along the lines, bending text' },
  katana: { file: 'katana-cursor.glsl', color: '#b8c4d4', name: 'Katana', enter: 0.5,
    line: 'A slash through the cursor · the blade cuts the lines in two' },
  teleport: { file: 'teleport-cursor.glsl', color: '#3fd8c8', name: 'Teleport', enter: 1.2,
    line: 'A shimmer as you type · the lines sparkle and beam up out of the window' },
  fireworks: { file: 'firework-cursor.glsl', color: '#ffc856', name: 'Fireworks', enter: 1.7,
    line: 'Sparkles as you type · a fuse burns along the lines and launches fireworks' },
  mecha: { file: 'mecha-cursor.glsl', color: '#bcc8dc', name: 'Mecha', enter: 1.0,
    line: 'A thruster burst as you type · energy blades ignite along the input box' },
  aurora: { file: 'aurora-cursor.glsl', color: '#7fe0c0', name: 'Aurora', enter: 1.3,
    line: 'A wisp of light · shimmering curtains of northern light along the lines' },
  hologram: { file: 'hologram-cursor.glsl', color: '#4cc8f0', name: 'Hologram', enter: 1.2,
    line: 'Each letter printed by a scanline · a scan and a wireframe grid along the input box' },
};
export const ORDER = ['lightning', 'cyber', 'glitch', 'neon', 'phosphor', 'embers', 'shockwave', 'katana', 'teleport', 'fireworks', 'mecha', 'aurora'];
// All thirteen, in `cursor-fx`'s order (the showcase cut; ORDER above keeps the main cut's twelve-tile grid).
export const ALL = ['cyber', 'lightning', 'glitch', 'neon', 'phosphor', 'embers', 'shockwave', 'katana', 'teleport', 'fireworks', 'aurora', 'mecha', 'hologram'];
