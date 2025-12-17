(function (global) {
    function normalizeRole(role) {
        return global.Auth ? global.Auth.normalizeRole(role) : (role ? String(role).toLowerCase() : null);
    }

    function currentRole() {
        return global.Auth ? global.Auth.getRole() : null;
    }

    function isLoggedIn() {
        return global.Auth ? global.Auth.isLoggedIn() : false;
    }

    function canAccess(requiredRoles) {
        var role = currentRole();
        if (!role) {
            return false;
        }

        var required = (requiredRoles || []).map(normalizeRole);

        if (role === 'admin') {
            return true;
        }

        if (required.indexOf('admin') !== -1) {
            return false;
        }

        if (required.indexOf('staff') !== -1) {
            return role === 'staff';
        }

        if (required.indexOf('customer') !== -1) {
            return role === 'customer';
        }

        return true;
    }

    function requireAuth() {
        if (isLoggedIn()) {
            return true;
        }

        global.location.href = Api.toRelativeRoot('login.html');
        return false;
    }

    function requireRole(requiredRoles) {
        if (!requireAuth()) {
            return false;
        }

        if (canAccess(requiredRoles)) {
            return true;
        }

        if (global.Auth && global.Auth.redirectToDashboard) {
            global.Auth.redirectToDashboard(currentRole());
            return false;
        }

        global.location.href = Api.toRelativeRoot('index.html');
        return false;
    }

    global.RoleGuard = {
        requireAuth: requireAuth,
        requireRole: requireRole,
        canAccess: canAccess
    };
})(window);
