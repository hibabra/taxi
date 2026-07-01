import type {
  QueueEntry,
  QueueResponse,
} from '@taxikiwi/shared-types';
import type { ApiClient } from './client';

export type { QueueEntry, QueueResponse };

export function getQueue(client: ApiClient) {
  return client.get('queue').json<QueueResponse>();
}

export function joinQueue(client: ApiClient) {
  return client.post('queue/join').json<QueueResponse>();
}

export function leaveQueue(client: ApiClient) {
  return client.delete('queue/leave').json<QueueResponse>();
}

export function repositionFirst(client: ApiClient) {
  return client.post('queue/reposition-first').json<QueueResponse>();
}

export function dequeueFirst(client: ApiClient) {
  return client.post('queue/dequeue').json<string | null>();
}