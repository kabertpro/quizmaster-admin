/**
 * QuizMaster Edu - Core Engine
 * Creado por Kabert Studio - LMKE (2026)
 */

// 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDag8IjhCfquweo20fTChWpumh8U_z-9HE",
    authDomain: "recordinter1.firebaseapp.com",
    projectId: "recordinter1",
    storageBucket: "recordinter1.firebasestorage.app",
    messagingSenderId: "379117695366",
    appId: "1:379117695366:web:4dd750015f00f6ac173c07",
    measurementId: "G-TK6HQF80X2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 2. MOTOR DE AUDIO SINTETIZADO (AudioContext Nativo)
const audioEngine = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    playTone(freq, type, duration, startTime = 0) {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    },
    playCorrect() {
        this.playTone(523.25, 'triangle', 0.1, 0); // Do5
        this.playTone(659.25, 'triangle', 0.2, 0.08); // Mi5
    },
    playIncorrect() {
        this.playTone(293.66, 'sawtooth', 0.15, 0); // Re4
        this.playTone(220.00, 'sawtooth', 0.3, 0.1); // La3
    },
    playCountdown() {
        this.playTone(440.00, 'sine', 0.1); // La4 short beep
    },
    playVictory() {
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        notes.forEach((freq, i) => {
            this.playTone(freq, 'sine', 0.2, i * 0.1);
        });
    },
    playTrophy() {
        this.playTone(392.00, 'square', 0.1, 0);
        this.playTone(523.25, 'square', 0.1, 0.1);
        this.playTone(659.25, 'square', 0.1, 0.2);
        this.playTone(783.99, 'square', 0.4, 0.3);
    }
};

