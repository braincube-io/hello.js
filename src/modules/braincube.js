// Braincube
// Braincube services
(function(hello) {

	hello.init({

		braincube: {
			name: 'Braincube',

			oauth: {
				version: 2,
				auth: 'https://mybraincube.com/sso-server/vendors/braincube/authorize.jsp'
			},

			refresh: true,

			scope: {
				BASE: 'BASE',
				API: 'API'
			},

			scope_delim: ' ',

			base: 'https://mybraincube.com/sso-server/ws/oauth2/',

			get: {
				me: 'me',
				openSession: 'https://mybraincube.com/sso-server/rest/session/openWithToken'
			},

			xhr: formatRequest
		}
	});

	function formatRequest(p, qs) {
		// Move the access token from the request body to the request header
		var token = qs.access_token;
		delete qs.access_token;
		p.headers.Authorization = 'Bearer ' + token;

		// Format non-get requests to indicate json body
		if (p.method !== 'get' && p.data) {
			p.headers['Content-Type'] = 'application/json';
			if (typeof (p.data) === 'object') {
				p.data = JSON.stringify(p.data);
			}
		}

		if (p.method === 'put') {
			p.method = 'patch';
		}

		return true;
	}

})(hello);
