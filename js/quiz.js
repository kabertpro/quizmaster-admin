// (Asumiendo que has cargado las variables del cuestionario actual desde Firestore)
let preguntas = []; // Llenar con datos de Firebase
let preguntaActual = 0;
let aciertos = 0;
let tiempoSegundos = 0;
let timerInterval;

const audioSuccess = new Audio('assets/sounds/success.mp3');
const audioFail = new Audio('assets/sounds/fail.mp3');
const audioTrophy = new Audio('assets/sounds/trophy.mp3');

function iniciarCuentaRegresiva() {
    let contador = 3;
    const pantalla = document.getElementById('countdown-screen');
    pantalla.style.display = 'flex';
    
    const intervalo = setInterval(() => {
        document.getElementById('countdown-text').innerText = contador;
        if (contador === 0) {
            document.getElementById('countdown-text').innerText = "¡COMIENZA!";
            setTimeout(() => {
                pantalla.style.display = 'none';
                iniciarQuiz();
            }, 1000);
            clearInterval(intervalo);
        }
        contador--;
    }, 1000);
}

function iniciarQuiz() {
    timerInterval = setInterval(() => {
        tiempoSegundos++;
        document.getElementById('timer').innerText = `Tiempo: ${tiempoSegundos}s`;
    }, 1000);
    mostrarPregunta();
}

function mostrarPregunta() {
    if (preguntaActual >= preguntas.length) return finalizarQuiz();
    
    const p = preguntas[preguntaActual];
    document.getElementById('pregunta-texto').innerText = p.pregunta;
    
    const opcionesContenedor = document.getElementById('opciones-container');
    opcionesContenedor.innerHTML = '';
    
    p.opciones.forEach((opcion, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn opcion-btn';
        btn.innerText = opcion;
        btn.onclick = () => verificarRespuesta(index, p.indexCorrecta, btn);
        opcionesContenedor.appendChild(btn);
    });
}

function verificarRespuesta(seleccionado, correcto, btnDOM) {
    const mensajesExito = ['¡Excelente!', '¡Muy bien!', '¡Genial!', '¡Sigue así!', '¡Increíble!'];
    const mensajesFallo = ['¡Sigue intentando!', '¡Tú puedes!', '¡No te rindas!'];
    
    const mensajeDIV = document.getElementById('feedback-mensaje');

    if (seleccionado === correcto) {
        btnDOM.classList.add('correct');
        audioSuccess.play();
        aciertos++;
        mensajeDIV.innerText = mensajesExito[Math.floor(Math.random() * mensajesExito.length)];
        mensajeDIV.style.color = "var(--verde-lima)";
    } else {
        btnDOM.classList.add('incorrect');
        audioFail.play();
        mensajeDIV.innerText = mensajesFallo[Math.floor(Math.random() * mensajesFallo.length)];
        mensajeDIV.style.color = "var(--error)";
    }

    setTimeout(() => {
        mensajeDIV.innerText = "";
        preguntaActual++;
        mostrarPregunta();
    }, 1500);
}

function finalizarQuiz() {
    clearInterval(timerInterval);
    const porcentaje = (aciertos / preguntas.length) * 100;
    
    // Lógica Gamificada y Confeti
    if (porcentaje === 100) {
        audioTrophy.play();
        lanzarConfeti(true);
        // Mostrar animación épica
    } else if (porcentaje >= 80) {
        lanzarConfeti(false);
    }

    // Aquí iría el código para guardar en Firebase (Resultados y Récords)
    // ...
    
    document.getElementById('quiz-container').innerHTML = `
        <h2>¡Cuestionario Terminado!</h2>
        <p>Aciertos: ${aciertos} de ${preguntas.length}</p>
        <p>Porcentaje: ${porcentaje.toFixed(2)}%</p>
        <p>Tiempo: ${tiempoSegundos} segundos</p>
        <button class="btn" onclick="generarPDF()">Descargar PDF de Resultados</button>
        <button class="btn" onclick="window.location.href='dashboard.html'">Volver al Inicio</button>
    `;
}

function lanzarConfeti(epico) {
    if(epico) {
        var duration = 3000; var end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    } else {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
}

// jsPDF Exportación
function generarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Reporte QUIZMASTER EDU", 20, 20);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(`Puntaje: ${aciertos}/${preguntas.length}`, 20, 40);
    doc.text(`Tiempo: ${tiempoSegundos}s`, 20, 50);
    
    doc.setFontSize(10);
    doc.text("Generado por Kabert Studio - LMKE", 20, 280);
    
    doc.save("Reporte_QuizMaster.pdf");
}