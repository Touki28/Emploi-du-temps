// Créer des gouttes de pluie aléatoires
function createRain() {
	const rainContainer = document.querySelector('.animated-bg');
	for (let i = 0; i < 30; i++) {
		const rain = document.createElement('div');
		rain.className = 'rain';
		rain.style.left = Math.random() * 100 + '%';
		rain.style.animationDuration = (Math.random() * 2 + 1) + 's';
		rain.style.animationDelay = Math.random() * 2 + 's';
		rainContainer.appendChild(rain);
	}
}

createRain();

// Easter egg: clic sur le logo
let clickCount = 0;
document.querySelector('h1').addEventListener('click', () => {
	clickCount++;
	if (clickCount === 5) {
		window.location.href = "/intranet-akakatsuki/src/html/secret.html";
		clickCount = 0;
	}
});

// --------------------------------------------------------
// GESTION DE LA POP-UP PAR LES LIENS DE NAVIGATION : CORRIGÉ
// --------------------------------------------------------

// --- Gestion de la pop-up ---
var modal = document.getElementById("loginModal");
var closeSpan = document.querySelector('.close');
var navLinks = document.querySelectorAll('.nav-card');

// Si l’utilisateur clique une carte SANS être connecté → modal
navLinks.forEach(link => {
    link.addEventListener('click', function (event) {
        if (!isUserAuthenticated()) {
            event.preventDefault();
            modal.style.display = "block";
        }
    });
});

// Fermer la modale via le bouton X
if (closeSpan) {
    closeSpan.onclick = function () {
        modal.style.display = "none";
    };
}

// Fermer en cliquant dehors
window.onclick = function (event) {
    if (event.target === modal) {
        modal.style.display = "none";
    }
};

document.querySelector("#loginModal form").addEventListener("submit", function(e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (login(username, password)) {
        // Le login() s’occupe déjà du reload
    } else {
        alert("Identifiants incorrects.");
    }
});