// 3. ARQUITECTURA DE LA APLICACIÓN Y ESTADO GLOBAL
const app = {
    currentUser: null,
    activeQuiz: null,
    activeQuestions: [],
    currentQuestionIndex: 0,
    score: 0,
    timerInterval: null,
    secondsElapsed: 0,
    userAttemptsForQuiz: 0,
    currentQuizResponses: [], // Almacén para el reporte en PDF

    init() {
        this.bindEvents();
        this.checkSession();
        // Cierre automático programado de Splash Screen a Dashboard o login
        setTimeout(() => {
            document.getElementById('screen-splash').classList.remove('active');
            document.getElementById('main-nav').classList.remove('hidden');
            this.navigateTo('screen-dashboard');
        }, 3000);
    },

    navigateTo(screenId) {
        // Renderizado SPA: ocultar vistas activas, desplegar la solicitada
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');

        // Disparadores de renderizado dinámico de contenidos
        if (screenId === 'screen-dashboard') this.renderDashboard();
        if (screenId === 'screen-ranking') this.renderRanking();
        if (screenId === 'screen-profile') this.renderProfile();
    },

    bindEvents() {
        // Enlace de los controladores de formularios a la interfaz de usuario
        document.getElementById('form-register').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('form-login').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('form-upload-quiz').addEventListener('submit', (e) => this.handleUploadQuiz(e));
    },

    checkSession() {
        const cached = localStorage.getItem('qm_user');
        if (cached) {
            this.currentUser = JSON.parse(cached);
            this.updateNavUI();
        }
    },

    updateNavUI() {
        const authLinks = document.getElementById('nav-auth-links');
        const userLinks = document.getElementById('nav-user-links');
        const adminBtn = document.getElementById('btn-admin-panel');

        if (this.currentUser) {
            authLinks.classList.add('hidden');
            userLinks.classList.remove('hidden');
            document.getElementById('nav-username').innerHTML = `<i class="fa-solid fa-user"></i> ${this.currentUser.fullname}`;
            
            // Verificación explícita de privilegios administrativos
            if (this.currentUser.username === 'admin') {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }
        } else {
            authLinks.classList.remove('hidden');
            userLinks.classList.add('hidden');
            adminBtn.classList.add('hidden');
        }
    },

    logout() {
        localStorage.removeItem('qm_user');
        this.currentUser = null;
        this.updateNavUI();
        this.navigateTo('screen-dashboard');
    },

    // 4. CONTROLADORES DE AUTENTICACIÓN SIN AUTH CORE (FIRESTORE DIRECTO)
    async handleRegister(e) {
        e.preventDefault();
        const fullname = document.getElementById('reg-fullname').value.trim();
        const level = document.getElementById('reg-level').value;
        const username = document.getElementById('reg-username').value.trim().toLowerCase();
        const password = document.getElementById('reg-password').value;

        if (username === 'admin') {
            alert('El nombre de usuario "admin" está reservado para el sistema.');
            return;
        }

        try {
            // Verificar unicidad de username
            const userCheck = await db.collection('usuarios').doc(username).get();
            if (userCheck.exists) {
                alert('El nombre de usuario ya se encuentra registrado.');
                return;
            }

            const newUser = { fullname, level, username, password, xp: 0, medals: 0 };
            await db.collection('usuarios').doc(username).set(newUser);
            
            alert('¡Registro completado con éxito!');
            this.currentUser = newUser;
            localStorage.setItem('qm_user', JSON.stringify(newUser));
            this.updateNavUI();
            document.getElementById('form-register').reset();
            this.navigateTo('screen-dashboard');
        } catch (error) {
            console.error(error);
            alert('Error en el proceso de registro.');
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;

        // Comprobación dura de credenciales administrativas según regla de negocio
        if (username === 'admin' && password === 'admin123') {
            const adminUser = { fullname: 'Administrador', level: 'Global', username: 'admin' };
            this.currentUser = adminUser;
            localStorage.setItem('qm_user', JSON.stringify(adminUser));
            this.updateNavUI();
            document.getElementById('form-login').reset();
            this.navigateTo('screen-admin');
            return;
        }

        try {
            const userDoc = await db.collection('usuarios').doc(username).get();
            if (userDoc.exists && userDoc.data().password === password) {
                this.currentUser = userDoc.data();
                localStorage.setItem('qm_user', JSON.stringify(this.currentUser));
                this.updateNavUI();
                document.getElementById('form-login').reset();
                this.navigateTo('screen-dashboard');
            } else {
                alert('Credenciales de estudiante incorrectas.');
            }
        } catch (error) {
            console.error(error);
            alert('Error al procesar el ingreso.');
        }
    },

    // 5. CARGA Y PARSEO DE ARCHIVOS TXT (ADMIN PANEL)
    handleUploadQuiz(e) {
        e.preventDefault();
        const fileInput = document.getElementById('adm-file');
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const questions = this.parseTxtQuestions(text);
            
            if (questions.length === 0) {
                alert('No se detectaron preguntas válidas en el archivo. Verifica el formato.');
                return;
            }

            const quizData = {
                title: document.getElementById('adm-title').value.trim(),
                level: document.getElementById('adm-level').value,
                maxScore: parseInt(document.getElementById('adm-max-score').value),
                timeIdeal: parseInt(document.getElementById('adm-time').value),
                questionsCount: questions.length,
                questions: questions,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('cuestionarios').add(quizData);
                alert('¡Cuestionario publicado y cargado correctamente en Cloud Firestore!');
                document.getElementById('form-upload-quiz').reset();
                this.navigateTo('screen-dashboard');
            } catch (err) {
                console.error(err);
                alert('Error al subir el cuestionario.');
            }
        };
        reader.readAsText(file);
    },

    parseTxtQuestions(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const questions = [];
        let currentQuestion = null;

        lines.forEach(line => {
            // Detección de una opción standard A), B), C), D) o variantes conceptuales
            if (/^[A-D]\)/i.test(line)) {
                if (currentQuestion) {
                    const isCorrect = /R$/i.test(line);
                    // Remover prefijo estructural y sufijo evaluador R
                    let cleanText = line.replace(/^[A-D]\)/i, '').trim();
                    if (isCorrect) cleanText = cleanText.replace(/R$/i, '').trim();

                    currentQuestion.options.push({
                        text: cleanText,
                        isCorrect: isCorrect
                    });
                }
            } else {
                // Si la línea no es opción, constituye el inicio de una nueva pregunta
                if (currentQuestion && currentQuestion.options.length >= 2) {
                    questions.push(currentQuestion);
                }
                currentQuestion = {
                    questionText: line,
                    options: []
                };
            }
        });

        if (currentQuestion && currentQuestion.options.length >= 2) {
            questions.push(currentQuestion);
        }
        return questions;
    },

    // 6. RENDERIZACIÓN DINÁMICA DE VISTAS (DASHBOARD, RANKING, PERFIL)
    async renderDashboard() {
        const container = document.getElementById('quizzes-container');
        container.innerHTML = '<div class="loader"></div>';

        try {
            let query = db.collection('cuestionarios');
            // Filtrar cuestionarios pertinentes por nivel si no es administrador
            if (this.currentUser && this.currentUser.username !== 'admin' && this.currentUser.level) {
                // Traer los del nivel del alumno o configurados para todos
                query = query.where('level', 'in', [this.currentUser.level, 'Todos']);
            }

            const snapshot = await query.get();
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = '<p>No hay cuestionarios disponibles para mostrar en este momento.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const quiz = doc.data();
                const quizId = doc.id;

                const card = document.createElement('div');
                card.className = 'card quiz-card';
                card.innerHTML = `
                    <div>
                        <h3>${quiz.title}</h3>
                        <div class="quiz-meta-tags">
                            <span class="badge badge-level"><i class="fa-solid fa-layer-group"></i> ${quiz.level}</span>
                            <span class="badge badge-time"><i class="fa-solid fa-clock"></i> ${quiz.timeIdeal}s</span>
                            <span class="badge badge-score"><i class="fa-solid fa-star"></i> ${quiz.maxScore} pts</span>
                        </div>
                    </div>
                    <button onclick="app.startQuizSequence('${quizId}')" class="btn btn-primary btn-block">
                        <i class="fa-solid fa-play"></i> Jugar Cuestionario
                    </button>
                `;
                container.appendChild(card);
            });
        } catch (error) {
            console.error(error);
            container.innerHTML = '<p>Error al cargar el listado de desafíos.</p>';
        }
    },

    async renderRanking() {
        const tbody = document.getElementById('ranking-tbody');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando clasificación...</td></tr>';

        try {
            // Consulta optimizada para la extracción del TOP 20
            const snapshot = await db.collection('records')
                .orderBy('score', 'desc')
                .orderBy('time', 'asc')
                .limit(20)
                .get();

            tbody.innerHTML = '';
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center">Aún no existen registros globales registrados.</td></tr>';
                return;
            }

            let index = 1;
            snapshot.forEach(doc => {
                const rec = doc.data();
                const m = Math.floor(rec.time / 60);
                const s = rec.time % 60;
                const formattedTime = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                
                let medalClass = `rank-${index}`;
                let row = `
                    <tr>
                        <td><span class="rank-pos ${index <= 3 ? medalClass : ''}">${index}</span></td>
                        <td><strong>${rec.fullname}</strong></td>
                        <td><span class="badge badge-level">${rec.level || 'General'}</span></td>
                        <td>${rec.quizTitle}</td>
                        <td><strong class="text-primary">${rec.score} pts</strong></td>
                        <td><i class="fa-regular fa-clock"></i> ${formattedTime}</td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
                index++;
            });
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error al compilar la tabla clasificatoria.</td></tr>';
        }
    },

    async renderProfile() {
        if (!this.currentUser) {
            alert('Debes iniciar sesión para ver tu perfil.');
            this.navigateTo('screen-login');
            return;
        }

        // Sincronizar datos frescos del usuario desde la BD corporativa
        if(this.currentUser.username !== 'admin') {
            try {
                const freshUser = await db.collection('usuarios').doc(this.currentUser.username).get();
                if(freshUser.exists) this.currentUser = freshUser.data();
            } catch(e) { console.error(e); }
        }

        document.getElementById('profile-name').innerText = this.currentUser.fullname;
        document.getElementById('profile-level').innerText = `Estudiante: ${this.currentUser.level}`;
        document.getElementById('profile-user-tag').innerText = this.currentUser.username;
        document.getElementById('badge-xp').innerText = `${this.currentUser.xp || 0} XP`;
        document.getElementById('badge-medals').innerText = `${this.currentUser.medals || 0} Medallas`;

        const tbody = document.getElementById('profile-records-tbody');
        tbody.innerHTML = '<tr><td colspan="4">Buscando tus marcas...</td></tr>';

        try {
            const snapshot = await db.collection('records')
                .where('username', '==', this.currentUser.username)
                .get();

            tbody.innerHTML = '';
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="4">No has completado cuestionarios todavía. ¡Empieza hoy!</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const m = Math.floor(data.time / 60);
                const s = data.time % 60;
                
                tbody.insertAdjacentHTML('beforeend', `
                    <tr>
                        <td><strong>${data.quizTitle}</strong></td>
                        <td><span class="text-success">${data.score} pts</span></td>
                        <td>${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}</td>
                        <td>${data.attempt || 1} / 3</td>
                    </tr>
                `);
            });
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4">Error al mapear el historial personal.</td></tr>';
        }
    },

    // 7. LÓGICA DEL CUESTIONARIO Y MECÁNICAS DE JUEGO (GAMIFICACIÓN)
    async startQuizSequence(quizId) {
        if (!this.currentUser) {
            alert('Por favor, inicia sesión o regístrate para comenzar a jugar los desafíos.');
            this.navigateTo('screen-login');
            return;
        }

        try {
            const quizDoc = await db.collection('cuestionarios').doc(quizId).get();
            if (!quizDoc.exists) return;

            this.activeQuiz = { id: quizDoc.id, ...quizDoc.data() };
            
            // Evaluar número de intentos consumidos por el estudiante
            const recordDoc = await db.collection('records')
                .doc(`${this.currentUser.username}_${quizId}`).get();
            
            this.userAttemptsForQuiz = recordDoc.exists ? (recordDoc.data().attempt || 0) : 0;

            if (this.userAttemptsForQuiz >= 3) {
                alert('Has alcanzado el límite permitido de 3 intentos para este cuestionario.');
                return;
            }

            this.userAttemptsForQuiz++; // Avanzar contador de intento en curso
            this.executeCountdown();
        } catch (error) {
            console.error(error);
        }
    },

    executeCountdown() {
        this.navigateTo('screen-countdown');
        let counter = 3;
        const box = document.getElementById('countdown-number');
        box.innerText = counter;
        audioEngine.playCountdown();

        const interval = setInterval(() => {
            counter--;
            if (counter > 0) {
                box.innerText = counter;
                audioEngine.playCountdown();
            } else if (counter === 0) {
                box.innerText = "¡COMIENZA!";
                audioEngine.playCountdown();
            } else {
                clearInterval(interval);
                this.launchQuizEngine();
            }
        }, 1000);
    },

    launchQuizEngine() {
        this.activeQuestions = [...this.activeQuiz.questions];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.secondsElapsed = 0;
        this.currentQuizResponses = [];

        document.getElementById('active-quiz-title').innerText = this.activeQuiz.title;
        this.navigateTo('screen-quiz');
        
        // Controladores del cronómetro
        document.getElementById('quiz-timer').innerText = "00:00";
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.secondsElapsed++;
            const m = Math.floor(this.secondsElapsed / 60);
            const s = this.secondsElapsed % 60;
            document.getElementById('quiz-timer').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }, 1000);

        this.displayQuestion();
    },

    displayQuestion() {
        const total = this.activeQuestions.length;
        const index = this.currentQuestionIndex;

        // Actualizar barras e indicadores
        document.getElementById('quiz-progress').innerText = `${index + 1}/${total}`;
        const pct = ((index) / total) * 100;
        document.getElementById('quiz-progress-bar').style.width = `${pct}%`;

        if (index >= total) {
            this.finalizeQuizEvent();
            return;
        }

        const q = this.activeQuestions[index];
        document.getElementById('question-text').innerText = q.questionText;

        const container = document.getElementById('options-container');
        container.innerHTML = '';

        const prefixes = ['A', 'B', 'C', 'D'];
        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `<span class="option-prefix">${prefixes[idx]}</span> <span class="opt-text">${opt.text}</span>`;
            btn.onclick = () => this.evaluateAnswer(btn, opt, q);
            container.appendChild(btn);
        });
    },

    evaluateAnswer(selectedBtn, option, question) {
        // Bloquear re-clics en el grid de opciones desactivándolos temporalmente
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        
        const isCorrect = option.isCorrect;
        let chosenText = option.text;
        let correctText = question.options.find(o => o.isCorrect)?.text || '';

        // Almacenar metadatos para persistencia y exportación en PDF
        this.currentQuizResponses.push({
            question: question.questionText,
            chosen: chosenText,
            correct: correctText,
            isCorrect: isCorrect
        });

        if (isCorrect) {
            selectedBtn.classList.add('correct');
            audioEngine.playCorrect();
            // Regla de asignación proporcional de puntajes equitativos
            const pointsPerQuestion = this.activeQuiz.maxScore / this.activeQuestions.length;
            this.score += pointsPerQuestion;
        } else {
            selectedBtn.classList.add('incorrect');
            audioEngine.playIncorrect();
            // Destacar de manera visual la opción que contenía la respuesta válida
            document.querySelectorAll('.option-btn').forEach(b => {
                const txt = b.querySelector('.opt-text').innerText;
                if (txt === correctText) b.classList.add('correct');
            });
        }

        // Delay de lectura interactiva antes del paso a la subsecuente pregunta
        setTimeout(() => {
            this.currentQuestionIndex++;
            if (this.currentQuestionIndex < this.activeQuestions.length) {
                this.displayQuestion();
            } else {
                this.finalizeQuizEvent();
            }
        }, 1600);
    },

    async finalizeQuizEvent() {
        clearInterval(this.timerInterval);
        document.getElementById('quiz-progress-bar').style.width = `100%`;

        this.score = Math.round(this.score);
        const ratio = (this.score / this.activeQuiz.maxScore) * 100;

        // Despliegue de triggers gamificados, mensajes motivacionales y efectos
        const headline = document.getElementById('results-headline');
        const motiv = document.getElementById('results-motivation');
        const iconBox = document.getElementById('results-icon-container');

        if (ratio >= 80) {
            headline.innerText = "¡Espectacular Desempeño!";
            motiv.innerText = "¡Eres increíble! Tu preparación está dando frutos extraordinarios.";
            iconBox.innerHTML = '<i class="fa-solid fa-trophy results-trophy"></i>';
            audioEngine.playTrophy();
            // Disparador de confetti
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        } else if (ratio >= 50) {
            headline.innerText = "¡Buen Trabajo!";
            motiv.innerText = "¡Muy bien! Tienes un gran dominio pero puedes perfeccionarlo.";
            iconBox.innerHTML = '<i class="fa-solid fa-medal results-trophy" style="color: #cbd5e1;"></i>';
            audioEngine.playVictory();
        } else {
            headline.innerText = "¡Sigue Adelante!";
            motiv.innerText = "¡No te rindas! Cada error es una valiosa oportunidad de aprendizaje.";
            iconBox.innerHTML = '<i class="fa-solid fa-face-frown results-sad"></i>';
            audioEngine.playIncorrect();
        }

        document.getElementById('res-score').innerText = `${this.score} / ${this.activeQuiz.maxScore} pts`;
        const m = Math.floor(this.secondsElapsed / 60);
        const s = this.secondsElapsed % 60;
        document.getElementById('res-time').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        document.getElementById('res-attempt').innerText = `#${this.userAttemptsForQuiz}`;

        this.navigateTo('screen-results');

        // Escritura transaccional en Cloud Firestore (Guardar Resultados e Historial de Récords)
        if (this.currentUser && this.currentUser.username !== 'admin') {
            const resultPayload = {
                username: this.currentUser.username,
                fullname: this.currentUser.fullname,
                level: this.currentUser.level,
                quizId: this.activeQuiz.id,
                quizTitle: this.activeQuiz.title,
                score: this.score,
                time: this.secondsElapsed,
                attempt: this.userAttemptsForQuiz,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                // Guardar en log histórico general de resultados
                await db.collection('resultados').add(resultPayload);

                // Evaluar si califica como mejor récord para actualizar el documento único
                const recordRef = db.collection('records').doc(`${this.currentUser.username}_${this.activeQuiz.id}`);
                const existingRecord = await recordRef.get();

                let isNewRecordBetter = true;
                if (existingRecord.exists) {
                    const oldData = existingRecord.data();
                    if (this.score < oldData.score) {
                        isNewRecordBetter = false; 
                    } else if (this.score === oldData.score && this.secondsElapsed >= oldData.time) {
                        isNewRecordBetter = false;
                    }
                }

                if (isNewRecordBetter) {
                    await recordRef.set(resultPayload);
                } else {
                    // Si el récord anterior es mejor, actualizamos el contador de intentos del documento existente
                    await recordRef.update({ attempt: this.userAttemptsForQuiz });
                }

                // Bonificación gamificada de XP y medallas
                let xpEarned = this.score * 10;
                let medalEarned = ratio >= 90 ? 1 : 0;

                await db.collection('usuarios').doc(this.currentUser.username).update({
                    xp: firebase.firestore.FieldValue.increment(xpEarned),
                    medals: firebase.firestore.FieldValue.increment(medalEarned)
                });

            } catch (err) {
                console.error("Error al persistir métricas de juego: ", err);
            }
        }
    },

    // 8. SUBSISTEMA DE EXPORTACIÓN Y GENERACIÓN EN PDF COMPLETAMENTE AUTÓNOMO
    async downloadPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const m = Math.floor(this.secondsElapsed / 60);
        const s = this.secondsElapsed % 60;
        const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        // Encabezado institucional estilizado
        doc.setFillColor(30, 41, 59); // Azul oscuro
        doc.rect(0, 0, 210, 35, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(22);
        doc.text("QUIZMASTER EDU", 15, 18);
        
        doc.setFontSize(10);
        doc.setFont("Helvetica", "normal");
        doc.text("Reporte de Rendimiento Académico Oficial", 15, 25);
        doc.text("Kabert Studio - LMKE", 160, 25);

        // Bloque informativo del Estudiante y el Desafío ejecutado
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(14);
        doc.setFont("Helvetica", "bold");
        doc.text("Resumen del Estudiante", 15, 48);

        doc.setLineWidth(0.5);
        doc.setDrawColor(226, 232, 240);
        doc.line(15, 51, 195, 51);

        doc.setFontSize(11);
        doc.setFont("Helvetica", "normal");
        
        let currentY = 58;
        const printMetaRow = (label, value, label2, value2) => {
            doc.setFont("Helvetica", "bold"); doc.text(label, 15, currentY);
            doc.setFont("Helvetica", "normal"); doc.text(value, 55, currentY);
            if(label2) {
                doc.setFont("Helvetica", "bold"); doc.text(label2, 110, currentY);
                doc.setFont("Helvetica", "normal"); doc.text(value2, 145, currentY);
            }
            currentY += 7;
        };

        printMetaRow("Nombre Completo:", this.currentUser ? this.currentUser.fullname : "Invitado", "Cuestionario:", this.activeQuiz.title);
        printMetaRow("Nivel Académico:", this.currentUser ? this.currentUser.level : "General", "Puntaje Obtenido:", `${this.score} / ${this.activeQuiz.maxScore} Puntos`);
        printMetaRow("Tiempo Empleado:", timeStr, "Intento Número:", `#${this.userAttemptsForQuiz}`);
        printMetaRow("Fecha de Emisión:", new Date().toLocaleDateString('es-ES'));

        // Obtener el Top del Cuestionario para la sección de ranking interna
        let rankStr = "Fuera de rango";
        try {
            const snap = await db.collection('records')
                .where('quizId', '==', this.activeQuiz.id)
                .orderBy('score', 'desc').orderBy('time', 'asc').get();
            let pos = 1;
            snap.forEach(d => {
                if(d.data().username === this.currentUser.username) rankStr = `Posición #${pos} en este cuestionario`;
                pos++;
            });
        } catch(ex){ console.log(ex); }
        
        printMetaRow("Clasificación en el Quiz:", rankStr);

        currentY += 5;
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Desglose Analítico de Preguntas", 15, currentY);
        
        // Construcción de la matriz estructurada para inyección en AutoTable
        const tableBody = this.currentQuizResponses.map((item, idx) => [
            idx + 1,
            item.question,
            item.chosen,
            item.correct,
            item.isCorrect ? "Correcta" : "Incorrecta"
        ]);

        doc.autoTable({
            startY: currentY + 4,
            head: [['N°', 'Pregunta', 'Respuesta Elegida', 'Respuesta Correcta', 'Evaluación']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [108, 92, 231], fontStyle: 'bold' },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 4) {
                    if (data.cell.raw === 'Correcta') {
                        data.cell.styles.textColor = [5, 150, 105];
                        data.cell.styles.fontStyle = 'bold';
                    } else {
                        data.cell.styles.textColor = [239, 68, 68];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        // Generar la Página Final del Reporte de Metas Estudiantiles
        doc.addPage();
        
        // Encabezado de la página final
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text("CONCLUSIÓN GENERAL DEL DESEMPEÑO", 15, 13);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(12);
        doc.setFont("Helvetica", "bold");
        doc.text("Retroalimentación Pedagógica Sincronizada:", 15, 35);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(11);
        let ratio = (this.score / this.activeQuiz.maxScore) * 100;
        let conclusionText = "";

        if(ratio >= 80) {
            conclusionText = "El estudiante demuestra una asimilación excepcional de las unidades de competencia abordadas en este cuestionario. Muestra habilidades críticas superiores de resolución y una velocidad adaptativa óptima. Se recomienda mantener el ritmo avanzado e introducir desafíos con variables complejas.";
        } else if(ratio >= 50) {
            conclusionText = "El estudiante se ubica en el rango de aprobación estándar. Identifica conceptos clave y estructuras básicas, manifestando debilidades puntuales en detalles de retención o análisis bajo presión de tiempo. Se sugiere repasar los ítems errados y realizar un segundo intento focalizado.";
        } else {
            conclusionText = "El resultado denota la necesidad imperiosa de implementar tutorías de refuerzo pedagógico personalizado sobre los núcleos de aprendizaje evaluados. Se aconseja revisar los materiales de lectura fundamentales, conceptualizar el glosario de términos y volver a intentar la prueba interactiva.";
        }

        const splitText = doc.splitTextToSize(conclusionText, 180);
        doc.text(splitText, 15, 43);

        // Decorador de firma institucional al pie de página
        doc.setDrawColor(180, 180, 180);
        doc.line(65, 120, 145, 120);
        doc.setFontSize(10);
        doc.setFont("Helvetica", "bold");
        doc.text("Sello de Validación Automatizada", 105, 126, { align: "center" });
        doc.setFont("Helvetica", "italic");
        doc.text("QuizMaster Edu Platform - Kabert Studio", 105, 131, { align: "center" });

        // Disparar descarga en navegador del usuario
        doc.save(`Reporte_${this.activeQuiz.title.replace(/\s+/g, '_')}_${this.currentUser ? this.currentUser.username : 'invitado'}.pdf`);
    }
};

// Inicialización de la SPA al cargar la ventana
window.addEventListener('DOMContentLoaded', () => app.init());