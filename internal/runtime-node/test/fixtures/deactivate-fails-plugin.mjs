export const calls = [];

export default {
  activate(ctx) {
    calls.push(`activate:${ctx.pluginId}`);

    ctx.subscriptions.push({
      dispose() {
        calls.push(`dispose:${ctx.pluginId}`);
      },
    });
  },

  deactivate(ctx) {
    calls.push(`deactivate:${ctx.pluginId}`);
    throw new Error("Deactivate failed");
  },
};
