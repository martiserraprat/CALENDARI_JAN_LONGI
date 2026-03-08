// 1. CONFIGURACIÓN SUPABASE
const supabaseUrl = 'https://efynirousktejtpumudd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmeW5pcm91c2t0ZWp0cHVtdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjQxMTYsImV4cCI6MjA4ODU0MDExNn0._Zs-VQDUB8O3Hfulnnyt7Kf2THUb-fo3YX_PEEdgVBA';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. REFERENCIAS HTML
const eventGrid = document.getElementById('event-grid');
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('filter-month');
const continentSelect = document.getElementById('filter-continent');
const countrySelect = document.getElementById('filter-country');
const levelSelect = document.getElementById('filter-level');
const disciplineSelect = document.getElementById('filter-discipline');
const eventCountText = document.getElementById('event-count');
const genderButtons = document.querySelectorAll('.g-btn');
const clearDateBtn = document.getElementById('clear-date');

// 3. VARIABLES DE ESTADO Y MAPEOS
let allEvents = [];
let currentGender = 'all';
let dateStart = null;
let dateEnd = null;
let fp = null;

const levelMap = { 
    'OW': 'OLYMPIC/WORLD', 'DF': 'DL FINAL', 'GW': 'DIAMOND', 
    'GL': 'CHAMPIONSHIP', 'A': 'GOLD', 'B': 'SILVER', 
    'C': 'BRONZE', 'D': 'CHALLENGER'
};

const regexSub = /\b(U14|U16|U18|U20|U23|Junior|Youth)\b/gi;

// 4. INICIALIZACIÓN DE CALENDARIO (Flatpickr)
if (window.flatpickr) {
    fp = window.flatpickr("#date-range", {
        mode: "range",
        dateFormat: "d/m/y",
        theme: "dark",
        locale: { firstDayOfWeek: 1 },
        disableMobile: "true",
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                dateStart = selectedDates[0];
                dateEnd = selectedDates[1];
                if(clearDateBtn) clearDateBtn.style.display = "inline-block";
            } else {
                dateStart = null;
                dateEnd = null;
            }
            applyFilters();
        }
    });
}

// 5. CARGA DE DATOS PRINCIPAL
async function loadData() {
    try {
        console.log("⏳ Descargando eventos...");
        const { data, error } = await supabase.from('eventos').select('*');
        if (error) throw error; 

        allEvents = data
            .filter(ev => !regexSub.test(ev.name))
            .map(ev => {
                let cleanDisciplines = [];
                if (ev.disciplines) {
                    ev.disciplines.forEach(d => {
                        let cleanName = d.name.replace(regexSub, '').trim();
                        cleanDisciplines.push({ name: cleanName, gender: d.gender });
                    });
                }
                return { 
                    ...ev, 
                    disciplines: cleanDisciplines, 
                    parsedDate: new Date(ev.startDate) 
                };
            });

        allEvents.sort((a, b) => a.parsedDate - b.parsedDate);

        // Actualizar selectores dinámicos
        updateFilterOptions(allEvents);

        // --- BLOQUEO TOTAL LONG JUMP ---
        if (disciplineSelect) {
            disciplineSelect.value = "Long Jump";
            disciplineSelect.style.display = "none"; 
            const indicator = document.createElement('div');
            indicator.style.cssText = "background:rgba(0,112,243,0.2); border:1px solid #0070f3; color:#0070f3; padding:8px 15px; border-radius:8px; font-size:0.75rem; font-weight:bold; display:flex; align-items:center; gap:8px;";
            indicator.innerHTML = '<i class="fas fa-thumbtack"></i> SOLO LONG JUMP';
            disciplineSelect.parentNode.appendChild(indicator);
        }

        applyFilters();

    } catch (error) {
        console.error("❌ Error Supabase:", error);
        eventGrid.innerHTML = `<p style="color:red; padding:20px;">Error al conectar con la base de datos.</p>`;
    }
}

// 6. ACTUALIZAR SELECTORES
function updateFilterOptions(events) {
    const validEvents = events.filter(e => e.parsedDate.getFullYear() === 2026);

    const continents = [...new Set(validEvents.map(e => e.area).filter(Boolean))].sort();
    continentSelect.innerHTML = '<option value="all">Continentes</option>';
    continents.forEach(c => continentSelect.innerHTML += `<option value="${c}">${c}</option>`);

    const countryCodes = [...new Set(validEvents.map(e => getOnlyCountryCode(e.venue)))].sort();
    countrySelect.innerHTML = '<option value="all">Países</option>';
    countryCodes.forEach(code => countrySelect.innerHTML += `<option value="${code}">${code}</option>`);

    const levels = [...new Set(validEvents.map(e => e.category))].filter(Boolean).sort();
    levelSelect.innerHTML = '<option value="all">Niveles</option>';
    levels.forEach(l => {
        levelSelect.innerHTML += `<option value="${l}">${levelMap[l] || l}</option>`;
    });

    // Discipline select se llena pero se mantiene oculto por el bloqueo de arriba
    let allDiscs = [];
    validEvents.forEach(ev => { if(ev.disciplines) ev.disciplines.forEach(d => allDiscs.push(d.name)); });
    const uniqueDiscs = [...new Set(allDiscs)].sort();
    disciplineSelect.innerHTML = '<option value="all">Todas las pruebas</option>';
    uniqueDiscs.forEach(d => disciplineSelect.innerHTML += `<option value="${d}">${d}</option>`);
}

