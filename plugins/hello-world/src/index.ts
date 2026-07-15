import { definePlugin, okText } from "@tooldeck/sdk-node";

export default definePlugin((plugin) => {
  plugin.command("hello.world", async () => okText("Hello, world!"));
});
