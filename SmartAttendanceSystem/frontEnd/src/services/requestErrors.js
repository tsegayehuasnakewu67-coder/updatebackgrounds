const MAX_RETRY_DELAY_SECONDS = 300;

export function getRetryDelaySeconds(error, attempt = 0) {
  const headers = error?.response?.headers || {};
  const retryAfter = headers['retry-after'];
  if (retryAfter !== undefined) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds);
    }
    const retryDate = Date.parse(retryAfter);
    if (Number.isFinite(retryDate)) {
      return Math.max(1, Math.ceil((retryDate - Date.now()) / 1000));
    }
  }

  const resetAfter = Number(headers['ratelimit-reset']);
  if (Number.isFinite(resetAfter) && resetAfter > 0) {
    return Math.ceil(resetAfter);
  }

  return Math.min(MAX_RETRY_DELAY_SECONDS, 15 * (2 ** Math.min(attempt, 5)));
}

export function getRequestErrorMessage(error, resource) {
  const status = error?.response?.status;
  if (status === 429) return `${resource} is temporarily unavailable because of a request limit.`;
  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'Your account is not authorized to access this information.';
  if (status >= 500) return `${resource} could not be loaded right now. Please try again shortly.`;
  if (!error?.response) return `Unable to reach the server. Check your connection and try again.`;
  return error.response.data?.message || `Unable to load ${resource.toLowerCase()}.`;
}
