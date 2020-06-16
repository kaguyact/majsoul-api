import * as express from 'express';
import * as cors from "cors";
import * as store from '../store';
import { Contest } from './types/types';
import { ObjectId } from 'mongodb';

export class RestApi {
	private app: express.Express;

	constructor(private readonly mongoStore: store.Store) {
		this.app = express();
		this.app.use(cors());

		this.app.get<any, Contest<ObjectId>>('/contests/:id', (req, res) => {
			this.mongoStore.contestCollection.findOne(
				{ majsoulFriendlyId: parseInt(req.params.id) }
			).then(async (contest) => {
				res.send({
					...contest,
					sessions: await Promise.all(contest.sessions.map(async (session) => ({
						...session,
						totals: await this.getSessionSummary(contest, session)
					})))
				});
			})
			.catch(error => {
				console.log(error);
				res.status(500).send(error)
			});
		});

		this.app.get('/games', (req, res) => {
			const sessionIds = (req.query.sessions as string).split('+');
			this.mongoStore.gamesCollection.find(
				{ sessionId: { $in: sessionIds.map(id => new ObjectId(id)) }}
			).toArray()
				.then(games => res.send(games))
				.catch(error => {
					console.log(error);
					res.status(500).send(error)
				});
		});
	}

	private async getSessionSummary(contest: store.Contest, session: store.Session): Promise<Record<string, number>> {
		const games = await this.mongoStore.gamesCollection.find({
			sessionId: session._id
		}).toArray();
		return games.reduce<Record<string, number>>((total, game) => {
			game.finalScore.forEach((score, index) => {
				const winningTeam = contest.teams.find(t => t.players.find(p => p._id.equals(game.players[index]._id)));
				if(!winningTeam) {
					console.log(session._id);
					console.log(game);
				}
				total[winningTeam._id.toHexString()] = (total[winningTeam._id.toHexString()] ?? 0) + score.uma;
			});
			return total;
		}, {});
	}

	public init() {
		this.app.listen(9515, () => console.log(`Express started`));
	}
}