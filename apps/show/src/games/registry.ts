import bladeBrawl from './blade-brawl';
import pongWars from './pong-wars';
import ringEscape from './ring-escape';
import marbleRace from './marble-race';
import multiplierCascade from './multiplier-cascade';
import lightCycles from './light-cycles';
import pegFever from './peg-fever';
import hotPotato from './hot-potato';
export const games = [bladeBrawl, pongWars, ringEscape, marbleRace, multiplierCascade,
  lightCycles, pegFever, hotPotato];
export const rotationGames = [hotPotato, bladeBrawl, multiplierCascade, pegFever, marbleRace];
export const showGames = [...rotationGames, ...games.filter(game => !rotationGames.includes(game))];
export const registry = new Map(games.map(game => [game.id, game]));
