import { db } from './firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_PASSWORD = "admin123";

function verificarAdmin() {
    const pass = prompt("Ingrese contraseña de Administrador:");
    if (pass !== ADMIN_PASSWORD) {
        alert("Acceso denegado.");
        window.location.href = 'index.html';
    }
}

// Lógica para procesar el TXT
document.getElementById('upload-txt-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('file-txt');
    if (!fileInput.files.length) return alert("Selecciona un archivo TXT");

    const file = fileInput.files[0];
    const titulo = document.getElementById('quiz-titulo').value;
    const curso = document.getElementById('quiz-curso').value;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const preguntas = parsearTXT(text);
        
        try {
            await addDoc(collection(db, "cuestionarios"), {
                titulo: titulo,
                cursoDestino: curso,
                estado: "activo",
                preguntas: preguntas,
                fechaCreacion: new Date().toISOString()
            });
            alert("¡Cuestionario creado con éxito en Firebase!");
        } catch (error) {
            alert("Error al subir cuestionario: " + error.message);
        }
    };
    reader.readAsText(file);
});

// Función de Parsing Mágica
function parsearTXT(texto) {
    const lineas = texto.split('\n').map(l => l.trim()).filter(l => l !== '');
    const preguntas = [];
    let currentPregunta = null;

    lineas.forEach(linea => {
        // Detectar si es una opción (Ej: "A) Respuesta")
        const esOpcion = /^[A-D]\)/i.test(linea);

        if (!esOpcion) {
            if (currentPregunta) preguntas.push(currentPregunta);
            currentPregunta = { pregunta: linea, opciones: [], indexCorrecta: -1 };
        } else {
            // Verificar si termina en " R"
            const esCorrecta = linea.endsWith(" R") || linea.endsWith(" r");
            // Limpiar la opción (quitar "A) " y " R")
            let textoOpcion = linea.substring(3).trim();
            if (esCorrecta) {
                textoOpcion = textoOpcion.substring(0, textoOpcion.length - 2).trim();
            }
            
            currentPregunta.opciones.push(textoOpcion);
            if (esCorrecta) {
                currentPregunta.indexCorrecta = currentPregunta.opciones.length - 1;
            }
        }
    });
    if (currentPregunta) preguntas.push(currentPregunta);
    return preguntas;
}

// Inicializar seguridad al cargar
verificarAdmin();