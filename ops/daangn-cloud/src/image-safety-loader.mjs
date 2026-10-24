export async function resolve(specifier, context, nextResolve) {
  if (specifier === './publisher.mjs') {
    return {
      url: new URL('./safe-publisher.mjs', context.parentURL).href,
      shortCircuit: true
    };
  }
  return nextResolve(specifier, context);
}
