import { PhoneNormalizationError, toE164 } from './phone.util';

describe('phone.util', () => {
  it.each([
    ['06 12 34 56 78', '+33612345678'],
    ['06-12-34-56-78', '+33612345678'],
    ['(06) 12.34.56.78', '+33612345678'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['0033 6 12 34 56 78', '+33612345678'],
    ['612345678', '+33612345678'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it('rejects invalid phone numbers', () => {
    expect(() => toE164('not-a-phone')).toThrow(PhoneNormalizationError);
  });

  it('rejects unsupported countries', () => {
    expect(() => toE164('0612345678', 'BE')).toThrow(PhoneNormalizationError);
  });
});
