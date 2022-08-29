import * as express from 'express';
import * as store from '../../../store';
import { GameResult, Session, ContestPlayer, Phase, PhaseMetadata, LeaguePhase, PlayerTourneyStandingInformation, YakumanInformation, TourneyPhase, PlayerRankingType, PlayerScoreTypeRanking, PlayerTeamRanking, SharedGroupRankingData, TourneyContestScoringDetailsWithId, PlayerInformation, EliminationLevel, EliminationMatchDetails } from '../../types/types';
import { ObjectId, FilterQuery, Condition, FindOneOptions, ObjectID } from 'mongodb';
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { body, matchedData, oneOf, param, query, validationResult } from 'express-validator';
import {  Rest, Store } from '../../..';
import { latestStatsVersion, StatsVersion } from '../../types/stats/StatsVersion';
import { Stats } from '../../types/stats';
import { collectStats } from '../../stats/collectStats';
import { mergeStats } from '../../stats/mergeStats';
import { logError } from '../../utils/logError';
import { withData } from '../../utils/withData';
import { minimumVersion } from '../../stats/minimumVersion';
import { escapeRegexp } from '../../utils/escapeRegexp';
import { AgariInfo, buildContestPhases, ContestPhaseTransition, ContestType, GachaGroup, GachaPull, GameCorrection, isAgariYakuman, TourneyContestScoringType, TourneyScoringInfoPart, TourneyScoringTypeDetails } from '../../../store';
import { Route } from '../Route';
import { RouteState } from '../RouteState';

const sakiTeams: Record<string, Record<string, string[]>> = {
	"236728": {
		"Achiga": [
			"可愛い_Agro",
			"spinach",
			"kfarwell",
			"6k5e",
			"nyagger",
			"Nekovic",
			"dumbanon",
			"YAM",
			"Sanyap",
			"Fenryl",
			"Geh",
			"dorksport",
			"ワハハ",
			"fhum",
			"Bazuso",
			"Obskiur",
			"sand_witch",
			"mottwww",
			"Inspecta",
		],

		"Shiraitodai": [
			"amegumo",
			"Kingdomfreak",
			"michaelao",
			"BULKVANDERHUGE",
			"Zeon_Ace",
			"Rimu",
			"Betty",
			"Hambo",
			"RisingBob",
			"Fire",
			"Barranco",
			"Tilemagician",
			"Honhon",
			"lain",
			"S496",
			"UncleMoton",
			"ZZZ",
			"(((caillou)))",
		],

		"Senriyama": [
			"Meido",
			"Kress",
			"Maria33",
			"guano",
			"hierarch",
			"Sjaalman",
			"lunaslicethm",
			"BOOMER",
			"PagatUltimo",
			"ExelionBuster",
			"Soupman",
			"TanyaoGOD",
			"24601",
			"Gorona",
			"Resko",
			"NullProphet",
			"RipVanWenkle",
			"BKot23",
		],

		"Shindouji": [
			"Sticky",
			"生意気な猫",
			"bob1444",
			"cecily",
			"MayoGirl",
			"Waifu",
			"Whaler",
			"Elahrairah",
			"saiai",
			"rigged",
			"Kirk",
			"aruchomu",
			"Boots",
			"SparrowSkull",
			"CrazyWafel",
			"peepeemonster",
			"FurudoErika",
			"philzin",
			"YOUMU!!",
		],

		"Kiyosumi": [
			"Patriarkatet",
			"snacks",
			"kfarwell",
			"Zeon_Ace",
			"S496",
			"Nekovic",
			"lunaslicethm",
			"Hambo",
			"RisingBob",
			"Fire",
			"rigged",
			"ExelionBuster",
			"Fenryl",
			"Resko",
			"SparrowSkull",
			"Obskiur",
			"sand_witch",
			"BKot23",
		],

		"Eisui": [
			"Kingdomfreak",
			"可愛い_Agro",
			"michaelao",
			"NullProphet",
			"nyagger",
			"Betty",
			"hierarch",
			"YAM",
			"PagatUltimo",
			"Sanyap",
			"Barranco",
			"Gorona",
			"ワハハ",
			"fhum",
			"Bazuso",
			"dorksport",
			"RipVanWenkle",
			"mottwww",
			"Inspecta",
			"YOUMU!!",
		],

		"Miyamori": [
			"Sticky",
			"生意気な猫",
			"6k5e",
			"bob1444",
			"Maria33",
			"MayoGirl",
			"dumbanon",
			"Whaler",
			"Elahrairah",
			"saiai",
			"Kirk",
			"TanyaoGOD",
			"Boots",
			"Honhon",
			"lain",
			"peepeemonster",
			"ZZZ",
			"philzin",
		],

		"Himematsu": [
			"spinach",
			"BULKVANDERHUGE",
			"Kress",
			"Rimu",
			"cecily",
			"guano",
			"Sjaalman",
			"Waifu",
			"BOOMER",
			"Soupman",
			"aruchomu",
			"Geh",
			"Tilemagician",
			"CrazyWafel",
			"24601",
			"UncleMoton",
			"FurudoErika",
			"(((caillou)))",
		]
	},
	"635236": {
		"Ryuumonbuchi": [
			"hierarch",
			"spinach",
			"michaelao",
			"BULKVANDERHUGE",
			"Obskiur",
			"Seanchovy",
			"Sticky",
			"XSA",
			"cecily",
			"kodomo",
			"Watapon",
			"crackhead",
			"guano",
			"quququququ",
			"Bodhi",
			"dorksport",
		],
		"Kiyosumi": [
			"Patriarkatet",
			"amegumo",
			"Fire",
			"snacks",
			"ChickenDinner",
			"Meido",
			"Toraaa",
			"bakasenpai",
			"Kirk",
			"socculta",
			"ZZZ",
			"Zeon_Ace",
			"Soupman",
			"NullProphet",
			"B_Reveler",
			"Raivoli",
			"rigged",
		],
		"Kazekoshi": [
			"生意気な猫",
			"RisingBob",
			"UncleMoton",
			"Waifu",
			"6k5e",
			"sand_witch",
			"ChihiroFJ",
			"Bodoque",
			"(((caillou)))",
			"Tarkus",
			"Kingdomfreak",
			"LucMagnus",
			"mottwww",
			"24601",
		],
		"Tsuruga": [
			"Kress",
			"MrPotato",
			"GG_to_all",
			"Garden",
			"UNIVERSE",
			"CrazyWafel",
			"bob1444",
			"Clinton_Emails",
			"Maria33",
			"Nuxoz",
			"FurudoErika",
			"theo",
			"地獄の砂",
			"Meduchi",
			"Gorona",
		]
	}
}

const nameofFactory = <T>() => (name: keyof T) => name;
const nameofContest = nameofFactory<store.Contest<ObjectId>>();
const nameofEliminationBracketSettings = nameofFactory<store.EliminationBracketSettings>();
const nameofNicknameOverrides = nameofFactory<store.Contest['nicknameOverrides'][0]>();
const nameofPlayer = nameofFactory<store.Player<ObjectId>>();
const nameofConfig = nameofFactory<store.Config<ObjectId>>();
const nameofTransition = nameofFactory<store.ContestPhaseTransition<ObjectId>>();
const nameofTeam = nameofFactory<store.ContestTeam<ObjectId>>();
const nameofSession = nameofFactory<store.Session<ObjectId>>();
const nameofGameResult = nameofFactory<store.GameResult<ObjectId>>();
const nameofGameCorrection = nameofFactory<store.GameCorrection<ObjectId>>();
const nameofTourneyScoringType = nameofFactory<store.TourneyScoringInfoPart>();
const nameofTourneyScoringTypeDetails = nameofFactory<store.TourneyScoringInfoPart['typeDetails']>();
const nameofGacha = nameofFactory<store.Contest<ObjectID>['gacha']>();
const nameofGachaGroup = nameofFactory<store.GachaGroup<ObjectID>>();
const nameofGachaCard = nameofFactory<store.GachaCard<ObjectID>>();

const seededPlayerNames: Record<string, string[]> = {
	"236728": [
		"Patriarkatet",
		"snacks",
		"Meido",
		"amegumo",
	]
}

