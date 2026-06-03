export const calls = [];

export default {
  async activate(ctx) {
    await ctx.storage.set("activated", ctx.pluginId);
    calls.push(`storage:${await ctx.storage.get("activated")}`);
  },
};
