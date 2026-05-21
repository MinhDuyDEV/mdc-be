import { type ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost) {
		const client = host.switchToWs().getClient<Socket>();

		// Convert HttpException to WsException (ValidationPipe throws HttpException)
		if (exception instanceof HttpException) {
			const response = exception.getResponse();
			const message =
				typeof response === "string"
					? response
					: (response as { message?: string }).message || "Validation failed";

			client.emit("exception", {
				status: "error",
				message,
				code: exception.getStatus(),
			});
			return;
		}

		// Handle WsException
		if (exception instanceof WsException) {
			const error = exception.getError();
			client.emit("exception", {
				status: "error",
				message:
					typeof error === "string"
						? error
						: (error as { message?: string }).message,
				code:
					typeof error === "string"
						? error
						: (error as { code?: string | number }).code,
			});
			return;
		}

		// Fallback for unknown errors
		super.catch(exception, host);
	}
}
