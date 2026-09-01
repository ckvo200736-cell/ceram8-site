/* Ceram8 — минимальный JS без зависимостей */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Переключатель дизайн-концепций ---------- */
  var buttons = document.querySelectorAll("[data-set-design]");
  var STORAGE_KEY = "ceram8-design";

  function applyDesign(id) {
    root.setAttribute("data-design", id);
    buttons.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-set-design") === id);
    });
    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
  }

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applyDesign(saved);
  } catch (e) {}

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      applyDesign(b.getAttribute("data-set-design"));
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  });

  /* ---------- Мобильное меню ---------- */
  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  function closeNav() {
    if (!header) return;
    header.classList.remove("is-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
  }

  if (header && navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = header.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") closeNav();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
    document.addEventListener("click", function (e) {
      if (header.classList.contains("is-open") && !header.contains(e.target)) closeNav();
    });
  }

  /* ---------- Карусель отзывов ---------- */
  var track = document.getElementById("reviews-track");
  var navBtns = document.querySelectorAll(".reviews__nav");
  if (track && navBtns.length) {
    var stepBy = function () {
      var card = track.querySelector(".review");
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "16") || 16;
      return card ? card.getBoundingClientRect().width + gap : 300;
    };
    var syncNav = function () {
      var maxScroll = track.scrollWidth - track.clientWidth - 2;
      navBtns.forEach(function (b) {
        var prev = b.classList.contains("reviews__nav--prev");
        b.disabled = prev ? track.scrollLeft <= 2 : track.scrollLeft >= maxScroll;
      });
    };
    navBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var dir = b.classList.contains("reviews__nav--prev") ? -1 : 1;
        track.scrollBy({ left: dir * stepBy(), behavior: "smooth" });
      });
    });
    track.addEventListener("scroll", syncNav, { passive: true });
    window.addEventListener("resize", syncNav);
    syncNav();
  }

  /* ---------- Год в подвале ---------- */
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- Форма заявки (без сервера: собираем письмо) ---------- */
  var form = document.getElementById("request-form");
  var status = document.getElementById("form-status");
  var MAIL_TO = "[EMAIL]"; // заказчик подставляет реальный адрес

  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var name = form.name.value.trim();
      var contact = form.contact.value.trim();
      var type = form.type.value;
      var message = form.message.value.trim();

      if (!name || !contact) {
        status.textContent = "Заполните имя и контакт для связи.";
        return;
      }

      var body =
        "Имя: " + name + "\n" +
        "Контакт: " + contact + "\n" +
        "Тип заказа: " + type + "\n" +
        "Идея / рисунок: " + (message || "—");

      var href =
        "mailto:" + encodeURIComponent(MAIL_TO) +
        "?subject=" + encodeURIComponent("Заявка с сайта Ceram8") +
        "&body=" + encodeURIComponent(body);

      window.location.href = href;
      status.textContent = "Открываю почтовую программу. Если ничего не произошло — напишите нам напрямую по контактам слева.";
      form.reset();
    });
  }
})();
