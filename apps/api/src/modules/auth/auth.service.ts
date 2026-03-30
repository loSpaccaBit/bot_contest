import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { Admin } from '@domusbet/database';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface LoginResult extends TokenPair {
  admin: Omit<Admin, 'passwordHash'>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
  private readonly BCRYPT_SALT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const admin = await this.prisma.admin.findUnique({ where: { email } });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.comparePassword(password, admin.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(admin);

    // Store refresh token hash in a way that lets us validate it
    await this.storeRefreshToken(admin.id, tokens.refreshToken);

    // Update last login timestamp
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      adminId: admin.id,
      action: 'AUTH_LOGIN',
      entityType: 'Admin',
      entityId: admin.id,
      details: { email: admin.email },
      ipAddress,
      userAgent,
    });

    this.logger.log(`Admin ${admin.email} logged in from ${ipAddress ?? 'unknown'}`);

    const { passwordHash: _, ...adminWithoutPassword } = admin;
    return { ...tokens, admin: adminWithoutPassword };
  }

  async logout(adminId: string): Promise<void> {
    await this.removeRefreshToken(adminId);

    await this.auditService.log({
      adminId,
      action: 'AUTH_LOGOUT',
      entityType: 'Admin',
      entityId: adminId,
    });
  }

  async refreshTokens(
    adminId: string,
    refreshToken: string,
  ): Promise<TokenPair> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Access denied');
    }

    const isValid = await this.validateStoredRefreshToken(adminId, refreshToken);
    if (!isValid) {
      // Token reuse detected — revoke all tokens for this admin
      await this.removeRefreshToken(adminId);
      throw new UnauthorizedException('Refresh token invalid or expired. Please log in again.');
    }

    const tokens = await this.generateTokens(admin);
    await this.storeRefreshToken(admin.id, tokens.refreshToken);

    return tokens;
  }

  async validateAdmin(id: string): Promise<Admin | null> {
    return this.prisma.admin.findUnique({
      where: { id, isActive: true },
    });
  }

  async generateTokens(admin: Admin): Promise<TokenPair> {
    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(
        { sub: admin.id, email: admin.email },
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private getRefreshTokenKey(adminId: string): string {
    return `refresh_token:${adminId}`;
  }

  /**
   * Store a hashed version of the refresh token in the Admin record.
   * For simplicity we use the database; for high-throughput use Redis.
   */
  private async storeRefreshToken(adminId: string, token: string): Promise<void> {
    const hashedToken = await bcrypt.hash(token, 10);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { refreshTokenHash: hashedToken },
    });
  }

  private async validateStoredRefreshToken(
    adminId: string,
    token: string,
  ): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { refreshTokenHash: true },
    });

    if (!admin?.refreshTokenHash) return false;

    return bcrypt.compare(token, admin.refreshTokenHash);
  }

  private async removeRefreshToken(adminId: string): Promise<void> {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { refreshTokenHash: null },
    });
  }
}
