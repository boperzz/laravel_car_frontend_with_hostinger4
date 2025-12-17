(function (global) {
    function logout() {
        return Api.request({
            url: Api.getBaseUrl() + '/auth/logout',
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            }
        }).always(function () {
            if (global.Auth) {
                global.Auth.clearAuth();
            } else {
                try {
                    global.localStorage.removeItem('authToken');
                    global.localStorage.removeItem('currentUser');
                } catch (e) {}
            }

            global.location.href = Api.toRelativeRoot('login.html');
        });
    }

    global.Logout = {
        logout: logout
    };
})(window);
