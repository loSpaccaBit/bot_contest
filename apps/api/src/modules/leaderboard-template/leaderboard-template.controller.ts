import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { LeaderboardTemplateService } from './leaderboard-template.service';
import { UpdateLeaderboardTemplateDto } from './dto/leaderboard-template.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { LeaderboardService } from '../leaderboard/leaderboard.service';

const multerOptions = {
  storage: diskStorage({
    destination: LeaderboardTemplateService.UPLOAD_DIR,
    filename: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, name: string) => void) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `leaderboard${unique}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, accept: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new BadRequestException('Solo file immagine sono accettati'), false);
    } else {
      cb(null, true);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
};

@Controller('leaderboard/template')
export class LeaderboardTemplateController {
  constructor(
    private readonly templateService: LeaderboardTemplateService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Get()
  @Roles('VIEWER')
  findAll(): Promise<unknown[]> {
    return this.templateService.findAll();
  }

  @Get(':id')
  @Roles('VIEWER')
  findOne(@Param('id') id: string): Promise<unknown> {
    return this.templateService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('image', multerOptions))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Query('name') name?: string,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException('Immagine obbligatoria');
    return this.templateService.create(file, name);
  }

  @Put(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateLeaderboardTemplateDto): Promise<unknown> {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Param('id') id: string) {
    await this.templateService.delete(id);
    return { ok: true };
  }

  /**
   * Generate the leaderboard image with current ranking data and return it
   * as a downloadable PNG. Used for both preview and final download.
   */
  @Get(':id/download')
  @Roles('VIEWER')
  async download(@Param('id') id: string, @Res() res: Response) {
    const template = await this.templateService.findOne(id);

    const leaderboard = await this.leaderboardService.getLeaderboard({ limit: 20 });
    const entries = leaderboard.items.map((e) => ({
      rank: e.rank,
      name: e.firstName ?? e.telegramUsername ?? `Utente ${e.rank}`,
      points: e.totalPoints,
    }));

    const buffer = await this.templateService.generateImageForTemplate(template, entries);

    if (!buffer) {
      throw new BadRequestException(
        "Impossibile generare l'immagine. Verifica che il file sia presente e le posizioni siano configurate.",
      );
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="classifica-${Date.now()}.png"`);
    res.send(buffer);
  }
}
