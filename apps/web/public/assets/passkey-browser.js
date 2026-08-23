(() => {
  const supportsWebAuthn = () => Boolean(
    window.isSecureContext
    && 'PublicKeyCredential' in window
    && navigator.credentials
    && typeof navigator.credentials.create === 'function'
    && typeof navigator.credentials.get === 'function'
  );

  const base64UrlToBytes = (value) => {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 ? '='.repeat(4 - (normalized.length % 4)) : '';
    const binary = atob(normalized + padding);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  };

  const bytesToBase64Url = (value) => {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const parseCreationOptions = (options) => {
    if (!options || typeof options !== 'object') throw new Error('Passkey registration options are invalid.');
    if (typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function') {
      return PublicKeyCredential.parseCreationOptionsFromJSON(options);
    }
    const result = {
      ...options,
      challenge: base64UrlToBytes(options.challenge).buffer,
      user: {
        ...options.user,
        id: base64UrlToBytes(options.user?.id).buffer,
      },
    };
    if (Array.isArray(options.excludeCredentials)) {
      result.excludeCredentials = options.excludeCredentials.map((credential) => ({
        ...credential,
        id: base64UrlToBytes(credential.id).buffer,
        type: credential.type || 'public-key',
      }));
    }
    return result;
  };

  const parseRequestOptions = (options) => {
    if (!options || typeof options !== 'object') throw new Error('Passkey authentication options are invalid.');
    if (typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function') {
      return PublicKeyCredential.parseRequestOptionsFromJSON(options);
    }
    const result = {
      ...options,
      challenge: base64UrlToBytes(options.challenge).buffer,
    };
    if (Array.isArray(options.allowCredentials)) {
      result.allowCredentials = options.allowCredentials.map((credential) => ({
        ...credential,
        id: base64UrlToBytes(credential.id).buffer,
        type: credential.type || 'public-key',
      }));
    }
    return result;
  };

  const serializeCredential = (credential) => {
    if (!credential || typeof credential !== 'object') throw new Error('Passkey credential is missing.');
    if (typeof credential.toJSON === 'function') return credential.toJSON();

    const response = credential.response;
    const common = {
      id: credential.id,
      rawId: credential.id,
      type: 'public-key',
      clientExtensionResults: typeof credential.getClientExtensionResults === 'function'
        ? credential.getClientExtensionResults()
        : {},
      ...(credential.authenticatorAttachment ? { authenticatorAttachment: credential.authenticatorAttachment } : {}),
    };

    if (response && 'attestationObject' in response) {
      return {
        ...common,
        response: {
          attestationObject: bytesToBase64Url(response.attestationObject),
          clientDataJSON: bytesToBase64Url(response.clientDataJSON),
        },
      };
    }

    if (response && 'authenticatorData' in response) {
      return {
        ...common,
        response: {
          authenticatorData: bytesToBase64Url(response.authenticatorData),
          clientDataJSON: bytesToBase64Url(response.clientDataJSON),
          signature: bytesToBase64Url(response.signature),
          ...(response.userHandle ? { userHandle: bytesToBase64Url(response.userHandle) } : {}),
        },
      };
    }

    throw new Error('The browser returned an unsupported passkey credential.');
  };

  const create = async (options) => {
    if (!supportsWebAuthn()) throw new Error('Passkeys are not supported in this browser or context.');
    const credential = await navigator.credentials.create({ publicKey: parseCreationOptions(options) });
    if (!credential) throw new Error('Passkey registration was cancelled.');
    return serializeCredential(credential);
  };

  const get = async (options) => {
    if (!supportsWebAuthn()) throw new Error('Passkeys are not supported in this browser or context.');
    const credential = await navigator.credentials.get({ publicKey: parseRequestOptions(options) });
    if (!credential) throw new Error('Passkey sign-in was cancelled.');
    return serializeCredential(credential);
  };

  window.USDImpactPasskeys = Object.freeze({
    supported: supportsWebAuthn,
    create,
    get,
  });
})();
