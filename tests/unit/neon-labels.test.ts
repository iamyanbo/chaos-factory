import { expect, test } from 'vitest';
import { placeLabel } from '../../apps/show/src/kit/neon/labels';

test('an arena-edge label picks a clear side instead of clamping over its own ball', () => {
  const ball = {id:'viewer',name:'cosmic_fox',x:1480,y:300,prevX:1480,prevY:300,radius:12,color:0x25ffcc};
  const box = placeLabel(ball,1,90,18,540,[ball],[]);
  expect(box.x+box.width).toBeLessThan(ball.x-ball.radius);
  expect(box.x).toBeGreaterThanOrEqual(430);
});
