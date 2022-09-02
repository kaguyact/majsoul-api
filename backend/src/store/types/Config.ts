import { Cookie } from "./Cookie.js";

export interface Config<Id = any> {
	_id?: Id;
	featuredContest?: Id;
	googleRefreshToken?: string;
	loginCookies?: Cookie[];
	userAgent?: string;
	passportToken?: string;
}
