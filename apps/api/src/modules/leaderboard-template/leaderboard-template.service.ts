import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { LeaderboardTemplate } from '@domusbet/database';
import type { UpdateLeaderboardTemplateDto, TextPositionDto } from './dto/leaderboard-template.dto';
import * as path from 'path';
import * as fs from 'fs/promises';
import sharp from 'sharp';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
}

@Injectable()
export class LeaderboardTemplateService {
  private readonly logger = new Logger(LeaderboardTemplateService.name);

  // Directory where uploaded images are stored (relative to CWD of the API process)
  static readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'leaderboard');

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Pick<LeaderboardTemplate, 'id' | 'name' | 'imagePath' | 'positions' | 'isActive' | 'createdAt' | 'updatedAt'>[]> {
    return this.prisma.leaderboardTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        imagePath: true,
        positions: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string): Promise<LeaderboardTemplate> {
    const template = await this.prisma.leaderboardTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException(`Template "${id}" non trovato.`);
    return template;
  }

  async findActive(): Promise<LeaderboardTemplate | null> {
    return this.prisma.leaderboardTemplate.findFirst({
      where: { isActive: true },
    });
  }

  async create(file: Express.Multer.File, name?: string): Promise<LeaderboardTemplate> {
    const relativePath = path.join('uploads', 'leaderboard', file.filename);
    return this.prisma.leaderboardTemplate.create({
      data: {
        name: name ?? file.originalname,
        imagePath: relativePath,
        positions: [],
        isActive: false,
      },
    });
  }

  async update(id: string, dto: UpdateLeaderboardTemplateDto): Promise<LeaderboardTemplate> {
    await this.findOne(id);

    // If activating this template, deactivate all others
    if (dto.isActive === true) {
      await this.prisma.leaderboardTemplate.updateMany({
        where: { id: { not: id } },
        data: { isActive: false },
      });
    }

    return this.prisma.leaderboardTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.positions !== undefined && { positions: dto.positions as object[] }),
      },
    });
  }

  async delete(id: string) {
    const template = await this.findOne(id);

    // Delete the image file from disk
    try {
      const absPath = path.join(process.cwd(), template.imagePath);
      await fs.unlink(absPath);
    } catch {
      this.logger.warn({ id }, 'Could not delete image file for template');
    }

    await this.prisma.leaderboardTemplate.delete({ where: { id } });
  }

  // ─── Image generation ────────────────────────────────────────────────────────

  async generateImageForTemplate(
    template: { imagePath: string; positions: unknown },
    entries: LeaderboardEntry[],
  ): Promise<Buffer | null> {
    const positions = template.positions as TextPositionDto[];
    if (!positions.length) return null;

    const absImagePath = path.join(process.cwd(), template.imagePath);

    try {
      await fs.access(absImagePath);
    } catch {
      this.logger.error({ path: absImagePath }, 'Template image file not found');
      return null;
    }

    try {
      const baseImage = sharp(absImagePath as string);
      const metadata = await baseImage.metadata();
      const width = metadata.width ?? 800;
      const height = metadata.height ?? 600;

      const svgParts = positions.map((pos) => {
        const entry = entries.find((e) => e.rank === pos.rank);
        if (!entry) return '';

        const text = escapeXml(entry.name);
        const anchor =
          pos.align === 'center' ? 'middle' : pos.align === 'right' ? 'end' : 'start';
        const weight = pos.bold ? 'bold' : 'normal';

        return `<text
          x="${pos.x}"
          y="${pos.y}"
          font-size="${pos.fontSize}px"
          fill="${pos.color}"
          text-anchor="${anchor}"
          font-weight="${weight}"
          font-family="DejaVu Sans, Arial, sans-serif"
          dominant-baseline="middle"
        >${text}</text>`;
      });

      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgParts.join('\n')}
      </svg>`;

      const buffer = await baseImage
        .composite([{ input: Buffer.from(svg), blend: 'over' }])
        .png()
        .toBuffer();

      return buffer;
    } catch (err) {
      this.logger.error({ err }, 'Failed to generate leaderboard image');
      return null;
    }
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
