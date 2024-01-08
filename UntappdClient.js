/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
//
// UntappdClient v4
//
// By Glen R. Goodwin
// twitter: @areinet
//

const QS = require('querystring');
const HTTPS = require('https');

// eslint-disable-next-line func-names
const UntappdClient = function (debug) {
  const that = this;

  let id; let secret; let
    token;

  const setClientId = (clientId) => {
    id = clientId;
    return that;
  };
  that.setClientId = setClientId;

  const getClientId = () => id;
  that.getClientId = getClientId;

  const setClientSecret = function (clientSecret) {
    secret = clientSecret;
    return that;
  };
  that.setClientSecret = setClientSecret;

  const getClientSecret = () => secret;
  that.getClientSecret = getClientSecret;

  const setAccessToken = function (accessToken) {
    token = accessToken;
    return that;
  };
  that.setAccessToken = setAccessToken;

  const getAccessToken = () => token;
  that.getAccessToken = getAccessToken;

  const req = (method, path, params, data, callback) => {
    if (params && params.constructor === 'function' && !callback) {
      callback = params;
      params = {};
    }
    if (!params) params = {};

    const options = {
      host: 'api.untappd.com',
      port: 443,
      path,
      method,
    };

    if (method === 'POST') {
      data = QS.stringify(data);
      options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length,
      };
    }

    Object.keys(params).forEach((k) => {
      if (params[k] === undefined || params[k] === null) delete params[k];
    });

    if (token) {
      params.access_token = token;
    } else {
      if (id) params.client_id = id;
      if (secret) params.client_secret = secret;
    }
    if (params) options.path += `?${QS.stringify(params)}`;

    if (debug) console.log(`node-untappd: get : ${options.path}`);

    if (debug) {
      console.log('\nRequest');
      console.log(options);
      console.log(params);
      console.log(data);
    }

    const request = HTTPS.request(options, (response) => {
      response.setEncoding('utf8');
      data = '';
      response.on('data', (incoming) => {
        if (debug) console.log('node-untappd: data: ', incoming.length);
        data += incoming;
      });
      response.on('end', (incoming) => {
        if (debug) console.log('node-untappd: end: ', incoming ? incoming.length : 0);
        data += incoming || '';
        const obj = JSON.parse(data);
        callback.call(that, null, obj);
      });
      response.on('error', (...args) => {
        if (debug) console.log('node-untappd: error: ', args);
        callback.call(that, args, null);
      });
    });
    request.on('error', (...args) => {
      if (debug) console.log('node-untappd: error: ', args);
      callback.call(that, args, null);
    });
    if (method === 'POST') {
      request.write(data);
    }
    request.end();
    return request;
  };

  const post = (path, params, data, callback) => req('POST', path, params, data, callback);

  const get = (path, params, callback) => req('GET', path, params, null, callback);

  const hasToken = () => !!token;

  const hasId = () => !!id;

  const hasSecret = () => !!secret;

  function validate(param, key) {
    const message = `${key} cannot be undefined or null.`;
    return (param) ? null : new Error(message);
  }

  function authorized(tokenOnly) {
    if (debug) {
      console.log(getClientId(), getClientSecret(), getAccessToken());
    }

    tokenOnly = (tokenOnly === undefined) ? false : tokenOnly;
    const caller = arguments.callee.caller.name;

    if (tokenOnly && !hasToken()) throw new Error(`UntappdClient.${caller} requires an AccessToken.`);
    if (!hasToken() && !(hasId() && hasSecret())) throw new Error(`UntappdClient.${caller} requires an AccessToken or a ClientId/ClientSecret pair.`);
  }

  // OAUTH Stuff

  // We use the basic oauth redirect method from untappd.
  // this url can be used in the browser to get the access token
  that.getUserAuthenticationURL = (returnRedirectionURL) => {
    validate(returnRedirectionURL, 'returnRedirectionURL');
    if (!hasId()) throw new Error('UntappdClient.getUserAuthenticationURL requires a ClientId');
    return `https://untappd.com/oauth/authenticate/?client_id=${id}&response_type=token&redirect_url=${returnRedirectionURL}`;
  };

  // this is for server-side, Step 1 - OAUTH Authentication
  that.getAuthenticationURL = (returnRedirectionURL) => {
    validate(returnRedirectionURL, 'returnRedirectionURL');
    if (!hasId()) throw new Error('UntappdClient.getUserAuthenticationURL requires a ClientId');
    return `https://untappd.com/oauth/authenticate/?client_id=${id}&response_type=code&redirect_url=${returnRedirectionURL}&code=COD`;
  };

  // Step 2 - OATUH Authorization
  that.getAuthorizationURL = (returnRedirectionURL, code) => {
    validate(returnRedirectionURL, 'returnRedirectionURL');
    if (!hasId() || !hasSecret()) throw new Error('UntappdClient.getUserAuthenticationURL requires a ClientId/ClientSecret pair.');
    return `https://untappd.com/oauth/authorize/?client_id=${id}&client_secret=${secret}&response_type=code&redirect_url=${returnRedirectionURL}&code=${code}`;
  };

  // The FEEDS

  // https://untappd.com/api/docs#activityfeed
  that.activityFeed = (callback, data) => {
    data = data || {};
    validate(callback, 'callback');
    authorized(true);
    return get('/v4/checkin/recent', data, callback);
  };

  // https://untappd.com/api/docs#useractivityfeed
  that.userActivityFeed = (callback, data) => {
    data = data || {};
    validate(callback, 'callback');
    // username or token
    if (!hasToken()) validate(data.USERNAME, 'USERNAME');
    authorized();
    return get(`/v4/user/checkins/${data.USERNAME || ''}`, data, callback);
  };

  // https://untappd.com/api/docs#theppublocal
  that.pubFeed = (callback, data) => {
    data = data || {};
    validate(callback, 'callback');
    authorized();
    return get('/v4/thepub/local', data, callback);
  };

  // https://untappd.com/api/docs#venueactivityfeed
  that.venueActivityFeed = (callback, data) => {
    data = data || {};
    validate(callback, 'callback');
    validate(data.VENUE_ID, 'VENUE_ID');
    authorized();
    return get(`/v4/venue/checkins/${data.VENUE_ID}`, data, callback);
  };

  // https://untappd.com/api/docs#beeractivityfeed
  that.beerActivityFeed = (callback, data) => {
    data = data || {};
    validate(callback, 'callback');
    validate(data.BID, 'BID');
    authorized();
    return get(`/v4/beer/checkins/${data.BID}`, data, callback);
  };

  // https://untappd.com/api/docs#breweryactivityfeed
  that.breweryActivityFeed = (callback, data) => {
    data = data || {};
    validate(callback, 'callback');
    validate(data.BREWERY_ID, 'BREWERY_ID');
    authorized();
    return get(`/v4/brewery/checkins/${data.BREWERY_ID}`, data, callback);
  };

  // https://untappd.com/api/docs#notifications
  that.notifications = function (callback) {
    validate(callback, 'callback');
    authorized(true);
    return get('/v4/notifications', null, callback);
  };

  // The INFO / SEARCH

  // https://untappd.com/api/docs#userinfo
  that.userInfo = (callback, data) => {
    data = data || {};
    if (!hasToken()) validate(data.USERNAME, 'USERNAME');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/user/info/${data.USERNAME || ''}`, data, callback);
  };

  // https://untappd.com/api/docs#userwishlist
  that.userWishList = (callback, data) => {
    data = data || {};
    if (!hasToken()) validate(data.USERNAME, 'USERNAME');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/user/wishlist/${data.USERNAME || ''}`, data, callback);
  };

  // https://untappd.com/api/docs#userfriends
  that.userFriends = (callback, data) => {
    data = data || {};
    if (!hasToken()) validate(data.USERNAME, 'USERNAME');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/user/friends/${data.USERNAME || ''}`, data, callback);
  };

  // https://untappd.com/api/docs#userbadges
  that.userBadges = (callback, data) => {
    data = data || {};
    if (!hasToken()) validate(data.USERNAME, 'USERNAME');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/user/badges/${data.USERNAME || ''}`, data, callback);
  };

  // https://untappd.com/api/docs#userbeers
  that.userDistinctBeers = (callback, data) => {
    data = data || {};
    if (!hasToken()) validate(data.USERNAME, 'USERNAME');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/user/beers/${data.USERNAME || ''}`, data, callback);
  };

  // https://untappd.com/api/docs#breweryinfo
  that.breweryInfo = (callback, data) => {
    data = data || {};
    validate(data.BREWERY_ID, 'BREWERY_ID');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/brewery/info/${data.BREWERY_ID}`, data, callback);
  };

  // https://untappd.com/api/docs#beerinfo
  that.beerInfo = (callback, data) => {
    data = data || {};
    validate(data.BID, 'BID');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/beer/info/${data.BID}`, data, callback);
  };

  // https://untappd.com/api/docs#venueinfo
  that.venueInfo = (callback, data) => {
    data = data || {};
    validate(data.VENUE_ID, 'VENUE_ID');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/venue/info/${data.VENUE_ID}`, data, callback);
  };

  // https://untappd.com/api/docs#beersearch
  that.beerSearch = (callback, data) => {
    data = data || {};
    validate(data.q, 'q');
    validate(callback, 'callback');
    authorized();
    return get('/v4/search/beer', data, callback);
  };

  // https://untappd.com/api/docs#brewerysearch
  that.brewerySearch = (callback, data) => {
    data = data || {};
    validate(data.q, 'searchTerms');
    validate(callback, 'callback');
    authorized();
    return get('/v4/search/brewery', data, callback);
  };

  // CHECKIN calls
  // https://untappd.com/api/docs#checkin
  that.checkin = (callback, data) => {
    data = data || {};
    validate(data.gmt_offset, 'gmt_offset');
    validate(data.timezone, 'timezone');
    validate(data.bid, 'bid');
    validate(callback, 'callback');
    authorized(true);
    return post('/v4/checkin/add', {}, data, callback);
  };

  // https://untappd.com/api/docs#toast
  // If already toasted, this will untoast, otherwise it toasts.
  that.toast = (callback, data) => {
    data = data || {};
    validate(data.CHECKIN_ID, 'CHECKIN_ID');
    validate(callback, 'callback');
    authorized(true);
    return post(`/v4/checkin/toast/${data.CHECKIN_ID}`, {}, data, callback);
  };

  // https://untappd.com/api/docs#pendingfriends
  that.pendingFriends = (callback, data) => {
    data = data || {};
    validate(callback, 'callback');
    authorized(true);
    return get('/v4/user/pending', data, callback);
  };

  // https://untappd.com/api/docs#addfriend
  that.requestFriends = (callback, data) => {
    data = data || {};
    validate(data.TARGET_ID, 'TARGET_ID');
    validate(callback, 'callback');
    authorized(true);
    return get(`/v4/friend/request/${data.TARGET_ID}`, data, callback);
  };

  // https://untappd.com/api/docs#removefriend
  that.removeFriends = (callback, data) => {
    data = data || {};
    validate(data.TARGET_ID, 'TARGET_ID');
    validate(callback, 'callback');
    authorized(true);
    return get(`/v4/friend/remove/${data.TARGET_ID}`, data, callback);
  };

  // https://untappd.com/api/docs#acceptfriend
  that.acceptFriends = (callback, data) => {
    data = data || {};
    validate(data.TARGET_ID, 'TARGET_ID');
    validate(callback, 'callback');
    authorized(true);
    return post(`/v4/friend/accept/${data.TARGET_ID}`, {}, data, callback);
  };

  // https://untappd.com/api/docs#rejectfriend
  that.rejectFriends = (callback, data) => {
    data = data || {};
    validate(data.TARGET_ID, 'TARGET_ID');
    validate(callback, 'callback');
    authorized(true);
    return post(`/v4/friend/reject/${data.TARGET_ID}`, {}, data, callback);
  };

  // https://untappd.com/api/docs#addcomment
  that.addComment = (callback, data) => {
    data = data || {};
    validate(data.CHECKIN_ID, 'CHECKIN_ID');
    validate(data.shout, 'shout');
    validate(callback, 'callback');
    authorized(true);
    return post(`/v4/checkin/addcomment/${data.CHECKIN_ID}`, {}, data, callback);
  };

  // https://untappd.com/api/docs#removecommment
  that.removeComment = (callback, data) => {
    data = data || {};
    validate(data.COMMENT_ID, 'COMMENT_ID');
    validate(callback, 'callback');
    authorized(true);
    return post(`/v4/checkin/deletecomment/${data.COMMENT_ID}`, {}, data, callback);
  };

  // https://untappd.com/api/docs#addwish
  that.addToWishList = (callback, data) => {
    data = data || {};
    validate(data.bid, 'bid');
    validate(callback, 'callback');
    authorized(true);
    return get('/v4/user/wishlist/add', data, callback);
  };

  // https://untappd.com/api/docs#removewish
  that.removeFromWishList = (callback, data) => {
    data = data || {};
    validate(data.bid, 'bid');
    validate(callback, 'callback');
    authorized(true);
    return get('/v4/user/wishlist/remove', data, callback);
  };

  // https://untappd.com/api/docs#foursquarelookup
  that.foursquareVenueLookup = (callback, data) => {
    data = data || {};
    validate(data.VENUE_ID, 'VENUE_ID');
    validate(callback, 'callback');
    authorized();
    return get(`/v4/venue/foursquare_lookup/${data.VENUE_ID}`, data, callback);
  };
};

module.exports = UntappdClient;
