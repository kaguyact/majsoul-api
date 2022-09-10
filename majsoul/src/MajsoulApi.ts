import fetch from "node-fetch";
import { Root } from "protobufjs";
import { from, interval, merge, Observable, of, using } from "rxjs";
import { catchError, filter, map, mergeAll, timeout } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";

import { Codec } from "./Codec";
import { Connection } from "./Connection";
import { RpcImplementation } from "./RpcImplementation";
import { RpcService } from "./Service";
import { ApiResources } from "./types/ApiResources";
import { Contest } from "./types/Contest";
import { MessageType } from "./types/enums/MessageType";
import { PlayerZone } from "./types/enums/PlayerZone";
import { GameRecord } from "./types/GameRecord";
import type { lq } from "./types/liqi";
import { Passport } from "./types/Passport";
import { Player } from "./types/Player";

export class MajsoulApi {
	private static async getRes<T>(path: string): Promise<T> {
		return (await fetch(path)).json() as Promise<T>;
	}

	public static async retrieveApiResources(): Promise<ApiResources> {
		const majsoulUrl = "https://mahjongsoul.game.yo-star.com/";
		const versionInfo = await MajsoulApi.getRes<any>(majsoulUrl + "version.json?randv=" + Math.random().toString().slice(2));
		const resInfo = await MajsoulApi.getRes<any>(majsoulUrl + `resversion${versionInfo.version}.json`);
		const pbVersion = resInfo.res["res/proto/liqi.json"].prefix;
		const pbDef = await MajsoulApi.getRes<any>(majsoulUrl + `${pbVersion}/res/proto/liqi.json`);
		const config = await MajsoulApi.getRes<any>(majsoulUrl + `${resInfo.res["config.json"].prefix}/config.json`);
		const ipDef = config.ip.filter((x) => x.name === "player")[0];
		const serverListUrl = (ipDef.region_urls.mainland
			|| ipDef.region_urls[0].url) + "?service=ws-gateway&protocol=ws&ssl=true";
		const serverList = await MajsoulApi.getRes<any>(serverListUrl);
		if (serverList.maintenance) {
			console.log("Maintenance in progress");
			return;
		}
		return {
			version: versionInfo.version,
			pbVersion,
			serverList: serverList,
			protobufDefinition: pbDef
		};
	}

	private readonly contestSystemMessagesSubscriptions: Record<number, number> = {};
	private readonly protobufRoot: Root;
	private readonly connection: Connection;
	private readonly rpc: RpcImplementation;
	private readonly lobbyService: RpcService;
	private readonly codec: Codec;
	private readonly clientVersion: string;
	public readonly notifications: Observable<any>;

	constructor(private readonly apiResources: ApiResources) {
		this.protobufRoot = Root.fromJSON(apiResources.protobufDefinition);
		this.clientVersion = `web-${apiResources.version.slice(0, -2)}`;
		console.log(`Client version: [${this.clientVersion}]`);
		this.codec = new Codec(this.protobufRoot);
		const serverIndex = Math.floor(Math.random() * apiResources.serverList.servers.length);
		this.connection = new Connection(`wss://${apiResources.serverList.servers[serverIndex]}`);
		this.notifications = this.connection.messages.pipe(filter(message => message.type === MessageType.Notification), map(message => this.codec.decode(message.data)));
		this.rpc = new RpcImplementation(this.connection, this.protobufRoot);
		this.lobbyService = this.rpc.getService("Lobby");
	}

	public static getPlayerZone(playerId: number): PlayerZone {
		if (isNaN(playerId)) {
			return PlayerZone.Unknown;
		}

		const regionBits = playerId >> 23;

		if (regionBits >= 0 && regionBits <= 6) {
			return PlayerZone.China;
		}

		if (regionBits >= 7 && regionBits <= 12) {
			return PlayerZone.Japan;
		}

		if (regionBits >= 13 && regionBits <= 15) {
			return PlayerZone.Other;
		}

		return PlayerZone.Unknown;
	}

	public get errors$(): Observable<any> {
		return merge(
			this.connection.errors$,
			interval(1000 * 60).pipe(
				map((number) => from(this.lobbyService.rpcCall<lq.ReqHeatBeat>("heatbeat", {
					no_operation_counter: number,
				})).pipe(
					timeout(3000),
					filter(() => false),
					catchError(() => of("heartbeat failed")),
				)),
				mergeAll(),
			)
		);
	}

	public get majsoulCodec(): Codec {
		return this.codec;
	}

	public async init(): Promise<void> {
		await this.connection.init();
		// this.lobbyService.rpcCall
	}

