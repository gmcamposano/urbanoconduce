import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { signUserJwt } from './apiTokenCrypto';

export {
	API_TOKEN_EXPIRY_OPTIONS,
	apiTokenExpiresAt,
	generateApiToken,
	hashApiToken,
	isApiToken
} from './apiTokenCrypto';

/** True when the server has a key to mint Supabase JWTs for personal tokens. */
export function canMintUserJwt() {
	return Boolean(env.SUPABASE_JWT_PRIVATE_JWK || env.SUPABASE_JWT_SECRET);
}

/**
 * Mints a 5-minute Supabase access token for the owner of a personal token.
 * Uses SUPABASE_JWT_PRIVATE_JWK (ES256 key imported into Supabase) when set,
 * otherwise the legacy HS256 SUPABASE_JWT_SECRET.
 */
export function mintUserJwt(user: { id: string; email: string }) {
	return signUserJwt(user, {
		supabaseUrl: publicEnv.PUBLIC_SUPABASE_URL ?? '',
		keys: { privateJwk: env.SUPABASE_JWT_PRIVATE_JWK, secret: env.SUPABASE_JWT_SECRET }
	});
}
