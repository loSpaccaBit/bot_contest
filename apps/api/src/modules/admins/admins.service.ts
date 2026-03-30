import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminRole, type Admin } from '@domusbet/database';

interface AdminQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

type SafeAdmin = Omit<Admin, 'passwordHash' | 'refreshTokenHash'>;

const SAFE_ADMIN_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  async findAll(query: AdminQuery = {}): Promise<PaginatedResult<SafeAdmin>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(query.search && {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' as const } },
          { displayName: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
      ...(query.role && { role: query.role as AdminRole }),
    };

    const [items, total] = await Promise.all([
      this.prisma.admin.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: SAFE_ADMIN_SELECT,
      }),
      this.prisma.admin.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items as SafeAdmin[],
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async findById(id: string): Promise<SafeAdmin> {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: SAFE_ADMIN_SELECT,
    });

    if (!admin) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }

    return admin as SafeAdmin;
  }

  async create(dto: CreateAdminDto, createdByAdminId: string): Promise<SafeAdmin> {
    const existing = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(`Admin with email ${dto.email} already exists`);
    }

    const passwordHash = await this.authService.hashPassword(dto.password);

    const admin = await this.prisma.admin.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        passwordHash,
        role: (dto.role as AdminRole) ?? AdminRole.VIEWER,
        isActive: true,
      },
      select: SAFE_ADMIN_SELECT,
    });

    await this.auditService.log({
      adminId: createdByAdminId,
      action: 'ADMIN_CREATE',
      entityType: 'Admin',
      entityId: admin.id,
      details: { email: admin.email, role: admin.role },
    });

    this.logger.log(`Admin ${admin.email} created by admin ${createdByAdminId}`);

    return admin as SafeAdmin;
  }

  async update(
    id: string,
    dto: UpdateAdminDto,
    updatedByAdminId: string,
  ): Promise<SafeAdmin> {
    const existing = await this.prisma.admin.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }

    if (id === updatedByAdminId && dto.isActive === false) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const data: Partial<Pick<Admin, 'email' | 'displayName' | 'role' | 'isActive' | 'passwordHash'>> = {};

    if (dto.email !== undefined) {
      const emailTaken = await this.prisma.admin.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (emailTaken) {
        throw new ConflictException(`Email ${dto.email} is already in use`);
      }
      data.email = dto.email;
    }

    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.role !== undefined) data.role = dto.role as AdminRole;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.password !== undefined) {
      data.passwordHash = await this.authService.hashPassword(dto.password);
    }

    const admin = await this.prisma.admin.update({
      where: { id },
      data,
      select: SAFE_ADMIN_SELECT,
    });

    await this.auditService.log({
      adminId: updatedByAdminId,
      action: 'ADMIN_UPDATE',
      entityType: 'Admin',
      entityId: id,
      details: { changes: Object.keys(dto) },
    });

    return admin as SafeAdmin;
  }

  async delete(id: string, deletedByAdminId: string): Promise<void> {
    const existing = await this.prisma.admin.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }

    if (id === deletedByAdminId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    await this.prisma.admin.delete({ where: { id } });

    await this.auditService.log({
      adminId: deletedByAdminId,
      action: 'ADMIN_DELETE',
      entityType: 'Admin',
      entityId: id,
      details: { email: existing.email },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.admin.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
