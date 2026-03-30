export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  tokenFamily?: string;
  iat?: number;
  exp?: number;
}