// 7. FILTRADO MAESTRO
function applyFilters() {
    const search = (searchInput.value || "").toLowerCase();
    const month = monthSelect.value;
    const continent = continentSelect.value;
    const selectedCode = countrySelect.value;
    const level = levelSelect.value;
    const disc = disciplineSelect.value; 

    const filtered = allEvents.filter(ev => {
        const eventDate = ev.parsedDate;
        const m = (eventDate.getMonth() + 1).toString().padStart(2, '0');
        
        const matchesSearch = ev.name.toLowerCase().includes(search) || ev.venue.toLowerCase().includes(search);
        const matchesMonth = month === 'all' || m === month;
        const matchesContinent = continent === 'all' || ev.area === continent;
        const matchesCountry = selectedCode === 'all' || getOnlyCountryCode(ev.venue) === selectedCode;
        const matchesLevel = level === 'all' || ev.category === level;
        
        const hasNoDiscs = !ev.disciplines || ev.disciplines.length === 0;
        const matchesDisc = disc === 'all' || hasNoDiscs || ev.disciplines.some(d => d.name === disc);
        
        let matchesGender = true;
        if (currentGender !== 'all') {
            const target = currentGender === '🚹' ? 'Men' : 'Women';
            matchesGender = hasNoDiscs || ev.disciplines.some(d => (disc === 'all' || d.name === disc) && (d.gender === target || d.gender === 'Both'));
        }

        let matchesDateRange = true;
        if (dateStart && dateEnd) {
            const evTime = new Date(eventDate).setHours(0,0,0,0);
            const start = new Date(dateStart).setHours(0,0,0,0);
            const end = new Date(dateEnd).setHours(0,0,0,0);
            matchesDateRange = evTime >= start && evTime <= end;
        }

        return matchesSearch && matchesMonth && matchesContinent && matchesCountry && matchesLevel && matchesDisc && matchesGender && matchesDateRange;
    });

    renderEvents(filtered);
}

// 8. RENDERIZAR TARJETAS
function renderEvents(events) {
    eventGrid.innerHTML = '';
    eventCountText.innerText = `${events.length} Competiciones`;

    events.forEach(ev => {
        const dateStr = ev.parsedDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
        let levelClass = getLevelClass(ev.category);

        let genderLabel = "M / F", genderClass = "tag-both";
        if (ev.disciplines && ev.disciplines.length > 0) {
            const hasM = ev.disciplines.some(d => d.gender === 'Men' || d.gender === 'Both');
            const hasW = ev.disciplines.some(d => d.gender === 'Women' || d.gender === 'Both');
            genderLabel = (hasM && hasW) ? "M / F" : (hasM ? "MASCULINO" : "FEMENINO");
            genderClass = (hasM && hasW) ? "tag-both" : (hasM ? "tag-m" : "tag-f");
        } else {
            genderLabel = "TBD / INFO"; genderClass = "level-silver";
        }

        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <span class="card-date"><i class="far fa-calendar-check"></i> ${dateStr}</span>
            <h3>${ev.name}</h3>
            <div class="location-info"><i class="fas fa-map-marker-alt"></i> ${ev.venue}</div>
            <div class="card-tags">
                <span class="tag ${genderClass}">${genderLabel}</span>
                <span class="tag ${levelClass}">${levelMap[ev.category] || ev.category}</span>
            </div>
        `;
        card.onclick = () => openModal(ev);
        eventGrid.appendChild(card);
    });
}

// 9. MODAL
function openModal(ev) {
    const modal = document.getElementById('event-modal');
    document.getElementById('modal-title').innerText = ev.name;
    document.getElementById('modal-location').innerText = ev.venue;
    document.getElementById('modal-date-tag').innerText = ev.parsedDate.toLocaleDateString('es-ES', { dateStyle: 'long' });
    document.getElementById('modal-area').innerText = ev.area || "-";
    document.getElementById('modal-cat').innerText = levelMap[ev.category] || ev.category || "-";
    
    const vaultContainer = document.getElementById('modal-vault');
    vaultContainer.innerHTML = (ev.disciplines && ev.disciplines.length > 0) 
        ? ev.disciplines.map(d => `${d.name} (${d.gender})`).join(', ')
        : '<span style="color:#ffcc00;"><i class="fas fa-exclamation-triangle"></i> Pruebas por confirmar.</span>';

    const linksCont = document.getElementById('modal-links');
    linksCont.innerHTML = '';
    if (ev.links?.web) linksCont.innerHTML += `<a href="${ensureAbsoluteUrl(ev.links.web)}" target="_blank" class="link-btn"><i class="fas fa-external-link-alt"></i> Web Oficial</a>`;
    if (ev.links?.results) linksCont.innerHTML += `<a href="${ensureAbsoluteUrl(ev.links.results)}" target="_blank" class="link-btn"><i class="fas fa-poll"></i> Resultados</a>`;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
}

// 10. LISTENERS Y HELPERS
function getLevelClass(cat) {
    if (['OW','DF','GW'].includes(cat)) return "level-diamond";
    if (['GL','A'].includes(cat)) return "level-gold";
    if (cat === 'B') return "level-silver";
    if (cat === 'C') return "level-bronze";
    return "level-challenger";
}

function getOnlyCountryCode(venue) {
    if (!venue) return "INT";
    const match = venue.match(/\(([^)]+)\)$/); 
    return match ? match[1].toUpperCase() : "INT";
}

document.getElementById('close-modal').onclick = () => {
    document.getElementById('event-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
};

searchInput.addEventListener('input', applyFilters);
monthSelect.addEventListener('change', applyFilters);
continentSelect.addEventListener('change', applyFilters);
countrySelect.addEventListener('change', applyFilters);
levelSelect.addEventListener('change', applyFilters);

genderButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        genderButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGender = btn.dataset.gender; 
        applyFilters();
    });
});

if(clearDateBtn) {
    clearDateBtn.onclick = () => {
        fp.clear(); dateStart = null; dateEnd = null;
        clearDateBtn.style.display = "none";
        applyFilters();
    };
}

// Iniciar
loadData();
