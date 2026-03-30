import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import type { SystemSetting } from '@domusbet/database';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(): Promise<SystemSetting[]> {
    return this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async findByKey(key: string): Promise<SystemSetting> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }
    return setting;
  }

  /**
   * Get a setting and parse it according to its type.
   * Returns null if setting doesn't exist.
   */
  async getTypedValue<T>(key: string): Promise<T | null> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) return null;

    return this.parseValue<T>(setting.value, setting.type);
  }

  private parseValue<T>(value: string, type: string): T {
    switch (type) {
      case 'boolean':
        return (value.toLowerCase() === 'true') as unknown as T;
      case 'number':
        return Number(value) as unknown as T;
      case 'json':
        try {
          return JSON.parse(value) as T;
        } catch {
          this.logger.warn(`Failed to parse JSON setting value: ${value}`);
          return value as unknown as T;
        }
      case 'string':
      default:
        return value as unknown as T;
    }
  }

  async update(key: string, dto: UpdateSettingDto, adminId?: string): Promise<SystemSetting> {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }

    const setting = await this.prisma.systemSetting.update({
      where: { key },
      data: { value: dto.value },
    });

    if (adminId) {
      await this.auditService.log({
        adminId,
        action: 'SETTING_UPDATE',
        entityType: 'SystemSetting',
        entityId: key,
        details: {
          key,
          previousValue: existing.value,
          newValue: dto.value,
        },
      });
    }

    this.logger.log(`Setting "${key}" updated`);

    return setting;
  }

  async bulkGet(keys: string[]): Promise<Record<string, string>> {
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });

    return settings.reduce(
      (acc, s) => {
        acc[s.key] = s.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  }
}