	public async logIn(passport: Passport): Promise<void> {
		const type = 8;

		const respOauth2Auth = await this.lobbyService.rpcCall<lq.IReqOauth2Auth, lq.IResOauth2Auth>("oauth2Auth", {
			type,
			code: passport.accessToken,
			uid: passport.uid,
			client_version_string: this.clientVersion
		});

		const reqOauth2Check: lq.IReqOauth2Check = {
			type,
			access_token: respOauth2Auth.access_token
		};

		let respOauth2Check = await this.lobbyService.rpcCall<lq.IReqOauth2Check, lq.IResOauth2Check>("oauth2Check", reqOauth2Check);
		if (!respOauth2Check.has_account) {
			await new Promise((res) => setTimeout(res, 2000));
			respOauth2Check = await this.lobbyService.rpcCall("oauth2Check", reqOauth2Check);
		}

		const respOauth2Login = await this.lobbyService.rpcCall< lq.IReqOauth2Login,  lq.IResLogin>(
			"oauth2Login",
			{
				type,
				currency_platforms: [ 2, 9 ],
				access_token: respOauth2Auth.access_token,
				reconnect: false,
				device: {
					platform: "pc",
					hardware: "pc",
					os: "windows",
					os_version: "win10",
					is_browser: true,
					software: "Chrome",
					sale_platform: "web"
				},
				random_key: uuidv4(),
				client_version: { resource: this.apiResources.version },
				client_version_string: this.clientVersion
			}
		);

		if (!respOauth2Login.account) {
			throw Error("Couldn't log in to user id");
		}
		console.log(`Logged in as ${respOauth2Login.account.nickname} account id ${respOauth2Login.account_id}`);
		console.log("Connection ready");
	}

	public async findContestByContestId(id: number): Promise<Contest> {
		const resp = await this.lobbyService.rpcCall<lq.IReqFetchCustomizedContestByContestId, lq.IResFetchCustomizedContestByContestId>(
			"fetchCustomizedContestByContestId",
			{
				contest_id: id,
			}
		);

		if (!resp.contest_info) {
			return null;
		}

		return {
			majsoulId: resp.contest_info.unique_id,
			majsoulFriendlyId: resp.contest_info.contest_id,
			name: resp.contest_info.contest_name,
			createdTime: resp.contest_info.create_time * 1000,
			startTime: resp.contest_info.start_time * 1000,
			finishTime: resp.contest_info.finish_time * 1000,
		};
	}

	public async getContestGamesIds(id: number): Promise<{
		majsoulId: string;
	}[]> {
		let nextIndex = undefined;
		const idLog = {};
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const resp = await this.lobbyService.rpcCall<lq.IReqFetchCustomizedContestGameRecords, lq.IResFetchCustomizedContestGameRecords>(
				"fetchCustomizedContestGameRecords",
				{
					unique_id: id,
					last_index: nextIndex,
				}
			);
			for (const game of resp.record_list) {
				idLog[game.uuid] = true;
			}
			if (!resp.next_index || !resp.record_list.length) {
				break;
			}
			nextIndex = resp.next_index;
		}
		return Object.keys(idLog).map(id => { return { majsoulId: id }; }).reverse();
	}

	public subscribeToContestChatSystemMessages(id: number): Observable<any> {
		console.log("subscribeToContestChatSystemMessages", id);
		return using(
			() => ({
				unsubscribe: () => {
					this.contestSystemMessagesSubscriptions[id]--;
					if (this.contestSystemMessagesSubscriptions[id] > 0) {
						return;
					}

					delete this.contestSystemMessagesSubscriptions[id];
					this.lobbyService.rpcCall("leaveCustomizedContestChatRoom", {});
					for (const id of Object.keys(this.contestSystemMessagesSubscriptions)) {
						this.lobbyService.rpcCall<lq.IReqJoinCustomizedContestChatRoom>(
							"joinCustomizedContestChatRoom",
							{ unique_id: parseInt(id) }
						);
					}
				}
			}),
			() => {
				if (this.contestSystemMessagesSubscriptions[id] == null) {
					this.contestSystemMessagesSubscriptions[id] = 1;
					this.lobbyService.rpcCall<lq.IReqJoinCustomizedContestChatRoom>(
						"joinCustomizedContestChatRoom",
						{ unique_id: id }
					).then((resp) => {
						console.log(`tracking room '${id}'`, resp);
					});
				} else {
					this.contestSystemMessagesSubscriptions[id]++;
				}

				return this.notifications.pipe(
					filter(
						message => message.unique_id === id
						// && message.constructor.name === "NotifyCustomContestSystemMsg"
					)
				);
			}
		);
	}

	public async findPlayerByFriendlyId(majsoulFriendlyId: number): Promise<Player> {
		try {
			const resp = (await this.lobbyService.rpcCall<lq.IReqSearchAccountByPattern, lq.IResSearchAccountByPattern>(
				"searchAccountByPattern",
				{ pattern: majsoulFriendlyId.toString() }
			));
			if (!resp.decode_id) {
				return null;
			}

			const [player] = (await this.lobbyService.rpcCall<lq.IReqMultiAccountId, lq.IResMultiAccountBrief>(
				"fetchMultiAccountBrief",
				{ account_id_list: [resp.decode_id] }
			)).players;
			return {
				majsoulId: player.account_id,
				nickname: player.nickname
			};
		} catch (e) {
			console.log(e);
			return null;
		}
	}

	public async getGame(id: string): Promise<GameRecord> {
		let resp: lq.IResGameRecord;
		try {
			resp = (await this.lobbyService.rpcCall<lq.IReqGameRecord, lq.IResGameRecord>(
				"fetchGameRecord",
				{ game_uuid: id, client_version_string: this.clientVersion }
			));
			const details = this.codec.decode<lq.IGameDetailRecords>(resp.data as Buffer);

			return {
				...resp,
				records: (
					details.records.length > 0
						? details.records
						: (details.actions
							.filter(action => action.type === 1)
							.map(action => action.result))
				).map(item => this.codec.decode(item as Buffer))
			};
		}
		catch (e) {
			console.log(`Couldn't find game ${id}`);
			console.log(resp);
			return null;
		}
	}

	public dispose() {
		this.connection.close();
	}
}
