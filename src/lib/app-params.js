import { getAccessToken } from '@base44/sdk';

const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('base44_access_token');
	window.localStorage.removeItem('token');
}

/** Live session token — prefer SDK getter, then localStorage (cookie-only sessions may be empty). */
export function getSessionAccessToken() {
	try {
		const fromSdk = getAccessToken();
		if (fromSdk) return String(fromSdk);
	} catch {
		/* ignore */
	}
	if (isNode) return null;
	try {
		return (
			window.localStorage.getItem('base44_access_token') ||
			window.localStorage.getItem('token') ||
			null
		);
	} catch {
		return null;
	}
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		appId: import.meta.env.VITE_BASE44_APP_ID,
		token: getSessionAccessToken(),
		functionsVersion: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION,
		appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL,
	}
}

export const appParams = {
	...getAppParams()
}
