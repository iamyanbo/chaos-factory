export interface PracticeHelp {bossGoal:string;chatGoal:string;bossControls:string;chatControls:string}
export const MACHINE_ROLE:Record<string,string>={
  'color-conquest':'Type !join to become a painter. Movement is automatic.',
  'crusher-run':'YOU operate the three crushers and trapdoor. Blue marbles are chat bots.',
  'core-siege':'YOU operate the pink reactor’s shield and laser. Blue marbles are chat bots.',
  pinball:'YOU operate the flippers. Blue marbles are chat bots trying to drain.',
  trapdoor:'YOU select floor columns to drop. Blue marbles are chat bots.',
  'cannon-clash':'YOU operate the pink cannon and fort. The blue fort belongs to chat bots.',
  'tree-war':'YOU control the right-hand boss tree. The other tree belongs to chat bots.',
};
export const PRACTICE_HELP:Record<string,PracticeHelp>={
  'crusher-run':{bossGoal:'Stop the blue marbles reaching their finish quota.',chatGoal:'Get enough blue marbles through the factory to the green finish.',bossControls:'1 / 2 / 3: fire the numbered crushers. Q: push marbles. E: open the marked trapdoor. Actions have cooldowns.',chatControls:'SHIELD protects your marble from one crush. GO fills the shared surge meter. Your marble moves automatically.'},
  'collision-royale':{bossGoal:'Keep your pink crowned marble inside the safe circle until time runs out.',chatGoal:'Push the pink crowned boss out of the safe circle.',bossControls:'WASD / arrows: steer your crowned marble. Space: dash. Q: knock nearby enemies away.',chatControls:'CHARGE winds up your blue marble’s dash at the boss. ANCHOR makes your marble heavier for three seconds.'},
  'grand-prix':{bossGoal:'Get your pink crowned marble across the finish before every blue racer.',chatGoal:'Get a chat or team marble across the finish first.',bossControls:'A / D: nudge your crowned marble sideways. Choose a route at the two marked forks.',chatControls:'LEFT / RIGHT vote for your team’s branch before each fork. BOOST fills your team’s boost meter. Marbles race automatically.'},
  'color-conquest':{bossGoal:'Host an automatic battle for the most painted floor.',chatGoal:'Watch your named painter claim territory for its team.',bossControls:'Start, pause or restart the round. Painters move automatically.',chatControls:'Type !join once, or click the offline !join button. Your team is assigned automatically.'},
  gauntlet:{bossGoal:'Reach the green finish with a heart remaining.',chatGoal:'Stop the boss reaching the finish.',bossControls:'A / D: roll. Space: jump. Shift: dash through danger.',chatControls:'SLAM triggers your named crusher after its red warning.'},
  'core-siege':{bossGoal:'Keep the reactor alive until time runs out.',chatGoal:'Destroy the reactor with marble waves.',bossControls:'A / D or mouse: turn the shield. Space: laser sweep. Q: widen the shield.',chatControls:'LEFT / RIGHT vote on wave lanes. FIRE fills the early-launch meter.'},
  pinball:{bossGoal:'Keep enough marbles out of the bottom drain.',chatGoal:'Drain enough marbles to steal the loot.',bossControls:'A / D or arrows: flippers. Space: kickback save.',chatControls:'TILT builds a shared table shake.'},
  'meteor-dodge':{bossGoal:'Survive the falling meteors.',chatGoal:'Hit the boss or remove the ground beneath them.',bossControls:'A / D: move. Space: jump. Shift: dash.',chatControls:'1–12 vote for the next meteor column. Red marks warn before impact.'},
  'lava-rise':{bossGoal:'Stay above the rising lava until the 60-second timer ends.',chatGoal:'Outlast the other teams, or stop the boss climbing.',bossControls:'A / D: move. Space: jump upward through platforms.',chatControls:'1–9 vote for the platform to collapse.'},
  'hot-potato':{bossGoal:'',chatGoal:'Keep your team alive as the bomb is passed around.',bossControls:'',chatControls:'PASS charges your team’s attempt to pass the bomb to an opponent.'},
  derby:{bossGoal:'',chatGoal:'Help your team’s racer cross the checkered finish first.',bossControls:'',chatControls:'CHEER fills your racer’s boost meter.'},
  trapdoor:{bossGoal:'Leave fewer than the chat survival quota on the floor at the timer.',chatGoal:'Keep enough of your side alive on the remaining floor.',bossControls:'Click a column or use A / D to select it, then S to drop it after its warning.',chatControls:'A–L: in Chat vs Boss vote where blue marbles should gather; in Faction War vote which column drops.'},
  multiply:{bossGoal:'',chatGoal:'Grow your team’s swarm and break its wall first.',bossControls:'',chatControls:'LEFT / RIGHT vote for the next pair of multiplier gates.'},
  'cannon-clash':{bossGoal:'Destroy the chat fort before your own fort falls.',chatGoal:'Destroy the other fort or team’s crystal.',bossControls:'Mouse or A / D: aim. Hold Space to charge the next volley. Cannons fire automatically every six seconds.',chatControls:'AIM submits the angle entered below. The team uses the median angle.'},
  'tree-war':{bossGoal:'Destroy the rival tree with your fruit artillery.',chatGoal:'Keep your tree standing and destroy rival trees.',bossControls:'1 / 2 / 3: choose an upgrade card. Space: spend a giant seed.',chatControls:'1 / 2 / 3 vote for the upgrade card shown above your tree.'},
  'bike-down':{bossGoal:'Ride the pink bike to the finish.',chatGoal:'Keep the rider from finishing by choosing course obstacles.',bossControls:'W: pedal. S: brake. A / D: lean.',chatControls:'1 / 2 / 3 choose course hazards.'}
};
