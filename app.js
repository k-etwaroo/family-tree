/* ═══════════════════════════════════════════════
   FAMILY TREE — APP CORE
   Handles: data loading, view switching, search,
   modal, and view renderers (tree, radial, cards, timeline)
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Config ───
  const SHEETS_CONFIG = {
    apiKey: 'AIzaSyBVnfX5ld_hrU9FWL9F8Pe68jf4ZjyrA3U',
    sheetId: '1hqwlHomJrpSjRpof0dux_4ojRshpHD50s6b33P61Qmc',
    sheetName: 'family',  // Change if your tab has a different name
  };

  // ─── State ───
  let familyData = null;
  let currentView = 'tree';
  let allMembers = [];

  // ─── DOM References ───
  const viewTabs = document.querySelectorAll('.view-tab');
  const viewContainers = document.querySelectorAll('.view-container');
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  const modal = document.getElementById('person-modal');

  // ═══ INIT ═══
  async function init() {
    setupViewSwitching();
    setupSearch();
    setupModal();
    setupURLRouting();
    await loadData();
  }

  // ═══ DATA LOADING — Google Sheets API ═══
  async function loadData() {
    try {
      // Try Google Sheets API first (live data)
      const members = await fetchFromGoogleSheets();
      if (members && members.length > 0) {
        console.log(`Loaded ${members.length} members from Google Sheets`);
        allMembers = members;
        familyData = {
          members: allMembers,
          root: buildTreeFromFlat(allMembers),
          events: buildEventsFromMembers(allMembers)
        };
        renderCurrentView();
        return;
      }
    } catch (err) {
      console.warn('Google Sheets fetch failed, trying local JSON...', err.message);
    }

    // Fallback to local family.json
    try {
      const response = await fetch('data/family.json');
      if (!response.ok) throw new Error('No data file found');
      const data = await response.json();
      allMembers = data.members || [];
      familyData = {
        members: allMembers,
        root: buildTreeFromFlat(allMembers),
        events: data.events || buildEventsFromMembers(allMembers)
      };
      console.log(`Loaded ${allMembers.length} members from local JSON`);
      renderCurrentView();
    } catch (err) {
      console.log('No local data either — showing sample data.', err.message);
      loadSampleData();
      renderCurrentView();
    }
  }

  async function fetchFromGoogleSheets() {
    const { apiKey, sheetId, sheetName } = SHEETS_CONFIG;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Sheets API returned ${response.status}`);
    }

    const data = await response.json();
    const rows = data.values;
    if (!rows || rows.length < 2) return [];

    // First row = headers, remaining rows = data
    const headers = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const members = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Build object from headers + row values
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = (row[idx] || '').trim();
      });

      // Skip rows without a name
      if (!obj.name) continue;

      // Parse into our member format
      members.push({
        id: parseInt(obj.id) || i,
        name: obj.name || '',
        relation: (obj.relation || '').toLowerCase(),
        side: (obj.side || '').toLowerCase(),
        generation: parseInt(obj.generation) || 0,
        parent_id: obj.parent_id ? parseInt(obj.parent_id) : null,
        spouse_id: obj.spouse_id ? parseInt(obj.spouse_id) : null,
        born: obj.born || '',
        died: obj.died || '',
        birthplace: obj.birthplace || '',
        bio: obj.bio || '',
        fun_fact: obj.fun_fact || '',
        photo: obj.photo || '',
      });
    }

    return members;
  }

  function loadSampleData() {
    // Sample data so the site works before real data is connected
    allMembers = [
      { id: 1, name: 'Your Daughter', relation: 'self', side: '', generation: 0, parent_id: 2, spouse_id: null, born: '2020', died: '', birthplace: '', bio: 'The star of the show', fun_fact: '', photo: '' },
      { id: 2, name: 'Mom', relation: 'mother', side: 'maternal', generation: 1, parent_id: 4, spouse_id: 3, born: '1990', died: '', birthplace: '', bio: '', fun_fact: '', photo: '' },
      { id: 3, name: 'Dad', relation: 'father', side: 'paternal', generation: 1, parent_id: 6, spouse_id: 2, born: '1988', died: '', birthplace: '', bio: '', fun_fact: '', photo: '' },
      { id: 4, name: 'Grandma (Maternal)', relation: 'grandmother', side: 'maternal', generation: 2, parent_id: null, spouse_id: 5, born: '1962', died: '', birthplace: '', bio: '', fun_fact: '', photo: '' },
      { id: 5, name: 'Grandpa (Maternal)', relation: 'grandfather', side: 'maternal', generation: 2, parent_id: null, spouse_id: 4, born: '1960', died: '', birthplace: '', bio: '', fun_fact: '', photo: '' },
      { id: 6, name: 'Grandma (Paternal)', relation: 'grandmother', side: 'paternal', generation: 2, parent_id: null, spouse_id: 7, born: '1965', died: '', birthplace: '', bio: '', fun_fact: '', photo: '' },
      { id: 7, name: 'Grandpa (Paternal)', relation: 'grandfather', side: 'paternal', generation: 2, parent_id: null, spouse_id: 6, born: '1963', died: '', birthplace: '', bio: '', fun_fact: '', photo: '' },
    ];

    familyData = {
      members: allMembers,
      root: buildTreeFromFlat(allMembers),
      events: buildEventsFromMembers(allMembers)
    };
  }

  // ─── Build nested tree from flat member list ───
  function buildTreeFromFlat(members) {
    const root = members.find(m => m.generation === 0) || members[0];
    if (!root) return null;

    function attachParents(person) {
      const node = { ...person, parents: [] };

      // Find parents: people whose id matches this person's parent_id, or their spouse
      const directParent = members.find(m => m.id === person.parent_id);
      if (directParent) {
        node.parents.push(attachParents(directParent));
        const spouse = members.find(m => m.id === directParent.spouse_id);
        if (spouse) {
          node.parents.push(attachParents(spouse));
        }
      }

      return node;
    }

    return attachParents(root);
  }

  function buildEventsFromMembers(members) {
    const events = [];
    members.forEach(m => {
      if (m.born) {
        events.push({ year: parseInt(m.born), type: 'birth', person: m.name, personId: m.id });
      }
      if (m.died) {
        events.push({ year: parseInt(m.died), type: 'death', person: m.name, personId: m.id });
      }
    });
    return events.sort((a, b) => a.year - b.year);
  }

  // ═══ VIEW SWITCHING ═══
  function setupViewSwitching() {
    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        switchView(view);
        window.location.hash = '#/' + view;
      });
    });
  }

  function switchView(view) {
    currentView = view;

    viewTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.view === view);
      t.setAttribute('aria-selected', t.dataset.view === view);
    });

    viewContainers.forEach(c => {
      c.classList.toggle('active', c.id === 'view-' + view);
    });

    renderCurrentView();
  }

  function renderCurrentView() {
    switch (currentView) {
      case 'tree':    renderTree(); break;
      case 'radial':  renderRadial(); break;
      case 'cards':   renderCards(); break;
      case 'timeline': renderTimeline(); break;
    }
  }

  // ═══ URL ROUTING ═══
  function setupURLRouting() {
    const hash = window.location.hash.replace('#/', '');
    if (['tree', 'radial', 'cards', 'timeline'].includes(hash)) {
      switchView(hash);
    }

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#/', '');
      if (['tree', 'radial', 'cards', 'timeline'].includes(h)) {
        switchView(h);
      }
    });
  }

  // ═══ SEARCH ═══
  function setupSearch() {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (query.length < 2) {
        searchResults.classList.remove('open');
        return;
      }

      const matches = allMembers.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.relation.toLowerCase().includes(query)
      ).slice(0, 6);

      if (matches.length === 0) {
        searchResults.classList.remove('open');
        return;
      }

      searchResults.innerHTML = matches.map(m => `
        <div class="search-result-item" data-id="${m.id}">
          <img class="sr-avatar" src="${m.photo ? 'photos/' + m.photo : getPlaceholderAvatar(m)}" alt="${m.name}" onerror="this.src='${getPlaceholderAvatar(m)}'">
          <div>
            <div class="sr-name">${highlightMatch(m.name, query)}</div>
            <div class="sr-relation">${m.relation}</div>
          </div>
        </div>
      `).join('');

      searchResults.classList.add('open');

      // Click handlers
      searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = parseInt(item.dataset.id);
          const person = allMembers.find(m => m.id === id);
          if (person) openPersonModal(person);
          searchResults.classList.remove('open');
          searchInput.value = '';
        });
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        searchResults.classList.remove('open');
      }
    });
  }

  function highlightMatch(text, query) {
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    return text.slice(0, idx) + '<strong>' + text.slice(idx, idx + query.length) + '</strong>' + text.slice(idx + query.length);
  }

  function getPlaceholderAvatar(member) {
    // Generate a simple SVG data URL placeholder
    const colors = {
      self: '#d4a84b',
      mother: '#7a9e7e', father: '#5d7fa3',
      grandmother: '#7a9e7e', grandfather: '#5d7fa3',
    };
    const color = colors[member.relation] || '#b86e3a';
    const initial = member.name.charAt(0).toUpperCase();
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="${color}" opacity="0.15"/><text x="40" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="28" font-weight="600" fill="${color}">${initial}</text></svg>`)}`;
  }

  // ═══ PERSON MODAL ═══
  function setupModal() {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('.modal-close')) {
        modal.classList.remove('open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') modal.classList.remove('open');
    });
  }

  function openPersonModal(person) {
    const photoEl = document.getElementById('modal-photo');
    const placeholder = getPlaceholderAvatar(person);
    photoEl.src = person.photo ? 'photos/' + person.photo : placeholder;
    photoEl.onerror = () => { photoEl.src = placeholder; };
    photoEl.alt = person.name;

    document.getElementById('modal-name').textContent = person.name;
    document.getElementById('modal-relation').textContent = formatRelation(person.relation);

    setModalDetail('modal-born', 'Born', person.born ? `${person.born}${person.died ? ' — ' + person.died : ''}` : '');
    setModalDetail('modal-birthplace', 'Birthplace', person.birthplace || '');
    setModalDetail('modal-bio', 'Bio', person.bio || '');
    setModalDetail('modal-fact', 'Fun Fact', person.fun_fact || '');

    modal.classList.add('open');
  }

  function setModalDetail(id, label, value) {
    const el = document.getElementById(id);
    if (value) {
      el.innerHTML = `<strong>${label}</strong>${value}`;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  function formatRelation(rel) {
    return rel.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // ═══════════════════════════════════════════════
  //  VIEW RENDERERS
  //  Each one hides the loading skeleton and draws
  // ═══════════════════════════════════════════════

  // ─── TREE VIEW ───
  function renderTree() {
    const container = document.getElementById('tree-canvas');
    const loading = document.getElementById('loading-tree');

    if (!familyData || !familyData.root) return;

    // Hide skeleton
    if (loading) loading.style.display = 'none';

    // Clear previous
    container.innerHTML = '';

    const width = container.clientWidth || 900;
    const height = Math.max(500, window.innerHeight - 180);

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2}, 60)`);

    // Convert our data to D3 hierarchy (reverse: root = daughter, children = parents)
    const root = d3.hierarchy(familyData.root, d => d.parents);

    const treeLayout = d3.tree()
      .size([width - 120, height - 140])
      .separation((a, b) => a.parent === b.parent ? 1.2 : 1.8);

    treeLayout(root);

    // Center horizontally
    const offsetX = -width / 2 + 60;

    // Links
    g.selectAll('.tree-link')
      .data(root.links())
      .join('path')
      .attr('class', 'tree-link')
      .attr('d', d3.linkVertical()
        .x(d => d.x + offsetX)
        .y(d => d.y)
      );

    // Nodes
    const nodes = g.selectAll('.tree-node')
      .data(root.descendants())
      .join('g')
      .attr('class', d => `tree-node ${d.data.side || ''}`)
      .attr('transform', d => `translate(${d.x + offsetX}, ${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => openPersonModal(d.data));

    nodes.append('circle')
      .attr('r', d => d.depth === 0 ? 24 : 18);

    // Initial letter inside circle
    nodes.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.depth === 0 ? '16px' : '12px')
      .attr('font-weight', '600')
      .attr('fill', d => d.depth === 0 ? '#b86e3a' : '#6b6054')
      .text(d => d.data.name.charAt(0));

    // Name label below
    nodes.append('text')
      .attr('dy', d => d.depth === 0 ? 40 : 32)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#6b6054')
      .text(d => d.data.name.length > 18 ? d.data.name.slice(0, 16) + '…' : d.data.name);

    // Zoom & pan
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));

    svg.call(zoom);
  }

  // ─── RADIAL VIEW ───
  function renderRadial() {
    const container = document.getElementById('radial-canvas');
    const loading = document.getElementById('loading-radial');

    if (!familyData || !familyData.root) return;

    if (loading) loading.style.display = 'none';
    container.innerHTML = '';

    const size = Math.min(container.clientWidth || 700, window.innerHeight - 200, 700);
    const radius = size / 2;

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `${-radius} ${-radius} ${size} ${size}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('max-width', size + 'px');

    const root = d3.hierarchy(familyData.root, d => d.parents);

    const partition = d3.partition()
      .size([2 * Math.PI, radius - 20]);

    partition(root);

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1 - 2)
      .padAngle(0.02)
      .padRadius(radius / 2);

    const maternalColor = d3.scaleLinear().domain([0, 4]).range(['#b86e3a', '#7a9e7e']);
    const paternalColor = d3.scaleLinear().domain([0, 4]).range(['#b86e3a', '#5d7fa3']);

    function getColor(d) {
      if (d.depth === 0) return '#d4a84b';
      return d.data.side === 'paternal'
        ? paternalColor(d.depth)
        : maternalColor(d.depth);
    }

    svg.selectAll('.radial-arc')
      .data(root.descendants())
      .join('path')
      .attr('class', 'radial-arc')
      .attr('d', arc)
      .attr('fill', d => getColor(d))
      .attr('opacity', d => d.depth === 0 ? 1 : 0.75)
      .style('cursor', 'pointer')
      .on('click', (event, d) => openPersonModal(d.data))
      .append('title')
      .text(d => d.data.name);

    // Labels
    svg.selectAll('.radial-label')
      .data(root.descendants().filter(d => d.depth > 0))
      .join('text')
      .attr('class', 'radial-label')
      .attr('transform', d => {
        const angle = (d.x0 + d.x1) / 2;
        const r = (d.y0 + d.y1) / 2;
        const x = Math.sin(angle) * r;
        const y = -Math.cos(angle) * r;
        const rotate = (angle * 180 / Math.PI) - 90 + (angle > Math.PI ? 180 : 0);
        return `translate(${x},${y}) rotate(${rotate})`;
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'Outfit, sans-serif')
      .attr('font-size', d => d.depth <= 1 ? '11px' : '9px')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .text(d => d.data.name.length > 12 ? d.data.name.slice(0, 10) + '…' : d.data.name);

    // Center label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'Cormorant Garamond, serif')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#2c2419')
      .text(familyData.root.name);
  }

  // ─── CARDS VIEW ───
  function renderCards(filterSide, filterGen) {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';

    let filtered = [...allMembers];
    if (filterSide && filterSide !== 'all') {
      filtered = filtered.filter(m => m.side === filterSide || m.generation === 0);
    }
    if (filterGen !== undefined && filterGen !== 'all') {
      filtered = filtered.filter(m => m.generation === parseInt(filterGen));
    }

    filtered.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'person-card';
      card.style.animationDelay = `${i * 0.06}s`;

      const placeholder = getPlaceholderAvatar(m);
      const photoSrc = m.photo ? 'photos/' + m.photo : placeholder;
      const tagClass = m.side === 'maternal' ? 'maternal' : m.side === 'paternal' ? 'paternal' : '';

      card.innerHTML = `
        <img class="card-photo" src="${photoSrc}" alt="${m.name}" onerror="this.src='${placeholder}'">
        <div class="card-name">${m.name}</div>
        <div class="card-relation">${formatRelation(m.relation)}</div>
        ${tagClass ? `<span class="card-tag ${tagClass}">${m.side}</span>` : ''}
      `;

      card.addEventListener('click', () => openPersonModal(m));
      grid.appendChild(card);
    });

    // Filter button handlers
    setupCardFilters();
  }

  function setupCardFilters() {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const side = btn.dataset.filter;
        const gen = document.querySelector('.filter-btn[data-gen].active')?.dataset.gen;
        renderCards(side, gen);
      });
    });

    document.querySelectorAll('.filter-btn[data-gen]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.filter-group').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const gen = btn.dataset.gen;
        const side = document.querySelector('.filter-btn[data-filter].active')?.dataset.filter;
        renderCards(side, gen);
      });
    });
  }

  // ─── TIMELINE VIEW ───
  function renderTimeline() {
    const container = document.getElementById('timeline-canvas');

    if (!familyData) return;

    container.innerHTML = '';

    const events = familyData.events || buildEventsFromMembers(allMembers);
    if (events.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#9a9184;padding:80px 24px;font-style:italic;">Add birth and death years to your family data to see the timeline.</p>';
      return;
    }

    const minYear = Math.min(...events.map(e => e.year));
    const maxYear = Math.max(...events.map(e => e.year));
    const range = maxYear - minYear || 1;
    const totalHeight = Math.max(600, events.length * 90);

    // Axis
    const axis = document.createElement('div');
    axis.className = 'timeline-axis';
    axis.style.height = totalHeight + 'px';
    container.appendChild(axis);

    // Events
    events.forEach((evt, i) => {
      const yPos = ((evt.year - minYear) / range) * (totalHeight - 80) + 40;
      const side = i % 2 === 0 ? 'left' : 'right';

      const eventEl = document.createElement('div');
      eventEl.className = `timeline-event ${side}`;
      eventEl.style.top = yPos + 'px';

      eventEl.innerHTML = `
        <div class="timeline-dot ${evt.type}"></div>
        <div class="timeline-card">
          <div class="tc-year">${evt.year}</div>
          <div class="tc-name">${evt.person}</div>
          <div class="tc-event">${evt.type === 'birth' ? 'Born' : evt.type === 'death' ? 'Passed away' : evt.type}</div>
        </div>
      `;

      eventEl.addEventListener('click', () => {
        const person = allMembers.find(m => m.id === evt.personId);
        if (person) openPersonModal(person);
      });

      container.appendChild(eventEl);
    });

    // Decade markers
    const startDecade = Math.floor(minYear / 10) * 10;
    const endDecade = Math.ceil(maxYear / 10) * 10;
    for (let decade = startDecade; decade <= endDecade; decade += 10) {
      const yPos = ((decade - minYear) / range) * (totalHeight - 80) + 40;
      const marker = document.createElement('div');
      marker.style.cssText = `
        position: absolute;
        left: 50%;
        top: ${yPos}px;
        transform: translateX(-50%);
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        color: #9a9184;
        background: #f7f4ef;
        padding: 2px 8px;
        border-radius: 4px;
        z-index: 2;
      `;
      marker.textContent = decade + 's';
      container.appendChild(marker);
    }
  }

  // ═══ KICK IT OFF ═══
  document.addEventListener('DOMContentLoaded', init);

})();
