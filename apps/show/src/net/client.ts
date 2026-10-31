import { messageSchema, type Message } from '@chaos/shared';
export class Client {
  connected=false;lastError='';private socket?:WebSocket;private retry?:ReturnType<typeof setTimeout>;private closed=false;
  onMessage:(m:Message)=>void=()=>{};onConnection:(connected:boolean)=>void=()=>{};
  constructor(readonly role:'show'|'dashboard'|'controller'){this.connect();}
  private connect():void{
    const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);this.socket=ws;
    ws.onopen=()=>{this.connected=true;this.send({type:'hello',role:this.role});this.onConnection(true);};
    ws.onmessage=e=>{try{const m=messageSchema.safeParse(JSON.parse(String(e.data)));if(m.success)this.onMessage(m.data);}catch{/* Ignore invalid network data. */}};
    ws.onerror=()=>{};ws.onclose=e=>{this.connected=false;if(e.code===4001)this.lastError=e.reason;this.onConnection(false);if(e.code===4001)return;if(!this.closed)this.retry=setTimeout(()=>this.connect(),1200);};
  }
  send(m:Message):boolean{if(this.socket?.readyState!==WebSocket.OPEN){return false;}this.socket.send(JSON.stringify(m));return true;}
  destroy():void{this.closed=true;if(this.retry)clearTimeout(this.retry);this.socket?.close();}
}
