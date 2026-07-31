export const calls = [];

export default {
  activate(ctx) {
    ctx.subscriptions.push(
      {
        dispose() {
          calls.push("dispose:first");
        },
      },
      {
        dispose() {
          calls.push("dispose:failing");
          throw new Error("subscription cleanup failed");
        },
      },
      {
        dispose() {
          calls.push("dispose:last");
        },
      },
    );
  },
};
