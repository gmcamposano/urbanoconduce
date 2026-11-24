import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import {
	apiTokenExpiresAt,
	generateApiToken,
	hashApiToken,
	isApiToken,
	signUserJwt
} from './apiTokenCrypto.ts';

const user = { id: '00000000-0000-0000-0000-000000000001', email: 'a@b.com' };
const supabaseUrl = 'https://example.supabase.co/';

function decode(part: string) {
	return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

test('generateApiToken returns a prefixed random token with matching hash and prefix', () => {
	const a = generateApiToken();
	const b = generateApiToken();
	assert.ok(isApiToken(a.token));
	assert.notEqual(a.token, b.token);
	assert.match(a.tokenHash, /^[0-9a-f]{64}$/);
	assert.equal(a.tokenHash, hashApiToken(a.token));
	assert.ok(a.token.startsWith(a.tokenPrefix));
	assert.equal(a.tokenPrefix.length, 10);
	assert.ok(a.token.length > 40);
});

test('isApiToken does not match Supabase JWTs', () => {
	assert.equal(isApiToken('eyJhbGciOiJIUzI1NiJ9.x.y'), false);
});

test('apiTokenExpiresAt handles every option and rejects others', () => {
	const now = new Date('2026-01-01T00:00:00Z');
	assert.equal(apiTokenExpiresAt('30', now), '2026-01-31T00:00:00.000Z');
	assert.equal(apiTokenExpiresAt('365', now), '2027-01-01T00:00:00.000Z');
	assert.equal(apiTokenExpiresAt('never', now), null);
	assert.equal(apiTokenExpiresAt('7', now), undefined);
	assert.equal(apiTokenExpiresAt('', now), undefined);
});

test('signUserJwt with HS256 secret produces a verifiable authenticated token', () => {
	const jwt = signUserJwt(user, { supabaseUrl, keys: { secret: 's3cret' }, now: 1_000_000 });
	const [h, p, s] = jwt.split('.');
	assert.deepEqual(decode(h), { alg: 'HS256', typ: 'JWT' });
	const payload = decode(p);
	assert.equal(payload.sub, user.id);
	assert.equal(payload.role, 'authenticated');
	assert.equal(payload.aud, 'authenticated');
	assert.equal(payload.iss, 'https://example.supabase.co/auth/v1');
	assert.equal(payload.exp - payload.iat, 300);
	const expected = createHmac('sha256', 's3cret').update(`${h}.${p}`).digest('base64url');
	assert.equal(s, expected);
});

test('signUserJwt prefers the ES256 key and includes its kid', () => {
	const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
	const jwk = { ...privateKey.export({ format: 'jwk' }), kid: 'my-kid' };
	const jwt = signUserJwt(user, {
		supabaseUrl,
		keys: { privateJwk: JSON.stringify(jwk), secret: 'ignored' }
	});
	const [h, p, s] = jwt.split('.');
	assert.deepEqual(decode(h), { alg: 'ES256', typ: 'JWT', kid: 'my-kid' });
	const ok = verify(
		'sha256',
		Buffer.from(`${h}.${p}`),
		{ key: createPublicKey(privateKey), dsaEncoding: 'ieee-p1363' },
		Buffer.from(s, 'base64url')
	);
	assert.ok(ok);
});

test('signUserJwt throws without keys', () => {
	assert.throws(() => signUserJwt(user, { supabaseUrl, keys: {} }));
});
