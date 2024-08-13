import "./bootstrap.sass";
import "./init/i18n";
import "./init/dayjs";

import type { Rest } from "backend";
import clsx from "clsx";
import * as _ from "lodash";
import * as React from "react";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import * as ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { Provider, useDispatch, useSelector } from "react-redux";
import { BrowserRouter, Link, Redirect,Route, Switch, useLocation, useParams } from "react-router-dom";
import YouTube from "react-youtube";
import { compose,createStore } from "redux";
import { persistReducer,persistStore } from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";
import storage from "redux-persist/lib/storage";

import { ActionType, MajsoulAction } from "./actions";
import { GamesRetrievedAction } from "./actions/games/GamesRetrievedAction";
import { ContestPlayersRetrievedAction } from "./actions/players/ContestPlayersRetrievedAction";
import { RiggingTokenAcquired } from "./actions/rigging/RiggingTokenAcquired";
import { fetchContestSummary } from "./api/Contests";
import { writeGoogleAuthCode } from "./api/Rigging";
import { ContestList } from "./components/ContestList";
import { ContestSessions } from "./components/ContestSessions";
import { ContestSummary } from "./components/ContestSummary";
import { RiggingLogin } from "./components/rigging/RiggingLogin";
import styles from "./components/styles.sass";
import { toRecord } from "./components/utils";
import { setDayjsLocale } from "./init/dayjs";
import { saveLocale } from "./init/i18n";
import { Contest,IState } from "./State";

function updatedContestRecord(state: IState, contestId: string, contest: Partial<Contest>): {
	contestsById: Record<string, Contest>,
} {
	const originalContest = state.contestsById[contestId] ?? {};

	return {
		contestsById: {
			...state.contestsById,
			[contestId]: {
				...originalContest,
				...contest,
			} as Contest
		}
	};
}

//todo: splatting some of these states is probably not correct and triggers changes.
function contestReducer(state: IState, action: MajsoulAction): IState {
	switch (action.type) {
		case ActionType.ContestSummaryRetrieved: {
			return _.merge(
				{},
				state,
				updatedContestRecord(state, action.contest._id, {
					...action.contest,
					teams: toRecord(action.contest.teams, "_id")
				})
			);
		} case ActionType.ContestImagesFetched: {
			return {
				...state,
				...updatedContestRecord(state, action.contest._id, {
					...action.contest,
					teams: toRecord(
						action.contest.teams?.map(team => ({
							...(state.contestsById[action.contest._id]?.teams[team._id] ?? {}),
							... {
								...team,
								image: team.image ?? null
							}
						})),
						"_id"
					)
				})
			};
		} case ActionType.GamesRetrieved: {
			const gamesRetrievedAction = action as GamesRetrievedAction;

			return {
				...state,
				games: {
					...(state.games ?? {}),
					...gamesRetrievedAction.games.reduce<Record<string, Rest.GameResult<string>>>(
						(record, next) => {
							record[next._id] = {
								...(state?.games?.[next._id] ?? {}),
								...next
							}; return record;
						}, {}
					)
				},
			};
		} case ActionType.RiggingTokenAcquired: {
			const riggingTokenGetAction = action as RiggingTokenAcquired;
			return {
				...state,
				user: {
					token: riggingTokenGetAction.token,
				}
			};
		} case ActionType.LoggedOut: {
			if (state.user) {
				return { ...state, user: undefined };
			}
			break;
		} case ActionType.TeamPatched: {
			return {
				...state,
				...updatedContestRecord(state, action.contestId, {
					teams: {
						...state.contestsById[action.contestId].teams,
						...{ [action.team._id]: { ...action.team } }
					}
				})
			};
		} case ActionType.ContestSessionsRetrieved: {
			return {
				...state,
				...updatedContestRecord(
					state,
					action.contestId,
					{
						sessionsById: toRecord(action.sessions, "_id"),
					}
				)
			};
		} case ActionType.SessionPatched: {
			return {
				...state,
				...updatedContestRecord(
					state,
					action.session.contestId,
					{
						sessionsById: {
							...(state.contestsById[action.session.contestId].sessionsById ?? {}),
							[action.session._id]: {
								...(state.contestsById[action.session.contestId].sessionsById[action.session._id] ?? {}),
								...action.session,
							}
						}
					}
				)
			};
		} case ActionType.ContestPlayersRetrieved: {
			const getContestPlayers = action as ContestPlayersRetrievedAction;
			return {
				...state,
				...updatedContestRecord(state, getContestPlayers.contestId, {
					players: getContestPlayers.players
				})
			};
		} case ActionType.ContestsIndexRetrieved: {
			return {
				...state,
				contestsById: {
					...state.contestsById,
					...toRecord(
						action.contests.map(contest => ({
							...contest,
							teams: toRecord(contest.teams, "_id"),
						} as Contest)),
						"_id"
					)
				}
			};
		} case ActionType.ContestPatched: {
			const originalContest = state.contestsById[action.contest._id];
			return {
				...state,
				...{
					contestsById: {
						...state.contestsById,
						[action.contest._id]: {
							...action.contest,
							teams: originalContest.teams,
							sessionsById: originalContest.sessionsById,
						}
					}
				}
			};
		} case ActionType.ContestCreated: {
			return {
				...state,
				...updatedContestRecord(state, action.contest._id, action.contest)
			};
		} case ActionType.TeamCreated: {
			return {
				...state,
				...updatedContestRecord(state, action.contestId, {
					teams: {
						...state.contestsById[action.contestId].teams,
						[action.team._id]: action.team
					}
				})
			};
		} case ActionType.TeamDeleted: {
			return {
				...state,
				...updatedContestRecord(state, action.contestId, {
					teams: toRecord(
						Object.values(state.contestsById[action.contestId].teams).filter(team => team._id !== action.teamId),
						"_id"
					)
				})
			};
		}
	}

	return state;
}

