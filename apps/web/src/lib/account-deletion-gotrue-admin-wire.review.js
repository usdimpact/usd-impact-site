// Issue #950 — GoTrue Admin soft-delete wire PROTOCOL REVIEW ONLY.
// Only an offline fixture with an intentionally unusable test key and one
// synthetic account UUID may invoke the explicitly injected fake transport.
// This is NOT imported by a live route, cron or the active legacy finalizer.
// The deployed claim-aware finalizer and real Auth Admin acceptance are HOLD.
export const GOTRUE_WIRE_TEST_ORIGIN = 'https://ycstrcvshdluovtuasjc.supabase.co';
export const GOTRUE_WIRE_TEST_ACCOUNT = '11111111-2222-4333-8444-555555555555';
export const GOTRUE_WIRE_TEST_KEY = 'sb_secret_issue950_offline_wire_fixture_never_real';

export class AuthAdminWireReviewError extends Error {
  constructor(code) {
    super(code);
    this.name='AuthAdminWireReviewError';
    this.code=code;
  }
}
function stop(code) { throw new AuthAdminWireReviewError(code); }

function validate({ config, wireFetch }) {
  if (config?.mode !== 'offline_fixture'
    || config?.production !== false
    || config?.supabase?.url !== GOTRUE_WIRE_TEST_ORIGIN
    || config?.supabase?.secretKey !== GOTRUE_WIRE_TEST_KEY
    || typeof wireFetch !== 'function'
    || wireFetch === globalThis.fetch) {
    stop('AUTH_ADMIN_WIRE_REVIEW_HOLD');
  }
}
// Return a fixture-only adapter matching the claim coordinator's
// { accountId, authUserId, shouldSoftDelete } injected dependency.
// No automatic retries, fallback credentials, global fetch or providers.
export function createOfflineAuthAdminSoftDelete({ config, wireFetch }={}) {
  validate({config,wireFetch});
  return async function offlineAuthAdminSoftDelete({accountId,authUserId,shouldSoftDelete}={}) {
    validate({config,wireFetch});
    if(accountId !== GOTRUE_WIRE_TEST_ACCOUNT
      || authUserId !== GOTRUE_WIRE_TEST_ACCOUNT
      || shouldSoftDelete !== true) {
      stop('AUTH_ADMIN_WIRE_SYNTHETIC_IDENTITY_REQUIRED');
    }
    // The JSON body is critical. GoTrue does not read this flag from a URL
    // query, and omission of should_soft_delete would HARD-delete the user.
    const endpoint=GOTRUE_WIRE_TEST_ORIGIN
      + '/auth/v1/admin/users/' + GOTRUE_WIRE_TEST_ACCOUNT;
    // Opaque sb_secret_ keys are not JWTs; carry only on apikey.
    // GoTrue-specific acceptance with a protected, fresh synthetic identity
    // is still a separate prerequisite before any real provider use.
    const response=await wireFetch(endpoint,{
      method:'DELETE',
      headers:{
        apikey:GOTRUE_WIRE_TEST_KEY,
        Accept:'application/json',
        'Content-Type':'application/json',
      },
      body:JSON.stringify({should_soft_delete:true}),
      redirect:'error',
      cache:'no-store',
    });
    // Do not inspect or print GoTrue response body (may contain PII).
    // 404/409/429/5xx, malformed replies and timeouts are NOT successes.
    // The caller must put the dispatched claim in manual reconciliation.
    return Object.freeze({status:response?.status});
  };
}
