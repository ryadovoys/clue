# Installing Clue

Instructions for a coding agent. The user gave you this repo and wants the Clue layer on top of their project.

## 1. Ask for a colour

Ask once, before you change anything, and offer these options:

- `lemon`: Clue sticky yellow, the default
- `pink`
- `mint`
- `sky`
- any hex value

If the project has a strong accent colour, suggest a preset that stands apart from it, so the highlight is easy to see. If the user does not care, use `lemon`.

## 2. Add it, for development only

The tool must never reach production. Pick the first case that fits.

**Vite project.** Install it and add the plugin before the framework plugin. The plugin only runs on the dev server, and it adds template lines for Vue.

```bash
npm i -D github:ryadovoys/clue
```

```js
import clue from "clue/vite";

export default defineConfig({
  plugins: [clue({ color: "lemon" }), vue()],
});
```

**Plain HTML page or prototype.** Add one line before `</body>`. Skip `data-color` for lemon.

```html
<script data-color="mint" src="https://cdn.jsdelivr.net/gh/ryadovoys/clue@2/clue.js"></script>
```

If the page will be published, tell the user to remove this line first.

**A page that cannot load external scripts** (a sandboxed preview, a strict CSP, an artifact). Paste the content of `clue.js` into an inline `<script>` tag.

**Any other framework** (Next.js, Nuxt, Astro and so on). Copy `clue.js` into the folder for static files, then load it only in development. For example in Next.js, in the root layout:

```jsx
{process.env.NODE_ENV === "development" && <script src="/clue.js" />}
```

**Animation scenes or a motion prototype.** If the user works on animation, add Clue Anima as well.
In Vite: `clue({ color: "lemon", anima: true })`. For a folder of HTML scenes, run the preview
server from a clone of this repo and give the user the link; do not open the browser for them:

```bash
node serve.cjs <folder of scenes>    # http://127.0.0.1:5195, live reload, both Clues on every page
```

On a plain page, add `anima.js` the same way as `clue.js`, in the `<head>`.

## 3. Check it

Run the project, press Option+Shift+C, and tell the user it is ready. If they use a browser pane without keyboard focus, they need to click the page first.

Do not change the project's own styles. The tool lives in a shadow root and needs nothing else.

## Reading a pick

A pick pasted into chat looks like this:

```
[1] Pick on src/Pricing.vue · Component: Card (./Card.vue), placed at ./Pricing.vue:4 · Text: "Starter"
```

- `[1]` is the number. The user refers to it in their message.
- `Pick on` is the page.
- `(./Card.vue)` is the component's own file. `placed at` is where it is used and given its props. Change the first to change every card, the second to change this one.
- Paths starting with `./` are relative to the page's folder.
- `Element:` means a plain element, not a component. `Selector:` appears when no line is known.
- `Media:` is the file an image or video shows, as its path on the site.
- `Data:` is the list key and data props (id, slug, name...) the element was rendered from. With `Media:` it tells apart items that share one source line, such as a list built from JSON.
- `Text:` tells apart instances of the same component.
- `Style:` is size/line height, weight and font of the text.

## Reading Anima notes

Clue Anima notes arrive as one block:

```
Animation comments (Clue Anima). Times are seconds into the loop; points are stage pixels.

scenes/intro.html (loop 7.40s)
[1] at 0.91s · on article#studio > p.price · text "$12 / month" · point 1116, 327
    Make price black color
```

- The first line of each group is the page and the length of its loop.
- `at` is seconds into the loop. Map it to the scene's own timeline to find the phase.
- `on` is the element the note is about, nearest id first. `point` is where the user clicked, in the
  scene's own pixels.
- Numbers run across all pages in one paste. Fix each one, then answer per number in one line.
