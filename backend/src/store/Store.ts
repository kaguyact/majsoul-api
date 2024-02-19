import { ChangeStream, ChangeStreamDocument, Collection, MongoClient, ObjectId } from "mongodb";
import { Observable, Subject } from "rxjs";

import { Config } from "./types/Config";
import { Contest } from "./types/contest/Contest";
import { Session } from "./types/contest/Session";
import { latestGameResultVersion } from "./types/enums/GameResultVersion";
import { GachaPull } from "./types/gacha/GachaPull";
import { GameCorrection } from "./types/game/GameCorrection";
import { GameResult } from "./types/game/GameResult";
import { Player } from "./types/Player";
import { SmokinSexyStyle } from "./types/SmokinSexyStyle";
import { User } from "./types/User";

interface Migration {
	perform(store: Store): Promise<void>;
}

const migrations: Migration[] = [];
export class Store {
	public contestCollection: Collection<Contest<ObjectId>>;
	public gamesCollection: Collection<GameResult<ObjectId>>;
	public gameCorrectionsCollection: Collection<GameCorrection<ObjectId>>;
	public sessionsCollection: Collection<Session<ObjectId>>;
	public playersCollection: Collection<Player<ObjectId>>;
	public configCollection: Collection<Config<ObjectId>>;
	public userCollection: Collection<User<ObjectId>>;
	public gachaCollection: Collection<GachaPull<ObjectId>>;
	public smokingSexyStyleCollection: Collection<SmokinSexyStyle<ObjectId>>;

	private readonly contestChangesSubject = new Subject<ChangeStreamDocument<Contest<ObjectId>>>();
	private readonly configChangesSubject = new Subject<ChangeStreamDocument<Config<ObjectId>>>();
	private readonly gameChangesSubject = new Subject<ChangeStreamDocument<GameResult<ObjectId>>>();
	private readonly gachaChangesSubject = new Subject<ChangeStreamDocument<GachaPull<ObjectId>>>();
	private readonly playerChangesSubject = new Subject<ChangeStreamDocument<Player<ObjectId>>>();
	private readonly smokingSexyStyleChangesSubject = new Subject<ChangeStreamDocument<SmokinSexyStyle<ObjectId>>>();
	private contestStream: ChangeStream<Contest<ObjectId>>;
	private configStream: ChangeStream<Config<ObjectId>>;
	private gameStream: ChangeStream<GameResult<ObjectId>>;
	private gachaStream: ChangeStream<GachaPull<ObjectId>>;
	private playerStream: ChangeStream<Player<ObjectId>>;
	private smokingSexyStyleStream: ChangeStream<SmokinSexyStyle<ObjectId>>;

	public get ContestChanges(): Observable<ChangeStreamDocument<Contest<ObjectId>>> {
		return this.contestChangesSubject;
	}

	public get ConfigChanges(): Observable<ChangeStreamDocument<Config<ObjectId>>> {
		return this.configChangesSubject;
	}

	public get GameChanges(): Observable<ChangeStreamDocument<GameResult<ObjectId>>> {
		return this.gameChangesSubject;
	}

	public get GachaChanges(): Observable<ChangeStreamDocument<GachaPull<ObjectId>>> {
		return this.gachaChangesSubject;
	}

	public get PlayerChanges(): Observable<ChangeStreamDocument<Player<ObjectId>>> {
		return this.playerChangesSubject;
	}

	public get SmokinSexyStyleChanges(): Observable<ChangeStreamDocument<SmokinSexyStyle<ObjectId>>> {
		return this.smokingSexyStyleChangesSubject;
	}

	public async init(username: string, password: string): Promise<void> {
		const url = `mongodb://${username}:${password}@${process.env.NODE_ENV === "production" ? "majsoul_mongo" : "localhost"}:27017/?authMechanism=SCRAM-SHA-256&authSource=admin&directConnection=true`;
		const client = new MongoClient(url);

		await client.connect();

		console.log("Connected successfully to server");

		const majsoulDb = client.db("majsoul");

		this.contestCollection = await majsoulDb.collection("contests");
		this.gamesCollection = await majsoulDb.collection("games");
		this.gameCorrectionsCollection = await majsoulDb.collection("gameCorrections");
		this.sessionsCollection = await majsoulDb.collection("sessions");
		this.sessionsCollection.createIndex({ scheduledTime: -1 });
		this.playersCollection = await majsoulDb.collection("players");
		this.configCollection = await majsoulDb.collection("config");
		this.gachaCollection = await majsoulDb.collection("gacha");
		this.smokingSexyStyleCollection = await majsoulDb.collection("smokingSexyStyle");

		this.contestStream = this.contestCollection.watch().on("change", change => this.contestChangesSubject.next(change));
		this.configStream = this.configCollection.watch().on("change", change => this.configChangesSubject.next(change));
		this.gameStream = this.gamesCollection.watch().on("change", change => this.gameChangesSubject.next(change));
		this.gachaStream = this.gachaCollection.watch().on("change", change => this.gachaChangesSubject.next(change));
		this.playerStream = this.playersCollection.watch().on("change", change => this.playerChangesSubject.next(change));
		this.smokingSexyStyleStream = this.smokingSexyStyleCollection.watch().on("change", change => this.smokingSexyStyleChangesSubject.next(change));

		if ((await this.configCollection.countDocuments()) < 1) {
			this.configCollection.insertOne({});
		}

		const oauthDb = client.db("oauth");
		this.userCollection = await oauthDb.collection("users", {});
	}

	public async isGameRecorded(majsoulId: string): Promise<boolean> {
		return await this.gamesCollection.countDocuments(
			{
				majsoulId,
				version: {
					$gte: latestGameResultVersion,
				},
				$or: [
					{
						notFoundOnMajsoul: { $exists: true },
					},
					{
						contestMajsoulId: { $exists: true },
					},
				],
			},
			{ limit: 1 },
		) === 1;
	}

	public async recordGame(contestId: ObjectId, gameResult: GameResult): Promise<void> {
		console.log(`Recording game id ${gameResult.majsoulId}`);
		delete gameResult._id;
		const gameRecord: Omit<GameResult<ObjectId>, "_id"> = {
			...gameResult,
			contestId,
			notFoundOnMajsoul: false,
			players: (await Promise.all(gameResult.players
				.map(player =>
					player == null
						? Promise.resolve(null)
						: this.playersCollection.findOneAndUpdate(
							{ majsoulId: player.majsoulId },
							{ $set: { majsoulId: player.majsoulId, nickname: player.nickname } },
							{ upsert: true, returnDocument: "after", projection: { _id: true } },
						),
				),
			)).map(p => p?.value),
		};

		await this.gamesCollection.findOneAndUpdate(
			{
				majsoulId: gameResult.majsoulId,
			},
			{
				$set: {
					...gameRecord,
				},
			},
			{
				upsert: true,
			},
		);
	}

	public async migrate(): Promise<void> {
		for (const migration of migrations) {
			await migration.perform(this);
		}
	}
}
