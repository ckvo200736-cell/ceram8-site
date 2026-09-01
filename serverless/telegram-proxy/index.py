"""
Ceram8 — приём заявок с формы сайта в Telegram.

Облачная функция для Yandex Cloud Functions (среда python312).
Токен бота и chat id хранятся в переменных окружения функции, в код не попадают.

Переменные окружения (задаются в настройках функции):
  BOT_TOKEN   — токен бота от @BotFather, например 123456:AA...
  CHAT_ID     — id чата/пользователя, куда слать заявки (число)
  ALLOW_ORIGIN — необязательно; домен сайта для CORS. По умолчанию "*"

Точка входа: index.handler
"""

import os
import json
import urllib.parse
import urllib.request

TG_URL = "https://api.telegram.org/bot%s/sendMessage"


def _origin():
    return os.environ.get("ALLOW_ORIGIN", "*")


def _resp(code, ok, msg):
    return {
        "statusCode": code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": _origin(),
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps({"ok": ok, "msg": msg}, ensure_ascii=False),
    }


def _clip(value, limit):
    return str(value or "").strip()[:limit]


def handler(event, context):
    if (event or {}).get("httpMethod") == "OPTIONS":
        return _resp(200, True, "ok")

    try:
        data = json.loads((event or {}).get("body") or "{}")
    except Exception:
        return _resp(400, False, "bad json")

    # honeypot — скрытое поле, которое заполняют только боты
    if data.get("company"):
        return _resp(200, True, "ok")

    name = _clip(data.get("name"), 200)
    contact = _clip(data.get("contact"), 200)
    if not name or not contact:
        return _resp(400, False, "name and contact required")

    order_type = _clip(data.get("type"), 200)
    message = _clip(data.get("message"), 2000)

    text = (
        "🧾 Заявка с сайта Ceram8\n\n"
        "Имя: %s\n"
        "Контакт: %s\n"
        "Тип заказа: %s\n"
        "Сообщение: %s"
    ) % (name, contact, order_type or "—", message or "—")

    token = os.environ["BOT_TOKEN"]
    chat_id = os.environ["CHAT_ID"]

    payload = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": text, "disable_web_page_preview": "true"}
    ).encode("utf-8")

    try:
        req = urllib.request.Request(TG_URL % token, data=payload)
        with urllib.request.urlopen(req, timeout=5) as r:
            r.read()
    except Exception:
        return _resp(502, False, "telegram request failed")

    return _resp(200, True, "sent")
