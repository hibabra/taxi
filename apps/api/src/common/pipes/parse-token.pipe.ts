import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Pipe de validation pour les tokens d'invitation et de réinitialisation.
 *
 * Les tokens sont des chaînes base64url de 32 octets aléatoires (~43 caractères).
 * Ce pipe vérifie :
 * - que la valeur est une chaîne non vide
 * - que la longueur est comprise entre 32 et 128 caractères
 * - que le format est conforme au base64url (lettres, chiffres, -, _)
 *
 * Cela empêche les requêtes avec des tokens vides, trop courts ou malformés
 * d'atteindre la couche service (fail-fast).
 */
@Injectable()
export class ParseTokenPipe implements PipeTransform<string, string> {
  private static readonly BASE64URL_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

  transform(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('Le token est obligatoire');
    }

    const trimmed = value.trim();

    if (!ParseTokenPipe.BASE64URL_PATTERN.test(trimmed)) {
      throw new BadRequestException(
        'Le format du token est invalide (attendu: base64url, 32-128 caractères)',
      );
    }

    return trimmed;
  }
}
