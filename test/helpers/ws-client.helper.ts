import type { INestApplication } from "@nestjs/common";
import { io, type Socket } from "socket.io-client";

export const getWsClient = (
	app: INestApplication,
	namespace = "",
	token?: string,
): Socket => {
	const httpServer = app.getHttpServer();
	if (!httpServer.address()) {
		httpServer.listen(0);
	}
	const address = httpServer.address();
	const url = `http://127.0.0.1:${(address as { port: number }).port}${namespace}`;
	return io(url, {
		auth: token ? { token } : undefined,
		transports: ["websocket"],
		autoConnect: false,
	});
};

export const waitForEvent = <T>(
	socket: Socket,
	event: string,
	timeoutMs = 2000,
): Promise<T> => {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Timeout waiting for ${event}`)),
			timeoutMs,
		);
		socket.once(event, (data: T) => {
			clearTimeout(timer);
			resolve(data);
		});
	});
};
