import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/geolocation',
})
export class GeolocationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GeolocationGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log({ clientId: client.id }, 'Client connected');
  }

  handleDisconnect(client: Socket): void {
    this.logger.log({ clientId: client.id }, 'Client disconnected');
  }

  @SubscribeMessage('join:groupement')
  handleJoinGroupement(client: Socket, groupementId: string): void {
    client.join(`groupement:${groupementId}`);
    this.logger.log({ clientId: client.id, groupementId }, 'Joined groupement room');
  }

  emitPositionUpdate(
    groupementId: string,
    position: {
      driverId: string;
      latitude: number;
      longitude: number;
      status: string;
      recordedAt: string;
    },
  ): void {
    this.server.to(`groupement:${groupementId}`).emit('position:updated', position);
  }
}
