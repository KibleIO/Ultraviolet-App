import createBareServer from "@tomphttp/bare-server-node";
import express from "express";
import HttpsProxyAgent from 'https-proxy-agent';
import { createServer } from "node:http";
import { publicPath } from "ultraviolet-static";
import { hostname } from "node:os";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import NodeCache from "node-cache";
import bodyParser from "body-parser";

var PROTO_PATH = '/root/new_stuff/go-monorepo/proto-monorepo/idl/kible.io/gaia/eris.proto';
//var PROTO_PATH = '/Users/kevin/github/Gaia/idl/eris.proto';
var packageDefinition = protoLoader.loadSync(
PROTO_PATH,
{keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: ['/root/new_stuff/go-monorepo/proto-monorepo/idl/kible.io/']
});
var eris = grpc.loadPackageDefinition(packageDefinition).kible.gaia;

const userCache = new NodeCache( { stdTTL: 120000, checkperiod: 600 } );

const httpProxyAgent = new HttpsProxyAgent('http://216.98.233.166:6746');

const bare = createBareServer("/bare/", {
	httpAgent: httpProxyAgent,
	httpsAgent: httpProxyAgent,
});
const app = express();

app.use(express.json({limit: '50mb'}));
//app.use(bodyParser.json({limit: '50mb'}));

function addslashes( str ) {
	return (str + '').replace(/\\/g, '\\\\');
}

app.post('/hello/get', (req, res) => {
	/*
	var uuid = "3ec20dd0-35ca-412d-b47e-082bf41d5af4";

	var client = new eris.ERIS('172.50.0.8:44206', grpc.credentials.createInsecure());

	function updateStreamingAccountCallback(error, streamingAccount) {
		if (error) {
			console.log("error update streaming account");
		} else {
			console.log("success");
			res.send("{}");
		}
	}

	function readStreamingAccountCallback(error, streamingAccount) {
		if (error) {
			console.log("error reading streaming account");
		} else {
			
			streamingAccount.streamingAccount.cookie.cookie = JSON.stringify(req.body);

			var updateStreamingAccountRequest = {
				streamingAccount: streamingAccount.streamingAccount
			};
			client.UpdateStreamingAccount(updateStreamingAccountRequest,
				updateStreamingAccountCallback);
		}
	}
	var readStreamingAccountRequest = {
		streamingAccountID: {
			uuid: {
				value: uuid
			}
		}
	};
	client.ReadStreamingAccount(readStreamingAccountRequest,
		readStreamingAccountCallback);
	*/

	//console.log("infawdadao: ", getXForwardedFor(req), getAlienSessionCookie(req));

	var value = userCache.get(getXForwardedFor(req));
	//var value = userCache.get(getAlienSessionCookie(req));

	if (value != undefined && value.session.cookie != undefined) {
		if (value.session.cookie.cookieType == "COOKIETYPE_LOCALSTORAGE") {
			res.send(value.session.cookie.cookie);
			return;
		}
	}

	res.send("{}");
	
});

// Load our publicPath first and prioritize it over UV.
app.use("/hello/", express.static(publicPath));

// Error for everything else
app.use((req, res) => {
	res.redirect('/');
});

const server = createServer();

function printCookie(req) {
	if ('x-bare-headers' in req.headers) {
		var bareHeaders = JSON.parse(req.headers['x-bare-headers']);
		if ('cookie' in bareHeaders) {
			console.log(bareHeaders['cookie']);
		}
	}
}

function injectCookie(req, cookie) {
	if ('x-bare-headers' in req.headers) {
		var bareHeaders = JSON.parse(req.headers['x-bare-headers']);
		if ('cookie' in bareHeaders) {
			bareHeaders['cookie'] = cookie;
			req.headers['x-bare-headers'] = JSON.stringify(bareHeaders);
		}
	}
}

function isRequestFromHost(req, host) {
	if ('x-bare-headers' in req.headers) {
		var bareHeaders = JSON.parse(req.headers['x-bare-headers']);
		return bareHeaders['Host'].includes(host);
	}
}

