import type { GameDefinition } from '../games/contract';
export const modifiers=[
  {id:'low-grav',name:'LOW GRAVITY',tag:'physics',help:'Gravity ×0.45'}, {id:'heavy',name:'HEAVY METAL',tag:'physics',help:'Marble mass ×2.5'},
  {id:'tiny',name:'TINY TERRORS',tag:'physics',help:'Marble size ×0.65'}, {id:'big-heads',name:'BIG HEADS',tag:'physics',help:'Marble size ×1.4'},
  {id:'bouncy',name:'BOUNCY CASTLE',tag:'physics',help:'Marbles bounce at 95%'}, {id:'ice',name:'ICE FLOOR',tag:'physics',help:'Almost no friction'},
  {id:'double',name:'DOUBLE TROUBLE',tag:'timing',help:'Hazards recover faster'}, {id:'fog',name:'LIGHTS OUT',tag:'visual',help:'A spotlight over the factory'},
  {id:'turbo',name:'TURBO',tag:'timing',help:'The simulation runs at 1.35×'}, {id:'mirror',name:'MIRROR WORLD',tag:'visual',help:'The arena flips horizontally'},
  {id:'wind',name:'STORM',tag:'physics',help:'A new gust every six seconds'}, {id:'magnet',name:'MAGNET CORE',tag:'physics',help:'A central force pulls marbles inward'}
] as const;
export function compatible(def:GameDefinition){return modifiers.filter(m=>def.supportsModifiers.includes(m.id)||def.supportsModifiers.includes(`*${m.tag}`));}
