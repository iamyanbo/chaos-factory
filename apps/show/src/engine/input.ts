import type { ControlSpec, StreamerInput } from '@chaos/shared';
const KEY:Record<string,string>={Space:' ',Shift:'Shift',ArrowLeft:'A',ArrowRight:'D',ArrowUp:'W',ArrowDown:'S'};
export class Input {
  private seq=0;private held=new Set<string>();private gamepadHeld=new Set<string>();controls:ControlSpec[]=[];
  private key=(e:KeyboardEvent)=>{const editing=(e.target as HTMLElement)?.matches('input,textarea,select');if(editing&&e.type==='keydown')return;const key=KEY[e.key]??e.key.toUpperCase();const control=this.controls.find(c=>(KEY[c.key]??c.key.toUpperCase())===key);if(!control||editing&&!this.held.has(control.action))return;e.preventDefault();if(e.repeat)return;const pressed=e.type==='keydown';if(pressed)this.held.add(control.action);else this.held.delete(control.action);this.emit({action:control.action,pressed,seq:++this.seq});};
  release=()=>{for(const action of new Set([...this.held,...this.gamepadHeld]))this.emit({action,pressed:false,seq:++this.seq});this.held.clear();this.gamepadHeld.clear();};
  constructor(private emit:(i:StreamerInput)=>void){addEventListener('keydown',this.key);addEventListener('keyup',this.key);addEventListener('blur',this.release);}
  poll():void{const pad=navigator.getGamepads?.()[0];const active=new Set<string>();if(pad){if(pad.axes[0]<-.25||pad.buttons[14]?.pressed)active.add('left');if(pad.axes[0]>.25||pad.buttons[15]?.pressed)active.add('right');if(pad.axes[1]<-.25||pad.buttons[12]?.pressed)active.add('up');if(pad.axes[1]>.25||pad.buttons[13]?.pressed)active.add('down');const extras=this.controls.filter(c=>!['left','right','up','down'].includes(c.action));for(let i=0;i<4;i++)if(pad.buttons[i]?.pressed&&extras[i])active.add(extras[i].action);}
    for(const a of this.gamepadHeld)if(!active.has(a))this.emit({action:a,pressed:false,seq:++this.seq});for(const a of active)if(!this.gamepadHeld.has(a))this.emit({action:a,pressed:true,seq:++this.seq});this.gamepadHeld=active;
  }
  destroy():void{this.release();removeEventListener('keydown',this.key);removeEventListener('keyup',this.key);removeEventListener('blur',this.release);}
}
