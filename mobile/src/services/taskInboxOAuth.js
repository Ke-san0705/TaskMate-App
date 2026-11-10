const GITHUB_REDIRECT_TO = 'taskmate://auth/callback';
const LOGIN_ERROR = 'GitHubでログインできませんでした。もう一度お試しください。';

function createLoginGuard() {
  let pending = null;
  return { run(operation) {
    if (!pending) pending = Promise.resolve().then(operation).finally(() => { pending = null; });
    return pending;
  } };
}

// Supabase uses the Web Crypto shape for PKCE. Hermes needs Expo's native
// random source and digest; never fall back to Math.random or plain PKCE.
function ensurePKCECrypto(runtime, nativeCrypto) {
  if (!runtime.crypto) runtime.crypto = {};
  if (!runtime.crypto.getRandomValues) runtime.crypto.getRandomValues = (array) => nativeCrypto.getRandomValues(array);
  if (!runtime.crypto.subtle) runtime.crypto.subtle = {
    digest: async (algorithm, data) => {
      if (algorithm !== 'SHA-256') throw new Error('Unsupported PKCE digest.');
      return nativeCrypto.digest('SHA-256', data);
    }
  };
}

function createGitHubLogin({ auth, openAuthSession, projectUrl }) {
  return async (isCurrent) => {
    try {
      if (!isCurrent()) return null;
      const { data, error } = await auth.signInWithOAuth({ provider: 'github', options: { redirectTo: GITHUB_REDIRECT_TO, skipBrowserRedirect: true } });
      if (!isCurrent()) return null;
      if (error || !data?.url) throw new Error(LOGIN_ERROR);
      const start = new URL(data.url), project = new URL(projectUrl);
      if (start.protocol !== 'https:' || start.origin !== project.origin || start.username || start.password ||
          start.pathname !== '/auth/v1/authorize' || start.searchParams.get('provider') !== 'github' ||
          start.searchParams.get('code_challenge_method')?.toLowerCase() !== 's256' || !start.searchParams.get('code_challenge')) throw new Error(LOGIN_ERROR);
      const result = await openAuthSession(data.url, GITHUB_REDIRECT_TO);
      if (!isCurrent() || result?.type === 'cancel' || result?.type === 'dismiss') return null;
      if (result?.type !== 'success' || !result.url) throw new Error(LOGIN_ERROR);
      const callback = new URL(result.url), expected = new URL(GITHUB_REDIRECT_TO);
      const codes = callback.searchParams.getAll('code');
      if (callback.protocol !== expected.protocol || callback.host !== expected.host || callback.pathname !== expected.pathname ||
          callback.username || callback.password || callback.hash || callback.searchParams.has('error') ||
          codes.length !== 1 || !/^[a-zA-Z0-9_-]{1,2048}$/.test(codes[0])) throw new Error(LOGIN_ERROR);
      const exchanged = await auth.exchangeCodeForSession(codes[0]);
      if (!isCurrent()) return null;
      if (exchanged.error || !exchanged.data?.session?.user?.id) throw new Error(LOGIN_ERROR);
      return exchanged.data.session;
    } catch {
      if (!isCurrent()) return null;
      throw new Error(LOGIN_ERROR);
    }
  };
}
module.exports = { GITHUB_REDIRECT_TO, createGitHubLogin, ensurePKCECrypto, createLoginGuard };
