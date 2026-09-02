// ========================================
// EMPLOI DU TEMPS — L3 Informatique, Groupe A
// ========================================

const ICS_FILENAME = 'emploi-du-temps.ics'; // mis à jour automatiquement (GitHub Action)

let allEvents = [];
let currentWeek = null;

// ===== CHARGEMENT DU FICHIER ICS =====
async function loadICS() {
	// cache-busting pour toujours récupérer la dernière version publiée
	const url = `${ICS_FILENAME}?t=${Date.now()}`;
	const res = await fetch(url, { cache: 'no-store' });

	if (!res.ok) {
		console.error(`❌ Impossible de charger ${ICS_FILENAME}`);
		return [];
	}

	const icsText = await res.text();
	const events = parseICS(icsText);
	return events.sort((a, b) => a.start - b.start);
}

async function loadAndDisplay() {
	const rawEvents = await loadICS();
	allEvents = rawEvents.filter(isGroupAEvent);

	if (!currentWeek) {
		currentWeek = getWeekNumber(new Date());
	}
	displayWeek(currentWeek);
}

// ===== FILTRAGE GROUPE A (exclut GrB/GrC seuls + options) =====
function isGroupAEvent(ev) {
	const s = ev.summary || '';

	// Exclut les options (OPT1, OPT2...) : non suivies en alternance
	if (/OPT\d/i.test(s)) return false;

	// Si l'événement mentionne un/des groupe(s), il faut que GrA en fasse partie
	const hasGroupTag = /Gr[A-Z]\b/.test(s);
	if (hasGroupTag && !/\bGrA\b/.test(s)) return false;

	return true;
}

// ===== PARSING ICS =====
function parseICS(text) {
	const lines = text.split('\n');
	const events = [];
	let current = null;

	for (let rawLine of lines) {
		const line = rawLine.trim();
		if (line === 'BEGIN:VEVENT') {
			current = {};
		} else if (line === 'END:VEVENT' && current) {
			if (
				current.start &&
				current.summary &&
				!current.uid?.includes('COURSANNULE') &&
				!current.uid?.includes('Ferie')
			) {
				current.details = parseDescription(current.description || '');
				events.push(current);
			}
			current = null;
		} else if (current) {
			if (line.startsWith('DTSTART')) current.start = parseICSDate(line);
			if (line.startsWith('DTEND')) current.end = parseICSDate(line);
			if (line.startsWith('SUMMARY')) current.summary = unescapeICS(line.split(':').slice(1).join(':'));
			if (line.startsWith('LOCATION')) current.location = unescapeICS(line.split(':').slice(1).join(':'));
			if (line.startsWith('DESCRIPTION')) current.description = unescapeICS(line.split(':').slice(1).join(':'));
			if (line.startsWith('UID')) current.uid = line.split(':').slice(1).join(':');
		}
	}
	return events;
}

