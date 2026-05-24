import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  type INestApplication,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthGuard } from '../src/auth/auth.guard';
import { CurrentUser } from '../src/common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../src/common/auth/current-user.interface';
import { Public } from '../src/common/auth/public.decorator';
import { extractSocketAuthToken } from '../src/realtime/socket-auth-token';
import { getWsClient } from './helpers/ws-client.helper';

const JWT_SECRET = 'test-access-secret-min-32-chars-long';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  id: 'pref-1',
  userId: 'user-1',
  newMessage: true,
  connectionRequest: true,
  connectionAccepted: true,
  applicationStatusChange: true,
  jobRecommendation: true,
  postInteraction: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const UPDATED_PREFS = {
  ...DEFAULT_PREFS,
  newMessage: false,
  updatedAt: '2025-01-02T00:00:00.000Z',
};

// ─── Test Controllers ────────────────────────────────────────────────────────

@Controller('test-auth')
class TestAuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Public()
  @Get('token')
  @HttpCode(HttpStatus.OK)
  async getToken() {
    const token = await this.jwtService.signAsync({
      sub: 'user-1',
      email: 'test@example.com',
    });
    return { token };
  }
}

@Controller('notifications/preferences')
@UseGuards(AuthGuard)
class TestNotificationPreferenceController {
  @Get()
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return { ...DEFAULT_PREFS, userId: user.id };
  }

  @Put()
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return { ...UPDATED_PREFS, userId: user.id, ...dto };
  }
}

// ─── Test Gateway ────────────────────────────────────────────────────────────

@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
})
class TestRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = extractSocketAuthToken(client);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
      client.data.user = { id: payload.sub, email: payload.email };
      await client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    void client;
    // no-op in test
  }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Realtime & Notifications (e2e)', () => {
  let app: INestApplication<App> | undefined;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({
          global: true,
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [TestAuthController, TestNotificationPreferenceController],
      providers: [TestRealtimeGateway, AuthGuard],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('GET /api/v1/notifications/preferences', () => {
    it('returns 200 with default preferences when authenticated', async () => {
      const tokenRes = await request(app!.getHttpServer())
        .get('/api/v1/test-auth/token')
        .expect(200);
      const token = tokenRes.body.token;

      const response = await request(app!.getHttpServer())
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'pref-1',
        userId: 'user-1',
        newMessage: true,
        connectionRequest: true,
        connectionAccepted: true,
        applicationStatusChange: true,
        jobRecommendation: true,
        postInteraction: true,
      });
    });

    it('returns 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/notifications/preferences')
        .expect(401);
    });
  });

  describe('PUT /api/v1/notifications/preferences', () => {
    it('returns 200 with updated preferences', async () => {
      const tokenRes = await request(app!.getHttpServer())
        .get('/api/v1/test-auth/token')
        .expect(200);
      const token = tokenRes.body.token;

      const response = await request(app!.getHttpServer())
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({ newMessage: false })
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'pref-1',
        userId: 'user-1',
        newMessage: false,
      });
    });
  });

  describe('WebSocket /realtime namespace', () => {
    it('connects to /realtime namespace with valid JWT', (done) => {
      void (async () => {
        const tokenRes = await request(app!.getHttpServer())
          .get('/api/v1/test-auth/token')
          .expect(200);
        const token = tokenRes.body.token;

        const socket = getWsClient(app!, '/realtime', token);

        const timeout = setTimeout(() => {
          socket.disconnect();
          done(new Error('Connection timed out'));
        }, 3000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.disconnect();
          done();
        });

        socket.on('connect_error', (err) => {
          clearTimeout(timeout);
          socket.disconnect();
          done(err);
        });

        socket.connect();
      })();
    });

    it('disconnects client without a valid token', (done) => {
      const socket = getWsClient(app!, '/realtime');

      const timeout = setTimeout(() => {
        socket.disconnect();
        done(new Error('Expected disconnect but timed out'));
      }, 3000);

      socket.on('connect_error', () => {
        clearTimeout(timeout);
        socket.disconnect();
        done();
      });

      socket.on('disconnect', () => {
        clearTimeout(timeout);
        done();
      });

      socket.connect();
    });
  });
});
