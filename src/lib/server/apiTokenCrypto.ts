import {
	createHash,
	createHmac,
	createPrivateKey,
	randomBytes,
	sign,
	type JsonWebKey
} from 'node:crypto';

/** Every personal token starts with this, so /mcp can tell it apart from a Supabase JWT. */
export const API_TOKEN_PREFIX = 'uc_';

/** Characters of the token kept in the clear so users can recognise it in the list. */
const VISIBLE_PREFIX_LENGTH = 10;

/** Lifetime of the Supabase JWT minted for one MCP request. */
export const MINTED_JWT_SECONDS = 5 * 60;

export const API_TOKEN_EXPIRY_OPTIONS = [
	{ value: '30', label: '30 días' },
	{ value: '90', label: '90 días' },
	{ value: '365', label: '1 año' },
	{ value: 'never', label: 'Sin vencimiento' }
] as const;

export function isApiToken(token: string) {
	return token.startsWith(API_TOKEN_PREFIX);
}

export function hashApiToken(token: string) {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** A new random token (256 bits) plus what gets stored: its hash and visible prefix. */
export function generateApiToken() {
	const token = API_TOKEN_PREFIX + randomBytes(32).toString('base64url');
	return {
		token,
		tokenHash: hashApiToken(token),
		tokenPrefix: token.slice(0, VISIBLE_PREFIX_LENGTH)
	};
}

/**
 * ISO expiry date for a choice from API_TOKEN_EXPIRY_OPTIONS, null for "never",
 * undefined for anything else.
 */
export function apiTokenExpiresAt(choice: string, now = new Date()): string | null | undefined {
	if (!API_TOKEN_EXPIRY_OPTIONS.some((option) => option.value === choice)) return undefined;
	if (choice === 'never') return null;
	return new Date(now.getTime() + Number(choice) * 24 * 60 * 60 * 1000).toISOString();
}

export type JwtSigningKeys = {
	/** Private JWK (ES256, P-256) imported into Supabase as a signing key. Preferred. */
	privateJwk?: string;
	/** Legacy HS256 JWT secret of the Supabase project. */
	secret?: string;
};

function base64url(input: string | Buffer) {
	return Buffer.from(input).toString('base64url');
}

/**
 * Signs a short-lived Supabase access token for a user, so PostgREST applies RLS
 * exactly as for a browser session.
 */
export function signUserJwt(
	user: { id: string; email: string },
	options: { supabaseUrl: string; keys: JwtSigningKeys; now?: number }
) {
	const iat = Math.floor((options.now ?? Date.now()) / 1000);
	const payload = {
		iss: `${options.supabaseUrl.replace(/\/$/, '')}/auth/v1`,
		sub: user.id,
		aud: 'authenticated',
		role: 'authenticated',
		email: user.email,
		is_anonymous: false,
		iat,
		exp: iat + MINTED_JWT_SECONDS
	};
	const encodedPayload = base64url(JSON.stringify(payload));

	if (options.keys.privateJwk) {
		const jwk = JSON.parse(options.keys.privateJwk) as JsonWebKey;
		const kid = typeof jwk.kid === 'string' ? jwk.kid : undefined;
		const header = { alg: 'ES256', typ: 'JWT', ...(kid ? { kid } : {}) };
		const input = `${base64url(JSON.stringify(header))}.${encodedPayload}`;
		const key = createPrivateKey({ key: jwk, format: 'jwk' });
		const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
		return `${input}.${base64url(signature)}`;
	}

	if (options.keys.secret) {
		const input = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encodedPayload}`;
		const signature = createHmac('sha256', options.keys.secret).update(input).digest();
		return `${input}.${base64url(signature)}`;
	}

	throw new Error('No JWT signing key configured.');
}
