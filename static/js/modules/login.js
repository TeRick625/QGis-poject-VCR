// static/js/modules/login.js
document.addEventListener('alpine:init', () => {
    Alpine.data('login', () => ({
        step: 'start',      // 'start' | 'login' | 'register'
        surname: '',
        name: '',
        patronymic: '',
        email: '',
        password: '',
        errorMessage: '',

        get isStart()   { return this.step === 'start'; },
        get isLogin()   { return this.step === 'login'; },
        get isRegister(){ return this.step === 'register'; },

        goToLogin() {
            this.step = 'login';
            this.clearForm();
        },
        goToRegister() {
            this.step = 'register';
            this.clearForm();
        },
        goBackToStart() {
            this.step = 'start';
            this.clearForm();
        },

        clearForm() {
            this.surname = '';
            this.name = '';
            this.patronymic = '';
            this.email = '';
            this.password = '';
            this.errorMessage = '';
        },

        validateForm() {
            this.errorMessage = '';
            if (!this.email.trim() || !this.password.trim()) {
                this.errorMessage = 'Заполните email и пароль';
                return false;
            }
            if (this.isRegister) {
                if (!this.surname.trim() || !this.name.trim()) {
                    this.errorMessage = 'Заполните фамилию и имя';
                    return false;
                }
            }
            return true;
        }
    }));
});