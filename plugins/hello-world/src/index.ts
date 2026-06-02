import { definePlugin } from "@tooldeck/sdk";

export default definePlugin({
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.commands.register("hello.world", async () => ({
        status: "success",
        blocks: [
          {
            type: "text",
            text: "Hello, world!",
          },
        ],
      })),
    );
  },
});
