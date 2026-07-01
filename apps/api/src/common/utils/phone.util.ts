export class PhoneNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = PhoneNormalizationError.name;
  }
}

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

/**
 * Normalise un numéro en E.164.
 *
 * Pour la Vague 1, le pays par défaut est la France. L'utilitaire accepte
 * les formes courantes saisies par les opérateurs : espaces, points,
 * tirets, parenthèses, préfixe +33 ou numéro national commençant par 0.
 */
export function toE164(rawPhone: string, countryCode: string = 'FR'): string {
  const compact = rawPhone.trim().replace(/[\s().-]/g, '');

  if (!compact) {
    throw new PhoneNormalizationError('Le téléphone est obligatoire');
  }

  if (compact.startsWith('+')) {
    return assertE164(compact);
  }

  if (compact.startsWith('00')) {
    return assertE164(`+${compact.slice(2)}`);
  }

  if (!/^\d+$/.test(compact)) {
    throw new PhoneNormalizationError('Le téléphone contient des caractères invalides');
  }

  if (countryCode.toUpperCase() !== 'FR') {
    throw new PhoneNormalizationError(`Pays non supporté pour la normalisation: ${countryCode}`);
  }

  if (/^0[1-9]\d{8}$/.test(compact)) {
    return assertE164(`+33${compact.slice(1)}`);
  }

  if (/^33[1-9]\d{8}$/.test(compact)) {
    return assertE164(`+${compact}`);
  }

  if (/^[1-9]\d{8}$/.test(compact)) {
    return assertE164(`+33${compact}`);
  }

  throw new PhoneNormalizationError('Le téléphone ne peut pas être normalisé en E.164');
}

function assertE164(value: string): string {
  if (!E164_PATTERN.test(value)) {
    throw new PhoneNormalizationError('Le téléphone doit être au format E.164');
  }

  return value;
}
