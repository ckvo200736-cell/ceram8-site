/* Ceram8 — минимальный JS без зависимостей */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------- Переключатель дизайн-концепций (панель скрыта) ----------
     Активная концепция задаётся атрибутом data-design в <html>.
     Кнопки работают, только если вернуть панель (убрать hidden у .switcher);
     сохранённый в браузере выбор при загрузке НЕ применяется. */
  var buttons = document.querySelectorAll("[data-set-design]");

  function applyDesign(id) {
    root.setAttribute("data-design", id);
    buttons.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-set-design") === id);
    });
  }

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

  /* ---------- Форма заявки ---------- */
  // URL облачной функции-прокси (Yandex Cloud). Пустая строка = отправки нет,
  // кнопка просто открывает письмо (mailto) как запасной вариант.
  var FORM_ENDPOINT = "";
  var MAIL_TO = "[EMAIL]"; // запасной адрес для mailto, пока нет endpoint

  var form = document.getElementById("request-form");
  var status = document.getElementById("form-status");

  function setStatus(text, isError) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("form__status--err", !!isError);
  }

  function mailtoFallback(data) {
    var body =
      "Имя: " + data.name + "\n" +
      "Контакт: " + data.contact + "\n" +
      "Тип заказа: " + data.type + "\n" +
      "Идея / рисунок: " + (data.message || "—") + "\n" +
      "Согласие на обработку ПДн: да (" + data.consent_at + ")";
    window.location.href =
      "mailto:" + encodeURIComponent(MAIL_TO) +
      "?subject=" + encodeURIComponent("Заявка с сайта Ceram8") +
      "&body=" + encodeURIComponent(body);
  }

  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();

      if (form.company && form.company.value) return; // ловушка для ботов

      var data = {
        name: form.name.value.trim(),
        contact: form.contact.value.trim(),
        type: form.type.value,
        message: form.message.value.trim(),
        consent: !!(form.consent && form.consent.checked),
        consent_at: new Date().toISOString(),
        company: ""
      };

      if (!data.name || !data.contact) {
        setStatus("Заполните имя и контакт для связи.", true);
        return;
      }

      if (!data.consent) {
        setStatus("Отметьте согласие на обработку персональных данных.", true);
        return;
      }

      if (!FORM_ENDPOINT) {
        mailtoFallback(data);
        setStatus("Открываю почтовую программу. Если ничего не произошло — напишите напрямую по контактам слева.");
        form.reset();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.setAttribute("aria-busy", "true");
      setStatus("Отправляю…");

      fetch(FORM_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(data) // без заголовков — «простой» запрос, без preflight
      })
        .then(function (r) {
          if (!r.ok) throw new Error("bad status " + r.status);
          setStatus("Заявка отправлена. Отвечу в течение дня — напишу на указанный контакт.");
          form.reset();
        })
        .catch(function () {
          setStatus("Не удалось отправить. Напишите, пожалуйста, напрямую по контактам слева.", true);
        })
        .then(function () {
          if (btn) btn.removeAttribute("aria-busy");
        });
    });
  }
})();
