/**
 * @hello.js
 *
 * HelloJS is a client side Javascript SDK for making OAuth2 logins and subsequent REST calls.
 *
 * @author Andrew Dodson
 * @company Knarly
 *
 * @copyright Andrew Dodson, 2012 - 2013
 * @license MIT: You are free to use and modify this code for any use, on the condition that this copyright notice remains.
 */

// Can't use strict with arguments.callee
// "use strict";


//
// Setup
// Initiates the construction of the library

var hello = function(name){
	return hello.use(name);
};


hello.utils = {
	//
	// Extend the first object with the properties and methods of the second
	extend : function(a,b){
		for(var x in b){
			a[x] = b[x];
		}
	}
};



/////////////////////////////////////////////////
// Core library
// This contains the following methods
// ----------------------------------------------
// init
// login
// logout
// getAuthRequest
/////////////////////////////////////////////////

hello.utils.extend( hello, {

	//
	// Options
	settings : {

		//
		// OAuth 2 authentication defaults
		redirect_uri  : window.location.href.split('#')[0],
		response_type : 'token',
		display       : 'popup',
		state         : '',

		//
		// OAuth 1 shim
		// The path to the OAuth1 server for signing user requests
		// Wanna recreate your own? checkout https://github.com/MrSwitch/node-oauth-shim
		oauth_proxy   : 'https://auth-server.herokuapp.com/proxy',

		//
		// API Timeout, milliseconds
		timeout : 20000,

		//
		// Default Network
		default_service : null

	},


	//
	// Service
	// Get/Set the default service
	//
	service : function(service){

		//this.utils.warn("`hello.service` is deprecated");

		if(typeof (service) !== 'undefined' ){
			return this.utils.store( 'sync_service', service );
		}
		return this.utils.store( 'sync_service' );
	},


	//
	// Services
	// Collection of objects which define services configurations
	services : {},

	//
	// Use
	// Define a new instance of the Hello library with a default service
	use : function(service){
		// Create a new

		var F = function(){

			var settings = this.settings;

			// Reassign the settings
			this.settings = {
				default_service : service
			};

			// Delegate the other settings from the original settings object
			if(Object.setPrototypeOf){
				Object.setPrototypeOf(this.settings, settings);
			}
			else if(this.settings.__proto__){
				this.settings.__proto__ = settings;
			}
			else{
				// else can't extend its prototype, do the static thing
				for(var x in settings)if( settings.hasOwnProperty(x) && !( x in this.settings ) ){
					this.settings[x] = settings[x];
				}
			}
		}

		F.prototype = this;

		// Invoke as an instance
		var f = new F();

		// Create an instance of Events
		this.utils.Event.call(f);

		return f;
	},


	//
	// init
	// Define the clientId's for the endpoint services
	// @param object o, contains a key value pair, service => clientId
	// @param object opts, contains a key value pair of options used for defining the authentication defaults
	// @param number timeout, timeout in seconds
	//
	init : function(services,options){

		if(!services){
			return this.services;
		}

		// Define provider credentials
		// Reformat the ID field
		for( var x in services ){if(services.hasOwnProperty(x)){
			if( typeof(services[x]) !== 'object' ){
				services[x] = {id : services[x]};
			}
		}}

		//
		// merge services if there already exists some
		this.services = this.utils.merge(this.services, services);

		//
		// Format the incoming
		for( x in this.services ){if(this.services.hasOwnProperty(x)){
			this.services[x].scope = this.services[x].scope || {};
		}}

		//
		// Update the default settings with this one.
		if(options){
			this.settings = this.utils.merge(this.settings, options);

			// Do this immediatly incase the browser changes the current path.
			if("redirect_uri" in options){
				this.settings.redirect_uri = this.utils.realPath(options.redirect_uri);
			}
		}

		return this;
	},


	//
	// Login
	// Using the endpoint
	// @param network	stringify				name to connect to
	// @param options	object		(optional)	{display mode, is either none|popup(default)|page, scope: email,birthday,publish, .. }
	// @param callback	function	(optional)	fired on signin
	//
	login :  function(network, opts, callback){

		var p = this.utils.args({network:'s', options:'o', callback:'f'}, arguments);

		if(!(this instanceof arguments.callee)){
			// Invoke as an instance
			arguments.callee.prototype = this;
			var self = new arguments.callee(p);
			// Create an instance of Events
			this.utils.Event.call(self);
			return self;
		}

		// Apply the args
		this.args = p;

		// Local vars
		var url, self = this;

		// merge/override options with app defaults
		p.options = this.utils.merge(this.settings, p.options || {} );

		// Network
		p.network = this.settings.default_service = p.network || this.settings.default_service;

		//
		// Bind listener
		this.on('complete', p.callback);

		// Is our service valid?
		if( typeof(p.network) !== 'string' || !( p.network in this.services ) ){
			// trigger the default login.
			// ahh we dont have one.
			self.emitAfter('error complete', {error:{
				code : 'invalid_network',
				message : 'The provided network was not recognized'
			}});
			return this;
		}

		//
		var provider  = this.services[p.network];

		//
		// Callback
		// Save the callback until state comes back.
		//
		var responded = false;

		//
		// Create a global listener to capture events triggered out of scope
		var callback_id = this.utils.globalEvent(function(obj){

			//
			// Handle these response using the local
			// Trigger on the parent
			if(!obj.error){

				// Save on the parent window the new credentials
				// This fixes an IE10 bug i think... atleast it does for me.
				self.utils.store(obj.network,obj);
			}
			responded = true;

			// Trigger local complete events
			self.emit("complete success login auth.login auth", {
				network : obj.network,
				authResponse : obj
			});
		});



		//
		// QUERY STRING
		// querystring parameters, we may pass our own arguments to form the querystring
		//
		var qs = this.utils.merge( p.options, {
			client_id	: provider.id,
			scope		: 'basic',
			state		: {
				client_id	: provider.id,
				network		: p.network,
				display		: p.options.display,
				callback	: callback_id,
				state		: p.options.state,
				oauth_proxy : p.options.oauth_proxy
			}
		});

		//
		// SCOPES
		// Authentication permisions
		//
		var scope = p.options.scope;
		if(scope){
			// Format
			if(typeof(scope)!=='string'){
				scope = scope.join(',');
			}
		}
		scope = (scope ? scope + ',' : '') + qs.scope;

		// Save in the State
		qs.state.scope = scope.split(/,\s/);

		// Map replace each scope with the providers default scopes
		qs.scope = scope.replace(/[^,\s]+/ig, function(m){
			return (m in provider.scope) ? provider.scope[m] : '';
		}).replace(/[,\s]+/ig, ',');

		// remove duplication and empty spaces
		qs.scope = this.utils.unique(qs.scope.split(/,+/)).join( provider.scope_delim || ',');


		//
		// Is the user already signed in
		//
		var session = this.getAuthResponse(p.network);
		if( session && "access_token" in session && session.access_token && "expires" in session && session.expires > ((new Date()).getTime()/1e3) ){
			// What is different about the scopes in the session vs the scopes in the new login?
			var diff = this.utils.diff( session.scope || [], qs.state.scope || [] );
			if(diff.length===0){

				// Nothing has changed
				this.emit("notice", "User already has a valid access_token");

				// Ok trigger the callback
				this.emitAfter("complete success login", {
					network : p.network,
					authResponse : session
				});

				// Nothing has changed
				return this;
			}
		}

		//
		// REDIRECT_URI
		// Is the redirect_uri root?
		//
		qs.redirect_uri = this.utils.realPath(qs.redirect_uri);

		// Add OAuth to state
		if(provider.oauth){
			qs.state.oauth = provider.oauth;
		}

		// Convert state to a string
		qs.state = JSON.stringify(qs.state);


		// Sanitize
		// Remove unwanted attributes from the path
		for(var x in qs){
			if(qs.hasOwnProperty(x) && this.utils.indexOf(['response_type','redirect_uri','state', 'client_id', 'scope', 'display'], x) === -1 ){
				delete qs[x];
			}
		}


		// Bespoke
		// Override login querystrings from auth_options
		if(provider.auth_options){
			qs = this.utils.merge(qs, provider.auth_options );
		}


		//
		// URL
		//
		if( provider.oauth && parseInt(provider.oauth.version,10) === 1 ){
			// Turn the request to the OAuth Proxy for 3-legged auth
			url = this.utils.qs( p.options.oauth_proxy, qs );
		}
		else{
			url = this.utils.qs( provider.uri.auth, qs );
		}

		this.emit("notice", "Authorization URL " + url );


		//
		// Execute
		// Trigger how we want this displayed
		// Calling Quietly?
		//
		if( p.options.display === 'none' ){
			// signin in the background, iframe
			this.utils.append('iframe', { src : url, style : {position:'absolute',left:"-1000px",bottom:0,height:'1px',width:'1px'} }, 'body');
		}

		// Triggering popup?
		else if( p.options.display === 'popup'){

			// Trigger callback
			var popup = window.open(
				url,
				'Authentication',
				"resizeable=true,height=550,width=500,left="+((window.innerWidth-500)/2)+",top="+((window.innerHeight-550)/2)
			);
			// Ensure popup window has focus upon reload, Fix for FF.
			popup.focus();

			var timer = setInterval(function(){
				if(popup.closed){
					clearInterval(timer);
					if(!responded){
						self.emit("complete failed error", {error:{code:"user_cancelled", message:"Cancelled"}, network:p.network });
					}
				}
			}, 100);
		}

		else {
			window.location = url;
		}

		return this;
	},


	//
	// Logout
	// Remove any data associated with a given service
	// @param string name of the service
	// @param function callback
	//
	logout : function(s, callback){

		var p = this.utils.args({name:'s', callback:"f" }, arguments);

		if(!(this instanceof arguments.callee)){
			// Invoke as an instance
			arguments.callee.prototype = this;
			var self = new arguments.callee(p);
			// Create an instance of Events
			this.utils.Event.call(self);
			return self;
		}
		var self = this;


		// Add callback to events
		this.on('complete', p.callback);

		// Netowrk
		p.name = p.name || this.settings.default_service;

		if( p.name && !( p.name in this.services ) ){
			this.emitAfter("complete error", {error:{
				code : 'invalid_network',
				message : 'The network was unrecognized'
			}});
			return this;
		}
		if(p.name && this.utils.store(p.name)){
			this.utils.store(p.name,'');
		}
		else if(!p.name){
			for(var x in this.utils.services){if(this.utils.services.hasOwnProperty(x)){
				this.logout(x);
			}}
			// remove the default
			this.service(false);
			// trigger callback
		}
		else{
			this.emitAfter("complete error", {error:{
				code : 'invalid_session',
				message : 'There was no session to remove'
			}});
			return this;
		}

		// Emit events by default
		this.emitAfter("complete logout success auth.logout auth", true);

		return this;
	},



	//
	// getAuthResponse
	// Returns all the sessions that are subscribed too
	// @param string optional, name of the service to get information about.
	//
	getAuthResponse : function(service){

		if(!(this instanceof arguments.callee)){
			// Invoke as an instance
			arguments.callee.prototype = this;
			var self = new arguments.callee(service);
			// Create an instance of Events
			this.utils.Event.call(self);
			return self;
		}

		// If the service doesn't exist
		service = service || this.settings.default_service;

		if( !service || !( service in this.services ) ){
			this.emit("complete error", {error:{
				code : 'invalid_network',
				message : 'The network was unrecognized'
			}});
			return null;
		}


		return this.utils.store(service);
	},


	//
	// Events
	// Define placeholder for the events
	events : {}
});







