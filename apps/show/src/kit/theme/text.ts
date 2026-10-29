import { Container, Text, type TextStyleOptions } from 'pixi.js';
import { TOY } from './toy';

export function textStyle(size: number, display = false): TextStyleOptions {
  return { fontFamily: display ? TOY.font.display : TOY.font.body,
    fontWeight: display ? 'normal' : '500', fontSize: size, fill: TOY.color.ink };
}

export function nameTag(name: string): Text {
  return new Text({ text: name, style: { ...textStyle(TOY.type.name, true),
    fill: TOY.color.white, stroke: { color: TOY.color.ink, width: 6, join: 'round' } } });
}

/** A keyed pool keeps card updates from allocating text objects every frame. */
export class ToyText {
  private views = new Map<string, Text>();
  constructor(private root: Container) {}

  hide(): void { for (const view of this.views.values()) view.visible = false; }

  set(key: string, content: string, x: number, y: number, size = TOY.type.body as number,
    display = false, color = TOY.color.ink as number, width = 328, center = false): Text {
    let view = this.views.get(key);
    if (!view) {
      view = new Text({ text: content, style: { ...textStyle(size, display),
        wordWrap: true, wordWrapWidth: width, breakWords: true } });
      this.views.set(key, view);
      this.root.addChild(view);
    }
    view.text = content;
    view.style.fontFamily = display ? TOY.font.display : TOY.font.body;
    view.style.fontWeight = display ? 'normal' : '500';
    view.style.fontSize = size;
    view.style.lineHeight = display ? size : size * 1.2;
    view.style.fill = color;
    view.style.wordWrapWidth = width;
    view.anchor.set(center ? .5 : 0, 0);
    view.style.align = center ? 'center' : 'left';
    view.position.set(x, y);
    view.visible = true;
    return view;
  }

  label(key: string, content: string, x: number, y: number, width = 328): Text {
    const view = this.set(key, content.toUpperCase(), x, y, TOY.type.label, true, TOY.color.muted, width);
    view.style.letterSpacing = 2;
    return view;
  }
}
