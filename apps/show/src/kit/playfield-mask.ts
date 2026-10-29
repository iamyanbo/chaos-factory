import { Graphics,type Container } from 'pixi.js';
import type { GameContext } from '../games/contract';

/** A screen-space window for scrolling worlds; UI stays outside the camera. */
export class PlayfieldMask {
  private graphic?:Graphics;private layers:Container[]=[];
  constructor(ctx:GameContext,top=275,bottom=900,left=30,right=1890){
    if(ctx.headless)return;
    this.graphic=new Graphics().rect(left,top,right-left,bottom-top).fill(0xffffff);
    ctx.stage.hud.addChild(this.graphic);this.layers=[ctx.stage.world,ctx.stage.fx,ctx.stage.labels,ctx.stage.hudWorld];
    for(const layer of this.layers)layer.mask=this.graphic;
  }
  destroy():void{for(const layer of this.layers)layer.mask=null;this.layers=[];this.graphic?.destroy({context:true});this.graphic=undefined;}
}
