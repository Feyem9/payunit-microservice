import { describe, it, expect } from 'vitest';
import { assertSafeUrl } from '../utils/ssrf.guard';

describe('assertSafeUrl', () => {
  it('accepte une URL HTTPS publique valide', () => {
    expect(() => assertSafeUrl('https://online-learning.com/webhook')).not.toThrow();
  });

  it('accepte une URL HTTP en mode non-production', () => {
    expect(() => assertSafeUrl('http://example.com/webhook')).not.toThrow();
  });

  it('bloque localhost', () => {
    expect(() => assertSafeUrl('http://localhost/admin')).toThrow('Blocked internal URL');
  });

  it('bloque 127.0.0.1', () => {
    expect(() => assertSafeUrl('http://127.0.0.1/secret')).toThrow('Blocked internal URL');
  });

  it('bloque les IPs privées 192.168.x.x', () => {
    expect(() => assertSafeUrl('http://192.168.1.1/api')).toThrow('Blocked internal URL');
  });

  it('bloque les IPs privées 10.x.x.x', () => {
    expect(() => assertSafeUrl('http://10.0.0.1/api')).toThrow('Blocked internal URL');
  });

  it('bloque le metadata endpoint AWS', () => {
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data')).toThrow('Blocked internal URL');
  });

  it('bloque les protocoles non HTTP/HTTPS', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow('Blocked URL protocol');
  });

  it('bloque une URL malformée', () => {
    expect(() => assertSafeUrl('not-a-url')).toThrow('Invalid URL');
  });
});