export class ContestRoute extends Route<RouteState> {
	public registerPublicMethods(app: express.Express): express.Express {
		app.get<any, store.Contest<ObjectId>[]>('/contests', (req, res) => {
			this.state.mongoStore.contestCollection
				.find()
				.project({
					majsoulFriendlyId: true,
					name: true,
					displayName: true,
				})
				.toArray()
				.then(contests => res.send(contests))
				.catch(error => res.status(500).send(error));
		});

		app.get<any, store.Contest<ObjectId>>('/contests/featured', logError(async (req, res) => {
			const [config] = await this.state.mongoStore.configCollection.find()
				.project({
					googleRefreshToken: false
				}).limit(1)
				.toArray();
			const query: FilterQuery<store.Contest<ObjectId>> = {};
			if (config.featuredContest != null) {
				query._id = config.featuredContest;
			}

			this.state.mongoStore.contestCollection
				.find(query)
				.sort({ _id: -1 })
				.limit(1)
				.project({
					_id: true
				})
				.toArray()
				.then(contests => res.send(contests[0]))
				.catch(error => res.status(500).send(error));
		}));

		app.get('/contests/:id',
			param("id").isMongoId(),
			withData<{ id: string; }, any, Rest.Contest<ObjectId>>(async (data, req, res) => {
				const contest = await this.state.findContest(data.id);
				if (contest === null) {
					res.status(404).send();
					return;
				}
				const phaseMetadata = await this.state.getPhases(data.id);

				const restContest: Rest.Contest = {
					...contest,
					phases: this.state.createRestPhases(phaseMetadata),
					teams: undefined
				};


				if (contest.teams) {
					const players = await this.state.mongoStore.playersCollection.find({
						_id: {
							$in: contest.teams.reduce((total, next) => (total.push(...next.players.map(player => player._id)), total), [] as ObjectID[])
						}
					}).toArray();

					const namedPlayers = await this.state.namePlayers(players, contest._id, contest);

					const playerMap = namedPlayers.reduce(
						(total, next) => (total[next._id] = next, total),
						{} as Record<string, PlayerInformation>
					);

					restContest.teams = contest.teams.map(team => ({
						...team,
						players: team.players.map(player => playerMap[player._id.toHexString()])
					}));
				}

				res.send(restContest);
			})
		);

		app.get('/contests/:id/images',
			param("id").isMongoId(),
			query("large").isBoolean().optional({ nullable: false }),
			query("teams").optional({ nullable: false }),
			withData<{ id: string; large: "true" | "false"; teams: string; }, any, store.Contest<ObjectId>>(async (data, req, res) => {
				const contest = await this.state.findContest(data.id, {
					projection: {
						[`teams._id`]: true,
						[`teams.image${data.large === "true" ? "Large" : ""}`]: true,
					}
				});

				if (contest === null) {
					res.status(404).send();
					return;
				}

				if (data.teams) {
					const teams = data.teams.split(' ');
					contest.teams = contest.teams.filter(team => teams.find(id => team._id.toHexString() === id));
				}

				res.send(contest);
			})
		);

		app.get('/contests/:id/gacha/:gachaId',
			param("id").isMongoId(),
			param("gachaId").isMongoId(),
			withData<{ id: string; gachaId: string; teams: string; }, any, store.Contest<ObjectId>>(async (data, req, res) => {
				const contest = await this.state.findContest(data.id, {
					projection: {
						gacha: true,
					}
				});

				if (contest === null) {
					res.status(404).send();
					return;
				}

				const cardId = ObjectId.createFromHexString(data.gachaId);

				const card = contest.gacha.groups.map(group => group.cards).flat().find(card => card._id.equals(cardId));
				if (!card) {
					res.status(404).send();
					return;
				}

				res.send(card);
			})
		);


		app.get<any, store.GameResult<ObjectId>>('/games/:id',
			param("id").isMongoId(),
			withData<{ id: string }, any, store.GameResult<ObjectId>>(async (data, req, res) => {
				const gameId = new ObjectId(data.id);
				const games = await this.state.getGames({
					_id: gameId
				});

				if (games.length < 1) {
					res.status(404).send();
					return;
				}
				res.send(games[0]);
			})
		)

		app.get('/contests/:id/pendingGames',
			param("id").isMongoId(),
			withData<{ id: string }, any, store.GameResult<ObjectId>[]>(async (data, req, res) => {
				const games = await this.state.getGames({
					contestId: new ObjectId(data.id),
					notFoundOnMajsoul: { $ne: false },
					contestMajsoulId: { $exists: false }
				});
				res.send(games);
			})
		);

		app.get('/contests/:id/phases',
			param("id").isMongoId(),
			withData<{ id: string }, any, Phase<ObjectId>[]>(async (data, req, res) => {
				const phaseInfo = await this.state.getPhases(data.id);

				if (!phaseInfo.contest) {
					res.sendStatus(404);
					return;
				}

				if (phaseInfo.contest.type === ContestType.League) {
					const phases = await this.state.getLeaguePhaseData(phaseInfo);
					res.send(phases);
					return;
				}

				const phases = await this.state.getTourneyPhaseData(phaseInfo);
				res.send(phases);
			})
		);

		app.get('/contests/:id/phases/active',
			param("id").isMongoId(),
			withData<{ id: string, phaseIndex: string }, any, Phase<ObjectId>>(async (data, req, res) => {
				const phaseInfo = await this.state.getPhases(data.id);

				if (!phaseInfo.contest) {
					res.sendStatus(404);
					return;
				}

				const now = Date.now();

				if (phaseInfo.contest.type === ContestType.League) {
					const phases = await this.state.getLeaguePhaseData(phaseInfo);
					res.send(phases.reverse().find(phase => phase.startTime < now));
					return;
				}

				const phases = await this.state.getTourneyPhaseData(phaseInfo);
				res.send(phases.reverse().find(phase => phase.startTime < now) ?? phases[0]);
			})
		);

		app.get('/contests/:id/phases/:phaseIndex',
			param("id").isMongoId(),
			param("phaseIndex").isInt({ min: 0 }),
			withData<{ id: string, phaseIndex: string }, any, Phase<ObjectId>>(async (data, req, res) => {
				const phaseInfo = await this.state.getPhases(data.id);

				if (!phaseInfo.contest) {
					res.sendStatus(404);
					return;
				}

				const index = parseInt(data.phaseIndex);
				if (index >= phaseInfo.phases.length) {
					res.sendStatus(400);
					return;
				}

				const phases = ((phaseInfo.contest.type === ContestType.League)
					? await this.state.getLeaguePhaseData(phaseInfo)
					: await this.state.getTourneyPhaseData(phaseInfo)) as Phase[];
				res.send(phases.find(phase => phase.index === index));
			})
		);

		app.get('/contests/:id/sessions',
			param("id").isMongoId(),
			withData<{ id: string }, any, Session<ObjectId>[]>(async (data, req, res) => {
				const phaseInfo = await this.state.getPhases(data.id);

				if (!phaseInfo.contest) {
					res.sendStatus(404);
					return;
				}

				const phases = await this.state.getLeaguePhaseData(phaseInfo);
				res.send(phases.reduce((total, next) =>
					total.concat(next.sessions), [])
				);
			})
		);

		app.get('/contests/:id/sessions/active',
			param("id").isMongoId(),
			withData<{ id: string }, any, Session<ObjectId>>(async (data, req, res) => {
				const phaseInfo = await this.state.getPhases(data.id);

				if (!phaseInfo.contest) {
					res.sendStatus(404);
					return;
				}

				const now = Date.now();

				const phases = await this.state.getLeaguePhaseData(phaseInfo);
				res.send(
					phases
						.reduce((total, next) => total.concat(next.sessions), [] as Session<ObjectId>[])
						.filter(session => session.scheduledTime < now)
						.reverse()[0]
				);
			})
		);

		app.get<any, store.Config<ObjectId>>('/config', (req, res) => {
			this.state.mongoStore.configCollection.find()
				.project({
					googleRefreshToken: false
				}).toArray()
				.then((config) => {
					if (config[0] == null) {
						res.sendStatus(404);
						return;
					}
					res.send(config[0]);
				})
				.catch(error => {
					console.log(error);
					res.status(500).send(error)
				});
		});

		app.get<any, GameResult<ObjectId>[]>('/games', async (req, res) => {
			const filter: FilterQuery<store.GameResult<ObjectId>> = {
				$and: [{
					$or: [
						{
							notFoundOnMajsoul: false,
						},
						{
							contestMajsoulId: { $exists: true },
						},
						{
							majsoulId: { $exists: false },
						},
					]
				}]
			};

			const contestIds = (req.query.contests as string)?.split(' ');
			let contestsFilter = null as Store.Contest<ObjectId>[];
			if (contestIds) {
				 contestsFilter = await this.state.mongoStore.contestCollection.find(
					{
						$or: [
							{ majsoulFriendlyId: { $in: contestIds.map(id => parseInt(id)) } },
							{ _id: { $in: contestIds.map(id => ObjectId.isValid(id) ? ObjectId.createFromHexString(id) : null) } },
						]
					},
					{
						projection: {
							_id: true,
							normaliseScores: true,
						}
					}
				).toArray();

				filter.$and.push(
					{
						$or: contestIds.map(string => ({
							contestId: { $in: contestsFilter.map(p => p._id) }
						}))
					}
				);
			}

			const sessionIds = (req.query?.sessions as string)?.split(' ');
			let sessionMap: {
				startSession: store.Session,
				endSession: store.Session
			}[] = [];
			if (sessionIds) {
				const sessions = await this.state.mongoStore.sessionsCollection.find({
					_id: { $in: sessionIds.map(id => new ObjectId(id)) }
				}).toArray();

				const sessionOr = [];
				for (const session of sessions) {
					let [startSession, endSession] = await this.state.mongoStore.sessionsCollection.find(
						{
							contestId: session.contestId,
							scheduledTime: { $gte: session.scheduledTime }
						}
					).sort({ scheduledTime: 1 }).limit(2).toArray();

					sessionMap.push({
						startSession,
						endSession
					});

					const end_time: Condition<number> = {
						$gte: startSession.scheduledTime
					}

					if (endSession != null) {
						end_time.$lt = endSession.scheduledTime;
					}

					sessionOr.push({ end_time });
				}

				filter.$and.push({ $or: sessionOr });
			}

			const cursor = this.state.mongoStore.gamesCollection.find(filter);

			if (!req.query?.stats) {
				cursor.project({
					rounds: false,
				});
			}

			if (req.query?.last) {
				const last = parseInt(req.query.last as string);
				if (last && !isNaN(last)) {
					cursor.sort({ end_time: -1 })
						.limit(Math.min(last, 64));
				}
			} else {
				cursor.limit(64);
			}

			try {
				const games = await this.state.adjustGames(await cursor.toArray(), { contest: contestsFilter?.length === 1 ? contestsFilter[0] : null});
				const playersMap = (await this.state.namePlayers(
					await this.state.mongoStore.playersCollection.find({
						_id: {$in: games.reduce((total, next) => (total.push(...next.players.map(player => player._id)), total), [] as ObjectID[])}
					}).toArray(),
					contestIds?.length ? ObjectId.createFromHexString(contestIds[0]) : null
				)).reduce((total, next) => (total[next._id] = next, total), {} as Record<string, PlayerInformation>);
				const contests = await this.state.mongoStore.contestCollection.find(
					{ majsoulId: { $in: [...new Set(games.map(g => g.contestMajsoulId))] } }
				).toArray();

				res.send(
					games.map(game => ({
						...game,
						sessionId: sessionMap.find((session) =>
							game.end_time >= session.startSession.scheduledTime
							&& (session.endSession == null || game.end_time < session.endSession.scheduledTime)
						)?.startSession?._id,
						players: game.players.map(player => player._id
							? playersMap[player._id.toHexString()] as any
							: {
								nickname: null,
							}
						)
					})).map(game => {
						if (req.query?.stats) {
							(game as any).stats = collectStats(game, minimumVersion(game), game.players.reduce((total, next) => (total[next._id.toHexString()] = true, total), {})).map(stats => stats?.stats);
							delete game.rounds;
						}
						return game;
					})
				);
			} catch (error) {
				console.log(error);
				res.status(500).send(error)
			}
		});

		app.get<any, GameCorrection<ObjectId>[]>('/corrections', async (req, res) => {
			const corrections = await this.state.mongoStore.gameCorrectionsCollection.find({}).toArray();
			res.send(corrections);
		});

		app.get<any, GameResult[]>('/contests/:contestId/players/:playerId/games', async (req, res) => {
			try {
				const contestId = await this.state.contestExists(req.params.contestId);
				if (!contestId) {
					res.sendStatus(404);
					return;
				}

				const games = await this.state.getGames({
					contestId: contestId,
					hidden: { $ne: true },
					$or: [
						{ notFoundOnMajsoul: false },
						{ contestMajsoulId: { $exists: true } },
						{ majsoulId: { $exists: false } },
					],
					"players._id": ObjectId.createFromHexString(req.params.playerId)
				});

				res.send(games.map(game => ({
					...game,
					contestId: contestId
				})));
			} catch (error) {
				console.log(error);
				res.status(500).send(error)
			}
		});

		app.get<any, YakumanInformation[]>('/contests/:contestId/yakuman', async (req, res) => {
			try {
				const contestId = await this.state.contestExists(req.params.contestId);
				if (!contestId) {
					res.sendStatus(404);
					return;
				}

				const games = await this.state.getGames({
					contestId: contestId,
					$or: [
						{ notFoundOnMajsoul: false },
						{ contestMajsoulId: { $exists: true } }
					],
					hidden: { $ne: true }
				});

				const yakumanGames = games
					.map(game => {
						return {
							game,
							yakumanAgari: game.rounds.map(({tsumo, round, rons}) => {
								if (isAgariYakuman(
									game,
									round,
									tsumo
								)) {
									return [tsumo] as AgariInfo[];
								}

								return rons?.filter(ron => isAgariYakuman(
									game,
									round,
									ron
								)) || [] as AgariInfo[];
							}).flat()
						}
					});

				const playerMap = (
					await this.state.namePlayers(
						await this.state.mongoStore.playersCollection.find(
							{
								_id: {
									$in: yakumanGames.map(({ game, yakumanAgari }) => yakumanAgari.map(agari => game.players[agari.winner]._id)).flat()
								},
							},
							{
								projection: {
									_id: true,
									nickname: true,
									displayName: true,
									majsoulId: true,
								}
							}
						).toArray(),
						contestId,
					)
				).reduce((total, next) => (total[next._id] = next, total), {} as Record<string, PlayerInformation>)

				res.send(
					yakumanGames
						.map(({ game, yakumanAgari }) => yakumanAgari.map(agari => {
							const player = playerMap[game.players[agari.winner]._id.toHexString()];
							return {
								player,
								han: agari.han,
								game: {
									endTime: game.end_time,
									majsoulId: game.majsoulId,
								}
							}
						})).flat()
				);
			} catch (error) {
				console.log(error);
				res.status(500).send(error)
			}
		});

		app.get('/contests/:id/players',
			param("id").isMongoId(),
			query("gameLimit").isInt({ min: 0 }).optional(),
			query("ignoredGames").isInt({ min: 0 }).optional(),
			query("teamId").isMongoId().optional(),
			withData<{
				id: string;
				teamId?: string;
				gameLimit?: string;
				ignoredGames?: string;
			}, any, ContestPlayer[]>(async (data, req, res) => {
				const contest = await this.state.findContest(data.id, {
					projection: {
						_id: true,
						'teams._id': true,
						'teams.players._id': true,
						majsoulFriendlyId: true,
						bonusPerGame: true,
						normaliseScores: true,
					}
				});

				if (contest == null) {
					res.sendStatus(404);
					return;
				}

				const contestMajsoulFriendlyId = contest.majsoulFriendlyId?.toString() ?? "";

				const team = data.teamId && contest.teams.find(team => team._id.equals(data.teamId));
				if (data.teamId && !team) {
					res.status(400).send(`Team ${data.teamId} doesn't exist` as any);
					return;
				}

				const playerIds = team?.players?.map(player => player._id) ?? [];

				const gameQuery: FilterQuery<store.GameResult<ObjectId>> = {
					contestId: contest._id,
					hidden: { $ne: true },
					$or: [
						{ notFoundOnMajsoul: false },
						{ contestMajsoulId: { $exists: true } },
						{ majsoulId: { $exists: false } }
					],
				}

				if (data.teamId) {
					gameQuery["players._id"] = {
						$in: playerIds
					}
				}

				const games = await this.state.getGames(gameQuery, {contest});

				let gameLimit = parseInt(data.gameLimit);
				if (isNaN(gameLimit)) {
					gameLimit = Infinity;
				}

				let ignoredGames = parseInt(data.ignoredGames);
				if (isNaN(ignoredGames)) {
					ignoredGames = 0;
				}

				const playerGameInfo = games.reduce<Record<string, ContestPlayer>>((total, game) => {
					game.players.forEach((player, index) => {
						if (player == null) {
							return;
						}

						if (data.teamId && !playerIds.find(id => id.equals(player._id))) {
							return;
						}

						const id = player._id.toHexString();
						if (!(id in total)) {
							total[id] = {
								...player,
								tourneyScore: 0,
								tourneyRank: undefined,
								gamesPlayed: 0,
								team: undefined
							};
						}

						total[id].gamesPlayed++;
						if (total[id].gamesPlayed <= ignoredGames || total[id].gamesPlayed > (gameLimit + ignoredGames)) {
							return;
						}
						total[id].tourneyScore += game.finalScore[index].uma + (contest.bonusPerGame ?? 0);
					});
					return total;
				}, {});

				const seededPlayersForContest = seededPlayerNames[contestMajsoulFriendlyId] ?? [];

				const seededPlayers = await this.state.mongoStore.playersCollection.find(
					{ nickname: { $in: seededPlayersForContest } }
				).toArray();

				for (const seededPlayer of seededPlayers) {
					const id = seededPlayer._id.toHexString();
					if (id in playerGameInfo) {
						continue;
					}
					playerGameInfo[id] = {
						...seededPlayer,
						tourneyScore: 0,
						tourneyRank: undefined,
						gamesPlayed: 0,
						team: undefined
					};
				}

				const players = await this.state.namePlayers(
					await this.state.mongoStore.playersCollection.find(
						{ _id: { $in: Object.values(playerGameInfo).map(p => p._id).concat(playerIds) } },
						{ projection: { majsoulId: 0 } }
					).toArray(),
					null,
					contest
				);

				res.send(
					players.map(player => ({
						...playerGameInfo[player._id],
						...player,
						team: {
							teams: Object.entries(sakiTeams[contestMajsoulFriendlyId] ?? {})
								.filter(([team, players]) => players.indexOf(player.nickname) >= 0)
								.map(([team, _]) => team),
							seeded: seededPlayersForContest.indexOf(player.nickname) >= 0,
						}
					}))
						.filter(player => ignoredGames == 0 || player.gamesPlayed > ignoredGames || player.team.seeded)
						.sort((a, b) => b.tourneyScore - a.tourneyScore)
						.map((p, i) => ({ ...p, tourneyRank: i }))
				);
			}));

		app.get('/contests/:id/stats',
			param("id").isMongoId(),
			oneOf([
				query("team").isMongoId(),
				query("player").isMongoId(),
				query("players").isEmpty(),
			]),
			withData<{
				id?: string;
				team?: string;
				player?: string;
				players?: "";
			}, any, Record<string, Stats>>(async (data, req, res) => {
				const contest = await this.state.findContest(data.id);
				if (!contest) {
					res.sendStatus(404);
					return;
				}

				if ([data.team, data.player, data.players].filter(option => option != null).length !== 1) {
					res.status(401).send("Only one query allowed at a time." as any);
					return;
				}

				const query: FilterQuery<Store.GameResult<ObjectId>> = {
					contestId: contest._id,
					hidden: { $ne: true }
				};

				let playerMap: Record<string, ObjectId | boolean> = null;

				if (data.team) {
					const teamId = new ObjectId(data.team);
					const team = contest.teams.find(team => team._id.equals(teamId));
					if (team == null) {
						res.status(401).send(`Team #${teamId} not found` as any);
						return;
					}

					playerMap = (team.players ?? []).reduce((total, next) => (total[next._id.toHexString()] = teamId, total), {} as Record<string, ObjectId | boolean>)
				} else if (data.player != null) {
					const playerId = new ObjectId(data.player);
					const [player] = await this.state.mongoStore.playersCollection.find({
						_id: playerId
					}).toArray();

					if (player === null) {
						res.status(401).send(`Player #${playerId} not found!` as any);
						return;
					}

					playerMap = {
						[data.player]: true
					}
				}

				if (playerMap) {
					query.players = {
						$elemMatch: {
							_id: {
								$in: Object.keys(playerMap).map(ObjectId.createFromHexString)
							}
						}
					}
				}

				const games = await this.state.getGames(query);
				const [commonVersion, latestVersion] = games.reduce(
					([common, latest], next) => (
						[
							Math.min(common, minimumVersion(next)) as StatsVersion,
							Math.max(latest, minimumVersion(next)) as StatsVersion,
						]
					),
					[latestStatsVersion, StatsVersion.Undefined]
				);
				const gameStats = games.map(game => collectStats(game, minimumVersion(game), playerMap));

				if (data.team != null) {
					res.send({
						[data.team]: mergeStats(gameStats.flat(), latestVersion)
					});
					return;
				}

				const gamesByPlayer = gameStats.reduce((total, next) => {
					for (const stats of next) {
						const id = stats.playerId.toHexString();
						total[id] ??= [];
						total[id].push(stats);
					}
					return total;
				}, {} as Record<string, Stats[]>);

				res.send(Object.entries(gamesByPlayer).reduce((total, [key, value]) => (total[key] = mergeStats(value, latestVersion), total), {}));
			})
		);

		app.get('/players',
			query("name").optional(),
			query("limit").isInt({ gt: 0 }).optional(),
			withData<{
				name?: string;
				limit?: string;
			}, any, store.Player<ObjectId>[]>(async (data, req, res) => {
				const regex = new RegExp(`^${escapeRegexp(data.name)}.*$`);
				const cursor = this.state.mongoStore.playersCollection.find(
					{
						$or: [
							{
								displayName: { $regex: regex, $options: "i" }
							},
							{
								nickname: { $regex: regex, $options: "i" }
							}
						],
					},
					{
						projection: {
							_id: true,
							nickname: true,
							displayName: true,
						},
						sort: {
							nickname: 1,
						}
					}
				)

				if (data.limit) {
					cursor.limit(parseInt(data.limit))
				}

				res.send(await cursor.toArray());
			})
		);

		return app;
	}

