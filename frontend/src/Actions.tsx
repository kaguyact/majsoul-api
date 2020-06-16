import { Action } from "redux";
import { Store, Rest } from "majsoul-api";
import { ThunkAction } from "redux-thunk";
import { IState } from "./IState";

export type AppThunk<AType extends Action<ActionType>, TReturn = void> =  ThunkAction<TReturn, IState, unknown, AType>;

export enum ActionType {
	ContestSummaryRetrieved,
	SessionGamesRetrieved
}

export interface SummaryRetrievedAction extends Action<ActionType.ContestSummaryRetrieved>{
	contest: Rest.Contest<string>;
}

export interface SessionGamesRetrieved extends Action<ActionType.SessionGamesRetrieved>{
	sessionId: string;
	games: Store.GameResult[];
}