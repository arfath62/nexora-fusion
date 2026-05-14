import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from './config';

export interface AuthTokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: AuthTokenPayload): string {
  const expiresIn = config.jwtTtl as SignOptions['expiresIn'];
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn,
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
}
