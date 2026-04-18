(function () {
    function getCurrentTargetFromUrl() {
        const current = window.location.pathname.split('/').pop() || 'accueil.html';
        const search = window.location.search || '';
        return current + search;
    }

    function getNextFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        return next && next.trim() ? next : null;
    }

    function hasPhpSessionCookie() {
        return document.cookie.split(';').some((c) => c.trim().startsWith('PHPSESSID='));
    }

    function isAuthenticated() {
        return hasPhpSessionCookie();
    }

    function setAuthenticated(value) {
        // Compat API: in session-based auth, login/logout are handled server-side.
        if (!value) {
            logout('accueil.html');
            return;
        }
        updateNavbar();
    }

    function updateNavbar() {
        const authenticated = isAuthenticated();

        // Show/hide navbar items based on login state
        document.querySelectorAll('[data-show-logged-in]').forEach((el) => {
            el.style.display = authenticated ? '' : 'none';
        });

        document.querySelectorAll('[data-show-logged-out]').forEach((el) => {
            el.style.display = authenticated ? 'none' : '';
        });
    }

    function checkAuth(loginPage) {
        // For protected pages: redirect if not authenticated
        if (!isAuthenticated()) {
            const target = getCurrentTargetFromUrl();
            const redirectTo = (loginPage || 'login.html') + '?next=' + encodeURIComponent(target);
            window.location.replace(redirectTo);
            return false;
        }
        return true;
    }

    function redirectIfAuthenticated(defaultPage) {
        if (!isAuthenticated()) return false;

        const next = getNextFromUrl();
        window.location.replace(next || defaultPage || '../Backend/profil.php');
        return true;
    }

    function goAfterLogin(defaultPage) {
        const next = getNextFromUrl();
        window.location.replace(next || defaultPage || '../Backend/profil.php');
    }

    function logout(redirectPage) {
        const redirect = encodeURIComponent(redirectPage || 'accueil.html');
        window.location.replace('../Backend/logout.php?redirect=' + redirect);
    }

    function wireLogoutLinks() {
        document.querySelectorAll('a[href="logout.php"], a[data-logout="true"]').forEach((link) => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                logout('accueil.html');
            });
        });
    }

    function wireLoginForm() {
        const form = document.querySelector('form');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            const emailInput = form.querySelector('input[type="email"]');
            const passwordInput = form.querySelector('input[type="password"]');
            if (!emailInput?.value?.trim() || !passwordInput?.value) {
                e.preventDefault();
            }
        });
    }

    // Auto-update navbar on page load
    window.addEventListener('DOMContentLoaded', updateNavbar);

    window.MahariAuth = {
        isAuthenticated,
        setAuthenticated,
        checkAuth,
        redirectIfAuthenticated,
        goAfterLogin,
        logout,
        updateNavbar,
        wireLogoutLinks,
        wireLoginForm,
    };
})();
