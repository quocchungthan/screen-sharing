import Ably from "ably";
import { v4 as uuidv4 } from 'uuid';
import { Observable, Subject, SubscriptionLike } from "rxjs";
import { logCBT } from "./logger";

// --- Config ---
const ABLY_API_KEY = "muycWw._2-uwQ:Ss_mzKxyRbWd-YAJlYVu64PJuBHt3Pe9XU9mcLiRAOI";

// --- Create Socket Client ---
const createSocketClient = (clientId: string): ISocketClient => {
	logCBT('Initializing Ably Realtime client', { clientId });

	const ably = new Ably.Realtime({ key: ABLY_API_KEY, clientId });
	const roomId = window.location.pathname.split("/room/")[1] || uuidv4();
	logCBT('Using room ID', { roomId });

	const subjectsMap: { [key: string]: SubscriptionLike } = {};
	const channel: Ably.RealtimeChannel = ably.channels.get(`room-${roomId}`);
	logCBT('Channel initialized', { channelName: `room-${roomId}` });

	const listenToEvent = <TPayload>(channel: Ably.RealtimeChannel, eventName: string) => {
		if (subjectsMap[eventName]) return;

		subjectsMap[eventName] = new Subject<TPayload>();
		channel.subscribe(eventName, (inboundEnvelop: Ably.InboundMessage) => {
			if (inboundEnvelop.clientId === clientId) return;

			logCBT(`Received event '${eventName}'`, inboundEnvelop.data);
			(subjectsMap[eventName] as Subject<TPayload>).next(inboundEnvelop.data as TPayload);
		});

		logCBT(`Subscribed to event '${eventName}'`);
	};

	return {
		emit: <T>(eventName: string, data: T) => {
			logCBT(`Emitting event '${eventName}'`, data);
			channel.publish(eventName, data);
		},
		listen: <T>(eventName: string) => {
			logCBT(`Listening to event '${eventName}'`);
			listenToEvent<T>(channel, eventName);
			return (subjectsMap[eventName] as Subject<T>).asObservable();
		},
		disconnect: () => {
			logCBT('Disconnecting Ably client');
			ably.close();
		},
	};
};

// --- Interface ---
export interface ISocketClient {
	emit<T>(eventName: string, data: T): void;
	listen<T>(eventName: string): Observable<T>;
	disconnect(): void;
}

// --- Export Instance ---
export const clientId = uuidv4();
logCBT('Generated client ID', { clientId });

export const socketClient = createSocketClient(clientId);
