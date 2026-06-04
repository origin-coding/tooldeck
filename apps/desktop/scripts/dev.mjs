import concurrently from "concurrently";

const { result } = concurrently(
  [
    {
      name: "renderer",
      command: "vite --configLoader runner --config vite.renderer.config.ts",
    },
    {
      name: "main",
      command: "vite build --watch --configLoader runner --config vite.main.config.ts",
    },
    {
      name: "preload",
      command: "vite build --watch --configLoader runner --config vite.preload.config.ts",
    },
    {
      name: "electron",
      command:
        "wait-on http://localhost:5173 .vite/build/main.js .vite/build/preload.cjs && cross-env TOOLDECK_RENDERER_URL=http://localhost:5173 electron .",
    },
  ],
  {
    killOthers: ["failure", "success"],
    successCondition: "first",
    prefixColors: ["cyan", "green", "yellow", "magenta"],
  },
);

await result;