	public registerAdminMethods(app: express.Express): express.Express {
		return app.put<any, store.Contest<string>>('/contests', (req, res) => {
			this.state.mongoStore.contestCollection.insertOne({}).then(result => res.send({ _id: result.insertedId.toHexString() }));
		})

		.get('/rigging/google',
		query("state").optional(),
		withData<{ state?: string }, any, { authUrl: string }>(async (data, req, res) => {
			const authUrl = this.state.oauth2Client.generateAuthUrl({
				access_type: 'offline',
				scope: [
					'https://www.googleapis.com/auth/spreadsheets'
				],
				state: data.state
			});
			res.send({
				authUrl
			})
		})
	)

	.patch('/rigging/google',
		body("code").isString().isLength({ min: 1 }),
		withData<{ code: string }, any, void>(async (data, req, res) => {
			const { tokens } = await this.state.oauth2Client.getToken(data.code);
			this.state.mongoStore.configCollection.updateMany({}, {
				$set: {
					googleRefreshToken: tokens.refresh_token
				}
			})
			res.send();
		})
	)

	.patch<any, store.Contest<ObjectId>>('/contests/:id',
		param("id").isMongoId(),
		body(nameofContest('majsoulFriendlyId')).not().isString().bail().isInt({ min: 100000, lt: 1000000 }).optional({ nullable: true }),
		body(nameofContest('spreadsheetId')).isString().bail().optional({ nullable: true }),

		body(nameofContest('type')).not().isString().bail().isNumeric().isWhitelisted(Object.keys(store.ContestType)).optional(),
		body(nameofContest('subtype')).not().isString().bail().isNumeric().isWhitelisted(Object.keys(store.TourneyContestPhaseSubtype)).optional(),
		body(nameofContest('anthem')).isString().bail().isLength({ max: 50 }).optional({ nullable: true }),
		body(nameofContest('tagline')).isString().bail().isLength({ max: 200 }).optional({ nullable: true }),
		body(nameofContest('taglineAlternate')).isString().bail().isLength({ max: 200 }).optional({ nullable: true }),
		body(nameofContest('normaliseScores')).not().isString().bail().isBoolean().optional({ nullable: true }),

		...eliminationBracketSettingsFilter(),

		body(nameofContest('displayName')).isString().bail().isLength({ max: 100 }).optional({ nullable: true }),
		body(nameofContest('initialPhaseName')).isString().bail().isLength({ max: 100 }).optional({ nullable: true }),
		body(nameofContest('maxGames')).not().isString().bail().isInt({ gt: 0, max: 50 }).optional({ nullable: true }),
		body(nameofContest('bonusPerGame')).not().isString().bail().isInt({ min: 0 }).optional({ nullable: true }),
		body(nameofContest('track')).not().isString().bail().isBoolean().optional({ nullable: true }),
		body(nameofContest('adminPlayerFetchRequested')).not().isString().bail().isBoolean().optional({ nullable: true }),
		body(nameofContest('nicknameOverrides')).not().isString().bail().isArray().optional({ nullable: true }),
		body(`${nameofContest('nicknameOverrides')}.*.${nameofNicknameOverrides('_id')}`).isMongoId(),
		body(`${nameofContest('nicknameOverrides')}.*.${nameofNicknameOverrides('nickname')}`),

		body(nameofContest('gacha')).not().isString().bail().isObject().optional({ nullable: true }),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}`).not().isString().bail().isArray().optional(),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('onePer')}`).not().isString().bail().isInt({min: 1}),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('_id')}`).isMongoId().optional(),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('name')}`).isString(),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('priority')}`).not().isString().bail().isInt(),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('unique')}`).not().isString().bail().isBoolean().optional(),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('cards')}`).not().isString().bail().isArray({min: 1}),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('cards')}.*.${nameofGachaCard('_id')}`).isMongoId().optional(),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('cards')}.*.${nameofGachaCard('icon')}`).isString().bail(),
		body(`${nameofContest('gacha')}.${nameofGacha('groups')}.*.${nameofGachaGroup('cards')}.*.${nameofGachaCard('image')}`).isString().bail().optional(),

		...scoringTypeFilter(nameofContest('tourneyType')),
		async (req, res) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({ errors: errors.array() } as any);
			}
			const update: {
				$set?: {},
				$unset?: {},
			} = {};
			const data: Partial<store.Contest<string>> = matchedData(req, { includeOptionals: false });

			if (data.majsoulFriendlyId != null) {
				try {
					const existingGame = await this.state.mongoStore.contestCollection.findOne({ majsoulFriendlyId: data.majsoulFriendlyId });
					if (existingGame != null && !existingGame._id.equals(data._id)) {
						res.status(400).send(`Contest #${existingGame._id.toHexString()} already subscribed to majsoul ID ${data.majsoulFriendlyId}` as any);
						return;
					};
				} catch (e) {
					res.status(500).send(e);
					return;
				}
			}

			for (const key in data) {
				if (key === "id") {
					continue;
				}

				if (data[key] === undefined) {
					continue;
				}

				if (key === nameofContest("majsoulFriendlyId")) {
					update.$unset ??= {};
					update.$unset[nameofContest("notFoundOnMajsoul")] = true;
				}

				if (data[key] === null) {
					update.$unset ??= {};
					update.$unset[key] = true;
					continue;
				}

				if (key === nameofContest("gacha")) {
					console.log(data[key]);
					update.$set ??= {};
					update.$set[key] ??= {
						groups: data.gacha.groups.map(group => {
							const groupDto = {
								_id: group._id == null ? new ObjectId() : ObjectId.createFromHexString(group._id),
								name: group.name,
								priority: group.priority,
								onePer: group.onePer,
								cards: group.cards.map(card => {
									const cardDto = {
										_id: card._id == null ? new ObjectId() : ObjectId.createFromHexString(card._id),
										icon: card.icon,
									} as store.GachaCard<ObjectId>;

									if (card.image != null) {
										cardDto.image = card.image;
									}
									return cardDto;
								}),
							} as store.GachaGroup<ObjectId>;

							if (group.unique != null) {
								groupDto.unique = group.unique;
							}
							return groupDto;
						})
					} as store.Contest<ObjectId>['gacha'];
					continue;
				}

				update.$set ??= {};
				update.$set[key] = data[key];
			}

			if (update.$set == null && update.$unset == null) {
				res.status(400).send("No operations requested" as any);
				return;
			}

			this.state.mongoStore.contestCollection.findOneAndUpdate(
				{ _id: new ObjectId(req.params.id) },
				update,
				{
					returnOriginal: false,
					projection: {
						teams: false,
						sessions: false,
					}
				}
			).then((contest) => {
				if (contest.value === null) {
					res.status(404).send();
					return;
				}
				res.send(contest.value);
			}).catch((err) => {
				console.log(err);
				res.status(500).send(err);
			})
		}
	)

	.put<any, string>('/games',
		body(nameofGameResult('contestId')).isMongoId().isString(),
		body(nameofGameResult('majsoulId')).isString(),
		logError<any, string>(
			async (req, res) => {
				const errors = validationResult(req);
				if (!errors.isEmpty()) {
					res.status(400).json({ errors: errors.array() } as any);
					return;
				}
				const data: Partial<store.GameResult<string>> = matchedData(req, { includeOptionals: true });
				const contestId = new ObjectId(data.contestId);
				const existingContest = await this.state.mongoStore.contestCollection.find({ _id: contestId }).toArray();
				if (existingContest.length <= 0) {
					res.status(400).send("Contest Id is invalid." as any);
					return;
				}

				const existingGame = await this.state.mongoStore.gamesCollection.find({ majsoulId: data.majsoulId }).toArray();

				if (existingGame.length > 0) {
					res.status(400).send(`Game with id ${data.majsoulId} already exists.` as any);
					return;
				}

				const gameResult = await this.state.mongoStore.gamesCollection.insertOne({
					contestId,
					majsoulId: data.majsoulId
				});

				res.send(JSON.stringify(gameResult.insertedId.toHexString()));
			}
		)
	)

	.patch('/games/:id',
		param("id").isMongoId(),
		body(nameofGameResult("hidden")).isBoolean().not().isString().optional({ nullable: true }),
		withData<{ id: string, hidden?: boolean }, any, Partial<GameResult>>(async (data, req, res) => {
			const gameId = new ObjectId(data.id);
			const [game] = await this.state.mongoStore.gamesCollection.find({
				_id: gameId
			}).toArray();

			if (!game) {
				res.sendStatus(404);
				return;
			}

			const update: {
				$set?: {},
				$unset?: {},
			} = {};

			for (const key in data) {
				if (data[key] === undefined) {
					continue;
				}

				if (data[key] === null) {
					update.$unset ??= {};
					update.$unset[key] = true;
					continue;
				}

				update.$set ??= {};
				update.$set[key] = data[key];
			}

			if (update.$set == null && update.$unset == null) {
				res.status(400).send("No operations requested" as any);
				return;
			}

			const result = await this.state.mongoStore.gamesCollection.findOneAndUpdate(
				{
					_id: gameId
				},
				update,
				{
					returnOriginal: false,
					projection: {
						rounds: false
					}
				}
			);

			res.send(result.value);
		})
	)

	.delete<any, void>('/games/:id',
		param("id").isMongoId(),
		logError(async (req, res) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({ errors: errors.array() } as any);
				return;
			}
			const data = matchedData(req, { includeOptionals: true }) as { id: string; };
			const gameId = new ObjectId(data.id);

			const result = await this.state.mongoStore.gamesCollection.deleteOne({
				_id: gameId
			})

			res.send();
		})
	)

	.put<any, string>('/games/custom',
		body(nameofGameResult('contestId')).isMongoId().isString(),
		logError<any, string>(
			async (req, res) => {
				const errors = validationResult(req);
				if (!errors.isEmpty()) {
					res.status(400).json({ errors: errors.array() } as any);
					return;
				}
				const data: Partial<store.GameResult<string>> = matchedData(req, { includeOptionals: true });
				const contestId = new ObjectId(data.contestId);
				const existingContest = await this.state.mongoStore.contestCollection.find({ _id: contestId }).toArray();
				if (existingContest.length <= 0) {
					res.status(400).send("Contest Id is invalid." as any);
					return;
				}

				const now = Date.now();

				const gameResult = await this.state.mongoStore.gamesCollection.insertOne({
					contestId,
					notFoundOnMajsoul: true,
					start_time: now,
					end_time: now,
				});

				res.send(JSON.stringify(gameResult.insertedId.toHexString()));
			}
		)
	)

	.patch('/games/custom/:id',
		param("id").isMongoId(),
		body(nameofGameResult("start_time")).not().isString().bail().isInt({ min: 0 }).optional(),
		body(nameofGameResult("end_time")).not().isString().bail().isInt({ min: 0 }).optional(),
		body(nameofGameResult("finalScore")).not().isString().bail().isArray({ max: 4, min: 4 }).optional(),
		body(`${nameofGameResult("finalScore")}.*.score`).isInt().not().isString(),
		body(`${nameofGameResult("finalScore")}.*.uma`).isInt().not().isString(),
		body(nameofGameResult("players")).not().isString().bail().isArray({ max: 4, min: 4 }).optional(),
		body(`${nameofGameResult("players")}.*._id`).isMongoId(),
		withData<{ id: string, hidden?: boolean }, any, Partial<GameResult>>(async (data, req, res) => {
			const gameId = new ObjectId(data.id);
			const [game] = await this.state.mongoStore.gamesCollection.find({
				_id: gameId,
				majsoulId: {
					$exists: false,
				}
			}).toArray();

			if (!game) {
				res.sendStatus(404);
				return;
			}

			const update: {
				$set?: {},
				$unset?: {},
			} = {};

			for (const key in data) {
				if (key === "id") {
					continue;
				}

				if (data[key] === undefined) {
					continue;
				}

				if (data[key] === null) {
					update.$unset ??= {};
					update.$unset[key] = true;
					continue;
				}

				update.$set ??= {};

				if (key === "players") {
					update.$set[key] = data[key].map(({_id}) => ({
						_id: ObjectID.createFromHexString(_id)
					}))
					continue;
				}

				update.$set[key] = data[key];
			}

			if (update.$set == null && update.$unset == null) {
				res.status(400).send("No operations requested" as any);
				return;
			}

			const result = await this.state.mongoStore.gamesCollection.findOneAndUpdate(
				{
					_id: gameId
				},
				update,
				{
					returnOriginal: false,
				}
			);

			res.send(result.value);
		})
	)

	.put<any, string>('/corrections',
		body(nameofGameCorrection('gameId')).isMongoId().isString(),
		logError<any, string>(
			async (req, res) => {
				const errors = validationResult(req);
				if (!errors.isEmpty()) {
					res.status(400).json({ errors: errors.array() } as any);
					return;
				}
				const data: Partial<store.GameCorrection<string>> = matchedData(req, { includeOptionals: true });
				const gameId = new ObjectId(data.gameId);
				const game = await this.state.mongoStore.gamesCollection.find({ _id: gameId }).toArray();
				if (game.length <= 0) {
					res.status(400).send("Game doesn't exist." as any);
					return;
				}

				const existingCorrection = await this.state.mongoStore.gameCorrectionsCollection.find({ gameId: gameId }).toArray();

				if (existingCorrection.length > 0) {
					res.status(400).send(`Correction for that game id already exists.` as any);
					return;
				}

				const gameResult = await this.state.mongoStore.gameCorrectionsCollection.insertOne({
					gameId,
				});

				res.send(JSON.stringify(gameResult.insertedId.toHexString()));
			}
		)
	)

	.put('/contests/:id/gacha/:groupId',
		param("id").isMongoId(),
		param("groupId").isMongoId(),
		body("icon").isString(),
		withData<{
			id: string,
			groupId: string,
			icon: string
		}, any, store.Contest<ObjectId>>(async (data, req, res) => {
			const contest = await this.state.findContest(data.id, {
				projection: {
					gacha: true,
				}
			});

			if (contest === null) {
				res.status(404).send();
				return;
			}

			if (!contest.gacha) {
				res.status(400).send();
			}

			const groupId = ObjectId.createFromHexString(data.groupId);
			const group = contest.gacha.groups.find(group => group._id.equals(groupId));

			if (!group) {
				res.status(400).send();
			}

			group.cards.push({
				_id: new ObjectId(),
				icon: data.icon
			});

			const result = await this.state.mongoStore.contestCollection.updateOne(
				{
					_id: contest._id,
				},
				{ $set: { gacha: contest.gacha } }
			);

			res.send();
		})
	)

	.patch('/contests/:id/gachaGroup/:groupId',
		param("id").isMongoId(),
		param("groupId").isMongoId(),
		body("onePer").not().isString().bail().isInt({min: 1}).optional(),
		withData<{
			id: string,
			groupId: string,
			onePer: number,
		}, any, store.Contest<ObjectId>>(async (data, req, res) => {
			const contest = await this.state.findContest(data.id, {
				projection: {
					gacha: true,
				}
			});

			if (contest === null) {
				res.status(404).send();
				return;
			}

			if (!contest.gacha) {
				res.status(400).send();
			}

			const groupId = ObjectId.createFromHexString(data.groupId);
			const group = contest.gacha.groups.find(group => group._id.equals(groupId));

			if (!group) {
				res.status(400).send();
			}

			if (data.onePer) {
				group.onePer = data.onePer;
			}
			const result = await this.state.mongoStore.contestCollection.updateOne(
				{
					_id: contest._id,
				},
				{ $set: { gacha: contest.gacha } }
			);

			res.send();
		})
	)

	.patch('/contests/:id/gacha/:gachaId',
		param("id").isMongoId(),
		param("gachaId").isMongoId(),
		body("icon").isString().optional(),
		body("image").isString().optional(),
		withData<{
			id: string,
			gachaId: string,
			icon?: string,
			image?: string,
		}, any, store.Contest<ObjectId>>(async (data, req, res) => {
			const contest = await this.state.findContest(data.id, {
				projection: {
					gacha: true,
				}
			});

			if (contest === null) {
				res.status(404).send();
				return;
			}

			if (!contest.gacha) {
				res.status(400).send();
			}

			const cardId = ObjectId.createFromHexString(data.gachaId);
			const card = contest.gacha.groups.map(group => group.cards).flat().find(card => card._id.equals(cardId));

			if (!card) {
				res.status(404).send();
			}

			if (data.icon) {
				card.icon = data.icon;
			}

			if (data.image) {
				card.image = data.image;
			}

			const result = await this.state.mongoStore.contestCollection.updateOne(
				{
					_id: contest._id,
				},
				{ $set: { gacha: contest.gacha } }
			);

			res.send();
		})
	)

	.patch('/corrections/:id',
		param("id").isMongoId(),
		body(nameofGameCorrection("finalScore")).isArray().not().isString().optional({ nullable: true }),
		body(`${nameofGameCorrection("finalScore")}.*.uma`).isInt().not().isString().optional({ nullable: true }),
		body(`${nameofGameCorrection("finalScore")}.*.score`).isInt().not().isString().optional({ nullable: true }),
		withData<{ id: string, hidden?: boolean }, any, Partial<GameResult>>(async (data, req, res) => {
			const correctionId = new ObjectId(data.id);
			const [game] = await this.state.mongoStore.gameCorrectionsCollection.find({
				_id: correctionId
			}).toArray();

			if (!game) {
				res.sendStatus(404);
				return;
			}

			const update: {
				$set?: {},
				$unset?: {},
			} = {};

			for (const key in data) {
				if (data[key] === undefined) {
					continue;
				}

				if (data[key] === null) {
					update.$unset ??= {};
					update.$unset[key] = true;
					continue;
				}

				update.$set ??= {};
				update.$set[key] = data[key];
			}

			if (update.$set == null && update.$unset == null) {
				res.status(400).send("No operations requested" as any);
				return;
			}

			const result = await this.state.mongoStore.gameCorrectionsCollection.findOneAndUpdate(
				{
					_id: correctionId
				},
				update,
				{
					returnOriginal: false,
					projection: {
						rounds: false
					}
				}
			);

			res.send(result.value);
		})
	)

	.delete<any, void>('/corrections/:id',
		param("id").isMongoId(),
		logError(async (req, res) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({ errors: errors.array() } as any);
				return;
			}
			const data = matchedData(req, { includeOptionals: true }) as { id: string; };
			const correctionId = new ObjectId(data.id);

			const result = await this.state.mongoStore.gameCorrectionsCollection.deleteOne({
				_id: correctionId
			})

			res.send();
		})
	)


	.delete<any, void>('/contests/:id',
		param("id").isMongoId(),
		logError(async (req, res) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({ errors: errors.array() } as any);
				return;
			}

			const data: Partial<store.Contest<string> & {id: string}> = matchedData(req, { includeOptionals: true });
			const contestId = ObjectId.createFromHexString(data.id);

			await this.state.mongoStore.configCollection.findOneAndUpdate(
				{ featuredContest: contestId },
				{
					$unset: { featuredContest: true }
				});

			const result = await this.state.mongoStore.contestCollection.deleteOne({
				_id: contestId
			})

			await this.state.mongoStore.configCollection.findOneAndUpdate({
				trackedContest: contestId
			}, {
				$unset: {
					trackedContest: true
				}
			})

			res.send();
		})
	)

	.delete<any, void>('/contests/:id/gacha',
		param("id").isMongoId(),
		logError(async (req, res) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				res.status(400).json({ errors: errors.array() } as any);
				return;
			}

			const data: Partial<store.Contest<string> & {id: string}> = matchedData(req, { includeOptionals: true });
			const contestId = ObjectId.createFromHexString(data.id);

			const games = await this.state.mongoStore.gamesCollection.find(
				{ contestId },
				{ projection: {_id: true} }
			).toArray();

			const result = await this.state.mongoStore.gachaCollection.deleteMany(
				{ gameId: {$in: games.map(game => game._id)} },
			);

			res.send();
		})
	)

	.patch<any, store.Config<ObjectId>>('/config',
		body(nameofConfig('featuredContest')).isMongoId().optional({ nullable: true }),
		withData<Partial<store.Config<string>>, any, store.Config<ObjectId>>(async (data, req, res) => {
			if (data.featuredContest != null) {
				const existingContest = await this.state.mongoStore.contestCollection.findOne({ _id: new ObjectId(data.featuredContest) });
				if (existingContest == null) {
					res.status(400).send(`Featured contest #${data._id} doesn't exist.` as any);
					return;
				};
			}

			const update: {
				$set?: {},
				$unset?: {},
			} = {};

			for (const key in data) {
				if (data[key] === undefined) {
					continue;
				}

				if (data[key] === null) {
					update.$unset ??= {};
					update.$unset[key] = true;
					continue;
				}

				update.$set ??= {};
				update.$set[key] = key === nameofConfig("featuredContest") ? new ObjectId(data[key] as string) : data[key];
			}

			if (update.$set == null && update.$unset == null) {
				res.status(400).send("No operations requested" as any);
				return;
			}

			const [existingConfig] = await this.state.mongoStore.configCollection.find().toArray();
			if (existingConfig == null) {
				res.status(404).send();
				return;
			}

			const updatedConfig = await this.state.mongoStore.configCollection.findOneAndUpdate(
				{ _id: existingConfig._id },
				update,
				{
					returnOriginal: false,
					projection: {
						googleRefreshToken: false
					}
				}
			);

			if (updatedConfig.value === null) {
				res.status(404).send();
				return;
			}
			res.send(updatedConfig.value);
		})
	)

	.put('/sessions',
		body(nameofSession("contestId")).isMongoId(),
		withData<Partial<store.Session<string | ObjectId>>, any, store.Session<ObjectId>>(async (data, req, res) => {
			const contestId = await this.state.contestExists(data.contestId as string);
			if (!contestId) {
				res.status(400).send(`contest #${data.contestId} not found` as any);
				return;
			}

			const [lastSession] = await this.state.mongoStore.sessionsCollection
				.find()
				.sort(nameofSession("scheduledTime"), -1)
				.limit(1)
				.toArray();

			const session = await this.state.mongoStore.sessionsCollection.insertOne(
				{
					scheduledTime: (lastSession?.scheduledTime ?? Date.now()) + (24 * 60 * 60 * 1000),
					contestId,
					plannedMatches: [],
				},
			);

			res.send(session.ops[0]);
		})
	)

	.patch('/sessions/:id',
		param("id").isMongoId(),
		body(nameofSession("scheduledTime")).not().isString().bail().isInt({ min: 0 }).optional(),
		body(nameofSession("name")).isString().optional({ nullable: true }),
		body(nameofSession("isCancelled")).not().isString().bail().isBoolean().optional({ nullable: true }),
		body(nameofSession("plannedMatches")).not().isString().bail().isArray().optional(),
		body(`${nameofSession("plannedMatches")}.*.teams`).not().isString().bail().isArray({ max: 4, min: 4 }),
		body(`${nameofSession("plannedMatches")}.*.teams.*._id`).isMongoId(),
		withData<{
			id: string;
		} & Partial<store.Session<string | ObjectId>>, any, store.Session<ObjectId>>(async (data, req, res) => {
			if (data.plannedMatches && data.plannedMatches.length > 0) {
				const teamIds = data.plannedMatches.map(match => match.teams.map(team => team._id as string)).flat();
				const uniqueTeams = new Set(teamIds.map(id => id));

				const sessionId = new ObjectId(data.id);

				const [session] = await this.state.mongoStore.sessionsCollection.find({
					_id: sessionId
				}).toArray();

				if (!session) {
					res.status(404).send();
					return;
				}

				const [contest] = await this.state.mongoStore.contestCollection.find({
					_id: session.contestId,
					"teams._id": {
						$all: Array.from(uniqueTeams).map(id => new ObjectId(id))
					}
				}).toArray();

				if (!contest) {
					res.status(400).send(`One of team ids ${teamIds.map(id => `#${id}`).join(", ")} doesn't exist.` as any);
					return;
				}
			}

			const update: {
				$set?: {},
				$unset?: {},
			} = {};

			for (const key in data) {
				if (key === "id") {
					continue;
				}

				if (data[key] === undefined) {
					continue;
				}

				if (data[key] === null) {
					update.$unset ??= {};
					update.$unset[key] = true;
					continue;
				}

				update.$set ??= {};
				update.$set[key] = data[key];
			}

			if (update.$set == null && update.$unset == null) {
				res.status(400).send("No operations requested" as any);
				return;
			}

			const session = await this.state.mongoStore.sessionsCollection.findOneAndUpdate(
				{ _id: new ObjectId(data.id) },
				update,
				{
					returnOriginal: false,

				}
			);

			if (!session.value) {
				res.status(404).send();
				return;
			}

			res.send(session.value);
		})
	)

	.delete('/sessions/:id',
		param("id").isMongoId(),
		withData<{ id: string }, any, store.Session<ObjectId>>(async (data, req, res) => {
			const result = await this.state.mongoStore.sessionsCollection.deleteOne(
				{
					_id: new ObjectId(data.id)
				}
			);

			if (result.deletedCount <= 0) {
				res.sendStatus(404);
			}
			res.send();
		})
	)

	.patch('/contests/:id/teams/:teamId',
		param("id").isMongoId(),
		param("teamId").isMongoId(),
		body(nameofTeam('image')).isString().optional({ nullable: true }),
		body(nameofTeam('imageLarge')).isString().optional({ nullable: true }),
		body(nameofTeam('name')).isString().optional({ nullable: true }),
		body(nameofTeam('players')).isArray().optional(),
		body(`${nameofTeam('players')}.*._id`).isMongoId(),
		body(nameofTeam('anthem')).isString().optional({ nullable: true }),
		body(nameofTeam('color')).isString().matches(/^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/).optional({ nullable: true }),
		body(nameofTeam("contrastBadgeFont")).isBoolean().not().isString().optional({ nullable: true }),
		withData<
			{
				id: string;
				teamId: string;
			} & Partial<store.ContestTeam<string>>,
			any,
			store.ContestTeam<ObjectId>
		>(async (data, req, res) => {
			const update: {
				$set?: {},
				$unset?: {},
			} = {};

			const id = new ObjectId(data.id);
			const teamId = new ObjectId(data.teamId);

			if (data.players) {
				data.players = data.players.map(player => ({
					_id: ObjectId.createFromHexString(player._id)
				})) as any;

				const players = await this.state.mongoStore.playersCollection.find({
					_id: { $in: data.players.map(player => player._id as any as ObjectID) }
				}).toArray();
				if (players.length !== data.players.length) {
					res.status(400).send(
						`Players ${data.players
							.filter(player => !players.find(p => p._id.equals(player._id)))
							.map(player => `#${player._id}`)
							.join(", ")
						} not found.` as any
					);
					return;
				}
			}

			for (const key in data) {
				if (data[key] === undefined) {
					continue;
				}

				if (key === "id" || key === "teamId") {
					continue;
				}

				const updateKey = `teams.$.${key}`;

				if (data[key] === null) {
					update.$unset ??= {};
					update.$unset[updateKey] = true;
					continue;
				}

				update.$set ??= {};
				update.$set[updateKey] = data[key];
			}

			if (update.$set == null && update.$unset == null) {
				res.status(400).send("No operations requested" as any);
				return;
			}

			this.state.mongoStore.contestCollection.findOneAndUpdate(
				{
					_id: id,
					teams: { $elemMatch: { _id: teamId } }
				},
				update,
				{ returnOriginal: false, projection: { teams: true } }
			).then((contest) => {
				res.send(contest.value.teams.find(team => team._id.equals(teamId)));
			}).catch((err) => {
				console.log(err);
				res.status(500).send(err);
			})
		}
		))

	.put('/contests/:id/teams/',
		param("id").isMongoId(),
		withData<
			{
				id: string;
			},
			any,
			store.ContestTeam<ObjectId>
		>(async (data, req, res) => {
			const contestId = await this.state.contestExists(data.id);
			if (!contestId) {
				res.sendStatus(404);
				return;
			}

			const team = {
				_id: new ObjectId()
			};

			await this.state.mongoStore.contestCollection.findOneAndUpdate(
				{
					_id: contestId,
				},
				{
					$push: {
						teams: team
					}
				},
				{ returnOriginal: false, projection: { teams: true } }
			)

			res.send(team);
		}
		))

	.delete('/contests/:id/teams/:teamId',
		param("id").isMongoId(),
		param("teamId").isMongoId(),
		withData<
			{
				id: string;
				teamId: string;
			},
			any,
			store.ContestTeam<ObjectId>
		>(async (data, req, res) => {
			const [contest] = await this.state.mongoStore.contestCollection.find(
				{
					_id: new ObjectId(data.id),
					teams: { $elemMatch: { _id: new ObjectId(data.teamId) } }
				},
			).toArray();

			if (contest == null) {
				res.sendStatus(404);
				return;
			}

			const teamId = new ObjectId(data.teamId);

			await this.state.mongoStore.contestCollection.findOneAndUpdate(
				{
					_id: contest._id,
				},
				{
					$pull: {
						teams: {
							_id: teamId
						}
					}
				},
				{ returnOriginal: false, projection: { teams: true } }
			)

			res.send();
		}
		))

	.put("/contests/:id/transitions",
		param("id").isMongoId(),
		body(nameofTransition("startTime")).isInt({ min: 0 }).not().isString(),
		body(nameofTransition("name")).isString(),
		body(`${nameofTransition("score")}.half`).isBoolean().not().isString().optional(),
		body(`${nameofTransition("score")}.nil`).isBoolean().not().isString().optional(),
		body(`${nameofTransition("teams")}.top`).isInt({ min: 4 }).not().isString().optional(),
		...eliminationBracketSettingsFilter(),
		...scoringTypeFilter(nameofTransition('scoringTypes')),
		withData<
			Partial<store.ContestPhaseTransition> & {
				id: string,
			},
			any,
			Pick<store.ContestPhaseTransition<ObjectId>, "_id">
		>(async (data, req, res) => {
			const contest = await this.state.findContest(data.id);
			if (!contest) {
				res.status(404).send();
				return;
			}

			const transition: ContestPhaseTransition<ObjectId> = {
				_id: new ObjectId(),
				startTime: data.startTime,
			}

			if (data.name != null) {
				transition.name = data.name;
			}

			if (data.score != null) {
				transition.score = data.score;
			}

			if (data.teams != null) {
				transition.teams = data.teams;
			}

			if (data.scoringTypes != null) {
				transition.scoringTypes = data.scoringTypes;
			}

			if (data.eliminationBracketSettings != null) {
				transition.eliminationBracketSettings = data.eliminationBracketSettings;
			}

			if (data.eliminationBracketTargetPlayers != null) {
				transition.eliminationBracketTargetPlayers = data.eliminationBracketTargetPlayers;
			}


			if (contest.transitions) {
				this.state.mongoStore.contestCollection.findOneAndUpdate(
					{ _id: new ObjectId(data.id) },
					{
						$push: {
							transitions: transition,
						}
					}
				);
			} else {
				this.state.mongoStore.contestCollection.findOneAndUpdate(
					{ _id: new ObjectId(data.id) },
					{
						$set: {
							transitions: [transition],
						}
					}
				);
			}
			res.send({ _id: transition._id });
		})
	)

	.delete("/contests/:contestId/transitions/:id",
		param("contestId").isMongoId(),
		param("id").isMongoId(),
		withData<{ contestId: string; id: string }, any, void>(async (data, req, res) => {
			const contest = await this.state.findContest(data.contestId);
			if (!contest) {
				res.sendStatus(404);
				return;
			}

			this.state.mongoStore.contestCollection.findOneAndUpdate({ _id: ObjectId.createFromHexString(data.contestId) },
				{
					$pull: {
						transitions: {
							_id: ObjectId.createFromHexString(data.id)
						}
					}
				}
			);

			res.send();
		})
	)

	.patch('/players/:id',
		param("id").isMongoId(),
		body(nameofPlayer("displayName")).isString().optional({nullable: true}),
		withData<Partial<store.Player<string | ObjectId> & {id: string}>, any, Store.Player<ObjectId>>(async (data, req, res) => {
			const player = await this.state.mongoStore.playersCollection.findOneAndUpdate(
				{
					_id: ObjectId.createFromHexString(data.id as string)
				},
				data.displayName == null
					? {
						$unset: {
							displayName: true
						}
					}
					: {
						$set: {
							displayName: data.displayName
						}
					},
				{
					returnOriginal: false
				}
			);

			if (!player.ok) {
				res.status(404).send();
			}

			res.send(player.value);
		})
	)

	.put('/players/',
		body(nameofPlayer("majsoulFriendlyId")).not().isString().bail().isNumeric(),
		withData<Partial<store.Player<string | ObjectId>>, any, Store.Player<ObjectId>>(async (data, req, res) => {
			const result = await this.state.mongoStore.playersCollection.insertOne({
				majsoulFriendlyId: data.majsoulFriendlyId
			});
			res.send(result.ops[0]);
		})
	)

	.get("/rigging/token", async (req, res) => {
		const user = await this.state.mongoStore.userCollection.findOne({
			nickname: req.header("Username") as string,
		});

		if (!user) {
			res.sendStatus(401);
			return;
		}

		const sha = crypto.createHash("sha256");
		if (user.password.hash !== sha.update(`${req.header("Password") as string}:${user.password.salt}`).digest("hex")) {
			res.sendStatus(401);
			return;
		}

		jwt.sign(
			{
				name: user.nickname,
				roles: user.scopes
			},
			this.state.privateKey,
			{
				algorithm: 'RS256',
				issuer: "riichi.moe",
				audience: "riichi.moe",
				expiresIn: "1d",
				notBefore: 0,
			},
			(err, token) => {
				if (err) {
					console.log(err);
					res.status(500).send(err);
					return;
				}
				res.send(token);
			});
		});


	}
}

function scoringTypeFilter(propName: string) {
	return [
		oneOf([
			body(propName).not().isString().bail().isNumeric().isWhitelisted(Object.keys(store.TourneyContestScoringType)).optional(),
			body(propName).not().isString().bail().isArray({ min: 1 }).optional(),
		]),
		body(`${propName}.*.${nameofTourneyScoringType('type')}`).not().isString().bail().isNumeric().isWhitelisted(Object.keys(store.TourneyContestScoringType)),
		body(`${propName}.*.${nameofTourneyScoringType('typeDetails')}.${nameofTourneyScoringTypeDetails('findWorst')}`).not().isString().bail().isBoolean().optional({ nullable: true }),
		body(`${propName}.*.${nameofTourneyScoringType('typeDetails')}.${nameofTourneyScoringTypeDetails('gamesToCount')}`).not().isString().bail().isInt({ gt: 0 }).optional({ nullable: true }),
		body(`${propName}.*.${nameofTourneyScoringType('places')}`).not().isString().bail().isInt({ gt: 0 }).optional({ nullable: true }),
		body(`${propName}.*.${nameofTourneyScoringType('reverse')}`).not().isString().bail().isBoolean().optional({ nullable: true }),
		body(`${propName}.*.${nameofTourneyScoringType('suborder')}`).not().isString().bail().isArray().optional({ nullable: true }),
		body(`${propName}.*.${nameofTourneyScoringType('suborder')}.*.${nameofTourneyScoringType('type')}`)
			.not().isString().bail().isNumeric().isWhitelisted(Object.keys(store.TourneyContestScoringType)),
		body(`${propName}.*.${nameofTourneyScoringType('suborder')}.*.${nameofTourneyScoringType('places')}`)
			.not().isString().bail().isInt({ gt: 0 }).optional({ nullable: true }),
		body(`${propName}.*.${nameofTourneyScoringType('suborder')}.*.${nameofTourneyScoringType('reverse')}`)
			.not().isString().bail().isBoolean().optional({ nullable: true }),
	];
}

function eliminationBracketSettingsFilter() {
	return [
		body(nameofContest('eliminationBracketTargetPlayers')).not().isString().bail().isInt({ min: 4 }).optional({ nullable: true }),
		body(nameofContest('eliminationBracketSettings')).not().isString().isObject().optional({ nullable: true }),
		body(`${nameofContest('eliminationBracketSettings')}.*.${nameofEliminationBracketSettings('gamesPerMatch')}`).not().isString().bail().isInt({ min: 1 }).optional({ nullable: true }),
		body(`${nameofContest('eliminationBracketSettings')}.*.${nameofEliminationBracketSettings('winnersPerMatch')}`).not().isString().bail().isInt({ min: 1 }).optional({ nullable: true }),
	];
}
