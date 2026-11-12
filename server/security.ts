import { compare, hash } from "bcryptjs";
import { timingSafeEqual } from "node:crypto";

const BCRYPT_ROUNDS = 12;
const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;

export type PasswordEvaluation =
  | { valid: false }
  | { valid: true; upgradedHash?: string };

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

export async function evaluatePassword(
  candidate: string,
  stored: string,
): Promise<PasswordEvaluation> {
  if (BCRYPT_PATTERN.test(stored)) {
    try {
      return (await compare(candidate, stored))
        ? { valid: true }
        : { valid: false };
    } catch {
      return { valid: false };
    }
  }

  const candidateBuffer = Buffer.from(candidate);
  const storedBuffer = Buffer.from(stored);
  if (
    candidateBuffer.length !== storedBuffer.length ||
    !timingSafeEqual(candidateBuffer, storedBuffer)
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    upgradedHash: await hashPassword(candidate),
  };
}

export function toPublicTeacherStudent(student: {
  firstName: string;
  lastName: string;
  condition: string;
  [key: string]: unknown;
}) {
  return {
    firstName: student.firstName,
    lastName: student.lastName,
    condition: student.condition,
  };
}

export function isAllowedMutationOrigin(
  origin: string | undefined,
  host: string,
  protocol: string,
): boolean {
  if (!origin) return true;

  try {
    const parsed = new URL(origin);
    return (
      parsed.host.toLowerCase() === host.toLowerCase() &&
      parsed.protocol === `${protocol.replace(/:$/, "")}:`
    );
  } catch {
    return false;
  }
}