function unescapeICS(str) {
	return str.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

// Extrait les champs "Label : valeur" du DESCRIPTION (Matière, Enseignant, Salle, Type...)
function parseDescription(desc) {
	const details = {};
	desc.split('\n').forEach(line => {
		const idx = line.indexOf(':');
		if (idx === -1) return;
		const label = line.slice(0, idx).trim().toLowerCase();
		const value = line.slice(idx + 1).trim();
		if (!value) return;
		if (label.startsWith('matière')) details.matiere = value;
		else if (label.startsWith('enseignant')) details.enseignant = value;
		else if (label.startsWith('salle')) details.salle = value;
		else if (label.startsWith('type')) details.type = value;
	});
	return details;
}

function parseICSDate(line) {
	const [meta, ...rest] = line.split(':');
	const value = rest.join(':');
	if (!value) return null;

	const year = +value.slice(0, 4);
	const month = +value.slice(4, 6) - 1;
	const day = +value.slice(6, 8);

	if (value.length <= 8) {
		// Date seule (journée entière) — utilisé pour Vacances/Fériés, déjà exclus
		return new Date(year, month, day);
	}

	const hour = +value.slice(9, 11);
	const minute = +value.slice(11, 13);

	if (value.endsWith('Z')) {
		return new Date(Date.UTC(year, month, day, hour, minute));
	}
	return new Date(year, month, day, hour, minute);
}

// ===== GESTION DES SEMAINES (ISO) =====
function getWeekNumber(date) {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekDays(weekNumber) {
    const currentYear = new Date().getFullYear();
    const simple = new Date(currentYear, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;

    if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }

    const days = [];

    for (let i = 0; i < 5; i++) {
        const day = new Date(ISOweekStart);
        day.setDate(ISOweekStart.getDate() + i);
        days.push(day);
    }

    return days;
}

function toISODate(date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// Toutes les heures du .ics sont en UTC : on affiche/compare toujours en heure de Paris
function parisDateKey(date) {
	return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }); // YYYY-MM-DD
}

// Un événement (issu du .ics, en UTC) tombe-t-il sur ce jour de la grille (heure de Paris) ?
function isSameDay(eventDate, weekDay) {
	return parisDateKey(eventDate) === toISODate(weekDay);
}

// "Aujourd'hui" = date locale du visiteur (ce qu'il voit sur son propre appareil)
function isToday(weekDay) {
	return toISODate(weekDay) === toISODate(new Date());
}

// ===== ALTERNANCE : lecture des données figées =====
function getAlternanceForDay(date) {
	return (typeof ALTERNANCE !== 'undefined' && ALTERNANCE[toISODate(date)]) || null;
}

// Détermine le statut dominant de la semaine (pour le bandeau)
function getWeekAlternanceSummary(weekDays) {
	const entries = weekDays.map(getAlternanceForDay).filter(Boolean);
	if (entries.length === 0) return null;

	const allEntreprise = entries.every(e => e.alt === 'Entreprise');

	// Compte des types pour trouver le type dominant
	const typeCounts = {};
	entries.forEach(e => {
		const key = e.type || '(aucun)';
		typeCounts[key] = (typeCounts[key] || 0) + 1;
	});
	const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];

	const altCounts = {};
	entries.forEach(e => {
		if (e.alt) altCounts[e.alt] = (altCounts[e.alt] || 0) + 1;
	});
	const dominantAlt = Object.entries(altCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

	return { entries, allEntreprise, dominantType, dominantAlt };
}

function badgeInfoFor(summary) {
	const { dominantType, dominantAlt } = summary;

	if (dominantType.startsWith('Examens') || dominantType.startsWith('Exams')) {
		return { icon: '📝', label: dominantType, cls: 'badge-examens' };
	}
	if (dominantType === 'Vacances') {
		return { icon: '🌴', label: 'Vacances', cls: 'badge-vacances' };
	}
	if (dominantType === 'Stage') {
		return { icon: '💼', label: 'Stage', cls: 'badge-stage' };
	}
	if (dominantType.startsWith('Soutenances')) {
		return { icon: '🎓', label: 'Soutenances', cls: 'badge-stage' };
	}
	if (dominantType === 'Férié') {
		return { icon: '🎌', label: 'Férié', cls: 'badge-ferie' };
	}
	if (dominantAlt === 'Entreprise') {
		return { icon: '🏢', label: 'Semaine Entreprise', cls: 'badge-entreprise' };
	}
	if (dominantAlt === 'Université') {
		return { icon: '🎓', label: 'Semaine Université', cls: 'badge-universite' };
	}
	return null;
}

// ===== AFFICHAGE =====
function displayWeek(week) {
	document.getElementById('weekLabel').textContent = `Semaine ${week}`;

	const weekDays = getWeekDays(week);
	const summary = getWeekAlternanceSummary(weekDays);
	renderBanner(summary);

	const calendarEl = document.getElementById('calendar');

	// Semaine entièrement en entreprise -> pas de grille
	if (summary && summary.allEntreprise) {
		const label = badgeInfoFor(summary);
		calendarEl.innerHTML = `
			<div class="entreprise-week" style="grid-column: 1/-1;">
				<span class="big-icon">🏢</span>
				<p>${label ? label.label : 'Semaine en entreprise'} — pas de cours cette semaine.</p>
			</div>
		`;
		return;
	}

	renderCalendarGrid(weekDays);
}

function renderBanner(summary) {
	const el = document.getElementById('alternanceBanner');
	if (!summary) {
		el.innerHTML = '';
		return;
	}
	const info = badgeInfoFor(summary);
	if (!info) {
		el.innerHTML = '';
		return;
	}
	const obs = summary.entries.map(e => e.obs).filter(Boolean)[0] || '';
	el.innerHTML = `
		<div class="alternance-badge ${info.cls}">
			<span>${info.icon}</span>
			<span>${info.label}</span>
			${obs ? `<span class="obs">— ${obs}</span>` : ''}
		</div>
	`;
}

function renderCalendarGrid(weekDays) {
	const container = document.getElementById('calendar');
	container.innerHTML = '';

	const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
	const today = new Date();

	weekDays.forEach((date, index) => {
		const dayAlt = getAlternanceForDay(date);
		const isNormalUniDay = !dayAlt || (dayAlt.type === 'Enseignements' && dayAlt.alt === 'Université');

		const dayColumn = document.createElement('div');
		dayColumn.className = 'day-column';
		if (isToday(date)) dayColumn.classList.add('today');
		if (!isNormalUniDay) dayColumn.classList.add('special-day');

		const dayHeader = document.createElement('div');
		dayHeader.className = 'day-header';
		dayHeader.innerHTML = `
			<div class="day-name">${dayNames[index]}</div>
			<div class="day-date">${date.getDate()}/${date.getMonth() + 1}</div>
			${!isNormalUniDay ? `<span class="day-tag">${dayTagLabel(dayAlt)}</span>` : ''}
		`;
		dayColumn.appendChild(dayHeader);

		const eventsContainer = document.createElement('div');
		eventsContainer.className = 'events-container';

		const dayEvents = allEvents
			.filter(e => isSameDay(e.start, date))
			.sort((a, b) => a.start - b.start);

		if (dayEvents.length === 0) {
			const noEvents = document.createElement('div');
			noEvents.className = 'no-events' + (!isNormalUniDay ? ' day-off' : '');
			noEvents.textContent = !isNormalUniDay ? dayTagLabel(dayAlt) : 'Aucun cours';
			eventsContainer.appendChild(noEvents);
		} else {
			dayEvents.forEach(ev => {
				const d = ev.details || {};
				const type = (d.type || '').toLowerCase();
				const eventCard = document.createElement('div');
				eventCard.className = 'event-card' + (type ? ` type-${type}` : '');
				eventCard.innerHTML = `
					<div class="event-time">
						${ev.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}
						– ${ev.end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}
						${d.type ? ` · ${d.type}` : ''}
					</div>
					<div class="event-summary">${d.matiere || ev.summary}</div>
					${d.enseignant ? `<div class="event-teacher">${d.enseignant}</div>` : ''}
					${d.salle ? `<div class="event-location">📍 ${d.salle}</div>` : ''}
				`;
				eventsContainer.appendChild(eventCard);
			});
		}

		dayColumn.appendChild(eventsContainer);
		container.appendChild(dayColumn);
	});
}

function dayTagLabel(dayAlt) {
	if (!dayAlt) return '';
	if (dayAlt.type === 'Vacances') return 'Vacances';
	if (dayAlt.type === 'Férié') return 'Férié';
	if (dayAlt.type === 'Stage') return 'Stage';
	if (dayAlt.type && dayAlt.type.startsWith('Soutenances')) return 'Soutenances';
	if (dayAlt.type && (dayAlt.type.startsWith('Examens') || dayAlt.type.startsWith('Exams'))) return dayAlt.type;
	if (dayAlt.alt === 'Entreprise') return 'Entreprise';
	return dayAlt.type || dayAlt.alt || '';
}

// ===== NAVIGATION SEMAINE =====
function goToWeek(delta) {
    currentWeek += delta;

    if (currentWeek < 1) {
        currentWeek = 53;
    }

    if (currentWeek > 53) {
        currentWeek = 1;
    }

    displayWeek(currentWeek);
}

document.getElementById('prevWeek').addEventListener('click', () => goToWeek(-1));
document.getElementById('nextWeek').addEventListener('click', () => goToWeek(1));
document.getElementById('todayBtn').addEventListener('click', () => {
	currentWeek = getWeekNumber(new Date());
	displayWeek(currentWeek);
});

// ===== CHARGEMENT INITIAL =====
loadAndDisplay();