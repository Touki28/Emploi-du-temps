// Variables globales
let allEvents = [];
let currentWeek = null;
let currentGroup = 'G1'; // Groupe par défaut

// ===== GESTION DES BOUTONS DE GROUPE =====
const buttons = document.querySelectorAll(".group-btn");

buttons.forEach(btn => {
	btn.addEventListener("click", async () => {
		const selectedGroup = btn.dataset.groupe;
		
		// Si c'est déjà le groupe sélectionné, ne rien faire
		if (selectedGroup === currentGroup) return;
		
		// Mise à jour visuelle
		buttons.forEach(b => b.classList.remove("selected"));
		btn.classList.add("selected");
		
		// Mise à jour du groupe
		currentGroup = selectedGroup;
		console.log("📅 Chargement du groupe :", currentGroup);
		
		// Recharger les événements
		await loadAndDisplayICS(currentGroup);
	});
});

// ===== CHARGEMENT DES FICHIERS ICS =====
async function loadICS(group) {
	const filename = `emploi-du-temps-${group}.ics`;
	const res = await fetch(`../emploi-du-temps/${filename}`);
	
	if (!res.ok) {
		console.error(`❌ Erreur de chargement du fichier ${filename}`);
		return [];
	}
	
	const icsText = await res.text();
	const events = parseICS(icsText);
	return events.sort((a, b) => a.start - b.start);
}

async function loadAndDisplayICS(group) {
	const events = await loadICS(group);
	allEvents = events;
	
	if (events.length > 0) {
		// Si on n'a pas encore de semaine, prendre la semaine actuelle
		if (!currentWeek) {
			currentWeek = getWeekNumber(new Date());
		}
		displayWeek(allEvents, currentWeek);
	} else {
		document.getElementById('calendar').innerHTML = `
			<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #e94560;">
				❌ Aucun événement trouvé pour le groupe ${group}
			</div>
		`;
	}
}

// ===== PARSING ICS =====
function parseICS(text) {
	const lines = text.split('\n');
	const events = [];
	let current = null;

	for (let line of lines) {
		line = line.trim();
		if (line === 'BEGIN:VEVENT') {
			current = {};
		} else if (line === 'END:VEVENT' && current) {
			if (current.start && current.summary && !current.uid?.includes('COURSANNULE') && !current.uid?.includes('Ferie')) {
				events.push(current);
			}
			current = null;
		} else if (current) {
			if (line.startsWith('DTSTART')) current.start = parseICSDate(line);
			if (line.startsWith('DTEND')) current.end = parseICSDate(line);
			if (line.startsWith('SUMMARY')) current.summary = line.split(':')[1];
			if (line.startsWith('LOCATION')) current.location = line.split(':')[1];
			if (line.startsWith('UID')) current.uid = line.split(':')[1];
		}
	}
	return events;
}

function parseICSDate(line) {
	const [meta, value] = line.split(':');
	if (!value) return null;

	// Format UTC (finit par Z)
	if (value.endsWith('Z')) {
		const year = +value.slice(0, 4);
		const month = +value.slice(4, 6) - 1;
		const day = +value.slice(6, 8);
		const hour = +value.slice(9, 11);
		const minute = +value.slice(11, 13);
		return new Date(Date.UTC(year, month, day, hour, minute));
	}

	// Format avec fuseau horaire explicite (Europe/Paris)
	if (meta.includes('TZID=Europe/Paris')) {
		const year = +value.slice(0, 4);
		const month = +value.slice(4, 6) - 1;
		const day = +value.slice(6, 8);
		const hour = +value.slice(9, 11);
		const minute = +value.slice(11, 13);
		return new Date(year, month, day, hour, minute);
	}

	// Sinon, on suppose que c'est une heure locale
	const year = +value.slice(0, 4);
	const month = +value.slice(4, 6) - 1;
	const day = +value.slice(6, 8);
	const hour = +value.slice(9, 11);
	const minute = +value.slice(11, 13);
	return new Date(year, month, day, hour, minute);
}

// ===== GESTION DES SEMAINES =====
function getWeekNumber(date) {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekDays(weekNumber, year) {
	const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
	const dow = simple.getDay();
	const ISOweekStart = simple;
	if (dow <= 4) {
		ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
	} else {
		ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
	}
	
	const days = [];
	for (let i = 0; i < 6; i++) {
		const day = new Date(ISOweekStart);
		day.setDate(ISOweekStart.getDate() + i);
		days.push(day);
	}
	return days;
}

// ===== AFFICHAGE DU CALENDRIER =====
function displayWeek(events, week) {
	const container = document.getElementById('calendar');
	container.innerHTML = '';
	
	const year = new Date().getFullYear();
	const weekDays = getWeekDays(week, year);
	
	document.getElementById('weekLabel').textContent = `Semaine ${week}`;

	const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

	weekDays.forEach((date, index) => {
		const dayColumn = document.createElement('div');
		dayColumn.className = 'day-column';

		const dayHeader = document.createElement('div');
		dayHeader.className = 'day-header';
		dayHeader.innerHTML = `
			<div class="day-name">${dayNames[index]}</div>
			<div class="day-date">${date.getDate()}/${date.getMonth() + 1}</div>
		`;
		dayColumn.appendChild(dayHeader);

		const eventsContainer = document.createElement('div');
		eventsContainer.className = 'events-container';

		const dayEvents = events.filter(e => e.start.toDateString() === date.toDateString())
								.sort((a, b) => a.start - b.start);

		if (dayEvents.length === 0) {
			const noEvents = document.createElement('div');
			noEvents.className = 'no-events';
			noEvents.textContent = 'Le sang a assez coulé';
			eventsContainer.appendChild(noEvents);
		} else {
			dayEvents.forEach(ev => {
				const eventCard = document.createElement('div');
				eventCard.className = 'event-card';
				eventCard.innerHTML = `
					<div class="event-time">
						${ev.start.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})} 
						- ${ev.end.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}
					</div>
					<div class="event-summary">${ev.summary}</div>
					${ev.location ? `<div class="event-location">📍 ${ev.location}</div>` : ''}
				`;
				eventsContainer.appendChild(eventCard);
			});
		}

		dayColumn.appendChild(eventsContainer);
		container.appendChild(dayColumn);
	});
}

// ===== NAVIGATION SEMAINE =====
document.getElementById('prevWeek').addEventListener('click', () => {
	currentWeek--;
	displayWeek(allEvents, currentWeek);
});

document.getElementById('nextWeek').addEventListener('click', () => {
	currentWeek++;
	displayWeek(allEvents, currentWeek);
});

// ===== CHARGEMENT INITIAL =====
loadAndDisplayICS(currentGroup);