const inFlightGets = new Map();

export function getOnce(key, request) {
  const existing = inFlightGets.get(key);
  if (existing) return existing;

  const pending = Promise.resolve()
    .then(request)
    .finally(() => {
      if (inFlightGets.get(key) === pending) inFlightGets.delete(key);
    });
  inFlightGets.set(key, pending);
  return pending;
}
