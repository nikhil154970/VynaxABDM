let state = {
  requests: 0,
  navigation: 0,
};

const listeners = new Set();

function emit() {
  for (const l of listeners) l(state);
}

export function subscribeLoading(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLoadingState() {
  return state;
}

export function resetGlobalLoading() {
  state = { requests: 0, navigation: 0 };
  emit();
}

export function startRequestLoading() {
  state = { ...state, requests: state.requests + 1 };
  emit();
}

export function stopRequestLoading() {
  state = { ...state, requests: Math.max(0, state.requests - 1) };
  emit();
}

export function startNavigationLoading() {
  state = { ...state, navigation: state.navigation + 1 };
  emit();
}

export function stopNavigationLoading() {
  state = { ...state, navigation: Math.max(0, state.navigation - 1) };
  emit();
}

export function isGlobalLoading(s = state) {
  return (s.requests + s.navigation) > 0;
}

