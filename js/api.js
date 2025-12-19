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
        var pathname = (global.location && global.location.pathname) ? global.location.pathname : '/';
        var hostname = (global.location && global.location.hostname) ? global.location.hostname : '';
        var protocol = (global.location && global.location.protocol) ? global.location.protocol : '';
        var segments = pathname.split('/').filter(function (s) {
            return !!s;
        });
        var cleaned = String(path || '').replace(/^\/+/, '');

        // Cordova / WebView: file:// paths should remain relative within www/
        if (protocol === 'file:' || protocol === 'cdvfile:') {
            return cleaned;
        }

        var root = '/';
        var isGitHubPages = /github\.io$/i.test(hostname);
        if (isGitHubPages && segments.length > 0) {
            root = '/' + segments[0] + '/';
        }

        return root + cleaned;
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
