export function mergeDeep(target = {}, ...sources) {
  const isObject = (val) => val && typeof val === 'object' && !Array.isArray(val);

  const output = { ...target };
  sources.forEach((src) => {
    if (!isObject(src)) return;
    Object.entries(src).forEach(([key, value]) => {
      if (isObject(value)) {
        output[key] = mergeDeep(output[key] || {}, value);
      } else {
        output[key] = value;
      }
    });
  });
  return output;
}
