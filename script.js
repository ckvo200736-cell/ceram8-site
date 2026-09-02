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
  var MAIL_TO = "OlFamS@yandex.ru"; // запасной адрес для mailto, пока нет endpoint

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
    if (data.images && data.images.length) {
      body += "\nФото (" + data.images.length + " шт.) — приложу отдельным письмом.";
    }
    window.location.href =
      "mailto:" + encodeURIComponent(MAIL_TO) +
      "?subject=" + encodeURIComponent("Заявка с сайта Ceram8") +
      "&body=" + encodeURIComponent(body);
  }

  /* ---------- Фото в форме: сжатие на клиенте ---------- */
  var MAX_FILES = 3;
  var MAX_DIM = 1500;      // px по длинной стороне
  var JPEG_QUALITY = 0.7;
  var MAX_TOTAL_B64 = 3200000; // ~3 МБ, чтобы влезть в лимит функции

  var fileInput = form && form.querySelector("#f-files");
  var fileListEl = form && form.querySelector("#filelist");
  var pendingImages = [];

  function renderFileList() {
    if (!fileListEl) return;
    fileListEl.innerHTML = "";
    pendingImages.forEach(function (img, i) {
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.textContent = img.name + " · " + Math.round(img.data.length * 0.75 / 1024) + " КБ";
      var rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "убрать";
      rm.addEventListener("click", function () {
        pendingImages.splice(i, 1);
        renderFileList();
      });
      li.appendChild(span);
      li.appendChild(rm);
      fileListEl.appendChild(li);
    });
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
        var cw = Math.max(1, Math.round(img.naturalWidth * scale));
        var ch = Math.max(1, Math.round(img.naturalHeight * scale));
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error("compress")); return; }
          var fr = new FileReader();
          fr.onload = function () {
            var s = String(fr.result);
            resolve({
              name: (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg",
              type: "image/jpeg",
              data: s.slice(s.indexOf(",") + 1)
            });
          };
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        }, "image/jpeg", JPEG_QUALITY);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("image")); };
      img.src = url;
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      fileInput.value = "";
      if (!files.length) return;
      setStatus("Обрабатываю фото…");
      var chain = Promise.resolve();
      files.forEach(function (file) {
        chain = chain.then(function () {
          if (pendingImages.length >= MAX_FILES) return null;
          if (!/^image\//.test(file.type)) return null;
          return compressImage(file).then(function (img) {
            pendingImages.push(img);
          }).catch(function () {});
        });
      });
      chain.then(function () {
        renderFileList();
        var over = pendingImages.length >= MAX_FILES && files.length > MAX_FILES;
        setStatus(over ? "Добавлено " + MAX_FILES + " фото (это максимум)." : "");
      });
    });
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
        images: pendingImages.slice(0, MAX_FILES),
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

      var totalB64 = data.images.reduce(function (n, i) { return n + i.data.length; }, 0);
      if (totalB64 > MAX_TOTAL_B64) {
        setStatus("Фото суммарно слишком большие. Уберите одно или пришлите позже в переписке.", true);
        return;
      }

      function resetForm() {
        form.reset();
        pendingImages = [];
        renderFileList();
      }

      if (!FORM_ENDPOINT) {
        mailtoFallback(data);
        setStatus("Открываю почтовую программу. Если ничего не произошло — напишите напрямую по контактам слева.");
        resetForm();
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
          resetForm();
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
