(function () {
    const AUTH_KEY = 'isLoggedIn';
    const AUTH_EMAIL_KEY = 'mahari_user_email';

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

    function isAuthenticated() {
        return localStorage.getItem(AUTH_KEY) === 'true';
    }

    function setAuthenticated(value, email) {
        if (value) {
            localStorage.setItem(AUTH_KEY, 'true');
            if (email) {
                localStorage.setItem(AUTH_EMAIL_KEY, email);
            }
            updateNavbar();
            return;
        }

        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(AUTH_EMAIL_KEY);
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
        window.location.replace(next || defaultPage || 'accueil.html');
        return true;
    }

    function goAfterLogin(defaultPage) {
        const next = getNextFromUrl();
        window.location.replace(next || defaultPage || 'accueil.html');
    }

    function logout(redirectPage) {
        setAuthenticated(false);
        window.location.replace(redirectPage || 'accueil.html');
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
            e.preventDefault();
            const email = form.querySelector('input[type="email"]')?.value || 'guest@mahari.com';
            setAuthenticated(true, email);
            goAfterLogin('accueil.html');
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
