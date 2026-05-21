import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";

@Injectable()
export class WsJwtGuard implements CanActivate {
	constructor(private readonly jwtService: JwtService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const client = context.switchToWs().getClient<Socket>();
		const token = this.extractToken(client);

		if (!token) {
			throw new WsException("Missing authentication token");
		}

		try {
			const payload = await this.jwtService.verifyAsync<{
				sub: string;
				email: string;
			}>(token);

			// Attach user to socket session
			client.data.user = {
				id: payload.sub,
				email: payload.email,
			};

			return true;
		} catch {
			throw new WsException("Invalid or expired token");
		}
	}

	private extractToken(client: Socket): string | undefined {
		// Prefer handshake.auth.token (recommended by Socket.io)
		return client.handshake.auth?.token ?? client.handshake.query?.token;
	}
}
