<p align="center"><img src="assets/clue-logo.svg" width="72" alt="The Clue mark: a black arrow pointing left on a yellow sticky"></p>

<h1 align="center">Clue</h1>

<p align="center"><b>Your agent has no clue what you're pointing at. Give it one.</b></p>

<p align="center">Clues for AI agents: point at anything on a web page, or at a moment in an animation, and paste a short numbered reference into your prompt.</p>

<p align="center">
  <img src="assets/clue-demo.gif" width="720" alt="Picking two plan cards on a pricing page with Clue, pasting both numbered references into one sentence for an agent, and the agent restyling the first card">
</p>

I work on interfaces with coding agents every day. The slow part is explaining which thing I mean. "The button in the second card, no, the other one." So I built this layer for a project at work, and then kept missing it everywhere else.

Press Option+Shift+C, point at a block, click. You get one short line in your clipboard:

```
[1] Pick on src/Pricing.vue · Component: Card (./Card.vue), placed at ./Pricing.vue:4 · Text: "Starter"
```

Paste it into your message and keep talking. Talk, paste, talk, paste. The picks are numbered, so you can write "make [1] look like [2]" and the agent knows both. For me this works better than selecting an object in a tool, because the reference sits right inside the sentence.

Each pick is a clue for the agent: enough to find the thing and nothing to read past. The page, the name, the file and line, the text on it, the font.

## Add it to a project

Give your agent this link and say "add this to my project":

```
https://github.com/ryadovoys/clue
```

It follows [INSTALL.md](INSTALL.md), asks which highlight colour you want and puts the layer on top. It only runs in development and never reaches your users.

Or do it yourself. On a plain HTML page, add one line before `</body>`:

```html
<script src="https://cdn.jsdelivr.net/gh/ryadovoys/clue@2/clue.js"></script>
```

In a Vite project:

```bash
npm i -D github:ryadovoys/clue
```

```js
// vite.config.js, before the framework plugin
import clue from "clue/vite";

plugins: [clue(), vue()]
```

## How to use it

| Key | What it does |
| --- | --- |
| Option+Shift+C | Turn it on or off |
| W | Go up a layer, to the parent |
| S | Go down a layer, to the child |
| F | Freeze every animation on the page, F again to play |
| Click | Copy the reference and close |
| R | Start numbering from [1] again |
| Esc | Close without copying, and play if frozen |

W and S work by key position, so they also work on a Russian keyboard. The number also starts over after 10 minutes of quiet.

## Animations: freeze

Press F while Clue is on and everything on the page stops on one frame: CSS and Web Animations,
videos, and loops on `requestAnimationFrame`, such as a scene that draws itself from
`window.draw(t)` or a physics engine. Frames from the same site inside the page stop with it, so
you never have to pick a window. Point and click as usual. While the page is frozen, every pick
also says which moment it is:

```
[1] Pick on /intro.html · Frozen at 1.57s of 11.80s · Element: p.price · Text: "$12 / month"
```

The page stays frozen after a copy, so the next pick lands on the same moment. F again, or Esc,
plays on from exactly where it stopped.

To look at a folder of animation scenes, serve it:

```bash
node serve.cjs path/to/scenes
```

It opens on http://127.0.0.1:5195, puts Clue on every page and reloads by itself when a file
changes. It waits while the page is frozen, so a reload never takes the frame away.

## Colours

Clue yellow by default, the colour of a sticky note, because it stands out on almost any page. There are also `pink`, `mint` and `sky`, or use any hex:

```html
<script data-color="mint" src="..."></script>
```

```js
clue({ color: "#ff6b00" })
```

## What it can see

| Where | What you get |
| --- | --- |
| Plain HTML on a local server | Element, file and line |
| Plain HTML opened as a file | Element and a CSS selector |
| Vue 3 with Vite | Component, its file, where it is placed, with lines |
| Vue 3 without the plugin | Component and its file, no lines |
| React with Vite | Component, where it is placed, with lines |
| Anything else in a browser | Element and a CSS selector |

I tested the first five on Vue 3.5, React 19 and Vite. It works in a browser, so a native iOS or macOS app is out of reach. Electron and Tauri apps are web pages inside, so it should work there too.

Try it yourself: open [demo/index.html](demo/index.html) through a local server.

## License

MIT
