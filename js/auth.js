(function (global) {
    function safeParse(json) {
        try {
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    function getToken() {
        try {
            return global.localStorage.getItem('authToken');
        } catch (e) {
            return null;
        }
    }

    function getUser() {
        try {
            var raw = global.localStorage.getItem('currentUser');
            return raw ? safeParse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function getRole() {
        var user = getUser();
        if (!user || !user.role) {
            return null;
        }
        return normalizeRole(user.role);
    }

    function isLoggedIn() {
        return !!getToken();
    }

    function setAuth(token, user) {
        global.localStorage.setItem('authToken', token);
        global.localStorage.setItem('currentUser', JSON.stringify(user));
    }

    function clearAuth() {
        try {
            global.localStorage.removeItem('authToken');
            global.localStorage.removeItem('currentUser');
        } catch (e) {}
    }

    function normalizeRole(role) {
        if (!role) {
            return null;
        }
        var r = String(role).toLowerCase();
        if (r === 'user') {
            return 'customer';
        }
        return r;
    }

    function dashboardPathForRole(role) {
        var r = normalizeRole(role);
        if (r === 'admin') {
            return 'admin/dashboard.html';
        }
        if (r === 'staff') {
            return 'staff/dashboard.html';
        }
        return 'index.html';
    }

    function redirectToDashboard(role) {
        var path = dashboardPathForRole(role);
        global.location.href = Api.toRelativeRoot(path);
    }

    function login(payload) {
        return Api.request({
            url: Api.getBaseUrl() + '/auth/login',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload),
            headers: {
                'Accept': 'application/json'
            }
        }).then(function (res) {
            if (!res || !res.success) {
                var errorMsg = (res && res.message) ? res.message : 'Login failed. Please check your credentials and try again.';
                return global.jQuery.Deferred().reject({ message: errorMsg, response: res });
            }

            var token = res && res.data && res.data.token;
            var user = res && res.data && res.data.user;

            if (!token || !user) {
                return global.jQuery.Deferred().reject({ message: 'Login failed. Invalid response from server.' });
            }

            setAuth(token, user);
            return res;
        });
    }

    function register(payload) {
        var isFormData = (typeof FormData !== 'undefined') && (payload instanceof FormData);

        return Api.request({
            url: Api.getBaseUrl() + '/auth/register',
            method: 'POST',
            contentType: isFormData ? false : 'application/json',
            processData: isFormData ? false : true,
            data: isFormData ? payload : JSON.stringify(payload),
            headers: {
                'Accept': 'application/json'
            }
        }).then(function (res) {
            // Registration successful - check if we have success response
            if (res && res.success) {
                // Note: Registration doesn't return a token because email verification is required
                // The user data is returned but no token until email is verified
                var user = res && res.data && res.data.user;
                
                // Don't set auth here - user needs to verify email first
                // Just return the success response
                return res;
            }

            // If response doesn't indicate success, treat as failure
            var token = res && res.data && res.data.token;
            var user = res && res.data && res.data.user;

            if (!token || !user) {
                return global.jQuery.Deferred().reject({ message: 'Registration failed' });
            }

            setAuth(token, user);
            return res;
        });
    }

    function resendVerification(identifier) {
        return Api.request({
            url: Api.getBaseUrl() + '/auth/resend-verification',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ email: identifier }),
            headers: {
                'Accept': 'application/json'
            }
        });
    }

    function verifyEmail(token) {
        return Api.request({
            url: Api.getBaseUrl() + '/auth/verify-email',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ token: token }),
            headers: {
                'Accept': 'application/json'
            }
        });
    }

    global.Auth = {
        getToken: getToken,
        getUser: getUser,
        getRole: getRole,
        isLoggedIn: isLoggedIn,
        setAuth: setAuth,
        clearAuth: clearAuth,
        normalizeRole: normalizeRole,
        redirectToDashboard: redirectToDashboard,
        login: login,
        register: register,
        resendVerification: resendVerification,
        verifyEmail: verifyEmail
    };
})(window);
