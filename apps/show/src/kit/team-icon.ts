import type { Graphics } from 'pixi.js';
export function teamIcon(g:Graphics,team:string,x:number,y:number,r=5):void{
  const color=0x05070f;
  if(team==='red')g.poly([x-r,y+r,x,y-r,x+r,y+r]).fill(color);
  else if(team==='mint')g.rect(x-r,y-r,r*2,r*2).fill(color);
  else if(team==='gold')g.star(x,y,5,r*1.4,r*.6).fill(color);
  else if(team==='violet')g.poly([x,y-r,x+r,y,x,y+r,x-r,y]).fill(color);
  else if(team==='orange')g.regularPoly(x,y,r*1.2,6).fill(color);
  else g.circle(x,y,r).fill(color);
}
