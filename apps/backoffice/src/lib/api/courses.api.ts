import type {
  Course,
  CourseStatus,
  CreateCoursePayload,
  PaginatedResponse,
  UpdateCoursePayload,
} from '@taxikiwi/shared-types';

import { compactSearchParams, type ApiClient } from './client';

export function listCourses(
  client: ApiClient,
  params?: {
    clientId?: string;
    driverId?: string;
    limit?: number;
    page?: number;
    startedFrom?: string;
    startedTo?: string;
    status?: CourseStatus;
  },
) {
  return client
    .get('courses', { searchParams: compactSearchParams(params) })
    .json<PaginatedResponse<Course>>();
}

export function getCourse(client: ApiClient, courseId: string) {
  return client.get(`courses/${courseId}`).json<Course>();
}

export function createCourse(client: ApiClient, dto: CreateCoursePayload) {
  return client.post('courses', { json: dto }).json<Course>();
}

export function updateCourse(client: ApiClient, courseId: string, dto: UpdateCoursePayload) {
  return client.patch(`courses/${courseId}`, { json: dto }).json<Course>();
}

export function deleteCourse(client: ApiClient, courseId: string) {
  return client.delete(`courses/${courseId}`).json<Course>();
}
