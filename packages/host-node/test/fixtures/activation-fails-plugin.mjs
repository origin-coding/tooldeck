export const calls = [];

export default {
  activate(ctx) {
    ctx.subscriptions.push({
      dispose() {
        calls.push(`dispose:${ctx.pluginId}`);
      },
    });

    throw new Error("Activation failed");
  },
};
