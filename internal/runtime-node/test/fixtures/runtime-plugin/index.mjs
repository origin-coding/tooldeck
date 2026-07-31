export const calls = [];

export default {
  activate(ctx) {
    calls.push(`activate:${ctx.pluginId}`);

    ctx.subscriptions.push({
      dispose() {
        calls.push(`dispose:${ctx.pluginId}`);
      },
    });

    ctx.subscriptions.push(
      ctx.commands.register("factory.echo", (input) => ({
        status: "success",
        blocks: [
          {
            type: "text",
            text: String(input.text),
          },
        ],
      })),
    );
  },

  deactivate(ctx) {
    calls.push(`deactivate:${ctx.pluginId}`);
  },
};
