export default {
  activate(ctx) {
    ctx.subscriptions.push({
      dispose() {
        throw new Error("activation cleanup failed");
      },
    });

    throw new Error("activation failed at source");
  },
};
