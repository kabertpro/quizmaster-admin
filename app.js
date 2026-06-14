/**
 * QuizMaster Edu - Sistema Central de la Aplicación
 * Arquitectura modular y robusta contra bloqueos de red/AdBlockers.
 */

class QuizApp {
    constructor() {
        // Estado global de la aplicación
        this.currentUser = null;
        this.currentQuiz = null;
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.timerInterval = null;
        this.timeLeft = 0;
        this.userAnswers = [];
    }

    /**
     * Inicializa la aplicación y asegura la remoción del Splash Screen
     */
    init() {
        console.log("Inicializando QuizMaster Edu...");
        this.bindEvents();
        this.checkSession();
        
        // Cierre garantizado del Splash Screen a los 3 segundos (Evita congelamiento por red)
        const splashTimeout = setTimeout(() => {
            this.forceShowApp();
        }, 3000);

        // Intentar renderizar el catálogo de cuestionarios de inmediato
        this.renderDashboard();
    }

    /**
     * Fuerza la transición visual ocultando el Splash Screen de forma fluida
     */
    forceShowApp() {
        const splash = document.getElementById('screen-splash');
        const nav = document.getElementById('main-nav');
        
        if (splash && splash.classList.contains('active')) {
            splash.style.opacity = '0';
            splash.style.transition = 'opacity 0.5s ease';
            
            setTimeout(() => {
                splash.classList.remove('active');
                if (nav) nav.classList.remove('hidden');
                
                // Si ninguna pantalla está activa, ir al Dashboard por defecto
                const activeScreens = document.querySelectorAll('.screen.active');
                if (activeScreens.length === 0) {
                    this.navigateTo('screen-dashboard');
                }
            }, 500);
        }
    }

