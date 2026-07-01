import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/types/permission.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/types/role.enum';
import { CurrentTenant } from '../tenancy/decorators/current-tenant.decorator';
import { CoursesService } from './courses.service';
import { CourseResponseDto } from './dto/course-response.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('Courses')
@ApiBearerAuth()
@Controller({ path: 'courses', version: '1' })
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.COURSE_READ)
  @ApiOperation({ summary: 'Liste paginée des courses du groupement courant' })
  async findAll(@CurrentTenant() groupementId: string, @Query() query: ListCoursesQueryDto) {
    const result = await this.coursesService.findAll(groupementId, {
      clientId: query.clientId,
      driverId: query.driverId,
      limit: query.limit,
      page: query.page,
      startedFrom: query.startedFrom,
      startedTo: query.startedTo,
      status: query.status,
    });

    return {
      data: result.data,
      meta: {
        hasNextPage: query.page * query.limit < result.total,
        hasPreviousPage: query.page > 1,
        limit: query.limit,
        page: query.page,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.COURSE_READ)
  @ApiOkResponse({ type: CourseResponseDto })
  @ApiOperation({ summary: "Détail d'une course" })
  findOne(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourseResponseDto> {
    return this.coursesService.findOne(id, groupementId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.COURSE_CREATE)
  @ApiCreatedResponse({ type: CourseResponseDto })
  @ApiOperation({ summary: 'Saisir manuellement une course' })
  create(
    @CurrentTenant() groupementId: string,
    @Body() dto: CreateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.create(groupementId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.COURSE_UPDATE)
  @ApiOkResponse({ type: CourseResponseDto })
  @ApiOperation({ summary: 'Corriger une course saisie manuellement' })
  update(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.update(id, groupementId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @Permissions(Permission.COURSE_DELETE)
  @ApiOkResponse({ type: CourseResponseDto })
  @ApiOperation({ summary: 'Supprimer une course saisie par erreur' })
  delete(
    @CurrentTenant() groupementId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CourseResponseDto> {
    return this.coursesService.delete(id, groupementId);
  }
}
