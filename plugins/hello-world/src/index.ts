import { definePlugin } from "@tooldeck/sdk-node";

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