const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(
	persistReducer(
		{
			key: "root",
			storage,
			whitelist: ["user"]
		},
		contestReducer
	),
	{
		contestsById: {},
		musicPlayer: {
			playing: false,
			videoId: null
		},
	} as IState as any,
	composeEnhancers(),
);

const persistor = persistStore(store);

function ContestFromRoute(): JSX.Element {
	const { id } = useParams<{
		id: string;
	}>();
	return <ContestSummary contestId={id} />;
}

function LatestContestSummary(): JSX.Element {
	const dispatch = useDispatch();
	const [contestId, setContestId] = React.useState<string>();
	React.useEffect(() => {
		fetchContestSummary("featured").then(contest => {
			setContestId(contest._id);
		});
	}, [dispatch]);

	return <ContestSummary contestId={contestId} />;
}

function ContestSessionsFromRoute() {
	const { id } = useParams<{
		id: string;
	}>();
	return <ContestSessions contestId={id} />;
}

function GoogleAuthReceiver(): JSX.Element {
	const location = useLocation();
	const token = useSelector((state: IState) => state.user?.token);
	const params = new URLSearchParams(location.search);
	const code = params.get("code");
	React.useEffect(() => {
		if (token && code) {
			writeGoogleAuthCode(token, code);
		}
	}, [token, code]);
	return <Redirect to="/" />;
}

function Footer() {
	const { t, i18n } = useTranslation();

	return <Row className="mt-3 justify-content-center">
		<Col md="auto">
			<Link className="text-dark" to="/" >{t("footer.home")}</Link>
		</Col>
		<Col md="auto">
			<a className="text-dark" href="https://tv.dayaya.moe/">
				{t("footer.4chan")}
			</a>
		</Col>
		<Col md="auto">
			<a className="text-dark" href="https://qm.qq.com/q/BQ3MroTTYO">
				{t("footer.repo")}
			</a>
		</Col>
		<Col md="auto">
			<a className="text-dark" href="https://qm.qq.com/q/alePLcAm8E">
				{t("footer.source")}
			</a>
		</Col>
		<Col md="auto">
			<Link className="text-dark" to="/contests" >
				{t("footer.contests")}
			</Link>
		</Col>
		<Col md="auto">
			<div className={clsx("text-dark", styles.linkDark, styles.linkUnderline)} onClick={() => {
				const nextLocale = i18n.language === "zh" ? "en" : "zh";
				i18n.changeLanguage(nextLocale);
				saveLocale(nextLocale);
				setDayjsLocale(nextLocale);
			}}>
				{i18n.language === "zh" ? "English" : "中文"}
			</div>
		</Col>
	</Row>;
}

ReactDOM.render(
	<Provider store={store}>
		<PersistGate loading={null} persistor={persistor}>
			<BrowserRouter>
				<Container className={`${styles.feed} bg-dark px-5`}>
					<Container className={`${styles.feed} bg-primary px-3 pb-3`} style={{ display: "flex", flexDirection: "column" }}>
						<Row className="no-gutters">
							<Switch>
								<Route path="/rigging/google">
									<GoogleAuthReceiver />
								</Route>
								<Route path="/rigging">
									<RiggingLogin />
								</Route>
								<Route path="/youtube">
									<YouTube videoId="Ag7W4SSl3fc" opts={{ autoplay: 1 } as any}></YouTube>
								</Route>
								<Route path="/contests/:id/sessions">
									<ContestSessionsFromRoute />
								</Route>
								<Route path="/contests/:id">
									<ContestFromRoute />
								</Route>
								<Route path="/contests">
									<ContestList />
								</Route>
								<Route path="/">
									<LatestContestSummary />
								</Route>
							</Switch>
						</Row>
						<Row style={{ flex: "1" }}></Row>
						<Footer />
					</Container>
				</Container>
			</BrowserRouter>
		</PersistGate>
	</Provider>,
	document.getElementsByTagName("body")[0]
);
