/* Presentation and local interactions; authentication and search stay in app.js. */
(() => {
  "use strict";
  const find = selector => document.querySelector(selector);
  const finder = find("#criterionFinder");
  const chips = find("#activeFilters");
  const output = find("#output");
  const resultFinder = find("#resultFinder");
  const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let previousExpansion = null;
  let selectedCategory = "";

  function filterCriteria() {
    const query = normalize(finder.value.trim());
    const filtering = Boolean(query || selectedCategory);
    const sections = [...document.querySelectorAll("#fields .group")];
    if (filtering && !previousExpansion) {
      previousExpansion = sections.map(section => ({
        expanded: section.querySelector(".group-toggle").getAttribute("aria-expanded"),
        extraOpen: section.querySelector("details")?.open
      }));
    }
    let visible = 0;
    sections.forEach((section, index) => {
      const toggle = section.querySelector(".group-toggle");
      const content = section.querySelector(".group-content");
      const groupName = section.querySelector(".group-title").textContent;
      const groupMatches = normalize(groupName).includes(query);
      const categoryMatches = !selectedCategory || groupName === selectedCategory;
      let matches = 0;
      section.querySelectorAll(".grid label").forEach(label => {
        const match = !query || groupMatches || normalize(label.querySelector(".field-caption").textContent).includes(query);
        label.hidden = !match;
        if (match) matches++;
      });
      section.hidden = matches === 0 || !categoryMatches;
      if (!section.hidden) visible++;
      if (filtering && matches && categoryMatches) {
        toggle.setAttribute("aria-expanded", "true");
        content.hidden = false;
        const extra = section.querySelector("details");
        if (extra) extra.open = true;
      } else if (!filtering && previousExpansion) {
        toggle.setAttribute("aria-expanded", previousExpansion[index].expanded);
        content.hidden = previousExpansion[index].expanded !== "true";
        const extra = section.querySelector("details");
        if (extra) extra.open = Boolean(previousExpansion[index].extraOpen);
      }
    });
    if (!filtering) previousExpansion = null;
    find("#noCriteria").hidden = visible > 0;
  }

  function updateFilters() {
    chips.replaceChildren();
    document.querySelectorAll("#fields .group").forEach(section => {
      const inputs = [...section.querySelectorAll("[data-key]")];
      const active = inputs.filter(input => input.value.trim());
      section.classList.toggle("has-value", active.length > 0);
      let badge = section.querySelector(".group-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "group-badge";
        section.querySelector(".group-chevron").before(badge);
      }
      badge.textContent = active.length || inputs.length;
      badge.setAttribute("aria-label", active.length ? `${active.length} critères actifs` : `${inputs.length} critères disponibles`);
      for (const input of inputs) input.closest("label").classList.toggle("is-filled", Boolean(input.value.trim()));
      active.forEach(input => {
        const name = input.closest("label").querySelector(".field-caption").textContent.trim();
        const value = input.tagName === "SELECT" ? input.selectedOptions[0].textContent : input.value;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-chip";
        const text = document.createElement("span");
        text.textContent = `${name} : ${value}`;
        const cross = document.createElement("span");
        cross.textContent = "×"; cross.setAttribute("aria-hidden", "true");
        button.append(text, cross);
        button.title = `Retirer ${name} : ${value}`;
        button.setAttribute("aria-label", button.title);
        button.addEventListener("click", () => {
          input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          find("#clear").focus({ preventScroll: true });
        });
        chips.appendChild(button);
      });
    });
    chips.hidden = chips.childElementCount === 0;
  }

  function filterResults() {
    const query = normalize(resultFinder.value.trim());
    const cards = [...output.querySelectorAll(".result")];
    let visible = 0;
    cards.forEach(card => {
      card.hidden = !normalize(card.textContent).includes(query);
      if (!card.hidden) visible++;
    });
    const summary = find("#resultSummary");
    summary.hidden = cards.length === 0;
    summary.textContent = visible === 0 ? "Aucune fiche ne correspond à ce filtre." : `${visible} fiche${visible === 1 ? "" : "s"} affichée${visible === 1 ? "" : "s"}${query ? ` sur ${cards.length}` : " · Explore les informations ci-dessous"}`;
  }

  function updateResults() {
    resultFinder.value = "";
    find("#resultTools").hidden = output.childElementCount === 0;
    filterResults();
  }

  const categoryNames = [...document.querySelectorAll("#fields .group")].map(section => section.querySelector(".group-title").textContent);
  const categoryButtons = ["", ...categoryNames].map(name => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name || "Tous";
    button.setAttribute("aria-pressed", String(name === selectedCategory));
    button.setAttribute("aria-controls", "fields");
    button.addEventListener("click", () => {
      selectedCategory = name;
      categoryButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      filterCriteria();
    });
    find("#criterionTabs").appendChild(button);
    return button;
  });
  const criterionCount = document.querySelectorAll("#fields [data-key]").length;
  document.querySelectorAll("[data-criterion-total]").forEach(item => { item.textContent = criterionCount; });
  document.querySelectorAll("[data-category-total]").forEach(item => { item.textContent = categoryNames.length; });

  finder.addEventListener("input", filterCriteria);
  resultFinder.addEventListener("input", filterResults);
  document.querySelectorAll("[data-result-view]").forEach(button => {
    button.addEventListener("click", () => {
      output.classList.toggle("grid-view", button.dataset.resultView === "grid");
      document.querySelectorAll("[data-result-view]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    });
  });
  find("#fields").addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.matches("input") && !event.isComposing) {
      event.preventDefault(); find("#searchBtn").click();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey &&
        !event.target.closest("input, textarea, select, [contenteditable]") && find("#search").classList.contains("active")) {
      event.preventDefault(); finder.focus();
    }
    if (event.key === "Escape" && document.activeElement === finder) {
      finder.value = ""; filterCriteria();
    }
  });

  window.NexusInterface = { updateFilters, updateResults };
  updateFilters();
  updateResults();
})();
