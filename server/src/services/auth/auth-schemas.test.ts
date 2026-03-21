/**
 * auth-schemas.test.ts
 * Unit tests for all Joi validation schemas in auth-schemas.ts.
 * No external dependencies needed — pure schema validation.
 */

import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth-schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function valid(schema: any, value: object) {
  return schema.validate(value, { abortEarly: false });
}

function expectValid(schema: any, value: object) {
  const { error } = valid(schema, value);
  expect(error).toBeUndefined();
}

function expectInvalid(schema: any, value: object) {
  const { error } = valid(schema, value);
  expect(error).toBeDefined();
  return error!;
}

// ---------------------------------------------------------------------------
// registerSchema
// ---------------------------------------------------------------------------
describe('registerSchema', () => {
  const VALID = {
    email: 'alice@example.com',
    password: 'SecurePass1',
    full_name: 'Alice Smith',
  };

  it('accepts a valid registration payload', () => {
    expectValid(registerSchema, VALID);
  });

  it('normalises email to lowercase', () => {
    const { value } = valid(registerSchema, { ...VALID, email: 'ALICE@Example.COM' });
    expect(value.email).toBe('alice@example.com');
  });

  it('rejects a missing email', () => {
    const err = expectInvalid(registerSchema, { ...VALID, email: undefined });
    const fields = err.details.map((d: any) => d.path[0]);
    expect(fields).toContain('email');
  });

  it('rejects a malformed email address', () => {
    const err = expectInvalid(registerSchema, { ...VALID, email: 'not-an-email' });
    expect(err.details[0].path[0]).toBe('email');
  });

  it('rejects a password shorter than 8 characters', () => {
    const err = expectInvalid(registerSchema, { ...VALID, password: 'Sh0rt' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('8 characters'))).toBe(true);
  });

  it('rejects a password with no uppercase letter', () => {
    const err = expectInvalid(registerSchema, { ...VALID, password: 'alllower1' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('uppercase letter'))).toBe(true);
  });

  it('rejects a password with no digit', () => {
    const err = expectInvalid(registerSchema, { ...VALID, password: 'NoDigitHere' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('digit'))).toBe(true);
  });

  it('rejects a missing password', () => {
    const err = expectInvalid(registerSchema, { ...VALID, password: undefined });
    expect(err.details[0].path[0]).toBe('password');
  });

  it('rejects full_name shorter than 2 characters', () => {
    const err = expectInvalid(registerSchema, { ...VALID, full_name: 'A' });
    expect(err.details[0].path[0]).toBe('full_name');
  });

  it('rejects full_name longer than 100 characters', () => {
    const err = expectInvalid(registerSchema, { ...VALID, full_name: 'A'.repeat(101) });
    expect(err.details[0].path[0]).toBe('full_name');
  });

  it('rejects a missing full_name', () => {
    const err = expectInvalid(registerSchema, { ...VALID, full_name: undefined });
    expect(err.details[0].path[0]).toBe('full_name');
  });

  it('strips unknown fields silently', () => {
    const { value, error } = registerSchema.validate(
      { ...VALID, extra: 'should-be-stripped' },
      { stripUnknown: true }
    );
    expect(error).toBeUndefined();
    expect(value).not.toHaveProperty('extra');
  });

  it('collects all errors when abortEarly is false', () => {
    const { error } = registerSchema.validate(
      { email: 'bad', password: 'weak', full_name: '' },
      { abortEarly: false }
    );
    expect(error!.details.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// loginSchema
// ---------------------------------------------------------------------------
describe('loginSchema', () => {
  const VALID = { email: 'bob@example.com', password: 'anypassword' };

  it('accepts a valid login payload', () => {
    expectValid(loginSchema, VALID);
  });

  it('normalises email to lowercase', () => {
    const { value } = valid(loginSchema, { ...VALID, email: 'BOB@EXAMPLE.COM' });
    expect(value.email).toBe('bob@example.com');
  });

  it('rejects a missing email', () => {
    const err = expectInvalid(loginSchema, { password: 'anypassword' });
    expect(err.details[0].path[0]).toBe('email');
  });

  it('rejects a malformed email address', () => {
    const err = expectInvalid(loginSchema, { ...VALID, email: 'not-valid' });
    expect(err.details[0].path[0]).toBe('email');
  });

  it('rejects a missing password', () => {
    const err = expectInvalid(loginSchema, { email: 'bob@example.com' });
    expect(err.details[0].path[0]).toBe('password');
  });

  it('accepts any non-empty password (no complexity check on login)', () => {
    expectValid(loginSchema, { ...VALID, password: 'simple' });
  });
});

// ---------------------------------------------------------------------------
// resetPasswordSchema
// ---------------------------------------------------------------------------
describe('resetPasswordSchema', () => {
  const VALID = { token: 'abc123deadbeef', new_password: 'NewSecure1' };

  it('accepts a valid reset payload', () => {
    expectValid(resetPasswordSchema, VALID);
  });

  it('rejects a missing token', () => {
    const err = expectInvalid(resetPasswordSchema, { new_password: 'NewSecure1' });
    expect(err.details[0].path[0]).toBe('token');
  });

  it('rejects a missing new_password', () => {
    const err = expectInvalid(resetPasswordSchema, { token: 'abc123' });
    expect(err.details[0].path[0]).toBe('new_password');
  });

  it('rejects a new_password shorter than 8 characters', () => {
    const err = expectInvalid(resetPasswordSchema, { ...VALID, new_password: 'Sh0rt' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('8 characters'))).toBe(true);
  });

  it('rejects a new_password with no uppercase letter', () => {
    const err = expectInvalid(resetPasswordSchema, { ...VALID, new_password: 'nouppercase1' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('uppercase letter'))).toBe(true);
  });

  it('rejects a new_password with no digit', () => {
    const err = expectInvalid(resetPasswordSchema, { ...VALID, new_password: 'NoDigitHere' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('digit'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// changePasswordSchema
// ---------------------------------------------------------------------------
describe('changePasswordSchema', () => {
  const VALID = { current_password: 'OldPass1', new_password: 'NewSecure1' };

  it('accepts a valid change-password payload', () => {
    expectValid(changePasswordSchema, VALID);
  });

  it('rejects a missing current_password', () => {
    const err = expectInvalid(changePasswordSchema, { new_password: 'NewSecure1' });
    expect(err.details[0].path[0]).toBe('current_password');
  });

  it('rejects a missing new_password', () => {
    const err = expectInvalid(changePasswordSchema, { current_password: 'OldPass1' });
    expect(err.details[0].path[0]).toBe('new_password');
  });

  it('rejects a new_password shorter than 8 characters', () => {
    const err = expectInvalid(changePasswordSchema, { ...VALID, new_password: 'Sh0rt' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('8 characters'))).toBe(true);
  });

  it('rejects a new_password with no uppercase letter', () => {
    const err = expectInvalid(changePasswordSchema, { ...VALID, new_password: 'nouppercase1' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('uppercase letter'))).toBe(true);
  });

  it('rejects a new_password with no digit', () => {
    const err = expectInvalid(changePasswordSchema, { ...VALID, new_password: 'NoDigitAtAll' });
    const messages = err.details.map((d: any) => d.message);
    expect(messages.some((m: string) => m.includes('digit'))).toBe(true);
  });

  it('accepts any non-empty string for current_password (no complexity rule)', () => {
    expectValid(changePasswordSchema, { ...VALID, current_password: 'simple' });
  });
});
