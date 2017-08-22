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
				me: 'me'
			},

			xhr: formatRequest
		}
	});

	function formatRequest(p, qs) {
		// Move the access token from the request body to the request header
		var token = qs.access_token;
		delete qs.access_token;
		p.headers.Authorization = 'Bearer ' + token;

		return true;
	}

})(hello);