///////////////////////////////////
// Core Utilities
///////////////////////////////////

hello.utils.extend( hello.utils, {

	// Append the querystring to a url
	// @param string url
	// @param object parameters
	qs : function(url, params){
		if(params){
			var reg;
			for(var x in params){
				if(url.indexOf(x)>-1){
					var str = "[\\?\\&]"+x+"=[^\\&]*";
					reg = new RegExp(str);
					url = url.replace(reg,'');
				}
			}
		}
		return url + (!this.isEmpty(params) ? ( url.indexOf('?') > -1 ? "&" : "?" ) + this.param(params) : '');
	},
	

	//
	// Param
	// Explode/Encode the parameters of an URL string/object
	// @param string s, String to decode
	//
	param : function(s){
		var b,
			a = {},
			m;
		
		if(typeof(s)==='string'){

			m = s.replace(/^[\#\?]/,'').match(/([^=\/\&]+)=([^\&]+)/g);
			this.log(m);
			if(m){
				for(var i=0;i<m.length;i++){
					b = m[i].split('=');
					a[b[0]] = decodeURIComponent( b[1] );
				}
			}
			return a;
		}
		else {
			var o = s;
		
			a = [];

			for( var x in o ){if(o.hasOwnProperty(x)){
				if( o.hasOwnProperty(x) ){
					a.push( [x, o[x] === '?' ? '?' : encodeURIComponent(o[x]) ].join('=') );
				}
			}}

			return a.join('&');
		}
	},
	

	//
	// Local Storage Facade
	store : function (name,value,days) {

		// Local storage
		var json = JSON.parse(localStorage.getItem('hello')) || {};

		if(name && typeof(value) === 'undefined'){
			return json[name];
		}
		else if(name && value === ''){
			try{
				delete json[name];
			}
			catch(e){
				json[name]=null;
			}
		}
		else if(name){
			json[name] = value;
		}
		else {
			return json;
		}

		localStorage.setItem('hello', JSON.stringify(json));

		return json;
	},


	//
	// Create and Append new Dom elements
	// @param node string
	// @param attr object literal
	// @param dom/string
	//
	append : function(node,attr,target){

		var n = typeof(node)==='string' ? document.createElement(node) : node;

		if(typeof(attr)==='object' ){
			if( "tagName" in attr ){
				target = attr;
			}
			else{
				for(var x in attr){if(attr.hasOwnProperty(x)){
					if(typeof(attr[x])==='object'){
						for(var y in attr[x]){if(attr[x].hasOwnProperty(y)){
							n[x][y] = attr[x][y];
						}}
					}
					else if(x==="html"){
						n.innerHTML = attr[x];
					}
					// IE doesn't like us setting methods with setAttribute
					else if(!/^on/.test(x)){
						n.setAttribute( x, attr[x]);
					}
					else{
						n[x] = attr[x];
					}
				}}
			}
		}
		
		if(target==='body'){
			(function self(){
				if(document.body){
					document.body.appendChild(n);
				}
				else{
					setTimeout( self, 16 );
				}
			})();
		}
		else if(typeof(target)==='object'){
			target.appendChild(n);
		}
		else if(typeof(target)==='string'){
			this.log(target);
			document.getElementsByTagName(target)[0].appendChild(n);
		}
		return n;
	},

	//
	// merge
	// recursive merge two objects into one, second parameter overides the first
	// @param a array
	//
	merge : function(a,b){
		var x,r = {};
		if( typeof(a) === 'object' && typeof(b) === 'object' ){
			for(x in a){if(a.hasOwnProperty(x)){
				r[x] = a[x];
				if(x in b){
					r[x] = this.merge( a[x], b[x]);
				}
			}}
			for(x in b){if(b.hasOwnProperty(x)){
				if(!(x in a)){
					r[x] = b[x];
				}
			}}
		}
		else{
			r = b;
		}
		return r;
	},

	//
	// Args utility
	// Makes it easier to assign parameters, where some are optional
	// @param o object
	// @param a arguments
	//
	args : function(o,args){

		var p = {},
			i = 0,
			t = null,
			x = null;
		
		// define x
		for(x in o){if(o.hasOwnProperty(x)){
			break;
		}}

		// Passing in hash object of arguments?
		// Where the first argument can't be an object
		if((args.length===1)&&(typeof(args[0])==='object')&&o[x]!='o!'){
			// return same hash.
			return args[0];
		}

		// else loop through and account for the missing ones.
		for(x in o){if(o.hasOwnProperty(x)){

			t = typeof( args[i] );

			if( ( typeof( o[x] ) === 'function' && o[x].test(args[i]) ) || ( typeof( o[x] ) === 'string' && (
					( o[x].indexOf('s')>-1 && t === 'string' ) ||
					( o[x].indexOf('o')>-1 && t === 'object' ) ||
					( o[x].indexOf('i')>-1 && t === 'number' ) ||
					( o[x].indexOf('a')>-1 && t === 'object' ) ||
					( o[x].indexOf('f')>-1 && t === 'function' )
				) )
			){
				p[x] = args[i++];
			}
			
			else if( typeof( o[x] ) === 'string' && o[x].indexOf('!')>-1 ){
				this.log("Whoops! " + x + " not defined");
				return false;
			}
		}}
		return p;
	},

	//
	// realPath
	// Converts relative URL's to fully qualified URL's
	realPath : function(path){
		if( path.indexOf('/') === 0 ){
			path = window.location.protocol + '//' + window.location.host + path;
		}
		// Is the redirect_uri relative?
		else if( !path.match(/^https?\:\/\//) ){
			path = (window.location.href.replace(/#.*/,'').replace(/\/[^\/]+$/,'/') + path).replace(/\/\.\//g,'/');
		}
		while( /\/[^\/]+\/\.\.\//g.test(path) ){
			path = path.replace(/\/[^\/]+\/\.\.\//g, '/');
		}
		return path;
	},

	//
	// diff
	diff : function(a,b){
		var r = [];
		for(var i=0;i<b.length;i++){
			if(this.indexOf(a,b[i])===-1){
				r.push(b[i]);
			}
		}
		return r;
	},

	//
	// indexOf
	// IE hack Array.indexOf doesn't exist prior to IE9
	indexOf : function(a,s){
		// Do we need the hack?
		if(a.indexOf){
			return a.indexOf(s);
		}

		for(var j=0;j<a.length;j++){
			if(a[j]===s){
				return j;
			}
		}
		return -1;
	},


	//
	// unique
	// remove duplicate and null values from an array
	// @param a array
	//
	unique : function(a){
		if(typeof(a)!=='object'){ return []; }
		var r = [];
		for(var i=0;i<a.length;i++){

			if(!a[i]||a[i].length===0||this.indexOf(r, a[i])!==-1){
				continue;
			}
			else{
				r.push(a[i]);
			}
		}
		return r;
	},


	//
	// Log
	// [@param,..]
	//
	log : function(){

		if(typeof arguments[0] === 'string'){
			arguments[0] = "HelloJS-" + arguments[0];
		}
		if (typeof(console) === 'undefined'||typeof(console.log) === 'undefined'){ return; }
		if (typeof console.log === 'function') {
			console.log.apply(console, arguments); // FF, CHROME, Webkit
		}
		else{
			console.log(Array.prototype.slice.call(arguments)); // IE
		}
	},

	// isEmpty
	isEmpty : function (obj){
		// scalar?
		if(!obj){
			return true;
		}

		// Array?
		if(obj && obj.length>0) return false;
		if(obj && obj.length===0) return true;

		// object?
		for (var key in obj) {
			if (obj.hasOwnProperty(key)){
				return false;
			}
		}
		return true;
	},

	getPrototypeOf : function(obj){
		if(Object.getPrototypeOf){
			return Object.getPrototypeOf(obj);
		}
		else if(obj.__proto__){
			return obj.__proto__;
		}
		else if(obj.prototype && obj !== obj.prototype.constructor){
			return obj.prototype.constructor;
		}
	},

	//
	// Event
	// A contructor superclass for adding event menthods, on, off, emit.
	//
	Event : function(){

		// Event list
		this.events = {};


		//
		// On, Subscribe to events
		// @param evt		string
		// @param callback	function
		//
		this.on = function(evt, callback){

			if(callback&&typeof(callback)==='function'){
				var a = evt.split(/[\s\,]+/);
				for(var i=0;i<a.length;i++){

					// Has this event already been fired on this instance?
					this.events[a[i]] = [callback].concat(this.events[a[i]]||[]);
				}
			}

			return this;
		},


		//
		// Off, Unsubscribe to events
		// @param evt		string
		// @param callback	function
		//
		this.off = function(evt, callback){

			this.findEvents(evt, function(name, index){
				if(!callback || this.events[name][index] === callback){
					this.events[name].splice(index,1);
				}
			});

			return this;
		},
		
		//
		// Emit
		// Triggers any subscribed events
		//
		this.emit =function(evt, data){

			// Get arguments as an Array, knock off the first one
			var args = Array.prototype.slice.call(arguments, 1);
			args.push(evt);

			// Find the callbacks which match the condition and call
			var proto = this;
			while( proto && proto.findEvents ){
				proto.findEvents(evt, function(name, index){
					// Replace the last property with the event name
					args[args.length-1] = name;

					// Trigger
					this.events[name][index].apply(this, args);
				});

				proto = this.utils.getPrototypeOf(proto);
			}

			return this;
		};

		//
		// Easy functions
		this.emitAfter = function(){
			var self = this,
				args = arguments;
			setTimeout(function(){
				self.emit.apply(self, args);
			},0);
			return this;
		};
		this.success = function(callback){
			return this.on("success",callback);
		};
		this.error = function(callback){
			return this.on("error",callback);
		};
		this.complete = function(callback){
			return this.on("complete",callback);
		};


		this.findEvents = function(evt, callback){

			var a = evt.split(/[\s\,]+/);

			for(var name in this.events){if(this.events.hasOwnProperty(name)){
				if( this.utils.indexOf(a,name) > -1 ){
					for(var i=0;i<this.events[name].length;i++){
						// Emit on the local instance of this
						callback.call(this, name, i);
					}
				}
			}}
		};
	},


	//
	// Global Events
	// Attach the callback to the window object
	// Return its unique reference
	globalEvent : function(callback){
		var guid = "_hellojs_"+parseInt(Math.random()*1e12,10).toString(36);
		window[guid] = function(){
			// Trigger the callback
			var bool = callback.apply(this, arguments);

			if(bool){
				// Remove this handler reference
				try{
					delete window[guid];
				}catch(e){}
			}
		};
		return guid;
	}

});



//////////////////////////////////
// Events
//////////////////////////////////

// Extend the hello object with its own event instance
hello.utils.Event.call(hello);


// Shimming old deprecated functions
hello.subscribe = hello.on;
hello.trigger = hello.emit;
hello.unsubscribe = hello.off;




///////////////////////////////////
// Monitoring session state
// Check for session changes
///////////////////////////////////

(function(hello){

	// Monitor for a change in state and fire
	var old_session = {}, pending = {};


	(function self(){
		// Loop through the services
		for(var name in hello.services){if(hello.services.hasOwnProperty(name)){

			if(!hello.services[name].id){
				// we haven't attached an ID so dont listen.
				continue;
			}
		
			// Get session
			var session = hello.utils.store(name) || {};
			var oldsess = old_session[name] || {};
			var evt = '';

			//
			// Listen for globalEvents that did not get triggered from the child
			//
			if(session && "callback" in session){

				// to do remove from session object...
				var cb = session.callback;
				try{
					delete session.callback;
				}catch(e){}

				// Update store
				// Removing the callback
				hello.utils.store(name,session);

				// Emit global events
				try{
					window[cb](session);
				}
				catch(e){}
			}
			
			//
			// Refresh login
			//
			if( session && ("expires" in session) && session.expires < ((new Date()).getTime()/1e3) ){

				if( !( name in pending ) || pending[name] < ((new Date()).getTime()/1e3) ) {
					// try to resignin
					hello.emit("notice", name + " has expired trying to resignin" );
					hello.login(name,{display:'none'});

					// update pending, every 10 minutes
					pending[name] = ((new Date()).getTime()/1e3) + 600;
				}
				// If session has expired then we dont want to store its value until it can be established that its been updated
				continue;
			}
			// Has session changed?
			else if( oldsess.access_token === session.access_token &&
						oldsess.expires === session.expires ){
				continue;
			}
			// Access_token has been removed
			else if( !session.access_token && oldsess.access_token ){
				hello.emit('auth.logout', {
					network: name,
					authResponse : session
				});
			}
			// Access_token has been created
			else if( session.access_token && !oldsess.access_token ){
				hello.emit('auth.login', {
					network: name,
					authResponse: session
				} );
			}
			// Access_token has been updated
			else if( session.expires !== oldsess.expires ){
				hello.emit('auth.update', {
					network: name,
					authResponse: session
				} );
			}
			
			old_session[name] = session;
		}}

		// Check error events
		setTimeout(self, 1000);
	})();

})(hello);








/////////////////////////////////////
//
// Save any access token that is in the current page URL
//
/////////////////////////////////////

(function(hello){

	//
	// AuthCallback
	// Trigger a callback to authenticate
	//
	function authCallback(network, obj){

		// Trigger the callback on the parent
		hello.utils.store(obj.network, obj );

		// this is a popup so
		if( !("display" in p) || p.display !== 'page'){

			// trigger window.opener
			var win = (window.opener||window.parent);

			if(win){
				// Call the generic listeners
//				win.hello.emit(network+":auth."+(obj.error?'failed':'login'), obj);
				// Call the inline listeners

				// to do remove from session object...
				var cb = obj.callback;
				try{
					delete obj.callback;
				}catch(e){}

				// Call the globalEvent function on the parent
				win[cb](obj);

				// Update store
				hello.utils.store(obj.network,obj);
			}

			window.close();
			hello.emit("notice",'Trying to close window');

			// Dont execute any more
			return;
		}
	}

	//
	// Save session, from redirected authentication
	// #access_token has come in?
	//
	// FACEBOOK is returning auth errors within as a query_string... thats a stickler for consistency.
	// SoundCloud is the state in the querystring and the rest in the hashtag
	var p = hello.utils.merge(hello.utils.param(window.location.search||''), hello.utils.param(window.location.hash||''));

	
	// if p.state
	if( p && "state" in p ){

		// remove any addition information
		// e.g. p.state = 'facebook.page';
		try{
			var a = JSON.parse(p.state);
			p = hello.utils.merge(p, a);
		}catch(e){
			hello.emit("error", "Could not decode state parameter");
		}

		// access_token?
		if( ("access_token" in p&&p.access_token) && p.network ){

			if(!p.expires_in || parseInt(p.expires_in,10) === 0){
				// If p.expires_in is unset, 1 hour, otherwise 0 = infinite, aka a month
				p.expires_in = !p.expires_id ? 3600 : (3600 * 24 * 30);
			}
			p.expires_in = parseInt(p.expires_in,10);
			p.expires = ((new Date()).getTime()/1e3) + parseInt(p.expires_in,10);

			// Make this the default users service
			hello.service( p.network );

			// Lets use the "state" to assign it to one of our networks
			authCallback( p.network, p );
		}

		//error=?
		//&error_description=?
		//&state=?
		else if( ("error" in p && p.error) && p.network ){
			// Error object
			p.error = {
				code: p.error,
				message : p.error_message || p.error_description
			};

			// Let the state handler handle it.
			authCallback( p.network, p );
		}

		// API Calls
		// IFRAME HACK
		// Result is serialized JSON string.
		if(p&&p.callback&&"result" in p && p.result ){
			// trigger a function in the parent
			if(p.callback in window.parent){
				window.parent[p.callback](JSON.parse(p.result));
			}
		}
	}

	// redefine
	p = hello.utils.param(window.location.search);

	// IS THIS AN OAUTH2 SERVER RESPONSE? OR AN OAUTH1 SERVER RESPONSE?
	if((p.code&&p.state) || (p.oauth_token&&p.proxy_url)){
		// Add this path as the redirect_uri
		p.redirect_uri = window.location.href.replace(/[\?\#].*$/,'');
		// JSON decode
		var state = JSON.parse(p.state);
		// redirect to the host
		var path = (state.oauth_proxy || p.proxy_url) + "?" + hello.utils.param(p);

		window.location = path;
	}

})(hello);



// EOF CORE lib
//////////////////////////////////







/////////////////////////////////////////
// API
// @param path		string
// @param method	string (optional)
// @param data		object (optional)
// @param timeout	integer (optional)
// @param callback	function (optional)

hello.api = function(){

	// get arguments
	var p = this.utils.args({path:'s!', method : "s", data:'o', timeout:'i', callback:"f" }, arguments);

	if(!(this instanceof arguments.callee)){
		// Invoke as an instance
		arguments.callee.prototype = this;
		return new arguments.callee(p);
	}

	// Create an instance of Events
	this.utils.Event.call(this);

	// Reference arguments
	this.args = p;

	// Reference instance
	var self = this;

	// method
	p.method = (p.method || 'get').toLowerCase();
	
	// data
	p.data = p.data || {};

	// Extrapolate the data from a form element
	this.utils.dataToJSON(p);

	// Path
	p.path = p.path.replace(/^\/+/,'');
	var a = (p.path.split(/[\/\:]/,2)||[])[0].toLowerCase();

	if(a in this.services){
		p.network = a;
		var reg = new RegExp('^'+a+':?\/?');
		p.path = p.path.replace(reg,'');
	}

	// Network
	p.network = this.settings.default_service = p.network || this.settings.default_service;

	// callback
	this.on('complete', p.callback);
	
	// timeout global setting
	if(p.timeout){
		this.settings.timeout = p.timeout;
	}

	// Log this request
	this.emit("notice", "API request "+p.method.toUpperCase()+" '"+p.path+"' (request)",p);
	
	var o = this.services[p.network];
	
	// Have we got a service
	if(!o){
		self.emitAfter("complete error", {error:{
			code : "invalid_network",
			message : "Could not match the service requested: " + p.network
		}});
		return this;
	}

	//
	// Callback wrapper?
	// Change the incoming values so that they are have generic values according to the path that is defined
	var callback = function(r,code){
		if( o.wrap && ( (p.path in o.wrap) || ("default" in o.wrap) )){
			var wrap = (p.path in o.wrap ? p.path : "default");
			var time = (new Date()).getTime();
			r = o.wrap[wrap](r,code);
			self.emit("notice", "Processing took" + ((new Date()).getTime() - time));
		}
		self.emit("notice", "API: "+p.method.toUpperCase()+" '"+p.path+"' (response)", r);

		// Emit the correct event
		self.emit("complete " + (!r || "error" in r ? 'error' : 'success'), r, code);
	};

	// push out to all networks
	// as long as the path isn't flagged as unavaiable, e.g. path == false
	if( !(p.path in o.uri) || o.uri[p.path] !== false ){

		var url = (p.path in o.uri ?
					o.uri[p.path] :
					( o.uri['default'] ? o.uri['default'] : p.path));

		// if url needs a base
		// Wrap everything in
		var getPath = function(url){

			if( !url.match(/^https?:\/\//) ){
				url = o.uri.base + url;
			}


			var qs = {};

			// Format URL
			var format_url = function( qs_handler, callback ){

				// Execute the qs_handler for any additional parameters
				if(qs_handler){
					if(typeof(qs_handler)==='function'){
						qs_handler(qs);
					}
					else{
						qs = self.utils.merge(qs, qs_handler);
					}
				}

				var path = self.utils.qs(url, qs||{} );

				self.emit("notice", "Request " + path);

				_sign(p.network, path, p.method, p.data, o.querystring, callback);
			};


			// Update the resource_uri
			//url += ( url.indexOf('?') > -1 ? "&" : "?" );

			// Format the data
			if( !self.utils.isEmpty(p.data) && !self.utils.dataToJSON(p) ){
				// If we can't format the post then, we are going to run the iFrame hack
				self.utils.post( format_url, p.data, ("post" in o ? o.post(p) : null), callback );

				return self;
			}

			// the delete callback needs a better response
			if(p.method === 'delete'){
				var _callback = callback;
				callback = function(r, code){
					_callback((!r||self.utils.isEmpty(r))? {response:'deleted'} : r, code);
				};
			}

			// Can we use XHR for Cross domain delivery?
			if( 'withCredentials' in new XMLHttpRequest() && ( !("xhr" in o) || ( o.xhr && o.xhr(p,qs) ) ) ){
				var x = self.utils.xhr( p.method, format_url, p.headers, p.data, callback );
				x.onprogress = function(e){
					self.emit("progress", e);
				};
				x.upload.onprogress = function(e){
					self.emit("uploadprogress", e);
				};
			}
			else{

				// Otherwise we're on to the old school, IFRAME hacks and JSONP
				// Preprocess the parameters
				// Change the p parameters
				if("jsonp" in o){
					o.jsonp(p,qs);
				}

				// Is this still a post?
				if( p.method === 'post' ){

					// Add some additional query parameters to the URL
					// We're pretty stuffed if the endpoint doesn't like these
					//			"suppress_response_codes":true
					qs.redirect_uri = self.settings.redirect_uri;
					qs.state = JSON.stringify({callback:'?'});

					self.utils.post( format_url, p.data, ("post" in o ? o.post(p) : null), callback, self.settings.timeout );
				}

				// Make the call
				else{

					qs = self.utils.merge(qs,p.data);
					qs.callback = '?';

					self.utils.jsonp( format_url, callback, self.settings.timeout );
				}
			}
		};

		// Make request
		if(typeof(url)==='function'){
			url(p, getPath);
		}
		else{
			getPath(url);
		}
	}
	else{
		this.emitAfter("complete error", {error:{
			code:'invalid_path',
			message:'The provided path is not available on the selected network'
		}});
	}

	return this;


	//
	// Add authentication to the URL
	function _sign(network, path, method, data, modifyQueryString, callback){

		// OAUTH SIGNING PROXY
		var session = self.getAuthResponse(network),
			service = self.services[network],
			token = (session ? session.access_token : null);

		// Is this an OAuth1 endpoint
		var proxy = ( service.oauth && parseInt(service.oauth.version,10) === 1 ? self.settings.oauth_proxy : null);

		if(proxy){
			// Use the proxy as a path
			callback( self.utils.qs(proxy, {
				path : path,
				access_token : token||''
			}));

			return;
		}

		var qs = { 'access_token' : token||'' };

		if(modifyQueryString){
			modifyQueryString(qs);
		}

		callback(  self.utils.qs( path, qs) );
	}

};










///////////////////////////////////
// API Utilities
///////////////////////////////////

hello.utils.extend( hello.utils, {

	//
	// isArray
	isArray : function (o){
		return Object.prototype.toString.call(o) === '[object Array]';
	},


	// _DOM
	// return the type of DOM object
	domInstance : function(type,data){
		var test = "HTML" + (type||'').replace(/^[a-z]/,function(m){return m.toUpperCase();}) + "Element";
		if(window[test]){
			return data instanceof window[test];
		}else if(window.Element){
			return data instanceof window.Element && (!type || data.tagName === type);
		}else{
			return (!(data instanceof Object||data instanceof Array||data instanceof String||data instanceof Number) && data.tagName && data.tagName === type );
		}
	},

	//
	// XHR
	// This uses CORS to make requests
	xhr : function(method, pathFunc, headers, data, callback){

		var utils = this;

		if(typeof(pathFunc)!=='function'){
			var path = pathFunc;
			pathFunc = function(qs, callback){callback(utils.qs( path, qs ));};
		}

		var r = new XMLHttpRequest();

		// Binary?
		var binary = false;
		if(method==='blob'){
			binary = method;
			method = 'GET';
		}
		// UPPER CASE
		method = method.toUpperCase();

		// xhr.responseType = "json"; // is not supported in any of the vendors yet.
		r.onload = function(e){
			var json = r.response;
			try{
				json = JSON.parse(r.responseText);
			}catch(_e){
				if(r.status===401){
					json = {
						error : {
							code : "access_denied",
							message : r.statusText
						}
					};
				}
			}


			callback( json || ( method!=='DELETE' ? {error:{message:"Could not get resource"}} : {} ), r.status );
		};
		r.onerror = function(e){
			var json = r.responseText;
			try{
				json = JSON.parse(r.responseText);
			}catch(_e){}

			callback(json||{error:{
				code: "access_denied",
				message: "Could not get resource"
			}});
		};

		var qs = {}, x;

		// Should we add the query to the URL?
		if(method === 'GET'||method === 'DELETE'){
			if(!this.isEmpty(data)){
				qs = this.merge(qs, data);
			}
			data = null;
		}
		else if( data && typeof(data) !== 'string' && !(data instanceof FormData)){
			// Loop through and add formData
			var f = new FormData();
			for( x in data )if(data.hasOwnProperty(x)){
				if( data[x] instanceof HTMLInputElement ){
					if( "files" in data[x] && data[x].files.length > 0){
						f.append(x, data[x].files[0]);
					}
				}
				else{
					f.append(x, data[x]);
				}
			}
			data = f;
		}

		// Create url

		pathFunc(qs, function(url){

			// Open the path, async
			r.open( method, url, true );

			if(binary){
				if("responseType" in r){
					r.responseType = binary;
				}
				else{
					r.overrideMimeType("text/plain; charset=x-user-defined");
				}
			}

			// Set any bespoke headers
			if(headers){
				for(var x in headers){
					r.setRequestHeader(x, headers[x]);
				}
			}

			r.send( data );
		});


		return r;
	},


	//
	// JSONP
	// Injects a script tag into the dom to be executed and appends a callback function to the window object
	// @param string/function pathFunc either a string of the URL or a callback function pathFunc(querystringhash, continueFunc);
	// @param function callback a function to call on completion;
	//
	jsonp : function(pathFunc,callback,timeout){

		var utils = this;

		// Change the name of the callback
		var bool = 0,
			head = document.getElementsByTagName('head')[0],
			operafix,
			script,
			result = {error:{message:'server_error',code:'server_error'}},
			cb = function(){
				if( !( bool++ ) ){
					window.setTimeout(function(){
						callback(result);
						head.removeChild(script);
					},0);
				}
			};

		// Add callback to the window object
		var cb_name = this.globalEvent(function(json){
			result = json;
			return true; // mark callback as done
		});

		// The URL is a function for some cases and as such
		// Determine its value with a callback containing the new parameters of this function.
		if(typeof(pathFunc)!=='function'){
			var path = pathFunc;
			path = path.replace(new RegExp("=\\?(&|$)"),'='+cb_name+'$1');
			pathFunc = function(qs, callback){ callback(utils.qs(path, qs));};
		}


		pathFunc(function(qs){
				for(var x in qs){ if(qs.hasOwnProperty(x)){
					if (qs[x] === '?') qs[x] = cb_name;
				}}
			}, function(url){

			// Build script tag
			script = utils.append('script',{
				id:cb_name,
				name:cb_name,
				src: url,
				async:true,
				onload:cb,
				onerror:cb,
				onreadystatechange : function(){
					if(/loaded|complete/i.test(this.readyState)){
						cb();
					}
				}
			});

			// Opera fix error
			// Problem: If an error occurs with script loading Opera fails to trigger the script.onerror handler we specified
			// Fix:
			// By setting the request to synchronous we can trigger the error handler when all else fails.
			// This action will be ignored if we've already called the callback handler "cb" with a successful onload event
			if( window.navigator.userAgent.toLowerCase().indexOf('opera') > -1 ){
				operafix = utils.append('script',{
					text:"document.getElementById('"+cb_name+"').onerror();"
				});
				script.async = false;
			}

			// Add timeout
			if(timeout){
				window.setTimeout(function(){
					result = {error:{message:'timeout',code:'timeout'}};
					cb();
				}, timeout);
			}

			// Todo:
			// Add fix for msie,
			// However: unable recreate the bug of firing off the onreadystatechange before the script content has been executed and the value of "result" has been defined.
			// Inject script tag into the head element
			head.appendChild(script);
			
			// Append Opera Fix to run after our script
			if(operafix){
				head.appendChild(operafix);
			}

		});
	},


	//
	// Post
	// Send information to a remote location using the post mechanism
	// @param string uri path
	// @param object data, key value data to send
	// @param function callback, function to execute in response
	//
	post : function(pathFunc, data, options, callback, timeout){

		var utils = this;

		// The URL is a function for some cases and as such
		// Determine its value with a callback containing the new parameters of this function.
		if(typeof(pathFunc)!=='function'){
			var path = pathFunc;
			pathFunc = function(qs, callback){ callback(utils.qs(path, qs));};
		}

		// This hack needs a form
		var form = null,
			reenableAfterSubmit = [],
			newform,
			i = 0,
			x = null,
			bool = 0,
			cb = function(r){
				if( !( bool++ ) ){
					try{
						// remove the iframe from the page.
						//win.parentNode.removeChild(win);
						// remove the form
						if(newform){
							newform.parentNode.removeChild(newform);
						}
					}
					catch(e){
						try{
							console.error("HelloJS: could not remove iframe");
						}
						catch(ee){}
					}

					// reenable the disabled form
					for(var i=0;i<reenableAfterSubmit.length;i++){
						if(reenableAfterSubmit[i]){
							reenableAfterSubmit[i].setAttribute('disabled', false);
						}
					}

					// fire the callback
					callback(r);

					// Do not return true, as that will remove the listeners
					// return true;
				}
			};

		// What is the name of the callback to contain
		// We'll also use this to name the iFrame
		var callbackID = this.globalEvent(cb);

		// Build the iframe window
		var win;
		try{
			// IE7 hack, only lets us define the name here, not later.
			win = document.createElement('<iframe name="'+callbackID+'">');
		}
		catch(e){
			win = document.createElement('iframe');
		}

		win.name = callbackID;
		win.id = callbackID;
		win.style.display = 'none';

		// Override callback mechanism. Triggger a response onload/onerror
		if(options&&options.callbackonload){
			// onload is being fired twice
			win.onload = function(){
				cb({
					response : "posted",
					message : "Content was posted"
				});
			};
		}

		if(timeout){
			setTimeout(function(){
				cb({
					error : {
						code:"timeout",
						message : "The post operation timed out"
					}
				});
			}, timeout);
		}

		document.body.appendChild(win);


		// if we are just posting a single item
		if( utils.domInstance('form', data) ){
			// get the parent form
			form = data.form;
			// Loop through and disable all of its siblings
			for( i = 0; i < form.elements.length; i++ ){
				if(form.elements[i] !== data){
					form.elements[i].setAttribute('disabled',true);
				}
			}
			// Move the focus to the form
			data = form;
		}

		// Posting a form
		if( utils.domInstance('form', data) ){
			// This is a form element
			form = data;

			// Does this form need to be a multipart form?
			for( i = 0; i < form.elements.length; i++ ){
				if(!form.elements[i].disabled && form.elements[i].type === 'file'){
					form.encoding = form.enctype = "multipart/form-data";
					form.elements[i].setAttribute('name', 'file');
				}
			}
		}
		else{
			// Its not a form element,
			// Therefore it must be a JSON object of Key=>Value or Key=>Element
			// If anyone of those values are a input type=file we shall shall insert its siblings into the form for which it belongs.
			for(x in data) if(data.hasOwnProperty(x)){
				// is this an input Element?
				if( utils.domInstance('input', data[x]) && data[x].type === 'file' ){
					form = data[x].form;
					form.encoding = form.enctype = "multipart/form-data";
				}
			}

			// Do If there is no defined form element, lets create one.
			if(!form){
				// Build form
				form = document.createElement('form');
				document.body.appendChild(form);
				newform = form;
			}

			// Add elements to the form if they dont exist
			for(x in data) if(data.hasOwnProperty(x)){

				// Is this an element?
				var el = ( utils.domInstance('input', data[x]) || utils.domInstance('textArea', data[x]) || utils.domInstance('select', data[x]) );

				// is this not an input element, or one that exists outside the form.
				if( !el || data[x].form !== form ){

					// Does an element have the same name?
					if(form.elements[x]){
						// Remove it.
						form.elements[x].parentNode.removeChild(form.elements[x]);
					}

					// Create an input element
					var input = document.createElement('input');
					input.setAttribute('type', 'hidden');
					input.setAttribute('name', x);

					// Does it have a value attribute?
					if(el){
						input.value = data[x].value;
					}
					else if( utils.domInstance(null, data[x]) ){
						input.value = data[x].innerHTML || data[x].innerText;
					}else{
						input.value = data[x];
					}

					form.appendChild(input);
				}
				// it is an element, which exists within the form, but the name is wrong
				else if( el && data[x].name !== x){
					data[x].setAttribute('name', x);
					data[x].name = x;
				}
			}

			// Disable elements from within the form if they weren't specified
			for(i=0;i<form.children.length;i++){
				// Does the same name and value exist in the parent
				if( !( form.children[i].name in data ) && form.children[i].getAttribute('disabled') !== true ) {
					// disable
					form.children[i].setAttribute('disabled',true);
					// add re-enable to callback
					reenableAfterSubmit.push(form.children[i]);
				}
			}
		}


		// Set the target of the form
		form.setAttribute('method', 'POST');
		form.setAttribute('target', callbackID);
		form.target = callbackID;


		// Call the path
		pathFunc( {}, function(url){

			// Replace the second '?' with the callback_id


			form.setAttribute('action', url);

			// Submit the form
			setTimeout(function(){
				form.submit();
			},100);
		});

		// Build an iFrame and inject it into the DOM
		//var ifm = _append('iframe',{id:'_'+Math.round(Math.random()*1e9), style:shy});
		
		// Build an HTML form, with a target attribute as the ID of the iFrame, and inject it into the DOM.
		//var frm = _append('form',{ method: 'post', action: uri, target: ifm.id, style:shy});

		// _append('input',{ name: x, value: data[x] }, frm);
	},


	//
	// Some of the providers require that only MultiPart is used with non-binary forms.
	// This function checks whether the form contains binary data
	hasBinary : function (data){
		for(var x in data ) if(data.hasOwnProperty(x)){
			if( (this.domInstance('input', data[x]) && data[x].type === 'file')	||
				("FileList" in window && data[x] instanceof window.FileList) ||
				("File" in window && data[x] instanceof window.File) ||
				("Blob" in window && data[x] instanceof window.Blob)
			){
				return true;
			}
		}
		return false;
	},

	//
	// dataToJSON
	// This takes a FormElement and converts it to a JSON object
	//
	dataToJSON : function (p){

		var utils = this;

		var data = p.data;

		// Is data a form object
		if( this.domInstance('form', data) ){
			// Get the first FormElement Item if its an type=file
			var kids = data.elements;

			var json = {};

			// Create a data string
			for(var i=0;i<kids.length;i++){

				var input = kids[i];

				// If the name of the input is empty or diabled, dont add it.
				if(input.disabled||!input.name){
					continue;
				}

				// Is this a file, does the browser not support 'files' and 'FormData'?
				if( input.type === 'file' ){
					// the browser does not XHR2
					if("FormData" in window){
						// include the whole element
						json[input.name] = input;
						continue;
					}
					else if( !("files" in input) ){

						// Cancel this approach the browser does not support the FileAPI
						return false;
					}
				}
				else{
					json[ input.name ] = input.value || input.innerHTML;
				}
			}

			// Convert to a postable querystring
			data = json;
		}

		// Is this a form input element?
		if( this.domInstance('input', data) ){
			// Get the Input Element
			// Do we have a Blob data?
			if("files" in data){

				var o = {};
				o[ data.name ] = data.files;
				// Turn it into a FileList
				data = o;
			}
			else{
				// This is old school, we have to perform the FORM + IFRAME + HASHTAG hack
				return false;
			}
		}

		// Is data a blob, File, FileList?
		if( ("File" in window && data instanceof window.File) ||
			("Blob" in window && data instanceof window.Blob) ||
			("FileList" in window && data instanceof window.FileList) ){

			// Convert to a JSON object
			data = {'file' : data};
		}

		// Loop through data if its not FormData it must now be a JSON object
		if( !( "FormData" in window && data instanceof window.FormData ) ){

			// Loop through the object
			for(var x in data) if(data.hasOwnProperty(x)){

				// FileList Object?
				if("FileList" in window && data[x] instanceof window.FileList){
					// Get first record only
					if(data[x].length===1){
						data[x] = data[x][0];
					}
					else{
						utils.log("We were expecting the FileList to contain one file");
					}
				}
				else if( this.domInstance('input', data[x]) && data[x].type === 'file' ){

					if( ( "files" in data[x] ) ){
						// this supports HTML5
						// do nothing
					}
					else{
						// this does not support HTML5 forms FileList
						return false;
					}
				}
				else if( this.domInstance('input', data[x]) ||
					this.domInstance('select', data[x]) ||
					this.domInstance('textArea', data[x])
					){
					data[x] = data[x].value;
				}
				else if( this.domInstance(null, data[x]) ){
					data[x] = data[x].innerHTML || data[x].innerText;
				}
			}
		}

		// Data has been converted to JSON.
		p.data = data;

		return true;
	}
});