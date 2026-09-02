"""
Ceram8 — приём заявок с формы сайта.

Облачная функция для Yandex Cloud Functions (среда python312). Принимает POST
с данными формы и отправляет заявку в Telegram и/или на e-mail. Секреты (токен
бота, пароль почты) хранятся в переменных окружения функции и в код/репозиторий
не попадают.

    Форма на сайте (браузер, РФ)
        --POST JSON-->  эта функция (дата-центр Yandex Cloud, РФ)
                            --> Telegram Bot API   (если задан BOT_TOKEN)
                            --> SMTP -> почтовый ящик (если задан SMTP_HOST)

Приложенные фото приходят внутри JSON (сжаты на клиенте, base64) и добавляются
вложениями в письмо. В Telegram уходит только пометка «Фото: N шт.».

Переменные окружения (задаются в настройках функции):

  Общие:
    ALLOW_ORIGIN   необязательно, домен сайта для CORS. По умолчанию "*".

  Telegram (можно не задавать, если нужен только e-mail):
    BOT_TOKEN      токен бота от @BotFather
    CHAT_ID        id чата/пользователя, куда слать заявки

  E-mail (можно не задавать, если нужен только Telegram):
    SMTP_HOST      напр. smtp.yandex.ru / smtp.mail.ru / smtp.beget.com
    SMTP_PORT      напр. 465
    SMTP_USER      логин (полный адрес ящика)
    SMTP_PASS      пароль ящика или пароль приложения
    MAIL_TO        адрес, куда доставлять заявки (можно тот же, что SMTP_USER)
    MAIL_FROM      необязательно, адрес в поле From (по умолчанию SMTP_USER)

Достаточно настроить хотя бы один канал (Telegram или e-mail).
Точка входа: index.handler
"""

import os
import ssl
import json
import base64
import smtplib
import urllib.parse
import urllib.request
from email.message import EmailMessage

TG_URL = "https://api.telegram.org/bot%s/sendMessage"

MAX_IMAGES = 3
MAX_TOTAL_BYTES = 6 * 1024 * 1024  # суммарный предел вложений


def _resp(code, ok, msg):
    return {
        "statusCode": code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": os.environ.get("ALLOW_ORIGIN", "*"),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps({"ok": ok, "msg": msg}, ensure_ascii=False),
    }


def _clip(value, limit):
    return str(value or "").strip()[:limit]


def _decode_images(raw_list):
    """[{name, type, data(base64)}] -> [(filename, subtype, bytes)]"""
    out = []
    total = 0
    if not isinstance(raw_list, list):
        return out
    for item in raw_list[:MAX_IMAGES]:
        if not isinstance(item, dict):
            continue
        b64 = item.get("data") or ""
        try:
            blob = base64.b64decode(b64, validate=False)
        except Exception:
            continue
        if not blob:
            continue
        total += len(blob)
        if total > MAX_TOTAL_BYTES:
            break
        name = _clip(item.get("name"), 80) or "image.jpg"
        mime = _clip(item.get("type"), 40) or "image/jpeg"
        subtype = mime.split("/")[-1] if "/" in mime else "jpeg"
        out.append((name, subtype, blob))
    return out


def _send_telegram(text):
    token = os.environ.get("BOT_TOKEN")
    chat_id = os.environ.get("CHAT_ID")
    if not token or not chat_id:
        return None
    payload = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": text, "disable_web_page_preview": "true"}
    ).encode("utf-8")
    req = urllib.request.Request(TG_URL % token, data=payload)
    with urllib.request.urlopen(req, timeout=5) as r:
        r.read()
    return True


def _send_email(subject, text, attachments):
    host = os.environ.get("SMTP_HOST")
    if not host:
        return None
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASS"]
    mail_to = os.environ.get("MAIL_TO", user)
    mail_from = os.environ.get("MAIL_FROM", user)

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = mail_to
    msg.set_content(text)
    for filename, subtype, blob in attachments:
        msg.add_attachment(blob, maintype="image", subtype=subtype, filename=filename)

    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15, context=ctx) as s:
            s.login(user, password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.starttls(context=ctx)
            s.login(user, password)
            s.send_message(msg)
    return True


def handler(event, context):
    event = event or {}
    if event.get("httpMethod") == "OPTIONS":
        return _resp(200, True, "ok")

    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        try:
            body = base64.b64decode(body).decode("utf-8")
        except Exception:
            return _resp(400, False, "bad body encoding")

    try:
        data = json.loads(body or "{}")
    except Exception:
        return _resp(400, False, "bad json")

    # honeypot — скрытое поле, которое заполняют только боты
    if data.get("company"):
        return _resp(200, True, "ok")

    name = _clip(data.get("name"), 200)
    contact = _clip(data.get("contact"), 200)
    if not name or not contact:
        return _resp(400, False, "name and contact required")

    # согласие на обработку ПДн обязательно
    if not data.get("consent"):
        return _resp(400, False, "consent required")

    order_type = _clip(data.get("type"), 200)
    message = _clip(data.get("message"), 4000)
    consent_at = _clip(data.get("consent_at"), 40)
    attachments = _decode_images(data.get("images"))

    text = (
        "Заявка с сайта Ceram8\n\n"
        "Имя: %s\n"
        "Контакт: %s\n"
        "Тип заказа: %s\n"
        "Сообщение: %s\n"
        "Фото: %s\n"
        "Согласие на обработку ПДн: да (%s)"
    ) % (
        name,
        contact,
        order_type or "—",
        message or "—",
        ("%d шт. (во вложении письма)" % len(attachments)) if attachments else "нет",
        consent_at or "—",
    )

    sent_any = False
    errors = []
    for label, fn in (
        ("telegram", lambda: _send_telegram(text)),
        ("email", lambda: _send_email("Заявка с сайта Ceram8", text, attachments)),
    ):
        try:
            if fn():
                sent_any = True
        except Exception as e:  # noqa: BLE001
            errors.append("%s: %s" % (label, e))

    if not sent_any:
        detail = "; ".join(errors) if errors else "no channel configured"
        return _resp(502, False, detail)

    return _resp(200, True, "sent")
