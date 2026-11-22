# Clue

If the user gave you this repo to add Clue to their project, follow [INSTALL.md](INSTALL.md).

If you are working on the tool itself:

- `clue.js` is the tool. One file, plain JS, no dependencies, no build step. Keep it that way.
- `vite.js` is the dev-only Vite plugin. It injects the tool and stamps Vue template lines.
- F freezes motion: `clue.js` pauses the page's animations and media and holds the
  `requestAnimationFrame` clock in this window and its same-origin frames; the top page runs it.
  Renderers screenshot the same scenes with `?still`, so the frozen clock must never leak into
  a page where Clue is not active.
- `serve.cjs` is the preview server for animation scenes: one folder on 127.0.0.1, Clue
  injected, live reload. Host check, real-path containment, no dotfiles; keep those.
- All styles live in the shadow root, built from the tokens at the top of `STYLES`: primitives first, then semantic tokens. Colours and type come from the retired Clue Figma plugin (sticky yellow `#fbff00`, ink `#0f1011`, Inter at 510). Corners stay square, like a sticky note.
- `assets/clue-logo.svg` is the mark. The same shape is inlined as `LOGO` in `clue.js`.
- Test by hand on `demo/index.html` through a local server, plus a Vue and a React Vite app. The plugin reads the tool on every page load, so a reload picks up changes.
- Avoid non-ASCII characters in strings. The page may not declare a charset.
- Public repo. Keep it free of anything from a work project: names, paths, tokens.
