# Clue

If the user gave you this repo to add Clue to their project, follow [INSTALL.md](INSTALL.md).

If you are working on the tool itself:

- `clue.js` is the tool. One file, plain JS, no dependencies, no build step. Keep it that way.
- `vite.js` is the dev-only Vite plugin. It injects the tool and stamps Vue template lines.
- `anima.js` is Clue Anima: notes on animations, pinned to a moment and an element, in pink. Also
  one plain file. It must stay inert with `?still` in the URL (renderers screenshot the same pages).
- `serve.cjs` is the preview server for animation scenes: one folder on 127.0.0.1, both tools
  injected, live reload. Host check, real-path containment, no dotfiles; keep those.
- All styles live in the shadow root, built from the tokens at the top of `STYLES`: primitives first, then semantic tokens. Colours and type come from the retired Clue Figma plugin (sticky yellow `#fbff00`, ink `#0f1011`, Inter at 510). Corners stay square, like a sticky note.
- `assets/clue-logo.svg` is the mark. The same shape is inlined as `LOGO` in `clue.js`.
- Test by hand on `demo/index.html` through a local server, plus a Vue and a React Vite app. The plugin reads the tool on every page load, so a reload picks up changes.
- Avoid non-ASCII characters in strings. The page may not declare a charset.
- Public repo. Keep it free of anything from a work project: names, paths, tokens.
