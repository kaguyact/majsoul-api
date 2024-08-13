import * as i18n from "i18next";
import { initReactI18next } from "react-i18next";

import * as en from "../../assets/i18n/en.json";
import * as zh from "../../assets/i18n/zh.json";
import { setDayjsLocale } from "./dayjs";

const localeKey = "__riichi_locale";

const savedLocale = localStorage.getItem(localeKey);
const urlLocale = window.location.host.startsWith("cn.") ? "zh" : "en";

i18n
	.use(initReactI18next)
	.init({
		resources: {
			en: { translation: en },
			zh: { translation: zh },
		},
		fallbackLng: savedLocale ?? urlLocale,
		supportedLngs: ["en", "zh"],
		debug: process.env.NODE_ENV !== "production",
		interpolation: {
			escapeValue: false,
		}
	});

setDayjsLocale((i18n as any).language as any);

export function saveLocale(locale: string) {
	localStorage.setItem(localeKey, locale);
}

export { i18n };
