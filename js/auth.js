import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Generar correo falso para Auth
const formatEmail = (username) => `${username.trim().toLowerCase()}@quizmaster.edu`;

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombre').value;
        const nivel = document.getElementById('nivel').value;
        const usuario = document.getElementById('usuario').value;
        const pass = document.getElementById('password').value;
        const email = formatEmail(usuario);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;
            
            // Guardar en Firestore colección 'usuarios'
            await setDoc(doc(db, "usuarios", user.uid), {
                uid: user.uid,
                nombre: nombre,
                nivel: nivel,
                usuario: usuario,
                fechaRegistro: new Date().toISOString(),
                ultimaConexion: new Date().toISOString(),
                xp: 0,
                nivelJugador: "Explorador",
                medallas: 0
            });

            alert("¡Registro Exitoso! Bienvenido a QuizMaster Edu.");
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert("Error en el registro: " + error.message);
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usuario = document.getElementById('usuario').value;
        const pass = document.getElementById('password').value;
        const email = formatEmail(usuario);

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert("Usuario o contraseña incorrectos.");
        }
    });
}