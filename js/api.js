(function (global) {
    var DEFAULT_API_BASE_URL = 'https://laravel-test-system.orbit-node.com/api';

    function getBaseUrl() {
        var explicit = global.localStorage ? global.localStorage.getItem('apiBaseUrl') : null;
        return (explicit && explicit.trim()) ? explicit.trim() : DEFAULT_API_BASE_URL;
    }

    function getAuthToken() {
        try {
            return global.localStorage ? global.localStorage.getItem('authToken') : null;
        } catch (e) {
            return null;
        }
    }

    function authHeaders() {
        var token = getAuthToken();
        var headers = {
            'Accept': 'application/json'
        };

        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        return headers;
    }

    function handleAuthError(xhr) {
        if (!xhr) {
            return;
        }

        if (xhr.status === 401) {
            try {
                global.localStorage.removeItem('authToken');
                global.localStorage.removeItem('currentUser');
            } catch (e) {}

            if (global.location && global.location.pathname.indexOf('login.html') === -1) {
                global.location.href = toRelativeRoot('login.html');
            }
        }
    }

    function toRelativeRoot(path) {
        var depth = 0;

        if (global.location && global.location.pathname) {
            var segments = global.location.pathname.split('/').filter(function (s) {
                return !!s;
            });

            depth = Math.max(0, segments.length - 2);
        }

        var prefix = '';
        for (var i = 0; i < depth; i++) {
            prefix += '../';
        }
        return prefix + path;
    }

    function request(opts) {
        var settings = {
            url: opts.url,
            method: opts.method || 'GET',
            data: opts.data,
            contentType: opts.contentType,
            processData: opts.processData,
            headers: Object.assign({}, authHeaders(), (opts.headers || {}))
        };

        return global.jQuery.ajax(settings).fail(function (xhr) {
            handleAuthError(xhr);
        });
    }

    global.Api = {
        getBaseUrl: getBaseUrl,
        request: request,
        authHeaders: authHeaders,
        handleAuthError: handleAuthError,
        toRelativeRoot: toRelativeRoot
    };
})(window);
