import { definePlugin } from "@tooldeck/sdk";

export default definePlugin((plugin) => {
  plugin.command("hello.world", async () => ({
    status: "success",
    blocks: [
      {
        type: "text",
        text: "Hello, world!",
      },
    ],
  }));
});
