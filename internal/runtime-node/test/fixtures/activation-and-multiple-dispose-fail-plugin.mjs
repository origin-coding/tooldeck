export const calls = [];

export default {
  activate(context) {
    context.subscriptions.push({
      dispose() {
        calls.push("dispose:first");
        throw new Error("first disposal failed");
      },
    });
    context.subscriptions.push({
      dispose() {
        calls.push("dispose:second");
        throw new Error("second disposal failed");
      },
    });
    throw new Error("activation failed with multiple cleanup failures");
  },
};