function getXForwardedFor(req) {
	if (req == undefined || !req.hasOwnProperty("rawHeaders")) {
		console.log("no headers");
		return "";
	}

	var headers = arrayToKeyValue(req.rawHeaders);

	if ('cf-connecting-ip' in headers) {
		return headers['cf-connecting-ip'];
	}

	if ('Cf-Connecting-Ip' in headers) {
		return headers['Cf-Connecting-Ip'];
	}

	if ('x-forwarded-for' in headers) {
		return headers['x-forwarded-for'];
	}

	if ('X-Forwarded-For' in headers) {
		return headers['X-Forwarded-For'];
	}

	return "";
}

function getAlienSessionCookie(req) {
	if (req == undefined || !req.hasOwnProperty("rawHeaders")) {
		return "";
	}

	var headers = arrayToKeyValue(req.rawHeaders);

	var actualCookie = "";
	if (headers.hasOwnProperty("cookie")) {
		var cookie = headers.cookie.split("alien_session=");
		if (cookie.length >= 2) {
			actualCookie = cookie[1].split(";")[0];
		}
	}
	if (headers.hasOwnProperty("Cookie")) {
		var cookie = headers.Cookie.split("alien_session=");
		if (cookie.length >= 2) {
			actualCookie = cookie[1].split(";")[0];
		}
	}
	return actualCookie;
}

function arrayToKeyValue(array123) {
	let updated = [];
	for (let i = 0; i < array123.length; i += 2) {
		updated[array123[i]] = array123[i + 1];
	}
	return updated;
}

function getRedirectUrl(req) {
	var redirectUrl = "https://alienhub.xyz";

	if (req == undefined || !req.hasOwnProperty("rawHeaders")) {
		return redirectUrl;
	}

	var headers = arrayToKeyValue(req.rawHeaders);

	if (headers.hasOwnProperty("Host")) {
		redirectUrl = 'https://' + headers.Host;
	}
	return redirectUrl;
}

function handleRequest(req, res) {
	if (bare.shouldRoute(req)) {
		var value = userCache.get(getXForwardedFor(req));

		if (value != undefined && value.session.cookie != undefined) {
			if (value.session.cookie.cookieType == "COOKIETYPE_INJECTED") {
				injectCookie(req, value.session.cookie.cookie);
			}
		}

		bare.routeRequest(req, res);
	} else {
		app(req, res);
	}
}

server.on("request", (req, res) => {
	var value = userCache.get(getXForwardedFor(req));
	//var value = userCache.get(getAlienSessionCookie(req));
	var needsRefresh = (req.url == "/hello" || req.url == "/hello/" ||
		req.url.startsWith("/hello/?url") || 
		req.url.startsWith("/hello?url")) && req.method == "GET";

	if (value == undefined || needsRefresh) {
		var actualCookie = getAlienSessionCookie(req);
		
		var client = new eris.ERIS('172.50.0.8:44206',
			grpc.credentials.createInsecure());

		function readSessionCallback(error, session) {
			if (error) {
				res.writeHead(302, {
				'Location': getRedirectUrl(req)
				});
				res.end();
			} else {
				userCache.set(getXForwardedFor(req), session);
				//userCache.set(getAlienSessionCookie(req), session);

				handleRequest(req, res);
			}
		}
		var readSessionRequest = {
			sessionID: {
				uuid: {
					value: actualCookie
				}
			}
		};
		client.ReadSession(readSessionRequest, readSessionCallback);
	} else {
		handleRequest(req, res);
	}
	
	
	/*
	if (bare.shouldRoute(req)) {
		if (isRequestFromHost(req, "netflix")) {
			printCookie(req);
		}
		
		bare.routeRequest(req, res);
	} else {
		app(req, res);
	}
	*/
	
});

server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

server.on("listening", () => {
  const address = server.address();

  // by default we are listening on 0.0.0.0 (every interface)
  // we just need to list a few
  console.log("Listening on:");
  console.log(`\thttp://localhost:${address.port}`);
  console.log(`\thttp://${hostname()}:${address.port}`);
  console.log(
    `\thttp://${
      address.family === "IPv6" ? `[${address.address}]` : address.address
    }:${address.port}`
  );
});

server.listen({
  port,
});
