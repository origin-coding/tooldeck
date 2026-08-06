export const calls = [];

let resolveActivationStarted;

export let activationStarted;

export function reset() {
  calls.length = 0;
  activationStarted = new Promise((resolve) => {
    resolveActivationStarted = resolve;
  });
}

reset();

export default {
  async activate(context) {
    calls.push(`activate:${context.pluginId}`);
    context.subscriptions.push({
      dispose() {
        calls.push(`dispose:${context.pluginId}`);
      },
    });
    resolveActivationStarted();
    await new Promise(() => {});
  },
};
