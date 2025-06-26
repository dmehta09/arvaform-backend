import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { IsString } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt.guard';

// WebSocket Event DTOs with validation
class JoinRoomDto {
  @IsString()
  formId: string;
}

class LeaveRoomDto {
  @IsString()
  formId: string;
}

// WebSocket Event Interfaces for TypeScript strict typing
interface SubmissionEventData {
  formId: string;
  submissionId: string;
  submission: Record<string, unknown>;
  timestamp: Date;
  userId: string;
  username: string;
}

interface AnalyticsUpdateData {
  formId: string;
  metrics: {
    totalSubmissions: number;
    todaySubmissions: number;
    completionRate: number;
    lastSubmissionAt: Date;
  };
}

interface UserActivityData {
  formId: string;
  userId: string;
  username: string;
  action: 'joined' | 'left';
  timestamp: Date;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/real-time',
})
export class RealTimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealTimeGateway.name);
  private readonly connectedUsers = new Map<
    string,
    { userId: string; username: string; formIds: Set<string> }
  >();

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Set up heartbeat mechanism for connection reliability
    const interval = setInterval(() => {
      server.emit('ping');
    }, 30000); // Ping every 30 seconds

    server.on('close', () => {
      clearInterval(interval);
    });
  }

  handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connecting: ${client.id}`);

      // Extract JWT token from handshake auth
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} attempted connection without token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // TODO: Validate JWT token and extract user info
      // For now, we'll use a mock user - this should be replaced with actual JWT validation
      const user = {
        id: 'user-' + Math.random().toString(36).substr(2, 9),
        email: 'user@example.com',
        name: client.handshake.auth.username || 'Anonymous User',
      };

      // Store user connection data
      this.connectedUsers.set(client.id, {
        userId: user.id,
        username: user.name,
        formIds: new Set(),
      });

      client.emit('connected', {
        message: 'Connected to real-time notifications',
        userId: user.id,
        username: user.name,
      });

      this.logger.log(`Client ${client.id} connected as ${user.name}`);
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userData = this.connectedUsers.get(client.id);

    if (userData) {
      // Leave all form rooms
      userData.formIds.forEach(formId => {
        this.handleLeaveFormRoom(client, { formId }, false);
      });

      this.connectedUsers.delete(client.id);
      this.logger.log(`Client ${client.id} (${userData.username}) disconnected`);
    } else {
      this.logger.log(`Client ${client.id} disconnected`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('join-form-room')
  async handleJoinFormRoom(@ConnectedSocket() client: Socket, @MessageBody() data: JoinRoomDto) {
    try {
      const userData = this.connectedUsers.get(client.id);
      if (!userData) {
        client.emit('error', { message: 'User data not found' });
        return;
      }

      const roomName = `form-${data.formId}`;

      // Join the room
      await client.join(roomName);
      userData.formIds.add(data.formId);

      // Emit user joined event to other users in the room
      const userActivity: UserActivityData = {
        formId: data.formId,
        userId: userData.userId,
        username: userData.username,
        action: 'joined',
        timestamp: new Date(),
      };

      client.to(roomName).emit('user-activity', userActivity);

      // Send confirmation to the joining user
      client.emit('joined-form-room', {
        formId: data.formId,
        message: `Joined real-time updates for form ${data.formId}`,
      });

      this.logger.log(`User ${userData.username} joined form room: ${data.formId}`);
    } catch (error) {
      this.logger.error(`Error joining form room:`, error);
      client.emit('error', { message: 'Failed to join form room' });
    }
  }

  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('leave-form-room')
  async handleLeaveFormRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveRoomDto,
    emitActivity: boolean = true,
  ) {
    try {
      const userData = this.connectedUsers.get(client.id);
      if (!userData) return;

      const roomName = `form-${data.formId}`;

      // Leave the room
      await client.leave(roomName);
      userData.formIds.delete(data.formId);

      if (emitActivity) {
        // Emit user left event to other users in the room
        const userActivity: UserActivityData = {
          formId: data.formId,
          userId: userData.userId,
          username: userData.username,
          action: 'left',
          timestamp: new Date(),
        };

        client.to(roomName).emit('user-activity', userActivity);

        // Send confirmation to the leaving user
        client.emit('left-form-room', {
          formId: data.formId,
          message: `Left real-time updates for form ${data.formId}`,
        });
      }

      this.logger.log(`User ${userData.username} left form room: ${data.formId}`);
    } catch (error) {
      this.logger.error(`Error leaving form room:`, error);
      client.emit('error', { message: 'Failed to leave form room' });
    }
  }

  @SubscribeMessage('pong')
  handlePong(@ConnectedSocket() client: Socket) {
    // Handle heartbeat response
    const userData = this.connectedUsers.get(client.id);
    if (userData) {
      this.logger.debug(`Heartbeat received from ${userData.username}`);
    }
  }

  // Public methods for other services to emit events

  /**
   * Emit new submission event to all users in the form room
   */
  emitNewSubmission(data: SubmissionEventData) {
    const roomName = `form-${data.formId}`;
    this.server.to(roomName).emit('submission:new', data);
    this.logger.log(`Emitted new submission event for form ${data.formId}`);
  }

  /**
   * Emit submission update event to all users in the form room
   */
  emitSubmissionUpdate(formId: string, submissionId: string, status: string) {
    const roomName = `form-${formId}`;
    const data = {
      formId,
      submissionId,
      status,
      timestamp: new Date(),
    };
    this.server.to(roomName).emit('submission:updated', data);
    this.logger.log(`Emitted submission update event for form ${formId}`);
  }

  /**
   * Emit analytics update event to all users in the form room
   */
  emitAnalyticsUpdate(data: AnalyticsUpdateData) {
    const roomName = `form-${data.formId}`;
    this.server.to(roomName).emit('analytics:updated', data);
    this.logger.log(`Emitted analytics update event for form ${data.formId}`);
  }

  /**
   * Get connected users count for a specific form
   */
  getConnectedUsersCount(formId: string): number {
    const roomName = `form-${formId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Get list of connected users for a specific form
   */
  getConnectedUsers(formId: string): Array<{ userId: string; username: string }> {
    const roomName = `form-${formId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    const users: Array<{ userId: string; username: string }> = [];

    if (room) {
      room.forEach(socketId => {
        const userData = this.connectedUsers.get(socketId);
        if (userData) {
          users.push({
            userId: userData.userId,
            username: userData.username,
          });
        }
      });
    }

    return users;
  }
}