    /**
     * Enlace y delegación de eventos del DOM
     */
    bindEvents() {
        // Delegación global para navegación mediante atributos data-target
        document.querySelectorAll('[data-target]').forEach(element => {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                const target = element.getAttribute('data-target');
                this.navigateTo(target);
            });
        });

        // Formulario de Inicio de Sesión / Registro
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleAuth(e));
        }

        // Procesador de archivos TXT para Administradores
        const fileInput = document.getElementById('quiz-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
    }

    /**
     * Enrutador interno para cambiar entre pantallas virtuales
     */
    navigateTo(screenId) {
        console.log(`Navegando a: ${screenId}`);
        
        // Detener temporizadores activos si se sale abruptamente del juego
        if (screenId !== 'screen-game' && this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Desactivar todas las pantallas
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Activar la pantalla solicitada
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            window.scrollTo(0, 0);
        }

        // Ejecutar acciones de renderizado específicas según la pantalla
        if (screenId === 'screen-dashboard') {
            this.renderDashboard();
        } else if (screenId === 'screen-admin') {
            this.renderAdminPanel();
        }
    }

    /**
     * Comprueba si existe una sesión de usuario activa en el almacenamiento local
     */
    checkSession() {
        const session = localStorage.getItem('quiz_user');
        if (session) {
            this.currentUser = JSON.parse(session);
            this.updateUserUI();
        }
    }

    /**
     * Maneja de manera unificada el Login del administrador y registros de estudiantes
     */
    handleAuth(e) {
        e.preventDefault();
        const usernameInput = document.getElementById('input-username');
        const levelInput = document.getElementById('select-level');
        
        if (!usernameInput) return;
        
        const username = usernameInput.value.trim();
        const level = levelInput ? levelInput.value : 'Todos';

        if (!username) return;

        // Regla especial: Credenciales fijas de Administrador Local
        if (username.toLowerCase() === 'admin') {
            this.currentUser = {
                username: 'admin',
                level: 'Administrador',
                isAdmin: true
            };
        } else {
            // Registro/Login automático de estudiantes
            this.currentUser = {
                username: username,
                level: level,
                isAdmin: false
            };
        }

        localStorage.setItem('quiz_user', JSON.stringify(this.currentUser));
        this.updateUserUI();
        
        // Limpiar formulario y redirigir
        usernameInput.value = '';
        this.navigateTo('screen-dashboard');
    }

    /**
     * Cierra la sesión del usuario actual
     */
    logout() {
        this.currentUser = null;
        localStorage.removeItem('quiz_user');
        this.updateUserUI();
        this.navigateTo('screen-dashboard');
    }

    /**
     * Actualiza las barras de navegación y los menús según el estado del usuario
     */
    updateUserUI() {
        const userNav = document.getElementById('user-nav-status');
        const adminLink = document.getElementById('nav-admin-link');
        
        if (!userNav) return;

        if (this.currentUser) {
            userNav.innerHTML = `
                <span class="user-welcome"><i class="fa-solid fa-user-astronaut"></i> ${this.currentUser.username} (${this.currentUser.level})</span>
                <button onclick="app.logout()" class="btn btn-secondary btn-sm"><i class="fa-solid fa-right-from-bracket"></i> Salir</button>
            `;
            
            // Mostrar u ocultar pestaña administrativa
            if (this.currentUser.isAdmin && adminLink) {
                adminLink.classList.remove('hidden');
            } else if (adminLink) {
                adminLink.classList.add('hidden');
            }
        } else {
            userNav.innerHTML = `
                <button data-target="screen-login" onclick="app.navigateTo('screen-login')" class="btn btn-primary btn-sm"><i class="fa-solid fa-user-plus"></i> Ingresar</button>
            `;
            if (adminLink) adminLink.classList.add('hidden');
        }
    }

    /**
     * Consulta Cloud Firestore y renderiza las tarjetas de cuestionarios disponibles
     * Incorpora catch estructurado para interceptar AdBlockers (ERR_BLOCKED_BY_CLIENT)
     */
    async renderDashboard() {
        const container = document.getElementById('quizzes-container');
        if (!container) return;
        container.innerHTML = '<div class="loader"></div>';

        try {
            // Construcción de consulta dinámica basada en la base de datos de Firebase instanciada globalmente
            let query = db.collection('cuestionarios');
            
            // Filtrado opcional por nivel de estudiante
            if (this.currentUser && !this.currentUser.isAdmin && this.currentUser.level) {
                query = query.where('level', 'in', [this.currentUser.level, 'Todos']);
            }

            const snapshot = await query.get();
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = `
                    <div class="card text-center" style="grid-column: 1/-1; padding: 40px;">
                        <i class="fa-solid fa-graduation-cap" style="font-size: 3.5rem; color: var(--violeta); margin-bottom: 15px;"></i>
                        <h3>¡Bienvenido a QuizMaster Edu!</h3>
                        <p>No se encontraron cuestionarios disponibles en este momento.</p>
                        <p style="margin-top: 10px;"><small>Inicia sesión con el usuario <strong>admin</strong> para cargar tus plantillas estructuradas de preguntas.</small></p>
                    </div>`;
                return;
            }

            snapshot.forEach(doc => {
                const quiz = doc.data();
                const quizId = doc.id;

                const card = document.createElement('div');
                card.className = 'card quiz-card';
                card.innerHTML = `
                    <div class="quiz-card-content">
                        <h3>${quiz.title}</h3>
                        <div class="quiz-meta-tags">
                            <span class="badge badge-level"><i class="fa-solid fa-layer-group"></i> ${quiz.level || 'General'}</span>
                            <span class="badge badge-time"><i class="fa-solid fa-clock"></i> ${quiz.timeIdeal || 30}s</span>
                        </div>
                    </div>
                    <button onclick="app.startQuizSequence('${quizId}')" class="btn btn-primary btn-block" style="margin-top: 15px;">
                        <i class="fa-solid fa-play"></i> Responder Cuestionario
                    </button>
                `;
                container.appendChild(card);
            });

        } catch (error) {
            console.warn("Conexión bloqueada o denegada hacia Cloud Firestore:", error);
            
            // Renderizado de Contingencia Amigable frente a Bloqueos de Cliente/AdBlockers
            container.innerHTML = `
                <div class="card text-center" style="grid-column: 1/-1; padding: 40px; border: 2px dashed var(--coral);">
                    <i class="fa-solid fa-shield-halved" style="font-size: 3.5rem; color: var(--coral); margin-bottom: 15px;"></i>
                    <h3>Escudo de Privacidad o AdBlocker Detectado</h3>
                    <p>Tu navegador web o una extensión instalada (uBlock, AdBlock, Brave Shields) está bloqueando las peticiones salientes hacia <i>firestore.googleapis.com</i>.</p>
                    <div style="background: rgba(0,0,0,0.05); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left; font-size: 0.9rem;">
                        <strong>Pasos para solucionar:</strong><br>
                        1. Haz clic en el ícono de tu bloqueador de anuncios en la barra superior.<br>
                        2. Elige "Desactivar para este sitio" (o añade tu URL local a la lista permitida).<br>
                        3. Refresca la ventana de tu navegador.
                    </div>
                    <button onclick="app.navigateTo('screen-login')" class="btn btn-secondary btn-sm">Acceder al Entorno Local como Admin</button>
                </div>`;
        }
    }

    /**
     * Inicializa las variables de estado e inicia un cuestionario seleccionado
     */
    async startQuizSequence(quizId) {
        try {
            const doc = await db.collection('cuestionarios').document(quizId).get();
            if (!doc.exists) {
                alert("El cuestionario seleccionado ya no está disponible.");
                return;
            }

            this.currentQuiz = doc.data();
            this.currentQuestions = this.currentQuiz.questions || [];
            
            if (this.currentQuestions.length === 0) {
                alert("Este cuestionario no contiene preguntas estructuradas válidas.");
                return;
            }

            // Resetear métricas del juego
            this.currentQuestionIndex = 0;
            this.score = 0;
            this.userAnswers = [];
            
            // Configurar panel de presentación del juego
            const titleElement = document.getElementById('game-quiz-title');
            if (titleElement) titleElement.textContent = this.currentQuiz.title;

            this.navigateTo('screen-game');
            this.renderQuestion();

        } catch (error) {
            console.error("Error al recuperar estructura del cuestionario:", error);
            alert("No se pudo iniciar el cuestionario debido a restricciones de conexión.");
        }
    }

    /**
     * Muestra la pregunta activa junto con sus opciones interactivas
     */
    renderQuestion() {
        if (this.currentQuestionIndex >= this.currentQuestions.length) {
            this.finishQuizSequence();
            return;
        }

        const question = this.currentQuestions[this.currentQuestionIndex];
        
        // Actualizar barras de progreso y contadores visuales
        const progressText = document.getElementById('game-progress-text');
        const progressBar = document.getElementById('game-progress-bar');
        
        if (progressText) progressText.textContent = `Pregunta ${this.currentQuestionIndex + 1} de ${this.currentQuestions.length}`;
        if (progressBar) {
            const percentage = ((this.currentQuestionIndex) / this.currentQuestions.length) * 100;
            progressBar.style.width = `${percentage}%`;
        }

        // Insertar el texto de la pregunta
        const questionTextContainer = document.getElementById('game-question-text');
        if (questionTextContainer) questionTextContainer.textContent = question.text;

        // Renderizar opciones de respuesta
        const optionsContainer = document.getElementById('game-options-container');
        if (optionsContainer) {
            optionsContainer.innerHTML = '';
            question.options.forEach((option, index) => {
                const button = document.createElement('button');
                button.className = 'btn btn-option animate__animated animate__fadeInUp';
                button.style.animationDelay = `${index * 0.1}s`;
                button.innerHTML = `
                    <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                    <span class="option-text">${option}</span>
                `;
                button.onclick = () => this.handleAnswerSelection(option);
                optionsContainer.appendChild(button);
            });
        }

        // Inicialización del Temporizador por Pregunta
        this.timeLeft = parseInt(this.currentQuiz.timeIdeal) || 30;
        const timerDisplay = document.getElementById('game-timer-seconds');
        if (timerDisplay) timerDisplay.textContent = this.timeLeft;

        if (this.timerInterval) clearInterval(this.timerInterval);
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            if (timerDisplay) timerDisplay.textContent = this.timeLeft;

            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.handleAnswerSelection(""); // Respuesta vacía por límite de tiempo vencido
            }
        }, 1000);
    }

    /**
     * Procesa la selección del alumno y calcula la puntuación instantánea
     */
    handleAnswerSelection(selectedOption) {
        if (this.timerInterval) clearInterval(this.timerInterval);

        const question = this.currentQuestions[this.currentQuestionIndex];
        const isCorrect = selectedOption === question.correctAnswer;

        if (isCorrect) {
            // Factor de puntuación proporcional al tiempo restante de respuesta
            const basePoints = 100;
            const timeBonus = this.timeLeft * 2;
            this.score += (basePoints + timeBonus);
        }

        // Registrar trazabilidad de la respuesta elegida
        this.userAnswers.push({
            question: question.text,
            selected: selectedOption || 'Tiempo Agotado',
            correct: question.correctAnswer,
            isCorrect: isCorrect
        });

        // Transición automática a la siguiente pregunta
        this.currentQuestionIndex++;
        this.renderQuestion();
    }

    /**
     * Concluye la partida, limpia intervalos y despliega el informe analítico de resultados
     */
    finishQuizSequence() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.navigateTo('screen-results');

        // Renderizar Score Final Obtenido
        const scoreDisplay = document.getElementById('results-score-value');
        if (scoreDisplay) scoreDisplay.textContent = `${this.score} Puntos`;

        // Generar tabla detallada de revisión para retroalimentación pedagógica
        const summaryBody = document.getElementById('results-summary-body');
        if (summaryBody) {
            summaryBody.innerHTML = '';
            this.userAnswers.forEach((ans, idx) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${idx + 1}</strong></td>
                    <td>${ans.question}</td>
                    <td style="color: ${ans.isCorrect ? 'var(--esmeralda)' : 'var(--coral)'}">
                        <i class="fa-solid ${ans.isCorrect ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${ans.selected}
                    </td>
                    <td><span class="badge" style="background: rgba(46, 204, 113, 0.2); color: #27ae60;">${ans.correct}</span></td>
                `;
                summaryBody.appendChild(row);
            });
        }
    }

    /**
     * Muestra información de auditoría dentro del Panel de Control del Administrador
     */
    async renderAdminPanel() {
        const statsContainer = document.getElementById('admin-stats-summary');
        if (!statsContainer) return;

        try {
            const snapshot = await db.collection('cuestionarios').get();
            statsContainer.innerHTML = `
                <div class="card text-center" style="padding:20px;">
                    <h2 style="color: var(--violeta); font-size: 2.5rem;">${snapshot.size}</h2>
                    <p><i class="fa-solid fa-file-invoice"></i> Cuestionarios en Servidor</p>
                </div>
            `;
        } catch (error) {
            statsContainer.innerHTML = `<p style="color: var(--coral);">Modo sin conexión. No se pudieron auditar estadísticas de almacenamiento remoto.</p>`;
        }
    }

    /**
     * Parsea archivos .txt cargados por el administrador bajo la sintaxis estándar estructurada
     */
    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            this.parseAndUploadQuiz(text);
        };
        reader.readAsText(file);
    }

    /**
     * Intérprete léxico de plantillas TXT de preguntas y almacenamiento en Firebase
     */
    async parseAndUploadQuiz(rawText) {
        const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        let quizTitle = "Evaluación Educativa Integrada";
        let targetLevel = "Todos";
        let timeIdeal = 30;
        let questions = [];
        
        let currentQuestion = null;

        try {
            lines.forEach(line => {
                if (line.startsWith('CUESTIONARIO:')) {
                    quizTitle = line.replace('CUESTIONARIO:', '').trim();
                } else if (line.startsWith('NIVEL:')) {
                    targetLevel = line.replace('NIVEL:', '').trim();
                } else if (line.startsWith('TIEMPO:')) {
                    timeIdeal = parseInt(line.replace('TIEMPO:', '').trim()) || 30;
                } else if (line.match(/^\d+\./)) {
                    // Detecta el inicio de una pregunta estructurada (Ej: 1. ¿Pregunta?)
                    if (currentQuestion) questions.push(currentQuestion);
                    
                    currentQuestion = {
                        text: line.replace(/^\d+\.\s*/, '').trim(),
                        options: [],
                        correctAnswer: ''
                    };
                } else if (line.startsWith('-') || line.startsWith('*')) {
                    // Opción estándar de respuesta
                    if (currentQuestion) {
                        currentQuestion.options.push(line.substring(1).trim());
                    }
                } else if (line.startsWith('OK:')) {
                    // Respuesta declarada como correcta
                    if (currentQuestion) {
                        currentQuestion.correctAnswer = line.replace('OK:', '').trim();
                    }
                }
            });

            // Empujar la última pregunta procesada del búfer
            if (currentQuestion) questions.push(currentQuestion);

            if (questions.length === 0) {
                throw new Error("El archivo no contiene un formato de preguntas válido (Falta numeración o prefijos OK:)");
            }

            // Objeto de persistencia listo para Firebase
            const quizPayload = {
                title: quizTitle,
                level: targetLevel,
                timeIdeal: timeIdeal,
                questions: questions,
                createdAt: new Date().toISOString()
            };

            await db.collection('cuestionarios').add(quizPayload);
            
            alert(`¡Cuestionario "${quizTitle}" guardado exitosamente con ${questions.length} preguntas!`);
            
            // Limpiar campo de archivos e ir a inicio
            document.getElementById('quiz-file-input').value = '';
            this.navigateTo('screen-dashboard');

        } catch (err) {
            console.error(err);
            alert(`Error al procesar la sintaxis del archivo: ${err.message}`);
        }
    }
}

// Inicializar la instancia global una vez el DOM esté construido de forma nativa
document.addEventListener('DOMContentLoaded', () => {
    window.app = new QuizApp();
    window.app.init();
});